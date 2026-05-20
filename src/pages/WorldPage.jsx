import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useBranches } from '../hooks/useGitHub'
import { MODEL_META } from '../utils/models'

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

const BASEMAP = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© CartoDB © OpenStreetMap',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

export default function WorldPage() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const navigateRef = useRef(null)
  const navigate = useNavigate()
  navigateRef.current = navigate

  const { branches, loading } = useBranches()

  // Group branches by model, keep latest year
  const latestBranches = useMemo(() => {
    const map = {}
    branches.forEach(b => {
      if (!map[b.model] || b.year > map[b.model].year) map[b.model] = b
    })
    return map
  }, [branches])
  const latestBranchesRef = useRef({})
  latestBranchesRef.current = latestBranches

  const highlightedISOs = useMemo(() => {
    const isos = new Set()
    Object.keys(latestBranches).forEach(model => {
      MODEL_META[model]?.countries.forEach(c => isos.add(c))
    })
    return [...isos]
  }, [latestBranches])
  const highlightedISOsRef = useRef([])
  highlightedISOsRef.current = highlightedISOs

  const [tooltip, setTooltip] = useState(null)

  // Initialize map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: BASEMAP,
      center: [25, 30],
      zoom: 1.8,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    mapInstance.current = map

    map.on('load', async () => {
      // Empty source initially
      map.addSource('countries', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': '#1e2235', 'fill-opacity': 0.6 },
      })
      map.addLayer({
        id: 'countries-outline',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': '#2a2f47', 'line-width': 0.5 },
      })

      // Load countries GeoJSON
      try {
        const res = await fetch(COUNTRIES_URL)
        const geojson = await res.json()
        map.getSource('countries').setData(geojson)
        setMapLoaded(true)
      } catch {
        setMapLoaded(true)
      }

      // Click handler
      map.on('click', 'countries-fill', e => {
        const iso = e.features[0]?.properties?.ADM0_A3
        if (!iso) return
        const current = latestBranchesRef.current
        const matches = Object.entries(current).filter(([model]) =>
          MODEL_META[model]?.countries.includes(iso)
        )
        if (!matches.length) return
        // Prefer regional, else first
        const chosen = matches.find(([m]) => MODEL_META[m]?.type === 'regional') ?? matches[0]
        navigateRef.current(`/model/${chosen[1].branch}`)
      })

      // Hover handler
      map.on('mousemove', 'countries-fill', e => {
        const iso = e.features[0]?.properties?.ADM0_A3
        const name = e.features[0]?.properties?.NAME_LONG ?? e.features[0]?.properties?.NAME
        const isHighlighted = highlightedISOsRef.current.includes(iso)
        if (!isHighlighted) {
          setTooltip(null)
          map.getCanvas().style.cursor = ''
          return
        }
        const modelEntry = Object.entries(latestBranchesRef.current).find(([m]) =>
          MODEL_META[m]?.countries.includes(iso)
        )
        map.getCanvas().style.cursor = 'pointer'
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          name,
          model: modelEntry ? (MODEL_META[modelEntry[0]]?.label ?? modelEntry[0]) : null,
          year: modelEntry?.[1]?.year,
        })
      })
      map.on('mouseleave', 'countries-fill', () => {
        setTooltip(null)
        map.getCanvas().style.cursor = ''
      })
    })

    return () => { map.remove() }
  }, [])

  // Update highlight paint when branches load
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    const map = mapInstance.current
    const isos = highlightedISOs

    map.setPaintProperty('countries-fill', 'fill-color', [
      'case',
      ['in', ['get', 'ADM0_A3'], ['literal', isos]],
      ['case',
        ['==', ['get', 'ADM0_A3'], ['literal', isos[0] ?? '']],
        '#3b82f6',
        '#3b82f6',
      ],
      '#141722',
    ])
    map.setPaintProperty('countries-fill', 'fill-opacity', [
      'case',
      ['in', ['get', 'ADM0_A3'], ['literal', isos]],
      0.45,
      0.5,
    ])
    map.setPaintProperty('countries-outline', 'line-color', [
      'case',
      ['in', ['get', 'ADM0_A3'], ['literal', isos]],
      '#60a5fa',
      '#1e2640',
    ])
    map.setPaintProperty('countries-outline', 'line-width', [
      'case',
      ['in', ['get', 'ADM0_A3'], ['literal', isos]],
      1.2,
      0.4,
    ])
  }, [mapLoaded, highlightedISOs])

  const modelCount = Object.keys(latestBranches).length

  return (
    <div className="world-page">
      <div ref={mapRef} className="world-map" />

      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          <div>{tooltip.name}</div>
          {tooltip.model && (
            <div className="tooltip-model">{tooltip.model} · {tooltip.year}</div>
          )}
        </div>
      )}

      <div className="world-legend">
        <h4>EPM Models</h4>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#3b82f6' }} />
          National model
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#a855f7' }} />
          Regional model
        </div>
      </div>

      {!loading && modelCount > 0 && (
        <div className="model-count-badge">
          <strong>{modelCount}</strong> model{modelCount !== 1 ? 's' : ''} available
        </div>
      )}
      {loading && (
        <div className="model-count-badge">Loading models…</div>
      )}
    </div>
  )
}
