// Static metadata for known EPM model names.
// Keys match the model part of branch names (e.g. 'romania' from 'romania_2026').
export const MODEL_META = {
  // Black Sea region
  romania:    { label: 'Romania',        countries: ['ROU'],                                                    type: 'national'  },
  georgia:    { label: 'Georgia',        countries: ['GEO'],                                                    type: 'national'  },
  blacksea:   { label: 'Black Sea',      countries: ['GEO', 'UKR', 'MDA', 'ARM', 'AZE', 'BGR', 'ROU', 'TUR'], type: 'regional'  },
  turkiye:    { label: 'Türkiye',        countries: ['TUR'],                                                    type: 'national'  },
  ukraine:    { label: 'Ukraine',        countries: ['UKR'],                                                    type: 'national'  },
  moldova:    { label: 'Moldova',        countries: ['MDA'],                                                    type: 'national'  },
  armenia:    { label: 'Armenia',        countries: ['ARM'],                                                    type: 'national'  },
  azerbaijan: { label: 'Azerbaijan',     countries: ['AZE'],                                                    type: 'national'  },
  bulgaria:   { label: 'Bulgaria',       countries: ['BGR'],                                                    type: 'national'  },
  // East Africa Power Pool
  eapp:       { label: 'East Africa',    countries: ['BDI', 'DJI', 'COD', 'EGY', 'ETH', 'KEN', 'LBY', 'SOM', 'RWA', 'SSD', 'SDN', 'TZA', 'UGA'], type: 'regional' },
  kenya:      { label: 'Kenya',          countries: ['KEN'],                                                    type: 'national'  },
  ethiopia:   { label: 'Ethiopia',       countries: ['ETH'],                                                    type: 'national'  },
  tanzania:   { label: 'Tanzania',       countries: ['TZA'],                                                    type: 'national'  },
  uganda:     { label: 'Uganda',         countries: ['UGA'],                                                    type: 'national'  },
  // Southern Africa
  sapp:       { label: 'Southern Africa', countries: ['ZAF', 'ZWE', 'ZMB', 'MOZ', 'BWA', 'NAM', 'LSO', 'SWZ', 'MWI', 'AGO', 'TZA'], type: 'regional' },
  // Other
  nigeria:    { label: 'Nigeria',        countries: ['NGA'],                                                    type: 'national'  },
  ghana:      { label: 'Ghana',          countries: ['GHA'],                                                    type: 'national'  },
}

// Rough bounding boxes [sw, ne] by ISO-A3 — used for map auto-zoom
const BOUNDS = {
  // Black Sea region
  ROU: [[22.0, 43.5], [30.0, 48.5]],
  GEO: [[39.5, 41.0], [47.0, 44.2]],
  TUR: [[25.5, 35.5], [44.5, 42.0]],
  BGR: [[22.0, 41.0], [28.5, 44.2]],
  MDA: [[26.5, 45.5], [30.2, 48.5]],
  ARM: [[43.4, 38.8], [46.6, 41.3]],
  AZE: [[44.5, 37.5], [51.0, 41.9]],
  UKR: [[22.0, 44.0], [40.0, 52.5]],
  // East Africa
  BDI: [[29.0, -4.5], [30.9, -2.3]],
  DJI: [[41.7,  10.9], [43.4, 12.7]],
  COD: [[12.2, -13.5], [31.3,  5.4]],
  EGY: [[24.7,  22.0], [37.1, 31.7]],
  ETH: [[33.0,   3.4], [48.0, 15.0]],
  KEN: [[33.9,  -4.7], [42.0,  5.0]],
  LBY: [[9.3,  19.5], [25.2, 33.2]],
  SOM: [[40.9,  -1.7], [51.4, 12.0]],
  RWA: [[28.8,  -2.9], [30.9, -1.0]],
  SSD: [[23.4,   3.5], [35.9, 12.2]],
  SDN: [[21.8,   8.7], [38.6, 22.2]],
  TZA: [[29.3, -11.7], [40.4, -1.0]],
  UGA: [[29.5,  -1.5], [35.0,  4.2]],
  // Southern Africa
  ZAF: [[16.5, -34.8], [33.0, -22.1]],
  ZWE: [[25.2, -22.4], [33.1, -15.6]],
  ZMB: [[21.9, -18.1], [33.7,  -8.2]],
  MOZ: [[32.0, -26.9], [40.8,  -10.5]],
  BWA: [[19.9, -26.9], [29.4, -17.8]],
  NAM: [[11.7, -29.0], [25.3, -16.9]],
  MWI: [[32.7, -17.1], [35.9,  -9.4]],
  AGO: [[11.7, -18.0], [24.1,  -4.4]],
  // West Africa
  NGA: [[2.7,   4.3], [14.7, 13.9]],
  GHA: [[-3.3,   4.7], [1.2, 11.2]],
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
  return MODEL_META[modelName] ?? { label: modelName, countries: [], type: 'national' }
}
