import { Link } from 'react-router-dom';
import { useTheme } from '../App';
import { getT } from '../constants';

export default function ContactPage() {
  const { theme } = useTheme();
  const t = getT(theme);

  const sec = {
    fontSize: '0.5rem', letterSpacing: '2px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 28, display: 'block',
  };

  const linkBtn = {
    fontSize: '0.62rem', color: 'rgba(74,143,204,0.85)',
    border: '1px solid rgba(74,143,204,0.3)', borderRadius: 4,
    padding: '4px 10px', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: t.bg, color: t.text }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* Back */}
        <div style={{ marginBottom: 28 }}>
          <Link to="/" style={{ fontSize: '0.65rem', color: t.muted, letterSpacing: '1px' }}>
            ← Back to map
          </Link>
        </div>

        {/* Header */}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: t.text, marginBottom: 6 }}>
          Contact
        </h1>
        <p style={{ fontSize: '0.75rem', color: t.muted, maxWidth: 520, lineHeight: 1.65, marginBottom: 32 }}>
          Questions, feedback, or data contributions — reach out directly.
        </p>

        {/* Contact card */}
        <div style={{
          padding: '20px 24px', borderRadius: 8,
          border: `1px solid ${t.panelBorder}`,
          backgroundColor: t.panel,
          marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div>
            <div style={{ fontSize: '0.48rem', letterSpacing: '2px', fontWeight: 700, color: t.lblMuted, textTransform: 'uppercase', marginBottom: 4 }}>
              Contact
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: t.text, marginBottom: 2 }}>
              World Bank · ESMAP
            </div>
            <div style={{ fontSize: '0.68rem', color: t.muted, marginBottom: 8 }}>
              Energy Sector Management Assistance Program
            </div>
            <a href="mailto:mbaronnet@worldbank.org" style={{
              fontSize: '0.62rem', color: t.lblMuted,
              textDecoration: 'none', opacity: 0.75,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              mbaronnet@worldbank.org
            </a>
          </div>
        </div>

        {/* EPM model card */}
        <div style={{
          padding: '20px 24px', borderRadius: 8,
          border: `1px solid ${t.panelBorder}`,
          backgroundColor: t.panel,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: '0.48rem', letterSpacing: '2px', fontWeight: 700, color: t.lblMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            About this tool
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: t.text }}>
            EPM — Electricity Planning Model
          </div>
          <p style={{ fontSize: '0.7rem', color: t.muted, lineHeight: 1.7, margin: 0 }}>
            A capacity expansion and dispatch optimization model for World Bank power sector
            planning studies. This explorer is the geospatial front-end for visualizing
            model inputs and country context.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <a href="https://esmap-world-bank-group.github.io/EPM_main/" target="_blank"
              rel="noopener noreferrer" style={linkBtn}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              EPM Documentation
            </a>
            <a href="https://github.com/ESMAP-World-Bank-Group/epm-explorer" target="_blank"
              rel="noopener noreferrer" style={linkBtn}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
