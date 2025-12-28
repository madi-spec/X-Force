/**
 * Tier Detection System for Command Center
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  🚫 CRITICAL ARCHITECTURAL RULE: NEVER USE KEYWORD MATCHING                  ║
 * ║                                                                              ║
 * ║  ❌ FORBIDDEN: const keywords = ['trial', 'demo']; text.includes(keyword)   ║
 * ║  ❌ FORBIDDEN: if (text.match(/demo|pricing/i)) { tier = 1 }                 ║
 * ║  ❌ FORBIDDEN: TIER1_TRIGGERS = [{ keywords: ['demo', 'trial'] }]            ║
 * ║                                                                              ║
 * ║  ✅ CORRECT: AI analyzes → returns communicationType → playbook lookup       ║
 * ║  ✅ CORRECT: tier = COMMUNICATION_TYPE_TIERS[item.tier_trigger].tier         ║
 * ║                                                                              ║
 * ║  The tier_trigger field stores the AI-determined communicationType.          ║
 * ║  This module ONLY does playbook lookups, NEVER keyword detection.            ║
 * ║                                                                              ║
 * ║  See: /docs/X-FORCE-ARCHITECTURAL-RULES.md                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * The Five Tiers (in strict hierarchy):
 * 1. RESPOND NOW - Someone is waiting (minutes matter)
 * 2. DON'T LOSE THIS - Deadline/competition (hours matter)
 * 3. KEEP YOUR WORD - You promised something (same day)
 * 4. MOVE BIG DEALS - High value, needs attention (this week)
 * 5. BUILD PIPELINE - Important but not urgent
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CommandCenterItem,
  PriorityTier,
  TierTrigger,
  TierSlaStatus,
} from '@/types/commandCenter';

// ============================================
// COMMUNICATION TYPE → TIER MAPPING
// From Sales Playbook
// ============================================

interface TierConfig {
  tier: PriorityTier;
  sla_minutes: number;
  why_now_template: string;
}

/**
 * Maps communication types to their tier and SLA
 * This is the single source of truth for tier classification
 * Based on Sales Playbook definitions
 */
export const COMMUNICATION_TYPE_TIERS: Record<string, TierConfig> = {
  // Tier 1: RESPOND NOW - Someone is waiting
  demo_request: {
    tier: 1,
    sla_minutes: 15,
    why_now_template: 'Demo request received {duration} ago.',
  },
  free_trial_form: {
    tier: 1,
    sla_minutes: 15,
    why_now_template: 'Signed trial form received {duration} ago — ready to start.',
  },
  pricing_request: {
    tier: 1,
    sla_minutes: 120,
    why_now_template: 'Pricing inquiry received {duration} ago.',
  },
  meeting_request: {
    tier: 1,
    sla_minutes: 60,
    why_now_template: 'Meeting request waiting {duration}.',
  },
  direct_question: {
    tier: 1,
    sla_minutes: 240,
    why_now_template: 'Question awaiting response for {duration}.',
  },
  email_reply: {
    tier: 1,
    sla_minutes: 240,
    why_now_template: 'They replied {duration} ago. Keep momentum.',
  },
  email_needs_response: {
    tier: 1,
    sla_minutes: 240,
    why_now_template: 'Email needs response — waiting {duration}.',
  },
  email_unanswered: {
    tier: 1,
    sla_minutes: 240,
    why_now_template: 'Unanswered email for {duration}.',
  },
  inbound_request: {
    tier: 1,
    sla_minutes: 60,
    why_now_template: 'Inbound request waiting {duration}.',
  },
  form_submission: {
    tier: 1,
    sla_minutes: 15,
    why_now_template: 'Form submitted {duration} ago.',
  },
  calendly_booking: {
    tier: 1,
    sla_minutes: 15,
    why_now_template: 'New booking {duration} ago.',
  },
  ready_to_proceed: {
    tier: 1,
    sla_minutes: 30,
    why_now_template: 'They said "ready to proceed" {duration} ago. Act now.',
  },
  unknown_sender: {
    tier: 1,
    sla_minutes: 60,
    why_now_template: 'New inbound from unknown sender {duration} ago — triage needed.',
  },
  // === TIER 1 ALIASES (AI may return these) ===
  trial_request: {
    tier: 1,
    sla_minutes: 15,
    why_now_template: 'Trial request received {duration} ago — ready to start.',
  },
  pricing_inquiry: {
    tier: 1,
    sla_minutes: 120,
    why_now_template: 'Pricing inquiry received {duration} ago.',
  },
  demo_inquiry: {
    tier: 1,
    sla_minutes: 15,
    why_now_template: 'Demo inquiry received {duration} ago.',
  },
  inbound_lead: {
    tier: 1,
    sla_minutes: 60,
    why_now_template: 'New inbound lead {duration} ago.',
  },

  // Tier 2: DON'T LOSE THIS - Deadline/competition pressure
  deadline_critical: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Close date within 7 days.',
  },
  deadline_approaching: {
    tier: 2,
    sla_minutes: 1440,
    why_now_template: 'Close date within 14 days.',
  },
  competitive_risk: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Competitor mentioned — you\'re in a race.',
  },
  buying_signal: {
    tier: 2,
    sla_minutes: 240,
    why_now_template: 'Strong buying signal detected.',
  },
  budget_discussed: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Budget discussion happened — momentum is high.',
  },
  proposal_hot: {
    tier: 2,
    sla_minutes: 240,
    why_now_template: 'Proposal viewed multiple times recently.',
  },
  champion_dark: {
    tier: 2,
    sla_minutes: 1440,
    why_now_template: 'Champion hasn\'t replied — your inside access is at risk.',
  },
  going_stale: {
    tier: 2,
    sla_minutes: 1440,
    why_now_template: 'Deal going quiet — re-engage now.',
  },
  urgency_signal: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Urgency signals detected by AI.',
  },
  objection_raised: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Objection raised — address quickly.',
  },
  technical_question: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Technical question needs answer.',
  },
  // === TIER 2 ALIASES (AI may return these) ===
  objection: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Objection raised — address quickly.',
  },
  competitor: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Competitor mentioned — you\'re in a race.',
  },
  risk_signal: {
    tier: 2,
    sla_minutes: 480,
    why_now_template: 'Deal risk detected.',
  },

  // Tier 3: KEEP YOUR WORD - You promised something
  transcript_commitment: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'You committed to this in the call.',
  },
  meeting_follow_up: {
    tier: 3,
    sla_minutes: 480,
    why_now_template: 'Meeting ended — follow-up expected.',
  },
  post_meeting_followup: {
    tier: 3,
    sla_minutes: 480,
    why_now_template: 'Post-meeting follow-up due.',
  },
  action_item_due: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'Action item due.',
  },
  promise_made: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'You promised this.',
  },
  promise_due: {
    tier: 3,
    sla_minutes: 480,
    why_now_template: 'Promise is due.',
  },
  our_commitment_overdue: {
    tier: 3,
    sla_minutes: 0,
    why_now_template: 'Your commitment is overdue.',
  },
  action_item: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'Action item needs attention.',
  },
  // === TIER 3 ALIASES (AI may return these) ===
  meeting_commitment: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'Commitment from meeting needs follow-through.',
  },
  follow_up: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'Follow-up promised.',
  },
  deliverable_promised: {
    tier: 3,
    sla_minutes: 1440,
    why_now_template: 'Deliverable was promised.',
  },

  // Tier 4: MOVE BIG DEALS - High value opportunities
  high_value: {
    tier: 4,
    sla_minutes: 2880,
    why_now_template: 'High-value opportunity worth attention.',
  },
  strategic_account: {
    tier: 4,
    sla_minutes: 2880,
    why_now_template: 'Strategic account needs attention.',
  },
  csuite_contact: {
    tier: 4,
    sla_minutes: 2880,
    why_now_template: 'C-suite contact involved.',
  },
  deal_stale: {
    tier: 4,
    sla_minutes: 2880,
    why_now_template: 'Deal has gone quiet.',
  },
  big_deal_attention: {
    tier: 4,
    sla_minutes: 2880,
    why_now_template: 'Big deal needs proactive attention.',
  },
  concern_unresolved: {
    tier: 4,
    sla_minutes: 1440,
    why_now_template: 'Concern still unresolved.',
  },
  their_commitment_overdue: {
    tier: 4,
    sla_minutes: 1440,
    why_now_template: 'Their commitment is overdue — follow up.',
  },
  orphaned_opportunity: {
    tier: 4,
    sla_minutes: 2880,
    why_now_template: 'Engaged contact not linked to deal.',
  },

  // Tier 5: BUILD PIPELINE - Important but not urgent
  internal_request: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'Internal request.',
  },
  cold_lead_reengage: {
    tier: 5,
    sla_minutes: 10080,
    why_now_template: 'Cold lead worth re-engaging.',
  },
  new_contact_no_outreach: {
    tier: 5,
    sla_minutes: 10080,
    why_now_template: 'New contact — no outreach yet.',
  },
  research_needed: {
    tier: 5,
    sla_minutes: 10080,
    why_now_template: 'Research needed.',
  },
  follow_up_general: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'General follow-up.',
  },
  // === TIER 5 ALIASES (AI may return these) ===
  general: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'General communication — no urgency.',
  },
  informational: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'Informational — no action required.',
  },
  nurture: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'Nurture touch — build relationship.',
  },
  needs_ai_classification: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'Needs review.',
  },
  new_introduction: {
    tier: 5,
    sla_minutes: 1440,
    why_now_template: 'New introduction — respond professionally.',
  },
  introduction: {
    tier: 5,
    sla_minutes: 1440,
    why_now_template: 'Introduction email — respond professionally.',
  },
  other: {
    tier: 5,
    sla_minutes: 4320,
    why_now_template: 'Review and respond as needed.',
  },
};

// ============================================
// TIER RESULT
// ============================================

export interface TierResult {
  tier: PriorityTier;
  trigger: TierTrigger;
  sla_minutes?: number;
  sla_status?: TierSlaStatus;
  urgency_score?: number;
  value_score?: number;
  promise_date?: string | null;
  commitment_text?: string;
  received_at?: string;
  why_now: string | null;
}

// ============================================
// MAIN CLASSIFICATION FUNCTION
// ============================================

/**
 * Classify a command center item into a tier.
 *
 * Uses the item's tier_trigger (set by AI analysis) to look up the tier.
 * Falls back to context-based detection for items without tier_trigger.
 */
export async function classifyItem(
  item: CommandCenterItem,
  context?: {
    deal?: DealContext & { value_percentile?: number };
    champion?: ContactContext;
    engagement?: EngagementContext;
    commitment?: CommitmentContext;
    meetingEndedHoursAgo?: number;
    followUpSent?: boolean;
    isStrategicAccount?: boolean;
    hasCsuiteContact?: boolean;
  }
): Promise<TierResult> {
  const ctx = context || {};

  // If item already has a tier_trigger, use the mapping
  if (item.tier_trigger) {
    const config = COMMUNICATION_TYPE_TIERS[item.tier_trigger];
    if (config) {
      const receivedAt = item.received_at || item.created_at;
      const minutesWaiting = Math.floor(
        (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60)
      );

      return {
        tier: config.tier,
        trigger: item.tier_trigger,
        sla_minutes: config.sla_minutes,
        sla_status: getSlaStatus(minutesWaiting, config.sla_minutes),
        received_at: receivedAt,
        why_now: config.why_now_template.replace('{duration}', formatDuration(minutesWaiting)),
      };
    }
  }

  // Fallback: Use context-based detection for items without tier_trigger

  // Check for source-based tier 1 items (form_submission, calendly)
  if (item.source === 'form_submission' || item.source === 'calendly') {
    const config = COMMUNICATION_TYPE_TIERS[item.source];
    if (config) {
      const receivedAt = item.created_at;
      const minutesWaiting = Math.floor(
        (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60)
      );

      return {
        tier: config.tier,
        trigger: item.source as TierTrigger,
        sla_minutes: config.sla_minutes,
        sla_status: getSlaStatus(minutesWaiting, config.sla_minutes),
        received_at: receivedAt,
        why_now: config.why_now_template.replace('{duration}', formatDuration(minutesWaiting)),
      };
    }
  }

  // Try Tier 2 based on deal context
  const tier2 = await detectTier2FromContext(item, ctx.deal, ctx.champion, ctx.engagement);
  if (tier2) return tier2;

  // Try Tier 3 based on commitments
  const tier3 = await detectTier3FromContext(
    item,
    ctx.commitment,
    ctx.meetingEndedHoursAgo,
    ctx.followUpSent
  );
  if (tier3) return tier3;

  // Try Tier 4 based on deal value
  const tier4 = await detectTier4FromContext(
    item,
    ctx.deal,
    ctx.isStrategicAccount,
    ctx.hasCsuiteContact
  );
  if (tier4) return tier4;

  // Default: Tier 5 with generic trigger
  return {
    tier: 5,
    trigger: 'research_needed',
    why_now: null,
  };
}

// ============================================
// CONTEXT-BASED DETECTION (No Keywords)
// ============================================

interface DealContext {
  id: string;
  expected_close_date?: string;
  competitors?: string[];
  days_since_activity?: number;
  value?: number;
  stage?: string;
}

interface ContactContext {
  id: string;
  name: string;
  role?: string;
  emails_without_reply?: number;
  days_since_reply?: number;
}

interface EngagementContext {
  proposal_views_48h?: number;
}

interface CommitmentContext {
  commitment: string;
  when?: string;
  meeting_date?: string;
  meeting_title?: string;
}

/**
 * Detect Tier 2 from deal/engagement context
 */
async function detectTier2FromContext(
  item: CommandCenterItem,
  deal?: DealContext,
  champion?: ContactContext,
  engagement?: EngagementContext
): Promise<TierResult | null> {
  if (!deal) return null;

  let urgency_score = 0;
  let trigger: TierTrigger | null = null;
  let why_now: string | null = null;

  // Deadline within 7 days
  if (deal.expected_close_date) {
    const days = daysUntil(deal.expected_close_date);
    if (days <= 7 && days >= 0) {
      trigger = 'deadline_critical';
      urgency_score += 30;
      why_now = `Close date is ${formatDate(deal.expected_close_date)} — ${days} days left.`;
    } else if (days <= 14 && days > 7) {
      trigger = 'deadline_approaching';
      urgency_score += 20;
      why_now = `Close date is ${formatDate(deal.expected_close_date)} — ${days} days out.`;
    }
  }

  // Competitor mentioned
  if (!trigger && deal.competitors && deal.competitors.length > 0) {
    trigger = 'competitive_risk';
    urgency_score += 25;
    why_now = `They're evaluating ${deal.competitors[0]}. You're in a race.`;
  }

  // Proposal viewed 3+ times in 48h
  if (!trigger && engagement?.proposal_views_48h && engagement.proposal_views_48h >= 3) {
    trigger = 'proposal_hot';
    urgency_score += 20;
    why_now = `They viewed your proposal ${engagement.proposal_views_48h}x in 48 hours.`;
  }

  // Champion dark
  if (
    !trigger &&
    champion &&
    (champion.emails_without_reply || 0) >= 2 &&
    (champion.days_since_reply || 0) >= 7
  ) {
    trigger = 'champion_dark';
    urgency_score += 25;
    why_now = `${champion.name} hasn't replied to ${champion.emails_without_reply} emails. Your inside access is at risk.`;
  }

  if (!trigger) return null;

  const config = COMMUNICATION_TYPE_TIERS[trigger];
  return {
    tier: 2,
    trigger,
    urgency_score,
    sla_minutes: config?.sla_minutes,
    why_now,
  };
}

/**
 * Detect Tier 3 from commitment context
 */
async function detectTier3FromContext(
  item: CommandCenterItem,
  commitment?: CommitmentContext,
  meetingEndedHoursAgo?: number,
  followUpSent?: boolean
): Promise<TierResult | null> {
  // From transcript commitment extraction
  if (item.source === 'transcription' && commitment) {
    const promiseDate = parsePromiseDate(commitment.when, commitment.meeting_date);
    const overdueText = promiseDate ? getOverdueText(promiseDate) : null;

    return {
      tier: 3,
      trigger: 'transcript_commitment',
      promise_date: promiseDate,
      commitment_text: commitment.commitment,
      sla_minutes: COMMUNICATION_TYPE_TIERS['transcript_commitment']?.sla_minutes,
      why_now: `You said "${commitment.commitment}" — ${overdueText || 'pending'}.`,
    };
  }

  // Meeting follow-up
  if (
    item.source === 'calendar_sync' &&
    item.action_type === 'meeting_follow_up' &&
    meetingEndedHoursAgo !== undefined &&
    meetingEndedHoursAgo >= 4 &&
    !followUpSent
  ) {
    return {
      tier: 3,
      trigger: 'meeting_follow_up',
      promise_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      sla_minutes: COMMUNICATION_TYPE_TIERS['meeting_follow_up']?.sla_minutes,
      why_now: `Call ended ${meetingEndedHoursAgo} hours ago. They expect follow-up.`,
    };
  }

  return null;
}

/**
 * Detect Tier 4 from deal value context
 */
async function detectTier4FromContext(
  item: CommandCenterItem,
  deal?: DealContext & { value_percentile?: number },
  isStrategicAccount?: boolean,
  hasCsuiteContact?: boolean
): Promise<TierResult | null> {
  if (!deal || deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
    return null;
  }

  let value_score = 0;
  let trigger: TierTrigger | null = null;

  // Top 20% deal by value
  if (deal.value_percentile && deal.value_percentile >= 80) {
    value_score += 30;
    trigger = 'high_value';
  } else if (deal.value_percentile && deal.value_percentile >= 60) {
    value_score += 15;
  }

  // Strategic account
  if (!trigger && isStrategicAccount) {
    value_score += 20;
    trigger = 'strategic_account';
  }

  // C-suite contact
  if (!trigger && hasCsuiteContact) {
    value_score += 15;
    trigger = 'csuite_contact';
  }

  // Going stale
  if (!trigger && deal.days_since_activity && deal.days_since_activity >= 10) {
    value_score += 10;
    trigger = 'deal_stale';
  }

  if (value_score < 15 || !trigger) return null;

  let why_now: string | null = null;
  if (deal.days_since_activity && deal.days_since_activity >= 10) {
    why_now = `${formatCurrency(deal.value || 0)} deal silent for ${deal.days_since_activity} days.`;
  } else if (deal.value) {
    why_now = `${formatCurrency(deal.value)} opportunity worth attention.`;
  }

  const config = COMMUNICATION_TYPE_TIERS[trigger];
  return {
    tier: 4,
    trigger,
    value_score,
    sla_minutes: config?.sla_minutes,
    why_now,
  };
}

// ============================================
// CLASSIFY ALL ITEMS
// ============================================

/**
 * Classify all pending items for a user
 * @returns Number of items classified
 */
export async function classifyAllItems(userId: string): Promise<number> {
  const supabase = createAdminClient();

  // Get all pending items that need classification (no tier set yet)
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select(`
      *,
      deal:deals(id, name, stage, estimated_value, expected_close_date, competitors, days_since_activity, value_percentile),
      company:companies(id, name, is_strategic),
      contact:contacts(id, name, role, emails_without_reply, days_since_reply, title)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (error || !items) {
    console.error('[TierDetection] Error fetching items:', error);
    return 0;
  }

  let classified = 0;

  for (const item of items) {
    // Build context from joined data
    const deal = item.deal
      ? {
          id: item.deal.id,
          expected_close_date: item.deal.expected_close_date,
          competitors: item.deal.competitors,
          days_since_activity: item.deal.days_since_activity,
          value: item.deal.estimated_value,
          value_percentile: item.deal.value_percentile,
          stage: item.deal.stage,
        }
      : undefined;

    const champion = item.contact?.role === 'champion'
      ? {
          id: item.contact.id,
          name: item.contact.name,
          role: item.contact.role,
          emails_without_reply: item.contact.emails_without_reply,
          days_since_reply: item.contact.days_since_reply,
        }
      : undefined;

    const isStrategicAccount = item.company?.is_strategic;
    const hasCsuiteContact = isCsuite(item.contact?.title);

    // Classify
    const result = await classifyItem(item as CommandCenterItem, {
      deal,
      champion,
      isStrategicAccount,
      hasCsuiteContact,
    });

    // Update item
    const { error: updateError } = await supabase
      .from('command_center_items')
      .update({
        tier: result.tier,
        tier_trigger: result.trigger,
        sla_minutes: result.sla_minutes,
        sla_status: result.sla_status,
        urgency_score: result.urgency_score || 0,
        value_score: result.value_score || 0,
        promise_date: result.promise_date,
        commitment_text: result.commitment_text,
        received_at: result.received_at,
        why_now: result.why_now,
      })
      .eq('id', item.id);

    if (!updateError) {
      classified++;
    }
  }

  return classified;
}

// ============================================
// SORTING FUNCTIONS
// ============================================

/**
 * Sort Tier 1 items: SLA breach severity, then recency
 */
export function sortTier1(a: CommandCenterItem, b: CommandCenterItem): number {
  const statusOrder = { breached: 0, warning: 1, on_track: 2 };
  const aStatus = statusOrder[a.sla_status || 'on_track'];
  const bStatus = statusOrder[b.sla_status || 'on_track'];

  if (aStatus !== bStatus) return aStatus - bStatus;

  const aReceived = new Date(a.received_at || a.created_at).getTime();
  const bReceived = new Date(b.received_at || b.created_at).getTime();
  return bReceived - aReceived;
}

/**
 * Sort Tier 2 items: Urgency score, then deal value
 */
export function sortTier2(a: CommandCenterItem, b: CommandCenterItem): number {
  const urgencyDiff = (b.urgency_score || 0) - (a.urgency_score || 0);
  if (urgencyDiff !== 0) return urgencyDiff;

  return (b.deal_value || 0) - (a.deal_value || 0);
}

/**
 * Sort Tier 3 items: Most overdue first, then deal value
 */
export function sortTier3(a: CommandCenterItem, b: CommandCenterItem): number {
  const now = Date.now();
  const aOverdue = a.promise_date
    ? now - new Date(a.promise_date).getTime()
    : 0;
  const bOverdue = b.promise_date
    ? now - new Date(b.promise_date).getTime()
    : 0;

  const overdueDiff = bOverdue - aOverdue;
  if (overdueDiff !== 0) return overdueDiff;

  return (b.deal_value || 0) - (a.deal_value || 0);
}

/**
 * Sort Tier 4 items: Value score, then deal value
 */
export function sortTier4(a: CommandCenterItem, b: CommandCenterItem): number {
  const valueDiff = (b.value_score || 0) - (a.value_score || 0);
  if (valueDiff !== 0) return valueDiff;

  return (b.deal_value || 0) - (a.deal_value || 0);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSlaStatus(minutesWaiting: number, slaMins: number): TierSlaStatus {
  if (minutesWaiting >= slaMins) return 'breached';
  if (minutesWaiting >= slaMins * 0.75) return 'warning';
  return 'on_track';
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${value}`;
}

function daysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function parsePromiseDate(when?: string, meetingDate?: string): string | null {
  if (!when) return null;

  const lower = when.toLowerCase();
  const baseDate = meetingDate ? new Date(meetingDate) : new Date();

  if (lower.includes('today')) {
    return baseDate.toISOString();
  }
  if (lower.includes('tomorrow')) {
    baseDate.setDate(baseDate.getDate() + 1);
    return baseDate.toISOString();
  }
  if (lower.includes('end of week') || lower.includes('eow') || lower.includes('by friday')) {
    const daysUntilFriday = (5 - baseDate.getDay() + 7) % 7 || 7;
    baseDate.setDate(baseDate.getDate() + daysUntilFriday);
    return baseDate.toISOString();
  }
  if (lower.includes('next week')) {
    baseDate.setDate(baseDate.getDate() + 7);
    return baseDate.toISOString();
  }
  if (lower.includes('in 2 weeks') || lower.includes('two weeks')) {
    baseDate.setDate(baseDate.getDate() + 14);
    return baseDate.toISOString();
  }
  if (lower.includes('end of month') || lower.includes('eom')) {
    baseDate.setMonth(baseDate.getMonth() + 1, 0);
    return baseDate.toISOString();
  }

  return null;
}

function getOverdueText(promiseDate: string): string {
  const date = new Date(promiseDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `due in ${Math.abs(diffDays)} days`;
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return '1 day overdue';
  return `${diffDays} days overdue`;
}

function isCsuite(title?: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return (
    lower.includes('ceo') ||
    lower.includes('cfo') ||
    lower.includes('cto') ||
    lower.includes('coo') ||
    lower.includes('cmo') ||
    lower.includes('cio') ||
    lower.includes('chief') ||
    lower.includes('president') ||
    lower.includes('vp ') ||
    lower.includes('vice president') ||
    lower.includes('owner') ||
    lower.includes('founder')
  );
}

/**
 * Get tier configuration for a trigger type
 */
export function getTierForTrigger(trigger: TierTrigger): TierConfig | undefined {
  return COMMUNICATION_TYPE_TIERS[trigger];
}
