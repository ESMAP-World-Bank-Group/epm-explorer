import { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getModelBounds, buildIsoZoneMap, ZONE_TO_ISO } from '../utils/models'
import { rawUrl } from '../api/github'

const NE50_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

const TILES = {
  dark:      'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  light:     'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}
const LABEL_TILES = 'https://a.basemaps.cartocdn.com/only_labels/{z}/{x}/{y}.png'

let ne50Promise = null
function getNE50() {
  if (!ne50Promise) ne50Promise = fetch(NE50_URL).then(r => r.json())
  return ne50Promise
}

export default function MapPanel({ branch, model, meta, selectedZone, onZoneClick }) {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const [basemap, setBasemap] = useState('dark')
  const [mapReady, setMapReady] = useState(false)

  const countries = useMemo(() => model?.countries ?? meta?.countries ?? [], [model, meta])

  // Derive zone list from model or ZONE_TO_ISO keys
  const zones = useMemo(() => {
    if (model?.zones?.length) return model.zones
    // Fall back: any zones that map to one of the model's countries
    return Object.entries(ZONE_TO_ISO)
      .filter(([, iso]) => countries.includes(iso))
      .map(([z]) => z)
  }, [model, countries])

  const isoZoneMap = useMemo(() => buildIsoZoneMap(zones), [zones])
  const isoZoneMapRef = useRef(isoZoneMap)
  isoZoneMapRef.current = isoZoneMap

  const onZoneClickRef = useRef(onZoneClick)
  onZoneClickRef.current = onZoneClick

  // Initialize map once
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
      center: [30, 42],
      zoom: 3,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapInstance.current = map

    map.on('load', async () => {
      const geojson = await getNE50()

      map.addSource('countries', { type: 'geojson', data: geojson })
      map.addSource('countries-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      map.addLayer({ id: 'countries-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#141722', 'fill-opacity': 0.7 } })
      map.addLayer({ id: 'countries-model', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0 } })
      map.addLayer({ id: 'countries-selected-fill', type: 'fill', source: 'countries-selected',
        paint: { 'fill-color': '#60a5fa', 'fill-opacity': 0.55 } })
      map.addLayer({ id: 'countries-outline', type: 'line', source: 'countries',
        paint: { 'line-color': '#1e2640', 'line-width': 0.4 } })
      map.addLayer({ id: 'countries-model-outline', type: 'line', source: 'countries',
        paint: { 'line-color': '#1e2640', 'line-width': 0 } })

      // Labels on top
      map.addSource('labels', { type: 'raster', tiles: [LABEL_TILES], tileSize: 256 })
      map.addLayer({ id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.7 } })

      // Try to load interconnection lines
      try {
        const df = model?.data_folder ?? `data_${branch?.replace(/_\d{4}$/, '')}`
        const linesText = await fetch(rawUrl(branch, `epm/input/${df}/linestring_countries.geojson`))
        if (linesText.ok) {
          const linesGeo = await linesText.json()
          map.addSource('interco', { type: 'geojson', data: linesGeo })
          map.addLayer({ id: 'interco-lines', type: 'line', source: 'interco',
            paint: { 'line-color': '#3b82f6', 'line-width': 1, 'line-opacity': 0.3 },
          })
        }
      } catch { /* no lines available */ }

      // Click handler
      map.on('click', 'countries-model', e => {
        const iso = e.features[0]?.properties?.ADM0_A3
        if (!iso) return
        const zone = isoZoneMapRef.current[iso]
        if (zone) onZoneClickRef.current(zone)
      })
      map.on('mousemove', 'countries-model', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'countries-model', () => { map.getCanvas().style.cursor = '' })

      setMapReady(true)
    })

    return () => map.remove()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Update highlighted countries when model loads
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return
    const map = mapInstance.current
    const isos = countries

    map.setPaintProperty('countries-fill', 'fill-color', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', isos]], '#1e2235', '#0d0f16'
    ])
    map.setPaintProperty('countries-fill', 'fill-opacity', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', isos]], 0.5, 0.75
    ])
    map.setPaintProperty('countries-model', 'fill-opacity', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', isos]], 0.35, 0
    ])
    map.setPaintProperty('countries-model-outline', 'line-color', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', isos]], '#60a5fa', 'transparent'
    ])
    map.setPaintProperty('countries-model-outline', 'line-width', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', isos]], 1.2, 0
    ])
    map.setPaintProperty('countries-outline', 'line-color', [
      'case', ['in', ['get', 'ADM0_A3'], ['literal', isos]], '#2a3a5c', '#161926'
    ])

    // Fit bounds
    if (isos.length) {
      const bounds = getModelBounds(isos)
      if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 8, duration: 800 })
    }
  }, [mapReady, countries.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Update selected zone highlight
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return
    const map = mapInstance.current
    const selectedISO = selectedZone ? ZONE_TO_ISO[selectedZone] : null
    const source = map.getSource('countries-selected')
    if (!source) return

    if (!selectedISO) {
      source.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    // We don't have the full GeoJSON here, so use a filter on the existing countries source
    map.setFilter('countries-selected-fill', ['==', ['get', 'ADM0_A3'], selectedISO])
    map.setPaintProperty('countries-selected-fill', 'fill-opacity', 0.55)
    // Use countries source for selected highlight instead
    map.setPaintProperty('countries-model', 'fill-color', [
      'case',
      ['==', ['get', 'ADM0_A3'], selectedISO], '#60a5fa',
      '#3b82f6',
    ])
  }, [mapReady, selectedZone])

  // Update basemap tiles
  useEffect(() => {
    if (!mapInstance.current) return
    const map = mapInstance.current
    if (!map.isStyleLoaded()) return
    const source = map.getSource('basemap')
    if (source) source.setTiles([TILES[basemap]])
  }, [basemap])

  return (
    <div className="map-panel">
      <div ref={mapRef} className="map-panel-map" />
      <div className="basemap-switcher">
        {Object.keys(TILES).map(k => (
          <button
            key={k}
            className={`bm-btn${basemap === k ? ' active' : ''}`}
            onClick={() => setBasemap(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
