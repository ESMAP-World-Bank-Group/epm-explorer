import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useBranches } from '../hooks/useGitHub'
import { MODEL_META } from '../utils/models'

const NE110_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

const TILES = {
  dark:      'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  light:     'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}
const LABEL_TILES = 'https://a.basemaps.cartocdn.com/only_labels/{z}/{x}/{y}.png'

const TYPE_COLORS = { national: '#3b82f6', regional: '#a855f7' }

export default function WorldPage() {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const [basemap, setBasemap]   = useState('dark')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [tooltip, setTooltip]   = useState(null)
  const navigate = useNavigate()

  const { branches, loading } = useBranches()

  const latestBranches = useMemo(() => {
    const map = {}
    branches.forEach(b => {
      if (!map[b.model] || b.year > map[b.model].year) map[b.model] = b
    })
    return map
  }, [branches])
  const latestRef = useRef({})
  latestRef.current = latestBranches

  // ISO codes per type for paint expressions
  const { nationalISOs, regionalISOs } = useMemo(() => {
    const nat = [], reg = []
    Object.entries(latestBranches).forEach(([model, b]) => {
      const meta = MODEL_META[model]
      if (!meta) return
      if (meta.type === 'regional') meta.countries.forEach(c => reg.push(c))
      else meta.countries.forEach(c => nat.push(c))
    })
    return { nationalISOs: [...new Set(nat)], regionalISOs: [...new Set(reg)] }
  }, [latestBranches])
  const nationalRef  = useRef([])
  const regionalRef  = useRef([])
  nationalRef.current = nationalISOs
  regionalRef.current = regionalISOs

  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          basemap: { type: 'raster', tiles: [TILES.dark], tileSize: 256, attribution: '© CartoDB © OpenStreetMap' },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [20, 20],
      zoom: 1.8,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    mapInstance.current = map

    map.on('load', async () => {
      const geojson = await fetch(NE110_URL).then(r => r.json())
      map.addSource('countries', { type: 'geojson', data: geojson })

      map.addLayer({ id: 'countries-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#141722', 'fill-opacity': 0.7 } })
      map.addLayer({ id: 'countries-outline', type: 'line', source: 'countries',
        paint: { 'line-color': '#1a1e30', 'line-width': 0.4 } })
      map.addSource('labels', { type: 'raster', tiles: [LABEL_TILES], tileSize: 256 })
      map.addLayer({ id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.6 } })

      map.on('click', 'countries-fill', e => {
        const iso = e.features[0]?.properties?.ADM0_A3
        if (!iso) return
        const current = latestRef.current
        const matches = Object.entries(current).filter(([m]) => MODEL_META[m]?.countries.includes(iso))
        if (!matches.length) return
        const chosen = matches.find(([m]) => MODEL_META[m]?.type === 'regional') ?? matches[0]
        navigateRef.current(`/model/${chosen[1].branch}`)
      })
      map.on('mousemove', 'countries-fill', e => {
        const iso = e.features[0]?.properties?.ADM0_A3
        const name = e.features[0]?.properties?.NAME_LONG ?? e.features[0]?.properties?.NAME
        const allISOs = [...nationalRef.current, ...regionalRef.current]
        if (!allISOs.includes(iso)) { setTooltip(null); map.getCanvas().style.cursor = ''; return }
        const modelEntry = Object.entries(latestRef.current).find(([m]) => MODEL_META[m]?.countries.includes(iso))
        map.getCanvas().style.cursor = 'pointer'
        setTooltip({ x: e.point.x, y: e.point.y, name, model: modelEntry ? (MODEL_META[modelEntry[0]]?.label ?? modelEntry[0]) : null, year: modelEntry?.[1]?.year })
      })
      map.on('mouseleave', 'countries-fill', () => { setTooltip(null); map.getCanvas().style.cursor = '' })
      setMapLoaded(true)
    })
    return () => map.remove()
  }, [])

  // Update highlights
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    const map = mapInstance.current
    const nat = nationalISOs, reg = regionalISOs
    const all = [...nat, ...reg]

    map.setPaintProperty('countries-fill', 'fill-color', [
      'case',
      ['in', ['get', 'ADM0_A3'], ['literal', reg]], TYPE_COLORS.regional,
      ['in', ['get', 'ADM0_A3'], ['literal', nat]], TYPE_COLORS.national,
      '#0d0f16',
    ])
    map.setPaintProperty('countries-fill', 'fill-opacity', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', all]], 0.4, 0.65
    ])
    map.setPaintProperty('countries-outline', 'line-color', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', all]], '#4b5563', '#161926'
    ])
    map.setPaintProperty('countries-outline', 'line-width', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', all]], 1, 0.3
    ])
  }, [mapLoaded, nationalISOs, regionalISOs])

  // Basemap switch
  useEffect(() => {
    if (!mapInstance.current) return
    const map = mapInstance.current
    if (!map.isStyleLoaded()) return
    map.getSource('basemap')?.setTiles([TILES[basemap]])
  }, [basemap])

  const modelCount = Object.keys(latestBranches).length

  return (
    <div className="world-page">
      <div ref={mapRef} className="world-map" />
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          <div>{tooltip.name}</div>
          {tooltip.model && <div className="tooltip-model">{tooltip.model} · {tooltip.year}</div>}
        </div>
      )}
      <div className="world-legend">
        <h4>EPM Models</h4>
        <div className="legend-item"><div className="legend-dot" style={{ background: TYPE_COLORS.national }} />National</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: TYPE_COLORS.regional }} />Regional</div>
      </div>
      {!loading && modelCount > 0 && (
        <div className="model-count-badge"><strong>{modelCount}</strong> model{modelCount !== 1 ? 's' : ''}</div>
      )}
      <div className="basemap-switcher world-bm">
        {Object.keys(TILES).map(k => (
          <button key={k} className={`bm-btn${basemap === k ? ' active' : ''}`} onClick={() => setBasemap(k)}>{k}</button>
        ))}
      </div>
    </div>
  )
}
