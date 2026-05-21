import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useModel } from '../hooks/useGitHub'
import { parseBranch } from '../api/github'
import MapPanel  from '../components/MapPanel'
import DataPanel from '../components/DataPanel'
import { getMetaForModel, buildIsoToZonesMap, ZONE_TO_ISO } from '../utils/models'
import { useTheme } from '../App'
import { getT } from '../constants'

export default function ModelPage() {
  const { branch } = useParams()
  const { model, loading } = useModel(branch)
  const parsed = parseBranch(branch)
  const { theme } = useTheme()
  const t = getT(theme)

  const [selectedISO,  setSelectedISO]  = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)

  const meta = getMetaForModel(parsed?.model ?? branch)
  const displayName = model?.name ?? meta.label
  const type = model?.type ?? meta.type
  const year = model?.year ?? parsed?.year

  // Build ISO → zones map from model zones (or fall back to ZONE_TO_ISO for model countries)
  const zones = useMemo(() => {
    if (model?.zones?.length) return model.zones
    const countries = model?.countries ?? meta.countries ?? []
    return Object.entries(ZONE_TO_ISO)
      .filter(([, iso]) => countries.includes(iso))
      .map(([z]) => z)
  }, [model, meta])

  const isoToZonesMap = useMemo(() => buildIsoToZonesMap(zones), [zones])

  const handleCountryClick = (iso) => {
    const zoneList = isoToZonesMap[iso] ?? []
    if (zoneList.length === 0) return
    setSelectedISO(iso)
    setSelectedZone(zoneList.length === 1 ? zoneList[0] : null)
  }

  const clearSelection = () => {
    setSelectedISO(null)
    setSelectedZone(null)
  }

  // Country name for breadcrumb (from NE feature — approximate from ZONE_TO_ISO reverse)
  const countryLabel = useMemo(() => {
    if (!selectedISO) return null
    const zoneList = isoToZonesMap[selectedISO] ?? []
    if (zoneList.length === 1) return zoneList[0]
    // Multi-zone: show ISO
    return selectedISO
  }, [selectedISO, isoToZonesMap])

  // Multi-zone picker (e.g. Somalia with Mogadishu/Somaliland/SomaliaROC)
  const multiZones = selectedISO && !selectedZone ? (isoToZonesMap[selectedISO] ?? []) : []

  if (loading) return <div className="loading-center" style={{ height: '100%' }}>Loading model…</div>

  return (
    <div className="model-page">
      {/* Header */}
      <div className="model-header">
        <h2>{displayName}</h2>
        {year && <span className="model-year">{year}</span>}
        <span className={`badge badge-${type}`}>{type}</span>

        {/* Breadcrumb */}
        {selectedISO && (
          <div className="breadcrumb" style={{ marginLeft: 8 }}>
            <span className="breadcrumb-sep">›</span>
            <button className="breadcrumb-item" onClick={clearSelection}>{displayName}</button>
            <span className="breadcrumb-sep">›</span>
            {selectedZone ? (
              <>
                <button className="breadcrumb-item" onClick={() => { setSelectedZone(null) }}>{countryLabel}</button>
                {selectedZone !== countryLabel && (
                  <>
                    <span className="breadcrumb-sep">›</span>
                    <span className="breadcrumb-item active">{selectedZone}</span>
                  </>
                )}
              </>
            ) : (
              <span className="breadcrumb-item active">{countryLabel}</span>
            )}
            <button className="zone-chip-clear" onClick={clearSelection} style={{ marginLeft: 4 }}>×</button>
          </div>
        )}
      </div>

      {/* Zone picker for multi-zone countries */}
      {multiZones.length > 1 && (
        <div className="zone-picker">
          <span style={{ fontSize: 11, color: t.lblMuted, alignSelf: 'center', marginRight: 4 }}>Zone:</span>
          {multiZones.map(z => (
            <button
              key={z}
              className={`zone-pick-btn${selectedZone === z ? ' active' : ''}`}
              onClick={() => setSelectedZone(z)}
            >
              {z}
            </button>
          ))}
        </div>
      )}

      <div className="model-body">
        <MapPanel
          branch={branch}
          model={model}
          meta={meta}
          selectedISO={selectedISO}
          onCountryClick={handleCountryClick}
        />
        <DataPanel
          branch={branch}
          model={model}
          selectedZone={selectedZone}
          selectedISO={selectedISO}
          isoToZonesMap={isoToZonesMap}
        />
      </div>
    </div>
  )
}
