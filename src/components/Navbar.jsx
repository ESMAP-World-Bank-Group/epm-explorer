import { Link, useLocation, useParams } from 'react-router-dom';
import { useTheme } from '../App';
import { getT } from '../constants';
import { useEffect, useState } from 'react';

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
  const isHome = useLocation().pathname === '/';

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

      {/* Right: theme toggle */}
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
  );
}
