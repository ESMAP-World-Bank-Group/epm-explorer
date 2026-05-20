import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useCSV } from '../../hooks/useGitHub'
import { rawUrl } from '../../api/github'

const CHART_STYLE = {
  cartesianGrid: { strokeDasharray: '3 3', stroke: '#2a2f47' },
  tooltip: { contentStyle: { background: '#161924', border: '1px solid #2a2f47', fontSize: 12 } },
  xAxis: { tick: { fill: '#7c879f', fontSize: 11 } },
  yAxis: { tick: { fill: '#7c879f', fontSize: 11 }, width: 70 },
}

function isType(val, target) {
  return String(val ?? '').toLowerCase() === target
}

export default function LoadTab({ branch, model }) {
  const df = model?.data_folder
  const path = df ? `epm/input/${df}/load/pDemandForecast.csv` : null
  const { data, loading, error } = useCSV(branch, path)

  const { peakSeries, energySeries, years } = useMemo(() => {
    if (!data || !data.length) return { peakSeries: [], energySeries: [], years: [] }

    const yearCols = Object.keys(data[0]).filter(k => /^\d{4}$/.test(k))
    const peakRows   = data.filter(r => isType(r.type ?? r.Type, 'peak'))
    const energyRows = data.filter(r => isType(r.type ?? r.Type, 'energy'))

    // Sum all zones
    const sum = (rows, yr) => rows.reduce((acc, r) => acc + (parseFloat(r[yr]) || 0), 0)

    return {
      peakSeries:   yearCols.map(yr => ({ year: parseInt(yr), value: sum(peakRows,   yr) })),
      energySeries: yearCols.map(yr => ({ year: parseInt(yr), value: sum(energyRows, yr) })),
      years: yearCols,
    }
  }, [data])

  if (!df) return <div className="empty-msg">Model metadata not available</div>
  if (loading) return <div className="loading-center" style={{ height: 200 }}>Loading…</div>
  if (error) return <div className="error-msg">Could not load pDemandForecast.csv</div>
  if (!data || !data.length) return <div className="empty-msg">No demand forecast data found</div>

  return (
    <div>
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Demand Forecast</span>
        {path && <a className="dl-btn" href={rawUrl(branch, path)} download>↓ CSV</a>}
      </div>

      {peakSeries.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">Peak Demand (MW)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={peakSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART_STYLE.cartesianGrid} />
              <XAxis dataKey="year" {...CHART_STYLE.xAxis} />
              <YAxis {...CHART_STYLE.yAxis} tickFormatter={v => v.toLocaleString()} />
              <Tooltip {...CHART_STYLE.tooltip} formatter={v => [`${v.toLocaleString()} MW`, 'Peak']} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {energySeries.length > 0 && (
        <div className="chart-card">
          <div className="chart-card-title">Energy Demand (GWh)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={energySeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART_STYLE.cartesianGrid} />
              <XAxis dataKey="year" {...CHART_STYLE.xAxis} />
              <YAxis {...CHART_STYLE.yAxis} tickFormatter={v => v.toLocaleString()} />
              <Tooltip {...CHART_STYLE.tooltip} formatter={v => [`${v.toLocaleString()} GWh`, 'Energy']} />
              <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Zone breakdown — show first 8 year columns */}
      {data.length > 0 && (
        <>
          <div className="section-title">By Zone</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Type</th>
                  {years.slice(0, 8).map(y => <th key={y} className="num">{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    <td>{r.z ?? r.zone ?? r.Zone ?? '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.type ?? r.Type ?? '—'}</td>
                    {years.slice(0, 8).map(y => (
                      <td key={y} className="num">
                        {r[y] != null ? Number(r[y]).toLocaleString() : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
