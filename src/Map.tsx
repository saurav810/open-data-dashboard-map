import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import 'leaflet/dist/leaflet.css'
import type { DashboardRecord } from './dataLoader'

interface USMapProps {
  hasDataIds: Set<string>
  onFeatureClick: (geoid: string, name: string) => void
  allData: DashboardRecord[]
}

function MapUpdater({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useRef<LeafletMap | null>(null)
  
  useEffect(() => {
    if (map.current) {
      map.current.fitBounds(bounds)
    }
  }, [bounds])

  return null
}

export function USMap({ hasDataIds, onFeatureClick, allData }: USMapProps) {
  const [countiesData, setCountiesData] = useState<FeatureCollection | null>(null)
  const [citiesData, setCitiesData] = useState<Array<Feature<any>>>([])
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    const loadGeoData = async () => {
      try {
        setLoading(true)
        
        // Load county GeoJSON
        const response = await fetch(
          'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json'
        )
        const geojson: FeatureCollection = await response.json()
        
        // Create ID mapping to handle both string and numeric IDs
        const idMatchMap = new Map<string, string>()
        geojson.features.forEach((feature) => {
          const numericId = feature.id
          const paddedId = String(numericId).padStart(5, '0')
          idMatchMap.set(paddedId, paddedId)
          idMatchMap.set(String(numericId), paddedId)
        })

        // Store the CSV_ID on each feature and filter to only those with data
        let countyMatches = 0
        const filteredFeatures = geojson.features.filter((feature) => {
          const numericId = feature.id
          const paddedId = String(numericId).padStart(5, '0')
          const matchedId = idMatchMap.get(paddedId)
          
          if (matchedId && hasDataIds.has(matchedId)) {
            if (!feature.properties) feature.properties = {}
            feature.properties.CSV_ID = matchedId
            console.log('County match:', paddedId, feature.properties.name)
            countyMatches++
            return true
          }
          return false
        })
        
        console.log(`Found ${countyMatches} counties with data`)
        
        setCountiesData({
          type: 'FeatureCollection',
          features: filteredFeatures,
        })

        // Create city markers from 7-digit IDs
        const cityFeatures: Array<Feature<any>> = []
        const cityIds = Array.from(hasDataIds).filter(id => id.length === 7)
        console.log(`Found ${cityIds.length} cities with 7-digit IDs`)
        
        // For now, we'll place city markers at the centroid of their parent county
        // This is a simplified approach - ideally we'd load actual city boundaries
        cityIds.forEach(cityId => {
          const stateFips = cityId.substring(0, 2)
          const stateCountyFips = cityId.substring(0, 5)
          
          // Try to find parent county
          let parentCounty = geojson.features.find(f => String(f.id).padStart(5, '0') === stateCountyFips)
          
          // If no exact county match, find any county in the same state
          if (!parentCounty) {
            parentCounty = geojson.features.find(f => String(f.id).padStart(5, '0').startsWith(stateFips))
          }
          
          if (parentCounty && parentCounty.geometry.type === 'Polygon') {
            // Calculate centroid of county polygon
            const coords = parentCounty.geometry.coordinates[0] as number[][]
            const lngs = coords.map(c => c[0])
            const lats = coords.map(c => c[1])
            const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length
            const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
            
            const cityRecord = allData.find(d => d.jurisdictionId === cityId)
            
            cityFeatures.push({
              type: 'Feature',
              id: cityId,
              properties: {
                name: cityRecord?.jurisdiction || 'City',
                CSV_ID: cityId,
                isCity: true,
              },
              geometry: {
                type: 'Point',
                coordinates: [centerLng, centerLat],
              },
            })
          } else {
            console.log(`No parent county found for city ${cityId}, state: ${stateFips}`)
          }
        })
        
        console.log(`Created ${cityFeatures.length} city markers`)
        setCitiesData(cityFeatures)
        
      } catch (error) {
        console.error('Error loading GeoJSON:', error)
      } finally {
        setLoading(false)
      }
    }

    if (hasDataIds.size > 0) {
      void loadGeoData()
    }
  }, [hasDataIds, allData])

  if (loading) {
    return <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading map...</p>
    </div>
  }

  return (
    <MapContainer
      ref={mapRef}
      center={[39.8283, -98.5795]}
      zoom={4}
      style={{ height: '600px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <MapUpdater bounds={[
        [24.396308, -125.0],  // Southwest (includes Hawaii)
        [49.384358, -66.93457] // Northeast
      ]} />
      
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {countiesData && (
        <GeoJSON
          key={`counties-${hasDataIds.size}`}
          data={countiesData}
          style={() => ({
            fillColor: '#3182ce',
            weight: 1,
            opacity: 1,
            color: '#2c5282',
            fillOpacity: 0.5,
          })}
          onEachFeature={(feature, layer) => {
            const csvId = feature.properties?.CSV_ID as string
            const countyRecord = allData.find(d => d.jurisdictionId === csvId)
            const name = countyRecord?.jurisdiction || feature.properties?.name as string || 'County'
            layer.on({
              click: () => {
                console.log('County clicked:', csvId, name)
                onFeatureClick(csvId, name)
              },
            })
            layer.bindTooltip(name, {
              sticky: true,
            })
          }}
        />
      )}

      {citiesData.map((cityFeature) => {
        if (!cityFeature.geometry || cityFeature.geometry.type !== 'Point') return null
        const coords = cityFeature.geometry.coordinates as [number, number]
        const csvId = cityFeature.properties?.CSV_ID as string
        const name = cityFeature.properties?.name as string
        
        return (
          <CircleMarker
            key={csvId}
            center={[coords[1], coords[0]]}  // [lat, lng]
            radius={6}
            fillColor="#ed8936"
            color="#c05621"
            weight={2}
            opacity={1}
            fillOpacity={0.8}
            eventHandlers={{
              click: () => {
                console.log('City clicked:', csvId, name)
                onFeatureClick(csvId, name)
              },
            }}
          >
            <Tooltip sticky>{name}</Tooltip>
          </CircleMarker>
        )
      }).filter(Boolean)}
    </MapContainer>
  )
}
