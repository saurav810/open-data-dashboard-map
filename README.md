# Jurisdiction Dashboard Map

A client-side React + TypeScript application that visualizes jurisdiction dashboards using a local snapshot generated from a Google Sheets CSV source.

## Overview

- Loads dashboard data from local JSON snapshot files (no runtime network calls to Google Sheets)
- Supports both city (place) and county jurisdiction IDs while keeping leading zeros intact
- Provides filters for government type and population size that drive both the map styling and the results list
- Clicking a polygon opens details for every matching dashboard (multiple entries per jurisdiction ID are supported)

## Data source

The app uses snapshot JSON files generated from a published Google Sheets CSV:

Source CSV:
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ_zWTMJ46aF_Nw3R5rw_Tq7PMpFnZ099zkFsXwSP1nge546f0PeisEOpBZ3gJQUdxHFrsOP8votEV/pub?output=csv
```

Snapshot files:
- `src/data/portals.snapshot.json` - Array of dashboard records
- `src/data/portals.snapshot.meta.json` - Metadata including generation timestamp

### Updating the data

To update the data snapshot:

```bash
npm run snapshot:portals
```

This fetches the latest CSV, parses it with Papa Parse, and generates the snapshot files. The CSV URL can be overridden via the `PORTALS_CSV_URL` environment variable:

```bash
PORTALS_CSV_URL="https://your-custom-url/data.csv" npm run snapshot:portals
```

## Running locally

```bash
npm install
npm run dev
```

The development server starts on `http://localhost:5173` by default (or another port if 5173 is in use).

## Building for production

```bash
npm run build
```

## Key behaviors

- **Parsing & normalization**: CSV headers are mapped to code-friendly keys; `Jurisdiction ID` is always treated as a string. Government types are split on commas (e.g., "City, County" is correctly preserved during CSV parsing), unified governments are detected via notes or combined city+county types, and a display-friendly label is generated.
- **Filters**: Government type (City, County, Unified City–County, Other Public Agency when present) and multi-select population size filters control both the map shading and the results table. A reset action clears all filters.
- **Map join**: Polygon features are joined by matching `jurisdictionId === GEOID`. A polygon is highlighted when any filtered row matches its ID, and multiple rows per jurisdiction are preserved.
- **Details panel**: Clicking a polygon opens a modal that lists all matching dashboards with jurisdiction name, ID, government type, population size, notes, and a link to the dashboard.
- **Last updated timestamp**: The UI displays when the snapshot was last generated, sourced from the metadata file.

## Tech stack

- React 19 + TypeScript
- USWDS components via `@trussworks/react-uswds`
- PapaParse for CSV parsing (used in snapshot script)
- Vite for build tooling
