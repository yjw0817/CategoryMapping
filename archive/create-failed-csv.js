const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Read failed IDs
const failedIds = fs.readFileSync('failed_ids.txt', 'utf-8')
  .split('\n')
  .map(id => id.trim())
  .filter(id => id.length > 0);

console.log(`Found ${failedIds.length} failed IDs from PNG files`);

// Read category.csv
const csvContent = fs.readFileSync('category.csv', 'utf-8');
const allRecords = parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

// Filter records by failed IDs
const failedRecords = allRecords.filter(record => failedIds.includes(record.ID));

console.log(`Matched ${failedRecords.length} records in category.csv`);

// Write failed_items.csv
if (failedRecords.length > 0) {
  const csvData = stringify(failedRecords, {
    header: true,
    columns: ['Level', 'ID', 'Name', 'ParentID', 'ParentName', 'FullPath', 'URL']
  });

  fs.writeFileSync('failed_items.csv', csvData);
  console.log(`✅ Created failed_items.csv with ${failedRecords.length} items`);
} else {
  console.log('❌ No matching records found');
}

// Clean up
fs.unlinkSync('failed_ids.txt');
console.log('🧹 Cleaned up temporary file');
