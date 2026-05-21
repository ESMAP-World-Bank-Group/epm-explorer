import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'
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

const STATUS_LABELS = { 1: 'Existing', 2: 'Committed', 3: 'Candidate' }
const STATUS_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#a855f7' }
const ALL_STATUS = [1, 2, 3]

export default function SupplyTab({ branch, model, selectedZone }) {
  const df = model?.data_folder
  const path = df ? `epm/input/${df}/supply/pGenDataInput.csv` : null
  const { data: genData, loading } = useCSV(branch, path)

  const [statusFilter, setStatusFilter] = useState([1, 2])
  const [modalRow, setModalRow] = useState(null)
  const [sortCol, setSortCol] = useState('cap')
  const [sortAsc, setSortAsc] = useState(false)

  const toggleStatus = s => setStatusFilter(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  )

  const rows = useMemo(() => {
    if (!genData?.length) return []
    return genData
      .filter(r => {
        const z = col(r, 'z', 'zone', 'Zone') ?? ''
        const status = Number(col(r, 'Status', 'status') ?? 1)
        const cap = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
        const zoneOk = !selectedZone || z === selectedZone
        return statusFilter.includes(status) && cap > 0 && zoneOk
      })
      .map(r => ({
        g:    col(r, 'g', 'plant', 'Plant', 'unit') ?? '—',
        zone: col(r, 'z', 'zone', 'Zone') ?? '—',
        tech: col(r, 'tech', 'Tech') ?? '—',
        fuel: col(r, 'fuel', 'Fuel') ?? '—',
        status: Number(col(r, 'Status', 'status') ?? 1),
        cap:  parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0,
        stYr: col(r, 'StYr', 'styr', 'start_year') ?? '—',
        retrYr: col(r, 'RetrYr', 'retyr', 'retire_year') ?? '—',
        capex: parseFloat(col(r, 'Capex', 'capex', 'CapEx')) || 0,
        fom:  parseFloat(col(r, 'FOMperMW', 'FOM', 'fom')) || 0,
        vom:  parseFloat(col(r, 'VOM', 'vom')) || 0,
        _raw: r,
      }))
  }, [genData, selectedZone, statusFilter])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortAsc ? cmp : -cmp
    })
  }, [rows, sortCol, sortAsc])

  const { byTech1, byTech2 } = useMemo(() => {
    const map1 = {}, map2 = {}
    if (!genData?.length) return { byTech1: [], byTech2: [] }
    genData
      .filter(r => {
        const z = col(r, 'z', 'zone', 'Zone') ?? ''
        return !selectedZone || z === selectedZone
      })
      .forEach(r => {
        const status = Number(col(r, 'Status', 'status') ?? 1)
        const tech = col(r, 'tech', 'Tech') ?? 'Unknown'
        const cap = parseFloat(col(r, 'Capacity', 'capacity', 'cap')) || 0
        if (!cap) return
        if (status === 1) map1[tech] = (map1[tech] ?? 0) + cap
        if (status === 2) map2[tech] = (map2[tech] ?? 0) + cap
      })
    const make = map => Object.entries(map).map(([tech, cap]) => ({ tech, cap: Math.round(cap) })).sort((a, b) => b.cap - a.cap)
    return { byTech1: make(map1), byTech2: make(map2) }
  }, [genData, selectedZone])

  const handleSort = col => {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>
  if (!genData?.length) return <div className="empty-msg">No supply data found</div>

  const totalMW = rows.reduce((s, r) => s + r.cap, 0)

  return (
    <div>
      {selectedZone && <div className="zone-filter-note">Filtered to: <strong>{selectedZone}</strong></div>}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Generation Portfolio — {totalMW.toLocaleString()} MW</span>
        {path && <a className="dl-btn" href={rawUrl(branch, path)} download>↓ CSV</a>}
      </div>

      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span className="filter-label">Status:</span>
        {ALL_STATUS.map(s => (
          <button
            key={s}
            className={`status-chip${statusFilter.includes(s) ? ' active' : ''}`}
            style={{ '--chip-color': STATUS_COLORS[s] }}
            onClick={() => toggleStatus(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {(byTech1.length > 0 || byTech2.length > 0) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {byTech1.length > 0 && (
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="chart-card-title">Existing (MW)</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byTech1} dataKey="cap" nameKey="tech" innerRadius={45} outerRadius={70} paddingAngle={1}>
                    {byTech1.map((e, i) => <Cell key={i} fill={techColor(e.tech)} />)}
                  </Pie>
                  <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v.toLocaleString()} MW`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {byTech1.slice(0, 5).map(({ tech, cap }) => (
                  <div key={tech} className="donut-legend-item">
                    <span style={{ background: techColor(tech) }} className="tech-dot" />
                    <span>{tech}</span>
                    <span className="donut-legend-val">{cap.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {byTech2.length > 0 && (
            <div className="chart-card" style={{ flex: 1, minWidth: 0 }}>
              <div className="chart-card-title">Committed (MW)</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byTech2} dataKey="cap" nameKey="tech" innerRadius={45} outerRadius={70} paddingAngle={1}>
                    {byTech2.map((e, i) => <Cell key={i} fill={techColor(e.tech)} />)}
                  </Pie>
                  <Tooltip {...CHART.tooltip} formatter={(v, n) => [`${v.toLocaleString()} MW`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {byTech2.slice(0, 5).map(({ tech, cap }) => (
                  <div key={tech} className="donut-legend-item">
                    <span style={{ background: techColor(tech) }} className="tech-dot" />
                    <span>{tech}</span>
                    <span className="donut-legend-val">{cap.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                <td>
                  <span className="tech-dot" style={{ background: techColor(r.tech) }} />
                  {r.tech}
                </td>
                <td>{r.fuel}</td>
                <td>
                  <span style={{ color: STATUS_COLORS[r.status] ?? '#7c879f', fontSize: 11 }}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
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
              <span className="tech-dot" style={{ background: techColor(modalRow.tech), width: 10, height: 10 }} />
              <strong>{modalRow.g}</strong>
              <button className="modal-close" onClick={() => setModalRow(null)}>×</button>
            </div>
            <table className="modal-table">
              <tbody>
                {Object.entries(modalRow._raw).map(([k, v]) => v !== '' && v !== null && v !== undefined ? (
                  <tr key={k}>
                    <td className="modal-key">{k}</td>
                    <td>{String(v)}</td>
                  </tr>
                ) : null)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
