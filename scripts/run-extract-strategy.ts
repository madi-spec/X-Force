/**
 * Process companies that need Extract and/or Strategy
 * - "researched" status: needs Extract + Strategy
 * - "extracted" status: needs Strategy only
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface CompanyStatus {
  id: string;
  name: string;
  domain: string;
  status: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(70));
  console.log('  EXTRACT & STRATEGY PROCESSING');
  console.log('='.repeat(70));
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('');

  // Get current status
  console.log('  Fetching current status...');
  const statusResponse = await fetch(`${BASE_URL}/api/intelligence-v61/batch`);
  const status = await statusResponse.json();

  // Get companies needing extract (researched only)
  const needExtract = status.companiesWithDomain.filter(
    (c: CompanyStatus) => c.status === 'researched'
  );

  // Get companies needing strategy only (extracted)
  const needStrategy = status.companiesWithDomain.filter(
    (c: CompanyStatus) => c.status === 'extracted'
  );

  console.log('');
  console.log('  Companies to process:');
  console.log(`    Need Extract + Strategy: ${needExtract.length}`);
  console.log(`    Need Strategy only:      ${needStrategy.length}`);
  console.log(`    ─────────────────────────`);
  console.log(`    Total:                   ${needExtract.length + needStrategy.length}`);
  console.log('');
  console.log('─'.repeat(70));

  const startTime = Date.now();
  const results = { success: 0, partial: 0, failed: 0 };

  // Process companies needing Extract + Strategy
  if (needExtract.length > 0) {
    console.log('');
    console.log('  PHASE 1: Extract + Strategy');
    console.log('  ' + '─'.repeat(40));

    for (let i = 0; i < needExtract.length; i++) {
      const company = needExtract[i];
      const progress = `[${i + 1}/${needExtract.length}]`;

      console.log('');
      console.log(`${progress} ${company.name}`);

      try {
        // Extract
        console.log(`    [1/2] Extracting data...`);
        const extractRes = await fetch(`${BASE_URL}/api/intelligence-v61/${company.id}/extract`, {
          method: 'POST',
        });
        const extractData = await extractRes.json();

        if (!extractData.success) {
          console.log(`    [1/2] Extract failed: ${extractData.error || 'Unknown error'}`);
          results.failed++;
          continue;
        }

        const contacts = extractData.updates?.contactsCreated || 0;
        console.log(`    [1/2] Extract complete (${contacts} contacts)`);

        // Strategy
        console.log(`    [2/2] Generating strategy...`);
        const strategyRes = await fetch(`${BASE_URL}/api/intelligence-v61/${company.id}/strategy`, {
          method: 'POST',
        });
        const strategyData = await strategyRes.json();

        if (!strategyData.success) {
          console.log(`    [2/2] Strategy failed: ${strategyData.error || 'Unknown error'}`);
          results.partial++;
          continue;
        }

        console.log(`    [2/2] Strategy complete`);
        console.log(`    ✓ COMPLETE`);
        results.success++;

      } catch (error) {
        console.log(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.failed++;
      }

      // Small delay between companies
      if (i < needExtract.length - 1) {
        await sleep(500);
      }
    }
  }

  // Process companies needing Strategy only
  if (needStrategy.length > 0) {
    console.log('');
    console.log('  PHASE 2: Strategy Only');
    console.log('  ' + '─'.repeat(40));

    for (let i = 0; i < needStrategy.length; i++) {
      const company = needStrategy[i];
      const progress = `[${i + 1}/${needStrategy.length}]`;

      console.log('');
      console.log(`${progress} ${company.name}`);

      try {
        console.log(`    Generating strategy...`);
        const strategyRes = await fetch(`${BASE_URL}/api/intelligence-v61/${company.id}/strategy`, {
          method: 'POST',
        });
        const strategyData = await strategyRes.json();

        if (!strategyData.success) {
          console.log(`    Strategy failed: ${strategyData.error || 'Unknown error'}`);
          results.failed++;
          continue;
        }

        console.log(`    ✓ COMPLETE`);
        results.success++;

      } catch (error) {
        console.log(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.failed++;
      }

      // Small delay between companies
      if (i < needStrategy.length - 1) {
        await sleep(500);
      }
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('');
  console.log('═'.repeat(70));
  console.log('  PROCESSING COMPLETE');
  console.log('═'.repeat(70));
  console.log(`  Time elapsed: ${minutes}m ${seconds}s`);
  console.log('');
  console.log('  Results:');
  console.log(`    ✓ Complete:  ${results.success}`);
  console.log(`    ◐ Partial:   ${results.partial}`);
  console.log(`    ✗ Failed:    ${results.failed}`);
  console.log('');
}

main().catch(console.error);
