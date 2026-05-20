import { useCSV } from '../../hooks/useGitHub'
import { techColor } from '../../utils/colors'
import { rawUrl } from '../../api/github'

const KEY_SETTINGS = [
  'fEnableCapacityExpansion', 'fDispatchMode', 'fEnableInternalExchange',
  'fEnableExternalExchange', 'fEnableStorage', 'fEnableVRE',
  'fEnableCO2', 'fEnableCapacityMarket', 'fOptimization',
]

// Try multiple column name variants (different EPM versions)
function col(row, ...names) {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n]
  return null
}

export default function OverviewTab({ branch, model }) {
  const df = model?.data_folder
  const { data: settings, loading: sLoad, error: sErr } = useCSV(branch, df ? `epm/input/${df}/pSettings.csv` : null)
  const { data: genData, loading: gLoad, error: gErr } = useCSV(branch, df ? `epm/input/${df}/supply/pGenDataInput.csv` : null)

  if (!df) return <div className="empty-msg">Model metadata not available</div>

  // pSettings: columns are Parameter, Abbreviation, Value
  const settingsMap = {}
  if (settings) {
    settings.forEach(r => {
      const abbr = col(r, 'Abbreviation', 'abbreviation', 'setting', 'Setting')
      const val  = col(r, 'Value', 'value', 'val')
      const name = col(r, 'Parameter', 'parameter', 'name')
      if (abbr && val !== null) settingsMap[abbr] = { val, name }
    })
  }
  const shownSettings = KEY_SETTINGS.filter(k => settingsMap[k] !== undefined)

  const zones = model?.zones ?? []

  return (
    <div>
      {/* Metadata cards */}
      <div className="section-title">Model Info</div>
      <div className="meta-grid">
        <div className="meta-card">
          <div className="meta-label">Model Name</div>
          <div className="meta-value">{model?.name ?? branch}</div>
        </div>
        <div className="meta-card">
          <div className="meta-label">Year</div>
          <div className="meta-value">{model?.year ?? '—'}</div>
        </div>
        <div className="meta-card">
          <div className="meta-label">Type</div>
          <div className="meta-value" style={{ textTransform: 'capitalize' }}>{model?.type ?? '—'}</div>
        </div>
        <div className="meta-card">
          <div className="meta-label">Zones</div>
          <div className="meta-value">{zones.length > 0 ? zones.length : '—'}</div>
        </div>
      </div>

      {/* Settings */}
      {!sLoad && shownSettings.length > 0 && (
        <>
          <div className="section-title">Key Settings</div>
          <div className="chart-card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Parameter</th><th>Abbreviation</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {shownSettings.map(k => (
                    <tr key={k}>
                      <td style={{ color: 'var(--text-muted)' }}>{settingsMap[k].name ?? ''}</td>
                      <td>{k}</td>
                      <td>{String(settingsMap[k].val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {sErr && <div className="error-msg">Could not load pSettings.csv</div>}

      {/* Generator fleet */}
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Generator Fleet</span>
        {df && (
          <a
            className="dl-btn"
            href={rawUrl(branch, `epm/input/${df}/supply/pGenDataInput.csv`)}
            download
          >
            ↓ CSV
          </a>
        )}
      </div>
      {gLoad && <div className="loading-center" style={{ height: 80 }}>Loading…</div>}
      {gErr && <div className="error-msg">Could not load pGenDataInput.csv</div>}
      {!gLoad && genData && genData.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Plant</th>
                <th>Tech</th>
                <th>Fuel</th>
                <th className="num">Cap (MW)</th>
                <th className="num">Built</th>
                <th className="num">Retire</th>
              </tr>
            </thead>
            <tbody>
              {genData.map((r, i) => {
                const tech = col(r, 'tech', 'Tech', 'technology')
                const cap  = col(r, 'Capacity', 'capacity', 'cap', 'Cap')
                return (
                  <tr key={i}>
                    <td>{col(r, 'z', 'zone', 'Zone')}</td>
                    <td>{col(r, 'g', 'gen', 'plant', 'Plant', 'unit')}</td>
                    <td>
                      <span className="tech-dot" style={{ background: techColor(tech) }} />
                      {tech}
                    </td>
                    <td>{col(r, 'fuel', 'f', 'Fuel')}</td>
                    <td className="num">{typeof cap === 'number' ? cap.toFixed(0) : cap}</td>
                    <td className="num">{col(r, 'StYr', 'yearBuild', 'YearBuild') ?? '—'}</td>
                    <td className="num">{col(r, 'RetrYr', 'yearRetire', 'YearRetire') ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!gLoad && genData && genData.length === 0 && (
        <div className="empty-msg">No generator data found</div>
      )}
    </div>
  )
}
