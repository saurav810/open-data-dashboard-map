import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import 'leaflet/dist/leaflet.css'
import type { DashboardRecord } from './dataLoader'

export type Region = 'lower48' | 'alaska' | 'hawaii'

interface RegionConfig {
  center: [number, number]
  zoom: number
  maxBounds: [[number, number], [number, number]]
}

const REGION_PRESETS: Record<Region, RegionConfig> = {
  lower48: {
    center: [39.5, -98.35],
    zoom: 4,
    maxBounds: [
      [24.5, -125],    // Southwest
      [49.5, -66.5]    // Northeast
    ]
  },
  alaska: {
    center: [64.2, -152.0],
    zoom: 4,
    maxBounds: [
      [51.0, -180],    // Southwest
      [71.5, -130]     // Northeast
    ]
  },
  hawaii: {
    center: [20.8, -157.5],
    zoom: 6,
    maxBounds: [
      [18.5, -161],    // Southwest
      [22.5, -154]     // Northeast
    ]
  }
}

interface USMapProps {
  hasDataIds: Set<string>
  onFeatureClick: (geoid: string, name: string) => void
  allData: DashboardRecord[]
  activeRegion?: Region
}

function MapViewController({ activeRegion }: { activeRegion: Region }) {
  const map = useMap()
  
  useEffect(() => {
    const config = REGION_PRESETS[activeRegion]
    map.setView(config.center, config.zoom, { animate: true })
    map.setMaxBounds(config.maxBounds)
  }, [activeRegion, map])

  return null
}

export function USMap({ hasDataIds, onFeatureClick, allData, activeRegion = 'lower48' }: USMapProps) {
  const [countiesData, setCountiesData] = useState<FeatureCollection | null>(null)
  const [citiesData, setCitiesData] = useState<Array<Feature<any>>>([])
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    const loadGeoData = async () => {
      try {
        setLoading(true)
        
        console.log('🗺️ Map received hasDataIds:', hasDataIds.size, 'IDs')
        console.log('Sample IDs from dataset:', Array.from(hasDataIds).slice(0, 10))
        
        // Check for Denver specifically
        const denverIds = Array.from(hasDataIds).filter(id => id.includes('082'))
        console.log('Denver-related IDs in dataset:', denverIds)
        
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
          
          // Debug Denver County specifically
          if (paddedId.startsWith('082')) {
            console.log('Denver County GeoJSON feature:', {
              id: numericId,
              paddedId,
              name: feature.properties?.name,
              hasMatch: hasDataIds.has(matchedId || '')
            })
          }
          
          // Check for direct 5-digit county match
          if (matchedId && hasDataIds.has(matchedId)) {
            if (!feature.properties) feature.properties = {}
            feature.properties.CSV_ID = matchedId
            console.log('County match:', paddedId, feature.properties.name)
            countyMatches++
            return true
          }
          
          // Also check if this county has a unified city-county with a 7-digit ID
          // For example, Denver County (08020) should match Denver city (0820000)
          const cityStyleId = paddedId + '00' // Convert 5-digit county to 7-digit city format
          if (hasDataIds.has(cityStyleId)) {
            if (!feature.properties) feature.properties = {}
            feature.properties.CSV_ID = cityStyleId
            console.log('Unified city-county match:', paddedId, '->', cityStyleId, feature.properties.name)
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
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Loading map...</p>
    </div>
  }

  const initialConfig = REGION_PRESETS[activeRegion]

  return (
    <MapContainer
      ref={mapRef}
      center={initialConfig.center}
      zoom={initialConfig.zoom}
      minZoom={3}
      maxZoom={10}
      maxBounds={initialConfig.maxBounds}
      maxBoundsViscosity={1.0}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
    >
      <MapViewController activeRegion={activeRegion} />
      
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
