import { useState } from 'react'
import OverviewTab  from './tabs/OverviewTab'
import LoadTab      from './tabs/LoadTab'
import SupplyTab    from './tabs/SupplyTab'
import ResourcesTab from './tabs/ResourcesTab'
import TopologyTab  from './tabs/TopologyTab'
import AboutTab     from './tabs/AboutTab'

const TABS = [
  { key: 'overview',  label: 'Overview'  },
  { key: 'load',      label: 'Load'      },
  { key: 'supply',    label: 'Supply'    },
  { key: 'resources', label: 'Resources' },
  { key: 'topology',  label: 'Topology'  },
  { key: 'about',     label: 'About'     },
]

export default function DataPanel({ branch, model, selectedZone, selectedISO, isoToZonesMap }) {
  const [active, setActive] = useState('overview')
  const props = { branch, model, selectedZone, selectedISO, isoToZonesMap }

  return (
    <div className="data-panel">
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn${active === t.key ? ' active' : ''}`} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {active === 'overview'  && <OverviewTab  {...props} />}
        {active === 'load'      && <LoadTab      {...props} />}
        {active === 'supply'    && <SupplyTab    {...props} />}
        {active === 'resources' && <ResourcesTab {...props} />}
        {active === 'topology'  && <TopologyTab  {...props} />}
        {active === 'about'     && <AboutTab     {...props} />}
      </div>
    </div>
  )
}
