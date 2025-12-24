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
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📊 STEP 4: MAP RENDERING')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('Map received hasDataIds:', hasDataIds.size, 'IDs')
        console.log('Map received allData records:', allData.length)
        
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
          
          // Check for direct 5-digit county match
          if (matchedId && hasDataIds.has(matchedId)) {
            if (!feature.properties) feature.properties = {}
            feature.properties.CSV_ID = matchedId
            countyMatches++
            return true
          }
          
          // Also check if this county has a unified city-county with a 7-digit ID
          // For example, Denver County (08020) should match Denver city (0820000)
          const cityStyleId = paddedId + '00' // Convert 5-digit county to 7-digit city format
          if (hasDataIds.has(cityStyleId)) {
            if (!feature.properties) feature.properties = {}
            feature.properties.CSV_ID = cityStyleId
            countyMatches++
            return true
          }
          
          return false
        })
        
        console.log('✅ County polygons to render:', countyMatches)
        
        setCountiesData({
          type: 'FeatureCollection',
          features: filteredFeatures,
        })

        // Create city markers using Latitude/Longitude from the data
        // Only render cities (Government Type includes "City")
        const cityFeatures: Array<Feature<any>> = []
        let citiesWithoutCoords = 0
        
        console.log('Creating city markers from data with coordinates...')
        
        // Filter to only city records (including unified city-county)
        const cityRecords = allData.filter(record => record.governmentTypes.includes('City'))
        console.log(`Found ${cityRecords.length} city records (including unified)`)
        
        cityRecords.forEach(record => {
          const lat = Number(record.latitude)
          const lon = Number(record.longitude)
          
          // Only render if we have valid coordinates
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            cityFeatures.push({
              type: 'Feature',
              id: record.jurisdictionId,
              properties: {
                name: record.jurisdiction,
                CSV_ID: record.jurisdictionId,
                isCity: true,
              },
              geometry: {
                type: 'Point',
                coordinates: [lon, lat], // GeoJSON uses [longitude, latitude]
              },
            })
          } else {
            citiesWithoutCoords++
            console.warn(`⚠️  City missing coordinates: ${record.jurisdiction} (ID: ${record.jurisdictionId})`)
          }
        })
        
        console.log(`✅ City markers created with coordinates: ${cityFeatures.length}`)
        if (citiesWithoutCoords > 0) {
          console.warn(`⚠️  ${citiesWithoutCoords} cities skipped (missing coordinates)`)
        }
        
        // Check for specific cities in the render list
        const dallasCity = cityFeatures.find(f => f.properties?.name?.toLowerCase().includes('dallas') && !f.properties?.name?.toLowerCase().includes('county'))
        const denver = cityFeatures.find(f => f.properties?.name?.toLowerCase().includes('denver'))
        const laCity = cityFeatures.find(f => f.properties?.name?.toLowerCase().includes('los angeles'))
        
        console.log(dallasCity ? '✅ Dallas city marker created' : '❌ Dallas city marker NOT created')
        console.log(denver ? '✅ Denver marker created' : '❌ Denver marker NOT created')
        console.log(laCity ? '✅ Los Angeles city marker created' : '❌ Los Angeles city marker NOT created')
        
        console.log('\n📊 RENDERING SUMMARY:')
        console.log(`  County polygons in hasDataIds: ${Array.from(hasDataIds).filter(id => id.length === 5).length}`)
        console.log(`  County polygons to render: ${countyMatches}`)
        console.log(`  City records in dataset: ${cityRecords.length}`)
        console.log(`  City markers created: ${cityFeatures.length}`)
        console.log(`  Cities dropped: ${cityRecords.length - cityFeatures.length}`)
        
        if (cityRecords.length !== cityFeatures.length) {
          console.warn(`⚠️  ${cityRecords.length - cityFeatures.length} cities were dropped (missing coordinates)!`)
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        
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
