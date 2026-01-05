/**
 * Debug script to investigate why Chase Hazelwood wasn't found
 */

import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '../.env.local') });

const BASE_URL = 'https://goforthpest.com';

// Page classification patterns (same as collector)
function classifyUrl(url: string): string {
  const lower = url.toLowerCase();
  if (/team|staff|leadership|people|meet-|our-people|management|executive/.test(lower)) return 'leadership';
  if (/about|story|history|company|who-we|heritage|our-mission/.test(lower)) return 'history';
  if (/service|pest|termite|rodent|mosquito|bed-bug|lawn|what-we-do|residential|commercial/.test(lower)) return 'services';
  if (/location|area|branch|city|region|where-we|coverage|office/.test(lower)) return 'locations';
  if (/blog|news|press|announcement|media|article|\/\d{4}\//.test(lower)) return 'news';
  if (/career|job|employment|hiring|join-|work-with|openings/.test(lower)) return 'careers';
  if (/contact|quote|schedule|request|get-started|free-estimate/.test(lower)) return 'contact';
  if (/testimonial|review|customer-stor|case-stud|success/.test(lower)) return 'reviews';
  return 'other';
}

async function fetchPage(url: string): Promise<{ html: string; text: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();

    // Extract text
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { html, text };
  } catch {
    return null;
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.includes('.pdf') || href.includes('.jpg') || href.includes('.png')) continue;

    try {
      const url = new URL(href, baseUrl);
      if (url.hostname === base.hostname || url.hostname === 'www.' + base.hostname) {
        let normalized = url.origin + url.pathname;
        normalized = normalized.replace(/\/$/, '');
        if (!links.includes(normalized)) {
          links.push(normalized);
        }
      }
    } catch {
      // Invalid URL
    }
  }
  return links;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('DEBUG: Go-Forth Pest Control Crawl Analysis');
  console.log('='.repeat(70));

  // Step 1: Discover all pages (2 levels deep)
  console.log('\n1. DISCOVERING PAGES...\n');

  const allPages = new Set<string>();
  const processedPages = new Set<string>();
  let pagesToProcess = [BASE_URL];

  for (let depth = 0; depth < 2 && pagesToProcess.length > 0; depth++) {
    const batch = [...pagesToProcess];
    pagesToProcess = [];

    console.log(`   Depth ${depth}: Processing ${batch.length} pages...`);

    for (const url of batch) {
      if (processedPages.has(url)) continue;
      processedPages.add(url);

      const page = await fetchPage(url);
      if (page) {
        const links = extractLinks(page.html, BASE_URL);
        for (const link of links) {
          if (!allPages.has(link) && !processedPages.has(link)) {
            allPages.add(link);
            if (depth < 1) pagesToProcess.push(link);
          }
        }
      }
      await new Promise(r => setTimeout(r, 100));

      if (processedPages.size >= 100) break;
    }
  }

  const pages = [BASE_URL, ...allPages];
  console.log(`\n   Total pages found: ${pages.length}`);

  // Step 2: Classify pages
  console.log('\n2. PAGE CLASSIFICATION:\n');

  const classified: Record<string, string[]> = {
    leadership: [],
    history: [],
    services: [],
    locations: [],
    other: [],
  };

  for (const url of pages) {
    const category = classifyUrl(url);
    if (!classified[category]) classified[category] = [];
    classified[category].push(url);
  }

  for (const [cat, urls] of Object.entries(classified)) {
    if (urls.length > 0) {
      console.log(`   ${cat}: ${urls.length} pages`);
      urls.slice(0, 5).forEach(u => console.log(`      - ${u.replace(BASE_URL, '')}`));
      if (urls.length > 5) console.log(`      ... and ${urls.length - 5} more`);
    }
  }

  // Step 3: Fetch and analyze leadership pages
  console.log('\n' + '='.repeat(70));
  console.log('3. LEADERSHIP PAGES CONTENT:');
  console.log('='.repeat(70));

  for (const url of classified.leadership) {
    console.log(`\n--- ${url} ---`);
    const page = await fetchPage(url);
    if (page) {
      // Show first 2000 chars
      console.log(page.text.substring(0, 2000));
      console.log('\n[... truncated ...]');
    } else {
      console.log('   [Failed to fetch]');
    }
  }

  // Step 4: Fetch and analyze history/about pages
  console.log('\n' + '='.repeat(70));
  console.log('4. HISTORY/ABOUT PAGES CONTENT:');
  console.log('='.repeat(70));

  for (const url of classified.history.slice(0, 3)) {
    console.log(`\n--- ${url} ---`);
    const page = await fetchPage(url);
    if (page) {
      console.log(page.text.substring(0, 2000));
      console.log('\n[... truncated ...]');
    } else {
      console.log('   [Failed to fetch]');
    }
  }

  // Step 5: Search for specific names
  console.log('\n' + '='.repeat(70));
  console.log('5. SEARCHING FOR "Chase Hazelwood":');
  console.log('='.repeat(70));

  const searchTerms = ['Chase Hazelwood', 'Hazelwood', 'David Spillman', 'Spillman'];

  // Check key pages
  const keyUrls = [
    BASE_URL,
    `${BASE_URL}/about`,
    `${BASE_URL}/about-us`,
    `${BASE_URL}/our-story`,
    `${BASE_URL}/company`,
    `${BASE_URL}/team`,
    `${BASE_URL}/our-team`,
    `${BASE_URL}/meet-the-team`,
    `${BASE_URL}/leadership`,
    ...classified.leadership,
    ...classified.history,
  ];

  const uniqueUrls = [...new Set(keyUrls)];

  for (const url of uniqueUrls) {
    const page = await fetchPage(url);
    if (!page) continue;

    const matches: string[] = [];
    for (const term of searchTerms) {
      const regex = new RegExp(term, 'gi');
      const found = page.text.match(regex);
      if (found) {
        matches.push(`"${term}": ${found.length}x`);

        // Show context around the match
        const idx = page.text.toLowerCase().indexOf(term.toLowerCase());
        if (idx >= 0) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(page.text.length, idx + term.length + 100);
          console.log(`\n   ${url.replace(BASE_URL, '') || '/'}`);
          console.log(`   Found ${term}:`);
          console.log(`   "...${page.text.substring(start, end)}..."`);
        }
      }
    }
  }

  // Step 6: Check specific URLs that might exist
  console.log('\n' + '='.repeat(70));
  console.log('6. CHECKING SPECIFIC URLS:');
  console.log('='.repeat(70));

  const checkUrls = [
    `${BASE_URL}/about`,
    `${BASE_URL}/about-us`,
    `${BASE_URL}/our-story`,
    `${BASE_URL}/company`,
    `${BASE_URL}/company/about`,
    `${BASE_URL}/team`,
    `${BASE_URL}/our-team`,
    `${BASE_URL}/meet-the-team`,
    `${BASE_URL}/leadership`,
    `${BASE_URL}/management`,
  ];

  for (const url of checkUrls) {
    const page = await fetchPage(url);
    const status = page ? 'EXISTS' : 'NOT FOUND';
    console.log(`   ${status}: ${url.replace(BASE_URL, '')}`);
  }

  // Step 7: Check the homepage for owner mentions
  console.log('\n' + '='.repeat(70));
  console.log('7. HOMEPAGE ANALYSIS:');
  console.log('='.repeat(70));

  const homepage = await fetchPage(BASE_URL);
  if (homepage) {
    // Look for owner/CEO patterns
    const ownerPatterns = [
      /(?:CEO|Owner|President|Founder)[:\s,]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)[,\s]+(?:CEO|Owner|President)/gi,
      /family[\s-]*owned/gi,
      /generation/gi,
    ];

    for (const pattern of ownerPatterns) {
      const matches = homepage.text.match(pattern);
      if (matches) {
        console.log(`\n   Pattern: ${pattern}`);
        matches.forEach(m => console.log(`   Match: "${m}"`));
      }
    }
  }
}

main().catch(console.error);
