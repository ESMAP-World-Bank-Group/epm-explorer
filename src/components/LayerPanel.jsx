import { FUEL_COLORS, FUEL_LABELS, VOLTAGE_BRACKETS, getT } from '../constants';

export default function LayerPanel({
  theme,
  fuelsOff, kvsOff, linesOn, plantsOn, subsOn, minMw, circleScale,
  plantSource, gppdAvailable,
  presentFuels,
  onToggleFuel, onToggleKv, onToggleLines, onTogglePlants, onToggleSubs,
  onMinMwChange, onCircleScaleChange, onSourceChange,
}) {
  const t = getT(theme);

  const sec = {
    fontSize: '0.52rem', letterSpacing: '2.5px',
    fontWeight: 700, color: t.lblMuted, textTransform: 'uppercase',
  };

  const mutedLabel = {
    fontSize: '0.52rem', fontWeight: 400,
    color: t.lblMuted, letterSpacing: '0px',
    textTransform: 'none', marginLeft: 5,
  };

  const inputStyle = {
    width: 52, fontSize: '0.68rem',
    backgroundColor: 'rgba(128,160,192,0.1)',
    border: `1px solid rgba(128,160,192,0.22)`,
    borderRadius: 4, padding: '2px 6px',
    color: t.lbl, outline: 'none', textAlign: 'right',
    fontFamily: 'inherit',
  };

  const sliderStyle = {
    width: '100%', margin: 0, cursor: 'pointer',
    accentColor: t.muted,
  };

  return (
    <div style={{
      width: 170, height: '100%', overflowY: 'auto',
      padding: '14px 12px',
      backgroundColor: t.panel,
      borderRight: `1px solid ${t.panelBorder}`,
      flexShrink: 0,
    }}>
      {/* ── POWER PLANTS ────────────────────────── */}
      <div
        className="layer-row"
        onClick={onTogglePlants}
        style={{ marginBottom: 6, opacity: plantsOn ? 1 : 0.35 }}
      >
        <span style={sec}>Power Plants</span>
        <span style={mutedLabel}>existing</span>
      </div>

      {/* Source toggle */}
      {onSourceChange && (
        <>
          <div style={{ display: 'flex', gap: 3, marginBottom: gppdAvailable === false ? 4 : 8 }}>
            {['osm', 'gppd'].map(src => {
              const active   = plantSource === src;
              const unavail  = src === 'gppd' && gppdAvailable === false;
              const checking = src === 'gppd' && gppdAvailable === null;
              return (
                <button
                  key={src}
                  onClick={() => onSourceChange(src)}
                  style={{
                    flex: 1, fontSize: '0.5rem', letterSpacing: '1px',
                    textTransform: 'uppercase', fontFamily: 'inherit',
                    padding: '2px 0', borderRadius: 3, cursor: 'pointer',
                    border: `1px ${unavail ? 'dashed' : 'solid'} ${active ? 'rgba(128,160,192,0.6)' : 'rgba(128,160,192,0.18)'}`,
                    backgroundColor: active ? 'rgba(128,160,192,0.15)' : 'transparent',
                    color: active ? t.lbl : t.lblMuted,
                    opacity: unavail ? 0.45 : checking ? 0.65 : 1,
                  }}
                >
                  {src === 'gppd' ? 'GPPD (WRI)' : 'OSM'}
                </button>
              );
            })}
          </div>
          {gppdAvailable === false && (
            <p style={{ fontSize: '0.47rem', color: '#B8860B', fontStyle: 'italic', marginBottom: 6 }}>
              Files not found — run prepare_gppd.py
            </p>
          )}
        </>
      )}

      {/* Fuel rows */}
      <div style={{ marginBottom: 8 }}>
        {Object.entries(FUEL_COLORS).map(([fuel, color]) => {
          if (!presentFuels.has(fuel)) return null;
          const off = fuelsOff.has(fuel);
          return (
            <div
              key={fuel}
              className="layer-row"
              onClick={() => onToggleFuel(fuel)}
              style={{ opacity: off ? 0.25 : 1 }}
            >
              <span style={{
                display: 'inline-block', width: 7, height: 7,
                borderRadius: '50%', backgroundColor: color,
                marginRight: 6, flexShrink: 0,
              }} />
              <span style={{ fontSize: '0.62rem', color: t.lblRow }}>
                {FUEL_LABELS[fuel] || fuel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Circle size slider */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: '0.57rem', color: t.lblMuted }}>size</span>
          <span style={{ fontSize: '0.57rem', color: t.lblMuted }}>{circleScale.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={0.4} max={2.5} step={0.1}
          value={circleScale}
          style={sliderStyle}
          onChange={e => onCircleScaleChange(parseFloat(e.target.value))}
        />
      </div>

      {/* Min MW */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        <span style={{ fontSize: '0.57rem', color: t.lblMuted }}>min</span>
        <input
          type="number"
          value={minMw}
          min={0}
          step={50}
          style={inputStyle}
          onChange={e => onMinMwChange(Math.max(0, parseInt(e.target.value) || 0))}
        />
        <span style={{ fontSize: '0.57rem', color: t.lblMuted }}>MW</span>
      </div>

      <hr style={{ borderColor: 'rgba(128,160,192,0.18)', margin: '10px 0 8px' }} />

      {/* ── TRANSMISSION ────────────────────────── */}
      <div
        className="layer-row"
        onClick={onToggleLines}
        style={{ marginBottom: 8, opacity: linesOn ? 1 : 0.35 }}
      >
        <span style={sec}>Transmission</span>
        <span style={mutedLabel}>existing</span>
      </div>

      {VOLTAGE_BRACKETS.map(({ color, label, key }) => {
        const off = kvsOff.has(key);
        return (
          <div
            key={key}
            className="layer-row"
            onClick={() => onToggleKv(key)}
            style={{ opacity: (!linesOn || off) ? 0.22 : 1 }}
          >
            <span style={{
              display: 'inline-block', width: 16, height: 2,
              backgroundColor: color, marginRight: 7,
              borderRadius: 1, flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.62rem', color: t.lblRow }}>{label}</span>
          </div>
        );
      })}

      {/* Substations row */}
      {onToggleSubs && (
        <div
          className="layer-row"
          onClick={onToggleSubs}
          style={{ marginTop: 6, opacity: subsOn ? 1 : 0.22 }}
        >
          <span style={{
            display: 'inline-block', width: 5, height: 5,
            borderRadius: 1,
            backgroundColor: theme === 'dark' ? 'rgba(200,220,240,0.55)' : 'rgba(40,50,60,0.45)',
            marginRight: 8, flexShrink: 0,
          }} />
          <span style={{ fontSize: '0.62rem', color: t.lblRow }}>Substations</span>
        </div>
      )}
    </div>
  );
}
