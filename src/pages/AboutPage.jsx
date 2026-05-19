import { Link } from 'react-router-dom';
import { useTheme } from '../App';
import { getT } from '../constants';

const SOURCES = [
  {
    category: 'Power Plants',
    rows: [
      {
        layer:   'Plants · capacity',
        source:  'OpenStreetMap',
        abbr:    'OSM',
        version: '—',
        updated: 'Continuous',
        freq:    'Daily',
        coverage:'Global',
        quality: 'Variable — good density in Europe/Asia, sparse in Sub-Saharan Africa. Often missing MW values.',
        url:     'https://www.openstreetmap.org',
      },
      {
        layer:   'Plants · capacity · fleet age',
        source:  'WRI Global Power Plant Database',
        abbr:    'GPPD v1.3',
        version: 'v1.3',
        updated: '2021',
        freq:    'Ad hoc',
        coverage:'Global (~35 k plants)',
        quality: 'Good all-around coverage. Threshold ~1 MW. Frozen since 2021.',
        url:     'https://datasets.wri.org/dataset/globalpowerplantdatabase',
      },
      {
        layer:   'Plants · status (operating / construction / planned)',
        source:  'Global Energy Monitor',
        abbr:    'GEM',
        version: '2024–2025',
        updated: '2024–2025',
        freq:    'Semi-annual',
        coverage:'Global — fossil & RE trackers',
        quality: 'Best for fossil fuels (unit-level). Actively maintained. Requires manual download.',
        url:     'https://globalenergymonitor.org',
      },
    ],
  },
  {
    category: 'Grid Infrastructure',
    rows: [
      {
        layer:   'Transmission lines · substations',
        source:  'OpenStreetMap',
        abbr:    'OSM',
        version: '—',
        updated: 'Continuous',
        freq:    'Daily',
        coverage:'Global',
        quality: 'Best available open source. Coverage varies significantly by country.',
        url:     'https://www.openstreetmap.org',
      },
    ],
  },
  {
    category: 'Electricity Access',
    rows: [
      {
        layer:   'Access rates (total · urban · rural)',
        source:  'World Bank / SE4All',
        abbr:    'WB / SE4All',
        version: '—',
        updated: '~2022–2023',
        freq:    'Annual',
        coverage:'Global',
        quality: 'Official national statistics. Some countries report with 1–3 year lag.',
        url:     'https://trackingsdg7.esmap.org',
      },
    ],
  },
  {
    category: 'Electricity Tariffs',
    rows: [
      {
        layer:   'Residential · industrial tariffs',
        source:  'Various (IRENA, national utilities, ESMAP)',
        abbr:    'Mixed',
        version: '—',
        updated: '2022–2024',
        freq:    'Irregular',
        coverage:'Partial — not all countries covered',
        quality: 'Compiled manually. Precision varies. Use as indicative only.',
        url:     'https://www.irena.org',
      },
    ],
  },
  {
    category: 'Geography',
    rows: [
      {
        layer:   'Country boundaries',
        source:  'Natural Earth',
        abbr:    'Natural Earth',
        version: '110m',
        updated: '2024',
        freq:    'Ad hoc',
        coverage:'Global',
        quality: 'Standard for web mapping. 110 m resolution. Includes disputed territories.',
        url:     'https://www.naturalearthdata.com',
      },
    ],
  },
];

const QUALITY_COLOR = {
  'Good': '#40C057',
  'Variable': '#FCC419',
  'Partial': '#F03E3E',
};

function qualityChip(text, t) {
  const key = Object.keys(QUALITY_COLOR).find(k => text.startsWith(k));
  const color = QUALITY_COLOR[key] || '#888';
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      backgroundColor: color, marginRight: 5, flexShrink: 0,
      verticalAlign: 'middle', marginTop: -1,
    }} />
  );
}

export default function AboutPage() {
  const { theme } = useTheme();
  const t = getT(theme);

  const th = {
    fontSize: '0.5rem', letterSpacing: '1.5px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase',
    padding: '6px 10px', textAlign: 'left',
    borderBottom: `1px solid ${t.panelBorder}`,
    whiteSpace: 'nowrap',
  };

  const td = {
    fontSize: '0.62rem', color: t.muted,
    padding: '8px 10px',
    borderBottom: `1px solid ${t.panelBorder}`,
    verticalAlign: 'top',
  };

  const sec = {
    fontSize: '0.5rem', letterSpacing: '2px', fontWeight: 700,
    color: t.lblMuted, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 28, display: 'block',
  };

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      backgroundColor: t.bg, color: t.text,
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Link to="/" style={{ fontSize: '0.65rem', color: t.muted, letterSpacing: '1px' }}>
              ← Back to map
            </Link>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: t.text, marginBottom: 8 }}>
            Data Sources
          </h1>
          <p style={{ fontSize: '0.75rem', color: t.muted, maxWidth: 620, lineHeight: 1.65 }}>
            The EPM Regional Power Explorer aggregates open-access data from multiple sources.
            Coverage and accuracy vary by region. All data should be treated as indicative
            and cross-checked against national statistics for planning purposes.
          </p>
        </div>

        {/* Tables by category */}
        {SOURCES.map(({ category, rows }) => (
          <div key={category}>
            <span style={sec}>{category}</span>
            <div style={{
              borderRadius: 6, overflow: 'hidden',
              border: `1px solid ${t.panelBorder}`,
              marginBottom: 8,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: t.panel }}>
                    <th style={th}>Layer</th>
                    <th style={th}>Source</th>
                    <th style={th}>Version</th>
                    <th style={th}>Last update</th>
                    <th style={th}>Frequency</th>
                    <th style={th}>Coverage</th>
                    <th style={{ ...th, whiteSpace: 'normal', minWidth: 200 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{
                      backgroundColor: i % 2 === 0 ? 'transparent' : (theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                    }}>
                      <td style={{ ...td, color: t.lbl, fontWeight: 500 }}>{row.layer}</td>
                      <td style={td}>
                        <a href={row.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'rgba(74,143,204,0.85)', textDecoration: 'none' }}>
                          {row.abbr}
                        </a>
                        <div style={{ fontSize: '0.52rem', color: t.lblMuted, marginTop: 2 }}>
                          {row.source}
                        </div>
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{row.version}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.updated}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{row.freq}</td>
                      <td style={td}>{row.coverage}</td>
                      <td style={{ ...td, color: t.lblMuted, lineHeight: 1.5 }}>
                        {qualityChip(row.quality, t)}
                        {row.quality}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Legend */}
        <div style={{
          marginTop: 32, padding: '14px 16px', borderRadius: 6,
          border: `1px solid ${t.panelBorder}`,
          backgroundColor: t.panel,
        }}>
          <span style={{ ...sec, marginTop: 0, marginBottom: 8 }}>Quality indicator</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {Object.entries(QUALITY_COLOR).map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                <span style={{ fontSize: '0.62rem', color: t.muted }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: '0.55rem', color: t.lblMuted, marginTop: 32, lineHeight: 1.7 }}>
          EPM Regional Power Explorer · World Bank ESMAP ·{' '}
          <a href="https://github.com/ESMAP-World-Bank-Group/epm-explorer"
            target="_blank" rel="noopener noreferrer"
            style={{ color: 'rgba(74,143,204,0.7)', textDecoration: 'none' }}>
            GitHub
          </a>
          {' '}· Data licences: OSM (ODbL), GPPD (CC BY 4.0), GEM (CC BY 4.0), Natural Earth (Public Domain)
        </p>
      </div>
    </div>
  );
}
