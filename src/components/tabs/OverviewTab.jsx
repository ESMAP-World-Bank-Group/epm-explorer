import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { techColor } from '../../utils/colors'

function col(row, ...names) {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n]
  return null
}

const CHART = {
  grid: { strokeDasharray: '3 3', stroke: '#2a2f47' },
  tooltip: { contentStyle: { background: '#161924', border: '1px solid #2a2f47', fontSize: 12 } },
  axis: { tick: { fill: '#7c879f', fontSize: 11 } },
}

export default function OverviewTab({ branch, model, selectedZone }) {
  const df = model?.data_folder
  const { data: genData, loading } = useCSV(branch, df ? `epm/input/${df}/supply/pGenDataInput.csv` : null)

  const { byTech, byZone, totalMW, rePct } = useMemo(() => {
    if (!genData?.length) return { byTech: [], byZone: [], totalMW: 0, rePct: 0 }
    const RE_TECHS = ['OnshoreWind', 'OffshoreWind', 'PV', 'CSP', 'CSPPlant', 'ROR', 'ReservoirHydro', 'Geothermal']

    const filtered = selectedZone
      ? genData.filter(r => col(r, 'z', 'zone', 'Zone') === selectedZone)
      : genData

    const techMap = {}, zoneMap = {}
    filtered.forEach(r => {
      const status = Number(col(r, 'Status', 'status') ?? 1)
      if (status > 2) return  // skip candidates
      const tech = col(r, 'tech', 'Tech') ?? 'Unknown'
      const zone = col(r, 'z', 'zone', 'Zone') ?? 'Unknown'
      const cap  = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
      if (!cap) return
      techMap[tech] = (techMap[tech] ?? 0) + cap
      zoneMap[zone] = (zoneMap[zone] ?? {})
      zoneMap[zone][tech] = (zoneMap[zone][tech] ?? 0) + cap
    })

    const byTech = Object.entries(techMap)
      .map(([tech, cap]) => ({ tech, cap: Math.round(cap) }))
      .sort((a, b) => b.cap - a.cap)
    const total = byTech.reduce((s, r) => s + r.cap, 0)
    const re = byTech.filter(r => RE_TECHS.includes(r.tech)).reduce((s, r) => s + r.cap, 0)

    const byZone = Object.entries(zoneMap).map(([zone, techs]) => {
      const entry = { zone }
      let tot = 0
      Object.entries(techs).forEach(([t, v]) => { entry[t] = Math.round(v); tot += v })
      entry._total = Math.round(tot)
      return entry
    }).sort((a, b) => b._total - a._total)

    return { byTech, byZone, totalMW: Math.round(total), rePct: total > 0 ? Math.round((re / total) * 100) : 0 }
  }, [genData, selectedZone])

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>

  const allTechs = [...new Set(byZone.flatMap(z => Object.keys(z).filter(k => k !== 'zone' && k !== '_total')))]

  return (
    <div>
      {selectedZone && <div className="zone-filter-note">Filtered to: <strong>{selectedZone}</strong></div>}

      <div className="meta-grid">
        <div className="meta-card"><div className="meta-label">Total Capacity</div><div className="meta-value">{totalMW.toLocaleString()} MW</div></div>
        <div className="meta-card"><div className="meta-label">RE Share</div><div className="meta-value" style={{ color: '#22c55e' }}>{rePct}%</div></div>
        <div className="meta-card"><div className="meta-label">Technologies</div><div className="meta-value">{byTech.length}</div></div>
        <div className="meta-card"><div className="meta-label">Zones</div><div className="meta-value">{byZone.length}</div></div>
      </div>

      {byTech.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="chart-card" style={{ flex: '0 0 260px' }}>
            <div className="chart-card-title">Capacity Mix (MW)</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byTech} dataKey="cap" nameKey="tech" innerRadius={55} outerRadius={85} paddingAngle={1}>
                  {byTech.map((entry, i) => <Cell key={i} fill={techColor(entry.tech)} />)}
                </Pie>
                <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v.toLocaleString()} MW`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-legend">
              {byTech.slice(0, 6).map(({ tech, cap }) => (
                <div key={tech} className="donut-legend-item">
                  <span style={{ background: techColor(tech) }} className="tech-dot" />
                  <span>{tech}</span>
                  <span className="donut-legend-val">{cap.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {byZone.length > 1 && (
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="chart-card-title">By Zone (MW)</div>
              <ResponsiveContainer width="100%" height={220 + byZone.length * 8}>
                <BarChart data={byZone} layout="vertical" margin={{ left: 60, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid {...CHART.grid} horizontal={false} />
                  <XAxis type="number" {...CHART.axis} tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="zone" {...CHART.axis} width={60} />
                  <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v.toLocaleString()} MW`, n]} />
                  {allTechs.map(tech => (
                    <Bar key={tech} dataKey={tech} stackId="a" fill={techColor(tech)} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
