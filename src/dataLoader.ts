import snapshotData from './data/portals.snapshot.json'
import snapshotMeta from './data/portals.snapshot.meta.json'

export interface CsvRowRaw {
  Jurisdiction?: string
  'Jurisdiction ID'?: string
  URL?: string
  'Population Size'?: string
  'Government Type'?: string
  Notes?: string
  Latitude?: string | number
  Longitude?: string | number
}

export interface DashboardRecord {
  jurisdiction: string
  jurisdictionId: string
  url: string
  populationSize: string
  governmentTypeRaw: string
  governmentTypes: string[]
  isUnified: boolean
  displayGovernmentType: string
  notes: string
  latitude?: number
  longitude?: number
}

export interface SnapshotMeta {
  generatedAt: string
  sourceUrl: string
  recordCount?: number
}

/**
 * Remove leading apostrophes and trim whitespace from raw ID values.
 * Google Sheets sometimes adds apostrophes to force text formatting.
 */
function normalizeId(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^'+/, '') // removes one or more leading apostrophes
}

/**
 * Normalize ID length based on government type.
 * Counties: 5 digits (e.g., "08001")
 * Cities (including unified city-county): 7 digits (e.g., "0820000")
 * 
 * For unified city-counties, also extract the 5-digit county code from the 7-digit city ID
 */
function normalizeIdForType(id: string, govType: string): string {
  const clean = normalizeId(id)
  const type = govType.trim().toLowerCase()
  
  // Only pure "county" gets 5 digits; everything else (city, unified, etc.) gets 7
  const isCountyOnly = type === 'county'
  return isCountyOnly ? clean.padStart(5, '0') : clean.padStart(7, '0')
}

function normalizeRow(raw: CsvRowRaw): DashboardRecord | null {
  const jurisdiction = raw.Jurisdiction?.trim() || ''
  const rawJurisdictionId = raw['Jurisdiction ID'] ?? ''
  const url = raw.URL?.trim() || ''
  const populationSize = raw['Population Size']?.trim() || ''
  const governmentTypeRaw = raw['Government Type']?.trim() || ''
  const notes = raw.Notes?.trim() || ''

  // Normalize the jurisdiction ID (strip apostrophes, trim, pad to correct length)
  const jurisdictionId = normalizeIdForType(rawJurisdictionId, governmentTypeRaw)

  if (!jurisdictionId || !url) {
    console.warn('Skipping row with missing jurisdiction id or url', jurisdiction)
    return null
  }

  const governmentTypes = governmentTypeRaw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const hasCity = governmentTypes.includes('City')
  const hasCounty = governmentTypes.includes('County')
  const unifiedByNotes = notes.includes('Unified City-County Government')
  const isUnified = unifiedByNotes || (hasCity && hasCounty)

  let displayGovernmentType = governmentTypes[0] || 'Other Public Agency'
  if (unifiedByNotes) {
    displayGovernmentType = 'Unified City–County'
  } else if (isUnified) {
    displayGovernmentType = 'City + County'
  }

  // Parse latitude and longitude (if present)
  let latitude: number | undefined
  let longitude: number | undefined
  
  if (raw.Latitude !== undefined && raw.Latitude !== null && raw.Latitude !== '') {
    const lat = Number(raw.Latitude)
    if (Number.isFinite(lat)) {
      latitude = lat
    }
  }
  
  if (raw.Longitude !== undefined && raw.Longitude !== null && raw.Longitude !== '') {
    const lon = Number(raw.Longitude)
    if (Number.isFinite(lon)) {
      longitude = lon
    }
  }

  return {
    jurisdiction,
    jurisdictionId,
    url,
    populationSize,
    governmentTypeRaw,
    governmentTypes,
    isUnified,
    displayGovernmentType,
    notes,
    latitude,
    longitude,
  }
}

export function loadDashboardData(): DashboardRecord[] {
  const records: DashboardRecord[] = []

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 STEP 1: LOADING DATA FROM CSV')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Total rows loaded from CSV:', snapshotData.length)

  snapshotData.forEach((row) => {
    const normalized = normalizeRow(row as CsvRowRaw)
    if (normalized) {
      records.push(normalized)
    }
  })

  console.log('✅ Total records after normalization:', records.length)
  
  // Count by government type
  const cityRows = records.filter(r => r.governmentTypes.includes('City'))
  const countyRows = records.filter(r => r.governmentTypes.includes('County'))
  const cityOnlyRows = records.filter(r => r.governmentTypes.includes('City') && !r.governmentTypes.includes('County'))
  const countyOnlyRows = records.filter(r => r.governmentTypes.includes('County') && !r.governmentTypes.includes('City'))
  const unifiedRows = records.filter(r => r.isUnified)
  
  console.log('Count of city rows (includes unified):', cityRows.length)
  console.log('Count of county rows (includes unified):', countyRows.length)
  console.log('Count of city-only rows:', cityOnlyRows.length)
  console.log('Count of county-only rows:', countyOnlyRows.length)
  console.log('Count of unified city-county rows:', unifiedRows.length)
  
  // Count by ID length (5-digit = county, 7-digit = city)
  const fiveDigitIds = records.filter(r => r.jurisdictionId.length === 5)
  const sevenDigitIds = records.filter(r => r.jurisdictionId.length === 7)
  
  console.log('Count with 5-digit IDs (county format):', fiveDigitIds.length)
  console.log('Count with 7-digit IDs (city format):', sevenDigitIds.length)
  
  // Check for specific expected cities
  console.log('\n🔍 CHECKING FOR EXPECTED JURISDICTIONS:')
  const dallasCity = records.find(r => r.jurisdiction.toLowerCase().includes('dallas') && r.governmentTypes.includes('City'))
  const dallasCounty = records.find(r => r.jurisdiction.toLowerCase().includes('dallas') && r.governmentTypes.includes('County'))
  const denver = records.find(r => r.jurisdiction.toLowerCase().includes('denver'))
  const laCity = records.find(r => r.jurisdiction.toLowerCase() === 'los angeles' && r.governmentTypes.includes('City'))
  const laCounty = records.find(r => r.jurisdiction.toLowerCase().includes('los angeles') && r.governmentTypes.includes('County'))
  
  console.log(dallasCity ? '✅ Dallas city found:' : '❌ Dallas city NOT found', dallasCity ? `${dallasCity.jurisdictionId} (${dallasCity.governmentTypeRaw})` : '')
  console.log(dallasCounty ? '✅ Dallas County found:' : '❌ Dallas County NOT found', dallasCounty ? `${dallasCounty.jurisdictionId} (${dallasCounty.governmentTypeRaw})` : '')
  console.log(denver ? '✅ Denver found:' : '❌ Denver NOT found', denver ? `${denver.jurisdictionId} (${denver.governmentTypeRaw})` : '')
  console.log(laCity ? '✅ Los Angeles city found:' : '❌ Los Angeles city NOT found', laCity ? `${laCity.jurisdictionId} (${laCity.governmentTypeRaw})` : '')
  console.log(laCounty ? '✅ Los Angeles County found:' : '❌ Los Angeles County NOT found', laCounty ? `${laCounty.jurisdictionId} (${laCounty.governmentTypeRaw})` : '')
  
  // STEP 4: Collision detector
  console.log('\n🔍 COLLISION DETECTOR:')
  const nameMap = new Map<string, DashboardRecord[]>()
  records.forEach(record => {
    const name = record.jurisdiction.toLowerCase()
    if (!nameMap.has(name)) {
      nameMap.set(name, [])
    }
    nameMap.get(name)!.push(record)
  })
  
  const collisions = Array.from(nameMap.entries())
    .filter(([_, records]) => records.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
  
  console.log(`Found ${collisions.length} jurisdiction names with multiple records:`)
  collisions.slice(0, 10).forEach(([name, recs]) => {
    const types = recs.map(r => r.displayGovernmentType).join(', ')
    const ids = recs.map(r => r.jurisdictionId).join(', ')
    console.log(`  "${name}" has ${recs.length} records (${types}) [IDs: ${ids}]`)
  })
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  return records
}

export function getSnapshotMeta(): SnapshotMeta {
  return snapshotMeta as SnapshotMeta
}
