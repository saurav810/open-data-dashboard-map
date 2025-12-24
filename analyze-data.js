// Quick analysis script to understand the data
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/portals.snapshot.json', 'utf8'));

console.log('Total records:', data.length);

const byIdLength = {};
const byGovType = {};
const collisions = {};

data.forEach(record => {
  const id = String(record['Jurisdiction ID'] || '').trim().replace(/^'+/, '');
  const len = id.length;
  byIdLength[len] = (byIdLength[len] || 0) + 1;
  
  const govType = record['Government Type'] || '';
  govType.split(',').forEach(type => {
    const t = type.trim();
    if (t) {
      byGovType[t] = (byGovType[t] || 0) + 1;
    }
  });
  
  const name = (record.Jurisdiction || '').toLowerCase();
  if (!collisions[name]) {
    collisions[name] = [];
  }
  collisions[name].push({
    id,
    type: govType
  });
});

console.log('\nRecords by ID length:');
Object.entries(byIdLength).sort().forEach(([len, count]) => {
  console.log(`  ${len} digits: ${count}`);
});

console.log('\nRecords by Government Type:');
Object.entries(byGovType).sort().forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log('\nName collisions:');
const nameCollisions = Object.entries(collisions).filter(([_, recs]) => recs.length > 1);
console.log(`Found ${nameCollisions.length} names with multiple records`);
nameCollisions.slice(0, 10).forEach(([name, recs]) => {
  console.log(`  "${name}": ${recs.length} records`);
  recs.forEach(r => console.log(`    - ${r.id} (${r.type})`));
});

// Check specific jurisdictions
console.log('\n Specific jurisdiction checks:');
const dallas = data.filter(r => r.Jurisdiction.toLowerCase().includes('dallas'));
console.log('Dallas jurisdictions:', dallas.map(r => `${r.Jurisdiction} (${r['Jurisdiction ID']})`));

const denver = data.filter(r => r.Jurisdiction.toLowerCase().includes('denver'));
console.log('Denver jurisdictions:', denver.map(r => `${r.Jurisdiction} (${r['Jurisdiction ID']})`));

const la = data.filter(r => r.Jurisdiction.toLowerCase().includes('los angeles'));
console.log('Los Angeles jurisdictions:', la.map(r => `${r.Jurisdiction} (${r['Jurisdiction ID']})`));
