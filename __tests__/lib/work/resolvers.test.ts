/**
 * Resolver CTA Selection Tests
 *
 * Validates that the correct resolver CTAs are selected based on
 * work item source type, signal type, and context.
 */
import {
  getResolverConfig,
  getPrimaryCTA,
  getAllCTAs,
  getCTA,
  actionToResolutionType,
  actionResolvesItem,
  actionToResolvedBy,
  ResolverAction,
} from '@/lib/work/resolvers';
import { WorkItemDetailProjection } from '@/lib/work/projections';

// Helper to create a mock work item
function createMockWorkItem(
  overrides: Partial<WorkItemDetailProjection> = {}
): WorkItemDetailProjection {
  return {
    work_item_id: 'test-item-1',
    focus_lens: 'sales',
    queue_id: 'follow_ups',
    company_id: 'company-1',
    company_name: 'Test Company',
    deal_id: null,
    case_id: null,
    communication_id: null,
    contact_id: null,
    source_type: 'communication',
    signal_type: 'message_needs_reply',
    signal_id: null,
    title: 'Test Item',
    subtitle: 'Test subtitle',
    why_here: 'Test reason',
    priority: 'medium',
    priority_score: 50,
    status: 'open',
    snoozed_until: null,
    assigned_to_user_id: 'user-1',
    assigned_to_team_id: null,
    resolution_type: null,
    resolution_notes: null,
    resolved_by_action: null,
    resolved_at: null,
    attached_signals: [],
    analysis_artifact_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_event_sequence: 1,
    ...overrides,
  };
}

describe('Resolver CTA Selection', () => {
  describe('Signal-Specific Resolvers', () => {
    it('message_needs_reply signal returns reply_email as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'message_needs_reply',
        source_type: 'communication',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('reply_email');
      expect(cta.label).toBe('Reply to Email');
    });

    it('meeting_scheduled signal returns open_customer_hub as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'meeting_scheduled',
        source_type: 'scheduler',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('open_customer_hub');
    });

    it('follow_up_due signal returns schedule_meeting as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'follow_up_due',
        source_type: 'scheduler',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('schedule_meeting');
    });

    it('sla_breach signal returns escalate_case as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'sla_breach',
        source_type: 'command_center',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('escalate_case');
      expect(cta.variant).toBe('destructive');
    });

    it('churn_risk signal returns schedule_meeting as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'churn_risk',
        source_type: 'command_center',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('schedule_meeting');
    });

    it('expansion_ready signal returns send_expansion_proposal as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'expansion_ready',
        source_type: 'command_center',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('send_expansion_proposal');
    });

    it('deal_stalled signal returns make_call as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'deal_stalled',
        source_type: 'lifecycle_stage',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('make_call');
    });

    it('onboarding_blocked signal returns schedule_meeting as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'onboarding_blocked',
        source_type: 'lifecycle_stage',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('schedule_meeting');
    });

    it('milestone_due signal returns complete_onboarding_step as primary CTA', () => {
      const item = createMockWorkItem({
        signal_type: 'milestone_due',
        source_type: 'lifecycle_stage',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('complete_onboarding_step');
    });
  });

  describe('Source-Type Fallback Resolvers', () => {
    it('communication source falls back to reply_email', () => {
      const item = createMockWorkItem({
        signal_type: 'unknown_signal' as any, // Force fallback
        source_type: 'communication',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('reply_email');
    });

    it('scheduler source falls back to schedule_meeting', () => {
      const item = createMockWorkItem({
        signal_type: 'unknown_signal' as any,
        source_type: 'scheduler',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('schedule_meeting');
    });

    it('command_center source falls back to open_customer_hub', () => {
      const item = createMockWorkItem({
        signal_type: 'unknown_signal' as any,
        source_type: 'command_center',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('open_customer_hub');
    });

    it('lifecycle_stage source falls back to update_deal_stage', () => {
      const item = createMockWorkItem({
        signal_type: 'unknown_signal' as any,
        source_type: 'lifecycle_stage',
      });

      const cta = getPrimaryCTA(item);

      expect(cta.action).toBe('update_deal_stage');
    });
  });

  describe('getAllCTAs', () => {
    it('returns primary, secondary, and quick actions', () => {
      const item = createMockWorkItem({
        signal_type: 'message_needs_reply',
        source_type: 'communication',
      });

      const { primary, secondary, quickActions } = getAllCTAs(item);

      expect(primary).toBeDefined();
      expect(primary.action).toBe('reply_email');
      expect(secondary.length).toBeGreaterThan(0);
      expect(quickActions.length).toBeGreaterThan(0);
    });

    it('secondary actions are different from primary', () => {
      const item = createMockWorkItem({
        signal_type: 'message_needs_reply',
        source_type: 'communication',
      });

      const { primary, secondary } = getAllCTAs(item);

      secondary.forEach(cta => {
        expect(cta.action).not.toBe(primary.action);
      });
    });
  });

  describe('getCTA', () => {
    it('returns CTA definition for valid action', () => {
      const cta = getCTA('reply_email');

      expect(cta).toBeDefined();
      expect(cta.action).toBe('reply_email');
      expect(cta.label).toBe('Reply to Email');
      expect(cta.icon).toBe('Reply');
    });

    it('returns CTA for all defined actions', () => {
      const actions: ResolverAction[] = [
        'reply_email',
        'schedule_meeting',
        'make_call',
        'send_message',
        'update_deal_stage',
        'close_case',
        'escalate_case',
        'reassign',
        'add_note',
        'create_task',
        'open_customer_hub',
        'acknowledge',
        'complete_onboarding_step',
        'request_commitment',
        'send_renewal_proposal',
        'send_expansion_proposal',
      ];

      actions.forEach(action => {
        const cta = getCTA(action);
        expect(cta).toBeDefined();
        expect(cta.action).toBe(action);
        expect(cta.label).toBeDefined();
        expect(cta.shortLabel).toBeDefined();
        expect(cta.icon).toBeDefined();
      });
    });
  });
});

describe('Resolution Mapping', () => {
  describe('actionToResolutionType', () => {
    it('maps completing actions to completed', () => {
      const completingActions: ResolverAction[] = [
        'reply_email',
        'make_call',
        'send_message',
        'close_case',
        'complete_onboarding_step',
        'send_renewal_proposal',
        'send_expansion_proposal',
        'request_commitment',
        'acknowledge',
      ];

      completingActions.forEach(action => {
        expect(actionToResolutionType(action)).toBe('completed');
      });
    });

    it('maps non-resolving actions to null', () => {
      const nonResolvingActions: ResolverAction[] = [
        'schedule_meeting',
        'update_deal_stage',
        'escalate_case',
        'reassign',
        'add_note',
        'create_task',
        'open_customer_hub',
      ];

      nonResolvingActions.forEach(action => {
        expect(actionToResolutionType(action)).toBeNull();
      });
    });
  });

  describe('actionResolvesItem', () => {
    it('returns true for resolving actions', () => {
      expect(actionResolvesItem('reply_email')).toBe(true);
      expect(actionResolvesItem('close_case')).toBe(true);
      expect(actionResolvesItem('acknowledge')).toBe(true);
    });

    it('returns false for non-resolving actions', () => {
      expect(actionResolvesItem('schedule_meeting')).toBe(false);
      expect(actionResolvesItem('add_note')).toBe(false);
      expect(actionResolvesItem('open_customer_hub')).toBe(false);
    });
  });

  describe('actionToResolvedBy', () => {
    it('maps actions to past-tense verbs', () => {
      expect(actionToResolvedBy('reply_email')).toBe('replied');
      expect(actionToResolvedBy('make_call')).toBe('called');
      expect(actionToResolvedBy('schedule_meeting')).toBe('scheduled_meeting');
      expect(actionToResolvedBy('close_case')).toBe('closed_case');
      expect(actionToResolvedBy('escalate_case')).toBe('escalated');
      expect(actionToResolvedBy('acknowledge')).toBe('acknowledged');
    });
  });
});

describe('CTA Properties', () => {
  it('destructive CTAs are marked appropriately', () => {
    const escalateCTA = getCTA('escalate_case');
    expect(escalateCTA.variant).toBe('destructive');
    expect(escalateCTA.requiresConfirm).toBe(true);
  });

  it('modal-opening CTAs are marked', () => {
    const replyEmailCTA = getCTA('reply_email');
    const scheduleMeetingCTA = getCTA('schedule_meeting');
    const addNoteCTA = getCTA('add_note');

    expect(replyEmailCTA.opensModal).toBe(true);
    expect(scheduleMeetingCTA.opensModal).toBe(true);
    expect(addNoteCTA.opensModal).toBe(true);
  });

  it('confirmation-requiring CTAs are marked', () => {
    const closeCaseCTA = getCTA('close_case');
    const completeStepCTA = getCTA('complete_onboarding_step');

    expect(closeCaseCTA.requiresConfirm).toBe(true);
    expect(completeStepCTA.requiresConfirm).toBe(true);
  });
});
