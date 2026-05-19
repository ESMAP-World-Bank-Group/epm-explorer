import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useTheme } from '../App';
import { getT, mapStyle, FUEL_COLORS, VOLTAGE_BRACKETS, HIGHLIGHT, plantRadiusExpr } from '../constants';
import LayerPanel from '../components/LayerPanel';
import CountryOverview from '../components/CountryOverview';
import REResourcesTab from '../components/tabs/REResourcesTab';
import LoadTab from '../components/tabs/LoadTab';
import ZoningTab from '../components/tabs/ZoningTab';
import { fetchResourceGrid, SOLAR_COLOR_EXPR, WIND_COLOR_EXPR } from '../utils/nasaPower';

function downloadBlob(content, filename, type = 'application/octet-stream') {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  const [plantSource,        setPlantSource]        = useState('osm');
  const [gppdAvailable,      setGppdAvailable]      = useState(null);
  const [capacity,           setCapacity]           = useState(null);
  const [fleetAge,           setFleetAge]           = useState(null);
  const [tariffs,            setTariffs]            = useState(null);
  const [access,             setAccess]             = useState(null);
  const [filteredPlantsData, setFilteredPlantsData] = useState(null);
  const [filteredLinesData,  setFilteredLinesData]  = useState(null);
  const [countryCenter,      setCountryCenter]      = useState(null);
  const [activeTab,          setActiveTab]          = useState('overview');
  const [resourceOverlay,    setResourceOverlay]    = useState(null);
  const [mapReady,           setMapReady]           = useState(false);
  const countryFeatureRef  = useRef(null);
  const countryBoundsRef   = useRef(null); // { south, north, west, east }
  const resourceCacheRef   = useRef({});

  // Static data — fetch once
  useEffect(() => {
    fetch('/data/tariffs.json').then(r => r.json()).then(setTariffs).catch(() => {});
    fetch('/data/access.json').then(r => r.json()).then(setAccess).catch(() => {});
  }, []);

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
    setPlantSource('osm'); setGppdAvailable(null); setCountryCenter(null);
    setResourceOverlay(null); setMapReady(false);
    countryFeatureRef.current = null; countryBoundsRef.current = null; resourceCacheRef.current = {};
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
      if (bounds) {
        map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 9 });
        const cx = (bounds[0][0] + bounds[1][0]) / 2;
        const cy = (bounds[0][1] + bounds[1][1]) / 2;
        setCountryCenter({ lon: cx, lat: cy });
        countryBoundsRef.current = {
          south: bounds[0][1], north: bounds[1][1],
          west:  bounds[0][0], east:  bounds[1][0],
        };
      }

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

      setFilteredPlantsData(filteredPlants);
      setFilteredLinesData(filteredLines);

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
            'line-opacity': theme === 'dark' ? 0.88 : 0.65,
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

      // Resource grid (NASA POWER) — data loaded on demand
      map.addSource('resource-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'resource-grid',
        type: 'fill',
        source: 'resource-grid',
        layout: { visibility: 'none' },
        paint: { 'fill-color': SOLAR_COLOR_EXPR, 'fill-opacity': 0.82 },
      }, 'country-border');

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

      setMapReady(true);
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
        setFilteredPlantsData(filtered);
        const fuels = new Set(filtered.features.map(f => f.properties.fuel).filter(f => FUEL_COLORS[f]));
        setPresentFuels(fuels);
      })
      .catch(() => {
        if (plantSource !== 'osm') { setGppdAvailable(false); setPlantSource('osm'); }
      });
  }, [plantSource, info]);

  // Capacity summary for right panel
  useEffect(() => {
    if (!info) return;
    setCapacity(null);
    const cf = plantSource === 'gppd'
      ? `/data/cache/region_capacity_${info.region.id}_gppd.json`
      : `/data/cache/region_capacity_${info.region.id}.json`;
    fetch(cf).then(r => r.json()).then(setCapacity).catch(() => {});
  }, [info, plantSource]);

  // Fleet age — GPPD only
  useEffect(() => {
    setFleetAge(null);
    if (!info || plantSource !== 'gppd') return;
    fetch(`/data/cache/region_age_${info.region.id}_gppd.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setFleetAge)
      .catch(() => setFleetAge(null));
  }, [plantSource, info]);

  // ── Resource overlay (NASA POWER granular grid) ───────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (!map.getLayer('resource-grid') || !map.getSource('resource-grid')) return;

    if (resourceOverlay === null) {
      map.setLayoutProperty('resource-grid', 'visibility', 'none');
      return;
    }

    map.setPaintProperty('resource-grid', 'fill-color',
      resourceOverlay === 'solar' ? SOLAR_COLOR_EXPR : WIND_COLOR_EXPR);
    map.setLayoutProperty('resource-grid', 'visibility', 'visible');

    if (resourceCacheRef.current[resourceOverlay]) {
      map.getSource('resource-grid').setData(resourceCacheRef.current[resourceOverlay]);
      return;
    }

    const b = countryBoundsRef.current;
    if (!b) return;

    fetchResourceGrid(b.south, b.north, b.west, b.east, resourceOverlay)
      .then(grid => {
        resourceCacheRef.current[resourceOverlay] = grid;
        if (mapRef.current?.getSource('resource-grid'))
          mapRef.current.getSource('resource-grid').setData(grid);
      });
  }, [resourceOverlay, mapReady]);

  // ── Download handlers ────────────────────────────────────────────────────

  const handleDownloadPlants = useCallback((format = 'geojson') => {
    if (!filteredPlantsData) return;
    const suffix = plantSource === 'gppd' ? '_gppd' : plantSource === 'gem' ? '_gem' : '';
    if (format === 'csv') {
      const header = 'name,fuel,mw,country,status,lat,lon,source';
      const rows = filteredPlantsData.features.map(f => {
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        return [
          `"${(p.name || '').replace(/"/g, '""')}"`,
          p.fuel || '', p.mw || '', p.country || '',
          p.status || 'operating', lat.toFixed(5), lon.toFixed(5),
          plantSource,
        ].join(',');
      });
      downloadBlob([header, ...rows].join('\n'), `plants_${iso}${suffix}.csv`, 'text/csv');
    } else {
      downloadBlob(JSON.stringify(filteredPlantsData), `plants_${iso}.geojson`, 'application/geo+json');
    }
  }, [filteredPlantsData, iso, plantSource]);

  const handleDownloadLines = useCallback((format = 'geojson') => {
    if (!filteredLinesData) return;
    if (format === 'csv') {
      const header = 'id,voltage_kv,geometry_wkt';
      const rows = filteredLinesData.features.map((f, i) => {
        const vkv = f.properties.v ? Math.round(f.properties.v / 1000) : '';
        const wkt = `LINESTRING(${f.geometry.coordinates.map(([x, y]) => `${x} ${y}`).join(', ')})`;
        return `${i},${vkv},"${wkt}"`;
      });
      downloadBlob([header, ...rows].join('\n'), `lines_${iso}.csv`, 'text/csv');
    } else {
      downloadBlob(JSON.stringify(filteredLinesData), `lines_${iso}.geojson`, 'application/geo+json');
    }
  }, [filteredLinesData, iso]);

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
        onDownloadPlants={handleDownloadPlants}
        onDownloadLines={handleDownloadLines}
        resourceOverlay={resourceOverlay}
        onToggleResource={setResourceOverlay}
      />

      <div ref={containerRef} style={{ flex: 1, height: 'calc(100vh - 46px)', backgroundColor: t.bg }} />

      {/* Right panel */}
      <div style={{
        width: 268, height: 'calc(100vh - 46px)', overflowY: 'auto',
        backgroundColor: t.panel,
        borderLeft: `1px solid ${t.panelBorder}`,
        flexShrink: 0, display: 'flex', flexDirection: 'column',
      }}>
        {/* ── Fixed header ── */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            <Link to="/" style={{ fontSize: '0.68rem', color: t.muted }}>World</Link>
            <span style={{ color: t.panelBorder, fontSize: '0.68rem' }}>/</span>
            <Link to={`/region/${region.id}`} style={{ fontSize: '0.68rem', color: t.muted }}>{region.name}</Link>
            <span style={{ color: t.panelBorder, fontSize: '0.68rem' }}>/</span>
            <span style={{ fontSize: '0.68rem', color: t.lbl, fontWeight: 600 }}>{country.name}</span>
          </div>

          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: t.text, marginBottom: 6 }}>
            {country.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: '0.68rem', fontWeight: 600, color: 'white',
              backgroundColor: region.color, borderRadius: 4,
              padding: '2px 8px', display: 'inline-block',
            }}>
              {iso}
            </span>
            <div style={{ height: 3, width: 24, borderRadius: 2, backgroundColor: region.color }} />
          </div>

          {/* ── Tab buttons ── */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 0 }}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 're',       label: 'RE' },
              { id: 'load',     label: 'Load' },
              { id: 'zoning',   label: 'Zones' },
            ].map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  flex: 1, fontSize: '0.48rem', letterSpacing: '0.5px',
                  textTransform: 'uppercase', fontFamily: 'inherit',
                  padding: '4px 0', borderRadius: '3px 3px 0 0',
                  cursor: 'pointer',
                  border: `1px solid ${active ? t.panelBorder : 'rgba(128,160,192,0.18)'}`,
                  borderBottom: active ? `1px solid ${t.panel}` : `1px solid ${t.panelBorder}`,
                  backgroundColor: active ? t.panel : 'transparent',
                  color: active ? t.lbl : t.lblMuted,
                  fontWeight: active ? 700 : 400,
                  position: 'relative', zIndex: active ? 2 : 1,
                }}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ height: 1, backgroundColor: t.panelBorder, marginTop: -1, position: 'relative', zIndex: 0 }} />
        </div>

        {/* ── Scrollable tab content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

          {activeTab === 'overview' && (
            <>
              <CountryOverview
                iso={iso}
                region={region}
                capacity={capacity}
                fleetAge={fleetAge}
                tariffs={tariffs}
                access={access}
                theme={theme}
                source={plantSource}
              />
              {/* Export */}
              <div style={{ marginTop: 16, borderTop: `1px solid ${t.panelBorder}`, paddingTop: 12 }}>
                <span style={{ fontSize: '0.47rem', letterSpacing: '2px', fontWeight: 700, color: t.lblMuted, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                  Export Data
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {[
                    { label: 'Plants GeoJSON', fn: () => handleDownloadPlants('geojson') },
                    { label: 'Plants CSV',     fn: () => handleDownloadPlants('csv') },
                    { label: 'Lines GeoJSON',  fn: () => handleDownloadLines('geojson') },
                    { label: 'Lines CSV',      fn: () => handleDownloadLines('csv') },
                  ].map(({ label, fn }) => (
                    <button key={label} onClick={fn} style={{
                      background: 'none', border: `1px solid ${t.panelBorder}`,
                      borderRadius: 3, padding: '4px 6px', cursor: 'pointer',
                      fontSize: '0.52rem', color: t.muted, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
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
                  Source: {plantSource.toUpperCase()} · {country.name} only
                </p>
              </div>
            </>
          )}

          {activeTab === 're' && (
            <REResourcesTab center={countryCenter} theme={theme} />
          )}

          {activeTab === 'load' && (
            <LoadTab iso={iso} theme={theme} />
          )}

          {activeTab === 'zoning' && (
            <ZoningTab iso={iso} theme={theme} />
          )}

          <div style={{ borderTop: `1px solid ${t.hr}`, paddingTop: 12, marginTop: 20 }}>
            <Link
              to={`/region/${region.id}`}
              style={{ fontSize: '0.72rem', color: region.color, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              ← Back to {region.name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
