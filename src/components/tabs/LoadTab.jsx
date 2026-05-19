import { useState, useEffect } from 'react';
import { getT } from '../../constants';

const ISO3_TO_ISO2 = {
  TUR:'TR', ROU:'RO', BGR:'BG', GEO:'GE', ARM:'AM', AZE:'AZ',
  SEN:'SN', GMB:'GM', GNB:'GW', GIN:'GN', SLE:'SL', LBR:'LR', CIV:'CI', GHA:'GH',
  TGO:'TG', BEN:'BJ', NGA:'NG', NER:'NE', MLI:'ML', BFA:'BF', MRT:'MR', CPV:'CV',
  CMR:'CM', CAF:'CF', TCD:'TD', COD:'CD', COG:'CG', GAB:'GA', GNQ:'GQ', STP:'ST',
  EGY:'EG', LBY:'LY', SDN:'SD', SSD:'SS', ETH:'ET', DJI:'DJ', KEN:'KE', TZA:'TZ',
  SOM:'SO', UGA:'UG', RWA:'RW', BDI:'BI',
  ZAF:'ZA', ZWE:'ZW', ZMB:'ZM', BWA:'BW', MOZ:'MZ', MWI:'MW', NAM:'NA', LSO:'LS',
  SWZ:'SZ', MDG:'MG', AGO:'AO',
  MAR:'MA', DZA:'DZ', TUN:'TN', JOR:'JO', LBN:'LB', SYR:'SY', IRQ:'IQ', SAU:'SA',
  YEM:'YE', OMN:'OM', ARE:'AE', QAT:'QA', BHR:'BH', KWT:'KW', PSE:'PS',
  ALB:'AL', BIH:'BA', MKD:'MK', MNE:'ME', SRB:'RS', KOS:'XK',
  IND:'IN', PAK:'PK', BGD:'BD', LKA:'LK', NPL:'NP', BTN:'BT', AFG:'AF', MDV:'MV',
  KAZ:'KZ', KGZ:'KG', TJK:'TJ', TKM:'TM', UZB:'UZ',
};

// Countries connected to ENTSO-E grid → European-shaped load profile
const ENTSOE_ISO3 = new Set(['ROU','BGR','TUR','ALB','BIH','MKD','MNE','SRB','KOS',
  'GEO','ARM','AZE','MAR','DZA','TUN','EGY']);

// Representative 24h weekday profiles (0–100 normalised)
// European: morning + evening double peak
const PROFILE_EUROPEAN  = [42,38,35,33,32,33,38,56,75,82,85,86,87,87,85,83,84,88,93,96,91,78,65,52];
// Developing/tropical: single broad evening peak, lower overnight
const PROFILE_TROPICAL  = [38,34,31,29,28,29,34,52,68,70,70,67,64,61,59,58,62,66,76,84,87,81,70,52];
// Arid/Gulf: high midday cooling demand
const PROFILE_ARID      = [48,44,40,37,35,36,42,55,65,70,74,78,82,83,80,76,72,70,72,74,73,68,62,54];

const GULF_ISO3 = new Set(['SAU','ARE','QAT','BHR','KWT','OMN','IRQ']);

function getProfile(iso) {
  if (GULF_ISO3.has(iso))   return { data: PROFILE_ARID,     label: 'Representative weekday · arid/Gulf (ESMAP reference)' };
  if (ENTSOE_ISO3.has(iso)) return { data: PROFILE_EUROPEAN, label: 'Typical weekday · European grid (ENTSO-E shape)' };
  return                           { data: PROFILE_TROPICAL,  label: 'Representative weekday · developing country (ESMAP reference)' };
}

function linearFit(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const sx  = pts.reduce((s, [x])    => s + x,     0);
  const sy  = pts.reduce((s, [, y])  => s + y,     0);
  const sxy = pts.reduce((s, [x, y]) => s + x * y, 0);
  const sxx = pts.reduce((s, [x])    => s + x * x, 0);
  const denom = n * sxx - sx * sx;
  if (!denom) return null;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  return { m, b };
}

function TrendChart({ historical, projected, t }) {
  if (!historical.length) return null;
  const all     = [...historical, ...projected];
  const years   = all.map(([y]) => y);
  const vals    = all.map(([, v]) => v);
  const minYear = Math.min(...years), maxYear = Math.max(...years);
  const maxVal  = Math.max(...vals) * 1.12;
  const W = 226, H = 72, pL = 34, pR = 6, pT = 6, pB = 18;
  const iW = W - pL - pR, iH = H - pT - pB;
  const toX = y => pL + ((y - minYear) / (maxYear - minYear || 1)) * iW;
  const toY = v => pT + iH - (v / maxVal) * iH;
  const histPts = historical.map(([y, v]) => `${toX(y).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const projStart = historical[historical.length - 1];
  const projPts = projected.length
    ? [`${toX(projStart[0]).toFixed(1)},${toY(projStart[1]).toFixed(1)}`,
       ...projected.map(([y, v]) => `${toX(y).toFixed(1)},${toY(v).toFixed(1)}`)].join(' ')
    : null;
  const tickVals = [0, Math.round(maxVal * 0.5 / 100) * 100, Math.round(maxVal / 100) * 100];
  const midProjYear = projected.length ? projected[Math.floor(projected.length / 2)][0] : null;
  const midProjVal  = projected.length ? projected[Math.floor(projected.length / 2)][1] : null;

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {tickVals.map(v => {
        const y = toY(v);
        return (
          <g key={v}>
            <line x1={pL} y1={y} x2={pL + iW} y2={y}
              stroke={t.panelBorder} strokeWidth={0.5} strokeDasharray="2,2" />
            <text x={pL - 2} y={y + 3} textAnchor="end" fill={t.lblMuted} fontSize={6.5}>
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            </text>
          </g>
        );
      })}
      {/* Y axis unit */}
      <text transform={`translate(8, ${pT + iH / 2}) rotate(-90)`}
        textAnchor="middle" fill={t.lblMuted} fontSize={6}>kWh/cap</text>
      {/* Historical */}
      <polyline points={histPts} fill="none" stroke="#4DABF7"
        strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Projected dashed */}
      {projPts && (
        <>
          <polyline points={projPts} fill="none" stroke="#4DABF7"
            strokeWidth={1.4} strokeDasharray="4,3" strokeLinejoin="round"
            strokeLinecap="round" opacity={0.55} />
          {midProjVal != null && (
            <text x={toX(midProjYear)} y={toY(midProjVal) - 5}
              textAnchor="middle" fill={t.lblMuted} fontSize={6} fontStyle="italic">
              projected
            </text>
          )}
        </>
      )}
      {/* X axis labels */}
      {[minYear, Math.round((minYear + maxYear) / 2), maxYear].map(yr => (
        <text key={yr} x={toX(yr)} y={H - 2} textAnchor="middle" fill={t.lblMuted} fontSize={7}>
          {yr}
        </text>
      ))}
    </svg>
  );
}

function ProfileChart({ profile, color, t }) {
  const W = 226, H = 56, pL = 10, pR = 6, pT = 6, pB = 18;
  const iW = W - pL - pR, iH = H - pT - pB;
  const maxV = Math.max(...profile);
  const toX = i => pL + (i / (profile.length - 1)) * iW;
  const toY = v => pT + iH - (v / maxV) * iH;
  const pts = profile.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const fill = [
    `${pL},${pT + iH}`,
    ...profile.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`),
    `${pL + iW},${pT + iH}`,
  ].join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <polygon points={fill} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {[0, 6, 12, 18, 23].map(h => (
        <text key={h} x={toX(h)} y={H - 3} textAnchor="middle" fill={t.lblMuted} fontSize={7}>
          {h}h
        </text>
      ))}
    </svg>
  );
}

export default function LoadTab({ iso, theme }) {
  const t = getT(theme);
  const [wdi, setWdi]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(false);

  useEffect(() => {
    const iso2 = ISO3_TO_ISO2[iso];
    if (!iso2) { setError(true); return; }
    setLoading(true); setError(false); setWdi(null);
    fetch(`https://api.worldbank.org/v2/country/${iso2}/indicator/EG.USE.ELEC.KH.PC?format=json&per_page=60&mrv=30`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(([, rows]) => {
        const pts = (rows || [])
          .filter(r => r.value != null)
          .map(r => [parseInt(r.date), Math.round(r.value)])
          .sort(([a], [b]) => a - b);
        setWdi(pts);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [iso]);

  const historical = wdi || [];
  let projected = [];
  let cagr = null;
  if (historical.length >= 3) {
    const fit = linearFit(historical);
    if (fit) {
      const lastYear = historical[historical.length - 1][0];
      projected = Array.from({ length: 11 }, (_, i) => {
        const yr = lastYear + i + 1;
        return [yr, Math.max(0, Math.round(fit.m * yr + fit.b))];
      });
    }
    // CAGR from first to last valid year
    const v0 = historical[0][1], v1 = historical[historical.length - 1][1];
    const n  = historical[historical.length - 1][0] - historical[0][0];
    if (v0 > 0 && n > 0) cagr = ((Math.pow(v1 / v0, 1 / n) - 1) * 100).toFixed(1);
  }

  const { data: profileData, label: profileLabel } = getProfile(iso);

  const sec = {
    fontSize: '0.45rem', letterSpacing: '2px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase', marginBottom: 6, display: 'block',
  };

  const legend = (color, dash, label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width={18} height={6}>
        <line x1={0} y1={3} x2={18} y2={3} stroke={color}
          strokeWidth={1.5} strokeDasharray={dash || undefined} opacity={dash ? 0.6 : 1} />
      </svg>
      <span style={{ fontSize: '0.46rem', color: t.lblMuted }}>{label}</span>
    </div>
  );

  return (
    <div>
      {/* ── Consumption trend ─────────────────── */}
      <span style={sec}>Electricity Consumption</span>

      {loading && <p style={{ fontSize: '0.62rem', color: t.muted, fontStyle: 'italic' }}>Loading…</p>}
      {error   && <p style={{ fontSize: '0.62rem', color: t.muted, fontStyle: 'italic' }}>No WB WDI data for this country.</p>}
      {!loading && !error && historical.length === 0 && (
        <p style={{ fontSize: '0.62rem', color: t.muted, fontStyle: 'italic' }}>No data available.</p>
      )}

      {historical.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 6 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: t.lbl }}>
              {historical[historical.length - 1][1].toLocaleString()}
            </span>
            <span style={{ fontSize: '0.53rem', color: t.lblMuted, marginBottom: 2 }}>
              kWh / capita · {historical[historical.length - 1][0]}
            </span>
          </div>
          <TrendChart historical={historical} projected={projected} t={t} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {legend('#4DABF7', null,  'Historical (WB WDI)')}
              {legend('#4DABF7', '4,3', 'Linear extrap.')}
            </div>
            {cagr != null && (
              <div style={{
                fontSize: '0.55rem', color: parseFloat(cagr) >= 0 ? '#40C057' : '#F03E3E',
                fontWeight: 700, letterSpacing: '0.3px',
              }}>
                {parseFloat(cagr) >= 0 ? '+' : ''}{cagr}%
                <span style={{ fontSize: '0.44rem', color: t.lblMuted, fontWeight: 400, marginLeft: 2 }}>
                  CAGR
                </span>
              </div>
            )}
          </div>
          <p style={{ fontSize: '0.46rem', color: t.lblMuted, marginTop: 3, fontStyle: 'italic', marginBottom: 14 }}>
            Source: World Bank WDI · EG.USE.ELEC.KH.PC ·{' '}
            {historical[0][0]}–{historical[historical.length - 1][0]}
          </p>
        </>
      )}

      {/* ── Daily load profile ────────────────── */}
      <div style={{ borderTop: `1px solid ${t.panelBorder}`, paddingTop: 10 }}>
        <span style={sec}>Daily Load Profile</span>
        <ProfileChart profile={profileData} color="#74C0FC" t={t} />
        <p style={{ fontSize: '0.46rem', color: t.lblMuted, marginTop: 5, fontStyle: 'italic', lineHeight: 1.5 }}>
          {profileLabel}
        </p>
      </div>
    </div>
  );
}
