/**
 * Check go-forth.com for Chase Hazelwood
 */

import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '../.env.local') });

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const html = await response.text();
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    console.log(`   Error: ${e}`);
    return null;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('CHECKING go-forth.com FOR CHASE HAZELWOOD');
  console.log('='.repeat(70));

  const urls = [
    'https://go-forth.com',
    'https://go-forth.com/about',
    'https://go-forth.com/about-us',
    'https://go-forth.com/team',
    'https://go-forth.com/our-team',
    'https://go-forth.com/meet-the-team',
    'https://go-forth.com/leadership',
    'https://go-forth.com/company',
    'https://www.go-forth.com',
    'https://www.go-forth.com/meet-the-team',
  ];

  for (const url of urls) {
    console.log(`\n--- ${url} ---`);
    const text = await fetchPage(url);
    if (text) {
      console.log(`   Length: ${text.length} chars`);

      // Search for key terms
      const searches = ['Chase Hazelwood', 'Hazelwood', 'CEO', 'Owner', 'President', 'generation'];
      for (const term of searches) {
        if (text.toLowerCase().includes(term.toLowerCase())) {
          const idx = text.toLowerCase().indexOf(term.toLowerCase());
          const start = Math.max(0, idx - 50);
          const end = Math.min(text.length, idx + term.length + 100);
          console.log(`   Found "${term}":`);
          console.log(`   "...${text.substring(start, end)}..."`);
        }
      }
    } else {
      console.log('   NOT FOUND or error');
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Also check if goforthpest.com redirects or relates to go-forth.com
  console.log('\n' + '='.repeat(70));
  console.log('COMPARING DOMAINS');
  console.log('='.repeat(70));

  console.log('\ngoforthpest.com homepage mentions:');
  const goforthpest = await fetchPage('https://goforthpest.com');
  if (goforthpest) {
    if (goforthpest.includes('go-forth.com')) console.log('   References go-forth.com');
    if (goforthpest.includes('Go-Forth Services')) console.log('   Company name: Go-Forth Services');
    if (goforthpest.includes('Go-Forth Pest')) console.log('   Company name: Go-Forth Pest');
  }

  console.log('\ngo-forth.com homepage mentions:');
  const goforth = await fetchPage('https://go-forth.com');
  if (goforth) {
    if (goforth.includes('goforthpest.com')) console.log('   References goforthpest.com');
    if (goforth.includes('Go-Forth Services')) console.log('   Company name: Go-Forth Services');
    if (goforth.includes('Go-Forth Pest')) console.log('   Company name: Go-Forth Pest');

    // Print first 500 chars
    console.log('\n   First 500 chars:');
    console.log('   ' + goforth.substring(0, 500));
  }
}

main().catch(console.error);
