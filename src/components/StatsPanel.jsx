import { useEffect, useState } from 'react';
import { FUEL_COLORS, FUEL_LABELS, getT } from '../constants';

const RE_FUELS = new Set(['solar', 'wind', 'hydro', 'geothermal', 'biomass', 'biogas', 'wood']);

export default function StatsPanel({ capacity, region, theme, source = 'osm' }) {
  const t = getT(theme);
  const [tariffs, setTariffs] = useState(null);

  useEffect(() => {
    fetch('/data/tariffs.json').then(r => r.json()).then(setTariffs).catch(() => {});
  }, []);

  if (!capacity) return (
    <p style={{ fontSize: '0.7rem', color: t.muted, fontStyle: 'italic' }}>Loading…</p>
  );

  // Aggregate fuel totals across region
  const regionFuels = {};
  for (const iso of Object.keys(capacity.countries || {})) {
    for (const [f, v] of Object.entries(capacity.countries[iso])) {
      regionFuels[f] = (regionFuels[f] || 0) + v;
    }
  }
  const totalMW = Object.values(regionFuels).reduce((s, v) => s + v, 0);
  const reMW    = Object.entries(regionFuels).filter(([f]) => RE_FUELS.has(f)).reduce((s, [, v]) => s + v, 0);
  const reShare = totalMW > 0 ? Math.round((reMW / totalMW) * 100) : null;
  const sortedFuels = Object.entries(regionFuels).sort(([, a], [, b]) => b - a);
  const maxMW = sortedFuels[0]?.[1] || 1;

  const sec = {
    fontSize: '0.5rem', letterSpacing: '2px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase', marginBottom: 7,
    display: 'block',
  };

  return (
    <div>

      {/* ── RE Share ──────────────────────────── */}
      {reShare !== null && (
        <div style={{ marginBottom: 16 }}>
          <span style={sec}>RE Share · Installed Capacity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              flex: 1, height: 7, borderRadius: 3,
              backgroundColor: 'rgba(128,160,192,0.12)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${reShare}%`, height: '100%',
                background: 'linear-gradient(90deg, #4DABF7, #40C057)',
                borderRadius: 3,
              }} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#4DABF7', minWidth: 38, textAlign: 'right' }}>
              {reShare}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: '0.55rem', color: t.lblMuted }}>
              RE: {(reMW / 1000).toFixed(1)} GW
            </span>
            <span style={{ fontSize: '0.55rem', color: t.lblMuted }}>
              Total: {(totalMW / 1000).toFixed(1)} GW
            </span>
          </div>
        </div>
      )}

      {/* ── Capacity by Fuel ──────────────────── */}
      {sortedFuels.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span style={sec}>Installed Capacity by Fuel</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sortedFuels.map(([fuel, mw]) => (
              <div key={fuel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.6rem', color: t.lblRow }}>
                    {FUEL_LABELS[fuel] || fuel}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: t.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {(mw / 1000).toFixed(1)} GW
                  </span>
                </div>
                <div style={{
                  height: 5, borderRadius: 2,
                  backgroundColor: 'rgba(128,160,192,0.1)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(mw / maxMW) * 100}%`, height: '100%',
                    backgroundColor: FUEL_COLORS[fuel], opacity: 0.85, borderRadius: 2,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalMW === 0 && (
        <p style={{ fontSize: '0.65rem', color: t.muted, fontStyle: 'italic', marginBottom: 12 }}>
          No capacity data available.
        </p>
      )}

      {/* ── Electricity Tariffs ───────────────── */}
      {tariffs && (
        <div style={{ marginBottom: 8 }}>
          <span style={sec}>Electricity Tariffs</span>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: '0.6rem', color: t.muted,
          }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 5, color: t.lblMuted, fontWeight: 600 }}>Country</th>
                <th style={{ textAlign: 'right', paddingBottom: 5, color: t.lblMuted, fontWeight: 600 }}>Res.</th>
                <th style={{ textAlign: 'right', paddingBottom: 5, color: t.lblMuted, fontWeight: 600 }}>Ind.</th>
              </tr>
            </thead>
            <tbody>
              {region.countries.map(c => {
                const d = tariffs.countries?.[c.iso];
                if (!d) return null;
                return (
                  <tr key={c.iso} style={{ borderTop: `1px solid ${t.hr}` }}>
                    <td style={{ padding: '3px 0', color: t.lblRow }}>{c.iso}</td>
                    <td style={{ textAlign: 'right', padding: '3px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {d.res.toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '3px 0', fontVariantNumeric: 'tabular-nums' }}>
                      {d.ind ? d.ind.toFixed(3) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: '0.5rem', color: t.lblMuted, marginTop: 6, fontStyle: 'italic' }}>
            USD/kWh · {tariffs.year} · {tariffs.source}
          </p>
        </div>
      )}

      {/* ── Data source ───────────────────────── */}
      <p style={{ fontSize: '0.52rem', color: t.lblMuted, marginTop: 4, fontStyle: 'italic' }}>
        Capacity: {source === 'gppd' ? 'WRI GPPD v1.3' : 'OpenStreetMap'} · may be incomplete
      </p>
    </div>
  );
}
