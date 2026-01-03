/**
 * Signal to Work Item Pipeline
 *
 * Processes SignalDetectedEvents and creates/attaches to Work items.
 * Uses deterministic rules - no keyword matching or AI in the pipeline itself.
 *
 * Flow:
 * 1. SignalDetectedEvent arrives
 * 2. Check for existing open Work item for same entity
 * 3. If exists, emit WorkItemSignalAttached + SignalWorkItemAttached
 * 4. If not, emit WorkItemCreated + SignalWorkItemCreated
 * 5. Project both signal and work item events
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LensType } from '@/lib/lens/types';
import { QueueId } from '@/lib/work/types';

import {
  WorkItemCreatedEvent,
  WorkItemSignalAttachedEvent,
  WorkItemSourceType,
  WorkItemSignalType,
  WorkItemPriority,
} from '@/lib/work/events';
import {
  SignalDetectedEvent,
  SignalWorkItemCreatedEvent,
  SignalWorkItemAttachedEvent,
  SignalType,
  SignalSeverity,
  SignalEntityRef,
  generateSignalExplanation,
} from './events';
import { SignalDetailProjection, SignalProjector } from './projections';
import { WorkItemProjector, WorkItemDetailProjection } from '@/lib/work/projections';

// Simple UUID generator (crypto.randomUUID may not be available in all environments)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// SIGNAL TYPE TO WORK ITEM MAPPING
// ============================================================================

/**
 * Maps Signal types to Work item signal types.
 * This is deterministic mapping, not AI classification.
 */
const SIGNAL_TO_WORK_SIGNAL_TYPE: Record<SignalType, WorkItemSignalType> = {
  // Customer Health Signals
  churn_risk: 'churn_risk',
  expansion_ready: 'expansion_ready',
  health_declining: 'churn_risk',
  health_improving: 'expansion_ready',
  // Engagement Signals
  engagement_spike: 'expansion_ready',
  engagement_drop: 'churn_risk',
  champion_dark: 'churn_risk',
  new_stakeholder: 'follow_up_due',
  // Deal Signals
  deal_stalled: 'deal_stalled',
  competitive_threat: 'deal_stalled',
  budget_at_risk: 'deal_stalled',
  timeline_slip: 'deal_stalled',
  buying_signal: 'follow_up_due',
  // Commitment Signals
  promise_at_risk: 'promise_at_risk',
  sla_breach: 'sla_breach',
  deadline_approaching: 'milestone_due',
  commitment_overdue: 'promise_at_risk',
  // Communication Signals
  message_needs_reply: 'message_needs_reply',
  escalation_detected: 'case_escalated',
  objection_raised: 'follow_up_due',
  positive_sentiment: 'follow_up_due',
  // Lifecycle Signals
  onboarding_blocked: 'onboarding_blocked',
  milestone_due: 'milestone_due',
  renewal_approaching: 'follow_up_due',
  trial_ending: 'follow_up_due',
};

/**
 * Maps Signal types to Work item source types.
 */
const SIGNAL_TO_WORK_SOURCE_TYPE: Record<SignalType, WorkItemSourceType> = {
  // Customer Health Signals → command_center
  churn_risk: 'command_center',
  expansion_ready: 'command_center',
  health_declining: 'command_center',
  health_improving: 'command_center',
  // Engagement Signals → command_center
  engagement_spike: 'command_center',
  engagement_drop: 'command_center',
  champion_dark: 'command_center',
  new_stakeholder: 'command_center',
  // Deal Signals → lifecycle_stage
  deal_stalled: 'lifecycle_stage',
  competitive_threat: 'command_center',
  budget_at_risk: 'command_center',
  timeline_slip: 'lifecycle_stage',
  buying_signal: 'command_center',
  // Commitment Signals → command_center
  promise_at_risk: 'command_center',
  sla_breach: 'command_center',
  deadline_approaching: 'lifecycle_stage',
  commitment_overdue: 'command_center',
  // Communication Signals → communication
  message_needs_reply: 'communication',
  escalation_detected: 'communication',
  objection_raised: 'communication',
  positive_sentiment: 'communication',
  // Lifecycle Signals → lifecycle_stage
  onboarding_blocked: 'lifecycle_stage',
  milestone_due: 'lifecycle_stage',
  renewal_approaching: 'lifecycle_stage',
  trial_ending: 'lifecycle_stage',
};

/**
 * Maps Signal types to appropriate focus lens.
 */
const SIGNAL_TO_FOCUS_LENS: Record<SignalType, LensType> = {
  // Customer Health → based on lifecycle
  churn_risk: 'customer_success',
  expansion_ready: 'sales',
  health_declining: 'customer_success',
  health_improving: 'customer_success',
  // Engagement → customer success mostly
  engagement_spike: 'sales',
  engagement_drop: 'customer_success',
  champion_dark: 'customer_success',
  new_stakeholder: 'sales',
  // Deal → sales
  deal_stalled: 'sales',
  competitive_threat: 'sales',
  budget_at_risk: 'sales',
  timeline_slip: 'sales',
  buying_signal: 'sales',
  // Commitment → varies
  promise_at_risk: 'customer_success',
  sla_breach: 'support',
  deadline_approaching: 'customer_success',
  commitment_overdue: 'customer_success',
  // Communication → varies
  message_needs_reply: 'sales',
  escalation_detected: 'support',
  objection_raised: 'sales',
  positive_sentiment: 'sales',
  // Lifecycle → varies
  onboarding_blocked: 'onboarding',
  milestone_due: 'onboarding',
  renewal_approaching: 'customer_success',
  trial_ending: 'sales',
};

/**
 * Maps Signal types to queue IDs.
 * Signals are routed to the most appropriate queue based on their nature:
 * - Risk/urgent signals → at_risk, sla_breaches, blocked queues
 * - Sales signals → follow_ups, stalled_deals, new_leads
 * - Opportunity signals → expansion_ready
 * - Support signals → high_severity, unassigned
 */
const SIGNAL_TO_QUEUE_ID: Record<SignalType, QueueId> = {
  // Customer risk signals → at_risk queue (CS focus)
  churn_risk: 'at_risk',
  health_declining: 'at_risk',
  engagement_drop: 'at_risk',
  champion_dark: 'at_risk',

  // Support urgency → sla_breaches or high_severity (Support focus)
  sla_breach: 'sla_breaches',
  escalation_detected: 'high_severity',
  message_needs_reply: 'unresolved_issues',

  // Commitment/promise → follow_ups (Sales focus)
  promise_at_risk: 'follow_ups',
  commitment_overdue: 'follow_ups',

  // Onboarding issues → blocked queue (Onboarding focus)
  onboarding_blocked: 'blocked',
  milestone_due: 'due_this_week',

  // Deal progression signals → appropriate sales queues
  deal_stalled: 'stalled_deals',
  competitive_threat: 'stalled_deals',
  budget_at_risk: 'stalled_deals',
  timeline_slip: 'stalled_deals',
  objection_raised: 'follow_ups',

  // Opportunity signals → expansion_ready (CS focus)
  expansion_ready: 'expansion_ready',
  health_improving: 'expansion_ready',
  engagement_spike: 'expansion_ready',
  positive_sentiment: 'expansion_ready',
  buying_signal: 'new_leads',

  // Stakeholder signals → follow_ups for sales engagement
  new_stakeholder: 'follow_ups',

  // Lifecycle signals → appropriate queues
  deadline_approaching: 'due_this_week',
  renewal_approaching: 'at_risk',
  trial_ending: 'follow_ups',
};

/**
 * Maps Signal severity to Work item priority.
 */
function severityToPriority(severity: SignalSeverity): WorkItemPriority {
  return severity; // They're the same values
}

// ============================================================================
// PIPELINE SERVICE
// ============================================================================

export interface SignalToWorkResult {
  success: boolean;
  workItemId: string;
  action: 'created' | 'attached';
  workItemEvent: WorkItemCreatedEvent | WorkItemSignalAttachedEvent;
  signalEvent: SignalWorkItemCreatedEvent | SignalWorkItemAttachedEvent;
}

export interface SignalToWorkPipelineOptions {
  /** Override default focus lens */
  focusLens?: LensType;
  /** Override default queue */
  queueId?: QueueId;
  /** Assign to specific user */
  assignToUserId?: string;
  /** Force creation of new work item even if one exists */
  forceNewWorkItem?: boolean;
}

/**
 * SignalToWorkPipeline
 *
 * Converts SignalDetectedEvents into Work item creation/attachment events.
 * All logic is deterministic and testable - no AI in this layer.
 */
export class SignalToWorkPipeline {
  private signalProjector: SignalProjector;
  private workProjector: WorkItemProjector;

  constructor(private supabase: SupabaseClient) {
    this.signalProjector = new SignalProjector(supabase);
    this.workProjector = new WorkItemProjector(supabase);
  }

  /**
   * Process a SignalDetectedEvent and create/attach to Work item.
   */
  async processSignal(
    signalEvent: SignalDetectedEvent,
    options: SignalToWorkPipelineOptions = {}
  ): Promise<SignalToWorkResult> {
    const { event_data: signal } = signalEvent;
    const now = new Date().toISOString();

    // First, project the signal event
    await this.signalProjector.projectEvent(signalEvent);

    // Check for existing open work item for this entity (unless forced)
    let existingWorkItem: WorkItemDetailProjection | null = null;
    if (!options.forceNewWorkItem) {
      existingWorkItem = await this.findExistingWorkItem(
        signal.entity_ref,
        signal.signal_type
      );
    }

    if (existingWorkItem) {
      // Attach signal to existing work item
      return this.attachToExistingWorkItem(existingWorkItem, signal, now);
    } else {
      // Create new work item
      return this.createNewWorkItem(signal, options, now);
    }
  }

  /**
   * Process multiple signals in batch (for efficiency).
   */
  async processSignalBatch(
    signals: SignalDetectedEvent[],
    options: SignalToWorkPipelineOptions = {}
  ): Promise<SignalToWorkResult[]> {
    const results: SignalToWorkResult[] = [];

    for (const signal of signals) {
      try {
        const result = await this.processSignal(signal, options);
        results.push(result);
      } catch (error) {
        console.error('Failed to process signal:', signal.event_data.signal_id, error);
        // Continue with other signals
      }
    }

    return results;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async findExistingWorkItem(
    entityRef: SignalEntityRef,
    signalType: SignalType
  ): Promise<WorkItemDetailProjection | null> {
    // Look for open work items for the same company
    const { data } = await this.supabase
      .from('work_item_projections')
      .select('*')
      .eq('company_id', entityRef.id)
      .eq('status', 'open')
      .order('priority_score', { ascending: false })
      .limit(1);

    // For now, return the first open work item for this company
    // In future, could be smarter about matching signal types
    return (data && data.length > 0) ? data[0] as WorkItemDetailProjection : null;
  }

  private async attachToExistingWorkItem(
    existingWorkItem: WorkItemDetailProjection,
    signal: SignalDetectedEvent['event_data'],
    now: string
  ): Promise<SignalToWorkResult> {
    const workSignalType = SIGNAL_TO_WORK_SIGNAL_TYPE[signal.signal_type];
    const workSourceType = SIGNAL_TO_WORK_SOURCE_TYPE[signal.signal_type];

    // Calculate priority delta based on signal severity
    const priorityDelta = this.calculatePriorityDelta(
      signal.severity,
      existingWorkItem.priority
    );

    // Generate updated why_here if signal adds context
    const updatedWhyHere = this.generateUpdatedWhyHere(
      existingWorkItem.why_here,
      signal.explanation
    );

    // Create WorkItemSignalAttached event
    const workItemEvent: WorkItemSignalAttachedEvent = {
      event_type: 'WorkItemSignalAttached',
      event_data: {
        work_item_id: existingWorkItem.work_item_id,
        signal_type: workSignalType,
        signal_id: signal.signal_id,
        signal_source: workSourceType,
        signal_summary: signal.explanation,
        priority_delta: priorityDelta,
        updated_why_here: updatedWhyHere,
      },
    };

    // Create SignalWorkItemAttached event
    const signalEvent: SignalWorkItemAttachedEvent = {
      event_type: 'SignalWorkItemAttached',
      event_data: {
        signal_id: signal.signal_id,
        work_item_id: existingWorkItem.work_item_id,
        priority_delta: priorityDelta,
        updated_why_here: updatedWhyHere,
      },
    };

    // Store events
    await this.storeEvent('work_item', existingWorkItem.work_item_id, workItemEvent);
    await this.storeEvent('signal', signal.signal_id, signalEvent);

    // Project events
    await this.workProjector.projectEvent(workItemEvent);
    await this.signalProjector.projectEvent(signalEvent);

    return {
      success: true,
      workItemId: existingWorkItem.work_item_id,
      action: 'attached',
      workItemEvent,
      signalEvent,
    };
  }

  private async createNewWorkItem(
    signal: SignalDetectedEvent['event_data'],
    options: SignalToWorkPipelineOptions,
    now: string
  ): Promise<SignalToWorkResult> {
    const workItemId = generateId();
    const workSignalType = SIGNAL_TO_WORK_SIGNAL_TYPE[signal.signal_type];
    const workSourceType = SIGNAL_TO_WORK_SOURCE_TYPE[signal.signal_type];
    const focusLens = options.focusLens || SIGNAL_TO_FOCUS_LENS[signal.signal_type];
    const queueId = options.queueId || SIGNAL_TO_QUEUE_ID[signal.signal_type];
    const priority = severityToPriority(signal.severity);

    // Build work item title
    const title = this.generateWorkItemTitle(signal.signal_type, signal.entity_ref.name);

    // Build work item subtitle
    const subtitle = this.generateWorkItemSubtitle(signal);

    // Create WorkItemCreated event
    const workItemEvent: WorkItemCreatedEvent = {
      event_type: 'WorkItemCreated',
      event_data: {
        work_item_id: workItemId,
        focus_lens: focusLens,
        queue_id: queueId,
        company_id: signal.entity_ref.id,
        company_name: signal.entity_ref.name,
        deal_id: signal.entity_ref.type === 'deal' ? signal.entity_ref.id : undefined,
        communication_id: signal.evidence.communication_ids?.[0],
        source_type: workSourceType,
        signal_type: workSignalType,
        signal_id: signal.signal_id,
        title,
        subtitle,
        why_here: signal.explanation,
        priority,
        priority_score: signal.priority_score,
        assigned_to_user_id: options.assignToUserId,
      },
    };

    // Create SignalWorkItemCreated event
    const signalEvent: SignalWorkItemCreatedEvent = {
      event_type: 'SignalWorkItemCreated',
      event_data: {
        signal_id: signal.signal_id,
        work_item_id: workItemId,
        why_here: signal.explanation,
      },
    };

    // Store events
    await this.storeEvent('work_item', workItemId, workItemEvent);
    await this.storeEvent('signal', signal.signal_id, signalEvent);

    // Project events
    await this.workProjector.projectEvent(workItemEvent);
    await this.signalProjector.projectEvent(signalEvent);

    return {
      success: true,
      workItemId,
      action: 'created',
      workItemEvent,
      signalEvent,
    };
  }

  private calculatePriorityDelta(
    signalSeverity: SignalSeverity,
    currentPriority: WorkItemPriority
  ): number {
    const severityScores: Record<SignalSeverity, number> = {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10,
    };

    const priorityScores: Record<WorkItemPriority, number> = {
      critical: 90,
      high: 70,
      medium: 40,
      low: 20,
    };

    // Add percentage of severity score to current score
    const signalScore = severityScores[signalSeverity];
    const currentScore = priorityScores[currentPriority];

    // New signal adds 10-30% boost based on severity
    const boostPercentage = signalScore / 100;
    return Math.round((100 - currentScore) * boostPercentage);
  }

  private generateUpdatedWhyHere(
    existingWhyHere: string,
    newExplanation: string
  ): string {
    // Don't duplicate if already contains the explanation
    if (existingWhyHere.includes(newExplanation)) {
      return existingWhyHere;
    }

    // Append new context
    return `${existingWhyHere} Additionally: ${newExplanation}`;
  }

  private generateWorkItemTitle(
    signalType: SignalType,
    entityName: string
  ): string {
    const titles: Record<SignalType, (name: string) => string> = {
      churn_risk: (name) => `Churn Risk: ${name}`,
      expansion_ready: (name) => `Expansion Opportunity: ${name}`,
      health_declining: (name) => `Health Declining: ${name}`,
      health_improving: (name) => `Health Improving: ${name}`,
      engagement_spike: (name) => `High Engagement: ${name}`,
      engagement_drop: (name) => `Engagement Drop: ${name}`,
      champion_dark: (name) => `Champion Gone Quiet: ${name}`,
      new_stakeholder: (name) => `New Stakeholder: ${name}`,
      deal_stalled: (name) => `Deal Stalled: ${name}`,
      competitive_threat: (name) => `Competitive Threat: ${name}`,
      budget_at_risk: (name) => `Budget at Risk: ${name}`,
      timeline_slip: (name) => `Timeline Slipping: ${name}`,
      buying_signal: (name) => `Buying Signal: ${name}`,
      promise_at_risk: (name) => `Promise at Risk: ${name}`,
      sla_breach: (name) => `SLA Breach: ${name}`,
      deadline_approaching: (name) => `Deadline Approaching: ${name}`,
      commitment_overdue: (name) => `Commitment Overdue: ${name}`,
      message_needs_reply: (name) => `Reply Needed: ${name}`,
      escalation_detected: (name) => `Escalation: ${name}`,
      objection_raised: (name) => `Objection Raised: ${name}`,
      positive_sentiment: (name) => `Positive Sentiment: ${name}`,
      onboarding_blocked: (name) => `Onboarding Blocked: ${name}`,
      milestone_due: (name) => `Milestone Due: ${name}`,
      renewal_approaching: (name) => `Renewal Approaching: ${name}`,
      trial_ending: (name) => `Trial Ending: ${name}`,
    };

    return titles[signalType](entityName);
  }

  private generateWorkItemSubtitle(
    signal: SignalDetectedEvent['event_data']
  ): string {
    const { evidence, playbook } = signal;

    const parts: string[] = [];

    // Add severity
    parts.push(`${signal.severity.toUpperCase()} priority`);

    // Add evidence context
    if (evidence.health_score) {
      parts.push(`Health: ${evidence.health_score.current}`);
    }

    if (evidence.communication_ids?.length) {
      parts.push(`${evidence.communication_ids.length} message(s)`);
    }

    // Add playbook recommendation if available
    if (playbook?.suggested_actions?.length) {
      parts.push(`Suggested: ${playbook.suggested_actions[0]}`);
    }

    return parts.join(' • ');
  }

  private async storeEvent(
    aggregateType: string,
    aggregateId: string,
    event: any
  ): Promise<void> {
    // Get next sequence number
    const { data: existing } = await this.supabase
      .from('event_store')
      .select('sequence_number')
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .order('sequence_number', { ascending: false })
      .limit(1);

    const nextSequence = existing && existing.length > 0
      ? existing[0].sequence_number + 1
      : 1;

    // Store the event
    await this.supabase.from('event_store').insert({
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      sequence_number: nextSequence,
      event_type: event.event_type,
      event_data: event.event_data,
      actor_type: 'system',
      occurred_at: new Date().toISOString(),
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determines if a signal type should create a new work item or attach to existing.
 * Some signals (like message_needs_reply) typically create new items.
 * Others (like health_declining) typically attach to existing company items.
 */
export function shouldCreateNewWorkItem(signalType: SignalType): boolean {
  const createNewSignals: SignalType[] = [
    'message_needs_reply',
    'escalation_detected',
    'sla_breach',
    'milestone_due',
  ];

  return createNewSignals.includes(signalType);
}

/**
 * Get the default mapping for a signal type.
 */
export function getSignalToWorkMapping(signalType: SignalType): {
  workSignalType: WorkItemSignalType;
  workSourceType: WorkItemSourceType;
  focusLens: LensType;
  queueId: QueueId;
} {
  return {
    workSignalType: SIGNAL_TO_WORK_SIGNAL_TYPE[signalType],
    workSourceType: SIGNAL_TO_WORK_SOURCE_TYPE[signalType],
    focusLens: SIGNAL_TO_FOCUS_LENS[signalType],
    queueId: SIGNAL_TO_QUEUE_ID[signalType],
  };
}
