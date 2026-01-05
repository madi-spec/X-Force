/**
 * Projector Tests
 *
 * Tests for the event-sourced lifecycle projectors.
 * Verifies projection correctness, idempotency, and invariants.
 *
 * Run with: npx tsx __tests__/projectors.test.ts
 *
 * Prerequisites:
 * - Supabase local or remote connection configured
 * - All lifecycle migrations applied
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  // Events
  createProcessSetEvent,
  createStageSetEvent,
  createProcessCompletedEvent,
  // Commands
  appendEvent,
  // Projectors
  runAllProjectors,
  rebuildAllProjectors,
} from '../src/lib/lifecycle';

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

  // Create test company_product
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

  // Create test process
  const { data: process, error: processError } = await supabase
    .from('product_processes')
    .insert({
      product_id: product.id,
      process_type: 'sales',
      name: `Test Sales Process ${timestamp}`,
      status: 'published',
    })
    .select()
    .single();

  if (processError) {
    throw new Error(`Failed to create process: ${processError.message}`);
  }

  // Create test stages
  const stages = [
    { name: 'New Lead', slug: 'new-lead', stage_order: 1, sla_days: 3 },
    { name: 'Qualifying', slug: 'qualifying', stage_order: 2, sla_days: 5 },
    { name: 'Closed Won', slug: 'closed-won', stage_order: 3, is_terminal: true, terminal_type: 'won' },
  ];

  const stageIds: string[] = [];

  for (const stage of stages) {
    const { data: stageData, error: stageError } = await supabase
      .from('product_process_stages')
      .insert({
        process_id: process.id,
        ...stage,
      })
      .select()
      .single();

    if (stageError) {
      throw new Error(`Failed to create stage: ${stageError.message}`);
    }
    stageIds.push(stageData.id);
  }

  return {
    companyProductId: companyProduct.id,
    companyId: company.id,
    productId: product.id,
    processId: process.id,
    stage1Id: stageIds[0],
    stage2Id: stageIds[1],
    stage3Id: stageIds[2],
  };
}

async function cleanupTestFixture(fixture: TestFixture): Promise<void> {
  // Delete in reverse dependency order
  await supabase.from('product_pipeline_stage_counts').delete().eq('product_id', fixture.productId);
  await supabase.from('company_product_stage_facts').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('company_product_read_model').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('event_store').delete().eq('aggregate_id', fixture.companyProductId);
  await supabase.from('product_process_stages').delete().eq('process_id', fixture.processId);
  await supabase.from('product_processes').delete().eq('id', fixture.processId);
  await supabase.from('company_products').delete().eq('id', fixture.companyProductId);
  await supabase.from('products').delete().eq('id', fixture.productId);
  await supabase.from('companies').delete().eq('id', fixture.companyId);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests(): Promise<void> {
  // ============================================================================
  // TESTS: STAGE FACTS INVARIANTS
  // ============================================================================

  console.log('\n📊 TESTS: Stage Facts Invariants\n');

  await test('Stage transition closes previous stage fact', async () => {
    const fixture = await createTestFixture();

    try {
      // 1. Start process with initial stage
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      // Run projectors
      await runAllProjectors(supabase);

      // Verify first stage fact is open
      const { data: facts1 } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId);

      expectEqual(facts1?.length, 1, 'Should have 1 stage fact');
      expect(facts1![0].exited_at === null, 'First stage should be open');
      expectEqual(facts1![0].stage_id, fixture.stage1Id, 'Should be in stage 1');

      // 2. Transition to stage 2
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createStageSetEvent(
          {
            fromStageId: fixture.stage1Id,
            fromStageName: 'New Lead',
            fromStageOrder: 1,
            toStageId: fixture.stage2Id,
            toStageName: 'Qualifying',
            toStageOrder: 2,
            isProgression: true,
          },
          { type: 'user', id: 'test-user' }
        ),
      });

      // Run projectors
      await runAllProjectors(supabase);

      // Verify: previous closed, new opened
      const { data: facts2 } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .order('entered_at', { ascending: true });

      expectEqual(facts2?.length, 2, 'Should have 2 stage facts');

      // First fact should be closed
      expect(facts2![0].exited_at !== null, 'First stage should be closed');
      expect(facts2![0].duration_seconds !== null, 'Should have duration');
      expectEqual(facts2![0].exit_reason, 'progressed', 'Exit reason should be progressed');

      // Second fact should be open
      expect(facts2![1].exited_at === null, 'Second stage should be open');
      expectEqual(facts2![1].stage_id, fixture.stage2Id, 'Should be in stage 2');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  await test('Exactly one open stage fact exists per company product', async () => {
    const fixture = await createTestFixture();

    try {
      // Create multiple stage transitions
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createStageSetEvent(
          {
            fromStageId: fixture.stage1Id,
            fromStageName: 'New Lead',
            fromStageOrder: 1,
            toStageId: fixture.stage2Id,
            toStageName: 'Qualifying',
            toStageOrder: 2,
            isProgression: true,
          },
          { type: 'user', id: 'test-user' }
        ),
      });

      // Run projectors
      await runAllProjectors(supabase);

      // Count open stage facts
      const { data: openFacts, error } = await supabase
        .from('company_product_stage_facts')
        .select('id')
        .eq('company_product_id', fixture.companyProductId)
        .is('exited_at', null);

      expect(!error, `Query should succeed: ${error?.message}`);
      expectEqual(openFacts?.length, 1, 'Should have exactly 1 open stage fact');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  await test('Process completion closes final stage fact', async () => {
    const fixture = await createTestFixture();

    try {
      // Start process
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      // Complete process
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessCompletedEvent(
          {
            processId: fixture.processId,
            processType: 'sales',
            terminalStageId: fixture.stage3Id,
            terminalStageName: 'Closed Won',
            outcome: 'won',
            durationDays: 5,
            stageTransitionCount: 1,
          },
          { type: 'user', id: 'test-user' }
        ),
      });

      // Run projectors
      await runAllProjectors(supabase);

      // All stage facts should be closed
      const { data: openFacts } = await supabase
        .from('company_product_stage_facts')
        .select('id')
        .eq('company_product_id', fixture.companyProductId)
        .is('exited_at', null);

      expectEqual(openFacts?.length, 0, 'Should have no open stage facts after completion');

      // Verify last fact has completed exit reason
      const { data: facts } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      expectEqual(facts?.exit_reason, 'completed', 'Final stage should have completed exit reason');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TESTS: PIPELINE COUNTS
  // ============================================================================

  console.log('\n📈 TESTS: Pipeline Counts\n');

  await test('Pipeline counts reflect correct stage membership', async () => {
    const fixture = await createTestFixture();

    try {
      // Start process in stage 1
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      // Run projectors
      await runAllProjectors(supabase);

      // Check pipeline counts
      const { data: counts1 } = await supabase
        .from('product_pipeline_stage_counts')
        .select('*')
        .eq('product_id', fixture.productId)
        .eq('stage_id', fixture.stage1Id)
        .single();

      expectEqual(counts1?.total_count, 1, 'Stage 1 should have count of 1');
      expectEqual(counts1?.active_count, 1, 'Stage 1 should have active count of 1');

      // Stage 2 should have no counts
      const { data: counts2 } = await supabase
        .from('product_pipeline_stage_counts')
        .select('*')
        .eq('product_id', fixture.productId)
        .eq('stage_id', fixture.stage2Id)
        .single();

      expect(counts2 === null || counts2?.total_count === 0, 'Stage 2 should have count of 0');

      // Move to stage 2
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createStageSetEvent(
          {
            fromStageId: fixture.stage1Id,
            fromStageName: 'New Lead',
            fromStageOrder: 1,
            toStageId: fixture.stage2Id,
            toStageName: 'Qualifying',
            toStageOrder: 2,
            isProgression: true,
          },
          { type: 'user', id: 'test-user' }
        ),
      });

      // Run projectors
      await runAllProjectors(supabase);

      // Stage 1 should now be empty, Stage 2 should have 1
      const { data: countsAfter1 } = await supabase
        .from('product_pipeline_stage_counts')
        .select('*')
        .eq('product_id', fixture.productId)
        .eq('stage_id', fixture.stage1Id)
        .single();

      expect(
        countsAfter1 === null || countsAfter1?.total_count === 0,
        'Stage 1 should have count of 0 after transition'
      );

      const { data: countsAfter2 } = await supabase
        .from('product_pipeline_stage_counts')
        .select('*')
        .eq('product_id', fixture.productId)
        .eq('stage_id', fixture.stage2Id)
        .single();

      expectEqual(countsAfter2?.total_count, 1, 'Stage 2 should have count of 1 after transition');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TESTS: IDEMPOTENCY
  // ============================================================================

  console.log('\n🔄 TESTS: Idempotency\n');

  await test('Re-running projector yields identical results', async () => {
    const fixture = await createTestFixture();

    try {
      // Create events
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createStageSetEvent(
          {
            fromStageId: fixture.stage1Id,
            fromStageName: 'New Lead',
            fromStageOrder: 1,
            toStageId: fixture.stage2Id,
            toStageName: 'Qualifying',
            toStageOrder: 2,
            isProgression: true,
          },
          { type: 'user', id: 'test-user' }
        ),
      });

      // Run projectors first time
      await runAllProjectors(supabase);

      // Capture state
      const { data: readModel1 } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      const { data: facts1 } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .order('entered_at', { ascending: true });

      // Rebuild all projectors (forces re-processing)
      await rebuildAllProjectors(supabase);

      // Capture state again
      const { data: readModel2 } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      const { data: facts2 } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .order('entered_at', { ascending: true });

      // Compare key fields (ignore timestamps that may differ)
      expectEqual(
        readModel2?.current_stage_id,
        readModel1?.current_stage_id,
        'Read model stage should be identical'
      );
      expectEqual(
        readModel2?.current_process_id,
        readModel1?.current_process_id,
        'Read model process should be identical'
      );
      expectEqual(
        readModel2?.stage_transition_count,
        readModel1?.stage_transition_count,
        'Transition count should be identical'
      );

      expectEqual(facts2?.length, facts1?.length, 'Should have same number of stage facts');

      for (let i = 0; i < (facts1?.length || 0); i++) {
        expectEqual(
          facts2![i].stage_id,
          facts1![i].stage_id,
          `Stage fact ${i} stage should be identical`
        );
        expectEqual(
          facts2![i].exit_reason,
          facts1![i].exit_reason,
          `Stage fact ${i} exit reason should be identical`
        );
      }
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  await test('Rebuilding produces same results as incremental', async () => {
    const fixture = await createTestFixture();

    try {
      // Create events
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      // Run incrementally
      await runAllProjectors(supabase);

      const { data: incremental } = await supabase
        .from('company_product_read_model')
        .select('current_stage_id, stage_transition_count')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      // Clear and rebuild
      await rebuildAllProjectors(supabase);

      const { data: rebuilt } = await supabase
        .from('company_product_read_model')
        .select('current_stage_id, stage_transition_count')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(rebuilt?.current_stage_id, incremental?.current_stage_id, 'Stage should match');
      expectEqual(
        rebuilt?.stage_transition_count,
        incremental?.stage_transition_count,
        'Transition count should match'
      );
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TESTS: READ MODEL CORRECTNESS
  // ============================================================================

  console.log('\n📋 TESTS: Read Model Correctness\n');

  await test('Read model updates correctly on stage transition', async () => {
    const fixture = await createTestFixture();

    try {
      // Start process
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createProcessSetEvent(
          {
            fromProcessId: null,
            fromProcessType: null,
            toProcessId: fixture.processId,
            toProcessType: 'sales',
            processVersion: 1,
            initialStageId: fixture.stage1Id,
            initialStageName: 'New Lead',
          },
          { type: 'system' }
        ),
      });

      await runAllProjectors(supabase);

      // Verify initial state
      const { data: rm1 } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(rm1?.current_stage_id, fixture.stage1Id, 'Should be in stage 1');
      expectEqual(rm1?.current_process_type, 'sales', 'Process type should be sales');
      expect(rm1?.process_started_at !== null, 'Process should have started');
      expect(rm1?.process_completed_at === null, 'Process should not be completed');

      // Transition
      await appendEvent(supabase, {
        aggregateId: fixture.companyProductId,
        event: createStageSetEvent(
          {
            fromStageId: fixture.stage1Id,
            fromStageName: 'New Lead',
            fromStageOrder: 1,
            toStageId: fixture.stage2Id,
            toStageName: 'Qualifying',
            toStageOrder: 2,
            isProgression: true,
          },
          { type: 'user', id: 'test-user' }
        ),
      });

      await runAllProjectors(supabase);

      // Verify updated state
      const { data: rm2 } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(rm2?.current_stage_id, fixture.stage2Id, 'Should be in stage 2');
      expectEqual(rm2?.stage_transition_count, 2, 'Should have 2 transitions (initial + move)');
      expect(rm2?.stage_entered_at !== rm1?.stage_entered_at, 'Stage entered at should change');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('PROJECTOR TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nPassed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n❌ SOME TESTS FAILED');
    console.log('\nFailed tests:');
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  - ${result.name}`);
      console.log(`    ${result.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n✅ All projector tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
