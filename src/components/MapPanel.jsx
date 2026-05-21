import { useEffect, useRef, useState, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { useTheme } from '../App'
import { getT, mapStyle, swapBasemap } from '../constants'
import { getModelBounds, computeIsoBounds, ZONE_TO_ISO } from '../utils/models'
import { rawUrl } from '../api/github'

const NE50_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'

let ne50Promise = null
function getNE50() {
  if (!ne50Promise) ne50Promise = fetch(NE50_URL).then(r => r.json()).then(gj => {
    // Normalize ISO field
    gj.features.forEach((f, i) => {
      const p = f.properties
      let iso = p.ISO_A3 || '-99'
      if (iso === '-99') iso = p.ISO_A3_EH || '-99'
      if (iso === '-99') iso = p.ADM0_A3 || '-99'
      p.ISO_A3 = iso; f.id = i
    })
    return gj
  })
  return ne50Promise
}

export default function MapPanel({ branch, model, meta, selectedISO, onCountryClick }) {
  const { theme } = useTheme()
  const t = getT(theme)
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const geojsonRef  = useRef(null)
  const [basemap, setBasemap] = useState('minimal')
  const [mapReady, setMapReady] = useState(false)

  const countries = useMemo(() => model?.countries ?? meta?.countries ?? [], [model, meta])
  const countriesKey = countries.join(',')

  // Derive clickable ISOs from model zones
  const modelISOs = useMemo(() => {
    const zones = model?.zones ?? []
    if (zones.length) {
      return [...new Set(zones.map(z => ZONE_TO_ISO[z]).filter(Boolean))]
    }
    return countries
  }, [model, countries])

  const onCountryClickRef = useRef(onCountryClick)
  onCountryClickRef.current = onCountryClick

  // Init map once
  useEffect(() => {
    const tv = getT(theme)
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: mapStyle(theme),
      center: [30, 15], zoom: 3, minZoom: 1, maxZoom: 12,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapInstance.current = map

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: `popup-${tv.isDark ? 'dark' : 'light'}` })

    map.on('load', async () => {
      const geojson = await getNE50()
      geojsonRef.current = geojson

      map.addSource('countries', { type: 'geojson', data: geojson, generateId: false })

      map.addLayer({ id: 'land',    type: 'fill', source: 'countries', paint: { 'fill-color': tv.land, 'fill-opacity': 1 } })
      map.addLayer({ id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': tv.worldBdr, 'line-width': tv.worldBdrW } })

      // Model area highlight
      map.addLayer({ id: 'model-fill',   type: 'fill', source: 'countries',
        paint: { 'fill-color': tv.highlight.fill, 'fill-opacity': 0 } })
      map.addLayer({ id: 'model-border', type: 'line', source: 'countries',
        paint: { 'line-color': tv.highlight.border, 'line-width': 0 } })

      // Selected country highlight
      map.addLayer({ id: 'selected-fill',   type: 'fill', source: 'countries',
        filter: ['==', ['get', 'ISO_A3'], ''],
        paint: { 'fill-color': tv.highlight.fill, 'fill-opacity': 0.45 } })
      map.addLayer({ id: 'selected-border', type: 'line', source: 'countries',
        filter: ['==', ['get', 'ISO_A3'], ''],
        paint: { 'line-color': tv.highlight.border, 'line-width': tv.highlight.borderW * 1.8 } })

      // Interconnection lines (optional, from branch)
      try {
        const df = model?.data_folder ?? `data_${branch?.replace(/_\d{4}$/, '')}`
        const res = await fetch(rawUrl(branch, `epm/input/${df}/linestring_countries.geojson`))
        if (res.ok) {
          const linesGeo = await res.json()
          map.addSource('interco', { type: 'geojson', data: linesGeo })
          map.addLayer({ id: 'interco-lines', type: 'line', source: 'interco',
            paint: { 'line-color': tv.highlight.fill, 'line-width': 1.2, 'line-opacity': 0.35 } })
        }
      } catch { /* not available */ }

      // Hover + click
      let hoveredId = null
      map.on('mousemove', 'model-fill', e => {
        map.getCanvas().style.cursor = 'pointer'
        if (hoveredId !== null) map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false })
        hoveredId = e.features[0].id
        map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: true })
        const name = e.features[0].properties.NAME_LONG ?? e.features[0].properties.NAME ?? ''
        popup.setLngLat(e.lngLat).setHTML(`<b>${name}</b>`).addTo(map)
      })
      map.on('mouseleave', 'model-fill', () => {
        map.getCanvas().style.cursor = ''
        if (hoveredId !== null) map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false })
        hoveredId = null; popup.remove()
      })
      map.on('click', 'model-fill', e => {
        const iso = e.features[0]?.properties?.ISO_A3
        if (iso) onCountryClickRef.current(iso)
      })

      setMapReady(true)
    })

    return () => { popup.remove(); map.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update model countries highlight + fit bounds
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return
    const map = mapInstance.current
    const tv  = getT(theme)
    const isos = countries

    map.setPaintProperty('land',    'fill-color', tv.land)
    map.setPaintProperty('borders', 'line-color', tv.worldBdr)
    map.setPaintProperty('borders', 'line-width', tv.worldBdrW)
    map.setPaintProperty('bg', 'background-color', tv.bg)

    if (!isos.length) return

    map.setFilter('model-fill',   ['in', ['get', 'ISO_A3'], ['literal', isos]])
    map.setFilter('model-border', ['in', ['get', 'ISO_A3'], ['literal', isos]])
    map.setPaintProperty('model-fill',   'fill-color',  tv.highlight.fill)
    map.setPaintProperty('model-fill',   'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], 0.45, 0.12])
    map.setPaintProperty('model-border', 'line-color',  tv.highlight.border)
    map.setPaintProperty('model-border', 'line-width',  tv.highlight.borderW)

    const bounds = getModelBounds(isos)
    if (bounds) map.fitBounds(bounds, { padding: 50, maxZoom: 7, duration: 600 })
  }, [mapReady, countriesKey, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update selected country highlight + zoom
  useEffect(() => {
    if (!mapReady || !mapInstance.current) return
    const map = mapInstance.current
    const tv  = getT(theme)

    if (!selectedISO) {
      // Back to region view
      map.setFilter('selected-fill',   ['==', ['get', 'ISO_A3'], ''])
      map.setFilter('selected-border', ['==', ['get', 'ISO_A3'], ''])
      map.setPaintProperty('model-fill', 'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], 0.45, 0.12])
      // Fly back to model bounds
      const bounds = getModelBounds(countries)
      if (bounds) map.fitBounds(bounds, { padding: 50, maxZoom: 7, duration: 700 })
      return
    }

    // Highlight selected, dim others
    map.setFilter('selected-fill',   ['==', ['get', 'ISO_A3'], selectedISO])
    map.setFilter('selected-border', ['==', ['get', 'ISO_A3'], selectedISO])
    map.setPaintProperty('selected-fill',   'fill-color',   tv.highlight.fill)
    map.setPaintProperty('selected-fill',   'fill-opacity', 0.45)
    map.setPaintProperty('selected-border', 'line-color',   tv.highlight.border)
    map.setPaintProperty('selected-border', 'line-width',   tv.highlight.borderW * 2)
    // Dim non-selected model countries
    map.setPaintProperty('model-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'ISO_A3'], selectedISO], 0,
      ['boolean', ['feature-state', 'hover'], false], 0.35,
      0.06,
    ])

    // Zoom to selected country
    const bounds = computeIsoBounds(selectedISO, geojsonRef.current)
    if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 700 })
  }, [mapReady, selectedISO, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  // Basemap switch
  useEffect(() => {
    if (!mapInstance.current) return
    swapBasemap(mapInstance.current, basemap, theme)
  }, [basemap, theme])

  return (
    <div className="map-panel">
      <div ref={mapRef} className="map-panel-map" />
      <div className="basemap-switcher">
        {['minimal','labeled','satellite'].map(k => (
          <button key={k} className={`bm-btn${basemap === k ? ' active' : ''}`} onClick={() => setBasemap(k)}>{k}</button>
        ))}
      </div>
    </div>
  )
}
