import { useNavigate } from 'react-router-dom';
import { FUEL_COLORS, FUEL_LABELS, getT } from '../constants';

function polarToXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(cx, cy, R, r, start, end) {
  if (end - start >= 359) {
    // Full circle: two half-arcs
    const m1 = polarToXY(cx, cy, R, 0),   m2 = polarToXY(cx, cy, R, 180);
    const m3 = polarToXY(cx, cy, r, 180),  m4 = polarToXY(cx, cy, r, 0);
    return `M${m1.x},${m1.y} A${R},${R},0,1,1,${m2.x},${m2.y} A${R},${R},0,1,1,${m1.x},${m1.y} M${m3.x},${m3.y} A${r},${r},0,1,0,${m4.x},${m4.y} A${r},${r},0,1,0,${m3.x},${m3.y} Z`;
  }
  const s1 = polarToXY(cx, cy, R, start), e1 = polarToXY(cx, cy, R, end);
  const e2 = polarToXY(cx, cy, r, end),   s2 = polarToXY(cx, cy, r, start);
  const lg = (end - start) > 180 ? 1 : 0;
  return `M${s1.x.toFixed(2)},${s1.y.toFixed(2)} A${R},${R},0,${lg},1,${e1.x.toFixed(2)},${e1.y.toFixed(2)} L${e2.x.toFixed(2)},${e2.y.toFixed(2)} A${r},${r},0,${lg},0,${s2.x.toFixed(2)},${s2.y.toFixed(2)} Z`;
}

export default function CapacityChart({ capacity, region, theme, source = 'osm' }) {
  const navigate = useNavigate();
  const t = getT(theme);

  if (!capacity) return (
    <p style={{ fontSize: '0.7rem', color: t.muted, fontStyle: 'italic' }}>Loading…</p>
  );

  const fuels = Object.keys(FUEL_COLORS);

  // Per-country sorted by total MW desc
  const countryData = region.countries.map(c => {
    const fd = capacity.countries[c.iso] || {};
    const total = Object.values(fd).reduce((s, v) => s + v, 0);
    return { iso: c.iso, name: c.name, fd, total };
  }).sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(...countryData.map(c => c.total), 1);

  // Region total for donut
  const regionFuels = {};
  for (const c of countryData) {
    for (const [f, v] of Object.entries(c.fd)) {
      regionFuels[f] = (regionFuels[f] || 0) + v;
    }
  }
  const regionTotalMW = Object.values(regionFuels).reduce((s, v) => s + v, 0);
  const fuelsWithData = Object.entries(regionFuels)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  // Build donut arcs
  const cx = 44, cy = 44, R = 36, r = 22;
  let cumDeg = 0;
  const arcs = fuelsWithData.map(([fuel, mw]) => {
    const sweep = fuelsWithData.length === 1 ? 359.9 : (mw / regionTotalMW) * 357;
    const start = cumDeg;
    cumDeg += sweep + (fuelsWithData.length > 1 ? 1 : 0);
    return { fuel, start, end: start + sweep };
  });

  return (
    <div>
      {/* ── Donut ──────────────────────────── */}
      {regionTotalMW > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
            {arcs.map(({ fuel, start, end }) => (
              <path key={fuel} d={donutArc(cx, cy, R, r, start, end)}
                fill={FUEL_COLORS[fuel]} opacity={0.88} />
            ))}
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="8"
              fontWeight="700" fill={t.text} fontFamily="inherit">
              {(regionTotalMW / 1000).toFixed(1)}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6.5"
              fill={t.muted} fontFamily="inherit">GW</text>
          </svg>

          <div style={{ fontSize: '0.58rem', color: t.muted, lineHeight: '1.65', overflow: 'hidden' }}>
            {fuelsWithData.slice(0, 6).map(([fuel, mw]) => (
              <div key={fuel} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  display: 'inline-block', width: 6, height: 6,
                  borderRadius: '50%', backgroundColor: FUEL_COLORS[fuel], flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{FUEL_LABELS[fuel] || fuel}</span>
                <span style={{ color: t.lbl, fontVariantNumeric: 'tabular-nums' }}>
                  {(mw / 1000).toFixed(1)}
                </span>
              </div>
            ))}
            {fuelsWithData.length > 6 && (
              <div style={{ color: t.lblMuted }}>+{fuelsWithData.length - 6} more</div>
            )}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '0.65rem', color: t.muted, fontStyle: 'italic', marginBottom: 12 }}>
          No capacity data available (OSM).
        </p>
      )}

      {/* ── Per-country bars ────────────────── */}
      <p style={{
        fontSize: '0.5rem', letterSpacing: '2px', fontWeight: 700,
        color: t.lblMuted, textTransform: 'uppercase', marginBottom: 7,
      }}>
        By Country
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {countryData.map(c => (
          <div
            key={c.iso}
            onClick={() => navigate(`/country/${c.iso}`)}
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 7px', borderRadius: 5,
              backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`,
            }}
          >
            <span style={{
              fontSize: '0.56rem', fontWeight: 700, color: 'white',
              backgroundColor: region.color, borderRadius: 3,
              padding: '1px 4px', flexShrink: 0, minWidth: 26, textAlign: 'center',
            }}>
              {c.iso}
            </span>

            <div style={{
              flex: 1, height: 7, borderRadius: 3,
              backgroundColor: 'rgba(128,160,192,0.1)',
              display: 'flex', overflow: 'hidden',
            }}>
              {fuels.map(fuel => {
                const mw = c.fd[fuel] || 0;
                if (!mw) return null;
                return (
                  <div key={fuel} style={{
                    width: `${(mw / maxTotal) * 100}%`,
                    backgroundColor: FUEL_COLORS[fuel],
                    opacity: 0.85, flexShrink: 0,
                  }} />
                );
              })}
            </div>

            <span style={{
              fontSize: '0.58rem', color: t.muted,
              flexShrink: 0, minWidth: 36, textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {c.total > 0 ? `${(c.total / 1000).toFixed(1)} GW` : '—'}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.52rem', color: t.lblMuted, marginTop: 8, fontStyle: 'italic' }}>
        {source === 'gppd' ? 'WRI GPPD v1.3' : 'OpenStreetMap'} · capacity may be incomplete
      </p>
    </div>
  );
}
