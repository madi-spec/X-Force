/**
 * Search for Go-Forth details via Serper
 */
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '../.env.local') });

async function search() {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    console.error('SERP_API_KEY not set');
    process.exit(1);
  }

  const queries = [
    '"Go-Forth" "Leah Hazelwood" OR "Dennis Foster" OR COO OR CAO',
    '"Go-Forth" FieldRoutes case study testimonial',
    '"Go-Forth Pest" acquires OR acquired OR acquisition',
    '"Go-Forth" "third generation" OR "3rd generation" family',
    '"Go-Forth" "Chase Hazelwood" quote OR interview'
  ];

  for (const q of queries) {
    console.log('\n' + '='.repeat(60));
    console.log('Query:', q);
    console.log('='.repeat(60));

    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num: 5, gl: 'us', hl: 'en' })
    });

    const data = await res.json();
    if (data.organic) {
      data.organic.slice(0, 3).forEach((r: any, i: number) => {
        console.log(`\n${i + 1}. ${r.title}`);
        console.log(`   ${(r.snippet || '').substring(0, 250)}`);
        console.log(`   URL: ${r.link}`);
      });
    } else {
      console.log('No results');
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

search().catch(console.error);
