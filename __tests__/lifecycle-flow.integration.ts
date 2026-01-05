/**
 * Lifecycle Flow Tests
 *
 * Tests the complete customer lifecycle: Sales → Onboarding → Active/Engagement
 *
 * REQUIRED TESTS:
 * 1. Sale → Onboarding → Active lifecycle flow
 * 2. Stage facts span multiple processes
 * 3. Read model reflects correct phase/process at each step
 *
 * Run with: npx tsx __tests__/lifecycle-flow.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  startSale,
  advanceStage,
  completeSaleAndStartOnboarding,
  completeOnboardingAndStartEngagement,
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
  salesProcessId: string;
  salesStage1Id: string;
  salesStage2Id: string;
  salesTerminalId: string;
  onboardingProcessId: string;
  onboardingStage1Id: string;
  onboardingStage2Id: string;
  onboardingTerminalId: string;
  engagementProcessId: string;
  engagementStage1Id: string;
}

async function createFullLifecycleFixture(): Promise<TestFixture> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Create test company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: `Lifecycle Test Company ${timestamp}`,
      domain: `lifecycle-${timestamp}-${random}.example.com`,
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
      name: `Lifecycle Test Product ${timestamp}`,
      slug: `lifecycle-test-${timestamp}-${random}`,
    })
    .select()
    .single();

  if (productError) {
    throw new Error(`Failed to create test product: ${productError.message}`);
  }

  // Create SALES process
  const { data: salesProcess, error: salesProcessError } = await supabase
    .from('product_processes')
    .insert({
      product_id: product.id,
      name: 'Sales Process',
      process_type: 'sales',
      version: 1,
      status: 'published',
    })
    .select()
    .single();

  if (salesProcessError) {
    throw new Error(`Failed to create sales process: ${salesProcessError.message}`);
  }

  // Create sales stages
  const { data: salesStages, error: salesStagesError } = await supabase
    .from('product_process_stages')
    .insert([
      {
        process_id: salesProcess.id,
        name: 'New Lead',
        slug: 'new-lead',
        stage_order: 1,
        sla_days: 3,
        is_terminal: false,
      },
      {
        process_id: salesProcess.id,
        name: 'Qualifying',
        slug: 'qualifying',
        stage_order: 2,
        sla_days: 5,
        is_terminal: false,
      },
      {
        process_id: salesProcess.id,
        name: 'Closed Won',
        slug: 'closed-won',
        stage_order: 3,
        is_terminal: true,
        terminal_type: 'won',
      },
    ])
    .select()
    .order('stage_order');

  if (salesStagesError) {
    throw new Error(`Failed to create sales stages: ${salesStagesError.message}`);
  }

  // Create ONBOARDING process
  const { data: onboardingProcess, error: onboardingProcessError } = await supabase
    .from('product_processes')
    .insert({
      product_id: product.id,
      name: 'Onboarding Process',
      process_type: 'onboarding',
      version: 1,
      status: 'published',
    })
    .select()
    .single();

  if (onboardingProcessError) {
    throw new Error(`Failed to create onboarding process: ${onboardingProcessError.message}`);
  }

  // Create onboarding stages
  const { data: onboardingStages, error: onboardingStagesError } = await supabase
    .from('product_process_stages')
    .insert([
      {
        process_id: onboardingProcess.id,
        name: 'Kickoff',
        slug: 'kickoff',
        stage_order: 1,
        sla_days: 7,
        is_terminal: false,
      },
      {
        process_id: onboardingProcess.id,
        name: 'Implementation',
        slug: 'implementation',
        stage_order: 2,
        sla_days: 14,
        is_terminal: false,
      },
      {
        process_id: onboardingProcess.id,
        name: 'Go Live',
        slug: 'go-live',
        stage_order: 3,
        is_terminal: true,
        terminal_type: 'completed',
      },
    ])
    .select()
    .order('stage_order');

  if (onboardingStagesError) {
    throw new Error(`Failed to create onboarding stages: ${onboardingStagesError.message}`);
  }

  // Create ENGAGEMENT process
  const { data: engagementProcess, error: engagementProcessError } = await supabase
    .from('product_processes')
    .insert({
      product_id: product.id,
      name: 'Engagement Process',
      process_type: 'engagement',
      version: 1,
      status: 'published',
    })
    .select()
    .single();

  if (engagementProcessError) {
    throw new Error(`Failed to create engagement process: ${engagementProcessError.message}`);
  }

  // Create engagement stages
  const { data: engagementStages, error: engagementStagesError } = await supabase
    .from('product_process_stages')
    .insert([
      {
        process_id: engagementProcess.id,
        name: 'Active Customer',
        slug: 'active-customer',
        stage_order: 1,
        is_terminal: false,
      },
    ])
    .select()
    .order('stage_order');

  if (engagementStagesError) {
    throw new Error(`Failed to create engagement stages: ${engagementStagesError.message}`);
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
    salesProcessId: salesProcess.id,
    salesStage1Id: salesStages[0].id,
    salesStage2Id: salesStages[1].id,
    salesTerminalId: salesStages[2].id,
    onboardingProcessId: onboardingProcess.id,
    onboardingStage1Id: onboardingStages[0].id,
    onboardingStage2Id: onboardingStages[1].id,
    onboardingTerminalId: onboardingStages[2].id,
    engagementProcessId: engagementProcess.id,
    engagementStage1Id: engagementStages[0].id,
  };
}

async function cleanupFixture(fixture: TestFixture): Promise<void> {
  // Clean up in reverse dependency order
  await supabase.from('product_pipeline_stage_counts').delete().eq('product_id', fixture.productId);
  await supabase.from('company_product_stage_facts').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('company_product_read_model').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('company_products').delete().eq('id', fixture.companyProductId);
  await supabase.from('product_process_stages').delete().eq('process_id', fixture.salesProcessId);
  await supabase.from('product_process_stages').delete().eq('process_id', fixture.onboardingProcessId);
  await supabase.from('product_process_stages').delete().eq('process_id', fixture.engagementProcessId);
  await supabase.from('product_processes').delete().eq('id', fixture.salesProcessId);
  await supabase.from('product_processes').delete().eq('id', fixture.onboardingProcessId);
  await supabase.from('product_processes').delete().eq('id', fixture.engagementProcessId);
  await supabase.from('products').delete().eq('id', fixture.productId);
  await supabase.from('companies').delete().eq('id', fixture.companyId);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n📊 LIFECYCLE FLOW TESTS\n');

  // ============================================================================
  // TEST 1: Complete Sales → Onboarding → Active lifecycle
  // ============================================================================

  await test('Full lifecycle: Sales → Onboarding → Active', async () => {
    const fixture = await createFullLifecycleFixture();

    try {
      const actor = { type: 'user' as const, id: 'test-user' };

      // PHASE 1: Start Sales
      console.log('   Starting sales process...');
      const salesResult = await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.salesProcessId,
        processVersion: 1,
        initialStageId: fixture.salesStage1Id,
        initialStageName: 'New Lead',
        actor,
      });

      expect(salesResult.every(r => r.success), 'start-sale should succeed');
      await runAllProjectors(supabase);

      // Verify in_sales phase
      const { data: afterSales } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(afterSales?.current_process_type, 'sales', 'Should be in sales process');
      expectEqual(afterSales?.current_stage_id, fixture.salesStage1Id, 'Should be in initial stage');

      // Advance through sales stages
      console.log('   Advancing through sales stages...');
      const advanceResult = await advanceStage(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        toStageId: fixture.salesStage2Id,
        toStageName: 'Qualifying',
        toStageOrder: 2,
        reason: 'Qualified lead',
        actor,
      });

      expect(advanceResult.success, `advance-stage should succeed: ${advanceResult.error}`);
      await runAllProjectors(supabase);

      // PHASE 2: Complete Sale and Start Onboarding
      console.log('   Completing sale and starting onboarding...');
      const onboardingResult = await completeSaleAndStartOnboarding(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        notes: 'Deal closed successfully',
        actor,
      });

      expect(onboardingResult.every(r => r.success), `complete-sale should succeed: ${JSON.stringify(onboardingResult)}`);
      await runAllProjectors(supabase);

      // Verify onboarding phase
      const { data: afterOnboarding } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(afterOnboarding?.current_process_type, 'onboarding', 'Should be in onboarding process');
      expectEqual(afterOnboarding?.current_stage_id, fixture.onboardingStage1Id, 'Should be in kickoff stage');

      // Advance through onboarding stages
      console.log('   Advancing through onboarding stages...');
      const advanceOnboarding = await advanceStage(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        toStageId: fixture.onboardingStage2Id,
        toStageName: 'Implementation',
        toStageOrder: 2,
        reason: 'Kickoff completed',
        actor,
      });

      expect(advanceOnboarding.success, `advance onboarding should succeed: ${advanceOnboarding.error}`);
      await runAllProjectors(supabase);

      // PHASE 3: Complete Onboarding and Start Engagement
      console.log('   Completing onboarding and starting engagement...');
      const engagementResult = await completeOnboardingAndStartEngagement(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        notes: 'Customer successfully onboarded',
        actor,
      });

      expect(engagementResult.every(r => r.success), `complete-onboarding should succeed: ${JSON.stringify(engagementResult)}`);
      await runAllProjectors(supabase);

      // Verify active/engagement phase
      const { data: afterEngagement } = await supabase
        .from('company_product_read_model')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .single();

      expectEqual(afterEngagement?.current_process_type, 'engagement', 'Should be in engagement process');
      expectEqual(afterEngagement?.current_stage_id, fixture.engagementStage1Id, 'Should be in active customer stage');

      console.log('   ✓ Full lifecycle completed successfully');
    } finally {
      await cleanupFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 2: Stage facts span multiple processes
  // ============================================================================

  await test('Stage facts track all stages across processes', async () => {
    const fixture = await createFullLifecycleFixture();

    try {
      const actor = { type: 'user' as const, id: 'test-user' };

      // Run through complete lifecycle
      await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.salesProcessId,
        processVersion: 1,
        initialStageId: fixture.salesStage1Id,
        initialStageName: 'New Lead',
        actor,
      });
      await runAllProjectors(supabase);

      await advanceStage(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        toStageId: fixture.salesStage2Id,
        toStageName: 'Qualifying',
        toStageOrder: 2,
        actor,
      });
      await runAllProjectors(supabase);

      await completeSaleAndStartOnboarding(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        actor,
      });
      await runAllProjectors(supabase);

      await advanceStage(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        toStageId: fixture.onboardingStage2Id,
        toStageName: 'Implementation',
        toStageOrder: 2,
        actor,
      });
      await runAllProjectors(supabase);

      await completeOnboardingAndStartEngagement(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        actor,
      });
      await runAllProjectors(supabase);

      // Verify stage facts
      const { data: stageFacts } = await supabase
        .from('company_product_stage_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId)
        .order('entered_at', { ascending: true });

      expect((stageFacts?.length || 0) >= 4, `Should have at least 4 stage facts, got ${stageFacts?.length}`);

      // Verify we have facts from both sales and onboarding processes
      const salesFacts = stageFacts?.filter(f => f.process_type === 'sales') || [];
      const onboardingFacts = stageFacts?.filter(f => f.process_type === 'onboarding') || [];
      const engagementFacts = stageFacts?.filter(f => f.process_type === 'engagement') || [];

      expect(salesFacts.length >= 2, `Should have at least 2 sales stage facts, got ${salesFacts.length}`);
      expect(onboardingFacts.length >= 2, `Should have at least 2 onboarding stage facts, got ${onboardingFacts.length}`);
      expect(engagementFacts.length >= 1, `Should have at least 1 engagement stage fact, got ${engagementFacts.length}`);

      console.log(`   ✓ Found ${stageFacts?.length} total stage facts across ${3} processes`);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 3: Events record complete audit trail
  // ============================================================================

  await test('Events record complete audit trail across lifecycle', async () => {
    const fixture = await createFullLifecycleFixture();

    try {
      const actor = { type: 'user' as const, id: 'test-user' };

      // Run through lifecycle
      await startSale(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        processId: fixture.salesProcessId,
        processVersion: 1,
        initialStageId: fixture.salesStage1Id,
        initialStageName: 'New Lead',
        actor,
      });

      await completeSaleAndStartOnboarding(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        actor,
      });

      await completeOnboardingAndStartEngagement(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        actor,
      });

      // Query events
      const { data: events } = await supabase
        .from('event_store')
        .select('*')
        .eq('aggregate_id', fixture.companyProductId)
        .order('sequence_number', { ascending: true });

      // Should have events for:
      // 1. PhaseSet (prospect → in_sales)
      // 2. ProcessSet (sales)
      // 3. ProcessCompleted (sales won)
      // 4. PhaseSet (in_sales → onboarding)
      // 5. ProcessSet (onboarding)
      // 6. ProcessCompleted (onboarding completed)
      // 7. PhaseSet (onboarding → active)
      // 8. ProcessSet (engagement)

      expect((events?.length || 0) >= 8, `Should have at least 8 events, got ${events?.length}`);

      // Verify event types are present
      const eventTypes = events?.map(e => e.event_type) || [];
      expect(eventTypes.includes('CompanyProductPhaseSet'), 'Should have PhaseSet events');
      expect(eventTypes.includes('CompanyProductProcessSet'), 'Should have ProcessSet events');
      expect(eventTypes.includes('CompanyProductProcessCompleted'), 'Should have ProcessCompleted events');

      // Verify phase transitions are correct
      const phaseEvents = events?.filter(e => e.event_type === 'CompanyProductPhaseSet') || [];
      expect(phaseEvents.length >= 3, `Should have at least 3 phase events, got ${phaseEvents.length}`);

      // Verify sequence numbers are monotonically increasing
      let prevSeq = 0;
      for (const event of events || []) {
        expect(event.sequence_number > prevSeq, `Sequence should increase: ${prevSeq} < ${event.sequence_number}`);
        prevSeq = event.sequence_number;
      }

      console.log(`   ✓ Found ${events?.length} events with correct sequencing`);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('LIFECYCLE FLOW TEST SUMMARY');
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
    console.log('\n✅ All lifecycle flow tests passed!\n');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
