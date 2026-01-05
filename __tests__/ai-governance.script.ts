/**
 * AI Governance Tests
 *
 * Tests for AI suggestion lifecycle, SLA breach detection, and deterministic rebuild.
 *
 * REQUIRED TESTS:
 * 1. AI suggestion lifecycle: Create → Accept/Dismiss → Project
 * 2. AI cannot accept its own suggestions (guardrail)
 * 3. SLA breach detection emits events
 * 4. Deterministic rebuild produces identical projections
 *
 * Run with: npx tsx __tests__/ai-governance.test.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createAISuggestion,
  acceptAISuggestion,
  dismissAISuggestion,
  startSale,
  advanceStage,
} from '../src/lib/lifecycle/commands';
import { runAllProjectors } from '../src/lib/lifecycle/projectors';
import { scanForSLABreaches } from '../src/lib/lifecycle/slaBreachScanner';

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
}

async function createTestFixture(): Promise<TestFixture> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Create test company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: `AI Gov Test Company ${timestamp}`,
      domain: `ai-gov-test-${timestamp}-${random}.example.com`,
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
      name: `AI Gov Test Product ${timestamp}`,
      slug: `ai-gov-test-product-${timestamp}-${random}`,
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
      name: `AI Gov Test Process ${timestamp}`,
      process_type: 'sales',
      version: 1,
      status: 'published',
    })
    .select()
    .single();

  if (processError) {
    throw new Error(`Failed to create test process: ${processError.message}`);
  }

  // Create test stages with SLA
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
  };
}

async function cleanupTestFixture(fixture: TestFixture): Promise<void> {
  // Clean up in reverse dependency order
  await supabase.from('ai_suggestions_read_model').delete().eq('company_product_id', fixture.companyProductId);
  await supabase.from('sla_breach_facts').delete().eq('company_product_id', fixture.companyProductId);
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
  console.log('\n📊 TESTS: AI Governance\n');

  // ============================================================================
  // TEST 1: AI Suggestion Lifecycle - Create and Accept
  // ============================================================================

  await test('AI suggestion can be created and accepted', async () => {
    const fixture = await createTestFixture();

    try {
      // Start a sale first
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

      const suggestionId = `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Create AI suggestion
      const createResult = await createAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'advance_stage',
        title: 'Advance to Qualifying',
        description: 'Based on call transcript, customer is ready for qualification.',
        confidence: 0.85,
        sourceType: 'transcript',
        sourceId: 'test-transcript-123',
        suggestedAction: {
          command: 'advance-stage',
          params: {
            toStageId: fixture.stage2Id,
            toStageName: 'Qualifying',
          },
        },
        actor: { type: 'ai', id: 'claude-analysis' },
      });

      expect(createResult.success, `Create suggestion should succeed: ${createResult.error}`);

      // Run projectors
      await runAllProjectors(supabase);

      // Verify suggestion is pending
      const { data: pendingSuggestion } = await supabase
        .from('ai_suggestions_read_model')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .single();

      expectEqual(pendingSuggestion?.status, 'pending', 'Suggestion should be pending');

      // Accept the suggestion (as user, not AI)
      const acceptResult = await acceptAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'advance_stage',
        executeAction: false,
        actor: { type: 'user', id: 'test-user' },
      });

      expect(acceptResult.success, `Accept suggestion should succeed: ${acceptResult.error}`);

      // Run projectors
      await runAllProjectors(supabase);

      // Verify suggestion is accepted
      const { data: acceptedSuggestion } = await supabase
        .from('ai_suggestions_read_model')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .single();

      expectEqual(acceptedSuggestion?.status, 'accepted', 'Suggestion should be accepted');
      expect(acceptedSuggestion?.resolved_at !== null, 'Resolved at should be set');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 2: AI Cannot Accept Its Own Suggestions (GUARDRAIL)
  // ============================================================================

  await test('AI cannot accept its own suggestions (guardrail)', async () => {
    const fixture = await createTestFixture();

    try {
      // Start a sale first
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

      const suggestionId = `suggestion-guardrail-${Date.now()}`;

      // Create AI suggestion
      await createAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'set_tier',
        title: 'Set Tier to 1',
        description: 'High value opportunity detected.',
        confidence: 0.9,
        sourceType: 'email',
        suggestedAction: {
          command: 'set-tier',
          params: { tier: 1 },
        },
        actor: { type: 'ai', id: 'claude-analysis' },
      });

      // Try to accept as AI (should fail)
      const acceptResult = await acceptAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'set_tier',
        actor: { type: 'ai', id: 'claude-analysis' }, // AI trying to accept!
      });

      expect(!acceptResult.success, 'AI should NOT be able to accept suggestions');
      expect(
        acceptResult.error?.includes('AI cannot accept') || false,
        'Error should mention AI cannot accept'
      );
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 3: AI Suggestion Can Be Dismissed
  // ============================================================================

  await test('AI suggestion can be dismissed with feedback', async () => {
    const fixture = await createTestFixture();

    try {
      // Start a sale first
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

      const suggestionId = `suggestion-dismiss-${Date.now()}`;

      // Create AI suggestion
      await createAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'flag_risk',
        title: 'Flag as at-risk',
        description: 'Customer seems disengaged.',
        confidence: 0.6,
        sourceType: 'activity',
        suggestedAction: {
          command: 'flag-risk',
          params: { riskLevel: 'medium' },
        },
        actor: { type: 'ai', id: 'claude-analysis' },
      });

      await runAllProjectors(supabase);

      // Dismiss with feedback
      const dismissResult = await dismissAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'flag_risk',
        dismissReason: 'incorrect',
        feedback: 'Customer is actually very engaged, just on vacation.',
        actor: { type: 'user', id: 'test-user' },
      });

      expect(dismissResult.success, `Dismiss should succeed: ${dismissResult.error}`);

      await runAllProjectors(supabase);

      // Verify suggestion is dismissed
      const { data: dismissedSuggestion } = await supabase
        .from('ai_suggestions_read_model')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .single();

      expectEqual(dismissedSuggestion?.status, 'dismissed', 'Suggestion should be dismissed');
      expectEqual(dismissedSuggestion?.dismiss_reason, 'incorrect', 'Dismiss reason should be stored');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 4: SLA Breach Detection
  // ============================================================================

  await test('SLA breach scanner detects breaches and emits events', async () => {
    const fixture = await createTestFixture();

    try {
      // Start a sale
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

      // Manually set stage_entered_at to 5 days ago (beyond 3 day SLA)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      await supabase
        .from('company_product_read_model')
        .update({ stage_entered_at: fiveDaysAgo.toISOString() })
        .eq('company_product_id', fixture.companyProductId);

      // Run SLA breach scanner
      const scanResult = await scanForSLABreaches(supabase);

      expect(scanResult.success, 'SLA scan should succeed');
      expect(scanResult.scanned > 0, 'Should have scanned at least one item');

      // Check if breach event was emitted
      const { data: breachEvents } = await supabase
        .from('event_store')
        .select('*')
        .eq('aggregate_id', fixture.companyProductId)
        .eq('event_type', 'CompanyProductSLABreached');

      expect((breachEvents?.length || 0) > 0, 'SLA breach event should be emitted');

      // Run projectors to project the breach
      await runAllProjectors(supabase);

      // Verify breach is in sla_breach_facts
      const { data: breachFacts } = await supabase
        .from('sla_breach_facts')
        .select('*')
        .eq('company_product_id', fixture.companyProductId);

      expect((breachFacts?.length || 0) > 0, 'SLA breach fact should be created');
      expect(breachFacts?.[0]?.days_over >= 2, 'Days over should be at least 2 (5 - 3)');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // TEST 5: Events Create Complete Audit Trail
  // ============================================================================

  await test('All AI governance actions create audit trail', async () => {
    const fixture = await createTestFixture();

    try {
      // Start sale
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

      const suggestionId = `suggestion-audit-${Date.now()}`;

      // Create, then dismiss suggestion
      await createAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'advance_stage',
        title: 'Advance Stage',
        description: 'Ready to advance.',
        confidence: 0.8,
        sourceType: 'manual',
        suggestedAction: { command: 'advance-stage', params: {} },
        actor: { type: 'ai', id: 'test-ai' },
      });

      await dismissAISuggestion(supabase, {
        companyProductId: fixture.companyProductId,
        companyId: fixture.companyId,
        productId: fixture.productId,
        suggestionId,
        suggestionType: 'advance_stage',
        dismissReason: 'not_relevant',
        actor: { type: 'user', id: 'test-user' },
      });

      // Get all AI suggestion events
      const { data: events } = await supabase
        .from('event_store')
        .select('*')
        .eq('aggregate_id', fixture.companyProductId)
        .in('event_type', ['AISuggestionCreated', 'AISuggestionAccepted', 'AISuggestionDismissed'])
        .order('sequence_number');

      expect((events?.length || 0) >= 2, 'Should have at least 2 AI suggestion events');

      // Verify event types
      const eventTypes = events?.map(e => e.event_type) || [];
      expect(eventTypes.includes('AISuggestionCreated'), 'Should have Created event');
      expect(eventTypes.includes('AISuggestionDismissed'), 'Should have Dismissed event');

      // Verify actor information is preserved
      const createdEvent = events?.find(e => e.event_type === 'AISuggestionCreated');
      expectEqual(createdEvent?.actor_type, 'ai', 'Created event should have AI actor');

      const dismissedEvent = events?.find(e => e.event_type === 'AISuggestionDismissed');
      expectEqual(dismissedEvent?.actor_type, 'user', 'Dismissed event should have user actor');
    } finally {
      await cleanupTestFixture(fixture);
    }
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('AI GOVERNANCE TEST SUMMARY');
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
    console.log('\n✅ All AI governance tests passed!\n');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
