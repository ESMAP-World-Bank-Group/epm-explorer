import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../App';
import { getT } from '../constants';
import { useEffect, useState, useMemo } from 'react';

const EPM_DASHBOARD_URL = 'https://epm-dashboard.onrender.com';

function useBreadcrumb() {
  const location = useLocation();
  const [label, setLabel] = useState('');

  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) { setLabel(''); return; }
    if (parts[0] === 'region' && parts[1]) {
      fetch('/data/regions.json')
        .then(r => r.json())
        .then(d => {
          const r = (d.regions || []).find(r => r.id === parts[1]);
          setLabel(r ? r.name : parts[1]);
        })
        .catch(() => setLabel(parts[1]));
    } else if (parts[0] === 'country' && parts[1]) {
      fetch('/data/regions.json')
        .then(r => r.json())
        .then(d => {
          for (const r of (d.regions || [])) {
            const c = r.countries.find(c => c.iso === parts[1]);
            if (c) { setLabel(`${r.name} / ${c.name}`); return; }
          }
          setLabel(parts[1]);
        })
        .catch(() => setLabel(parts[1]));
    }
  }, [location.pathname]);

  return label;
}

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const t = getT(theme);
  const crumb = useBreadcrumb();
  const location = useLocation();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Pass region/country context to the dashboard if available
  const dashboardUrl = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const params = new URLSearchParams();
    if (parts[0] === 'region' && parts[1]) params.set('region', parts[1]);
    else if (parts[0] === 'country' && parts[1]) params.set('country', parts[1]);
    const qs = params.toString();
    return qs ? `${EPM_DASHBOARD_URL}?${qs}` : EPM_DASHBOARD_URL;
  }, [location.pathname]);

  return (
    <div style={{
      height: 46, display: 'flex', alignItems: 'center',
      padding: '0 18px', backgroundColor: t.navBg,
      borderBottom: `1px solid ${t.panelBorder}`,
      justifyContent: 'space-between', flexShrink: 0,
      zIndex: 200,
    }}>
      {/* Left: logo + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/" style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '2px',
          color: t.muted, textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <ellipse cx="12" cy="12" rx="4.5" ry="10"/>
            <line x1="2.5" y1="9" x2="21.5" y2="9"/>
            <line x1="2.5" y1="15" x2="21.5" y2="15"/>
          </svg>
          Regional Power Explorer
        </Link>
        {crumb && (
          <>
            <span style={{ color: t.panelBorder, fontSize: '0.75rem' }}>›</span>
            <span style={{ fontSize: '0.75rem', color: t.lbl }}>{crumb}</span>
          </>
        )}
      </div>

      {/* Right: EPM Suite + theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* EPM Suite */}
        <div style={{ position: 'relative' }}>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            style={{
              background: 'none',
              border: `1px solid rgba(74,143,204,0.55)`,
              borderRadius: 5, padding: '3px 10px',
              cursor: 'pointer', color: 'rgba(74,143,204,0.9)',
              fontSize: '0.68rem', letterSpacing: '1px',
              textTransform: 'uppercase', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              textDecoration: 'none',
              transition: 'border-color 0.2s, color 0.2s, background 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(74,143,204,0.08)'}
            onMouseOut={e => { e.currentTarget.style.background = 'none'; setTooltipVisible(false); }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            EPM Suite
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                 style={{ opacity: 0.55 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>

          {tooltipVisible && (
            <div style={{
              position: 'absolute', top: 34, right: 0, zIndex: 300,
              backgroundColor: t.panel, border: `1px solid ${t.panelBorder}`,
              borderRadius: 6, padding: '10px 13px', width: 230,
              fontSize: '0.68rem', color: t.muted,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)', lineHeight: 1.6,
              pointerEvents: 'none',
            }}>
              <span style={{ color: t.lbl, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                EPM Suite · Results Dashboard
              </span>
              Capacity expansion results, scenario comparisons, dispatch analysis and planning analytics.
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button onClick={toggle} style={{
          background: 'none',
          border: `1px solid ${t.panelBorder}`,
          borderRadius: 5, padding: '3px 10px',
          cursor: 'pointer', color: t.lblMuted,
          fontSize: '0.68rem', letterSpacing: '1px',
          textTransform: 'uppercase', fontFamily: 'inherit',
          transition: 'border-color 0.2s, color 0.2s',
        }}>
          {theme === 'dark' ? '☀ Light' : '◑ Dark'}
        </button>
      </div>
    </div>
  );
}
