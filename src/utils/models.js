// Only eapp and blacksea are active models
export const MODEL_META = {
  eapp:     { label: 'East Africa Power Pool', countries: ['BDI','DJI','COD','EGY','ETH','KEN','LBY','SOM','RWA','SSD','SDN','TZA','UGA'], type: 'regional' },
  blacksea: { label: 'Black Sea',              countries: ['GEO','UKR','MDA','ARM','AZE','BGR','ROU','TUR'],                               type: 'regional' },
}

// EPM zone name → ISO-A3
export const ZONE_TO_ISO = {
  // EAPP — country-level zones
  Burundi: 'BDI', Djibouti: 'DJI', Drc_E: 'COD', Egypt: 'EGY',
  Ethiopia: 'ETH', Kenya: 'KEN', Libya: 'LBY', Rwanda: 'RWA',
  SouthSudan: 'SSD', Sudan: 'SDN', Tanzania: 'TZA', Uganda: 'UGA',
  Mogadishu: 'SOM', Somaliland: 'SOM', SomaliaROC: 'SOM',

  // Black Sea — country-level zone names
  Romania: 'ROU', Bulgaria: 'BGR', Georgia: 'GEO',
  Ukraine: 'UKR', Moldova: 'MDA', Armenia: 'ARM', Azerbaijan: 'AZE',
  Turkey: 'TUR', Turkiye: 'TUR',

  // Black Sea — sub-national Turkey zones
  WestMed: 'TUR', EastMed: 'TUR', WestAna: 'TUR', EastAna: 'TUR',
  EastBlackSea: 'TUR', WestBlackSea: 'TUR', NorthAna: 'TUR', SouthAna: 'TUR',
  Istanbul: 'TUR', Marmara: 'TUR', Aegean: 'TUR', CentralAna: 'TUR',

  // Black Sea — sub-national Romania zones (common EPM zone names)
  North_Romania: 'ROU', South_Romania: 'ROU', West_Romania: 'ROU', East_Romania: 'ROU',
  Transylvania: 'ROU', Muntenia: 'ROU', Moldova_RO: 'ROU', Dobrogea: 'ROU',
}

// Rough bounding boxes [sw, ne] per ISO-A3
const BOUNDS = {
  // Black Sea
  ROU: [[22,43.5],[30,48.5]], GEO: [[39.5,41],[47,44.2]], TUR: [[25.5,35.5],[44.5,42]],
  BGR: [[22,41],[28.5,44.2]], MDA: [[26.5,45.5],[30.2,48.5]], ARM: [[43.4,38.8],[46.6,41.3]],
  AZE: [[44.5,37.5],[51,41.9]], UKR: [[22,44],[40,52.5]],
  // EAPP
  BDI: [[29,-4.5],[30.9,-2.3]], DJI: [[41.7,10.9],[43.4,12.7]], COD: [[12.2,-13.5],[31.3,5.4]],
  EGY: [[24.7,22],[37.1,31.7]], ETH: [[33,3.4],[48,15]], KEN: [[33.9,-4.7],[42,5]],
  LBY: [[9.3,19.5],[25.2,33.2]], SOM: [[40.9,-1.7],[51.4,12]], RWA: [[28.8,-2.9],[30.9,-1]],
  SSD: [[23.4,3.5],[35.9,12.2]], SDN: [[21.8,8.7],[38.6,22.2]], TZA: [[29.3,-11.7],[40.4,-1]],
  UGA: [[29.5,-1.5],[35,4.2]],
}

export function getModelBounds(countries) {
  const b = countries.map(iso => BOUNDS[iso]).filter(Boolean)
  if (!b.length) return null
  return [
    [Math.min(...b.map(x => x[0][0])), Math.min(...b.map(x => x[0][1]))],
    [Math.max(...b.map(x => x[1][0])), Math.max(...b.map(x => x[1][1]))],
  ]
}

export function getMetaForModel(modelName) {
  return MODEL_META[modelName] ?? { label: modelName, countries: [], type: 'regional' }
}

/** ISO → first matching zone name (for map click → data filter) */
export function buildIsoZoneMap(zoneNames) {
  const map = {}
  zoneNames.forEach(z => {
    const iso = ZONE_TO_ISO[z]
    if (iso && !map[iso]) map[iso] = z
  })
  return map
}

/** ISO → all zone names (for multi-zone countries like Somalia in EAPP) */
export function buildIsoToZonesMap(zoneNames) {
  const map = {}
  zoneNames.forEach(z => {
    const iso = ZONE_TO_ISO[z]
    if (!iso) return
    if (!map[iso]) map[iso] = []
    map[iso].push(z)
  })
  return map
}

/** Given a NE50 GeoJSON feature set, compute fitBounds for a single ISO */
export function computeIsoBounds(iso, geojson) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  if (!geojson) return BOUNDS[iso] ? [[BOUNDS[iso][0][0], BOUNDS[iso][0][1]], [BOUNDS[iso][1][0], BOUNDS[iso][1][1]]] : null
  for (const f of geojson.features) {
    const fiso = f.properties.ADM0_A3 || f.properties.ISO_A3
    if (fiso !== iso) continue
    const geom = f.geometry
    const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flatMap(p => p)
    for (const ring of rings) for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
    }
  }
  if (!isFinite(minLon)) return BOUNDS[iso] ?? null
  return [[minLon - 0.5, minLat - 0.5], [maxLon + 0.5, maxLat + 0.5]]
}
