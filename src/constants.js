export const THEMES = {
  fog: {
    isDark: false, label: 'Fog', swatch: '#D8E2EC',
    cartoBg: 'light_all', cartoLabels: 'light_only_labels',
    bg: '#EEF3F7', land: '#D8E2EC',
    panel: '#FFFFFF', panelBorder: '#DEE5EE',
    text: '#2C3E52', muted: '#7A9AB0',
    hr: '#E8EDF2', cardBg: '#F5F7FA', cardBorder: '#DEE5EE',
    lbl: '#2C3E52', lblMuted: '#7A9AB0', lblRow: '#3A5A78',
    worldBdr: 'rgba(160,180,200,0.7)', worldBdrW: 0.4,
    navBg: '#F5F7FA',
    highlight: { fill: 'rgba(95,130,170,1)', border: 'rgba(65,100,145,0.75)', borderW: 1.0 },
  },
  slate: {
    isDark: true, label: 'Slate', swatch: '#0E1B2E',
    cartoBg: 'dark_all', cartoLabels: 'dark_only_labels',
    bg: '#060B17', land: '#0E1B2E',
    panel: '#0A1828', panelBorder: '#1A3A54',
    text: '#C8DFF0', muted: '#5A8AAA',
    hr: '#1A3A54', cardBg: '#060B17', cardBorder: '#1A3A54',
    lbl: '#A8C8E0', lblMuted: '#4A7A9A', lblRow: '#8BBDD8',
    worldBdr: 'rgba(55,100,155,0.5)', worldBdrW: 0.5,
    navBg: '#070D1B',
    highlight: { fill: 'rgba(55,110,185,1)', border: 'rgba(130,200,255,0.75)', borderW: 1.2 },
  },
  ink: {
    isDark: true, label: 'Ink', swatch: '#252830',
    cartoBg: 'dark_all', cartoLabels: 'dark_only_labels',
    bg: '#0D0E12', land: '#16181F',
    panel: '#111318', panelBorder: '#252830',
    text: '#E8EAF0', muted: '#6B6E82',
    hr: '#252830', cardBg: '#0D0E12', cardBorder: '#252830',
    lbl: '#C8CBD8', lblMuted: '#555870', lblRow: '#A8ABB8',
    worldBdr: 'rgba(80,85,110,0.5)', worldBdrW: 0.5,
    navBg: '#0A0B0F',
    highlight: { fill: 'rgba(120,130,200,1)', border: 'rgba(200,200,200,0.72)', borderW: 1.2 },
  },
  paper: {
    isDark: false, label: 'Paper', swatch: '#E8E0CC',
    cartoBg: 'light_all', cartoLabels: 'light_only_labels',
    bg: '#F5F0E8', land: '#E8E0CC',
    panel: '#FBF8F2', panelBorder: '#DDD5C4',
    text: '#2A2218', muted: '#8A7A64',
    hr: '#DDD5C4', cardBg: '#F5F0E8', cardBorder: '#DDD5C4',
    lbl: '#2A2218', lblMuted: '#8A7A64', lblRow: '#4A3828',
    worldBdr: 'rgba(140,120,90,0.55)', worldBdrW: 0.4,
    navBg: '#F0E8D8',
    highlight: { fill: 'rgba(160,120,70,1)', border: 'rgba(120,85,40,0.75)', borderW: 1.0 },
  },
  forest: {
    isDark: true, label: 'Forest', swatch: '#0F2014',
    cartoBg: 'dark_all', cartoLabels: 'dark_only_labels',
    bg: '#08120A', land: '#0F2014',
    panel: '#0C1810', panelBorder: '#1C3824',
    text: '#C0DCC4', muted: '#508058',
    hr: '#1C3824', cardBg: '#08120A', cardBorder: '#1C3824',
    lbl: '#A0C8A8', lblMuted: '#407048', lblRow: '#80B090',
    worldBdr: 'rgba(40,100,55,0.55)', worldBdrW: 0.5,
    navBg: '#060E08',
    highlight: { fill: 'rgba(60,180,90,1)', border: 'rgba(100,220,130,0.75)', borderW: 1.2 },
  },
  dusk: {
    isDark: true, label: 'Dusk', swatch: '#1A1530',
    cartoBg: 'dark_all', cartoLabels: 'dark_only_labels',
    bg: '#0E0A1A', land: '#1A1530',
    panel: '#120E20', panelBorder: '#2A2448',
    text: '#D8D4F0', muted: '#7870A0',
    hr: '#2A2448', cardBg: '#0E0A1A', cardBorder: '#2A2448',
    lbl: '#B8B4E0', lblMuted: '#605890', lblRow: '#9890C8',
    worldBdr: 'rgba(80,70,130,0.55)', worldBdrW: 0.5,
    navBg: '#0A0814',
    highlight: { fill: 'rgba(140,100,220,1)', border: 'rgba(180,150,255,0.75)', borderW: 1.2 },
  },
}

export const THEME_LIST = ['fog', 'paper', 'slate', 'ink', 'forest', 'dusk']

export function getT(theme) {
  return THEMES[theme] || THEMES.ink
}

export function mapStyle(theme) {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': getT(theme).bg } }],
  }
}

export function swapBasemap(map, basemap, theme) {
  if (!map || !map.getLayer('land')) return
  if (map.getLayer('basemap-raster')) map.removeLayer('basemap-raster')
  if (map.getSource('basemap-tiles')) map.removeSource('basemap-tiles')
  const t = getT(theme)

  if (basemap === 'labeled') {
    map.addSource('basemap-tiles', {
      type: 'raster',
      tiles: ['a','b','c','d'].map(s => `https://${s}.basemaps.cartocdn.com/${t.cartoBg}/{z}/{x}/{y}@2x.png`),
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    })
    map.addLayer({ id: 'basemap-raster', type: 'raster', source: 'basemap-tiles' }, 'land')
  } else if (basemap === 'satellite') {
    map.addSource('basemap-tiles', {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
    })
    map.addLayer({ id: 'basemap-raster', type: 'raster', source: 'basemap-tiles' }, 'land')
  }

  if (map.getLayer('land'))
    map.setPaintProperty('land', 'fill-opacity', basemap === 'minimal' ? 1 : 0)
  if (map.getLayer('borders'))
    map.setPaintProperty('borders', 'line-opacity', basemap === 'satellite' ? 0.45 : 1)
}

export function toggleSatLabels(map, show, theme) {
  if (!map) return
  if (map.getLayer('sat-labels')) map.removeLayer('sat-labels')
  if (map.getSource('sat-labels-tiles')) map.removeSource('sat-labels-tiles')
  if (!show) return
  const t = getT(theme)
  map.addSource('sat-labels-tiles', {
    type: 'raster',
    tiles: ['a','b','c','d'].map(s => `https://${s}.basemaps.cartocdn.com/${t.cartoLabels}/{z}/{x}/{y}@2x.png`),
    tileSize: 256,
  })
  map.addLayer({ id: 'sat-labels', type: 'raster', source: 'sat-labels-tiles', paint: { 'raster-opacity': 0.9 } })
}
