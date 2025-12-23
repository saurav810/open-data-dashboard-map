#!/usr/bin/env node

import { writeFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import Papa from 'papaparse'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read CSV URL from environment variable
const CSV_URL = process.env.PORTALS_CSV_URL || 
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQ_zWTMJ46aF_Nw3R5rw_Tq7PMpFnZ099zkFsXwSP1nge546f0PeisEOpBZ3gJQUdxHFrsOP8votEV/pub?output=csv'

const OUTPUT_DIR = join(__dirname, '..', 'src', 'data')
const SNAPSHOT_FILE = join(OUTPUT_DIR, 'portals.snapshot.json')
const META_FILE = join(OUTPUT_DIR, 'portals.snapshot.meta.json')

async function main() {
  console.log('🔄 Fetching CSV from:', CSV_URL)
  
  try {
    // Fetch the CSV
    const response = await fetch(CSV_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`)
    }
    
    const csvText = await response.text()
    console.log('✅ CSV fetched successfully')
    
    // Parse with Papa Parse
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false  // Keep all values as strings to preserve leading zeros
    })
    
    if (parsed.errors.length > 0) {
      console.warn('⚠️  Parsing warnings:', parsed.errors)
    }
    
    console.log(`📊 Parsed ${parsed.data.length} rows`)
    
    // Ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true })
    
    // Write snapshot JSON
    await writeFile(
      SNAPSHOT_FILE,
      JSON.stringify(parsed.data, null, 2),
      'utf-8'
    )
    console.log('✅ Wrote:', SNAPSHOT_FILE)
    
    // Write metadata JSON
    const meta = {
      generatedAt: new Date().toISOString(),
      sourceUrl: CSV_URL,
      recordCount: parsed.data.length
    }
    
    await writeFile(
      META_FILE,
      JSON.stringify(meta, null, 2),
      'utf-8'
    )
    console.log('✅ Wrote:', META_FILE)
    
    console.log('✨ Snapshot generation complete!')
    console.log(`   Generated at: ${meta.generatedAt}`)
    console.log(`   Record count: ${meta.recordCount}`)
    
  } catch (error) {
    console.error('❌ Error generating snapshot:', error)
    process.exit(1)
  }
}

main()
