import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { useTheme } from '../App'
import { getT, mapStyle, swapBasemap } from '../constants'
import { useBranches } from '../hooks/useGitHub'
import { MODEL_META } from '../utils/models'

const NE110_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

const MODEL_COLORS = {
  eapp:     '#3b82f6',
  blacksea: '#a855f7',
}

export default function WorldPage() {
  const { theme } = useTheme()
  const t = getT(theme)
  const mapRef      = useRef(null)
  const mapInstance = useRef(null)
  const [basemap, setBasemap]     = useState('minimal')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [tooltip, setTooltip]     = useState(null)
  const navigate = useNavigate()

  const { branches } = useBranches()

  const latestBranches = useMemo(() => {
    const map = {}
    branches.forEach(b => {
      if (!map[b.model] || b.year > map[b.model].year) map[b.model] = b
    })
    return map
  }, [branches])

  const latestRef  = useRef({})
  latestRef.current = latestBranches
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // ISO → model entry
  const isoModelMap = useMemo(() => {
    const m = {}
    Object.entries(latestBranches).forEach(([model, b]) => {
      const meta = MODEL_META[model]
      if (!meta) return
      meta.countries.forEach(iso => { if (!m[iso]) m[iso] = { model, branch: b.branch, year: b.year } })
    })
    return m
  }, [latestBranches])

  const isoModelRef = useRef({})
  isoModelRef.current = isoModelMap

  // Init map once
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: mapStyle(theme),
      center: [20, 15], zoom: 2.2, minZoom: 1.5, maxZoom: 9,
      attributionControl: false,
    })
    mapInstance.current = map
    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: `popup-${t.isDark ? 'dark' : 'light'}` })
    map.on('movestart', () => setTooltip(null))

    map.on('load', async () => {
      const geojson = await fetch(NE110_URL).then(r => r.json())
      geojson.features.forEach((f, i) => {
        const p = f.properties
        let iso = p.ISO_A3 || '-99'
        if (iso === '-99') iso = p.ISO_A3_EH || '-99'
        if (iso === '-99') iso = p.ADM0_A3 || '-99'
        p.ISO_A3 = iso; f.id = i
      })

      map.addSource('countries', { type: 'geojson', data: geojson, generateId: false })
      const tv = getT(theme)
      map.addLayer({ id: 'land',    type: 'fill', source: 'countries', paint: { 'fill-color': tv.land, 'fill-opacity': 1 } })
      map.addLayer({ id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': tv.worldBdr, 'line-width': tv.worldBdrW } })

      // Model country highlights — painted after data loads (see effect below)
      map.addLayer({ id: 'model-fill',   type: 'fill', source: 'countries', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0 } })
      map.addLayer({ id: 'model-border', type: 'line', source: 'countries', paint: { 'line-color': '#3b82f6', 'line-width': 0 } })

      let hoveredId = null
      map.on('mousemove', 'model-fill', e => {
        map.getCanvas().style.cursor = 'pointer'
        if (hoveredId !== null) map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false })
        hoveredId = e.features[0].id
        map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: true })
        const iso  = e.features[0].properties.ISO_A3
        const name = e.features[0].properties.NAME_LONG ?? e.features[0].properties.NAME
        const entry = isoModelRef.current[iso]
        const modelMeta = entry ? MODEL_META[entry.model] : null
        popup.setLngLat(e.lngLat)
          .setHTML(`<b>${name}</b>${modelMeta ? `<br><span style="opacity:.65;font-size:.85em">${modelMeta.label} · ${entry.year}</span>` : ''}`)
          .addTo(map)
      })
      map.on('mouseleave', 'model-fill', () => {
        map.getCanvas().style.cursor = ''
        if (hoveredId !== null) map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false })
        hoveredId = null
        popup.remove()
      })
      map.on('click', 'model-fill', e => {
        const iso = e.features[0]?.properties?.ISO_A3
        const entry = isoModelRef.current[iso]
        if (entry) navigateRef.current(`/model/${entry.branch}`)
      })

      setMapLoaded(true)
    })

    return () => { popup.remove(); map.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update highlights when model list or theme changes
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return
    const map = mapInstance.current
    const tv  = getT(theme)

    map.setPaintProperty('land',    'fill-color',  tv.land)
    map.setPaintProperty('borders', 'line-color',  tv.worldBdr)
    map.setPaintProperty('borders', 'line-width',  tv.worldBdrW)
    map.setPaintProperty('bg',      'background-color', tv.bg)

    const allISOs = Object.keys(isoModelMap)
    if (!allISOs.length) return

    const colorExpr = ['match', ['get', 'ISO_A3'],
      ...allISOs.flatMap(iso => [iso, MODEL_COLORS[isoModelMap[iso]?.model] ?? '#3b82f6']),
      'transparent',
    ]
    map.setFilter('model-fill',   ['in', ['get', 'ISO_A3'], ['literal', allISOs]])
    map.setFilter('model-border', ['in', ['get', 'ISO_A3'], ['literal', allISOs]])
    map.setPaintProperty('model-fill',   'fill-color',  colorExpr)
    map.setPaintProperty('model-fill',   'fill-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], 0.55, 0.28])
    map.setPaintProperty('model-border', 'line-color',  colorExpr)
    map.setPaintProperty('model-border', 'line-width',  0.9)
    map.setPaintProperty('model-border', 'line-opacity', 0.7)
  }, [mapLoaded, isoModelMap, theme])

  // Basemap switch
  useEffect(() => {
    if (!mapInstance.current) return
    swapBasemap(mapInstance.current, basemap, theme)
  }, [basemap, theme])

  const modelCount = Object.keys(latestBranches).filter(m => MODEL_META[m]).length

  return (
    <div className="world-page">
      <div ref={mapRef} className="world-map" />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 52, left: 18,
        background: `${t.panel}DD`, border: `1px solid ${t.panelBorder}`,
        borderRadius: 6, padding: '10px 14px', zIndex: 10, backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: 10, color: t.lblMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>EPM Models</div>
        {Object.entries(MODEL_META).map(([model, meta]) => (
          <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: t.lblRow, marginBottom: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: MODEL_COLORS[model] ?? '#888', flexShrink: 0, display: 'inline-block' }} />
            {meta.label}
          </div>
        ))}
        {modelCount > 0 && <div style={{ fontSize: 10, color: t.lblMuted, marginTop: 6 }}>{modelCount} model{modelCount !== 1 ? 's' : ''} available</div>}
      </div>

      {/* Basemap switcher */}
      <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 4, zIndex: 10 }}>
        {['minimal','labeled','satellite'].map(k => (
          <button key={k} onClick={() => setBasemap(k)} style={{
            background: `${t.panel}CC`, border: `1px solid ${basemap === k ? 'rgba(74,143,204,0.6)' : t.panelBorder}`,
            color: basemap === k ? t.lbl : t.lblMuted,
            padding: '4px 10px', borderRadius: 4, fontSize: 10, fontFamily: 'inherit',
            letterSpacing: '0.5px', backdropFilter: 'blur(4px)',
            backgroundColor: basemap === k ? 'rgba(74,143,204,0.12)' : `${t.panel}CC`,
          }}>{k}</button>
        ))}
      </div>
    </div>
  )
}
