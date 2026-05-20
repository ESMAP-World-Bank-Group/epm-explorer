import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { techColor } from '../../utils/colors'
import { rawUrl } from '../../api/github'

const CHART_STYLE = {
  cartesianGrid: { strokeDasharray: '3 3', stroke: '#2a2f47' },
  tooltip: { contentStyle: { background: '#161924', border: '1px solid #2a2f47', fontSize: 12 } },
  xAxis: { tick: { fill: '#7c879f', fontSize: 11 }, interval: 0, angle: -35, textAnchor: 'end', height: 60 },
  yAxis: { tick: { fill: '#7c879f', fontSize: 11 }, width: 70 },
}

function col(row, ...names) {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n]
  return null
}

export default function CapacityTab({ branch, model }) {
  const df = model?.data_folder
  const path = df ? `epm/input/${df}/supply/pGenDataInput.csv` : null
  const { data, loading, error } = useCSV(branch, path)

  const { byTech, byZone } = useMemo(() => {
    if (!data || !data.length) return { byTech: [], byZone: [] }

    const techMap = {}
    const zoneMap = {}
    data.forEach(r => {
      const tech = col(r, 'tech', 'Tech', 'technology') ?? 'Unknown'
      const zone = col(r, 'z', 'zone', 'Zone') ?? 'Unknown'
      const cap  = parseFloat(col(r, 'Capacity', 'capacity', 'cap', 'Cap')) || 0
      if (!cap) return

      techMap[tech] = (techMap[tech] ?? 0) + cap
      if (!zoneMap[zone]) zoneMap[zone] = {}
      zoneMap[zone][tech] = (zoneMap[zone][tech] ?? 0) + cap
    })

    const byTech = Object.entries(techMap)
      .map(([tech, cap]) => ({ tech, cap: Math.round(cap) }))
      .sort((a, b) => b.cap - a.cap)

    const byZone = Object.entries(zoneMap).map(([zone, techs]) => ({
      zone,
      total: Math.round(Object.values(techs).reduce((s, v) => s + v, 0)),
    })).sort((a, b) => b.total - a.total)

    return { byTech, byZone }
  }, [data])

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>
  if (error) return <div className="error-msg">Could not load pGenDataInput.csv</div>
  if (!data || !data.length) return <div className="empty-msg">No capacity data found</div>

  const totalMW = byTech.reduce((s, r) => s + r.cap, 0)

  return (
    <div>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Installed Capacity — {totalMW.toLocaleString()} MW total</span>
        {path && <a className="dl-btn" href={rawUrl(branch, path)} download>↓ CSV</a>}
      </div>

      {byTech.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">By Technology (MW)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byTech} margin={{ top: 4, right: 16, bottom: 40, left: 0 }}>
              <CartesianGrid {...CHART_STYLE.cartesianGrid} />
              <XAxis dataKey="tech" {...CHART_STYLE.xAxis} />
              <YAxis {...CHART_STYLE.yAxis} tickFormatter={v => v.toLocaleString()} />
              <Tooltip
                {...CHART_STYLE.tooltip}
                formatter={v => [`${v.toLocaleString()} MW`, 'Capacity']}
                labelFormatter={l => l}
              />
              <Bar dataKey="cap" name="Capacity" radius={[3, 3, 0, 0]}>
                {byTech.map((entry, i) => (
                  <Cell key={i} fill={techColor(entry.tech)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="section-title">By Technology</div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Technology</th>
              <th className="num">Capacity (MW)</th>
              <th className="num">Share</th>
            </tr>
          </thead>
          <tbody>
            {byTech.map(({ tech, cap }) => (
              <tr key={tech}>
                <td>
                  <span className="tech-dot" style={{ background: techColor(tech) }} />
                  {tech}
                </td>
                <td className="num">{cap.toLocaleString()}</td>
                <td className="num">{totalMW > 0 ? `${((cap / totalMW) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {byZone.length > 1 && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>By Zone</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Zone</th><th className="num">Total (MW)</th></tr>
              </thead>
              <tbody>
                {byZone.map(({ zone, total }) => (
                  <tr key={zone}><td>{zone}</td><td className="num">{total.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
