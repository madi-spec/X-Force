import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'docs', 'linked_contacts_to_customers_with_ATS_or_Rev_and_revenue.xlsx');

console.log('Reading Excel file:', filePath);

const workbook = XLSX.readFile(filePath);

console.log('\nSheet names:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // Show headers (first row)
  if (data.length > 0) {
    console.log('\nHeaders:', data[0]);
  }

  // Show first 5 rows of data
  console.log('\nFirst 5 data rows:');
  for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
  }

  console.log(`\nTotal rows: ${data.length - 1} (excluding header)`);
}
