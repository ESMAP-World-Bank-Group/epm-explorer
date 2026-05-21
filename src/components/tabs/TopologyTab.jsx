import { useMemo, useState } from 'react'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'

function col(row, ...names) {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n]
  return null
}

export default function TopologyTab({ branch, model, selectedZone }) {
  const df = model?.data_folder
  const txPath = df ? `epm/input/${df}/trade/pTransferLimit.csv` : null
  const { data: txRaw, loading } = useCSV(branch, txPath)

  const [sortCol, setSortCol] = useState('from')
  const [sortAsc, setSortAsc] = useState(true)
  const [selYear, setSelYear] = useState('')

  const { rows, yearCols } = useMemo(() => {
    if (!txRaw?.length) return { rows: [], yearCols: [] }
    const allKeys = Object.keys(txRaw[0])
    const yrs = allKeys.filter(k => /^\d{4}$/.test(k))

    const filtered = selectedZone
      ? txRaw.filter(r => {
          const from = col(r, 'z', 'zone', 'Zone', 'from', 'From') ?? ''
          const to   = col(r, 'z2', 'zone2', 'Zone2', 'to', 'To') ?? ''
          return from === selectedZone || to === selectedZone
        })
      : txRaw

    const mapped = filtered.map(r => {
      const from = col(r, 'z', 'zone', 'Zone', 'from', 'From') ?? '—'
      const to   = col(r, 'z2', 'zone2', 'Zone2', 'to', 'To') ?? '—'
      const season = col(r, 'q', 'season', 'Season') ?? ''
      const obj = { from, to, season }
      yrs.forEach(yr => { obj[yr] = parseFloat(r[yr]) || 0 })
      return obj
    })

    return { rows: mapped, yearCols: yrs }
  }, [txRaw, selectedZone])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
      return sortAsc ? cmp : -cmp
    })
  }, [rows, sortCol, sortAsc])

  const handleSort = c => {
    if (sortCol === c) setSortAsc(a => !a)
    else { setSortCol(c); setSortAsc(true) }
  }

  const displayYear = selYear || yearCols[0] || ''
  const showYears = yearCols.slice(0, 6)

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>

  return (
    <div>
      {selectedZone && <div className="zone-filter-note">Filtered to: <strong>{selectedZone}</strong></div>}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Transfer Limits (MW)</span>
        {txPath && <a className="dl-btn" href={rawUrl(branch, txPath)} download>↓ CSV</a>}
      </div>

      {!rows.length ? (
        <div className="empty-msg">No transmission data found</div>
      ) : (
        <>
          {yearCols.length > 1 && (
            <div className="filter-row" style={{ marginBottom: 12 }}>
              <span className="filter-label">Year</span>
              <select className="filter-select" value={displayYear} onChange={e => setSelYear(e.target.value)}>
                {yearCols.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {[['from','From'],['to','To'],['season','Season'],[displayYear, displayYear || 'MW']].map(([k, label]) => (
                    <th key={k} onClick={() => handleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      {label}{sortCol === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={i}>
                    <td>{r.from}</td>
                    <td>{r.to}</td>
                    <td>{r.season || '—'}</td>
                    <td className="num">{displayYear ? (r[displayYear] ?? 0).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#7c879f' }}>
            {rows.length} corridor{rows.length !== 1 ? 's' : ''}
            {selectedZone ? ` involving ${selectedZone}` : ''}
          </div>
        </>
      )}
    </div>
  )
}
