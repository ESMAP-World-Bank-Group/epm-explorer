export const TECH_COLORS = {
  CCGT:           '#f97316',
  OCGT:           '#fb923c',
  Nuclear:        '#a855f7',
  Coal:           '#78716c',
  ST:             '#6b7280',
  BiomassPlant:   '#22c55e',
  OnshoreWind:    '#3b82f6',
  OffshoreWind:   '#1d4ed8',
  PV:             '#eab308',
  CSP:            '#f59e0b',
  ReservoirHydro: '#06b6d4',
  ROR:            '#0891b2',
  Storage:        '#8b5cf6',
  Import:         '#ec4899',
  default:        '#94a3b8',
}

export const FUEL_COLORS = {
  Gas:          '#f97316',
  Uranium:      '#a855f7',
  ImportedCoal: '#78716c',
  DomesticCoal: '#57534e',
  Biomass:      '#22c55e',
  Wind:         '#3b82f6',
  Solar:        '#eab308',
  Water:        '#06b6d4',
  Battery:      '#8b5cf6',
  HFO:          '#dc2626',
  Diesel:       '#b91c1c',
  Hydrogen:     '#10b981',
  default:      '#94a3b8',
}

export function techColor(tech) {
  return TECH_COLORS[tech] || TECH_COLORS.default
}

export function fuelColor(fuel) {
  return FUEL_COLORS[fuel] || FUEL_COLORS.default
}
