/**
 * Support Case UI Tests
 *
 * These tests verify that the support case UI follows X-FORCE architectural rules:
 * 1. UI reads ONLY from projections (read models)
 * 2. UI writes ONLY via command endpoints
 * 3. No direct database mutations in UI components
 *
 * Run with: npx tsx __tests__/support-case-ui.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  passed: boolean;
  name: string;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ passed: true, name });
    console.log(`✅ ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ passed: false, name, error: errorMsg });
    console.log(`❌ ${name}`);
    console.log(`   ${errorMsg}`);
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================================
// FILE STRUCTURE TESTS
// ============================================================================

test('Cases API routes exist', () => {
  const routes = [
    'src/app/api/cases/route.ts',
    'src/app/api/cases/[id]/route.ts',
    'src/app/api/cases/[id]/timeline/route.ts',
  ];

  for (const route of routes) {
    const fullPath = path.join(process.cwd(), route);
    expect(fs.existsSync(fullPath), `Missing API route: ${route}`);
  }
});

test('Cases page components exist', () => {
  const files = [
    'src/app/(dashboard)/cases/page.tsx',
    'src/app/(dashboard)/cases/loading.tsx',
    'src/app/(dashboard)/cases/[id]/page.tsx',
    'src/app/(dashboard)/cases/[id]/loading.tsx',
    'src/components/cases/CasesQueueList.tsx',
    'src/components/cases/CaseDetailView.tsx',
  ];

  for (const file of files) {
    const fullPath = path.join(process.cwd(), file);
    expect(fs.existsSync(fullPath), `Missing component: ${file}`);
  }
});

test('Engagement board components exist', () => {
  const files = [
    'src/app/(dashboard)/products/[slug]/engagement/page.tsx',
    'src/app/(dashboard)/products/[slug]/engagement/loading.tsx',
    'src/components/engagement/EngagementBoard.tsx',
  ];

  for (const file of files) {
    const fullPath = path.join(process.cwd(), file);
    expect(fs.existsSync(fullPath), `Missing component: ${file}`);
  }
});

// ============================================================================
// API ROUTE PATTERN TESTS
// ============================================================================

test('Cases list API reads from projection', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/cases/route.ts');
  const content = fs.readFileSync(routePath, 'utf-8');

  // Should read from support_case_read_model (projection)
  expect(
    content.includes('support_case_read_model'),
    'GET /api/cases should read from support_case_read_model projection'
  );

  // Should use command handler for POST
  expect(
    content.includes('createSupportCase'),
    'POST /api/cases should use createSupportCase command'
  );
});

test('Single case API reads from projection and uses commands', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/cases/[id]/route.ts');
  const content = fs.readFileSync(routePath, 'utf-8');

  // GET should read from projection
  expect(
    content.includes('support_case_read_model'),
    'GET /api/cases/[id] should read from support_case_read_model projection'
  );

  // POST should use commands
  const commands = [
    'assignSupportCase',
    'changeSupportCaseStatus',
    'changeSupportCaseSeverity',
    'resolveSupportCase',
    'closeSupportCase',
    'reopenSupportCase',
  ];

  for (const cmd of commands) {
    expect(
      content.includes(cmd),
      `POST /api/cases/[id] should import ${cmd} command`
    );
  }
});

test('Timeline API reads from event_store', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/cases/[id]/timeline/route.ts');
  const content = fs.readFileSync(routePath, 'utf-8');

  expect(
    content.includes('event_store'),
    'Timeline API should read from event_store'
  );

  expect(
    content.includes('SUPPORT_CASE_AGGREGATE_TYPE'),
    'Timeline API should filter by aggregate type'
  );
});

// ============================================================================
// UI COMPONENT PATTERN TESTS
// ============================================================================

test('CasesQueueList is a client component with filters', () => {
  const componentPath = path.join(process.cwd(), 'src/components/cases/CasesQueueList.tsx');
  const content = fs.readFileSync(componentPath, 'utf-8');

  expect(
    content.includes("'use client'"),
    'CasesQueueList should be a client component'
  );

  expect(
    content.includes('useState'),
    'CasesQueueList should use useState for filter state'
  );

  expect(
    content.includes('useMemo'),
    'CasesQueueList should use useMemo for filtered data'
  );
});

test('CaseDetailView calls API for commands', () => {
  const componentPath = path.join(process.cwd(), 'src/components/cases/CaseDetailView.tsx');
  const content = fs.readFileSync(componentPath, 'utf-8');

  expect(
    content.includes("'use client'"),
    'CaseDetailView should be a client component'
  );

  expect(
    content.includes('/api/cases/'),
    'CaseDetailView should call the cases API for commands'
  );

  expect(
    content.includes('method: \'POST\''),
    'CaseDetailView should use POST for command execution'
  );
});

test('Cases page fetches from server and passes to client', () => {
  const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/cases/page.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  // Should NOT be a client component
  expect(
    !content.includes("'use client'"),
    'Cases page should be a server component'
  );

  // Should read from projection
  expect(
    content.includes('support_case_read_model'),
    'Cases page should read from support_case_read_model'
  );

  // Should pass data to client component
  expect(
    content.includes('CasesQueueList'),
    'Cases page should render CasesQueueList'
  );
});

test('Case detail page fetches from server', () => {
  const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/cases/[id]/page.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  // Should NOT be a client component
  expect(
    !content.includes("'use client'"),
    'Case detail page should be a server component'
  );

  // Should read from projection
  expect(
    content.includes('support_case_read_model'),
    'Case detail page should read from support_case_read_model'
  );

  // Should read from event_store for timeline
  expect(
    content.includes('event_store'),
    'Case detail page should read from event_store for timeline'
  );
});

test('EngagementBoard reads from projections', () => {
  const pagePath = path.join(process.cwd(), 'src/app/(dashboard)/products/[slug]/engagement/page.tsx');
  const content = fs.readFileSync(pagePath, 'utf-8');

  // Should read from company_product_read_model
  expect(
    content.includes('company_product_read_model'),
    'Engagement page should read from company_product_read_model'
  );

  // Should read from company_product_open_case_counts
  expect(
    content.includes('company_product_open_case_counts'),
    'Engagement page should read from company_product_open_case_counts'
  );
});

// ============================================================================
// NO FORBIDDEN PATTERNS TESTS
// ============================================================================

test('UI components do not directly mutate database', () => {
  const componentFiles = [
    'src/components/cases/CasesQueueList.tsx',
    'src/components/cases/CaseDetailView.tsx',
    'src/components/engagement/EngagementBoard.tsx',
  ];

  const forbiddenPatterns = [
    '.insert(',
    '.update(',
    '.delete(',
    '.upsert(',
    'createAdminClient',
    'createServiceClient',
  ];

  for (const file of componentFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');

    for (const pattern of forbiddenPatterns) {
      expect(
        !content.includes(pattern),
        `${file} should not contain '${pattern}' - UI components must not directly mutate database`
      );
    }
  }
});

test('UI components do not import command handlers directly', () => {
  const componentFiles = [
    'src/components/cases/CasesQueueList.tsx',
    'src/components/cases/CaseDetailView.tsx',
    'src/components/engagement/EngagementBoard.tsx',
  ];

  const forbiddenImports = [
    '@/lib/supportCase/commands',
    'appendEvent',
    'createSupportCase',
    'assignSupportCase',
  ];

  for (const file of componentFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');

    for (const pattern of forbiddenImports) {
      expect(
        !content.includes(pattern),
        `${file} should not import '${pattern}' - UI components must call API endpoints`
      );
    }
  }
});

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('\n📋 Support Case UI Tests\n');
console.log('Testing architectural compliance for support case UI...\n');

// After all tests, print summary
setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n✅ ${passed} passed`);
  if (failed > 0) {
    console.log(`❌ ${failed} failed`);
    process.exit(1);
  }
  console.log('\nAll UI architecture tests passed!');
}, 0);
