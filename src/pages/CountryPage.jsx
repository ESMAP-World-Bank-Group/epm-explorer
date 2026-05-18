import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useTheme } from '../App';
import { getT, mapStyle, FUEL_COLORS, VOLTAGE_BRACKETS, HIGHLIGHT, plantRadiusExpr } from '../constants';
import LayerPanel from '../components/LayerPanel';

// Ray-casting point-in-polygon (handles Polygon + MultiPolygon)
function pointInRing(pt, ring) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function pointInFeature(pt, feature) {
  const g = feature.geometry;
  if (g.type === 'Polygon')
    return g.coordinates.some(ring => pointInRing(pt, ring));
  if (g.type === 'MultiPolygon')
    return g.coordinates.some(poly => poly.some(ring => pointInRing(pt, ring)));
  return false;
}

function fitBoundsCountry(iso, countries) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of countries.features) {
    if (f.properties.ISO_A3 !== iso) continue;
    const geom = f.geometry;
    const rings = geom.type === 'Polygon'
      ? geom.coordinates
      : geom.coordinates.flatMap(p => p);
    for (const ring of rings)
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }
  }
  if (!isFinite(minLon)) return null;
  return [[minLon - 0.8, minLat - 0.8], [maxLon + 0.8, maxLat + 0.8]];
}

export default function CountryPage() {
  const { iso }      = useParams();
  const { theme }    = useTheme();
  const t            = getT(theme);

  const containerRef = useRef(null);
  const mapRef       = useRef(null);

  const [info,         setInfo]         = useState(null);  // { country, region }
  const [presentFuels, setPresentFuels] = useState(new Set());
  const [fuelsOff,     setFuelsOff]     = useState(new Set());
  const [kvsOff,       setKvsOff]       = useState(new Set());
  const [linesOn,      setLinesOn]      = useState(true);
  const [plantsOn,     setPlantsOn]     = useState(true);
  const [subsOn,       setSubsOn]       = useState(true);
  const [minMw,        setMinMw]        = useState(100);
  const [circleScale,  setCircleScale]  = useState(1.0);
  const [plantSource,   setPlantSource]   = useState('osm');
  const [gppdAvailable, setGppdAvailable] = useState(null);
  const countryFeatureRef = useRef(null);

  useEffect(() => {
    fetch('/data/regions.json').then(r => r.json()).then(d => {
      for (const region of (d.regions || [])) {
        const country = region.countries.find(c => c.iso === iso);
        if (country) {
          setInfo({ country, region });
          // Check GPPD availability for this region
          fetch(`/data/cache/region_plants_${region.id}_gppd.geojson`, { method: 'HEAD' })
            .then(r => setGppdAvailable(r.ok))
            .catch(() => setGppdAvailable(false));
          return;
        }
      }
    });
    setFuelsOff(new Set()); setKvsOff(new Set());
    setLinesOn(true); setPlantsOn(true); setSubsOn(true); setMinMw(100); setCircleScale(1.0);
    setPlantSource('osm'); setGppdAvailable(null); countryFeatureRef.current = null;
  }, [iso]);

  useEffect(() => {
    if (!containerRef.current || !info) return;
    const { region } = info;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(theme),
      center: [0, 20], zoom: 2,
      minZoom: 1, maxZoom: 16,
      attributionControl: false,
    });
    mapRef.current = map;

    const popup = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, offset: 10,
      className: `popup-${theme}`,
    });

    map.on('load', async () => {
      const [countries, plantsGJ, linesGJ, subsGJ] = await Promise.all([
        fetch('/data/countries_110m.geojson').then(r => r.json()),
        fetch(`/data/cache/region_plants_${region.id}.geojson`).then(r => r.json()),
        fetch(`/data/cache/region_lines_${region.id}.geojson`).then(r => r.json()),
        fetch(`/data/cache/region_substations_${region.id}.geojson`).then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
      ]);

      countries.features.forEach((f, i) => {
        const p = f.properties;
        let code = p.ISO_A3 || '-99';
        if (code === '-99') code = p.ISO_A3_EH || '-99';
        if (code === '-99') code = p.ADM0_A3 || '-99';
        p.ISO_A3 = code;
        f.id = i;
      });

      const bounds = fitBoundsCountry(iso, countries);
      if (bounds) map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 9 });

      // Filter plants strictly inside the country polygon (point-in-polygon)
      // Lines filtered by bbox (segments cross borders by nature)
      const countryFeature = countries.features.find(f => f.properties.ISO_A3 === iso);
      countryFeatureRef.current = countryFeature || null;
      let filteredPlants = plantsGJ;
      let filteredLines  = linesGJ;
      let filteredSubs   = subsGJ;
      if (countryFeature) {
        filteredPlants = {
          ...plantsGJ,
          features: plantsGJ.features.filter(f =>
            pointInFeature(f.geometry.coordinates, countryFeature)
          ),
        };
        filteredLines = {
          ...linesGJ,
          features: linesGJ.features.filter(f =>
            f.geometry.coordinates.some(coord => pointInFeature(coord, countryFeature))
          ),
        };
        filteredSubs = {
          ...subsGJ,
          features: subsGJ.features.filter(f =>
            pointInFeature(f.geometry.coordinates, countryFeature)
          ),
        };
      }

      map.addSource('countries',   { type: 'geojson', data: countries, generateId: false });
      map.addSource('plants',      { type: 'geojson', data: filteredPlants });
      map.addSource('lines',       { type: 'geojson', data: filteredLines  });
      map.addSource('substations', { type: 'geojson', data: filteredSubs   });

      const tv = getT(theme);

      map.addLayer({ id: 'land',    type: 'fill', source: 'countries',
        paint: { 'fill-color': tv.land, 'fill-opacity': 1 } });
      map.addLayer({ id: 'borders', type: 'line', source: 'countries',
        paint: { 'line-color': tv.worldBdr, 'line-width': tv.worldBdrW } });

      // Transmission lines
      const kvFilters = {
        '500': ['>=', ['get', 'v'], 500_000],
        '330': ['all', ['>=', ['get', 'v'], 330_000], ['<', ['get', 'v'], 500_000]],
        '220': ['all', ['>=', ['get', 'v'], 220_000], ['<', ['get', 'v'], 330_000]],
        '110': ['<', ['get', 'v'], 220_000],
      };
      for (const { color, width, key } of VOLTAGE_BRACKETS) {
        map.addLayer({
          id: `lines-${key}`,
          type: 'line',
          source: 'lines',
          filter: kvFilters[key],
          paint: {
            'line-color': color, 'line-width': width,
            'line-opacity': theme === 'dark' ? 0.7 : 0.55,
          },
        });
      }

      // Country highlight
      const hl = HIGHLIGHT[theme] || HIGHLIGHT.dark;
      map.addLayer({
        id: 'country-fill',
        type: 'fill',
        source: 'countries',
        filter: ['==', ['get', 'ISO_A3'], iso],
        paint: { 'fill-color': hl.fill, 'fill-opacity': 1.0 },
      });
      map.addLayer({
        id: 'country-border',
        type: 'line',
        source: 'countries',
        filter: ['==', ['get', 'ISO_A3'], iso],
        paint: { 'line-color': hl.border, 'line-width': hl.borderW + 0.4, 'line-opacity': 0.95 },
      });

      // Plants
      const fuels = new Set();
      for (const f of plantsGJ.features) {
        const fuel = f.properties.fuel;
        if (fuel && FUEL_COLORS[fuel]) fuels.add(fuel);
      }
      setPresentFuels(fuels);

      for (const [fuel, color] of Object.entries(FUEL_COLORS)) {
        if (!fuels.has(fuel)) continue;
        map.addLayer({
          id: `plants-${fuel}`,
          type: 'circle',
          source: 'plants',
          filter: ['all',
            ['==',  ['get', 'fuel'], fuel],
            ['>=', ['get', 'mw'],   100],
          ],
          paint: {
            'circle-radius':  plantRadiusExpr(),
            'circle-color':   color,
            'circle-opacity': 0.90,
            'circle-stroke-width': 0.6,
            'circle-stroke-color': 'rgba(0,0,0,0.3)',
          },
        });

        map.on('mouseenter', `plants-${fuel}`, e => {
          map.getCanvas().style.cursor = 'pointer';
          const p = e.features[0].properties;
          const name = p.name ? `<b>${p.name}</b><br>` : '';
          popup
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(`${name}<span style="opacity:.75">${fuel} · ${p.mw} MW</span>`)
            .addTo(map);
        });
        map.on('mouseleave', `plants-${fuel}`, () => {
          map.getCanvas().style.cursor = ''; popup.remove();
        });
      }

      // ── Substations (tiny dimgrey squares via custom image) ──────────────────
      const sqSz = 5;
      const sqData = new Uint8Array(sqSz * sqSz * 4);
      for (let i = 0; i < sqSz * sqSz; i++) {
        sqData[i * 4] = 105; sqData[i * 4 + 1] = 105; sqData[i * 4 + 2] = 105;
        sqData[i * 4 + 3] = theme === 'dark' ? 160 : 130;
      }
      map.addImage('sub-sq', { width: sqSz, height: sqSz, data: sqData });
      map.addLayer({
        id: 'substations', type: 'symbol', source: 'substations',
        layout: { 'icon-image': 'sub-sq', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-opacity': 0.8 },
      });
      map.on('mouseenter', 'substations', e => {
        map.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties;
        const name = p.name ? `<b>${p.name}</b><br>` : '';
        const kv = p.v ? `${Math.round(p.v / 1000)} kV` : '';
        popup.setLngLat(e.features[0].geometry.coordinates).setHTML(`${name}<span style="opacity:.75">Substation${kv ? ' · ' + kv : ''}</span>`).addTo(map);
      });
      map.on('mouseleave', 'substations', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
    });

    return () => { popup.remove(); mapRef.current?.remove(); };
  }, [info, theme]);

  // ── Layer toggle handlers ────────────────────────────────────────────────

  const toggleFuel = useCallback(fuel => {
    const map = mapRef.current;
    if (!map || !map.getLayer(`plants-${fuel}`)) return;
    setFuelsOff(prev => {
      const next = new Set(prev);
      if (next.has(fuel)) { next.delete(fuel); map.setLayoutProperty(`plants-${fuel}`, 'visibility', 'visible'); }
      else                { next.add(fuel);    map.setLayoutProperty(`plants-${fuel}`, 'visibility', 'none');    }
      return next;
    });
  }, []);

  const toggleKv = useCallback(key => {
    const map = mapRef.current;
    if (!map || !map.getLayer(`lines-${key}`)) return;
    setKvsOff(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); map.setLayoutProperty(`lines-${key}`, 'visibility', 'visible'); }
      else               { next.add(key);    map.setLayoutProperty(`lines-${key}`, 'visibility', 'none');    }
      return next;
    });
  }, []);

  const toggleLines = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setLinesOn(prev => {
      const next = !prev;
      for (const { key } of VOLTAGE_BRACKETS)
        if (!kvsOff.has(key) && map.getLayer(`lines-${key}`))
          map.setLayoutProperty(`lines-${key}`, 'visibility', next ? 'visible' : 'none');
      return next;
    });
  }, [kvsOff]);

  const togglePlants = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setPlantsOn(prev => {
      const next = !prev;
      for (const fuel of presentFuels)
        if (!fuelsOff.has(fuel) && map.getLayer(`plants-${fuel}`))
          map.setLayoutProperty(`plants-${fuel}`, 'visibility', next ? 'visible' : 'none');
      return next;
    });
  }, [presentFuels, fuelsOff]);

  const toggleSubs = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('substations')) return;
    setSubsOn(prev => {
      const next = !prev;
      map.setLayoutProperty('substations', 'visibility', next ? 'visible' : 'none');
      return next;
    });
  }, []);

  const handleMinMw = useCallback(mw => {
    const map = mapRef.current;
    if (!map) return;
    setMinMw(mw);
    for (const fuel of Object.keys(FUEL_COLORS)) {
      if (!map.getLayer(`plants-${fuel}`)) continue;
      map.setFilter(`plants-${fuel}`, ['all',
        ['==',  ['get', 'fuel'], fuel],
        ['>=', ['get', 'mw'],   mw],
      ]);
    }
  }, []);

  const handleCircleScale = useCallback(scale => {
    const map = mapRef.current;
    if (!map) return;
    setCircleScale(scale);
    for (const fuel of Object.keys(FUEL_COLORS)) {
      if (!map.getLayer(`plants-${fuel}`)) continue;
      map.setPaintProperty(`plants-${fuel}`, 'circle-radius', plantRadiusExpr(scale));
    }
  }, []);

  // ── Plant source hot-swap ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('plants') || !info || !countryFeatureRef.current) return;
    const filename = plantSource === 'gppd'
      ? `region_plants_${info.region.id}_gppd.geojson`
      : `region_plants_${info.region.id}.geojson`;
    fetch(`/data/cache/${filename}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const cf = countryFeatureRef.current;
        const filtered = {
          ...data,
          features: data.features.filter(f => pointInFeature(f.geometry.coordinates, cf)),
        };
        map.getSource('plants').setData(filtered);
        const fuels = new Set(filtered.features.map(f => f.properties.fuel).filter(f => FUEL_COLORS[f]));
        setPresentFuels(fuels);
      })
      .catch(() => {
        if (plantSource !== 'osm') { setGppdAvailable(false); setPlantSource('osm'); }
      });
  }, [plantSource, info]);

  if (!info) return <div style={{ padding: 40, color: t.text }}>Loading…</div>;

  const { country, region } = info;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 46px)' }}>
      <LayerPanel
        theme={theme}
        fuelsOff={fuelsOff} kvsOff={kvsOff}
        linesOn={linesOn} plantsOn={plantsOn} subsOn={subsOn}
        minMw={minMw} circleScale={circleScale}
        plantSource={plantSource} gppdAvailable={gppdAvailable}
        presentFuels={presentFuels}
        onToggleFuel={toggleFuel} onToggleKv={toggleKv}
        onToggleLines={toggleLines} onTogglePlants={togglePlants}
        onToggleSubs={toggleSubs}
        onMinMwChange={handleMinMw} onCircleScaleChange={handleCircleScale}
        onSourceChange={setPlantSource}
      />

      <div ref={containerRef} style={{ flex: 1, height: 'calc(100vh - 46px)', backgroundColor: t.bg }} />

      {/* Right panel */}
      <div style={{
        width: 260, height: 'calc(100vh - 46px)', overflowY: 'auto',
        padding: '18px 16px',
        backgroundColor: t.panel,
        borderLeft: `1px solid ${t.panelBorder}`,
        flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          <Link to="/"                     style={{ fontSize: '0.75rem', color: t.muted }}>World</Link>
          <span style={{ color: t.panelBorder, fontSize: '0.75rem' }}>/</span>
          <Link to={`/region/${region.id}`} style={{ fontSize: '0.75rem', color: t.muted }}>{region.name}</Link>
          <span style={{ color: t.panelBorder, fontSize: '0.75rem' }}>/</span>
          <span style={{ fontSize: '0.75rem', color: t.lbl, fontWeight: 600 }}>{country.name}</span>
        </div>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.text, marginBottom: 8 }}>
          {country.name}
        </h2>
        <span style={{
          fontSize: '0.68rem', fontWeight: 600, color: 'white',
          backgroundColor: region.color, borderRadius: 4,
          padding: '2px 8px', display: 'inline-block', marginBottom: 16,
        }}>
          {iso}
        </span>
        <div style={{ height: 3, borderRadius: 2, backgroundColor: region.color, width: 36, marginBottom: 20 }} />

        <hr style={{ borderColor: t.hr, marginBottom: 16 }} />

        <Link
          to={`/region/${region.id}`}
          style={{ fontSize: '0.78rem', color: region.color, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ← Back to {region.name}
        </Link>
      </div>
    </div>
  );
}
