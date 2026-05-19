import { useState, useEffect } from 'react';
import { getT } from '../../constants';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function LineChart({ data, color, unit, t }) {
  if (!data || data.length < 2) return null;
  const W = 226, H = 62, pL = 26, pR = 6, pT = 6, pB = 20;
  const iW = W - pL - pR, iH = H - pT - pB;
  const minV = Math.min(...data), maxV = Math.max(...data);
  const range = maxV - minV || 1;
  const toX = i => pL + (i / (data.length - 1)) * iW;
  const toY = v => pT + iH - ((v - minV) / range) * iH;
  const pts = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const fill = [
    `${pL},${pT + iH}`,
    ...data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`),
    `${pL + iW},${pT + iH}`,
  ].join(' ');
  const ticks = [minV, (minV + maxV) / 2, maxV];
  return (
    <div>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {ticks.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={pL + iW} y2={y}
                stroke={t.panelBorder} strokeWidth={0.5} strokeDasharray="2,2" />
              <text x={pL - 2} y={y + 3} textAnchor="end" fill={t.lblMuted} fontSize={6.5}>
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        <polygon points={fill} fill={color} opacity={0.12} />
        <polyline points={pts} fill="none" stroke={color}
          strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) => (
          <circle key={i} cx={toX(i)} cy={toY(v)} r={2} fill={color} />
        ))}
        {[0, 3, 6, 9, 11].map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fill={t.lblMuted} fontSize={7}>
            {MONTH_LABELS[i]}
          </text>
        ))}
      </svg>
      <p style={{ fontSize: '0.44rem', color: t.lblMuted, marginTop: 2, fontStyle: 'italic' }}>{unit}</p>
    </div>
  );
}

export default function REResourcesTab({ center, theme }) {
  const t = getT(theme);
  const [solar, setSolar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!center) return;
    setLoading(true); setError(false); setSolar(null);
    const { lat, lon } = center;
    fetch(`https://api.globalsolaratlas.info/data/lta?loc=${lat.toFixed(4)},${lon.toFixed(4)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const ann = data.annual?.data || {};
        const mon = data.monthly?.data || {};
        const monthlyGhiDaily = (mon.GHI || []).map((v, i) => +(v / DAYS_PER_MONTH[i]).toFixed(2));
        setSolar({
          ghi:  ann.GHI,
          dni:  ann.DNI,
          pvout: ann.PVOUT_csi,
          cf:   ann.PVOUT_csi ? ((ann.PVOUT_csi / 8760) * 100).toFixed(1) : null,
          monthlyGhiDaily,
        });
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [center]);

  const sec = {
    fontSize: '0.45rem', letterSpacing: '2px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase', marginBottom: 6, display: 'block',
  };

  return (
    <div>
      <span style={sec}>Solar Resource</span>

      {!center && (
        <p style={{ fontSize: '0.62rem', color: t.muted, fontStyle: 'italic' }}>
          Loading country location…
        </p>
      )}
      {loading && (
        <p style={{ fontSize: '0.62rem', color: t.muted, fontStyle: 'italic' }}>
          Fetching Solar Atlas data…
        </p>
      )}
      {error && (
        <p style={{ fontSize: '0.62rem', color: t.muted, fontStyle: 'italic' }}>
          Could not load Solar Atlas data.
        </p>
      )}

      {solar && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
            {[
              { label: 'GHI',     value: solar.ghi   ? solar.ghi.toFixed(0)   : '—', unit: 'kWh/m²/yr' },
              { label: 'PVOUT',   value: solar.pvout  ? solar.pvout.toFixed(0)  : '—', unit: 'kWh/kWp/yr' },
              { label: 'DNI',     value: solar.dni   ? solar.dni.toFixed(0)   : '—', unit: 'kWh/m²/yr' },
              { label: 'PV CF',   value: solar.cf    ? `${solar.cf}%`         : '—', unit: 'capacity factor' },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{
                padding: '6px 8px', borderRadius: 5,
                backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`,
              }}>
                <div style={{ fontSize: '0.42rem', color: t.lblMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: t.lbl }}>{value}</div>
                <div style={{ fontSize: '0.42rem', color: t.lblMuted }}>{unit}</div>
              </div>
            ))}
          </div>

          <span style={{ ...sec, marginBottom: 4 }}>Monthly GHI</span>
          <LineChart
            data={solar.monthlyGhiDaily}
            color="#FFD43B"
            unit="kWh/m²/day — Global Solar Atlas (ESMAP/World Bank)"
            t={t}
          />
        </>
      )}

      <div style={{ borderTop: `1px solid ${t.panelBorder}`, marginTop: 14, paddingTop: 12 }}>
        <span style={sec}>Wind Resource</span>
        <p style={{ fontSize: '0.6rem', color: t.lblMuted, fontStyle: 'italic', lineHeight: 1.55 }}>
          Wind capacity factor data coming soon.{' '}
          <a href="https://globalwindatlas.info" target="_blank" rel="noopener noreferrer"
            style={{ color: 'rgba(74,143,204,0.8)', textDecoration: 'none' }}>
            Global Wind Atlas
          </a>
        </p>
      </div>
    </div>
  );
}
