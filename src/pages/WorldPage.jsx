import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useTheme } from '../App';
import { getT, mapStyle, DARK, LIGHT } from '../constants';

export default function WorldPage() {
  const { theme } = useTheme();
  const t = getT(theme);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [regions, setRegions] = useState(null);

  useEffect(() => {
    fetch('/data/regions.json').then(r => r.json()).then(d => setRegions(d.regions));
  }, []);

  useEffect(() => {
    if (!containerRef.current || !regions) return;

    // Build iso → region lookup
    const isoToRegion = {};
    const isoToColor  = {};
    const available   = regions.filter(r => r.status === 'available');
    for (const r of available) {
      for (const c of r.countries) {
        isoToRegion[c.iso] = r.id;
        isoToColor[c.iso]  = r.color;
      }
    }
    const availableIsos = Object.keys(isoToRegion);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(theme),
      center: [20, 15],
      zoom: 2.2,
      minZoom: 1.5,
      maxZoom: 9,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', async () => {
      const countries = await fetch('/data/countries_110m.geojson').then(r => r.json());

      // Normalise ISO codes
      countries.features.forEach((f, i) => {
        const p = f.properties;
        let iso = p.ISO_A3 || '-99';
        if (iso === '-99') iso = p.ISO_A3_EH || '-99';
        if (iso === '-99') iso = p.ADM0_A3 || '-99';
        p.ISO_A3 = iso;
        f.id = i;  // needed for feature-state
      });

      map.addSource('countries', { type: 'geojson', data: countries, generateId: false });

      // Base land
      map.addLayer({
        id: 'land',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': t.land, 'fill-opacity': 1 },
      });
      // Base borders
      map.addLayer({
        id: 'borders',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': t.worldBdr, 'line-width': t.worldBdrW },
      });

      if (availableIsos.length) {
        const colorExpr = ['match', ['get', 'ISO_A3'],
          ...availableIsos.flatMap(iso => [iso, isoToColor[iso]]),
          'transparent',
        ];

        // Region fill
        map.addLayer({
          id: 'region-fill',
          type: 'fill',
          source: 'countries',
          filter: ['in', ['get', 'ISO_A3'], ['literal', availableIsos]],
          paint: {
            'fill-color': colorExpr,
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 0.55,
              0.28,
            ],
          },
        });

        // Region borders
        map.addLayer({
          id: 'region-border',
          type: 'line',
          source: 'countries',
          filter: ['in', ['get', 'ISO_A3'], ['literal', availableIsos]],
          paint: { 'line-color': colorExpr, 'line-width': 0.9, 'line-opacity': 0.7 },
        });
      }

      // Hover
      let hoveredId = null;
      const popup = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, offset: 8,
        className: `popup-${theme}`,
      });

      map.on('mousemove', 'region-fill', e => {
        map.getCanvas().style.cursor = 'pointer';
        if (hoveredId !== null)
          map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false });
        hoveredId = e.features[0].id;
        map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: true });

        const iso = e.features[0].properties.ISO_A3;
        const region = regions.find(r => r.id === isoToRegion[iso]);
        const country = region?.countries.find(c => c.iso === iso);
        popup
          .setLngLat(e.lngLat)
          .setHTML(`<b>${country?.name || iso}</b><br><span style="opacity:0.65">${region?.name || ''} · click to explore</span>`)
          .addTo(map);
      });

      map.on('mouseleave', 'region-fill', () => {
        map.getCanvas().style.cursor = '';
        if (hoveredId !== null)
          map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false });
        hoveredId = null;
        popup.remove();
      });

      map.on('click', 'region-fill', e => {
        const iso = e.features[0].properties.ISO_A3;
        const regionId = isoToRegion[iso];
        if (regionId) navigate(`/region/${regionId}`);
      });
    });

    return () => mapRef.current?.remove();
  }, [regions, theme]);

  return (
    <div style={{ height: 'calc(100vh - 46px)', position: 'relative', backgroundColor: t.bg }}>
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 46px)' }} />

      {/* Region legend */}
      {regions && (
        <div style={{
          position: 'absolute', bottom: 24, left: 24,
          backgroundColor: t.panel,
          border: `1px solid ${t.panelBorder}`,
          borderRadius: 8, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          <div style={{ fontSize: '0.52rem', letterSpacing: '2px', fontWeight: 700, color: t.lblMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Power Pools
          </div>
          {regions.map(r => (
            <div
              key={r.id}
              onClick={() => r.status === 'available' && navigate(`/region/${r.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: r.status === 'available' ? 'pointer' : 'default',
                opacity: r.status === 'available' ? 1 : 0.38,
              }}
            >
              <span style={{
                width: 9, height: 9, borderRadius: 2,
                backgroundColor: r.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: '0.75rem', color: t.text }}>{r.name}</span>
              {r.status !== 'available' && (
                <span style={{ fontSize: '0.58rem', color: t.lblMuted }}>soon</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
