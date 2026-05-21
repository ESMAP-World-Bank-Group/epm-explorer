import { useMemo, useState } from 'react'
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'

const CHART = {
  grid: { strokeDasharray: '3 3', stroke: '#2a2f47' },
  tooltip: { contentStyle: { background: '#161924', border: '1px solid #2a2f47', fontSize: 12 } },
  axis: { tick: { fill: '#7c879f', fontSize: 11 } },
}
const HOUR_COLS_t1  = Array.from({ length: 24 }, (_, i) => `t${i + 1}`)
const HOUR_COLS_t01 = Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)

function detectHours(row) {
  if (!row) return []
  if (row['t1']  !== undefined) return HOUR_COLS_t1
  if (row['t01'] !== undefined) return HOUR_COLS_t01
  return HOUR_COLS_t1
}

export default function LoadTab({ branch, model, selectedZone }) {
  const df = model?.data_folder
  const fcastPath   = df ? `epm/input/${df}/load/pDemandForecast.csv`  : null
  const profilePath = df ? `epm/input/${df}/load/pDemandProfile.csv`   : null

  const { data: fcast,   loading: fLoad } = useCSV(branch, fcastPath)
  const { data: profile, loading: pLoad } = useCSV(branch, profilePath)

  const [selSeason, setSelSeason] = useState('')
  const [selDay,    setSelDay]    = useState('')

  const { trendData, years } = useMemo(() => {
    if (!fcast?.length) return { trendData: [], years: [] }
    const yearCols = Object.keys(fcast[0]).filter(k => /^\d{4}$/.test(k))
    const rows = selectedZone ? fcast.filter(r => (r.z ?? r.zone ?? '') === selectedZone) : fcast

    const sum = (type, yr) => rows
      .filter(r => String(r.type ?? r.Type ?? '').toLowerCase() === type)
      .reduce((s, r) => s + (parseFloat(r[yr]) || 0), 0)

    return {
      trendData: yearCols.map(yr => ({ year: parseInt(yr), peak: sum('peak', yr), energy: sum('energy', yr) })),
      years: yearCols,
    }
  }, [fcast, selectedZone])

  const { seasons, dayTypes, profileData } = useMemo(() => {
    if (!profile?.length) return { seasons: [], dayTypes: [], profileData: [] }
    const rows = selectedZone ? profile.filter(r => (r.z ?? r.zone ?? '') === selectedZone) : profile
    const seasonCol  = ['q', 'season', 'Season'].find(k => rows[0]?.[k] !== undefined) ?? 'q'
    const daytypeCol = ['d', 'daytype', 'DayType'].find(k => rows[0]?.[k] !== undefined) ?? 'd'
    const hourCols   = detectHours(rows[0])

    const seasons  = [...new Set(rows.map(r => r[seasonCol]))].filter(Boolean)
    const dayTypes = [...new Set(rows.map(r => r[daytypeCol]))].filter(Boolean)

    const s = selSeason || seasons[0] || ''
    const d = selDay    || dayTypes[0] || ''

    const filtered = rows.filter(r => r[seasonCol] === s && r[daytypeCol] === d)
    const profileData = hourCols.map((h, i) => ({
      hour: i + 1,
      load: filtered.length
        ? filtered.reduce((sum, r) => sum + (parseFloat(r[h]) || 0), 0) / filtered.length
        : 0,
    }))
    return { seasons, dayTypes, profileData }
  }, [profile, selectedZone, selSeason, selDay])

  if (!df) return <div className="empty-msg">Model metadata not available</div>

  return (
    <div>
      {selectedZone && <div className="zone-filter-note">Filtered to: <strong>{selectedZone}</strong></div>}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Demand Forecast</span>
        {fcastPath && <a className="dl-btn" href={rawUrl(branch, fcastPath)} download>↓ CSV</a>}
      </div>

      {!fLoad && trendData.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">Peak (MW) and Energy (GWh) — dual axis</div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={trendData} margin={{ top: 4, right: 60, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART.grid} />
              <XAxis dataKey="year" {...CHART.axis} />
              <YAxis yAxisId="left"  {...CHART.axis} tickFormatter={v => v.toLocaleString()} label={{ value: 'MW',  angle: -90, position: 'insideLeft',  fill: '#7c879f', fontSize: 11, dy: 30 }} />
              <YAxis yAxisId="right" orientation="right" {...CHART.axis} tickFormatter={v => v.toLocaleString()} label={{ value: 'GWh', angle: 90,  position: 'insideRight', fill: '#7c879f', fontSize: 11, dy: -20 }} />
              <Tooltip {...CHART.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left"  type="monotone" dataKey="peak"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Peak (MW)"   />
              <Line yAxisId="right" type="monotone" dataKey="energy" stroke="#f59e0b" strokeWidth={2} dot={false} name="Energy (GWh)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!pLoad && profile?.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div className="chart-card">
            <div className="chart-card-title">Normalised load profile (p.u.)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={profileData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...CHART.grid} />
                <XAxis dataKey="hour" {...CHART.axis} />
                <YAxis {...CHART.axis} domain={[0, 1]} tickFormatter={v => v.toFixed(1)} />
                <Tooltip {...CHART.tooltip} formatter={v => [v.toFixed(3), 'Load (p.u.)']} labelFormatter={l => `Hour ${l}`} />
                <Line type="monotone" dataKey="load" stroke="#60a5fa" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
