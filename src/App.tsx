import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Fieldset,
  FormGroup,
  GridContainer,
  Label,
  Modal,
  ModalFooter,
  ModalHeading,
  Table,
} from '@trussworks/react-uswds'
import type { ModalRef } from '@trussworks/react-uswds'
import './App.css'
import { fetchDashboardData, type DashboardRecord } from './dataLoader'
import { USMap } from './Map'

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ_zWTMJ46aF_Nw3R5rw_Tq7PMpFnZ099zkFsXwSP1nge546f0PeisEOpBZ3gJQUdxHFrsOP8votEV/pub?output=csv'

type GovernmentTypeFilter = '' | 'City' | 'County' | 'Other Public Agency'

function App() {
  const [data, setData] = useState<DashboardRecord[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Pending filter selections (not yet applied)
  const [pendingGovType, setPendingGovType] = useState<GovernmentTypeFilter>('')
  const [pendingPopSizes, setPendingPopSizes] = useState<Set<string>>(new Set())

  // Applied filters
  const [appliedGovType, setAppliedGovType] = useState<GovernmentTypeFilter>('')
  const [appliedPopSizes, setAppliedPopSizes] = useState<Set<string>>(new Set())

  // Selected jurisdictions for the table
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<Set<string>>(new Set())

  const [selectedGEOID, setSelectedGEOID] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [selectedFeatureRows, setSelectedFeatureRows] = useState<DashboardRecord[]>([])

  const modalRef = useRef<ModalRef>(null)

  const loadData = async (showSpinner = true) => {
    try {
      if (showSpinner) setRefreshing(true)
      const records = await fetchDashboardData(CSV_URL)
      console.log('CSV data loaded:', records.length, 'records')
      console.log('Sample records:', records.slice(0, 3))
      setData(records)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.error('Failed to fetch CSV', err)
      setError('Unable to load live dashboard data. Showing the last successful load if available.')
    } finally {
      if (showSpinner) setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => void loadData(false), 60_000)
    return () => clearInterval(interval)
  }, [])

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
    return data.filter((row) => {
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
  }, [data, appliedGovType, appliedPopSizes])

  const hasDataIds = useMemo(() => {
    const ids = new Set(filteredRows.map((row) => row.jurisdictionId))
    console.log('hasDataIds computed:', ids.size, 'IDs')
    return ids
  }, [filteredRows])

  const selectedJurisdictionsData = useMemo(() => {
    return data.filter((row) => selectedJurisdictions.has(row.jurisdictionId))
  }, [data, selectedJurisdictions])

  const handleFeatureClick = (geoid: string, name: string) => {
    const matches = filteredRows.filter((row) => row.jurisdictionId === geoid)
    
    setSelectedGEOID(geoid)
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

  const lastUpdatedLabel = lastUpdated ? lastUpdated.toLocaleTimeString() : '—'

  return (
    <GridContainer>
      <div className="page-shell">
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
            <Button type="button" onClick={() => void loadData()} secondary disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </Button>
          </div>
        </header>

        {error && (
          <Alert type="error" heading="Data issue" headingLevel="h2" className="stacked-alert">
            {error}
          </Alert>
        )}

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
              <Label className="checkbox-label">Population Size</Label>
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
            <section className="map-section">
              {refreshing && data.length === 0 ? (
                <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p>Loading map data...</p>
                </div>
              ) : data.length === 0 ? (
                <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p>No data available</p>
                </div>
              ) : (
                <>
                  <USMap hasDataIds={hasDataIds} onFeatureClick={handleFeatureClick} allData={filteredRows} />
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
    </GridContainer>
  )
}

export default App
