import { useMemo, useState } from 'react'
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'

const CHART = {
  grid:    { strokeDasharray: '3 3', stroke: 'rgba(128,140,180,0.2)' },
  tooltip: { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 } },
  axis:    { tick: { fill: 'var(--text-muted)', fontSize: 10 } },
}
const HOUR_COLS_t1  = Array.from({ length: 24 }, (_, i) => `t${i + 1}`)
const HOUR_COLS_t01 = Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)
const ZONE_COLORS = ['#3b82f6','#f59e0b','#22c55e','#ef4444','#a855f7','#06b6d4','#f97316','#ec4899','#84cc16','#8b5cf6','#14b8a6','#eab308']

function detectHours(row) {
  if (!row) return HOUR_COLS_t1
  if (row['t01'] !== undefined) return HOUR_COLS_t01
  return HOUR_COLS_t1
}

function zoneColor(zone, allZones) {
  const i = allZones.indexOf(zone)
  return ZONE_COLORS[i % ZONE_COLORS.length]
}

export default function LoadTab({ branch, model, selectedZone, selectedISO, isoToZonesMap }) {
  const df = model?.data_folder
  const fcastPath   = df ? `epm/input/${df}/load/pDemandForecast.csv`  : null
  const profilePath = df ? `epm/input/${df}/load/pDemandProfile.csv`   : null

  const { data: fcast,   loading: fLoad }   = useCSV(branch, fcastPath)
  const { data: profile, loading: pLoad }   = useCSV(branch, profilePath)

  const [selSeason, setSelSeason] = useState('')
  const [selDay,    setSelDay]    = useState('')
  const [hiddenZones, setHiddenZones] = useState(new Set())

  const zonesForISO = selectedISO && isoToZonesMap ? (isoToZonesMap[selectedISO] ?? []) : []

  function filterBySelection(rows, zoneCol) {
    if (selectedZone) return rows.filter(r => (r[zoneCol] ?? '') === selectedZone)
    if (zonesForISO.length) return rows.filter(r => zonesForISO.includes(r[zoneCol] ?? ''))
    return rows
  }

  // Demand forecast: one line per zone (peak only)
  const { forecastData, forecastZones, yearCols } = useMemo(() => {
    if (!fcast?.length) return { forecastData: [], forecastZones: [], yearCols: [] }
    const zoneCol = ['z', 'zone', 'Zone'].find(k => fcast[0]?.[k] !== undefined) ?? 'z'
    const yrs = Object.keys(fcast[0]).filter(k => /^\d{4}$/.test(k))
    const rows = filterBySelection(fcast, zoneCol)

    const peakRows = rows.filter(r => String(r.type ?? r.Type ?? '').toLowerCase() === 'peak')
    const zones = [...new Set(peakRows.map(r => r[zoneCol]))].filter(Boolean)

    const forecastData = yrs.map(yr => {
      const point = { year: parseInt(yr) }
      zones.forEach(z => {
        const zRows = peakRows.filter(r => r[zoneCol] === z)
        point[z] = zRows.reduce((s, r) => s + (parseFloat(r[yr]) || 0), 0)
      })
      return point
    })

    return { forecastData, forecastZones: zones, yearCols: yrs }
  }, [fcast, selectedZone, selectedISO, zonesForISO])

  // Load profile: one line per zone
  const { seasons, dayTypes, profileData, profileZones } = useMemo(() => {
    if (!profile?.length) return { seasons: [], dayTypes: [], profileData: [], profileZones: [] }
    const zoneCol    = ['z', 'zone', 'Zone'].find(k => profile[0]?.[k] !== undefined) ?? 'z'
    const seasonCol  = ['q', 'season', 'Season'].find(k => profile[0]?.[k] !== undefined) ?? 'q'
    const daytypeCol = ['d', 'daytype', 'DayType'].find(k => profile[0]?.[k] !== undefined) ?? 'd'
    const hourCols   = detectHours(profile[0])

    const rows   = filterBySelection(profile, zoneCol)
    const seasons  = [...new Set(rows.map(r => r[seasonCol]))].filter(Boolean)
    const dayTypes = [...new Set(rows.map(r => r[daytypeCol]))].filter(Boolean)
    const zones    = [...new Set(rows.map(r => r[zoneCol]))].filter(Boolean)

    const s = selSeason || seasons[0] || ''
    const d = selDay    || dayTypes[0] || ''
    const filtered = rows.filter(r => r[seasonCol] === s && r[daytypeCol] === d)

    const profileData = hourCols.map((h, i) => {
      const point = { hour: i + 1 }
      zones.forEach(z => {
        const zRows = filtered.filter(r => r[zoneCol] === z)
        point[z] = zRows.length ? zRows.reduce((sum, r) => sum + (parseFloat(r[h]) || 0), 0) / zRows.length : 0
      })
      return point
    })
    return { seasons, dayTypes, profileData, profileZones: zones }
  }, [profile, selectedZone, selectedISO, zonesForISO, selSeason, selDay])

  const toggleZone = z => setHiddenZones(prev => {
    const next = new Set(prev)
    if (next.has(z)) next.delete(z); else next.add(z)
    return next
  })

  const allForecastZones = forecastZones
  const allProfileZones  = profileZones

  if (!df) return <div className="empty-msg">Model metadata not available</div>

  return (
    <div>
      {(selectedZone || selectedISO) && (
        <div className="zone-filter-note">Filtered to: <strong>{selectedZone ?? selectedISO}</strong></div>
      )}

      {/* Demand Forecast */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Peak Demand Forecast (MW)</span>
        {fcastPath && <a className="dl-btn" href={rawUrl(branch, fcastPath)} download>↓ CSV</a>}
      </div>

      {fLoad ? (
        <div className="loading-center" style={{ height: 100 }}>Loading…</div>
      ) : forecastData.length > 0 ? (
        <>
          {/* Zone toggle legend */}
          {allForecastZones.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {allForecastZones.map(z => (
                <span key={z} className={`legend-item${hiddenZones.has(z) ? ' off' : ''}`} onClick={() => toggleZone(z)}>
                  <span className="legend-dot-line" style={{ background: zoneColor(z, allForecastZones) }} />
                  {z}
                </span>
              ))}
            </div>
          )}
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={forecastData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...CHART.grid} />
                <XAxis dataKey="year" {...CHART.axis} />
                <YAxis {...CHART.axis} tickFormatter={v => v.toLocaleString()} label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10, dy: 20 }} />
                <Tooltip {...CHART.tooltip} formatter={(v, n) => [v.toLocaleString() + ' MW', n]} />
                {allForecastZones.filter(z => !hiddenZones.has(z)).map(z => (
                  <Line key={z} type="monotone" dataKey={z} stroke={zoneColor(z, allForecastZones)} strokeWidth={1.8} dot={false} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="empty-msg">No demand forecast data found</div>
      )}

      {/* Load Profile */}
      {!pLoad && profile?.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <span>Load Profile</span>
            {profilePath && <a className="dl-btn" href={rawUrl(branch, profilePath)} download>↓ CSV</a>}
          </div>
          <div className="filter-row">
            <span className="filter-label">Season</span>
            <select className="filter-select" value={selSeason || seasons[0] || ''} onChange={e => setSelSeason(e.target.value)}>
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="filter-label">Day type</span>
            <select className="filter-select" value={selDay || dayTypes[0] || ''} onChange={e => setSelDay(e.target.value)}>
              {dayTypes.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {allProfileZones.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {allProfileZones.map(z => (
                <span key={z} className={`legend-item${hiddenZones.has(z) ? ' off' : ''}`} onClick={() => toggleZone(z)}>
                  <span className="legend-dot-line" style={{ background: zoneColor(z, allProfileZones) }} />
                  {z}
                </span>
              ))}
            </div>
          )}
          <div className="chart-card">
            <div className="chart-card-title">Normalised load (p.u.)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={profileData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...CHART.grid} />
                <XAxis dataKey="hour" {...CHART.axis} />
                <YAxis {...CHART.axis} domain={[0, 1]} tickFormatter={v => v.toFixed(1)} />
                <Tooltip {...CHART.tooltip} formatter={(v, n) => [v.toFixed(3), n]} labelFormatter={l => `Hour ${l}`} />
                {allProfileZones.filter(z => !hiddenZones.has(z)).map(z => (
                  <Line key={z} type="monotone" dataKey={z} stroke={zoneColor(z, allProfileZones)} strokeWidth={1.8} dot={false} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
