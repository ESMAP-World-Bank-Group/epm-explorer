import { useState } from 'react'
import OverviewTab from './tabs/OverviewTab'
import LoadTab from './tabs/LoadTab'
import CapacityTab from './tabs/CapacityTab'
import RETab from './tabs/RETab'

const TABS = [
  { key: 'overview',  label: 'Overview'  },
  { key: 'load',      label: 'Load'      },
  { key: 'capacity',  label: 'Capacity'  },
  { key: 're',        label: 'RE Profiles' },
]

export default function DataPanel({ branch, model }) {
  const [active, setActive] = useState('overview')

  return (
    <div className="data-panel">
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn${active === t.key ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {active === 'overview'  && <OverviewTab  branch={branch} model={model} />}
        {active === 'load'      && <LoadTab      branch={branch} model={model} />}
        {active === 'capacity'  && <CapacityTab  branch={branch} model={model} />}
        {active === 're'        && <RETab        branch={branch} model={model} />}
      </div>
    </div>
  )
}
