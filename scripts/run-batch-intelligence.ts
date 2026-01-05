/**
 * Batch Intelligence Processing Script
 * Runs research, extract, and strategy for all companies with valid domains
 *
 * Usage: npx tsx scripts/run-batch-intelligence.ts
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

async function processCompany(company: CompanyStatus): Promise<{
  research: boolean;
  extract: boolean;
  strategy: boolean;
  error?: string;
}> {
  const result = { research: false, extract: false, strategy: false, error: undefined as string | undefined };

  try {
    // Step 1: Research
    console.log(`    [1/3] Running research...`);
    const researchRes = await fetch(`${BASE_URL}/api/intelligence-v61/${company.id}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: company.domain }),
    });
    const researchData = await researchRes.json();

    if (researchData.success || researchData.confidence_score) {
      result.research = true;
      console.log(`    [1/3] Research complete (confidence: ${researchData.confidence_score || 'N/A'})`);
    } else {
      result.error = researchData.error || 'Research failed';
      console.log(`    [1/3] Research failed: ${result.error}`);
      return result;
    }

    // Step 2: Extract
    console.log(`    [2/3] Extracting data...`);
    const extractRes = await fetch(`${BASE_URL}/api/intelligence-v61/${company.id}/extract`, {
      method: 'POST',
    });
    const extractData = await extractRes.json();

    if (extractData.success) {
      result.extract = true;
      const contacts = extractData.updates?.contactsCreated || 0;
      console.log(`    [2/3] Extract complete (${contacts} contacts created)`);
    } else {
      result.error = extractData.error || 'Extract failed';
      console.log(`    [2/3] Extract failed: ${result.error}`);
      return result;
    }

    // Step 3: Strategy
    console.log(`    [3/3] Generating strategy...`);
    const strategyRes = await fetch(`${BASE_URL}/api/intelligence-v61/${company.id}/strategy`, {
      method: 'POST',
    });
    const strategyData = await strategyRes.json();

    if (strategyData.success) {
      result.strategy = true;
      console.log(`    [3/3] Strategy complete`);
    } else {
      result.error = strategyData.error || 'Strategy failed';
      console.log(`    [3/3] Strategy failed: ${result.error}`);
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.log(`    Error: ${result.error}`);
  }

  return result;
}

async function main() {
  console.log('='.repeat(70));
  console.log('  BATCH INTELLIGENCE PROCESSING');
  console.log('='.repeat(70));
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('');

  // Get current status
  console.log('  Fetching current status...');
  const statusResponse = await fetch(`${BASE_URL}/api/intelligence-v61/batch`);
  const status = await statusResponse.json();

  console.log('');
  console.log('  Current Status:');
  console.log(`    Total companies:  ${status.summary.totalCompanies}`);
  console.log(`    With domain:      ${status.summary.withDomain}`);
  console.log(`    Without domain:   ${status.summary.withoutDomain}`);
  console.log(`    ─────────────────────────`);
  console.log(`    Pending:          ${status.summary.pending}`);
  console.log(`    Researched only:  ${status.summary.researched}`);
  console.log(`    Extracted:        ${status.summary.extracted}`);
  console.log(`    Complete:         ${status.summary.complete}`);
  console.log('');

  // Get pending companies
  const pendingCompanies = status.companiesWithDomain.filter(
    (c: CompanyStatus) => c.status === 'pending'
  );

  if (pendingCompanies.length === 0) {
    console.log('  ✓ All companies have already been processed!');
    return;
  }

  console.log(`  Processing ${pendingCompanies.length} pending companies...`);
  console.log('  (Each company: Research → Extract → Strategy)');
  console.log('');
  console.log('─'.repeat(70));

  const startTime = Date.now();
  const results = {
    success: 0,
    partial: 0,
    failed: 0,
  };

  for (let i = 0; i < pendingCompanies.length; i++) {
    const company = pendingCompanies[i];
    const progress = `[${i + 1}/${pendingCompanies.length}]`;

    console.log('');
    console.log(`${progress} ${company.name}`);
    console.log(`    Domain: ${company.domain}`);

    const result = await processCompany(company);

    if (result.research && result.extract && result.strategy) {
      console.log(`    ✓ COMPLETE`);
      results.success++;
    } else if (result.research || result.extract) {
      console.log(`    ◐ PARTIAL (research: ${result.research}, extract: ${result.extract}, strategy: ${result.strategy})`);
      results.partial++;
    } else {
      console.log(`    ✗ FAILED`);
      results.failed++;
    }

    // Small delay between companies to avoid rate limits
    if (i < pendingCompanies.length - 1) {
      await sleep(1000);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('');
  console.log('═'.repeat(70));
  console.log('  BATCH PROCESSING COMPLETE');
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
