export const FUEL_COLORS = {
  solar:      '#FFD43B',
  wind:       '#90AAC4',   // grey-blue, distinct from hydro
  hydro:      '#4DABF7',
  gas:        '#8B4513',   // saddlebrown
  coal:       '#868E96',
  nuclear:    '#FF6B00',   // flashy orange
  oil:        '#4A4240',   // very dark brown-grey
  biomass:    '#40C057',
  geothermal: '#B8860B',   // darkgoldenrod
  diesel:     '#3C3C3C',   // dimgrey almost black
  waste:      '#ADB5BD',
  biogas:     '#69DB7C',
  wood:       '#66A80F',
};

export const FUEL_LABELS = {
  solar: 'Solar', wind: 'Wind', hydro: 'Hydro', gas: 'Gas',
  coal: 'Coal', nuclear: 'Nuclear', oil: 'Oil', biomass: 'Biomass',
  geothermal: 'Geothermal', diesel: 'Diesel', waste: 'Waste',
  biogas: 'Biogas', wood: 'Wood',
};

export const VOLTAGE_BRACKETS = [
  { min: 500_000, color: '#9B0000', width: 1.8,  label: '500 kV+',    key: '500' },  // darkred
  { min: 330_000, color: '#C84400', width: 1.3,  label: '330–500 kV', key: '330' },  // red-orange
  { min: 220_000, color: '#C87800', width: 0.9,  label: '220–330 kV', key: '220' },  // amber
  { min: 0,       color: '#A89200', width: 0.65, label: '110–220 kV', key: '110' },  // dark gold
];

// Neutral highlight for country/region fills on the map (independent of region accent color)
export const HIGHLIGHT = {
  dark:  { fill: 'rgba(70,115,165,0.32)',  border: 'rgba(150,195,240,0.62)', borderW: 1.0 },
  light: { fill: 'rgba(95,130,170,0.22)',  border: 'rgba(65,100,145,0.75)',  borderW: 1.0 },
};

export const DARK = {
  bg: '#060C18', land: '#0C1A2E',
  panel: '#0A1828', panelBorder: '#1A3A54',
  text: '#C8DFF0', muted: '#5A8AAA',
  hr: '#1A3A54', cardBg: '#060C18', cardBorder: '#1A3A54',
  lbl: '#A8C8E0', lblMuted: '#4A7A9A', lblRow: '#8BBDD8',
  worldBdr: 'rgba(30,60,100,0.6)', worldBdrW: 0.4,
  rgnBdr: 'rgba(255,255,255,0.55)', rgnBdrW: 0.9, rgnOp: 0.30,
  navBg: '#070E1C',
};

export const LIGHT = {
  bg: '#EEF3F7', land: '#D8E2EC',
  panel: '#FFFFFF', panelBorder: '#DEE5EE',
  text: '#2C3E52', muted: '#7A9AB0',
  hr: '#E8EDF2', cardBg: '#F5F7FA', cardBorder: '#DEE5EE',
  lbl: '#2C3E52', lblMuted: '#7A9AB0', lblRow: '#3A5A78',
  worldBdr: 'rgba(160,180,200,0.7)', worldBdrW: 0.4,
  rgnBdr: 'rgba(80,105,140,0.75)', rgnBdrW: 1.0, rgnOp: 0.28,
  navBg: '#F5F7FA',
};

export function getT(theme) {
  return theme === 'dark' ? DARK : LIGHT;
}

export function mapStyle(theme) {
  const bg = theme === 'dark' ? DARK.bg : LIGHT.bg;
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': bg } }],
  };
}

/** MapLibre circle-radius expression based on MW, scaled by a multiplier */
export function plantRadiusExpr(scale = 1) {
  return [
    'interpolate', ['linear'], ['get', 'mw'],
    0,    4  * scale,
    50,   5  * scale,
    200,  8  * scale,
    500,  12 * scale,
    1000, 16 * scale,
    5000, 22 * scale,
  ];
}
