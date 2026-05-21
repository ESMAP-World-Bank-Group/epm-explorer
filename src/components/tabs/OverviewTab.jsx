import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { fuelColor } from '../../utils/colors'

function col(row, ...names) {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n]
  return null
}

const CHART = {
  grid:    { strokeDasharray: '3 3', stroke: 'rgba(128,140,180,0.2)' },
  tooltip: { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 } },
  axis:    { tick: { fill: 'var(--text-muted)', fontSize: 10 } },
}

const RE_FUELS = ['Solar', 'Wind', 'Water', 'Hydro', 'Geothermal', 'Biomass', 'Biomass2']

export default function OverviewTab({ branch, model, selectedZone, selectedISO, isoToZonesMap }) {
  const df = model?.data_folder
  const { data: genData, loading } = useCSV(branch, df ? `epm/input/${df}/supply/pGenDataInput.csv` : null)

  const zonesForISO = selectedISO && isoToZonesMap ? (isoToZonesMap[selectedISO] ?? []) : []

  const { byFuel, byZone, totalMW, rePct } = useMemo(() => {
    if (!genData?.length) return { byFuel: [], byZone: [], totalMW: 0, rePct: 0 }

    const filtered = genData.filter(r => {
      const status = Number(col(r, 'Status', 'status') ?? 1)
      if (status !== 1) return false  // existing only
      const cap = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
      if (!cap) return false
      const z = col(r, 'z', 'zone', 'Zone') ?? ''
      if (selectedZone)   return z === selectedZone
      if (zonesForISO.length) return zonesForISO.includes(z)
      return true
    })

    const fuelMap = {}, zoneMap = {}
    filtered.forEach(r => {
      const fuel = col(r, 'f', 'fuel', 'Fuel') ?? 'Unknown'
      const zone = col(r, 'z', 'zone', 'Zone') ?? 'Unknown'
      const cap  = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
      fuelMap[fuel] = (fuelMap[fuel] ?? 0) + cap
      zoneMap[zone] = (zoneMap[zone] ?? {})
      zoneMap[zone][fuel] = (zoneMap[zone][fuel] ?? 0) + cap
    })

    const byFuel = Object.entries(fuelMap)
      .map(([fuel, cap]) => ({ fuel, cap: Math.round(cap) }))
      .sort((a, b) => b.cap - a.cap)
    const total = byFuel.reduce((s, r) => s + r.cap, 0)
    const re = byFuel.filter(r => RE_FUELS.includes(r.fuel)).reduce((s, r) => s + r.cap, 0)

    const byZone = Object.entries(zoneMap).map(([zone, fuels]) => {
      const entry = { zone }
      let tot = 0
      Object.entries(fuels).forEach(([f, v]) => { entry[f] = Math.round(v); tot += v })
      entry._total = Math.round(tot)
      return entry
    }).sort((a, b) => b._total - a._total)

    return { byFuel, byZone, totalMW: Math.round(total), rePct: total > 0 ? Math.round((re / total) * 100) : 0 }
  }, [genData, selectedZone, selectedISO, zonesForISO])

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>

  const allFuels = [...new Set(byZone.flatMap(z => Object.keys(z).filter(k => k !== 'zone' && k !== '_total')))]

  return (
    <div>
      {(selectedZone || selectedISO) && (
        <div className="zone-filter-note">
          Filtered to: <strong>{selectedZone ?? selectedISO}</strong>
          {!selectedZone && zonesForISO.length > 1 && ` (${zonesForISO.length} zones)`}
        </div>
      )}

      <div className="meta-grid">
        <div className="meta-card"><div className="meta-label">Installed Capacity</div><div className="meta-value">{totalMW.toLocaleString()} MW</div></div>
        <div className="meta-card"><div className="meta-label">RE Share</div><div className="meta-value" style={{ color: 'var(--success)' }}>{rePct}%</div></div>
        <div className="meta-card"><div className="meta-label">Fuel Types</div><div className="meta-value">{byFuel.length}</div></div>
        <div className="meta-card"><div className="meta-label">Zones</div><div className="meta-value">{byZone.length}</div></div>
      </div>

      {byFuel.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <div className="chart-card" style={{ flex: '0 0 240px' }}>
            <div className="chart-card-title">Capacity Mix — existing (MW)</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byFuel} dataKey="cap" nameKey="fuel" innerRadius={50} outerRadius={78} paddingAngle={1}>
                  {byFuel.map((e, i) => <Cell key={i} fill={fuelColor(e.fuel)} />)}
                </Pie>
                <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v.toLocaleString()} MW`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-legend">
              {byFuel.slice(0, 7).map(({ fuel, cap }) => (
                <div key={fuel} className="donut-legend-item">
                  <span className="tech-dot" style={{ background: fuelColor(fuel) }} />
                  <span>{fuel}</span>
                  <span className="donut-legend-val">{cap.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {byZone.length > 1 && (
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="chart-card-title">By Zone (MW)</div>
              <ResponsiveContainer width="100%" height={200 + byZone.length * 6}>
                <BarChart data={byZone} layout="vertical" margin={{ left: 70, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid {...CHART.grid} horizontal={false} />
                  <XAxis type="number" {...CHART.axis} tickFormatter={v => v.toLocaleString()} />
                  <YAxis type="category" dataKey="zone" {...CHART.axis} width={68} />
                  <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v.toLocaleString()} MW`, n]} />
                  {allFuels.map(fuel => <Bar key={fuel} dataKey={fuel} stackId="a" fill={fuelColor(fuel)} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
