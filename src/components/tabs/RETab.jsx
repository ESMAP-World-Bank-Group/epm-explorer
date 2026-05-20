import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'
import { techColor } from '../../utils/colors'

const SEASON_LABELS = { Q1: 'Q1 (Winter)', Q2: 'Q2 (Spring)', Q3: 'Q3 (Summer)', Q4: 'Q4 (Autumn)' }

const CHART_STYLE = {
  cartesianGrid: { strokeDasharray: '3 3', stroke: '#2a2f47' },
  tooltip: { contentStyle: { background: '#161924', border: '1px solid #2a2f47', fontSize: 12 } },
  xAxis: { tick: { fill: '#7c879f', fontSize: 11 } },
  yAxis: {
    tick: { fill: '#7c879f', fontSize: 11 },
    domain: [0, 1],
    tickFormatter: v => `${(v * 100).toFixed(0)}%`,
  },
}

// Detect hour column names: t1..t24 or t01..t24 or h1..h24
function detectHourCols(row) {
  if (row == null) return []
  if (row['t1']  !== undefined) return Array.from({ length: 24 }, (_, i) => `t${i + 1}`)
  if (row['t01'] !== undefined) return Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)
  if (row['h1']  !== undefined) return Array.from({ length: 24 }, (_, i) => `h${i + 1}`)
  return []
}

// Detect season and day-type column names
function detectDimCols(row) {
  if (row == null) return { seasonCol: null, daytypeCol: null }
  const seasonCol  = ['season', 'q', 'Season', 'Quarter'].find(k => row[k] !== undefined) ?? null
  const daytypeCol = ['daytype', 'd', 'DayType', 'Daytype', 'day_type'].find(k => row[k] !== undefined) ?? null
  return { seasonCol, daytypeCol }
}

const RE_TECHS = ['OnshoreWind', 'OffshoreWind', 'PV', 'CSP', 'CSPPlant', 'ROR', 'Wind', 'Solar']

export default function RETab({ branch, model }) {
  const df = model?.data_folder
  const path = df ? `epm/input/${df}/supply/pVREProfile.csv` : null
  const { data, loading, error } = useCSV(branch, path)

  const { seasons, dayTypes, techs, zones, hourCols, seasonCol, daytypeCol } = useMemo(() => {
    if (!data || !data.length) return { seasons: [], dayTypes: [], techs: [], zones: [], hourCols: [], seasonCol: null, daytypeCol: null }

    const first = data[0]
    const { seasonCol, daytypeCol } = detectDimCols(first)
    const hourCols = detectHourCols(first)
    const techCol = 'tech'  // always 'tech' in VRE profile

    return {
      seasons:    [...new Set(data.map(r => r[seasonCol]  ?? ''))].filter(Boolean),
      dayTypes:   [...new Set(data.map(r => r[daytypeCol] ?? ''))].filter(Boolean),
      techs:      [...new Set(data.map(r => r[techCol]    ?? ''))].filter(Boolean),
      zones:      [...new Set(data.map(r => r.zone ?? r.Zone ?? r.z ?? ''))].filter(Boolean),
      hourCols,
      seasonCol,
      daytypeCol,
    }
  }, [data])

  const [selSeason,  setSelSeason]  = useState('')
  const [selDay,     setSelDay]     = useState('')
  const [selZone,    setSelZone]    = useState('')

  const season  = selSeason  || seasons[0]  || ''
  const dayType = selDay     || dayTypes[0] || ''
  const zone    = selZone    || zones[0]    || ''

  const profileData = useMemo(() => {
    if (!data || !season || !dayType || !hourCols.length) return []
    const filtered = data.filter(r =>
      r[seasonCol]  === season &&
      r[daytypeCol] === dayType &&
      (!zone || (r.zone ?? r.Zone ?? '') === zone)
    )
    return hourCols.map((h, i) => {
      const point = { hour: i + 1 }
      techs.forEach(tech => {
        const rows = filtered.filter(r => r.tech === tech)
        if (rows.length) {
          point[tech] = rows.reduce((s, r) => s + (parseFloat(r[h]) || 0), 0) / rows.length
        }
      })
      return point
    })
  }, [data, season, dayType, zone, techs, hourCols, seasonCol, daytypeCol])

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>
  if (error) return <div className="error-msg">Could not load pVREProfile.csv</div>
  if (!data || !data.length) return <div className="empty-msg">No VRE profile data found</div>

  return (
    <div>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>VRE Capacity Factors</span>
        {path && <a className="dl-btn" href={rawUrl(branch, path)} download>↓ CSV</a>}
      </div>

      <div className="filter-row">
        {zones.length > 1 && (
          <>
            <span className="filter-label">Zone</span>
            <select className="filter-select" value={zone} onChange={e => setSelZone(e.target.value)}>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </>
        )}
        <span className="filter-label">Season</span>
        <select className="filter-select" value={season} onChange={e => setSelSeason(e.target.value)}>
          {seasons.map(s => <option key={s} value={s}>{SEASON_LABELS[s] ?? s}</option>)}
        </select>
        <span className="filter-label">Day type</span>
        <select className="filter-select" value={dayType} onChange={e => setSelDay(e.target.value)}>
          {dayTypes.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {profileData.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">
            Hourly capacity factor — {SEASON_LABELS[season] ?? season}, {dayType}
            {zones.length > 1 && ` · ${zone}`}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={profileData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART_STYLE.cartesianGrid} />
              <XAxis dataKey="hour" {...CHART_STYLE.xAxis}
                label={{ value: 'Hour', position: 'insideBottomRight', offset: -4, fill: '#7c879f', fontSize: 11 }} />
              <YAxis {...CHART_STYLE.yAxis} />
              <Tooltip
                {...CHART_STYLE.tooltip}
                formatter={(v, name) => [`${(v * 100).toFixed(1)}%`, name]}
                labelFormatter={l => `Hour ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {techs.map(tech => (
                <Line
                  key={tech}
                  type="monotone"
                  dataKey={tech}
                  stroke={techColor(tech)}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Average CF by season table */}
      <div className="section-title">Average Capacity Factor by Season</div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {zones.length > 1 && <th>Zone</th>}
              <th>Technology</th>
              {seasons.map(s => <th key={s} className="num">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {zones.flatMap(z =>
              techs.map(tech => (
                <tr key={`${z}-${tech}`}>
                  {zones.length > 1 && <td>{z}</td>}
                  <td>
                    <span className="tech-dot" style={{ background: techColor(tech) }} />
                    {tech}
                  </td>
                  {seasons.map(s => {
                    const rows = (data ?? []).filter(r =>
                      (r.zone ?? r.Zone ?? r.z ?? '') === z &&
                      r.tech === tech &&
                      r[seasonCol] === s
                    )
                    if (!rows.length) return <td key={s} className="num">—</td>
                    const avg = rows.reduce((sum, r) => {
                      const vals = hourCols.map(h => parseFloat(r[h]) || 0)
                      return sum + vals.reduce((a, b) => a + b, 0) / vals.length
                    }, 0) / rows.length
                    return <td key={s} className="num">{(avg * 100).toFixed(1)}%</td>
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
