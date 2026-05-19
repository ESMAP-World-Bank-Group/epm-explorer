import { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import WorldPage from './pages/WorldPage';
import RegionPage from './pages/RegionPage';
import CountryPage from './pages/CountryPage';
import AboutPage from './pages/AboutPage';
import { getT } from './constants';

export const ThemeCtx = createContext({ theme: 'dark', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export default function App() {
  const [theme, setTheme] = useState('dark');
  const t = getT(theme);

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(s => s === 'dark' ? 'light' : 'dark') }}>
      <BrowserRouter>
        <div style={{
          display: 'flex', flexDirection: 'column', height: '100vh',
          overflow: 'hidden', backgroundColor: t.bg,
        }}>
          <Navbar />
          <div style={{ flex: 1, overflow: 'hidden', height: 'calc(100vh - 46px)' }}>
            <Routes>
              <Route path="/"                    element={<WorldPage />} />
              <Route path="/region/:regionId"    element={<RegionPage />} />
              <Route path="/country/:iso"        element={<CountryPage />} />
              <Route path="/about"               element={<AboutPage />} />
            </Routes>
          </div>
        </div>

        {/* Bottom-left attribution */}
        <div style={{
          position: 'fixed', bottom: 10, left: 12, zIndex: 100,
          lineHeight: 1.6, pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: '0.44rem', fontWeight: 700, letterSpacing: '0.8px',
            color: t.lblMuted, textTransform: 'uppercase',
          }}>
            World Bank · ESMAP
          </div>
          <a href="mailto:mbaronnet@worldbank.org" style={{
            fontSize: '0.42rem', color: t.lblMuted, textDecoration: 'none',
            opacity: 0.65, pointerEvents: 'all',
          }}>
            mbaronnet@worldbank.org
          </a>
        </div>
      </BrowserRouter>
    </ThemeCtx.Provider>
  );
}
