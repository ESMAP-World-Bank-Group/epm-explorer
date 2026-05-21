import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'
import { techColor, fuelColor } from '../../utils/colors'

const CHART = {
  grid: { strokeDasharray: '3 3', stroke: '#2a2f47' },
  tooltip: { contentStyle: { background: '#161924', border: '1px solid #2a2f47', fontSize: 12 } },
  axis: { tick: { fill: '#7c879f', fontSize: 11 } },
}

const HOUR_COLS_t1  = Array.from({ length: 24 }, (_, i) => `t${i + 1}`)
const HOUR_COLS_t01 = Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)

function detectHours(row) {
  if (!row) return HOUR_COLS_t1
  if (row['t01'] !== undefined) return HOUR_COLS_t01
  return HOUR_COLS_t1
}

const FUEL_LINE_COLORS = [
  '#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#8b5cf6',
]

export default function ResourcesTab({ branch, model, selectedZone }) {
  const df = model?.data_folder
  const vrePath  = df ? `epm/input/${df}/supply/pVREProfile.csv`   : null
  const fuelPath = df ? `epm/input/${df}/supply/pFuelPrice.csv`    : null

  const { data: vreRaw,  loading: vreLoad }  = useCSV(branch, vrePath)
  const { data: fuelRaw, loading: fuelLoad } = useCSV(branch, fuelPath)

  const [selSeason, setSelSeason] = useState('')
  const [selDay,    setSelDay]    = useState('')
  const [selTech,   setSelTech]   = useState('')

  // VRE profiles
  const { vreSeasons, vreDayTypes, vreTechs, vreProfileData } = useMemo(() => {
    if (!vreRaw?.length) return { vreSeasons: [], vreDayTypes: [], vreTechs: [], vreProfileData: [] }

    const rows = selectedZone
      ? vreRaw.filter(r => (r.zone ?? r.Zone ?? r.z ?? '') === selectedZone)
      : vreRaw

    const seasonCol  = ['q', 'season', 'Season'].find(k => rows[0]?.[k] !== undefined) ?? 'q'
    const daytypeCol = ['d', 'daytype', 'DayType'].find(k => rows[0]?.[k] !== undefined) ?? 'd'
    const techCol    = ['tech', 'Tech'].find(k => rows[0]?.[k] !== undefined) ?? 'tech'
    const hourCols   = detectHours(rows[0])

    const seasons  = [...new Set(rows.map(r => r[seasonCol]))].filter(Boolean)
    const dayTypes = [...new Set(rows.map(r => r[daytypeCol]))].filter(Boolean)
    const techs    = [...new Set(rows.map(r => r[techCol]))].filter(Boolean)

    const s = selSeason || seasons[0] || ''
    const d = selDay    || dayTypes[0] || ''

    const filtered = rows.filter(r => r[seasonCol] === s && r[daytypeCol] === d)
    const techRows = selTech
      ? filtered.filter(r => r[techCol] === selTech)
      : filtered

    const techGroups = {}
    techRows.forEach(r => {
      const t = r[techCol] ?? 'Unknown'
      if (!techGroups[t]) techGroups[t] = []
      techGroups[t].push(r)
    })

    const profileData = hourCols.map((h, i) => {
      const point = { hour: i + 1 }
      Object.entries(techGroups).forEach(([t, tRows]) => {
        point[t] = tRows.reduce((sum, r) => sum + (parseFloat(r[h]) || 0), 0) / tRows.length
      })
      return point
    })

    return { vreSeasons: seasons, vreDayTypes: dayTypes, vreTechs: techs, vreProfileData: profileData }
  }, [vreRaw, selectedZone, selSeason, selDay, selTech])

  // Fuel prices — pFuelPrice.csv has no headers for first two cols (zone, fuel)
  const { fuelData, fuelNames, yearCols } = useMemo(() => {
    if (!fuelRaw?.length) return { fuelData: [], fuelNames: [], yearCols: [] }

    // First row keys: get column names
    const keys = Object.keys(fuelRaw[0])
    // year columns are numeric 4-digit keys
    const yrs = keys.filter(k => /^\d{4}$/.test(k))
    // first two positional columns (may be blank-named like '' or '_1')
    const col0 = keys[0]  // zone or blank
    const col1 = keys[1]  // fuel or blank

    // Build: zone_fuel label → [{year, price}]
    const seriesMap = {}
    fuelRaw.forEach(r => {
      const zone  = r[col0] ?? ''
      const fuel  = r[col1] ?? ''
      if (!fuel) return
      const label = zone ? `${zone}/${fuel}` : fuel
      if (!seriesMap[label]) seriesMap[label] = { label, zone, fuel }
      yrs.forEach(yr => { seriesMap[label][yr] = parseFloat(r[yr]) || 0 })
    })

    const fuelData = yrs.map(yr => {
      const point = { year: parseInt(yr) }
      Object.values(seriesMap).forEach(s => { point[s.label] = s[yr] ?? 0 })
      return point
    })

    return { fuelData, fuelNames: Object.keys(seriesMap), yearCols: yrs }
  }, [fuelRaw])

  const displayTechs = selTech ? [selTech] : vreTechs.slice(0, 6)

  if (!df) return <div className="empty-msg">Model metadata not available</div>

  return (
    <div>
      {selectedZone && <div className="zone-filter-note">Filtered to: <strong>{selectedZone}</strong></div>}

      {/* VRE Profiles */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>VRE Capacity Factor Profiles</span>
        {vrePath && <a className="dl-btn" href={rawUrl(branch, vrePath)} download>↓ CSV</a>}
      </div>

      {!vreLoad && vreRaw?.length > 0 ? (
        <>
          <div className="filter-row">
            <span className="filter-label">Season</span>
            <select className="filter-select" value={selSeason || vreSeasons[0] || ''} onChange={e => setSelSeason(e.target.value)}>
              {vreSeasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="filter-label">Day type</span>
            <select className="filter-select" value={selDay || vreDayTypes[0] || ''} onChange={e => setSelDay(e.target.value)}>
              {vreDayTypes.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="filter-label">Tech</span>
            <select className="filter-select" value={selTech} onChange={e => setSelTech(e.target.value)}>
              <option value="">All</option>
              {vreTechs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="chart-card">
            <div className="chart-card-title">Capacity factor (p.u.) by hour</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={vreProfileData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...CHART.grid} />
                <XAxis dataKey="hour" {...CHART.axis} />
                <YAxis {...CHART.axis} domain={[0, 1]} tickFormatter={v => v.toFixed(1)} />
                <Tooltip {...CHART.tooltip} formatter={(v, n) => [v.toFixed(3), n]} labelFormatter={l => `Hour ${l}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {displayTechs.map((t, i) => (
                  <Line key={t} type="monotone" dataKey={t} stroke={techColor(t)} strokeWidth={2} dot={false} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : !vreLoad ? (
        <div className="empty-msg">No VRE profile data found</div>
      ) : (
        <div className="loading-center" style={{ height: 100 }}>Loading…</div>
      )}

      {/* Fuel Prices */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <span>Fuel Prices</span>
        {fuelPath && <a className="dl-btn" href={rawUrl(branch, fuelPath)} download>↓ CSV</a>}
      </div>

      {!fuelLoad && fuelData.length > 0 ? (
        <div className="chart-card">
          <div className="chart-card-title">Fuel price ($/GJ or model unit) over time</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={fuelData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART.grid} />
              <XAxis dataKey="year" {...CHART.axis} />
              <YAxis {...CHART.axis} tickFormatter={v => v.toLocaleString()} />
              <Tooltip {...CHART.tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {fuelNames.slice(0, 10).map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={FUEL_LINE_COLORS[i % FUEL_LINE_COLORS.length]} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : !fuelLoad ? (
        <div className="empty-msg">No fuel price data found</div>
      ) : (
        <div className="loading-center" style={{ height: 100 }}>Loading…</div>
      )}
    </div>
  )
}
