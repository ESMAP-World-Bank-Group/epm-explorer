export const MODEL_META = {
  // Black Sea
  romania:      { label: 'Romania',        countries: ['ROU'],                                                         type: 'national' },
  georgia:      { label: 'Georgia',         countries: ['GEO'],                                                         type: 'national' },
  blacksea:     { label: 'Black Sea',       countries: ['GEO','UKR','MDA','ARM','AZE','BGR','ROU','TUR'],               type: 'regional' },
  turkiye:      { label: 'Türkiye',         countries: ['TUR'],                                                         type: 'national' },
  ukraine:      { label: 'Ukraine',         countries: ['UKR'],                                                         type: 'national' },
  moldova:      { label: 'Moldova',         countries: ['MDA'],                                                         type: 'national' },
  armenia:      { label: 'Armenia',         countries: ['ARM'],                                                         type: 'national' },
  azerbaijan:   { label: 'Azerbaijan',      countries: ['AZE'],                                                         type: 'national' },
  bulgaria:     { label: 'Bulgaria',        countries: ['BGR'],                                                         type: 'national' },
  // East Africa
  eapp:         { label: 'East Africa',     countries: ['BDI','DJI','COD','EGY','ETH','KEN','LBY','SOM','RWA','SSD','SDN','TZA','UGA'], type: 'regional' },
  // West Africa
  wapp:         { label: 'West Africa',     countries: ['SEN','GMB','GNB','GIN','SLE','LBR','CIV','GHA','TGO','BEN','NGA','NER','BFA','MLI','MRT'],   type: 'regional' },
  // Southern Africa
  sapp:         { label: 'Southern Africa', countries: ['ZAF','ZWE','ZMB','MOZ','BWA','NAM','LSO','SWZ','MWI','AGO','TZA','COD'],       type: 'regional' },
  sapp_new:     { label: 'Southern Africa', countries: ['ZAF','ZWE','ZMB','MOZ','BWA','NAM','LSO','SWZ','MWI','AGO','TZA','COD'],       type: 'regional' },
  // Central Asia
  capp:         { label: 'Central Asia',    countries: ['KAZ','KGZ','TJK','TKM','UZB'],                                type: 'regional' },
  // Pan Arab
  pan_arab:     { label: 'Pan Arab',        countries: ['MAR','DZA','TUN','LBY','EGY','JOR','IRQ','SYR','LBN','SAU','ARE','OMN','YEM','KWT','QAT','BHR'], type: 'regional' },
  // National
  kenya:        { label: 'Kenya',           countries: ['KEN'],  type: 'national' },
  ethiopia:     { label: 'Ethiopia',        countries: ['ETH'],  type: 'national' },
  tanzania:     { label: 'Tanzania',        countries: ['TZA'],  type: 'national' },
  nigeria:      { label: 'Nigeria',         countries: ['NGA'],  type: 'national' },
  ghana:        { label: 'Ghana',           countries: ['GHA'],  type: 'national' },
  serbia:       { label: 'Serbia',          countries: ['SRB'],  type: 'national' },
  bosnia:       { label: 'West Balkans',    countries: ['BIH','SRB','MNE','MKD','ALB','XKX'], type: 'regional' },
}

// EPM zone name → ISO-A3 (for map highlighting and click-to-zone)
export const ZONE_TO_ISO = {
  // EAPP
  Burundi: 'BDI', Djibouti: 'DJI', Drc_E: 'COD', Egypt: 'EGY',
  Ethiopia: 'ETH', Kenya: 'KEN', Libya: 'LBY', Rwanda: 'RWA',
  SouthSudan: 'SSD', Sudan: 'SDN', Tanzania: 'TZA', Uganda: 'UGA',
  Mogadishu: 'SOM', Somaliland: 'SOM', SomaliaROC: 'SOM',
  // Black Sea
  Romania: 'ROU', Bulgaria: 'BGR', Turkey: 'TUR', Turkiye: 'TUR',
  Georgia: 'GEO', Ukraine: 'UKR', Moldova: 'MDA', Armenia: 'ARM',
  Azerbaijan: 'AZE',
  // WAPP
  Senegal: 'SEN', Gambia: 'GMB', Guinea: 'GIN', Mali: 'MLI',
  Mauritania: 'MRT', Niger: 'NER', Nigeria: 'NGA', Ghana: 'GHA',
  Togo: 'TGO', Benin: 'BEN', BurkinaFaso: 'BFA', CoteDIvoire: 'CIV',
  Liberia: 'LBR', SierraLeone: 'SLE', GuineaBissau: 'GNB',
  // SAPP
  SouthAfrica: 'ZAF', South_Africa: 'ZAF', Zimbabwe: 'ZWE', Zambia: 'ZMB',
  Mozambique: 'MOZ', Botswana: 'BWA', Namibia: 'NAM', Lesotho: 'LSO',
  Eswatini: 'SWZ', Malawi: 'MWI', Angola: 'AGO', DRC: 'COD',
  // CAPP
  Kazakhstan: 'KAZ', Kyrgyzstan: 'KGZ', Tajikistan: 'TJK',
  Turkmenistan: 'TKM', Uzbekistan: 'UZB',
  // Pan Arab
  Morocco: 'MAR', Algeria: 'DZA', Tunisia: 'TUN', Jordan: 'JOR',
  Iraq: 'IRQ', Syria: 'SYR', Lebanon: 'LBN', Saudi_Arabia: 'SAU',
  UAE: 'ARE', Oman: 'OMN', Yemen: 'YEM', Kuwait: 'KWT', Qatar: 'QAT',
  Bahrain: 'BHR',
}

// Rough bounding boxes [sw, ne] per ISO-A3
const BOUNDS = {
  ROU: [[22,43.5],[30,48.5]], GEO: [[39.5,41],[47,44.2]], TUR: [[25.5,35.5],[44.5,42]],
  BGR: [[22,41],[28.5,44.2]], MDA: [[26.5,45.5],[30.2,48.5]], ARM: [[43.4,38.8],[46.6,41.3]],
  AZE: [[44.5,37.5],[51,41.9]], UKR: [[22,44],[40,52.5]], SRB: [[18.8,42.2],[22.9,46.2]],
  BDI: [[29,-4.5],[30.9,-2.3]], DJI: [[41.7,10.9],[43.4,12.7]], COD: [[12.2,-13.5],[31.3,5.4]],
  EGY: [[24.7,22],[37.1,31.7]], ETH: [[33,3.4],[48,15]], KEN: [[33.9,-4.7],[42,5]],
  LBY: [[9.3,19.5],[25.2,33.2]], SOM: [[40.9,-1.7],[51.4,12]], RWA: [[28.8,-2.9],[30.9,-1]],
  SSD: [[23.4,3.5],[35.9,12.2]], SDN: [[21.8,8.7],[38.6,22.2]], TZA: [[29.3,-11.7],[40.4,-1]],
  UGA: [[29.5,-1.5],[35,4.2]],
  SEN: [[-17.5,12.3],[-11.4,16.7]], NGA: [[2.7,4.3],[14.7,13.9]], GHA: [[-3.3,4.7],[1.2,11.2]],
  MLI: [[-4.2,10.1],[4.2,20]], CIV: [[-8.6,4.3],[-2.5,10.7]], BFA: [[-5.5,9.4],[2.4,15.1]],
  NER: [[0.2,11.7],[15.9,23.5]], MRT: [[-17.1,14.7],[-4.8,27.3]], GIN: [[-15.1,7.2],[-7.6,12.7]],
  ZAF: [[16.5,-34.8],[33,-22.1]], ZWE: [[25.2,-22.4],[33.1,-15.6]], ZMB: [[21.9,-18.1],[33.7,-8.2]],
  MOZ: [[32,-26.9],[40.8,-10.5]], BWA: [[19.9,-26.9],[29.4,-17.8]], NAM: [[11.7,-29],[25.3,-16.9]],
  MWI: [[32.7,-17.1],[35.9,-9.4]], AGO: [[11.7,-18],[24.1,-4.4]],
  KAZ: [[50.3,40.6],[87.4,55.4]], KGZ: [[69.3,39.2],[80.3,43.3]], TJK: [[67.3,36.7],[75.2,41.1]],
  TKM: [[52.4,35.1],[66.7,42.8]], UZB: [[55.9,37.2],[73.2,45.6]],
  MAR: [[-13.2,27.7],[(-1),35.9]], DZA: [[-8.7,18.9],[12,37.1]], TUN: [[7.5,30.2],[11.6,37.5]],
  JOR: [[34.9,29.2],[39.3,33.4]], IRQ: [[38.8,29.1],[48.6,37.4]], SAU: [[34.6,16.4],[55.6,32.2]],
  ARE: [[51.6,22.6],[56.4,26.1]], OMN: [[52,16.6],[60,26.4]], YEM: [[42.5,12],[54.5,19]],
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

// Build ISO → zone name map for a list of zone names
export function buildIsoZoneMap(zoneNames) {
  const map = {}
  zoneNames.forEach(z => {
    const iso = ZONE_TO_ISO[z]
    if (iso && !map[iso]) map[iso] = z  // first zone wins for a given ISO
  })
  return map
}
