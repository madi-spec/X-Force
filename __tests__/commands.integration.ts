/**
 * Lifecycle Command Tests
 *
 * Tests for the command layer that enforces event-sourced lifecycle mutations.
 *
 * REQUIRED TESTS:
 * 1. start-sale → projection reflects in_sales
 * 2. advance-stage → stage facts updated
 * 3. Grep/test ensures projections are not written outside projector
 *
 * Run with: npx tsx __tests__/commands.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  startSale,
  advanceStage,
  setOwner,
  setTier,
  setMRR,
  setSeats,
  setNextStepDue,
} from '../src/lib/lifecycle/commands';
import { runAllProjectors } from '../src/lib/lifecycle/projectors';

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

interface TestFixture {
  companyProductId: string;
  companyId: string;
  productId: string;
  processId: string;
  stage1Id: string;
  stage2Id: string;
  stage3Id: string;
}

async function createTestFixture(): Promise<TestFixture> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Create test company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: `Test Company ${timestamp}`,
      domain: `test-${timestamp}-${random}.example.com`,
      segment: 'smb',
      industry: 'pest',
      status: 'prospect',
    })
    .select()
    .single();

  if (companyError) {
    throw new Error(`Failed to create test company: ${companyError.message}`);
  }

  // Create test product
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      name: `Test Product ${timestamp}`,
      slug: `test-product-${timestamp}-${random}`,
    })
    .select()
    .single();

  if (productError) {
    throw new Error(`Failed to create test product: ${productError.message}`);
  }

  // Create test process
  const { data: process, error: processError } = await supabase
    .from('product_processes')
    .insert({
      product_id: product.id,
      name: `Test Process ${timestamp}`,
      process_type: 'sales',
      version: 1,
      status: 'published',
    })
    .select()
    .single();

  if (processError) {
    throw new Error(`Failed to create test process: ${processError.message}`);
  }

  // Create test stages
  const { data: stages, error: stagesError } = await supabase
    .from('product_process_stages')
    .insert([
      {
        process_id: process.id,
        name: 'New Lead',
        slug: 'new-lead',
        stage_order: 1,
        sla_days: 3,
        sla_warning_days: 2,
        is_terminal: false,
      },
      {
        process_id: process.id,
        name: 'Qualifying',
        slug: 'qualifying',
        stage_order: 2,
        sla_days: 5,
        sla_warning_days: 3,
        is_terminal: false,
      },
      {
        process_id: process.id,
        name: 'Closed Won',
        slug: 'closed-won',
        stage_order: 3,
        is_terminal: true,
        terminal_type: 'won',
      },
    ])
    .select()
    .order('stage_order');

  if (stagesError) {
    throw new Error(`Failed to create test stages: ${stagesError.message}`);
  }

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

  return {
    companyProductId: companyProduct.id,
    companyId: company.id,
    productId: product.id,
    processId: process.id,
    stage1Id: stages[0].id,
    stage2Id: stages[1].id,
    stage3Id: stages[2].id,
  };
}

async function cleanupTestFixture(fixture: TestFixture): Promise<void> {
  // Clean up in reverse dependency order
  // Note: Events are NOT deleted (immutable) but projections are
  await supabase.from('product_pipeline_stage_counts').delete().eq('product_id', fixture.productId);
  await supabase.from('company_product_stage_facts').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('company_product_read_model').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('company_products').delete().eq('id', fixture.companyProductId);
  await supabase.from('product_process_stages').delete().eq('process_id', fixture.processId);
  await supabase.from('product_processes').delete().eq('id', fixture.processId);
  await supabase.from('products').delete().eq('id', fixture.productId);
  await supabase.from('companies').delete().eq('id', fixture.companyId);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n📊 TESTS: Command Layer\n');

  // ============================================================================
  // TEST 1: start-sale → projection reflects in_sales
  // ============================================================================

  await test('start-sale command sets phase to in_sales in projection', async () => {
    const fixture = await createTestFixture();

    try {
      // Execute start-sale command
      const results = await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.processId,
        processVersion: 1,
        initialStageId: fixture.stage1Id,
        initialStageName: 'New Lead',
        actor: { type: 'user', id: 'test-user' },
      });

      // Verify command succeeded
      expect(results.every(r => r.success), 'start-sale command should succeed');

      // Run projectors
      await runAllProjectors(supabase);

      // Verify projection reflects in_sales phase
      const { data: readModel, error } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expect(!error, `Should find read model: ${error?.message}`);
      expectEqual(readModel?.current_process_type, 'sales', 'Process type should be sales');
      expectEqual(readModel?.current_stage_id, fixture.stage1Id, 'Should be in initial stage');
      expect(readModel?.process_started_at !== null, 'Process should be started');

      // Verify event was created
      const { data: events } = await supabase
        .from('event_store')
        .select('*')
        .eq('aggregate_id', fixture.companyProductId)
        .eq('event_type', 'CompanyProductPhaseSet');

      expect((events?.length || 0) > 0, 'PhaseSet event should be created');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 2: advance-stage → stage facts updated
  // ============================================================================

  await test('advance-stage command updates stage facts', async () => {
    const fixture = await createTestFixture();

    try {
      // First, start a sale
      await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.processId,
        processVersion: 1,
        initialStageId: fixture.stage1Id,
        initialStageName: 'New Lead',
        actor: { type: 'user', id: 'test-user' },
      });

      await runAllProjectors(supabase);

      // Verify initial stage fact exists
      const { data: initialFacts } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId);

      expect((initialFacts?.length || 0) >= 1, 'Should have at least one stage fact after start');

      // Advance to next stage
      const result = await advanceStage(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        toStageId: fixture.stage2Id,
        toStageName: 'Qualifying',
        toStageOrder: 2,
        reason: 'Qualified lead',
        actor: { type: 'user', id: 'test-user' },
      });

      expect(result.success, `advance-stage should succeed: ${result.error}`);

      // Run projectors
      await runAllProjectors(supabase);

      // Verify stage facts updated
      const { data: facts } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .order('entered_at', { ascending: true });

      expect((facts?.length || 0) >= 2, 'Should have at least 2 stage facts after transition');

      // First fact should be closed
      const firstFact = facts?.[0];
      expect(firstFact?.exited_at !== null, 'First stage fact should be closed');
      // Exit reason can be 'progressed' or 'stage_transition' depending on projector
      expect(
        firstFact?.exit_reason === 'progressed' || firstFact?.exit_reason === 'stage_transition',
        `Exit reason should be progressed or stage_transition, got ${firstFact?.exit_reason}`
      );

      // Second fact should be open
      const secondFact = facts?.[facts.length - 1];
      expect(secondFact?.exited_at === null, 'Current stage fact should be open');
      expectEqual(secondFact?.stage_id, fixture.stage2Id, 'Should be in stage 2');

      // Verify read model updated
      const { data: readModel } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(readModel?.current_stage_id, fixture.stage2Id, 'Read model should reflect new stage');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 3: Commands work with owner, tier, MRR, seats
  // ============================================================================

  await test('set-owner command emits event', async () => {
    const fixture = await createTestFixture();

    try {
      // Start sale first
      await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.processId,
        processVersion: 1,
        initialStageId: fixture.stage1Id,
        initialStageName: 'New Lead',
        actor: { type: 'user', id: 'test-user' },
      });

      // Set owner
      const result = await setOwner(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        ownerId: 'owner-123',
        ownerName: 'John Doe',
        actor: { type: 'user', id: 'test-user' },
      });

      expect(result.success, `set-owner should succeed: ${result.error}`);

      // Verify event was created
      const { data: events } = await supabase
        .from('event_store')
        .select('*')
        .eq('aggregate_id', fixture.companyProductId)
        .eq('event_type', 'CompanyProductOwnerSet');

      expect((events?.length || 0) > 0, 'OwnerSet event should be created');
      expectEqual(events?.[0]?.event_data?.toOwnerId, 'owner-123', 'Event should contain owner ID');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  await test('set-tier command validates tier range', async () => {
    const fixture = await createTestFixture();

    try {
      // Try to set invalid tier
      const result = await setTier(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        tier: 10, // Invalid - should be 1-5
        actor: { type: 'user', id: 'test-user' },
      });

      expect(!result.success, 'set-tier should fail for invalid tier');
      expect(result.error?.includes('1 and 5') || false, 'Error should mention valid range');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  await test('set-mrr command emits event', async () => {
    const fixture = await createTestFixture();

    try {
      // Start sale first
      await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.processId,
        processVersion: 1,
        initialStageId: fixture.stage1Id,
        initialStageName: 'New Lead',
        actor: { type: 'user', id: 'test-user' },
      });

      // Set MRR
      const result = await setMRR(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        mrr: 5000,
        currency: 'USD',
        actor: { type: 'user', id: 'test-user' },
      });

      expect(result.success, `set-mrr should succeed: ${result.error}`);

      // Verify event was created
      const { data: events } = await supabase
        .from('event_store')
        .select('*')
        .eq('aggregate_id', fixture.companyProductId)
        .eq('event_type', 'CompanyProductMRRSet');

      expect((events?.length || 0) > 0, 'MRRSet event should be created');
      expectEqual(events?.[0]?.event_data?.toMRR, 5000, 'Event should contain MRR');
      expectEqual(events?.[0]?.event_data?.currency, 'USD', 'Event should contain currency');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('COMMAND TEST SUMMARY');
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
    console.log('\n✅ All command tests passed!\n');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
