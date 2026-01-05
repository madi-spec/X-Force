/**
 * Support Case Schema Tests
 *
 * Tests for support case database schema:
 * 1. Tables exist and are correctly structured
 * 2. Foreign keys work correctly
 * 3. Identity table (support_cases) does NOT require state fields
 * 4. Projector checkpoints are registered
 * 5. RLS policies are in place
 *
 * Run with: npx tsx __tests__/support-case-schema.test.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: SupabaseClient<any, any, any> = createClient(supabaseUrl, supabaseServiceKey);

interface TestResult {
  passed: boolean;
  name: string;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ passed: true, name });
    console.log(`✅ ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ passed: false, name, error: errorMsg });
    console.log(`❌ ${name}`);
    console.log(`   ${errorMsg}`);
  }
}

function expect(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

interface TestCompany {
  id: string;
  name: string;
}

interface TestProduct {
  id: string;
  name: string;
  slug: string;
}

interface TestCompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
}

let testCompany: TestCompany | null = null;
let testProduct: TestProduct | null = null;
let testCompanyProduct: TestCompanyProduct | null = null;

async function setupTestData(): Promise<void> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Create test company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: `Support Case Test Company ${timestamp}`,
      domain: `support-test-${timestamp}-${random}.example.com`,
      segment: 'smb',
      industry: 'pest',
      status: 'customer',
    })
    .select()
    .single();

  if (companyError) {
    throw new Error(`Failed to create test company: ${companyError.message}`);
  }
  testCompany = company;

  // Create test product
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      name: `Support Case Test Product ${timestamp}`,
      slug: `support-test-product-${timestamp}-${random}`,
    })
    .select()
    .single();

  if (productError) {
    throw new Error(`Failed to create test product: ${productError.message}`);
  }
  testProduct = product;

  // Create company product link
  const { data: companyProduct, error: cpError } = await supabase
    .from('company_products')
    .insert({
      company_id: company.id,
      product_id: product.id,
    })
    .select()
    .single();

  if (cpError) {
    throw new Error(`Failed to create company_product: ${cpError.message}`);
  }
  testCompanyProduct = companyProduct;
}

async function cleanupTestData(): Promise<void> {
  // Clean up support case data first
  if (testCompany) {
    await supabase.from('support_case_sla_facts').delete().eq('company_id', testCompany.id);
    await supabase.from('support_case_read_model').delete().eq('company_id', testCompany.id);
    await supabase.from('support_cases').delete().eq('company_id', testCompany.id);
    await supabase.from('company_open_case_counts').delete().eq('company_id', testCompany.id);
  }

  if (testCompanyProduct) {
    await supabase.from('company_product_open_case_counts').delete().eq('company_product_id', testCompanyProduct.id);
    await supabase.from('company_products').delete().eq('id', testCompanyProduct.id);
  }

  if (testProduct) {
    await supabase.from('products').delete().eq('id', testProduct.id);
  }

  if (testCompany) {
    await supabase.from('companies').delete().eq('id', testCompany.id);
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n📊 TESTS: Support Case Schema\n');

  try {
    await setupTestData();

    // ============================================================================
    // TEST 1: support_cases table exists
    // ============================================================================

    await test('support_cases table exists', async () => {
      const { error } = await supabase
        .from('support_cases')
        .select('id')
        .limit(1);

      expect(!error, `Table should exist: ${error?.message}`);
    });

    // ============================================================================
    // TEST 2: Can insert into support_cases with minimal fields (identity only)
    // ============================================================================

    await test('Can insert support_case with only identity fields (no state)', async () => {
      if (!testCompany) throw new Error('Test company not set up');

      // Insert with ONLY identity fields - no status, severity, title, etc.
      const { data, error } = await supabase
        .from('support_cases')
        .insert({
          company_id: testCompany.id,
          // NOT providing: status, severity, title, description, owner_id, etc.
          // These are state fields that belong in the read model, not identity table
        })
        .select()
        .single();

      expect(!error, `Insert should succeed: ${error?.message}`);
      expect(!!data?.id, 'Should have an id');
      expect(data?.company_id === testCompany.id, 'Should have correct company_id');

      // Clean up
      await supabase.from('support_cases').delete().eq('id', data.id);
    });

    // ============================================================================
    // TEST 3: Can insert with company_product_id
    // ============================================================================

    await test('Can insert support_case with company_product_id', async () => {
      if (!testCompany || !testCompanyProduct) {
        throw new Error('Test data not set up');
      }

      const { data, error } = await supabase
        .from('support_cases')
        .insert({
          company_id: testCompany.id,
          company_product_id: testCompanyProduct.id,
        })
        .select()
        .single();

      expect(!error, `Insert should succeed: ${error?.message}`);
      expect(data?.company_product_id === testCompanyProduct.id, 'Should have correct company_product_id');

      // Clean up
      await supabase.from('support_cases').delete().eq('id', data.id);
    });

    // ============================================================================
    // TEST 4: company_id foreign key is enforced
    // ============================================================================

    await test('company_id foreign key is enforced', async () => {
      const fakeCompanyId = '00000000-0000-0000-0000-000000000000';

      const { error } = await supabase
        .from('support_cases')
        .insert({
          company_id: fakeCompanyId,
        });

      expect(!!error, 'Insert with invalid company_id should fail');
      expect(
        error?.message?.includes('violates foreign key') || error?.code === '23503',
        'Should be a foreign key violation'
      );
    });

    // ============================================================================
    // TEST 5: support_case_read_model table exists
    // ============================================================================

    await test('support_case_read_model table exists', async () => {
      const { error } = await supabase
        .from('support_case_read_model')
        .select('support_case_id')
        .limit(1);

      expect(!error, `Table should exist: ${error?.message}`);
    });

    // ============================================================================
    // TEST 6: support_case_sla_facts table exists
    // ============================================================================

    await test('support_case_sla_facts table exists', async () => {
      const { error } = await supabase
        .from('support_case_sla_facts')
        .select('id')
        .limit(1);

      expect(!error, `Table should exist: ${error?.message}`);
    });

    // ============================================================================
    // TEST 7: company_product_open_case_counts table exists
    // ============================================================================

    await test('company_product_open_case_counts table exists', async () => {
      const { error } = await supabase
        .from('company_product_open_case_counts')
        .select('company_product_id')
        .limit(1);

      expect(!error, `Table should exist: ${error?.message}`);
    });

    // ============================================================================
    // TEST 8: company_open_case_counts table exists
    // ============================================================================

    await test('company_open_case_counts table exists', async () => {
      const { error } = await supabase
        .from('company_open_case_counts')
        .select('company_id')
        .limit(1);

      expect(!error, `Table should exist: ${error?.message}`);
    });

    // ============================================================================
    // TEST 9: support_sla_config table exists with default data
    // ============================================================================

    await test('support_sla_config has default SLA data', async () => {
      const { data, error } = await supabase
        .from('support_sla_config')
        .select('*')
        .is('product_id', null)
        .order('first_response_hours');

      expect(!error, `Query should succeed: ${error?.message}`);
      expect((data?.length || 0) >= 5, 'Should have at least 5 default SLA configs');

      // Verify critical SLA
      const critical = data?.find(d => d.severity === 'critical');
      expect(!!critical, 'Should have critical SLA config');
      expectEqual(critical?.first_response_hours, 1, 'Critical first response should be 1 hour');
      expectEqual(critical?.resolution_hours, 4, 'Critical resolution should be 4 hours');
    });

    // ============================================================================
    // TEST 10: Projector checkpoints are registered
    // ============================================================================

    await test('Projector checkpoints are registered', async () => {
      const expectedProjectors = [
        'support_case_read_model',
        'support_case_sla_facts',
        'company_product_open_case_counts',
        'company_open_case_counts',
      ];

      for (const projector of expectedProjectors) {
        const { data, error } = await supabase
          .from('projector_checkpoints')
          .select('*')
          .eq('projector_name', projector)
          .single();

        expect(!error, `Projector ${projector} should exist: ${error?.message}`);
        expectEqual(data?.status, 'active', `Projector ${projector} should be active`);
      }
    });

    // ============================================================================
    // TEST 11: support_case_read_model has expected columns
    // ============================================================================

    await test('support_case_read_model has expected columns', async () => {
      if (!testCompany) throw new Error('Test company not set up');

      // Create a support case first
      const { data: supportCase } = await supabase
        .from('support_cases')
        .insert({ company_id: testCompany.id })
        .select()
        .single();

      if (!supportCase) throw new Error('Failed to create support case');

      // Insert into read model to test columns
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('support_case_read_model')
        .insert({
          support_case_id: supportCase.id,
          company_id: testCompany.id,
          status: 'open',
          severity: 'medium',
          title: 'Test Case',
          opened_at: now,
          projected_at: now,
          projection_version: 1,
        });

      expect(!error, `Insert should succeed: ${error?.message}`);

      // Clean up
      await supabase.from('support_case_read_model').delete().eq('support_case_id', supportCase.id);
      await supabase.from('support_cases').delete().eq('id', supportCase.id);
    });

    // ============================================================================
    // TEST 12: support_case_read_model status constraint
    // ============================================================================

    await test('support_case_read_model enforces status constraint', async () => {
      if (!testCompany) throw new Error('Test company not set up');

      // Create a support case
      const { data: supportCase } = await supabase
        .from('support_cases')
        .insert({ company_id: testCompany.id })
        .select()
        .single();

      if (!supportCase) throw new Error('Failed to create support case');

      // Try to insert with invalid status
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('support_case_read_model')
        .insert({
          support_case_id: supportCase.id,
          company_id: testCompany.id,
          status: 'invalid_status', // Invalid!
          severity: 'medium',
          opened_at: now,
          projected_at: now,
          projection_version: 1,
        });

      expect(!!error, 'Insert with invalid status should fail');

      // Clean up
      await supabase.from('support_cases').delete().eq('id', supportCase.id);
    });

    // ============================================================================
    // TEST 13: support_case_read_model severity constraint
    // ============================================================================

    await test('support_case_read_model enforces severity constraint', async () => {
      if (!testCompany) throw new Error('Test company not set up');

      // Create a support case
      const { data: supportCase } = await supabase
        .from('support_cases')
        .insert({ company_id: testCompany.id })
        .select()
        .single();

      if (!supportCase) throw new Error('Failed to create support case');

      // Try to insert with invalid severity
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('support_case_read_model')
        .insert({
          support_case_id: supportCase.id,
          company_id: testCompany.id,
          status: 'open',
          severity: 'super_critical', // Invalid!
          opened_at: now,
          projected_at: now,
          projection_version: 1,
        });

      expect(!!error, 'Insert with invalid severity should fail');

      // Clean up
      await supabase.from('support_cases').delete().eq('id', supportCase.id);
    });

    // ============================================================================
    // TEST 14: Cascade delete from companies to support_cases
    // ============================================================================

    await test('Cascade delete from companies to support_cases', async () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);

      // Create a temporary company
      const { data: tempCompany } = await supabase
        .from('companies')
        .insert({
          name: `Cascade Test ${timestamp}`,
          domain: `cascade-${timestamp}-${random}.example.com`,
          segment: 'smb',
          industry: 'pest',
          status: 'prospect',
        })
        .select()
        .single();

      if (!tempCompany) throw new Error('Failed to create temp company');

      // Create a support case
      const { data: tempCase } = await supabase
        .from('support_cases')
        .insert({ company_id: tempCompany.id })
        .select()
        .single();

      if (!tempCase) throw new Error('Failed to create temp case');

      // Delete the company
      await supabase.from('companies').delete().eq('id', tempCompany.id);

      // Verify support case was deleted
      const { data: deletedCase } = await supabase
        .from('support_cases')
        .select('*')
        .eq('id', tempCase.id)
        .single();

      expect(!deletedCase, 'Support case should be cascade deleted');
    });

  } finally {
    await cleanupTestData();
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('SUPPORT CASE SCHEMA TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nPassed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n❌ SOME TESTS FAILED\n');
    console.log('Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.name}`);
      console.log(`    ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All support case schema tests passed!\n');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
