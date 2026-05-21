import { useMemo } from 'react'
import { useCSV } from '../../hooks/useGitHub'

export default function AboutTab({ branch, model }) {
  const df = model?.data_folder
  const { data: years }    = useCSV(branch, df ? `epm/input/${df}/y.csv`                 : null)
  const { data: settings } = useCSV(branch, df ? `epm/input/${df}/pSettings.csv`         : null)
  const { data: vreRaw }   = useCSV(branch, df ? `epm/input/${df}/supply/pVREProfile.csv` : null)

  const yearList = useMemo(() => {
    if (!years?.length) return []
    const col = Object.keys(years[0])[0]
    return years.map(r => r[col]).filter(v => /^\d{4}$/.test(String(v)))
  }, [years])

  const settingsMap = useMemo(() => {
    if (!settings?.length) return {}
    const map = {}
    settings.forEach(r => {
      const key  = r['Abbreviation'] ?? r['abbreviation'] ?? r['Parameter'] ?? ''
      const val  = r['Value'] ?? r['value'] ?? ''
      const desc = r['Parameter'] ?? r['parameter'] ?? ''
      if (key) map[key] = { val: String(val), desc }
    })
    return map
  }, [settings])

  const { seasons, dayTypes } = useMemo(() => {
    if (!vreRaw?.length) return { seasons: [], dayTypes: [] }
    const seasonCol  = ['q', 'season', 'Season'].find(k => vreRaw[0]?.[k] !== undefined) ?? 'q'
    const daytypeCol = ['d', 'daytype', 'DayType'].find(k => vreRaw[0]?.[k] !== undefined) ?? 'd'
    return {
      seasons:  [...new Set(vreRaw.map(r => r[seasonCol]))].filter(Boolean),
      dayTypes: [...new Set(vreRaw.map(r => r[daytypeCol]))].filter(Boolean),
    }
  }, [vreRaw])

  if (!model) return <div className="empty-msg">Model metadata not available</div>

  const keySettings = [
    ['DR',        'Discount rate'],
    ['VoLL',      'Value of lost load'],
    ['PlanRes',   'Planning reserve'],
    ['CO2Price',  'CO₂ price'],
    ['BaseYear',  'Base year'],
  ]

  return (
    <div>
      <div className="section-title">Model Information</div>
      <div className="meta-grid" style={{ marginBottom: 20 }}>
        <div className="meta-card">
          <div className="meta-label">Name</div>
          <div className="meta-value">{model.name ?? model.model ?? branch}</div>
        </div>
        <div className="meta-card">
          <div className="meta-label">Type</div>
          <div className="meta-value" style={{ textTransform: 'capitalize' }}>{model.type ?? '—'}</div>
        </div>
        <div className="meta-card">
          <div className="meta-label">Year</div>
          <div className="meta-value">{model.year ?? '—'}</div>
        </div>
        <div className="meta-card">
          <div className="meta-label">Zones</div>
          <div className="meta-value">{model.zones?.length ?? '—'}</div>
        </div>
      </div>

      {model.zones?.length > 0 && (
        <>
          <div className="section-title">Zones</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {model.zones.map(z => (
              <span key={z} style={{
                background: '#1e2235',
                border: '1px solid #2a2f47',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 12,
                color: '#e2e8f0',
              }}>{z}</span>
            ))}
          </div>
        </>
      )}

      {yearList.length > 0 && (
        <>
          <div className="section-title">Time Horizon</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {yearList.map(y => (
              <span key={y} style={{
                background: '#1e2235',
                border: '1px solid #2a2f47',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 12,
                color: '#e2e8f0',
              }}>{y}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#7c879f', marginBottom: 20 }}>
            {yearList.length} planning year{yearList.length !== 1 ? 's' : ''}, {yearList[0]}–{yearList[yearList.length - 1]}
          </div>
        </>
      )}

      {(seasons.length > 0 || dayTypes.length > 0) && (
        <>
          <div className="section-title">Temporal Resolution</div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
            {seasons.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#7c879f', marginBottom: 6 }}>SEASONS ({seasons.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {seasons.map(s => (
                    <span key={s} style={{ background: '#1e2235', border: '1px solid #2a2f47', borderRadius: 4, padding: '3px 10px', fontSize: 12 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {dayTypes.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#7c879f', marginBottom: 6 }}>DAY TYPES ({dayTypes.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {dayTypes.map(d => (
                    <span key={d} style={{ background: '#1e2235', border: '1px solid #2a2f47', borderRadius: 4, padding: '3px 10px', fontSize: 12 }}>{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {Object.keys(settingsMap).length > 0 && (
        <>
          <div className="section-title">Key Settings</div>
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {keySettings
                  .filter(([k]) => settingsMap[k])
                  .map(([k, label]) => (
                    <tr key={k}>
                      <td>{label || settingsMap[k].desc}</td>
                      <td style={{ color: '#7c879f', fontFamily: 'monospace', fontSize: 11 }}>{k}</td>
                      <td className="num">{settingsMap[k].val}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontSize: 12, color: '#7c879f', cursor: 'pointer', marginBottom: 8 }}>
              All settings ({Object.keys(settingsMap).length})
            </summary>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Description</th><th>Key</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {Object.entries(settingsMap).map(([k, { val, desc }]) => (
                    <tr key={k}>
                      <td>{desc || k}</td>
                      <td style={{ color: '#7c879f', fontFamily: 'monospace', fontSize: 11 }}>{k}</td>
                      <td className="num">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <div className="section-title">Branch</div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c879f', marginBottom: 20 }}>{branch}</div>
    </div>
  )
}
