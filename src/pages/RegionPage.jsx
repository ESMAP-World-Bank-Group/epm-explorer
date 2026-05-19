import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useTheme } from '../App';
import {
  getT, mapStyle, FUEL_COLORS, VOLTAGE_BRACKETS, HIGHLIGHT,
  plantRadiusExpr, fuelColorExpr, PLANT_STATUSES,
} from '../constants';
import LayerPanel from '../components/LayerPanel';
import CapacityChart from '../components/CapacityChart';
import StatsPanel from '../components/StatsPanel';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fitBounds(isos, countries) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of countries.features) {
    if (!isos.includes(f.properties.ISO_A3)) continue;
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
  return [[minLon - 0.5, minLat - 0.5], [maxLon + 0.5, maxLat + 0.5]];
}

/** Build the MapLibre filter for a status layer, respecting fuel visibility and minMw. */
function makeLayerFilter(status, fuelsOff, minMw) {
  const clauses = [
    ['==', ['get', 'status'], status],
    ['>=', ['get', 'mw'], minMw],
  ];
  if (fuelsOff.size > 0)
    clauses.push(['!', ['in', ['get', 'fuel'], ['literal', [...fuelsOff]]]]);
  return ['all', ...clauses];
}

function downloadBlob(content, filename, type = 'application/octet-stream') {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RegionPage() {
  const { regionId } = useParams();
  const { theme }    = useTheme();
  const t            = getT(theme);
  const navigate     = useNavigate();

  const containerRef = useRef(null);
  const mapRef       = useRef(null);

  const [region,        setRegion]        = useState(null);
  const [capacity,      setCapacity]      = useState(null);
  const [tariffs,       setTariffs]       = useState(null);
  const [fleetAge,      setFleetAge]      = useState(null);
  const [access,        setAccess]        = useState(null);
  const [gppdAvailable, setGppdAvailable] = useState(null);
  const [gemAvailable,  setGemAvailable]  = useState(null);
  const [presentFuels,  setPresentFuels]  = useState(new Set());
  const [fuelsOff,      setFuelsOff]      = useState(new Set());
  const [statusOff,     setStatusOff]     = useState(new Set());
  const [kvsOff,        setKvsOff]        = useState(new Set());
  const [linesOn,       setLinesOn]       = useState(true);
  const [plantsOn,      setPlantsOn]      = useState(true);
  const [subsOn,        setSubsOn]        = useState(true);
  const [minMw,         setMinMw]         = useState(100);
  const [circleScale,   setCircleScale]   = useState(1.0);
  const [plantSource,   setPlantSource]   = useState('osm');
  const [activeTab,     setActiveTab]     = useState('overview');

  // Static data
  useEffect(() => {
    fetch('/data/tariffs.json').then(r => r.json()).then(setTariffs).catch(() => {});
    fetch('/data/access.json').then(r => r.json()).then(setAccess).catch(() => {});
  }, []);

  // Region metadata + availability checks
  useEffect(() => {
    fetch('/data/regions.json').then(r => r.json()).then(d => {
      const r = (d.regions || []).find(r => r.id === regionId);
      setRegion(r || null);
    });
    setCapacity(null); setFleetAge(null);
    fetch(`/data/cache/region_capacity_${regionId}.json`).then(r => r.json()).then(setCapacity).catch(() => {});
    setFuelsOff(new Set()); setStatusOff(new Set()); setKvsOff(new Set());
    setLinesOn(true); setPlantsOn(true); setSubsOn(true);
    setMinMw(100); setCircleScale(1.0);
    setPlantSource('osm'); setActiveTab('overview');

    setGppdAvailable(null);
    fetch(`/data/cache/region_plants_${regionId}_gppd.geojson`, { method: 'HEAD' })
      .then(r => setGppdAvailable(r.ok)).catch(() => setGppdAvailable(false));

    setGemAvailable(null);
    fetch(`/data/cache/region_plants_${regionId}_gem.geojson`, { method: 'HEAD' })
      .then(r => setGemAvailable(r.ok)).catch(() => setGemAvailable(false));
  }, [regionId]);

  // Fleet age — GPPD only
  useEffect(() => {
    setFleetAge(null);
    if (plantSource !== 'gppd') return;
    fetch(`/data/cache/region_age_${regionId}_gppd.json`)
      .then(r => r.ok ? r.json() : null).then(setFleetAge).catch(() => {});
  }, [plantSource, regionId]);

  // Map initialisation
  useEffect(() => {
    if (!containerRef.current || !region) return;

    const isos = region.countries.map(c => c.iso);
    const TERRITORY_ALIASES = { SOM: ['SOL'], SDN: ['SDS'] };
    const expandedIsos = isos.flatMap(iso => [iso, ...(TERRITORY_ALIASES[iso] || [])]);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(theme),
      center: [0, 20], zoom: 2, minZoom: 1, maxZoom: 14,
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
        fetch(`/data/cache/region_substations_${regionId}.geojson`)
          .then(r => r.json()).catch(() => ({ type: 'FeatureCollection', features: [] })),
      ]);

      countries.features.forEach((f, i) => {
        const p = f.properties;
        let iso = p.ISO_A3 || '-99';
        if (iso === '-99') iso = p.ISO_A3_EH || '-99';
        if (iso === '-99') iso = p.ADM0_A3 || '-99';
        p.ISO_A3 = iso; f.id = i;
      });

      const bounds = fitBounds(expandedIsos, countries);
      if (bounds) map.fitBounds(bounds, { padding: 40, duration: 0 });

      map.addSource('countries',   { type: 'geojson', data: countries, generateId: false });
      map.addSource('plants',      { type: 'geojson', data: plantsGJ });
      map.addSource('lines',       { type: 'geojson', data: linesGJ  });
      map.addSource('substations', { type: 'geojson', data: subsGJ   });

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
        map.addLayer({ id: `lines-${key}`, type: 'line', source: 'lines',
          filter: kvFilters[key],
          paint: { 'line-color': color, 'line-width': width,
            'line-opacity': theme === 'dark' ? 0.88 : 0.65 } });
      }

      // Region highlight
      const hl = HIGHLIGHT[theme] || HIGHLIGHT.dark;
      map.addLayer({ id: 'region-fill', type: 'fill', source: 'countries',
        filter: ['in', ['get', 'ISO_A3'], ['literal', expandedIsos]],
        paint: { 'fill-color': hl.fill,
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.55, 1.0] } });
      map.addLayer({ id: 'region-border', type: 'line', source: 'countries',
        filter: ['in', ['get', 'ISO_A3'], ['literal', expandedIsos]],
        paint: { 'line-color': hl.border, 'line-width': hl.borderW, 'line-opacity': 0.9 } });

      // ── Plant layers (3 status layers, data-driven fuel color) ───────────
      const fuels = new Set();
      for (const f of plantsGJ.features) {
        const fuel = f.properties.fuel;
        if (fuel && FUEL_COLORS[fuel]) fuels.add(fuel);
      }
      setPresentFuels(fuels);

      const colorExpr = fuelColorExpr();

      // Operating: filled circles
      map.addLayer({ id: 'plants-operating', type: 'circle', source: 'plants',
        filter: makeLayerFilter('operating', new Set(), 100),
        paint: {
          'circle-radius':       plantRadiusExpr(),
          'circle-color':        colorExpr,
          'circle-opacity':      0.88,
          'circle-stroke-width': 0.6,
          'circle-stroke-color': 'rgba(0,0,0,0.3)',
        },
      });

      // Under construction: hollow ring
      map.addLayer({ id: 'plants-construction', type: 'circle', source: 'plants',
        filter: makeLayerFilter('construction', new Set(), 100),
        paint: {
          'circle-radius':         plantRadiusExpr(),
          'circle-color':          'rgba(0,0,0,0)',
          'circle-opacity':        1,
          'circle-stroke-width':   2,
          'circle-stroke-color':   colorExpr,
          'circle-stroke-opacity': 0.9,
        },
      });

      // Planned: faint filled + thin stroke
      map.addLayer({ id: 'plants-planned', type: 'circle', source: 'plants',
        filter: makeLayerFilter('planned', new Set(), 100),
        paint: {
          'circle-radius':         plantRadiusExpr(),
          'circle-color':          colorExpr,
          'circle-opacity':        0.22,
          'circle-stroke-width':   1,
          'circle-stroke-color':   colorExpr,
          'circle-stroke-opacity': 0.45,
        },
      });

      // Hover popups for each status layer
      for (const status of PLANT_STATUSES) {
        map.on('mouseenter', `plants-${status}`, e => {
          map.getCanvas().style.cursor = 'pointer';
          const p = e.features[0].properties;
          const name   = p.name ? `<b>${p.name}</b><br>` : '';
          const mwText = p.mw   ? ` · ${p.mw} MW` : '';
          const badge  = status !== 'operating'
            ? ` <span style="opacity:.55;font-size:.85em">[${status}]</span>` : '';
          popup.setLngLat(e.features[0].geometry.coordinates)
            .setHTML(`${name}<span style="opacity:.75">${p.fuel}${mwText}${badge}</span>`)
            .addTo(map);
        });
        map.on('mouseleave', `plants-${status}`, () => {
          map.getCanvas().style.cursor = ''; popup.remove();
        });
      }

      // Substations
      const sqSz = 5;
      const sqData = new Uint8Array(sqSz * sqSz * 4);
      for (let i = 0; i < sqSz * sqSz; i++) {
        sqData[i*4] = 105; sqData[i*4+1] = 105; sqData[i*4+2] = 105;
        sqData[i*4+3] = theme === 'dark' ? 160 : 130;
      }
      map.addImage('sub-sq', { width: sqSz, height: sqSz, data: sqData });
      map.addLayer({ id: 'substations', type: 'symbol', source: 'substations',
        layout: { 'icon-image': 'sub-sq', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-opacity': 0.8 } });
      map.on('mouseenter', 'substations', e => {
        map.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties;
        const kv = p.v ? `${Math.round(p.v / 1000)} kV` : '';
        popup.setLngLat(e.features[0].geometry.coordinates)
          .setHTML(`${p.name ? `<b>${p.name}</b><br>` : ''}<span style="opacity:.75">Substation${kv ? ' · ' + kv : ''}</span>`)
          .addTo(map);
      });
      map.on('mouseleave', 'substations', () => { map.getCanvas().style.cursor = ''; popup.remove(); });

      // Country hover + click
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
        const ALIAS_TO_CANON = { SOL: 'SOM', SDS: 'SDN' };
        const canonIso = (!isos.includes(iso) && ALIAS_TO_CANON[iso]) || iso;
        if (isos.includes(canonIso)) navigate(`/country/${canonIso}`);
      });
    });

    return () => { popup.remove(); mapRef.current?.remove(); };
  }, [region, theme]);

  // ── Layer toggle handlers ─────────────────────────────────────────────────

  const toggleFuel = useCallback(fuel => {
    const map = mapRef.current;
    if (!map) return;
    setFuelsOff(prev => {
      const next = new Set(prev);
      if (next.has(fuel)) next.delete(fuel); else next.add(fuel);
      for (const s of PLANT_STATUSES) {
        if (map.getLayer(`plants-${s}`))
          map.setFilter(`plants-${s}`, makeLayerFilter(s, next, minMw));
      }
      return next;
    });
  }, [minMw]);

  const toggleStatus = useCallback(status => {
    const map = mapRef.current;
    if (!map || !map.getLayer(`plants-${status}`)) return;
    setStatusOff(prev => {
      const next    = new Set(prev);
      const hiding  = !prev.has(status);
      if (hiding) next.add(status); else next.delete(status);
      if (plantsOn)
        map.setLayoutProperty(`plants-${status}`, 'visibility', hiding ? 'none' : 'visible');
      return next;
    });
  }, [plantsOn]);

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
      for (const s of PLANT_STATUSES) {
        if (!map.getLayer(`plants-${s}`)) continue;
        if (!statusOff.has(s))
          map.setLayoutProperty(`plants-${s}`, 'visibility', next ? 'visible' : 'none');
      }
      return next;
    });
  }, [statusOff]);

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
    for (const s of PLANT_STATUSES)
      if (map.getLayer(`plants-${s}`))
        map.setFilter(`plants-${s}`, makeLayerFilter(s, fuelsOff, mw));
  }, [fuelsOff]);

  const handleCircleScale = useCallback(scale => {
    const map = mapRef.current;
    if (!map) return;
    setCircleScale(scale);
    for (const s of PLANT_STATUSES)
      if (map.getLayer(`plants-${s}`))
        map.setPaintProperty(`plants-${s}`, 'circle-radius', plantRadiusExpr(scale));
  }, []);

  // Plant source hot-swap
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource('plants')) return;
    const suffix = plantSource === 'gppd' ? '_gppd' : plantSource === 'gem' ? '_gem' : '';
    const f  = `region_plants_${regionId}${suffix}.geojson`;
    const cf = `region_capacity_${regionId}${suffix}.json`;
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
        if (plantSource === 'gppd') { setGppdAvailable(false); setPlantSource('osm'); }
        if (plantSource === 'gem')  { setGemAvailable(false);  setPlantSource('osm'); }
      });
  }, [plantSource, regionId]);

  // ── Download helpers ──────────────────────────────────────────────────────

  const handleDownloadPlants = useCallback(async () => {
    const suffix = plantSource === 'gppd' ? '_gppd' : plantSource === 'gem' ? '_gem' : '';
    const url = `/data/cache/region_plants_${regionId}${suffix}.geojson`;
    const text = await fetch(url).then(r => r.text());
    downloadBlob(text, `plants_${regionId}${suffix}.geojson`, 'application/geo+json');
  }, [plantSource, regionId]);

  const handleDownloadLines = useCallback(async () => {
    const text = await fetch(`/data/cache/region_lines_${regionId}.geojson`).then(r => r.text());
    downloadBlob(text, `lines_${regionId}.geojson`, 'application/geo+json');
  }, [regionId]);

  const handleDownloadCapacity = useCallback(() => {
    if (!capacity || !region) return;
    const fuels = Object.keys(FUEL_COLORS);
    const header = ['country', 'iso', ...fuels, 'total_mw'];
    const rows = region.countries.map(c => {
      const cd    = capacity.countries?.[c.iso] || {};
      const total = Object.values(cd).reduce((s, v) => s + v, 0);
      return [c.name, c.iso, ...fuels.map(f => (cd[f] || 0).toFixed(1)), total.toFixed(1)];
    });
    downloadBlob([header, ...rows].map(r => r.join(',')).join('\n'),
      `capacity_${regionId}.csv`, 'text/csv');
  }, [capacity, region, regionId]);

  const handleDownloadTariffs = useCallback(() => {
    if (!tariffs || !region) return;
    const rows = region.countries.map(c => {
      const d = tariffs.countries?.[c.iso] || {};
      return [c.name, c.iso,
        d.res != null ? Math.round(d.res * 1000) : '',
        d.ind != null ? Math.round(d.ind * 1000) : ''];
    });
    downloadBlob(['country,iso,residential_usd_mwh,industrial_usd_mwh', ...rows.map(r => r.join(','))].join('\n'),
      `tariffs_${regionId}.csv`, 'text/csv');
  }, [tariffs, region, regionId]);

  const handleDownloadAccess = useCallback(() => {
    if (!access || !region) return;
    const rows = region.countries.map(c => {
      const d = access.countries?.[c.iso] || {};
      return [c.name, c.iso, d.total ?? '', d.urban ?? '', d.rural ?? ''];
    });
    downloadBlob(['country,iso,total_pct,urban_pct,rural_pct', ...rows.map(r => r.join(','))].join('\n'),
      `access_${regionId}.csv`, 'text/csv');
  }, [access, region, regionId]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!region) return <div style={{ padding: 40, color: t.text }}>Loading…</div>;

  const dlBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '1px 4px', borderRadius: 3, color: t.lblMuted,
    fontSize: '0.6rem', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 46px)' }}>
      <LayerPanel
        theme={theme}
        fuelsOff={fuelsOff} statusOff={statusOff}
        kvsOff={kvsOff}
        linesOn={linesOn} plantsOn={plantsOn} subsOn={subsOn}
        minMw={minMw} circleScale={circleScale}
        plantSource={plantSource}
        gppdAvailable={gppdAvailable} gemAvailable={gemAvailable}
        presentFuels={presentFuels}
        onToggleFuel={toggleFuel} onToggleStatus={toggleStatus}
        onToggleKv={toggleKv}
        onToggleLines={toggleLines} onTogglePlants={togglePlants}
        onToggleSubs={toggleSubs}
        onMinMwChange={handleMinMw} onCircleScaleChange={handleCircleScale}
        onSourceChange={setPlantSource}
        onDownloadPlants={handleDownloadPlants}
        onDownloadLines={handleDownloadLines}
      />

      <div ref={containerRef}
        style={{ flex: 1, height: 'calc(100vh - 46px)', backgroundColor: t.bg }} />

      {/* Right panel */}
      <div style={{
        width: 260, height: 'calc(100vh - 46px)', overflowY: 'auto',
        padding: '18px 16px',
        backgroundColor: t.panel, borderLeft: `1px solid ${t.panelBorder}`,
        flexShrink: 0,
      }}>
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
        <div style={{ height: 3, borderRadius: 2, backgroundColor: region.color, width: 36, marginBottom: 20 }} />

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
              }}>{tab}</button>
            );
          })}
        </div>

        {activeTab === 'overview'  && <CapacityChart capacity={capacity} region={region} theme={theme} source={plantSource} tariffs={tariffs} access={access} />}
        {activeTab === 'countries' && <StatsPanel    capacity={capacity} region={region} theme={theme} source={plantSource} tariffs={tariffs} fleetAge={fleetAge} access={access} />}

        {/* Export section */}
        <div style={{ marginTop: 20, borderTop: `1px solid ${t.panelBorder}`, paddingTop: 12 }}>
          <span style={{ fontSize: '0.47rem', letterSpacing: '2px', fontWeight: 700, color: t.lblMuted, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
            Export Data
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { label: 'Plants GeoJSON',  handler: handleDownloadPlants },
              { label: 'Lines GeoJSON',   handler: handleDownloadLines  },
              { label: 'Capacity CSV',    handler: handleDownloadCapacity },
              tariffs && { label: 'Tariffs CSV', handler: handleDownloadTariffs },
              access  && { label: 'Access CSV',  handler: handleDownloadAccess  },
            ].filter(Boolean).map(({ label, handler }) => (
              <button key={label} onClick={handler} style={{
                ...dlBtn,
                border: `1px solid ${t.panelBorder}`,
                padding: '4px 6px', justifyContent: 'center',
                fontSize: '0.52rem', color: t.muted,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.47rem', color: t.lblMuted, marginTop: 6, fontStyle: 'italic' }}>
            Source: {plantSource.toUpperCase()} · {region.name}
          </p>
        </div>
      </div>
    </div>
  );
}
