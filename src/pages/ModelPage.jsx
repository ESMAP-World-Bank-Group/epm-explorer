import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useModel } from '../hooks/useGitHub'
import { parseBranch } from '../api/github'
import MapPanel from '../components/MapPanel'
import DataPanel from '../components/DataPanel'
import { getMetaForModel } from '../utils/models'

export default function ModelPage() {
  const { branch } = useParams()
  const { model, loading } = useModel(branch)
  const parsed = parseBranch(branch)
  const [selectedZone, setSelectedZone] = useState(null)

  if (loading) return <div className="loading-center">Loading model…</div>

  const meta = getMetaForModel(parsed?.model ?? branch)
  const displayName = model?.name ?? meta.label
  const type = model?.type ?? meta.type
  const year = model?.year ?? parsed?.year

  return (
    <div className="model-page">
      <div className="model-header">
        <h2>{displayName}</h2>
        {year && <span className="model-year">{year}</span>}
        <span className={`badge badge-${type}`}>{type}</span>
        {selectedZone && (
          <div className="zone-chip">
            <span>{selectedZone}</span>
            <button className="zone-chip-clear" onClick={() => setSelectedZone(null)}>×</button>
          </div>
        )}
      </div>
      <div className="model-body">
        <MapPanel
          branch={branch}
          model={model}
          meta={meta}
          selectedZone={selectedZone}
          onZoneClick={setSelectedZone}
        />
        <DataPanel
          branch={branch}
          model={model}
          selectedZone={selectedZone}
        />
      </div>
    </div>
  )
}
