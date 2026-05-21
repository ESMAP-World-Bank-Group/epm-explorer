import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../App'
import { getT, THEME_LIST, THEMES } from '../constants'

export default function Navbar() {
  const { theme, setTheme } = useTheme()
  const t = getT(theme)
  const { pathname } = useLocation()
  const isWorld = pathname === '/'

  return (
    <div style={{
      height: 46, display: 'flex', alignItems: 'center',
      padding: '0 18px', backgroundColor: t.navBg,
      borderBottom: `1px solid ${t.panelBorder}`,
      justifyContent: 'space-between', flexShrink: 0, zIndex: 200,
    }}>
      {/* Left: logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to="/" style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '2px',
          color: t.muted, textTransform: 'uppercase', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <ellipse cx="12" cy="12" rx="4.5" ry="10"/>
            <line x1="2.5" y1="9" x2="21.5" y2="9"/>
            <line x1="2.5" y1="15" x2="21.5" y2="15"/>
          </svg>
          EPM <span style={{ fontWeight: 400 }}>Explorer</span>
        </Link>

        {!isWorld && (
          <Link to="/" style={{
            fontSize: '0.6rem', color: t.lblMuted, textDecoration: 'none',
            border: `1px solid ${t.panelBorder}`, borderRadius: 4,
            padding: '2px 8px', letterSpacing: '0.5px',
          }}>
            ← All models
          </Link>
        )}
      </div>

      {/* Right: theme swatches */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {THEME_LIST.map(id => {
          const th = THEMES[id]
          const active = theme === id
          return (
            <button key={id} title={th.label} onClick={() => setTheme(id)} style={{
              width: 14, height: 14, borderRadius: '50%', padding: 0, cursor: 'pointer',
              backgroundColor: th.swatch,
              border: active ? `2px solid ${t.lbl}` : `1px solid ${t.panelBorder}`,
              boxShadow: active ? '0 0 0 1px rgba(128,160,192,0.3)' : 'none',
              transform: active ? 'scale(1.3)' : 'scale(1)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              flexShrink: 0,
            }} />
          )
        })}
      </div>
    </div>
  )
}
