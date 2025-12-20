/**
 * Tier Detection System for Command Center
 *
 * The Five Tiers (in strict hierarchy):
 * 1. RESPOND NOW - Someone is waiting (minutes matter)
 * 2. DON'T LOSE THIS - Deadline/competition (hours matter)
 * 3. KEEP YOUR WORD - You promised something (same day)
 * 4. MOVE BIG DEALS - High value, needs attention (this week)
 * 5. BUILD PIPELINE - Important but not urgent
 *
 * Items NEVER promote between tiers. A stale Tier 4 stays Tier 4.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CommandCenterItem,
  PriorityTier,
  TierTrigger,
  TierSlaStatus,
} from '@/types/commandCenter';

// ============================================
// TIER 1: RESPOND NOW
// ============================================

interface Tier1TriggerConfig {
  keywords?: string[];
  condition?: string;
  source?: string;
  sla_minutes: number;
}

const TIER1_TRIGGERS: Record<string, Tier1TriggerConfig> = {
  demo_request: {
    keywords: ['demo', 'trial', 'free trial', 'see a demo', 'schedule a demo', 'product demo'],
    sla_minutes: 15,
  },
  pricing_request: {
    keywords: ['pricing', 'price', 'cost', 'quote', 'how much', 'rates', 'fees'],
    sla_minutes: 120,
  },
  direct_question: {
    keywords: ['?'],
    sla_minutes: 240,
  },
  email_reply: {
    condition: 'is_reply',
    sla_minutes: 240,
  },
  form_submission: {
    source: 'form_submission',
    sla_minutes: 15,
  },
  calendly_booking: {
    source: 'calendly',
    sla_minutes: 15,
  },
};

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

/**
 * Detect if an item should be Tier 1: RESPOND NOW
 */
export async function detectTier1(
  item: CommandCenterItem,
  emailContent?: { subject?: string; body?: string; is_reply?: boolean; received_at?: string }
): Promise<TierResult | null> {
  // Check for form submission or calendly
  if (item.source === 'form_submission' || item.source === 'calendly') {
    const config = TIER1_TRIGGERS[item.source];
    const receivedAt = item.created_at;
    const minutesWaiting = Math.floor(
      (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60)
    );

    return {
      tier: 1,
      trigger: item.source as TierTrigger,
      sla_minutes: config.sla_minutes,
      sla_status: getSlaStatus(minutesWaiting, config.sla_minutes),
      received_at: receivedAt,
      why_now: `Form submitted ${formatDuration(minutesWaiting)} ago.`,
    };
  }

  // Check for inbound email
  if (emailContent) {
    const content = ((emailContent.subject || '') + ' ' + (emailContent.body || '')).toLowerCase();
    const receivedAt = emailContent.received_at || item.created_at;
    const minutesWaiting = Math.floor(
      (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60)
    );

    // Check each trigger in priority order
    for (const [triggerName, config] of Object.entries(TIER1_TRIGGERS)) {
      if (config.keywords?.some(k => content.includes(k.toLowerCase()))) {
        let whyNow: string;

        if (triggerName === 'demo_request') {
          whyNow = `They asked for a demo ${formatDuration(minutesWaiting)} ago.`;
        } else if (triggerName === 'pricing_request') {
          whyNow = `They asked about pricing ${formatDuration(minutesWaiting)} ago.`;
        } else if (triggerName === 'direct_question') {
          const question = extractQuestion(content);
          whyNow = question
            ? `They asked: "${question}" — ${formatDuration(minutesWaiting)} waiting.`
            : `They asked a question ${formatDuration(minutesWaiting)} ago.`;
        } else {
          whyNow = `Waiting for response ${formatDuration(minutesWaiting)}.`;
        }

        return {
          tier: 1,
          trigger: triggerName as TierTrigger,
          sla_minutes: config.sla_minutes,
          sla_status: getSlaStatus(minutesWaiting, config.sla_minutes),
          received_at: receivedAt,
          why_now: whyNow,
        };
      }
    }

    // Check for reply
    if (emailContent.is_reply) {
      return {
        tier: 1,
        trigger: 'email_reply',
        sla_minutes: TIER1_TRIGGERS.email_reply.sla_minutes,
        sla_status: getSlaStatus(minutesWaiting, TIER1_TRIGGERS.email_reply.sla_minutes),
        received_at: receivedAt,
        why_now: `They replied ${formatDuration(minutesWaiting)} ago. Keep momentum.`,
      };
    }
  }

  return null;
}

// ============================================
// TIER 2: DON'T LOSE THIS
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

/**
 * Detect if an item should be Tier 2: DON'T LOSE THIS
 */
export async function detectTier2(
  item: CommandCenterItem,
  deal?: DealContext,
  champion?: ContactContext,
  engagement?: EngagementContext,
  urgencyKeywordsInNotes?: boolean
): Promise<TierResult | null> {
  if (!deal) return null;

  const triggers: TierTrigger[] = [];
  let urgency_score = 0;
  let why_now: string | null = null;

  // Deadline within 14 days
  if (deal.expected_close_date) {
    const days = daysUntil(deal.expected_close_date);
    if (days <= 7 && days >= 0) {
      triggers.push('deadline_critical');
      urgency_score += 30;
      why_now = `Close date is ${formatDate(deal.expected_close_date)} — ${days} days left.`;
    } else if (days <= 14 && days > 7) {
      triggers.push('deadline_approaching');
      urgency_score += 20;
      why_now = `Close date is ${formatDate(deal.expected_close_date)} — ${days} days out.`;
    }
  }

  // Competitor mentioned
  if (deal.competitors && deal.competitors.length > 0) {
    triggers.push('competitive_risk');
    urgency_score += 25;
    if (!why_now) {
      why_now = `They're evaluating ${deal.competitors[0]}. You're in a race.`;
    }
  }

  // Proposal viewed 3+ times in 48h
  if (engagement?.proposal_views_48h && engagement.proposal_views_48h >= 3) {
    triggers.push('proposal_hot');
    urgency_score += 20;
    if (!why_now) {
      why_now = `They viewed your proposal ${engagement.proposal_views_48h}x in 48 hours.`;
    }
  }

  // Champion dark (2 emails, no reply, 7+ days)
  if (
    champion &&
    (champion.emails_without_reply || 0) >= 2 &&
    (champion.days_since_reply || 0) >= 7
  ) {
    triggers.push('champion_dark');
    urgency_score += 25;
    if (!why_now) {
      why_now = `${champion.name} hasn't replied to ${champion.emails_without_reply} emails. Your inside access is at risk.`;
    }
  }

  // Urgency keywords in notes
  if (urgencyKeywordsInNotes) {
    triggers.push('urgency_keywords');
    urgency_score += 15;
  }

  if (triggers.length === 0) return null;

  return {
    tier: 2,
    trigger: triggers[0],
    urgency_score,
    why_now,
  };
}

// ============================================
// TIER 3: KEEP YOUR WORD
// ============================================

interface CommitmentContext {
  commitment: string;
  when?: string;
  meeting_date?: string;
  meeting_title?: string;
}

/**
 * Detect if an item should be Tier 3: KEEP YOUR WORD
 */
export async function detectTier3(
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
      why_now: `You said "${commitment.commitment}" — ${overdueText || 'pending'}.`,
    };
  }

  // Meeting follow-up (meeting ended 4+ hours ago, no follow-up sent)
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
      promise_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h implicit deadline
      why_now: `Call ended ${meetingEndedHoursAgo} hours ago. They expect follow-up.`,
    };
  }

  return null;
}

// ============================================
// TIER 4: MOVE BIG DEALS
// ============================================

/**
 * Detect if an item should be Tier 4: MOVE BIG DEALS
 */
export async function detectTier4(
  item: CommandCenterItem,
  deal?: DealContext & { value_percentile?: number },
  isStrategicAccount?: boolean,
  hasCsuiteContact?: boolean
): Promise<TierResult | null> {
  if (!deal || deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
    return null;
  }

  let value_score = 0;
  const triggers: TierTrigger[] = [];

  // Top 20% deal by value
  if (deal.value_percentile && deal.value_percentile >= 80) {
    value_score += 30;
    triggers.push('high_value');
  } else if (deal.value_percentile && deal.value_percentile >= 60) {
    value_score += 15;
  }

  // Strategic account
  if (isStrategicAccount) {
    value_score += 20;
    triggers.push('strategic_account');
  }

  // C-suite contact
  if (hasCsuiteContact) {
    value_score += 15;
    triggers.push('csuite_contact');
  }

  // Going stale (10+ days no activity)
  if (deal.days_since_activity && deal.days_since_activity >= 10) {
    value_score += 10;
    triggers.push('deal_stale');
  }

  if (value_score < 15) return null;

  let why_now: string | null = null;
  if (deal.days_since_activity && deal.days_since_activity >= 10) {
    why_now = `${formatCurrency(deal.value || 0)} deal silent for ${deal.days_since_activity} days.`;
  } else if (deal.value) {
    why_now = `${formatCurrency(deal.value)} opportunity worth attention.`;
  }

  return {
    tier: 4,
    trigger: triggers[0] || 'high_value',
    value_score,
    why_now,
  };
}

// ============================================
// MAIN CLASSIFICATION FUNCTION
// ============================================

/**
 * Classify a command center item into a tier
 */
export async function classifyItem(
  item: CommandCenterItem,
  context?: {
    emailContent?: { subject?: string; body?: string; is_reply?: boolean; received_at?: string };
    deal?: DealContext & { value_percentile?: number };
    champion?: ContactContext;
    engagement?: EngagementContext;
    commitment?: CommitmentContext;
    urgencyKeywordsInNotes?: boolean;
    meetingEndedHoursAgo?: number;
    followUpSent?: boolean;
    isStrategicAccount?: boolean;
    hasCsuiteContact?: boolean;
  }
): Promise<TierResult> {
  const ctx = context || {};

  // Try Tier 1
  const tier1 = await detectTier1(item, ctx.emailContent);
  if (tier1) return tier1;

  // Try Tier 2
  const tier2 = await detectTier2(
    item,
    ctx.deal,
    ctx.champion,
    ctx.engagement,
    ctx.urgencyKeywordsInNotes
  );
  if (tier2) return tier2;

  // Try Tier 3
  const tier3 = await detectTier3(
    item,
    ctx.commitment,
    ctx.meetingEndedHoursAgo,
    ctx.followUpSent
  );
  if (tier3) return tier3;

  // Try Tier 4
  const tier4 = await detectTier4(
    item,
    ctx.deal,
    ctx.isStrategicAccount,
    ctx.hasCsuiteContact
  );
  if (tier4) return tier4;

  // Default: Tier 5
  return {
    tier: 5,
    trigger: 'deal_stale', // Generic
    why_now: null,
  };
}

/**
 * Classify all pending items for a user
 * @returns Number of items classified
 */
export async function classifyAllItems(userId: string): Promise<number> {
  const supabase = createAdminClient();

  // Get all pending items
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
    await supabase
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
  }

  return items.length;
}

// ============================================
// SORTING FUNCTIONS
// ============================================

/**
 * Sort Tier 1 items: SLA breach severity, then recency
 */
export function sortTier1(a: CommandCenterItem, b: CommandCenterItem): number {
  // Breached first, then warning, then on_track
  const statusOrder = { breached: 0, warning: 1, on_track: 2 };
  const aStatus = statusOrder[a.sla_status || 'on_track'];
  const bStatus = statusOrder[b.sla_status || 'on_track'];

  if (aStatus !== bStatus) return aStatus - bStatus;

  // Then by recency (most recent first)
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

function extractQuestion(content: string): string | null {
  // Find the first sentence that ends with ?
  const sentences = content.split(/[.!?]+/);
  for (let i = 0; i < sentences.length; i++) {
    if (content.indexOf(sentences[i]) !== -1) {
      const idx = content.indexOf(sentences[i]) + sentences[i].length;
      if (content[idx] === '?') {
        const question = sentences[i].trim();
        // Return if it's a reasonable length
        if (question.length > 10 && question.length < 100) {
          return question + '?';
        }
      }
    }
  }
  return null;
}

function parsePromiseDate(when?: string, meetingDate?: string): string | null {
  if (!when) return null;

  const lower = when.toLowerCase();
  const baseDate = meetingDate ? new Date(meetingDate) : new Date();

  // Handle common patterns
  if (lower.includes('today')) {
    return baseDate.toISOString();
  }
  if (lower.includes('tomorrow')) {
    baseDate.setDate(baseDate.getDate() + 1);
    return baseDate.toISOString();
  }
  if (lower.includes('end of week') || lower.includes('eow') || lower.includes('by friday')) {
    // Find next Friday
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
