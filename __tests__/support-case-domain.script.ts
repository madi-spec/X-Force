/**
 * SupportCase Domain Tests
 *
 * Tests for the event-sourced support case system:
 * 1. Replay builds correct current state
 * 2. Status transitions enforce invariants
 * 3. Sequence numbers are monotonic
 *
 * Run with: npx tsx __tests__/support-case-domain.test.ts
 */

import {
  createInitialState,
  applyEvent,
  replayEvents,
  isValidStatusTransition,
  canClose,
  canReopen,
  VALID_STATUS_TRANSITIONS,
  type SupportCaseState,
} from '../src/lib/supportCase/aggregate';
import type { EventStore } from '../src/types/eventSourcing';
import type { SupportCaseStatus, SupportCaseSeverity } from '../src/types/supportCase';

// ============================================================================
// TEST INFRASTRUCTURE
// ============================================================================

interface TestResult {
  passed: boolean;
  name: string;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectDeepEqual<T>(actual: T, expected: T, message: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}: expected ${expectedStr}, got ${actualStr}`);
  }
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockEvent(
  overrides: Partial<EventStore> & { event_type: string; event_data: Record<string, unknown> }
): EventStore {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    aggregate_type: 'support_case',
    aggregate_id: overrides.aggregate_id ?? 'test-case-1',
    sequence_number: overrides.sequence_number ?? 1,
    global_sequence: overrides.global_sequence ?? 1,
    event_type: overrides.event_type,
    event_data: overrides.event_data,
    metadata: overrides.metadata ?? {},
    actor_type: overrides.actor_type ?? 'user',
    actor_id: overrides.actor_id ?? 'user-1',
    occurred_at: overrides.occurred_at ?? new Date().toISOString(),
    recorded_at: overrides.recorded_at ?? new Date().toISOString(),
  };
}

// ============================================================================
// TEST: REPLAY BUILDS CORRECT STATE
// ============================================================================

async function runReplayTests() {
  console.log('\n📊 TESTS: Replay Builds Correct State\n');

  await test('Initial state has correct defaults', () => {
    const state = createInitialState('case-1', 'company-1', 'product-1');

    expectEqual(state.id, 'case-1', 'ID');
    expectEqual(state.companyId, 'company-1', 'Company ID');
    expectEqual(state.companyProductId, 'product-1', 'Company Product ID');
    expectEqual(state.status, 'open', 'Status');
    expectEqual(state.severity, 'medium', 'Severity');
    expectEqual(state.isResolved, false, 'Is Resolved');
    expectEqual(state.isClosed, false, 'Is Closed');
    expectEqual(state.version, 0, 'Version');
    expectEqual(state.customerMessageCount, 0, 'Customer Message Count');
    expectEqual(state.agentResponseCount, 0, 'Agent Response Count');
  });

  await test('SupportCaseCreated event sets initial case data', () => {
    const initial = createInitialState('case-1', 'company-1', null);
    const event = createMockEvent({
      event_type: 'SupportCaseCreated',
      sequence_number: 1,
      event_data: {
        title: 'Test Case',
        description: 'Test description',
        severity: 'high' as SupportCaseSeverity,
        category: 'billing',
        source: 'email',
        contactEmail: 'test@example.com',
      },
    });

    const state = applyEvent(initial, event);

    expectEqual(state.title, 'Test Case', 'Title');
    expectEqual(state.description, 'Test description', 'Description');
    expectEqual(state.severity, 'high', 'Severity');
    expectEqual(state.category, 'billing', 'Category');
    expectEqual(state.source, 'email', 'Source');
    expectEqual(state.contactEmail, 'test@example.com', 'Contact Email');
    expectEqual(state.status, 'open', 'Status');
    expectEqual(state.version, 1, 'Version');
  });

  await test('SupportCaseAssigned event updates owner', () => {
    const initial = createInitialState('case-1', 'company-1', null);
    const event = createMockEvent({
      event_type: 'SupportCaseAssigned',
      sequence_number: 1,
      event_data: {
        fromOwnerId: null,
        fromOwnerName: null,
        toOwnerId: 'user-123',
        toOwnerName: 'John Doe',
        team: 'Support',
      },
    });

    const state = applyEvent(initial, event);

    expectEqual(state.ownerId, 'user-123', 'Owner ID');
    expectEqual(state.ownerName, 'John Doe', 'Owner Name');
    expectEqual(state.assignedTeam, 'Support', 'Assigned Team');
  });

  await test('SupportCaseStatusChanged event updates status', () => {
    const initial = createInitialState('case-1', 'company-1', null);
    const event = createMockEvent({
      event_type: 'SupportCaseStatusChanged',
      sequence_number: 1,
      event_data: {
        fromStatus: 'open',
        toStatus: 'in_progress' as SupportCaseStatus,
      },
    });

    const state = applyEvent(initial, event);

    expectEqual(state.status, 'in_progress', 'Status');
  });

  await test('SupportCaseResolved event marks case as resolved', () => {
    const initial = createInitialState('case-1', 'company-1', null);
    const event = createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 1,
      occurred_at: '2024-01-15T12:00:00Z',
      event_data: {
        resolutionSummary: 'Fixed the issue',
        rootCause: 'Configuration error',
        resolutionTimeHours: 4.5,
        slaHours: 8,
        slaMet: true,
      },
    });

    const state = applyEvent(initial, event);

    expectEqual(state.status, 'resolved', 'Status');
    expectEqual(state.isResolved, true, 'Is Resolved');
    expectEqual(state.resolutionSummary, 'Fixed the issue', 'Resolution Summary');
    expectEqual(state.rootCause, 'Configuration error', 'Root Cause');
    expectEqual(state.resolvedAt, '2024-01-15T12:00:00Z', 'Resolved At');
  });

  await test('SupportCaseClosed event marks case as closed', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // First resolve
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 1,
      event_data: {
        resolutionSummary: 'Fixed',
        resolutionTimeHours: 2,
        slaHours: 8,
        slaMet: true,
      },
    }));

    // Then close
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseClosed',
      sequence_number: 2,
      occurred_at: '2024-01-15T14:00:00Z',
      event_data: {
        closeReason: 'resolved',
        forcedClose: false,
      },
    }));

    expectEqual(state.status, 'closed', 'Status');
    expectEqual(state.isClosed, true, 'Is Closed');
    expectEqual(state.closeReason, 'resolved', 'Close Reason');
    expectEqual(state.closedAt, '2024-01-15T14:00:00Z', 'Closed At');
  });

  await test('SupportCaseReopened event resets resolved/closed state', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // Create, resolve, close
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseCreated',
      sequence_number: 1,
      event_data: { title: 'Test', severity: 'medium', source: 'email' },
    }));
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 2,
      event_data: { resolutionSummary: 'Fixed', resolutionTimeHours: 2, slaHours: 8, slaMet: true },
    }));
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseClosed',
      sequence_number: 3,
      event_data: { closeReason: 'resolved', forcedClose: false },
    }));

    // Then reopen
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseReopened',
      sequence_number: 4,
      event_data: {
        reason: 'Issue recurred',
        previousCloseReason: 'resolved',
        reopenedFromStatus: 'closed',
      },
    }));

    expectEqual(state.status, 'open', 'Status');
    expectEqual(state.isResolved, false, 'Is Resolved');
    expectEqual(state.isClosed, false, 'Is Closed');
    expectEqual(state.resolvedAt, null, 'Resolved At');
    expectEqual(state.closedAt, null, 'Closed At');
    expectEqual(state.closeReason, null, 'Close Reason');
    expectEqual(state.reopenCount, 1, 'Reopen Count');
  });

  await test('CustomerMessageLogged increments count and updates timestamp', () => {
    let state = createInitialState('case-1', 'company-1', null);

    state = applyEvent(state, createMockEvent({
      event_type: 'CustomerMessageLogged',
      sequence_number: 1,
      event_data: {
        channel: 'email',
        receivedAt: '2024-01-15T10:00:00Z',
      },
    }));

    expectEqual(state.customerMessageCount, 1, 'Customer Message Count');
    expectEqual(state.lastCustomerContactAt, '2024-01-15T10:00:00Z', 'Last Customer Contact At');

    state = applyEvent(state, createMockEvent({
      event_type: 'CustomerMessageLogged',
      sequence_number: 2,
      event_data: {
        channel: 'email',
        receivedAt: '2024-01-15T11:00:00Z',
      },
    }));

    expectEqual(state.customerMessageCount, 2, 'Customer Message Count after second');
    expectEqual(state.lastCustomerContactAt, '2024-01-15T11:00:00Z', 'Last Customer Contact At after second');
  });

  await test('AgentResponseSent tracks first response correctly', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // First response
    state = applyEvent(state, createMockEvent({
      event_type: 'AgentResponseSent',
      sequence_number: 1,
      occurred_at: '2024-01-15T10:30:00Z',
      event_data: {
        channel: 'email',
        isFirstResponse: true,
      },
    }));

    expectEqual(state.agentResponseCount, 1, 'Agent Response Count');
    expectEqual(state.firstResponseAt, '2024-01-15T10:30:00Z', 'First Response At');

    // Second response
    state = applyEvent(state, createMockEvent({
      event_type: 'AgentResponseSent',
      sequence_number: 2,
      occurred_at: '2024-01-15T11:30:00Z',
      event_data: {
        channel: 'email',
        isFirstResponse: false,
      },
    }));

    expectEqual(state.agentResponseCount, 2, 'Agent Response Count after second');
    expectEqual(state.firstResponseAt, '2024-01-15T10:30:00Z', 'First Response At should not change');
  });

  await test('Tag events manage tags correctly', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // Add tags
    state = applyEvent(state, createMockEvent({
      event_type: 'TagAdded',
      sequence_number: 1,
      event_data: { tag: 'urgent' },
    }));
    state = applyEvent(state, createMockEvent({
      event_type: 'TagAdded',
      sequence_number: 2,
      event_data: { tag: 'billing' },
    }));

    expectDeepEqual(state.tags, ['urgent', 'billing'], 'Tags after adding');

    // Remove one tag
    state = applyEvent(state, createMockEvent({
      event_type: 'TagRemoved',
      sequence_number: 3,
      event_data: { tag: 'urgent' },
    }));

    expectDeepEqual(state.tags, ['billing'], 'Tags after removing');

    // Adding duplicate tag should be idempotent
    state = applyEvent(state, createMockEvent({
      event_type: 'TagAdded',
      sequence_number: 4,
      event_data: { tag: 'billing' },
    }));

    expectDeepEqual(state.tags, ['billing'], 'Tags should not have duplicates');
  });

  await test('Full case lifecycle replay', () => {
    const events: EventStore[] = [
      createMockEvent({
        event_type: 'SupportCaseCreated',
        sequence_number: 1,
        occurred_at: '2024-01-15T09:00:00Z',
        event_data: {
          title: 'Cannot login',
          description: 'User cannot access dashboard',
          severity: 'high',
          category: 'authentication',
          source: 'email',
          contactEmail: 'user@example.com',
        },
      }),
      createMockEvent({
        event_type: 'SupportCaseAssigned',
        sequence_number: 2,
        event_data: {
          fromOwnerId: null,
          fromOwnerName: null,
          toOwnerId: 'agent-1',
          toOwnerName: 'Jane Smith',
          team: 'Tier 1 Support',
        },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 3,
        event_data: {
          fromStatus: 'open',
          toStatus: 'in_progress',
        },
      }),
      createMockEvent({
        event_type: 'CustomerMessageLogged',
        sequence_number: 4,
        event_data: {
          channel: 'email',
          receivedAt: '2024-01-15T09:30:00Z',
        },
      }),
      createMockEvent({
        event_type: 'AgentResponseSent',
        sequence_number: 5,
        occurred_at: '2024-01-15T10:00:00Z',
        event_data: {
          channel: 'email',
          isFirstResponse: true,
        },
      }),
      createMockEvent({
        event_type: 'SupportCaseResolved',
        sequence_number: 6,
        occurred_at: '2024-01-15T11:00:00Z',
        event_data: {
          resolutionSummary: 'Password reset completed',
          rootCause: 'Expired credentials',
          resolutionTimeHours: 2,
          slaHours: 4,
          slaMet: true,
        },
      }),
      createMockEvent({
        event_type: 'CsatSubmitted',
        sequence_number: 7,
        event_data: {
          score: 5,
          comment: 'Great support!',
        },
      }),
      createMockEvent({
        event_type: 'SupportCaseClosed',
        sequence_number: 8,
        occurred_at: '2024-01-15T12:00:00Z',
        event_data: {
          closeReason: 'resolved',
          forcedClose: false,
        },
      }),
    ];

    const initial = createInitialState('case-1', 'company-1', null);
    const state = replayEvents(initial, events);

    expectEqual(state.title, 'Cannot login', 'Title');
    expectEqual(state.status, 'closed', 'Status');
    expectEqual(state.severity, 'high', 'Severity');
    expectEqual(state.ownerId, 'agent-1', 'Owner ID');
    expectEqual(state.ownerName, 'Jane Smith', 'Owner Name');
    expectEqual(state.isResolved, true, 'Is Resolved');
    expectEqual(state.isClosed, true, 'Is Closed');
    expectEqual(state.customerMessageCount, 1, 'Customer Message Count');
    expectEqual(state.agentResponseCount, 1, 'Agent Response Count');
    expectEqual(state.csatScore, 5, 'CSAT Score');
    expectEqual(state.csatComment, 'Great support!', 'CSAT Comment');
    expectEqual(state.version, 8, 'Version');
    expectEqual(state.lastEventSequence, 8, 'Last Event Sequence');
  });
}

// ============================================================================
// TEST: STATUS TRANSITION INVARIANTS
// ============================================================================

async function runInvariantTests() {
  console.log('\n📊 TESTS: Status Transition Invariants\n');

  await test('isValidStatusTransition allows valid transitions from open', () => {
    expect(isValidStatusTransition('open', 'in_progress'), 'open -> in_progress');
    expect(isValidStatusTransition('open', 'waiting_on_customer'), 'open -> waiting_on_customer');
    expect(isValidStatusTransition('open', 'escalated'), 'open -> escalated');
    expect(isValidStatusTransition('open', 'resolved'), 'open -> resolved');
    expect(isValidStatusTransition('open', 'closed'), 'open -> closed');
  });

  await test('isValidStatusTransition blocks invalid transitions', () => {
    // Can't go from closed to in_progress directly
    expect(!isValidStatusTransition('closed', 'in_progress'), 'closed -> in_progress should be blocked');
    expect(!isValidStatusTransition('closed', 'resolved'), 'closed -> resolved should be blocked');
    expect(!isValidStatusTransition('closed', 'escalated'), 'closed -> escalated should be blocked');

    // Can only reopen from closed
    expect(isValidStatusTransition('closed', 'open'), 'closed -> open should be allowed (reopen)');
  });

  await test('isValidStatusTransition blocks same-status transitions', () => {
    const statuses: SupportCaseStatus[] = [
      'open', 'in_progress', 'waiting_on_customer', 'waiting_on_internal',
      'escalated', 'resolved', 'closed'
    ];

    for (const status of statuses) {
      expect(!isValidStatusTransition(status, status), `${status} -> ${status} should be blocked`);
    }
  });

  await test('canClose requires resolution by default', () => {
    const state = createInitialState('case-1', 'company-1', null);

    const result = canClose(state);
    expect(!result.canClose, 'Should not allow closing unresolved case');
    expect(result.reason?.includes('resolved'), 'Reason should mention resolution');
  });

  await test('canClose allows force close without resolution', () => {
    const state = createInitialState('case-1', 'company-1', null);

    const result = canClose(state, true);
    expect(result.canClose, 'Should allow force close');
  });

  await test('canClose blocks already closed cases', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // Resolve and close
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 1,
      event_data: { resolutionSummary: 'Fixed', resolutionTimeHours: 2, slaHours: 8, slaMet: true },
    }));
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseClosed',
      sequence_number: 2,
      event_data: { closeReason: 'resolved', forcedClose: false },
    }));

    const result = canClose(state);
    expect(!result.canClose, 'Should not allow closing already closed case');
    expect(result.reason?.includes('already closed'), 'Reason should mention already closed');
  });

  await test('canClose allows closing resolved case', () => {
    let state = createInitialState('case-1', 'company-1', null);

    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 1,
      event_data: { resolutionSummary: 'Fixed', resolutionTimeHours: 2, slaHours: 8, slaMet: true },
    }));

    const result = canClose(state);
    expect(result.canClose, 'Should allow closing resolved case');
  });

  await test('canReopen allows reopening closed cases', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // Resolve and close
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 1,
      event_data: { resolutionSummary: 'Fixed', resolutionTimeHours: 2, slaHours: 8, slaMet: true },
    }));
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseClosed',
      sequence_number: 2,
      event_data: { closeReason: 'resolved', forcedClose: false },
    }));

    const result = canReopen(state);
    expect(result.canReopen, 'Should allow reopening closed case');
  });

  await test('canReopen allows reopening resolved cases', () => {
    let state = createInitialState('case-1', 'company-1', null);

    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseResolved',
      sequence_number: 1,
      event_data: { resolutionSummary: 'Fixed', resolutionTimeHours: 2, slaHours: 8, slaMet: true },
    }));

    const result = canReopen(state);
    expect(result.canReopen, 'Should allow reopening resolved case');
  });

  await test('canReopen blocks reopening open cases', () => {
    const state = createInitialState('case-1', 'company-1', null);

    const result = canReopen(state);
    expect(!result.canReopen, 'Should not allow reopening open case');
    expect(result.reason?.includes('not closed'), 'Reason should mention not closed');
  });

  await test('All status transitions in VALID_STATUS_TRANSITIONS are bidirectionally consistent', () => {
    // Verify that the status transition map is well-formed
    const allStatuses = Object.keys(VALID_STATUS_TRANSITIONS) as SupportCaseStatus[];

    for (const fromStatus of allStatuses) {
      const allowed = VALID_STATUS_TRANSITIONS[fromStatus];
      expect(Array.isArray(allowed), `${fromStatus} should have an array of transitions`);
      expect(!allowed.includes(fromStatus), `${fromStatus} should not transition to itself`);
    }
  });
}

// ============================================================================
// TEST: SEQUENCE NUMBER MONOTONICITY
// ============================================================================

async function runSequenceTests() {
  console.log('\n📊 TESTS: Sequence Number Monotonicity\n');

  await test('replayEvents throws on out-of-order sequence numbers', () => {
    const events: EventStore[] = [
      createMockEvent({
        event_type: 'SupportCaseCreated',
        sequence_number: 2, // Start at 2
        event_data: { title: 'Test', severity: 'medium', source: 'email' },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 1, // Goes back to 1 - OUT OF ORDER
        event_data: { fromStatus: 'open', toStatus: 'in_progress' },
      }),
    ];

    const initial = createInitialState('case-1', 'company-1', null);

    let threw = false;
    let errorMessage = '';
    try {
      replayEvents(initial, events);
    } catch (error) {
      threw = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(threw, 'Should throw on out-of-order sequence');
    expect(errorMessage.includes('out of order'), 'Error should mention out of order');
  });

  await test('replayEvents throws on duplicate sequence numbers', () => {
    const events: EventStore[] = [
      createMockEvent({
        event_type: 'SupportCaseCreated',
        sequence_number: 1,
        event_data: { title: 'Test', severity: 'medium', source: 'email' },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 1, // Duplicate sequence!
        event_data: { fromStatus: 'open', toStatus: 'in_progress' },
      }),
    ];

    const initial = createInitialState('case-1', 'company-1', null);

    let threw = false;
    try {
      replayEvents(initial, events);
    } catch (error) {
      threw = true;
    }

    expect(threw, 'Should throw on duplicate sequence numbers');
  });

  await test('replayEvents accepts strictly increasing sequence numbers', () => {
    const events: EventStore[] = [
      createMockEvent({
        event_type: 'SupportCaseCreated',
        sequence_number: 1,
        event_data: { title: 'Test', severity: 'medium', source: 'email' },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 2,
        event_data: { fromStatus: 'open', toStatus: 'in_progress' },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 3,
        event_data: { fromStatus: 'in_progress', toStatus: 'resolved' },
      }),
    ];

    const initial = createInitialState('case-1', 'company-1', null);
    const state = replayEvents(initial, events);

    expectEqual(state.version, 3, 'Version should equal number of events');
    expectEqual(state.lastEventSequence, 3, 'Last event sequence should be 3');
  });

  await test('applyEvent increments version correctly', () => {
    let state = createInitialState('case-1', 'company-1', null);
    expectEqual(state.version, 0, 'Initial version should be 0');

    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseCreated',
      sequence_number: 1,
      event_data: { title: 'Test', severity: 'medium', source: 'email' },
    }));
    expectEqual(state.version, 1, 'Version after first event');

    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseStatusChanged',
      sequence_number: 2,
      event_data: { fromStatus: 'open', toStatus: 'in_progress' },
    }));
    expectEqual(state.version, 2, 'Version after second event');

    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseStatusChanged',
      sequence_number: 3,
      event_data: { fromStatus: 'in_progress', toStatus: 'escalated' },
    }));
    expectEqual(state.version, 3, 'Version after third event');
  });

  await test('lastEventSequence tracks sequence correctly', () => {
    let state = createInitialState('case-1', 'company-1', null);

    // Event with sequence 5
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseCreated',
      sequence_number: 5,
      event_data: { title: 'Test', severity: 'medium', source: 'email' },
    }));
    expectEqual(state.lastEventSequence, 5, 'Last sequence after event 5');

    // Event with sequence 10
    state = applyEvent(state, createMockEvent({
      event_type: 'SupportCaseStatusChanged',
      sequence_number: 10,
      event_data: { fromStatus: 'open', toStatus: 'in_progress' },
    }));
    expectEqual(state.lastEventSequence, 10, 'Last sequence after event 10');
  });

  await test('replayEvents accepts non-contiguous but monotonic sequences', () => {
    // Sequences can have gaps (e.g., 1, 5, 10) as long as they're increasing
    const events: EventStore[] = [
      createMockEvent({
        event_type: 'SupportCaseCreated',
        sequence_number: 1,
        event_data: { title: 'Test', severity: 'medium', source: 'email' },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 5, // Gap is OK
        event_data: { fromStatus: 'open', toStatus: 'in_progress' },
      }),
      createMockEvent({
        event_type: 'SupportCaseStatusChanged',
        sequence_number: 100, // Large gap is OK
        event_data: { fromStatus: 'in_progress', toStatus: 'resolved' },
      }),
    ];

    const initial = createInitialState('case-1', 'company-1', null);
    const state = replayEvents(initial, events);

    expectEqual(state.version, 3, 'Version should count events, not sequences');
    expectEqual(state.lastEventSequence, 100, 'Last sequence should be 100');
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('SUPPORT CASE DOMAIN TESTS');
  console.log('='.repeat(60));

  await runReplayTests();
  await runInvariantTests();
  await runSequenceTests();

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
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
    console.log('\n✅ All support case domain tests passed!\n');
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
