import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'
import { techColor } from '../../utils/colors'

const CHART = {
  grid:    { strokeDasharray: '3 3', stroke: 'rgba(128,140,180,0.2)' },
  tooltip: { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 } },
  axis:    { tick: { fill: 'var(--text-muted)', fontSize: 10 } },
}
const HOUR_COLS_t1  = Array.from({ length: 24 }, (_, i) => `t${i + 1}`)
const HOUR_COLS_t01 = Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)
const LINE_COLORS = ['#3b82f6','#f59e0b','#22c55e','#ef4444','#a855f7','#06b6d4','#f97316','#ec4899','#84cc16','#8b5cf6','#14b8a6','#eab308']

function detectHours(row) {
  if (!row) return HOUR_COLS_t1
  if (row['t01'] !== undefined) return HOUR_COLS_t01
  return HOUR_COLS_t1
}

export default function ResourcesTab({ branch, model, selectedZone, selectedISO, isoToZonesMap }) {
  const df = model?.data_folder
  const vrePath  = df ? `epm/input/${df}/supply/pVREProfile.csv`  : null
  const fuelPath = df ? `epm/input/${df}/supply/pFuelPrice.csv`   : null

  const { data: vreRaw,  loading: vreLoad }  = useCSV(branch, vrePath)
  const { data: fuelRaw, loading: fuelLoad } = useCSV(branch, fuelPath)

  const [selSeason,   setSelSeason]   = useState('')
  const [selDay,      setSelDay]      = useState('')
  const [selTech,     setSelTech]     = useState('')
  const [hiddenFuels, setHiddenFuels] = useState(new Set())

  const zonesForISO = selectedISO && isoToZonesMap ? (isoToZonesMap[selectedISO] ?? []) : []

  function filterZone(rows, zoneCol) {
    if (selectedZone) return rows.filter(r => (r[zoneCol] ?? '') === selectedZone)
    if (zonesForISO.length) return rows.filter(r => zonesForISO.includes(r[zoneCol] ?? ''))
    return rows
  }

  // VRE profiles — "All" = all season×daytype combos on same chart
  const { vreSeasons, vreDayTypes, vreTechs, vreProfileData, vreCurveKeys } = useMemo(() => {
    if (!vreRaw?.length) return { vreSeasons: [], vreDayTypes: [], vreTechs: [], vreProfileData: [], vreCurveKeys: [] }

    const zoneCol    = ['zone', 'Zone', 'z'].find(k => vreRaw[0]?.[k] !== undefined) ?? 'zone'
    const seasonCol  = ['q', 'season', 'Season'].find(k => vreRaw[0]?.[k] !== undefined) ?? 'q'
    const daytypeCol = ['d', 'daytype', 'DayType'].find(k => vreRaw[0]?.[k] !== undefined) ?? 'd'
    const techCol    = ['tech', 'Tech'].find(k => vreRaw[0]?.[k] !== undefined) ?? 'tech'
    const hourCols   = detectHours(vreRaw[0])

    const rows     = filterZone(vreRaw, zoneCol)
    const seasons  = [...new Set(rows.map(r => r[seasonCol]))].filter(Boolean)
    const dayTypes = [...new Set(rows.map(r => r[daytypeCol]))].filter(Boolean)
    const techs    = [...new Set(rows.map(r => r[techCol]))].filter(Boolean)

    const s = selSeason || 'All'
    const d = selDay    || 'All'

    // Build curves: when "All" → each season×daytype×tech combo is a curve
    const seasonList  = s === 'All' ? seasons  : [s]
    const dayList     = d === 'All' ? dayTypes : [d]
    const techList    = selTech ? [selTech] : techs.slice(0, 4)  // limit curves

    const curveKeys = []
    const curveData = {}  // key → array of 24 values

    techList.forEach(tech => {
      seasonList.forEach(sq => {
        dayList.forEach(day => {
          const key = seasonList.length > 1 || dayList.length > 1
            ? `${tech} · ${sq}/${day}`
            : tech
          curveKeys.push(key)
          const filtered = rows.filter(r => r[techCol] === tech && r[seasonCol] === sq && r[daytypeCol] === day)
          curveData[key] = hourCols.map(h => filtered.length
            ? filtered.reduce((sum, r) => sum + (parseFloat(r[h]) || 0), 0) / filtered.length
            : 0
          )
        })
      })
    })

    const profileData = hourCols.map((_, i) => {
      const point = { hour: i + 1 }
      curveKeys.forEach(k => { point[k] = +(curveData[k][i] ?? 0).toFixed(4) })
      return point
    })

    return { vreSeasons: ['All', ...seasons], vreDayTypes: ['All', ...dayTypes], vreTechs: techs, vreProfileData: profileData, vreCurveKeys: curveKeys }
  }, [vreRaw, selectedZone, selectedISO, zonesForISO, selSeason, selDay, selTech])

  // Fuel prices — actual headers: country, fuel, year...
  const { fuelData, fuelSeriesKeys } = useMemo(() => {
    if (!fuelRaw?.length) return { fuelData: [], fuelSeriesKeys: [] }
    const keys = Object.keys(fuelRaw[0])
    const yrs  = keys.filter(k => /^\d{4}$/.test(k))

    // Support both 'country'/'fuel' named headers and positional fallback
    const countryKey = ['country', 'Country', 'zone', 'Zone', 'z'].find(k => fuelRaw[0]?.[k] !== undefined) ?? keys[0]
    const fuelKey    = ['fuel', 'Fuel', 'f'].find(k => fuelRaw[0]?.[k] !== undefined) ?? keys[1]

    const seriesMap = {}
    fuelRaw.forEach(r => {
      const country = r[countryKey] ?? ''
      const fuel    = r[fuelKey] ?? ''
      if (!fuel) return
      const label = country ? `${fuel} (${country})` : fuel
      if (!seriesMap[label]) seriesMap[label] = { label }
      yrs.forEach(yr => { seriesMap[label][yr] = parseFloat(r[yr]) || 0 })
    })

    const fuelData = yrs.map(yr => {
      const point = { year: parseInt(yr) }
      Object.values(seriesMap).forEach(s => { point[s.label] = s[yr] ?? 0 })
      return point
    })

    return { fuelData, fuelSeriesKeys: Object.keys(seriesMap) }
  }, [fuelRaw])

  const toggleFuel = key => setHiddenFuels(prev => {
    const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next
  })

  if (!df) return <div className="empty-msg">Model metadata not available</div>

  return (
    <div>
      {(selectedZone || selectedISO) && (
        <div className="zone-filter-note">Filtered to: <strong>{selectedZone ?? selectedISO}</strong></div>
      )}

      {/* VRE Profiles */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>VRE Capacity Factor Profiles</span>
        {vrePath && <a className="dl-btn" href={rawUrl(branch, vrePath)} download>↓ CSV</a>}
      </div>

      {vreLoad ? (
        <div className="loading-center" style={{ height: 80 }}>Loading…</div>
      ) : vreRaw?.length > 0 ? (
        <>
          <div className="filter-row">
            <span className="filter-label">Season</span>
            <select className="filter-select" value={selSeason || 'All'} onChange={e => setSelSeason(e.target.value)}>
              {vreSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="filter-label">Day type</span>
            <select className="filter-select" value={selDay || 'All'} onChange={e => setSelDay(e.target.value)}>
              {vreDayTypes.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="filter-label">Tech</span>
            <select className="filter-select" value={selTech} onChange={e => setSelTech(e.target.value)}>
              <option value="">All (first 4)</option>
              {vreTechs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="chart-card">
            <div className="chart-card-title">Capacity factor (p.u.) — {vreCurveKeys.length} curve{vreCurveKeys.length !== 1 ? 's' : ''}</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={vreProfileData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...CHART.grid} />
                <XAxis dataKey="hour" {...CHART.axis} />
                <YAxis {...CHART.axis} domain={[0, 1]} tickFormatter={v => v.toFixed(1)} />
                <Tooltip {...CHART.tooltip} formatter={(v, n) => [v.toFixed(3), n]} labelFormatter={l => `Hour ${l}`} />
                {vreCurveKeys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5}
                    dot={false} strokeOpacity={0.85} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            {vreCurveKeys.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {vreCurveKeys.map((k, i) => (
                  <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                    <span style={{ width: 14, height: 2, background: LINE_COLORS[i % LINE_COLORS.length], display: 'inline-block', borderRadius: 1 }} />
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-msg">No VRE profile data found</div>
      )}

      {/* Fuel Prices */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <span>Fuel Prices</span>
        {fuelPath && <a className="dl-btn" href={rawUrl(branch, fuelPath)} download>↓ CSV</a>}
      </div>

      {fuelLoad ? (
        <div className="loading-center" style={{ height: 80 }}>Loading…</div>
      ) : fuelData.length > 0 ? (
        <>
          {/* Toggleable legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {fuelSeriesKeys.map((k, i) => (
              <span key={k} className={`legend-item${hiddenFuels.has(k) ? ' off' : ''}`} onClick={() => toggleFuel(k)}>
                <span className="legend-dot-line" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {k}
              </span>
            ))}
          </div>
          <div className="chart-card">
            <div className="chart-card-title">Fuel price ($/GJ or model unit)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fuelData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...CHART.grid} />
                <XAxis dataKey="year" {...CHART.axis} />
                <YAxis {...CHART.axis} tickFormatter={v => v.toLocaleString()} />
                <Tooltip {...CHART.tooltip} />
                {fuelSeriesKeys.filter(k => !hiddenFuels.has(k)).map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={1.5} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="empty-msg">No fuel price data found</div>
      )}
    </div>
  )
}
