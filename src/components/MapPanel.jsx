import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getModelBounds } from '../utils/models'

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

// Shared promise cache so WorldPage and ModelPage don't double-fetch
let countriesPromise = null
function getCountries() {
  if (!countriesPromise) countriesPromise = fetch(COUNTRIES_URL).then(r => r.json())
  return countriesPromise
}

const BASEMAP = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© CartoDB © OpenStreetMap',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

export default function MapPanel({ model, meta }) {
  const mapRef = useRef(null)

  const countries = model?.countries ?? meta?.countries ?? []

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: BASEMAP,
      center: [30, 42],
      zoom: 3,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', async () => {
      const geojson = await getCountries()

      map.addSource('countries', { type: 'geojson', data: geojson })

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'case',
            ['in', ['get', 'ADM0_A3'], ['literal', countries]],
            '#3b82f6',
            '#141722',
          ],
          'fill-opacity': [
            'case',
            ['in', ['get', 'ADM0_A3'], ['literal', countries]],
            0.5,
            0.6,
          ],
        },
      })

      map.addLayer({
        id: 'countries-outline',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': [
            'case',
            ['in', ['get', 'ADM0_A3'], ['literal', countries]],
            '#60a5fa',
            '#1e2640',
          ],
          'line-width': [
            'case',
            ['in', ['get', 'ADM0_A3'], ['literal', countries]],
            1.5,
            0.4,
          ],
        },
      })

      // Zoom to model countries
      if (countries.length) {
        const bounds = getModelBounds(countries)
        if (bounds) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 8, duration: 800 })
        }
      }
    })

    return () => map.remove()
  }, [countries.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="map-panel">
      <div ref={mapRef} className="map-panel-map" />
    </div>
  )
}
