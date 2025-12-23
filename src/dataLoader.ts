import snapshotData from './data/portals.snapshot.json'
import snapshotMeta from './data/portals.snapshot.meta.json'

export interface CsvRowRaw {
  Jurisdiction?: string
  'Jurisdiction ID'?: string
  URL?: string
  'Population Size'?: string
  'Government Type'?: string
  Notes?: string
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
  }
}

export function loadDashboardData(): DashboardRecord[] {
  const records: DashboardRecord[] = []

  snapshotData.forEach((row) => {
    const normalized = normalizeRow(row as CsvRowRaw)
    if (normalized) {
      records.push(normalized)
    }
  })

  // Debug: Show what IDs we have
  console.log('📊 Total records loaded:', records.length)
  const denverRecord = records.find(r => r.jurisdiction.toLowerCase().includes('denver'))
  if (denverRecord) {
    console.log('✅ Denver record:', {
      name: denverRecord.jurisdiction,
      id: denverRecord.jurisdictionId,
      idLength: denverRecord.jurisdictionId.length,
      govType: denverRecord.governmentTypeRaw
    })
  } else {
    console.log('❌ Denver NOT found in records')
  }
  
  // Show some sample IDs with leading zeros
  const leadingZeroIds = records.filter(r => r.jurisdictionId.startsWith('0')).slice(0, 5)
  console.log('Sample leading-zero IDs:', leadingZeroIds.map(r => ({
    name: r.jurisdiction,
    id: r.jurisdictionId,
    len: r.jurisdictionId.length
  })))

  return records
}

export function getSnapshotMeta(): SnapshotMeta {
  return snapshotMeta as SnapshotMeta
}
