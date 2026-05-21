import { createContext, useContext, useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import WorldPage from './pages/WorldPage'
import ModelPage from './pages/ModelPage'
import { getT } from './constants'

export const ThemeCtx = createContext({ theme: 'ink', setTheme: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export default function App() {
  const [theme, setTheme] = useState('ink')
  const t = getT(theme)

  // Sync CSS custom properties → all CSS-class-based components update automatically
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--bg',         t.bg)
    r.setProperty('--surface',    t.panel)
    r.setProperty('--surface-2',  t.cardBg)
    r.setProperty('--border',     t.panelBorder)
    r.setProperty('--text',       t.text)
    r.setProperty('--text-muted', t.lblMuted)
    r.setProperty('--nav-bg',     t.navBg)
    document.body.style.backgroundColor = t.bg
  }, [theme, t])

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: t.bg }}>
        <Navbar />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/"              element={<WorldPage />} />
            <Route path="/model/:branch" element={<ModelPage />} />
          </Routes>
        </div>
      </div>
    </ThemeCtx.Provider>
  )
}
