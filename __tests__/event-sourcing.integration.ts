/**
 * Event Sourcing Database Tests
 *
 * Tests for the event-sourced lifecycle engine database foundation.
 * Verifies migrations apply correctly and constraints are enforced.
 *
 * Run with: npx tsx __tests__/event-sourcing.test.ts
 *
 * Prerequisites:
 * - Supabase local or remote connection configured
 * - Migration 20251228_event_sourced_lifecycle.sql applied
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

async function expectError(
  fn: () => Promise<unknown>,
  errorContains: string,
  message: string
): Promise<void> {
  try {
    await fn();
    throw new Error(`${message} - Expected error but succeeded`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Expected error but succeeded')) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (!errorMsg.toLowerCase().includes(errorContains.toLowerCase())) {
      throw new Error(`${message} - Expected error containing "${errorContains}" but got: ${errorMsg}`);
    }
  }
}

// ============================================================================
// MIGRATION FILE TESTS
// ============================================================================

await test('Migration file exists', async () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20251228_event_sourced_lifecycle.sql'
  );
  expect(fs.existsSync(migrationPath), 'Migration file should exist');
});

await test('Migration file contains all required tables', async () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20251228_event_sourced_lifecycle.sql'
  );
  const content = fs.readFileSync(migrationPath, 'utf-8');

  const requiredTables = [
    'event_store',
    'product_processes',
    'product_process_stages',
    'company_product_read_model',
    'company_product_stage_facts',
    'product_pipeline_stage_counts',
    'projector_checkpoints',
  ];

  for (const table of requiredTables) {
    expect(
      content.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `Migration should contain CREATE TABLE for ${table}`
    );
  }
});

await test('Migration file contains immutability trigger', async () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20251228_event_sourced_lifecycle.sql'
  );
  const content = fs.readFileSync(migrationPath, 'utf-8');

  expect(
    content.includes('prevent_event_store_mutation'),
    'Migration should contain immutability trigger function'
  );

  expect(
    content.includes('enforce_event_store_immutability'),
    'Migration should contain immutability trigger'
  );
});

// ============================================================================
// DATABASE TABLE TESTS
// ============================================================================

await test('event_store table exists', async () => {
  const { data, error } = await supabase
    .from('event_store')
    .select('id')
    .limit(1);

  // Error about no rows is fine, error about table not existing is not
  if (error && error.message.includes('does not exist')) {
    throw new Error('event_store table does not exist');
  }
});

await test('product_processes table exists', async () => {
  const { error } = await supabase
    .from('product_processes')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    throw new Error('product_processes table does not exist');
  }
});

await test('product_process_stages table exists', async () => {
  const { error } = await supabase
    .from('product_process_stages')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    throw new Error('product_process_stages table does not exist');
  }
});

await test('company_product_read_model table exists', async () => {
  const { error } = await supabase
    .from('company_product_read_model')
    .select('company_product_id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    throw new Error('company_product_read_model table does not exist');
  }
});

await test('company_product_stage_facts table exists', async () => {
  const { error } = await supabase
    .from('company_product_stage_facts')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    throw new Error('company_product_stage_facts table does not exist');
  }
});

await test('product_pipeline_stage_counts table exists', async () => {
  const { error } = await supabase
    .from('product_pipeline_stage_counts')
    .select('id')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    throw new Error('product_pipeline_stage_counts table does not exist');
  }
});

await test('projector_checkpoints table exists', async () => {
  const { error } = await supabase
    .from('projector_checkpoints')
    .select('projector_name')
    .limit(1);

  if (error && error.message.includes('does not exist')) {
    throw new Error('projector_checkpoints table does not exist');
  }
});

// ============================================================================
// EVENT STORE CONSTRAINT TESTS
// ============================================================================

await test('event_store unique constraint on (aggregate_type, aggregate_id, sequence_number)', async () => {
  const testAggregateId = crypto.randomUUID();
  const testAggregateType = 'test_aggregate';

  // Insert first event with sequence 1
  const { error: error1 } = await supabase.from('event_store').insert({
    aggregate_type: testAggregateType,
    aggregate_id: testAggregateId,
    sequence_number: 1,
    event_type: 'TestEvent',
    event_data: { test: true },
    actor_type: 'system',
  });

  expect(error1 === null || error1 === undefined, `First insert should succeed: ${error1?.message}`);

  // Try to insert duplicate sequence number - should fail
  const { error: error2 } = await supabase.from('event_store').insert({
    aggregate_type: testAggregateType,
    aggregate_id: testAggregateId,
    sequence_number: 1, // Same sequence number
    event_type: 'TestEvent',
    event_data: { test: true },
    actor_type: 'system',
  });

  expect(
    error2 !== null && error2 !== undefined,
    'Duplicate (aggregate_type, aggregate_id, sequence_number) insert should fail'
  );

  expect(
    (error2?.message?.includes('unique') || error2?.message?.includes('duplicate')) === true,
    `Error should mention unique constraint violation: ${error2?.message}`
  );

  // Cleanup
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_id', testAggregateId);
});

await test('event_store allows different sequence numbers for same aggregate', async () => {
  const testAggregateId = crypto.randomUUID();
  const testAggregateType = 'test_aggregate';

  // Insert sequence 1
  const { error: error1 } = await supabase.from('event_store').insert({
    aggregate_type: testAggregateType,
    aggregate_id: testAggregateId,
    sequence_number: 1,
    event_type: 'TestEvent1',
    event_data: { sequence: 1 },
    actor_type: 'system',
  });

  expect(!error1, `Sequence 1 insert should succeed: ${error1?.message}`);

  // Insert sequence 2
  const { error: error2 } = await supabase.from('event_store').insert({
    aggregate_type: testAggregateType,
    aggregate_id: testAggregateId,
    sequence_number: 2,
    event_type: 'TestEvent2',
    event_data: { sequence: 2 },
    actor_type: 'system',
  });

  expect(!error2, `Sequence 2 insert should succeed: ${error2?.message}`);

  // Cleanup
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_id', testAggregateId);
});

await test('event_store actor_type check constraint', async () => {
  const testAggregateId = crypto.randomUUID();

  // Try invalid actor_type - should fail
  const { error } = await supabase.from('event_store').insert({
    aggregate_type: 'test',
    aggregate_id: testAggregateId,
    sequence_number: 1,
    event_type: 'TestEvent',
    event_data: {},
    actor_type: 'invalid_actor', // Invalid
  });

  expect(
    !!error,
    'Invalid actor_type should fail'
  );

  // Cleanup (in case it somehow succeeded)
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_id', testAggregateId);
});

await test('event_store immutability - updates are blocked', async () => {
  const testAggregateId = crypto.randomUUID();

  // Insert an event
  await supabase.from('event_store').insert({
    aggregate_type: 'test',
    aggregate_id: testAggregateId,
    sequence_number: 1,
    event_type: 'TestEvent',
    event_data: { original: true },
    actor_type: 'system',
  });

  // Try to update - should fail
  const { error } = await supabase
    .from('event_store')
    .update({ event_data: { modified: true } })
    .eq('aggregate_id', testAggregateId);

  expect(
    !!error,
    'Update to event_store should fail due to immutability trigger'
  );

  expect(
    (error?.message?.includes('immutable') || error?.message?.includes('not allowed')) === true,
    `Error should mention immutability: ${error?.message}`
  );

  // Cleanup - this delete might also fail due to trigger, which is fine
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_id', testAggregateId);
});

// ============================================================================
// PROJECTOR CHECKPOINTS TESTS
// ============================================================================

await test('Default projector checkpoints are created', async () => {
  const { data, error } = await supabase
    .from('projector_checkpoints')
    .select('projector_name, status')
    .in('projector_name', [
      'company_product_read_model',
      'company_product_stage_facts',
      'product_pipeline_stage_counts',
    ]);

  expect(!error, `Query should succeed: ${error?.message}`);
  expect(data?.length === 3, 'All three default projectors should exist');

  for (const checkpoint of data || []) {
    expect(
      checkpoint.status === 'active',
      `Projector ${checkpoint.projector_name} should be active`
    );
  }
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

await test('get_next_event_sequence function exists and works', async () => {
  const testAggregateId = crypto.randomUUID();

  // Call the function for a new aggregate
  const { data: seq1, error: error1 } = await supabase.rpc('get_next_event_sequence', {
    p_aggregate_type: 'test',
    p_aggregate_id: testAggregateId,
  });

  expect(!error1, `Function call should succeed: ${error1?.message}`);
  expect(seq1 === 1, 'First sequence should be 1');

  // Insert an event
  await supabase.from('event_store').insert({
    aggregate_type: 'test',
    aggregate_id: testAggregateId,
    sequence_number: 1,
    event_type: 'TestEvent',
    event_data: {},
    actor_type: 'system',
  });

  // Call again - should return 2
  const { data: seq2, error: error2 } = await supabase.rpc('get_next_event_sequence', {
    p_aggregate_type: 'test',
    p_aggregate_id: testAggregateId,
  });

  expect(!error2, `Second function call should succeed: ${error2?.message}`);
  expect(seq2 === 2, 'Second sequence should be 2');

  // Cleanup
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_id', testAggregateId);
});

await test('append_event function exists and works', async () => {
  const testAggregateId = crypto.randomUUID();

  // Call append_event function
  const { data: eventId, error } = await supabase.rpc('append_event', {
    p_aggregate_type: 'test',
    p_aggregate_id: testAggregateId,
    p_event_type: 'TestEvent',
    p_event_data: { test: 'data' },
    p_actor_type: 'system',
    p_actor_id: null,
    p_metadata: { correlation_id: 'test-123' },
  });

  expect(!error, `append_event should succeed: ${error?.message}`);
  expect(!!eventId, 'append_event should return event ID');

  // Verify the event was created
  const { data: event } = await supabase
    .from('event_store')
    .select('*')
    .eq('id', eventId)
    .single();

  expect(event?.sequence_number === 1, 'Event should have sequence 1');
  expect(event?.event_type === 'TestEvent', 'Event type should match');

  // Cleanup
  await supabase
    .from('event_store')
    .delete()
    .eq('aggregate_id', testAggregateId);
});

// ============================================================================
// TYPESCRIPT TYPES TEST
// ============================================================================

await test('TypeScript types file exists', async () => {
  const typesPath = path.join(process.cwd(), 'src/types/eventSourcing.ts');
  expect(fs.existsSync(typesPath), 'eventSourcing.ts types file should exist');
});

await test('TypeScript types contain required exports', async () => {
  const typesPath = path.join(process.cwd(), 'src/types/eventSourcing.ts');
  const content = fs.readFileSync(typesPath, 'utf-8');

  const requiredExports = [
    'EventStore',
    'ProductProcess',
    'ProductProcessStage',
    'CompanyProductReadModel',
    'CompanyProductStageFact',
    'ProductPipelineStageCount',
    'ProjectorCheckpoint',
    'ProcessType',
    'ActorType',
    'CreateEventInput',
    'TransitionStageCommand',
  ];

  for (const exportName of requiredExports) {
    expect(
      content.includes(`export interface ${exportName}`) ||
        content.includes(`export type ${exportName}`),
      `Types file should export ${exportName}`
    );
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('EVENT SOURCING DATABASE TEST SUMMARY');
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
  console.log('\n✅ All event sourcing tests passed!');
  process.exit(0);
}
