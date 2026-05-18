import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useTheme } from '../App';
import { getT, mapStyle, FUEL_COLORS, VOLTAGE_BRACKETS, HIGHLIGHT, plantRadiusExpr } from '../constants';
import LayerPanel from '../components/LayerPanel';
import CapacityChart from '../components/CapacityChart';
import StatsPanel from '../components/StatsPanel';

// ── Map helpers ──────────────────────────────────────────────────────────────

function fitBounds(isos, countries) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of countries.features) {
    if (!isos.includes(f.properties.ISO_A3)) continue;
    const geom = f.geometry;
    const rings = geom.type === 'Polygon'
      ? geom.coordinates
      : geom.coordinates.flatMap(p => p);
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }
    }
  }
  if (!isFinite(minLon)) return null;
  return [[minLon - 0.5, minLat - 0.5], [maxLon + 0.5, maxLat + 0.5]];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RegionPage() {
  const { regionId } = useParams();
  const { theme }    = useTheme();
  const t            = getT(theme);
  const navigate     = useNavigate();

  const containerRef = useRef(null);
  const mapRef       = useRef(null);

  const [region,        setRegion]       = useState(null);
  const [capacity,      setCapacity]     = useState(null);
  const [tariffs,       setTariffs]      = useState(null);
  const [fleetAge,      setFleetAge]     = useState(null);
  const [gppdAvailable, setGppdAvailable] = useState(null);
  const [presentFuels,  setPresentFuels] = useState(new Set());
  const [fuelsOff,      setFuelsOff]     = useState(new Set());
  const [kvsOff,        setKvsOff]       = useState(new Set());
  const [linesOn,       setLinesOn]      = useState(true);
  const [plantsOn,      setPlantsOn]     = useState(true);
  const [subsOn,        setSubsOn]       = useState(true);
  const [minMw,         setMinMw]        = useState(100);
  const [circleScale,   setCircleScale]  = useState(1.0);
  const [plantSource,   setPlantSource]  = useState('osm');
  const [activeTab,     setActiveTab]    = useState('overview');

  // Static tariffs — fetch once
  useEffect(() => {
    fetch('/data/tariffs.json').then(r => r.json()).then(setTariffs).catch(() => {});
  }, []);

  // Load region metadata + check GPPD availability
  useEffect(() => {
    fetch('/data/regions.json').then(r => r.json()).then(d => {
      const r = (d.regions || []).find(r => r.id === regionId);
      setRegion(r || null);
    });
    setCapacity(null); setFleetAge(null);
    fetch(`/data/cache/region_capacity_${regionId}.json`).then(r => r.json()).then(setCapacity).catch(() => {});
    // Reset layer state on region change
    setFuelsOff(new Set()); setKvsOff(new Set());
    setLinesOn(true); setPlantsOn(true); setSubsOn(true); setMinMw(100); setCircleScale(1.0);
    setPlantSource('osm'); setActiveTab('overview');
    // Check whether GPPD files exist for this region
    setGppdAvailable(null);
    fetch(`/data/cache/region_plants_${regionId}_gppd.geojson`, { method: 'HEAD' })
      .then(r => setGppdAvailable(r.ok))
      .catch(() => setGppdAvailable(false));
  }, [regionId]);

  // Fleet age — load only when GPPD source is active
  useEffect(() => {
    setFleetAge(null);
    if (plantSource !== 'gppd') return;
    fetch(`/data/cache/region_age_${regionId}_gppd.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setFleetAge)
      .catch(() => setFleetAge(null));
  }, [plantSource, regionId]);

  // Initialise map
  useEffect(() => {
    if (!containerRef.current || !region) return;

    const isos = region.countries.map(c => c.iso);
    // Expand to include territories shown separately in Natural Earth
    // (e.g. Somaliland SOL is a distinct polygon but politically part of SOM)
    const TERRITORY_ALIASES = { SOM: ['SOL'], SDN: ['SDS'] };
    const expandedIsos = isos.flatMap(iso => [iso, ...(TERRITORY_ALIASES[iso] || [])]);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(theme),
      center: [0, 20],
      zoom: 2,
      minZoom: 1,
      maxZoom: 14,
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
        fetch(`/data/cache/region_plants_${regionId}.geojson`).then(r => r.json()),
        fetch(`/data/cache/region_lines_${regionId}.geojson`).then(r => r.json()),
        fetch(`/data/cache/region_substations_${regionId}.geojson`).then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
      ]);

      // Normalise ISO codes
      countries.features.forEach((f, i) => {
        const p = f.properties;
        let iso = p.ISO_A3 || '-99';
        if (iso === '-99') iso = p.ISO_A3_EH || '-99';
        if (iso === '-99') iso = p.ADM0_A3 || '-99';
        p.ISO_A3 = iso;
        f.id = i;
      });

      // Fit map to region
      const bounds = fitBounds(expandedIsos, countries);
      if (bounds) map.fitBounds(bounds, { padding: 40, duration: 0 });

      // ── Sources ─────────────────────────────────────────────────────────
      map.addSource('countries',   { type: 'geojson', data: countries, generateId: false });
      map.addSource('plants',      { type: 'geojson', data: plantsGJ });
      map.addSource('lines',       { type: 'geojson', data: linesGJ  });
      map.addSource('substations', { type: 'geojson', data: subsGJ   });

      // ── World land ───────────────────────────────────────────────────────
      const tv = getT(theme);
      map.addLayer({ id: 'land',    type: 'fill', source: 'countries',
        paint: { 'fill-color': tv.land, 'fill-opacity': 1 } });
      map.addLayer({ id: 'borders', type: 'line', source: 'countries',
        paint: { 'line-color': tv.worldBdr, 'line-width': tv.worldBdrW } });

      // ── Transmission lines (one layer per voltage bracket) ────────────
      // Bracket order: 500kV+(≥500k), 330-500(≥330k<500k), 220-330(≥220k<330k), 110-220(<220k)
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
            'line-color': color,
            'line-width': width,
            'line-opacity': theme === 'dark' ? 0.7 : 0.55,
          },
        });
      }

      // ── Region highlight ─────────────────────────────────────────────────
      const hl = HIGHLIGHT[theme] || HIGHLIGHT.dark;
      map.addLayer({
        id: 'region-fill',
        type: 'fill',
        source: 'countries',
        filter: ['in', ['get', 'ISO_A3'], ['literal', expandedIsos]],
        paint: {
          'fill-color': hl.fill,
          'fill-opacity': [
            'case', ['boolean', ['feature-state', 'hover'], false], 0.55, 1.0,
          ],
        },
      });
      map.addLayer({
        id: 'region-border',
        type: 'line',
        source: 'countries',
        filter: ['in', ['get', 'ISO_A3'], ['literal', expandedIsos]],
        paint: { 'line-color': hl.border, 'line-width': hl.borderW, 'line-opacity': 0.9 },
      });

      // ── Plants (one layer per fuel) ───────────────────────────────────────
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
            'circle-opacity': 0.88,
            'circle-stroke-width': 0.6,
            'circle-stroke-color': 'rgba(0,0,0,0.3)',
          },
        });

        // Hover popup
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

      // ── Substations (tiny dimgrey squares via custom image) ─────────────────
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

      // ── Country hover + click ─────────────────────────────────────────────
      let hoveredId = null;
      map.on('mousemove', 'region-fill', e => {
        map.getCanvas().style.cursor = 'pointer';
        if (hoveredId !== null)
          map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false });
        hoveredId = e.features[0].id;
        map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: true });
      });
      map.on('mouseleave', 'region-fill', () => {
        map.getCanvas().style.cursor = '';
        if (hoveredId !== null)
          map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false });
        hoveredId = null;
      });
      map.on('click', 'region-fill', e => {
        const iso = e.features[0].properties.ISO_A3;
        // Map territory aliases back to canonical ISO (e.g. SOL → SOM)
        const ALIAS_TO_CANON = { SOL: 'SOM', SDS: 'SDN' };
        const canonIso = ALIAS_TO_CANON[iso] || iso;
        if (isos.includes(canonIso)) navigate(`/country/${canonIso}`);
      });
    });

    return () => { popup.remove(); mapRef.current?.remove(); };
  }, [region, theme]);

  // ── Layer toggle handlers (direct MapLibre API — 0ms) ────────────────────

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
      for (const { key } of VOLTAGE_BRACKETS) {
        if (!kvsOff.has(key) && map.getLayer(`lines-${key}`))
          map.setLayoutProperty(`lines-${key}`, 'visibility', next ? 'visible' : 'none');
      }
      return next;
    });
  }, [kvsOff]);

  const togglePlants = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setPlantsOn(prev => {
      const next = !prev;
      for (const fuel of presentFuels) {
        if (!fuelsOff.has(fuel) && map.getLayer(`plants-${fuel}`))
          map.setLayoutProperty(`plants-${fuel}`, 'visibility', next ? 'visible' : 'none');
      }
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
    if (!map?.getSource('plants')) return;
    const f = plantSource === 'gppd' ? `region_plants_${regionId}_gppd.geojson` : `region_plants_${regionId}.geojson`;
    const cf = plantSource === 'gppd' ? `region_capacity_${regionId}_gppd.json` : `region_capacity_${regionId}.json`;
    fetch(`/data/cache/${f}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        map.getSource('plants').setData(data);
        const fuels = new Set(data.features.map(f => f.properties.fuel).filter(f => FUEL_COLORS[f]));
        setPresentFuels(fuels);
        return fetch(`/data/cache/${cf}`).then(r => r.json());
      })
      .then(setCapacity)
      .catch(() => {
        if (plantSource !== 'osm') { setGppdAvailable(false); setPlantSource('osm'); }
      });
  }, [plantSource, regionId]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!region) return (
    <div style={{ padding: 40, color: t.text }}>Loading…</div>
  );

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

      {/* Map */}
      <div
        ref={containerRef}
        style={{ flex: 1, height: 'calc(100vh - 46px)', backgroundColor: t.bg }}
      />

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
          <Link to="/" style={{ fontSize: '0.75rem', color: t.muted }}>World</Link>
          <span style={{ color: t.panelBorder, fontSize: '0.75rem' }}>/</span>
          <span style={{ fontSize: '0.75rem', color: t.lbl, fontWeight: 600 }}>{region.name}</span>
        </div>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.text, marginBottom: 4 }}>
          {region.name}
        </h2>
        <p style={{ fontSize: '0.8rem', color: t.muted, marginBottom: 16 }}>
          {region.countries.length} countries
        </p>
        <div style={{
          height: 3, borderRadius: 2, backgroundColor: region.color,
          width: 36, marginBottom: 20,
        }} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
          {['Overview', 'Countries'].map(tab => {
            const active = activeTab === tab.toLowerCase();
            return (
              <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} style={{
                flex: 1, fontSize: '0.58rem', letterSpacing: '1px',
                textTransform: 'uppercase', fontFamily: 'inherit',
                padding: '4px 0', borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${active ? t.lbl : t.panelBorder}`,
                backgroundColor: active ? 'rgba(128,160,192,0.12)' : 'transparent',
                color: active ? t.lbl : t.lblMuted,
                fontWeight: active ? 700 : 400,
              }}>
                {tab}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview'   && <CapacityChart capacity={capacity} region={region} theme={theme} source={plantSource} tariffs={tariffs} />}
        {activeTab === 'countries' && <StatsPanel    capacity={capacity} region={region} theme={theme} source={plantSource} tariffs={tariffs} fleetAge={fleetAge} />}
      </div>
    </div>
  );
}
