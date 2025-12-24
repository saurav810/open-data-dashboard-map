// Check what IDs look like after normalization
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/portals.snapshot.json', 'utf8'));

function normalizeId(raw) {
  return String(raw ?? '').trim().replace(/^'+/, '');
}

function normalizeIdForType(id, govType) {
  const clean = normalizeId(id);
  const type = govType.trim().toLowerCase();
  const isCountyOnly = type === 'county';
  return isCountyOnly ? clean.padStart(5, '0') : clean.padStart(7, '0');
}

console.log('Checking ID normalization...\n');

// Check specific cities
const testCities = [
  'Baltimore, MD',
  'Dallas, TX',
  'Denver, CO',
  'Los Angeles, CA'
];

testCities.forEach(name => {
  const record = data.find(r => r.Jurisdiction === name);
  if (record) {
    const rawId = record['Jurisdiction ID'];
    const govType = record['Government Type'];
    const normalized = normalizeIdForType(rawId, govType);
    
    console.log(`${name}:`);
    console.log(`  Raw ID: "${rawId}"`);
    console.log(`  Normalized: "${normalized}"`);
    console.log(`  Gov Type: "${govType}"`);
    console.log(`  substring(0,2): "${normalized.substring(0, 2)}"`);
    console.log();
  }
});

// Find all IDs that start with 00
console.log('\nIDs that start with 00 after normalization:');
data.forEach(record => {
  const govType = record['Government Type'] || '';
  const normalized = normalizeIdForType(record['Jurisdiction ID'], govType);
  if (normalized.startsWith('00')) {
    console.log(`  ${record.Jurisdiction}: ${normalized} (raw: ${record['Jurisdiction ID']})`);
  }
});
