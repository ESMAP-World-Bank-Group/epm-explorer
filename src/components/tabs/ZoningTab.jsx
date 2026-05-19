import { useState } from 'react';
import { getT } from '../../constants';

export default function ZoningTab({ iso, theme }) {
  const t = getT(theme);
  const [nZones, setNZones] = useState(4);

  const sec = {
    fontSize: '0.45rem', letterSpacing: '2px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase', marginBottom: 6, display: 'block',
  };

  return (
    <div>
      <span style={sec}>Zone Configuration</span>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: '0.6rem', color: t.muted }}>Number of zones</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: t.lbl }}>{nZones}</span>
        </div>
        <input type="range" min={2} max={8} step={1} value={nZones}
          style={{ width: '100%', cursor: 'pointer', accentColor: t.muted }}
          onChange={e => setNZones(parseInt(e.target.value))} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1 }}>
          {[2,3,4,5,6,7,8].map(n => (
            <span key={n} style={{
              fontSize: '0.44rem', color: n === nZones ? t.lbl : t.lblMuted,
              fontWeight: n === nZones ? 700 : 400,
            }}>{n}</span>
          ))}
        </div>
      </div>

      {/* Placeholder map area */}
      <div style={{
        border: `1px dashed ${t.panelBorder}`, borderRadius: 6,
        padding: '22px 14px', textAlign: 'center',
        backgroundColor: 'rgba(128,160,192,0.03)',
        marginBottom: 10,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
          stroke={t.panelBorder} strokeWidth="1.1" strokeLinecap="round"
          style={{ display: 'block', margin: '0 auto 10px' }}>
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/>
          <line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
        <p style={{ fontSize: '0.6rem', color: t.muted, lineHeight: 1.6, margin: '0 0 6px' }}>
          {nZones}-zone boundaries for {iso} will appear here.
        </p>
        <p style={{ fontSize: '0.5rem', color: t.lblMuted, fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
          Run{' '}
          <code style={{
            backgroundColor: 'rgba(128,160,192,0.1)', padding: '1px 4px',
            borderRadius: 2, fontStyle: 'normal',
          }}>
            prepare_zones.py
          </code>
          {' '}to generate zone data.
        </p>
      </div>

      {/* Method explanation */}
      <div style={{
        padding: '10px 11px', borderRadius: 5,
        backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`,
        marginBottom: 10,
      }}>
        <span style={{ ...sec, marginBottom: 4 }}>Method</span>
        <p style={{ fontSize: '0.57rem', color: t.muted, lineHeight: 1.65, margin: 0 }}>
          Zones are derived by clustering transmission network topology, load centers (population density),
          and administrative boundaries. Each zone gets a GeoJSON boundary + stats (capacity, population, area).
        </p>
      </div>

      {/* Future stats placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {['Installed cap.', 'Population', 'Area (km²)', 'RE potential'].map(label => (
          <div key={label} style={{
            padding: '6px 8px', borderRadius: 5,
            backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`,
            opacity: 0.45,
          }}>
            <div style={{ fontSize: '0.42rem', color: t.lblMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: '0.72rem', color: t.lblMuted }}>— / zone</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.46rem', color: t.lblMuted, marginTop: 8, fontStyle: 'italic' }}>
        Stats per zone available after prepare_zones.py
      </p>
    </div>
  );
}
