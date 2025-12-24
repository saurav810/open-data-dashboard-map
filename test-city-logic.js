// Test the city placement logic
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/portals.snapshot.json', 'utf8'));

console.log('Testing city GEOID logic...\n');

// Get all 7-digit city IDs
const cityRecords = data.filter(r => {
  const id = String(r['Jurisdiction ID'] || '').trim().replace(/^'+/, '');
  return id.length === 7;
});

console.log(`Found ${cityRecords.length} city records with 7-digit IDs`);

// Check Dallas
const dallas = cityRecords.find(r => r.Jurisdiction.toLowerCase().includes('dallas') && !r.Jurisdiction.toLowerCase().includes('county'));
if (dallas) {
  const id = String(dallas['Jurisdiction ID']).trim().replace(/^'+/, '');
  const stateFips = id.substring(0, 2);
  const placeCode = id.substring(2, 7);
  console.log(`\nDallas, TX:`);
  console.log(`  Full ID: ${id}`);
  console.log(`  State FIPS: ${stateFips} (Texas)`);
  console.log(`  Place code: ${placeCode}`);
  console.log(`  First 5 digits: ${id.substring(0, 5)} (NOT a county FIPS!)`);
}

// Check Denver
const denver = cityRecords.find(r => r.Jurisdiction.toLowerCase().includes('denver'));
if (denver) {
  const id = String(denver['Jurisdiction ID']).trim().replace(/^'+/, '');
  const stateFips = id.substring(0, 2);
  const placeCode = id.substring(2, 7);
  console.log(`\nDenver, CO:`);
  console.log(`  Full ID: ${id}`);
  console.log(`  State FIPS: ${stateFips} (Colorado)`);
  console.log(`  Place code: ${placeCode}`);
  console.log(`  First 5 digits: ${id.substring(0, 5)} (NOT a county FIPS!)`);
}

// Check Los Angeles
const la = cityRecords.find(r => r.Jurisdiction.toLowerCase() === 'los angeles, ca');
if (la) {
  const id = String(la['Jurisdiction ID']).trim().replace(/^'+/, '');
  const stateFips = id.substring(0, 2);
  const placeCode = id.substring(2, 7);
  console.log(`\nLos Angeles, CA:`);
  console.log(`  Full ID: ${id}`);
  console.log(`  State FIPS: ${stateFips} (California)`);
  console.log(`  Place code: ${placeCode}`);
  console.log(`  First 5 digits: ${id.substring(0, 5)} (NOT a county FIPS!)`);
}

// Check unique state FIPS codes in cities
const stateSet = new Set();
cityRecords.forEach(r => {
  const id = String(r['Jurisdiction ID'] || '').trim().replace(/^'+/, '');
  if (id.length === 7) {
    const stateFips = id.substring(0, 2);
    stateSet.add(stateFips);
  }
});

console.log(`\nCities span ${stateSet.size} different states`);
console.log('State FIPS codes:', Array.from(stateSet).sort());
