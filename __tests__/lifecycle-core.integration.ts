/**
 * Lifecycle Core Tests
 *
 * Tests for the event-sourced lifecycle engine core functionality.
 * Tests event replay, sequence handling, and concurrent safety.
 *
 * Run with: npx tsx __tests__/lifecycle-core.test.ts
 *
 * Prerequisites:
 * - Supabase local or remote connection configured
 * - Migration 20251228_event_sourced_lifecycle.sql applied
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  // Events
  createPhaseSetEvent,
  createProcessSetEvent,
  createStageSetEvent,
  // Aggregate
  createInitialState,
  applyEvent,
  replayEvents,
  loadAggregate,
  CompanyProductState,
  // Commands
  appendEvent,
  setPhase,
  setProcess,
  transitionStage,
} from '../src/lib/lifecycle';
import type { EventStore } from '../src/types/eventSourcing';

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
// CLEANUP HELPER
// ============================================================================

async function cleanupTestAggregate(aggregateId: string): Promise<void> {
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_type', 'CompanyProduct')
    .eq('aggregate_id', aggregateId);
}

// ============================================================================
// UNIT TESTS: EVENT APPLICATION
// ============================================================================

console.log('\n📦 UNIT TESTS: Event Application\n');

await test('createInitialState returns empty state', async () => {
  const state = createInitialState('cp-1', 'company-1', 'product-1');

  expectEqual(state.id, 'cp-1', 'ID should match');
  expectEqual(state.companyId, 'company-1', 'Company ID should match');
  expectEqual(state.productId, 'product-1', 'Product ID should match');
  expectEqual(state.phase, null, 'Phase should be null');
  expectEqual(state.processId, null, 'Process ID should be null');
  expectEqual(state.stageId, null, 'Stage ID should be null');
  expectEqual(state.version, 0, 'Version should be 0');
});

await test('applyEvent updates state for PhaseSet', async () => {
  const initialState = createInitialState('cp-1', 'company-1', 'product-1');

  const event: EventStore = {
    id: 'event-1',
    aggregate_type: 'CompanyProduct',
    aggregate_id: 'cp-1',
    sequence_number: 1,
    global_sequence: 1,
    event_type: 'CompanyProductPhaseSet',
    event_data: {
      fromPhase: null,
      toPhase: 'in_sales',
      reason: 'Started sales process',
    },
    metadata: {},
    actor_type: 'user',
    actor_id: 'user-1',
    occurred_at: new Date().toISOString(),
    recorded_at: new Date().toISOString(),
  };

  const newState = applyEvent(initialState, event);

  expectEqual(newState.phase, 'in_sales', 'Phase should be in_sales');
  expectEqual(newState.lastEventSequence, 1, 'Last event sequence should be 1');
  expectEqual(newState.version, 1, 'Version should be 1');
});

await test('applyEvent updates state for ProcessSet', async () => {
  const initialState = createInitialState('cp-1', 'company-1', 'product-1');

  const event: EventStore = {
    id: 'event-1',
    aggregate_type: 'CompanyProduct',
    aggregate_id: 'cp-1',
    sequence_number: 1,
    global_sequence: 1,
    event_type: 'CompanyProductProcessSet',
    event_data: {
      fromProcessId: null,
      fromProcessType: null,
      toProcessId: 'process-1',
      toProcessType: 'sales',
      processVersion: 1,
      initialStageId: 'stage-1',
      initialStageName: 'New Lead',
    },
    metadata: {},
    actor_type: 'system',
    actor_id: null,
    occurred_at: new Date().toISOString(),
    recorded_at: new Date().toISOString(),
  };

  const newState = applyEvent(initialState, event);

  expectEqual(newState.processId, 'process-1', 'Process ID should match');
  expectEqual(newState.processType, 'sales', 'Process type should be sales');
  expectEqual(newState.stageId, 'stage-1', 'Stage ID should match initial');
  expectEqual(newState.stageName, 'New Lead', 'Stage name should match initial');
  expectEqual(newState.isProcessCompleted, false, 'Process should not be completed');
});

await test('applyEvent updates state for StageSet', async () => {
  let state = createInitialState('cp-1', 'company-1', 'product-1');

  // First set process
  const processEvent: EventStore = {
    id: 'event-1',
    aggregate_type: 'CompanyProduct',
    aggregate_id: 'cp-1',
    sequence_number: 1,
    global_sequence: 1,
    event_type: 'CompanyProductProcessSet',
    event_data: {
      fromProcessId: null,
      fromProcessType: null,
      toProcessId: 'process-1',
      toProcessType: 'sales',
      processVersion: 1,
    },
    metadata: {},
    actor_type: 'system',
    actor_id: null,
    occurred_at: new Date().toISOString(),
    recorded_at: new Date().toISOString(),
  };

  state = applyEvent(state, processEvent);

  // Then set stage
  const stageEvent: EventStore = {
    id: 'event-2',
    aggregate_type: 'CompanyProduct',
    aggregate_id: 'cp-1',
    sequence_number: 2,
    global_sequence: 2,
    event_type: 'CompanyProductStageSet',
    event_data: {
      fromStageId: null,
      fromStageName: null,
      fromStageOrder: null,
      toStageId: 'stage-2',
      toStageName: 'Qualifying',
      toStageOrder: 2,
      isProgression: true,
    },
    metadata: {},
    actor_type: 'user',
    actor_id: 'user-1',
    occurred_at: new Date().toISOString(),
    recorded_at: new Date().toISOString(),
  };

  state = applyEvent(state, stageEvent);

  expectEqual(state.stageId, 'stage-2', 'Stage ID should be stage-2');
  expectEqual(state.stageName, 'Qualifying', 'Stage name should be Qualifying');
  expectEqual(state.stageOrder, 2, 'Stage order should be 2');
  expectEqual(state.stageTransitionCount, 1, 'Transition count should be 1');
});

// ============================================================================
// UNIT TESTS: EVENT REPLAY
// ============================================================================

console.log('\n🔄 UNIT TESTS: Event Replay\n');

await test('replayEvents produces deterministic state: PhaseSet → ProcessSet → StageSet', async () => {
  const initialState = createInitialState('cp-1', 'company-1', 'product-1');
  const baseTime = new Date();

  const events: EventStore[] = [
    {
      id: 'event-1',
      aggregate_type: 'CompanyProduct',
      aggregate_id: 'cp-1',
      sequence_number: 1,
      global_sequence: 1,
      event_type: 'CompanyProductPhaseSet',
      event_data: {
        fromPhase: null,
        toPhase: 'in_sales',
      },
      metadata: {},
      actor_type: 'user',
      actor_id: 'user-1',
      occurred_at: new Date(baseTime.getTime()).toISOString(),
      recorded_at: new Date(baseTime.getTime()).toISOString(),
    },
    {
      id: 'event-2',
      aggregate_type: 'CompanyProduct',
      aggregate_id: 'cp-1',
      sequence_number: 2,
      global_sequence: 2,
      event_type: 'CompanyProductProcessSet',
      event_data: {
        fromProcessId: null,
        fromProcessType: null,
        toProcessId: 'sales-process-1',
        toProcessType: 'sales',
        processVersion: 1,
      },
      metadata: {},
      actor_type: 'system',
      actor_id: null,
      occurred_at: new Date(baseTime.getTime() + 1000).toISOString(),
      recorded_at: new Date(baseTime.getTime() + 1000).toISOString(),
    },
    {
      id: 'event-3',
      aggregate_type: 'CompanyProduct',
      aggregate_id: 'cp-1',
      sequence_number: 3,
      global_sequence: 3,
      event_type: 'CompanyProductStageSet',
      event_data: {
        fromStageId: null,
        fromStageName: null,
        fromStageOrder: null,
        toStageId: 'stage-1',
        toStageName: 'New Lead',
        toStageOrder: 1,
        isProgression: true,
      },
      metadata: {},
      actor_type: 'user',
      actor_id: 'user-1',
      occurred_at: new Date(baseTime.getTime() + 2000).toISOString(),
      recorded_at: new Date(baseTime.getTime() + 2000).toISOString(),
    },
  ];

  // Replay once
  const state1 = replayEvents(initialState, events);

  // Replay again - should be identical
  const state2 = replayEvents(initialState, events);

  // Verify determinism
  expectEqual(state1.phase, state2.phase, 'Phase should be deterministic');
  expectEqual(state1.processId, state2.processId, 'Process ID should be deterministic');
  expectEqual(state1.processType, state2.processType, 'Process type should be deterministic');
  expectEqual(state1.stageId, state2.stageId, 'Stage ID should be deterministic');
  expectEqual(state1.stageName, state2.stageName, 'Stage name should be deterministic');
  expectEqual(state1.stageOrder, state2.stageOrder, 'Stage order should be deterministic');
  expectEqual(state1.version, state2.version, 'Version should be deterministic');

  // Verify final state values
  expectEqual(state1.phase, 'in_sales', 'Phase should be in_sales');
  expectEqual(state1.processId, 'sales-process-1', 'Process ID should match');
  expectEqual(state1.processType, 'sales', 'Process type should be sales');
  expectEqual(state1.stageId, 'stage-1', 'Stage ID should be stage-1');
  expectEqual(state1.stageName, 'New Lead', 'Stage name should be New Lead');
  expectEqual(state1.version, 3, 'Version should be 3');
});

await test('replayEvents throws on out-of-order events', async () => {
  const initialState = createInitialState('cp-1', 'company-1', 'product-1');

  const outOfOrderEvents: EventStore[] = [
    {
      id: 'event-2',
      aggregate_type: 'CompanyProduct',
      aggregate_id: 'cp-1',
      sequence_number: 2, // Wrong - should be 1
      global_sequence: 2,
      event_type: 'CompanyProductPhaseSet',
      event_data: { fromPhase: null, toPhase: 'in_sales' },
      metadata: {},
      actor_type: 'user',
      actor_id: null,
      occurred_at: new Date().toISOString(),
      recorded_at: new Date().toISOString(),
    },
    {
      id: 'event-1',
      aggregate_type: 'CompanyProduct',
      aggregate_id: 'cp-1',
      sequence_number: 1, // Wrong - should be 2
      global_sequence: 1,
      event_type: 'CompanyProductProcessSet',
      event_data: {
        fromProcessId: null,
        fromProcessType: null,
        toProcessId: 'p1',
        toProcessType: 'sales',
        processVersion: 1,
      },
      metadata: {},
      actor_type: 'system',
      actor_id: null,
      occurred_at: new Date().toISOString(),
      recorded_at: new Date().toISOString(),
    },
  ];

  let threw = false;
  try {
    replayEvents(initialState, outOfOrderEvents);
  } catch (e) {
    threw = true;
    expect(
      e instanceof Error && e.message.includes('out of order'),
      'Should throw error about out of order'
    );
  }

  expect(threw, 'Should throw on out-of-order events');
});

// ============================================================================
// INTEGRATION TESTS: DATABASE OPERATIONS
// ============================================================================

console.log('\n🗄️ INTEGRATION TESTS: Database Operations\n');

await test('sequence_number increments correctly', async () => {
  const testId = `test-seq-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    // Append first event
    const result1 = await appendEvent(supabase, {
      aggregateId: testId,
      event: createPhaseSetEvent(
        { fromPhase: null, toPhase: 'prospect' },
        { type: 'system' }
      ),
    });

    expect(result1.success, `First append should succeed: ${result1.error}`);
    expectEqual(result1.sequenceNumber, 1, 'First event should have sequence 1');

    // Append second event
    const result2 = await appendEvent(supabase, {
      aggregateId: testId,
      event: createPhaseSetEvent(
        { fromPhase: 'prospect', toPhase: 'in_sales' },
        { type: 'system' }
      ),
    });

    expect(result2.success, `Second append should succeed: ${result2.error}`);
    expectEqual(result2.sequenceNumber, 2, 'Second event should have sequence 2');

    // Append third event
    const result3 = await appendEvent(supabase, {
      aggregateId: testId,
      event: createProcessSetEvent(
        {
          fromProcessId: null,
          fromProcessType: null,
          toProcessId: 'process-1',
          toProcessType: 'sales',
          processVersion: 1,
        },
        { type: 'user', id: 'user-1' }
      ),
    });

    expect(result3.success, `Third append should succeed: ${result3.error}`);
    expectEqual(result3.sequenceNumber, 3, 'Third event should have sequence 3');
  } finally {
    await cleanupTestAggregate(testId);
  }
});

await test('loadAggregate replays events correctly', async () => {
  const testId = `test-load-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const companyId = 'company-test';
  const productId = 'product-test';

  try {
    // Append series of events
    await appendEvent(supabase, {
      aggregateId: testId,
      event: createPhaseSetEvent(
        { fromPhase: null, toPhase: 'in_sales' },
        { type: 'user', id: 'user-1' }
      ),
    });

    await appendEvent(supabase, {
      aggregateId: testId,
      event: createProcessSetEvent(
        {
          fromProcessId: null,
          fromProcessType: null,
          toProcessId: 'sales-process-1',
          toProcessType: 'sales',
          processVersion: 1,
        },
        { type: 'system' }
      ),
    });

    await appendEvent(supabase, {
      aggregateId: testId,
      event: createStageSetEvent(
        {
          fromStageId: null,
          fromStageName: null,
          fromStageOrder: null,
          toStageId: 'stage-qualifying',
          toStageName: 'Qualifying',
          toStageOrder: 2,
          isProgression: true,
        },
        { type: 'user', id: 'user-1' }
      ),
    });

    // Load and verify state
    const { state, events, exists } = await loadAggregate(
      supabase,
      testId,
      companyId,
      productId
    );

    expect(exists, 'Aggregate should exist');
    expectEqual(events.length, 3, 'Should have 3 events');
    expectEqual(state.phase, 'in_sales', 'Phase should be in_sales');
    expectEqual(state.processId, 'sales-process-1', 'Process ID should match');
    expectEqual(state.processType, 'sales', 'Process type should be sales');
    expectEqual(state.stageId, 'stage-qualifying', 'Stage ID should match');
    expectEqual(state.stageName, 'Qualifying', 'Stage name should match');
    expectEqual(state.stageOrder, 2, 'Stage order should be 2');
    expectEqual(state.version, 3, 'Version should be 3');
    expectEqual(state.stageTransitionCount, 1, 'Should have 1 transition');
  } finally {
    await cleanupTestAggregate(testId);
  }
});

await test('loadAggregate returns empty state for non-existent aggregate', async () => {
  const testId = `test-nonexistent-${Date.now()}`;

  const { state, events, exists } = await loadAggregate(
    supabase,
    testId,
    'company-1',
    'product-1'
  );

  expect(!exists, 'Should not exist');
  expectEqual(events.length, 0, 'Should have 0 events');
  expectEqual(state.phase, null, 'Phase should be null');
  expectEqual(state.version, 0, 'Version should be 0');
});

// ============================================================================
// INTEGRATION TESTS: CONCURRENT APPEND SAFETY
// ============================================================================

console.log('\n🔒 INTEGRATION TESTS: Concurrent Append Safety\n');

await test('concurrent appends never produce duplicate sequence_numbers', async () => {
  const testId = `test-concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    // Launch multiple concurrent appends
    const appendPromises = Array.from({ length: 5 }, (_, i) =>
      appendEvent(supabase, {
        aggregateId: testId,
        event: createPhaseSetEvent(
          { fromPhase: null, toPhase: 'prospect' },
          { type: 'system' },
          { correlationId: `concurrent-${i}` }
        ),
      })
    );

    const results = await Promise.all(appendPromises);

    // Count successes
    const successResults = results.filter((r) => r.success);

    // At least one should succeed
    expect(successResults.length >= 1, 'At least one append should succeed');

    // Verify no duplicate sequences
    const { data: events, error } = await supabase
      .from('event_store')
      .select('sequence_number')
      .eq('aggregate_type', 'CompanyProduct')
      .eq('aggregate_id', testId)
      .order('sequence_number', { ascending: true });

    expect(!error, `Query should succeed: ${error?.message}`);

    const sequences = events?.map((e) => e.sequence_number) || [];
    const uniqueSequences = new Set(sequences);

    expectEqual(
      sequences.length,
      uniqueSequences.size,
      'All sequences should be unique'
    );

    // Verify sequences are monotonic
    for (let i = 0; i < sequences.length; i++) {
      expectEqual(sequences[i], i + 1, `Sequence ${i} should be ${i + 1}`);
    }
  } finally {
    await cleanupTestAggregate(testId);
  }
});

await test('optimistic concurrency rejects stale writes', async () => {
  const testId = `test-optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    // Initial event
    const result1 = await appendEvent(supabase, {
      aggregateId: testId,
      event: createPhaseSetEvent(
        { fromPhase: null, toPhase: 'prospect' },
        { type: 'system' }
      ),
    });

    expect(result1.success, 'Initial append should succeed');

    // Try to append with stale expected version
    const result2 = await appendEvent(supabase, {
      aggregateId: testId,
      event: createPhaseSetEvent(
        { fromPhase: 'prospect', toPhase: 'in_sales' },
        { type: 'system' }
      ),
      expectedVersion: 0, // Stale - actual is 1
    });

    expect(!result2.success, 'Stale write should be rejected');
    expect(
      result2.error?.includes('Concurrency conflict') === true,
      'Error should mention concurrency conflict'
    );

    // Append with correct version should succeed
    const result3 = await appendEvent(supabase, {
      aggregateId: testId,
      event: createPhaseSetEvent(
        { fromPhase: 'prospect', toPhase: 'in_sales' },
        { type: 'system' }
      ),
      expectedVersion: 1, // Correct
    });

    expect(result3.success, `Correct version write should succeed: ${result3.error}`);
  } finally {
    await cleanupTestAggregate(testId);
  }
});

// ============================================================================
// INTEGRATION TESTS: COMMAND HANDLERS
// ============================================================================

console.log('\n⚡ INTEGRATION TESTS: Command Handlers\n');

await test('setPhase validates transitions', async () => {
  const testId = `test-phase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const companyId = 'company-test';
  const productId = 'product-test';

  try {
    // Valid transition: null -> prospect
    const result1 = await setPhase(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      toPhase: 'prospect',
      actor: { type: 'user', id: 'user-1' },
    });

    expect(result1.success, `null -> prospect should succeed: ${result1.error}`);

    // Valid transition: prospect -> in_sales
    const result2 = await setPhase(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      toPhase: 'in_sales',
      actor: { type: 'user', id: 'user-1' },
    });

    expect(result2.success, `prospect -> in_sales should succeed: ${result2.error}`);

    // Invalid transition: in_sales -> prospect (can't go backwards)
    const result3 = await setPhase(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      toPhase: 'prospect',
      actor: { type: 'user', id: 'user-1' },
    });

    expect(!result3.success, 'in_sales -> prospect should fail');
    expect(
      result3.error?.includes('Invalid phase transition') === true,
      'Error should mention invalid transition'
    );
  } finally {
    await cleanupTestAggregate(testId);
  }
});

await test('transitionStage requires active process', async () => {
  const testId = `test-stage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const companyId = 'company-test';
  const productId = 'product-test';

  try {
    // Try to transition stage without process - should fail
    const result = await transitionStage(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      toStageId: 'stage-1',
      toStageName: 'New Lead',
      toStageOrder: 1,
      actor: { type: 'user', id: 'user-1' },
    });

    expect(!result.success, 'Stage transition without process should fail');
    expect(
      result.error?.includes('No active process') === true,
      'Error should mention no active process'
    );

    // Set up phase and process
    await setPhase(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      toPhase: 'in_sales',
      actor: { type: 'system' },
    });

    await setProcess(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      processId: 'sales-1',
      processType: 'sales',
      processVersion: 1,
      actor: { type: 'system' },
    });

    // Now transition should work
    const result2 = await transitionStage(supabase, {
      companyProductId: testId,
      companyId,
      productId,
      toStageId: 'stage-1',
      toStageName: 'New Lead',
      toStageOrder: 1,
      actor: { type: 'user', id: 'user-1' },
    });

    expect(result2.success, `Stage transition with process should succeed: ${result2.error}`);
  } finally {
    await cleanupTestAggregate(testId);
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('LIFECYCLE CORE TEST SUMMARY');
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
  console.log('\n✅ All lifecycle core tests passed!');
  process.exit(0);
}
