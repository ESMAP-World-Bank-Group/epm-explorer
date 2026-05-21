import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'
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
const STATUS_LABELS = { 1: 'Existing', 2: 'Committed', 3: 'Candidate' }
const STATUS_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#a855f7' }
const ALL_STATUS = [1, 2, 3]

export default function SupplyTab({ branch, model, selectedZone, selectedISO, isoToZonesMap }) {
  const df = model?.data_folder
  const path = df ? `epm/input/${df}/supply/pGenDataInput.csv` : null
  const { data: genData, loading } = useCSV(branch, path)

  const [statusFilter, setStatusFilter] = useState([1, 2])
  const [modalRow, setModalRow] = useState(null)
  const [sortCol, setSortCol] = useState('cap')
  const [sortAsc, setSortAsc] = useState(false)

  const zonesForISO = selectedISO && isoToZonesMap ? (isoToZonesMap[selectedISO] ?? []) : []

  function inScope(r) {
    const z = col(r, 'z', 'zone', 'Zone') ?? ''
    if (selectedZone) return z === selectedZone
    if (zonesForISO.length) return zonesForISO.includes(z)
    return true
  }

  const toggleStatus = s => setStatusFilter(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  )

  // Segmented horizontal bars: existing & committed totals by fuel
  const { existingByFuel, committedByFuel, candidateByFuel } = useMemo(() => {
    if (!genData?.length) return { existingByFuel: [], committedByFuel: [], candidateByFuel: [] }
    const maps = { 1: {}, 2: {}, 3: {} }
    genData.forEach(r => {
      if (!inScope(r)) return
      const status = Number(col(r, 'Status', 'status') ?? 1)
      const fuel = col(r, 'f', 'fuel', 'Fuel') ?? 'Unknown'
      const cap  = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
      if (!cap || ![1,2,3].includes(status)) return
      maps[status][fuel] = (maps[status][fuel] ?? 0) + cap
    })
    const make = m => Object.entries(m).map(([fuel, cap]) => ({ fuel, cap: Math.round(cap) })).sort((a,b) => b.cap - a.cap)
    return { existingByFuel: make(maps[1]), committedByFuel: make(maps[2]), candidateByFuel: make(maps[3]) }
  }, [genData, selectedZone, selectedISO, zonesForISO])

  // Vertical bar chart: one bar per tech, segmented by status
  const { techStatusData, allTechs } = useMemo(() => {
    if (!genData?.length) return { techStatusData: [], allTechs: [] }
    const map = {}
    genData.forEach(r => {
      if (!inScope(r)) return
      const status = Number(col(r, 'Status', 'status') ?? 1)
      if (!statusFilter.includes(status)) return
      const tech = col(r, 'tech', 'Tech') ?? 'Unknown'
      const cap  = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
      if (!cap) return
      if (!map[tech]) map[tech] = { tech, existing: 0, committed: 0, candidate: 0 }
      if (status === 1) map[tech].existing  += cap
      if (status === 2) map[tech].committed += cap
      if (status === 3) map[tech].candidate += cap
    })
    const data = Object.values(map)
      .map(r => ({ ...r, existing: Math.round(r.existing), committed: Math.round(r.committed), candidate: Math.round(r.candidate) }))
      .sort((a, b) => (b.existing + b.committed + b.candidate) - (a.existing + a.committed + a.candidate))
    return { techStatusData: data, allTechs: data.map(r => r.tech) }
  }, [genData, selectedZone, selectedISO, zonesForISO, statusFilter])

  // Generator list
  const genRows = useMemo(() => {
    if (!genData?.length) return []
    return genData
      .filter(r => {
        if (!inScope(r)) return false
        const status = Number(col(r, 'Status', 'status') ?? 1)
        const cap = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
        return statusFilter.includes(status) && cap > 0
      })
      .map(r => ({
        g:      col(r, 'g', 'plant', 'unit') ?? '—',
        zone:   col(r, 'z', 'zone', 'Zone') ?? '—',
        tech:   col(r, 'tech', 'Tech') ?? '—',
        fuel:   col(r, 'f', 'fuel', 'Fuel') ?? '—',
        status: Number(col(r, 'Status', 'status') ?? 1),
        cap:    parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0,
        stYr:   col(r, 'StYr', 'styr') ?? '—',
        retrYr: col(r, 'RetrYr', 'retyr') ?? '—',
        _raw: r,
      }))
  }, [genData, selectedZone, selectedISO, zonesForISO, statusFilter])

  const sorted = useMemo(() => [...genRows].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sortAsc ? cmp : -cmp
  }), [genRows, sortCol, sortAsc])

  const handleSort = c => { if (sortCol === c) setSortAsc(a => !a); else { setSortCol(c); setSortAsc(false) } }

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>

  const totalMW = genRows.reduce((s, r) => s + r.cap, 0)

  // Build two-bar summary (existing | committed)
  const allFuels = [...new Set([...existingByFuel.map(r=>r.fuel), ...committedByFuel.map(r=>r.fuel)])]
  const summaryRow = { label: '' }
  allFuels.forEach(f => {
    const ex = existingByFuel.find(r=>r.fuel===f)?.cap ?? 0
    const cm = committedByFuel.find(r=>r.fuel===f)?.cap ?? 0
    if (ex) summaryRow[`ex_${f}`] = ex
    if (cm) summaryRow[`cm_${f}`] = cm
  })

  return (
    <div>
      {(selectedZone || selectedISO) && (
        <div className="zone-filter-note">Filtered to: <strong>{selectedZone ?? selectedISO}</strong></div>
      )}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Generation Portfolio — {totalMW.toLocaleString()} MW</span>
        {path && <a className="dl-btn" href={rawUrl(branch, path)} download>↓ CSV</a>}
      </div>

      {/* Status toggle */}
      <div className="filter-row" style={{ marginBottom: 14 }}>
        <span className="filter-label">Show:</span>
        {ALL_STATUS.map(s => (
          <button key={s} className={`status-chip${statusFilter.includes(s) ? ' active' : ''}`}
            style={{ '--chip-color': STATUS_COLORS[s] }} onClick={() => toggleStatus(s)}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Two segmented horizontal bars: Existing & Committed */}
      {(existingByFuel.length > 0 || committedByFuel.length > 0) && (
        <div className="chart-card" style={{ marginBottom: 14 }}>
          <div className="chart-card-title">Installed capacity by fuel (MW)</div>
          {[
            { label: 'Existing',   data: existingByFuel,   show: statusFilter.includes(1) },
            { label: 'Committed',  data: committedByFuel,  show: statusFilter.includes(2) },
            { label: 'Candidate',  data: candidateByFuel,  show: statusFilter.includes(3) },
          ].filter(d => d.show && d.data.length > 0).map(({ label, data }) => {
            const total = data.reduce((s, r) => s + r.cap, 0)
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {label} — {total.toLocaleString()} MW
                </div>
                <div style={{ display: 'flex', height: 22, borderRadius: 3, overflow: 'hidden' }}>
                  {data.map(({ fuel, cap }) => (
                    <div key={fuel} title={`${fuel}: ${cap.toLocaleString()} MW`}
                      style={{ width: `${(cap / total) * 100}%`, background: fuelColor(fuel), minWidth: 1 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {data.slice(0, 6).map(({ fuel, cap }) => (
                    <span key={fuel} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: fuelColor(fuel), display: 'inline-block' }} />
                      {fuel} {cap.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Vertical bar chart: by tech, segmented by status */}
      {techStatusData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 14 }}>
          <div className="chart-card-title">Capacity by technology and status (MW)</div>
          <ResponsiveContainer width="100%" height={Math.max(200, techStatusData.length * 28 + 40)}>
            <BarChart data={techStatusData} layout="vertical" margin={{ left: 80, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid {...CHART.grid} horizontal={false} />
              <XAxis type="number" {...CHART.axis} tickFormatter={v => v.toLocaleString()} />
              <YAxis type="category" dataKey="tech" {...CHART.axis} width={78} />
              <Tooltip {...CHART.tooltip} formatter={(v, n) => [v.toLocaleString() + ' MW', n]} />
              {statusFilter.includes(1) && <Bar dataKey="existing"  stackId="a" name="Existing"  fill={STATUS_COLORS[1]} />}
              {statusFilter.includes(2) && <Bar dataKey="committed" stackId="a" name="Committed" fill={STATUS_COLORS[2]} />}
              {statusFilter.includes(3) && <Bar dataKey="candidate" stackId="a" name="Candidate" fill={STATUS_COLORS[3]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Generator list */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {[['g','Unit'],['zone','Zone'],['tech','Tech'],['fuel','Fuel'],['status','Status'],['cap','Cap (MW)'],['stYr','Start'],['retrYr','Retire']].map(([k, label]) => (
                <th key={k} onClick={() => handleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  {label}{sortCol === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} onClick={() => setModalRow(r)} style={{ cursor: 'pointer' }}>
                <td>{r.g}</td>
                <td>{r.zone}</td>
                <td><span className="tech-dot" style={{ background: fuelColor(r.fuel) }} />{r.tech}</td>
                <td>{r.fuel}</td>
                <td><span style={{ color: STATUS_COLORS[r.status] ?? 'var(--text-muted)', fontSize: 10 }}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
                <td className="num">{r.cap.toLocaleString()}</td>
                <td>{r.stYr}</td>
                <td>{r.retrYr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalRow && (
        <div className="modal-overlay" onClick={() => setModalRow(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="tech-dot" style={{ background: fuelColor(modalRow.fuel), width: 9, height: 9 }} />
              <strong>{modalRow.g}</strong>
              <button className="modal-close" onClick={() => setModalRow(null)}>×</button>
            </div>
            <table className="modal-table">
              <tbody>
                {Object.entries(modalRow._raw).map(([k, v]) =>
                  v !== '' && v !== null && v !== undefined ? (
                    <tr key={k}><td className="modal-key">{k}</td><td>{String(v)}</td></tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
