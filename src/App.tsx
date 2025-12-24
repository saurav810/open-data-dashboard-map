import { useMemo, useRef, useState } from 'react'
import {
  Button,
  Checkbox,
  Fieldset,
  FormGroup,
  Label,
  Modal,
  ModalFooter,
  ModalHeading,
  Table,
} from '@trussworks/react-uswds'
import type { ModalRef } from '@trussworks/react-uswds'
import './App.css'
import { loadDashboardData, getSnapshotMeta, type DashboardRecord } from './dataLoader'
import { USMap, type Region } from './Map'

type GovernmentTypeFilter = '' | 'City' | 'County' | 'Other Public Agency'

function App() {
  const data = useMemo(() => loadDashboardData(), [])
  const snapshotMeta = useMemo(() => getSnapshotMeta(), [])

  // Region navigation
  const [activeRegion, setActiveRegion] = useState<Region>('lower48')

  // Pending filter selections (not yet applied)
  const [pendingGovType, setPendingGovType] = useState<GovernmentTypeFilter>('')
  const [pendingPopSizes, setPendingPopSizes] = useState<Set<string>>(new Set())

  // Applied filters
  const [appliedGovType, setAppliedGovType] = useState<GovernmentTypeFilter>('')
  const [appliedPopSizes, setAppliedPopSizes] = useState<Set<string>>(new Set())

  // Selected jurisdictions for the table
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Set<string>>(new Set())

  const [selectedName, setSelectedName] = useState<string>('')
  const [selectedFeatureRows, setSelectedFeatureRows] = useState<DashboardRecord[]>([])

  const modalRef = useRef<ModalRef>(null)

  const governmentOptions = useMemo(() => {
    const base: GovernmentTypeFilter[] = ['City', 'County']
    const hasOther = data.some(
      (row) => !row.governmentTypes.includes('City') && !row.governmentTypes.includes('County')
    )
    return hasOther ? [...base, 'Other Public Agency'] : base
  }, [data])

  const populationOptions = useMemo(() => {
    const values = new Set<string>()
    data.forEach((row) => {
      if (row.populationSize) values.add(row.populationSize)
    })
    return Array.from(values).sort()
  }, [data])

  const filteredRows = useMemo(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 STEP 2: FILTERING DATA')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Total rows before filtering:', data.length)
    console.log('Applied filters:', { appliedGovType, appliedPopSizes: Array.from(appliedPopSizes) })
    
    const filtered = data.filter((row) => {
      if (appliedGovType) {
        if (appliedGovType === 'City' && !row.governmentTypes.includes('City')) return false
        if (appliedGovType === 'County' && !row.governmentTypes.includes('County')) return false
        if (
          appliedGovType === 'Other Public Agency' &&
          (row.governmentTypes.includes('City') || row.governmentTypes.includes('County'))
        ) {
          return false
        }
      }

      if (appliedPopSizes.size > 0 && !appliedPopSizes.has(row.populationSize)) return false

      return true
    })
    
    console.log('✅ Total rows after filtering:', filtered.length)
    const filteredCities = filtered.filter(r => r.governmentTypes.includes('City'))
    const filteredCounties = filtered.filter(r => r.governmentTypes.includes('County'))
    console.log('Filtered city rows:', filteredCities.length)
    console.log('Filtered county rows:', filteredCounties.length)
    
    // Check for specific jurisdictions after filtering
    const dallasCity = filtered.find(r => r.jurisdiction.toLowerCase().includes('dallas') && r.governmentTypes.includes('City'))
    const denver = filtered.find(r => r.jurisdiction.toLowerCase().includes('denver'))
    const laCity = filtered.find(r => r.jurisdiction.toLowerCase() === 'los angeles' && r.governmentTypes.includes('City'))
    
    console.log(dallasCity ? '✅ Dallas city still present after filter' : '❌ Dallas city filtered out')
    console.log(denver ? '✅ Denver still present after filter' : '❌ Denver filtered out')
    console.log(laCity ? '✅ Los Angeles city still present after filter' : '❌ Los Angeles city filtered out')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    return filtered
  }, [data, appliedGovType, appliedPopSizes])

  const hasDataIds = useMemo(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 STEP 3: CREATING ID SET (hasDataIds)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const ids = new Set(filteredRows.map((row) => row.jurisdictionId))
    console.log('Total unique IDs in hasDataIds:', ids.size)
    
    const fiveDigit = Array.from(ids).filter(id => id.length === 5)
    const sevenDigit = Array.from(ids).filter(id => id.length === 7)
    console.log('5-digit IDs (counties):', fiveDigit.length)
    console.log('7-digit IDs (cities):', sevenDigit.length)
    
    // Check for duplicates in source data
    const idCounts = new Map<string, number>()
    filteredRows.forEach(row => {
      idCounts.set(row.jurisdictionId, (idCounts.get(row.jurisdictionId) || 0) + 1)
    })
    const duplicates = Array.from(idCounts.entries()).filter(([_, count]) => count > 1)
    if (duplicates.length > 0) {
      console.warn('⚠️  Duplicate IDs found:', duplicates)
    }
    
    console.log('Sample IDs:', Array.from(ids).slice(0, 10))
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    return ids
  }, [filteredRows])

  const selectedJurisdictionsData = useMemo(() => {
    return data.filter((row) => selectedJurisdictions.has(row.jurisdictionId))
  }, [data, selectedJurisdictions])

  const handleFeatureClick = (geoid: string, name: string) => {
    const matches = filteredRows.filter((row) => row.jurisdictionId === geoid)
    
    setSelectedName(name)
    setSelectedFeatureRows(matches)
    
    // Add to selected jurisdictions
    setSelectedJurisdictions((prev) => new Set(prev).add(geoid))
    
    modalRef.current?.toggleModal(undefined, true)
  }

  const applyFilters = () => {
    setAppliedGovType(pendingGovType)
    setAppliedPopSizes(new Set(pendingPopSizes))
  }

  const clearFilters = () => {
    setPendingGovType('')
    setPendingPopSizes(new Set())
    setAppliedGovType('')
    setAppliedPopSizes(new Set())
  }

  const clearSelectedQueries = () => {
    setSelectedJurisdictions(new Set())
  }

  const removeSelectedQuery = (geoid: string) => {
    setSelectedJurisdictions((prev) => {
      const next = new Set(prev)
      next.delete(geoid)
      return next
    })
  }

  const togglePopulationFilter = (value: string) => {
    setPendingPopSizes((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const hasActiveFilters = appliedGovType !== '' || appliedPopSizes.size > 0
  const hasPendingChanges = pendingGovType !== appliedGovType || 
    JSON.stringify(Array.from(pendingPopSizes).sort()) !== JSON.stringify(Array.from(appliedPopSizes).sort())

  const lastUpdatedLabel = useMemo(() => {
    try {
      const date = new Date(snapshotMeta.generatedAt)
      return date.toLocaleString()
    } catch {
      return '—'
    }
  }, [snapshotMeta])

  return (
    <div className="app-container">
      <div className="page-shell">
        <div className="page-header-wrapper">
          <header className="page-header">
            <div>
              <p className="eyebrow">Live dashboard map</p>
              <h1>Jurisdiction Dashboard Coverage</h1>
              <p className="usa-intro">
                Click jurisdictions on the map to view open data portals. Use filters to narrow results.
              </p>
            </div>
            <div className="header-actions">
              <p className="last-updated">Last updated: {lastUpdatedLabel}</p>
            </div>
          </header>
        </div>

        <div className="map-layout">
          <aside className="filters-sidebar" aria-label="Filters">
            <div className="filters-header">
              <h2>Filters</h2>
            </div>
            
            <FormGroup>
              <Label htmlFor="gov-filter">Government Type</Label>
              <select
                id="gov-filter"
                className="usa-select"
                value={pendingGovType}
                onChange={(e) => setPendingGovType(e.target.value as GovernmentTypeFilter)}
              >
                <option value="">All</option>
                {governmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </FormGroup>

            <Fieldset legend="Population Size" legendStyle="srOnly">
              <legend className="checkbox-label">Population Size</legend>
              <div className="checkbox-list">
                {populationOptions.map((opt) => (
                  <Checkbox
                    key={opt}
                    id={`pop-${opt}`}
                    name="population-size"
                    value={opt}
                    label={opt}
                    checked={pendingPopSizes.has(opt)}
                    onChange={() => togglePopulationFilter(opt)}
                  />
                ))}
              </div>
            </Fieldset>

            <div className="filter-actions">
              <Button type="button" onClick={applyFilters} disabled={!hasPendingChanges}>
                Apply Filters
              </Button>
              <Button type="button" onClick={clearFilters} secondary disabled={!hasActiveFilters && pendingPopSizes.size === 0 && !pendingGovType}>
                Clear All
              </Button>
            </div>

            {hasActiveFilters && (
              <div className="active-filters">
                <h3>Active Filters</h3>
                <ul className="filter-tags">
                  {appliedGovType && (
                    <li className="filter-tag">
                      Government: {appliedGovType}
                      <button
                        onClick={() => {
                          setPendingGovType('')
                          setAppliedGovType('')
                        }}
                        aria-label={`Remove ${appliedGovType} filter`}
                      >
                        ×
                      </button>
                    </li>
                  )}
                  {Array.from(appliedPopSizes).map((size) => (
                    <li key={size} className="filter-tag">
                      {size}
                      <button
                        onClick={() => {
                          const newSizes = new Set(appliedPopSizes)
                          newSizes.delete(size)
                          setAppliedPopSizes(newSizes)
                          setPendingPopSizes(newSizes)
                        }}
                        aria-label={`Remove ${size} filter`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <div className="map-main">
            <div className="quick-zoom-controls">
              <span className="quick-zoom-label">Quick zoom:</span>
              <div className="quick-zoom-buttons" role="group" aria-label="Map region navigation">
                <Button
                  type="button"
                  onClick={() => setActiveRegion('lower48')}
                  outline={activeRegion !== 'lower48'}
                >
                  Lower 48
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveRegion('alaska')}
                  outline={activeRegion !== 'alaska'}
                >
                  Alaska
                </Button>
                <Button
                  type="button"
                  onClick={() => setActiveRegion('hawaii')}
                  outline={activeRegion !== 'hawaii'}
                >
                  Hawaii
                </Button>
              </div>
            </div>
            <section className="map-section">
              {data.length === 0 ? (
                <div className="map-container">
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p>No data available</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="map-container">
                    <USMap hasDataIds={hasDataIds} onFeatureClick={handleFeatureClick} allData={filteredRows} activeRegion={activeRegion} />
                  </div>
                  <div className="map-legend">
                    <span className="legend-item">
                      <span className="legend-swatch county" /> Counties ({Array.from(hasDataIds).filter(id => id.length === 5).length})
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch city" /> Cities ({Array.from(hasDataIds).filter(id => id.length === 7).length})
                    </span>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        {selectedJurisdictions.size > 0 && (
          <section className="selected-section">
            <div className="selected-header">
              <h2>Selected Jurisdictions ({selectedJurisdictions.size})</h2>
              <Button type="button" unstyled onClick={clearSelectedQueries} className="clear-button">
                Clear selections
              </Button>
            </div>
            <div className="table-wrapper">
              <Table bordered fullWidth>
                <thead>
                  <tr>
                    <th scope="col">Jurisdiction</th>
                    <th scope="col">Government Type</th>
                    <th scope="col">Population Size</th>
                    <th scope="col">Dashboard</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedJurisdictionsData.map((row) => (
                    <tr key={`${row.jurisdiction}-${row.jurisdictionId}`}>
                      <td>{row.jurisdiction}</td>
                      <td>{row.displayGovernmentType}</td>
                      <td>{row.populationSize}</td>
                      <td>
                        <a href={row.url} target="_blank" rel="noreferrer">
                          Open Portal
                        </a>
                      </td>
                      <td>
                        <Button
                          type="button"
                          unstyled
                          onClick={() => removeSelectedQuery(row.jurisdictionId)}
                          className="remove-button"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>
        )}
      </div>

      <Modal id="details-modal" ref={modalRef} aria-labelledby="details-heading" aria-describedby="details-body">
        <ModalHeading id="details-heading">
          {selectedName || 'Jurisdiction details'}
        </ModalHeading>
        <div className="modal-body" id="details-body">
          {selectedFeatureRows.length === 0 ? (
            <p>No matching dashboards for the current filters.</p>
          ) : (
            <ul className="detail-list">
              {selectedFeatureRows.map((row) => (
                <li key={`${row.jurisdiction}-${row.url}`} className="detail-card">
                  <p className="detail-title">{row.jurisdiction}</p>
                  <p className="detail-meta">Government Type: {row.displayGovernmentType}</p>
                  <p className="detail-meta">Population Size: {row.populationSize}</p>
                  {row.notes && (
                    <div className="detail-notes-section">
                      <p className="detail-notes-label">Notes:</p>
                      <p className="detail-notes">{row.notes}</p>
                    </div>
                  )}
                  <p>
                    <a href={row.url} target="_blank" rel="noreferrer" className="portal-link">
                      Open Data Portal →
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ModalFooter>
          <Button type="button" secondary onClick={() => modalRef.current?.toggleModal(undefined, false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default App
