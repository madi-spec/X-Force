/**
 * Item Generator
 *
 * Creates command_center_items from various sources:
 * - Email drafts needing review
 * - Meeting prep (upcoming external meetings)
 * - Meeting follow-ups (after meetings)
 * - Stale deals (no activity > 7 days)
 * - AI signals requiring action
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { CommandCenterItem, ActionType } from '@/types/commandCenter';
import { calculateMomentumScore } from './momentumScoring';
import { getTypicalDuration } from './actionDurations';

// Helper to safely extract first item from relation (could be object or array)
function getRelation<T>(data: T | T[] | null | undefined): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

// ============================================
// SYNC ALL SOURCES
// ============================================

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Sync all sources for a user
 */
export async function syncAllSources(userId: string): Promise<SyncResult> {
  const results: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  // Run all syncs
  const emailResult = await syncEmailDrafts(userId);
  const meetingPrepResult = await syncMeetingPrep(userId);
  const followUpResult = await syncMeetingFollowUps(userId);
  const staleDealsResult = await syncStaleDeals(userId);
  const signalsResult = await syncAISignals(userId);

  // Aggregate results
  for (const r of [emailResult, meetingPrepResult, followUpResult, staleDealsResult, signalsResult]) {
    results.created += r.created;
    results.updated += r.updated;
    results.skipped += r.skipped;
    results.errors.push(...r.errors);
  }

  return results;
}

// ============================================
// EMAIL DRAFTS
// ============================================

/**
 * Create items for email conversations with AI drafts ready
 */
export async function syncEmailDrafts(userId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  try {
    // Get conversations with drafts
    const { data: conversations } = await supabase
      .from('email_conversations')
      .select(`
        id, subject, from_email, from_name, company_id, deal_id, contact_id,
        ai_draft_subject, ai_draft_body, ai_draft_confidence,
        companies:company_id (id, name),
        deals:deal_id (id, name, stage, estimated_value)
      `)
      .eq('user_id', userId)
      .not('ai_draft_body', 'is', null)
      .in('status', ['pending', 'awaiting_response']);

    if (!conversations || conversations.length === 0) {
      return result;
    }

    for (const conv of conversations) {
      // Check if item already exists
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('conversation_id', conv.id)
        .eq('status', 'pending')
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      // Create item
      let deal = getRelation(conv.deals as { id: string; name: string; stage: string; estimated_value: number | null } | { id: string; name: string; stage: string; estimated_value: number | null }[] | null);
      const company = getRelation(conv.companies as { id: string; name: string } | { id: string; name: string }[] | null);

      // If no deal but we have company, try to find active deal for company
      let resolvedDealId = conv.deal_id;
      let dealProbability = 0.5;
      if (!deal && conv.company_id) {
        const companyDeal = await findDealForCompany(conv.company_id);
        if (companyDeal) {
          deal = companyDeal;
          resolvedDealId = companyDeal.id;
          dealProbability = companyDeal.probability || 0.5;
        }
      }

      const item: Partial<CommandCenterItem> = {
        user_id: userId,
        conversation_id: conv.id,
        deal_id: resolvedDealId,
        company_id: conv.company_id,
        contact_id: conv.contact_id,
        action_type: 'email_send_draft',
        title: `Send: ${conv.ai_draft_subject || conv.subject}`,
        description: `Draft ready (${Math.round((conv.ai_draft_confidence || 0.8) * 100)}% confidence)`,
        target_name: conv.from_name || conv.from_email,
        company_name: company?.name,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_stage: deal?.stage,
        estimated_minutes: getTypicalDuration('email_send_draft'),
        why_now: 'AI draft ready for review',
        source: 'email_sync',
        source_id: conv.id,
        primary_action_label: 'Review & Send',
      };

      // Calculate score
      const score = calculateMomentumScore({
        action_type: 'email_send_draft',
        due_at: null,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_id: resolvedDealId,
        company_id: conv.company_id,
      });

      item.momentum_score = score.score;
      item.score_factors = score.factors;
      item.score_explanation = score.explanation;
      item.base_priority = score.factors.base?.value || 0;
      item.value_score = score.factors.value?.value || 0;

      const { error } = await supabase.from('command_center_items').insert(item);

      if (error) {
        result.errors.push(`Email draft ${conv.id}: ${error.message}`);
      } else {
        result.created++;
      }
    }
  } catch (error) {
    result.errors.push(`Email drafts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// ============================================
// MEETING PREP
// ============================================

/**
 * Create meeting prep items for upcoming external meetings
 */
export async function syncMeetingPrep(userId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  try {
    // Get upcoming meetings from activities (next 24 hours)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: meetings } = await supabase
      .from('activities')
      .select(`
        id, subject, occurred_at, metadata,
        deals:deal_id (id, name, stage, estimated_value),
        companies:company_id (id, name),
        contacts:contact_id (id, name)
      `)
      .eq('user_id', userId)
      .eq('type', 'meeting')
      .gte('occurred_at', now.toISOString())
      .lte('occurred_at', tomorrow.toISOString());

    if (!meetings || meetings.length === 0) {
      return result;
    }

    for (const meeting of meetings) {
      const metadata = meeting.metadata as { meeting_id?: string; has_contact?: boolean; microsoft_id?: string } | null;

      // Skip internal meetings (no external contacts)
      // Calendar sync sets has_contact=true when attendees match known contacts
      if (metadata && metadata.has_contact === false) {
        result.skipped++;
        continue;
      }

      // Check if prep item already exists
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('meeting_id', metadata?.microsoft_id || meeting.id)
        .eq('action_type', 'meeting_prep')
        .eq('status', 'pending')
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      let deal = getRelation(meeting.deals);
      const company = getRelation(meeting.companies);
      const contact = getRelation(meeting.contacts);

      // If no deal but we have company, try to find active deal for company
      let resolvedDealId = deal?.id;
      let dealProbability = 0.5;
      if (!deal && company?.id) {
        const companyDeal = await findDealForCompany(company.id);
        if (companyDeal) {
          deal = companyDeal;
          resolvedDealId = companyDeal.id;
          dealProbability = companyDeal.probability || 0.5;
        }
      }

      // Calculate when prep should start (15 min before)
      const meetingTime = new Date(meeting.occurred_at);
      const prepTime = new Date(meetingTime.getTime() - 15 * 60 * 1000);

      const item: Partial<CommandCenterItem> = {
        user_id: userId,
        meeting_id: metadata?.microsoft_id || meeting.id,
        deal_id: resolvedDealId,
        company_id: company?.id,
        contact_id: contact?.id,
        action_type: 'meeting_prep',
        title: `Prep: ${meeting.subject}`,
        description: `Meeting at ${meetingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        target_name: contact?.name || company?.name,
        company_name: company?.name,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_stage: deal?.stage,
        estimated_minutes: getTypicalDuration('meeting_prep'),
        due_at: prepTime.toISOString(),
        why_now: `Meeting in ${formatMinutesUntil(meetingTime)}`,
        source: 'calendar_sync',
        source_id: metadata?.microsoft_id || meeting.id,
        primary_action_label: 'Review Brief',
      };

      // Calculate score
      const score = calculateMomentumScore({
        action_type: 'meeting_prep',
        due_at: prepTime.toISOString(),
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_id: resolvedDealId,
        company_id: company?.id,
      });

      item.momentum_score = score.score;
      item.score_factors = score.factors;
      item.score_explanation = score.explanation;
      item.base_priority = score.factors.base?.value || 0;
      item.time_pressure = score.factors.time?.value || 0;
      item.value_score = score.factors.value?.value || 0;

      const { error } = await supabase.from('command_center_items').insert(item);

      if (error) {
        result.errors.push(`Meeting prep ${meeting.id}: ${error.message}`);
      } else {
        result.created++;
      }
    }
  } catch (error) {
    result.errors.push(`Meeting prep: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// ============================================
// MEETING FOLLOW-UPS
// ============================================

/**
 * Create follow-up items for meetings that occurred recently
 */
export async function syncMeetingFollowUps(userId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  try {
    // Get meetings from last 24 hours that haven't been followed up
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: meetings } = await supabase
      .from('activities')
      .select(`
        id, subject, occurred_at, metadata,
        deals:deal_id (id, name, stage, estimated_value),
        companies:company_id (id, name),
        contacts:contact_id (id, name)
      `)
      .eq('user_id', userId)
      .eq('type', 'meeting')
      .gte('occurred_at', yesterday.toISOString())
      .lte('occurred_at', now.toISOString());

    if (!meetings || meetings.length === 0) {
      return result;
    }

    for (const meeting of meetings) {
      const metadata = meeting.metadata as { meeting_id?: string; has_contact?: boolean; microsoft_id?: string } | null;

      // Skip internal meetings (no external contacts)
      // Calendar sync sets has_contact=true when attendees match known contacts
      if (metadata && metadata.has_contact === false) {
        result.skipped++;
        continue;
      }

      // Check if follow-up item already exists
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('meeting_id', metadata?.microsoft_id || meeting.id)
        .eq('action_type', 'meeting_follow_up')
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      // Check if follow-up email was already sent
      const { data: followUpEmail } = await supabase
        .from('activities')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'email_sent')
        .gte('occurred_at', meeting.occurred_at)
        .limit(1)
        .single();

      if (followUpEmail) {
        result.skipped++;
        continue;
      }

      let deal = getRelation(meeting.deals);
      const company = getRelation(meeting.companies);
      const contact = getRelation(meeting.contacts);

      // If no deal but we have company, try to find active deal for company
      let resolvedDealId = deal?.id;
      let dealProbability = 0.5;
      if (!deal && company?.id) {
        const companyDeal = await findDealForCompany(company.id);
        if (companyDeal) {
          deal = companyDeal;
          resolvedDealId = companyDeal.id;
          dealProbability = companyDeal.probability || 0.5;
        }
      }

      const meetingTime = new Date(meeting.occurred_at);

      const item: Partial<CommandCenterItem> = {
        user_id: userId,
        meeting_id: metadata?.microsoft_id || meeting.id,
        deal_id: resolvedDealId,
        company_id: company?.id,
        contact_id: contact?.id,
        action_type: 'meeting_follow_up',
        title: `Follow up: ${meeting.subject}`,
        description: `Meeting was ${formatTimeAgo(meetingTime)}`,
        target_name: contact?.name || company?.name,
        company_name: company?.name,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_stage: deal?.stage,
        estimated_minutes: getTypicalDuration('meeting_follow_up'),
        why_now: `Meeting was ${formatTimeAgo(meetingTime)} - send follow-up while context is fresh`,
        source: 'calendar_sync',
        source_id: metadata?.microsoft_id || meeting.id,
        primary_action_label: 'Send Follow-up',
      };

      // Calculate score
      const score = calculateMomentumScore({
        action_type: 'meeting_follow_up',
        due_at: null,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_id: resolvedDealId,
        company_id: company?.id,
      });

      item.momentum_score = score.score;
      item.score_factors = score.factors;
      item.score_explanation = score.explanation;
      item.base_priority = score.factors.base?.value || 0;
      item.value_score = score.factors.value?.value || 0;

      const { error } = await supabase.from('command_center_items').insert(item);

      if (error) {
        result.errors.push(`Meeting follow-up ${meeting.id}: ${error.message}`);
      } else {
        result.created++;
      }
    }
  } catch (error) {
    result.errors.push(`Meeting follow-ups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// ============================================
// STALE DEALS
// ============================================

/**
 * Create items for deals with no activity > 7 days
 */
export async function syncStaleDeals(userId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  try {
    const staleDays = 7;
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    // Get open deals with no recent activity
    const { data: deals } = await supabase
      .from('deals')
      .select(`
        id, name, stage, estimated_value, owner_id,
        updated_at,
        companies:organization_id (id, name)
      `)
      .eq('owner_id', userId)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .lte('updated_at', staleDate.toISOString());

    if (!deals || deals.length === 0) {
      return result;
    }

    for (const deal of deals) {
      // Check if stale deal item already exists
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('deal_id', deal.id)
        .eq('action_type', 'call')
        .eq('status', 'pending')
        .gte('created_at', staleDate.toISOString())
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      const company = getRelation(deal.companies);
      const daysSinceActivity = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24));

      const item: Partial<CommandCenterItem> = {
        user_id: userId,
        deal_id: deal.id,
        company_id: company?.id,
        action_type: 'call',
        title: `Re-engage: ${deal.name}`,
        description: `No activity for ${daysSinceActivity} days`,
        target_name: deal.name,
        company_name: company?.name,
        deal_value: deal.estimated_value,
        deal_stage: deal.stage,
        estimated_minutes: getTypicalDuration('call'),
        why_now: `Deal going stale - ${daysSinceActivity} days without activity`,
        source: 'signal_detection',
        source_id: deal.id,
        primary_action_label: 'Call Now',
        fallback_action_label: 'Send Email',
      };

      // Calculate score with stale deal context
      const score = calculateMomentumScore({
        action_type: 'call',
        due_at: null,
        deal_value: deal.estimated_value,
        deal_probability: 0.3, // Lower probability for stale deals
        deal_id: deal.id,
        company_id: company?.id,
      }, { signal_type: 'stale_deal' });

      item.momentum_score = score.score;
      item.score_factors = score.factors;
      item.score_explanation = score.explanation;
      item.base_priority = score.factors.base?.value || 0;
      item.value_score = score.factors.value?.value || 0;

      const { error } = await supabase.from('command_center_items').insert(item);

      if (error) {
        result.errors.push(`Stale deal ${deal.id}: ${error.message}`);
      } else {
        result.created++;
      }
    }
  } catch (error) {
    result.errors.push(`Stale deals: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// ============================================
// AI SIGNALS
// ============================================

/**
 * Create items from AI signals requiring action
 */
export async function syncAISignals(userId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  try {
    // Get active signals that require action
    const { data: signals } = await supabase
      .from('ai_signals')
      .select(`
        id, type, title, description, severity, suggested_action,
        deal_id, company_id, contact_id,
        deals:deal_id (id, name, stage, estimated_value),
        companies:company_id (id, name)
      `)
      .eq('status', 'active')
      .eq('category', 'action_needed');

    if (!signals || signals.length === 0) {
      return result;
    }

    for (const signal of signals) {
      // Check if signal item already exists
      const { data: existing } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('user_id', userId)
        .eq('signal_id', signal.id)
        .eq('status', 'pending')
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      let deal = getRelation(signal.deals);
      const company = getRelation(signal.companies);

      // If no deal but we have company, try to find active deal for company
      let resolvedDealId = signal.deal_id;
      let dealProbability = 0.5;
      if (!deal && signal.company_id) {
        const companyDeal = await findDealForCompany(signal.company_id);
        if (companyDeal) {
          deal = companyDeal;
          resolvedDealId = companyDeal.id;
          dealProbability = companyDeal.probability || 0.5;
        }
      }

      // Map signal type to action type
      const actionType = mapSignalToAction(signal.type);

      const item: Partial<CommandCenterItem> = {
        user_id: userId,
        signal_id: signal.id,
        deal_id: resolvedDealId,
        company_id: signal.company_id,
        contact_id: signal.contact_id,
        action_type: actionType,
        title: signal.title,
        description: signal.description,
        target_name: deal?.name || company?.name,
        company_name: company?.name,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_stage: deal?.stage,
        estimated_minutes: getTypicalDuration(actionType),
        why_now: signal.suggested_action || signal.description,
        source: 'signal_detection',
        source_id: signal.id,
        primary_action_label: 'Take Action',
      };

      // Calculate score
      const score = calculateMomentumScore({
        action_type: actionType,
        due_at: null,
        deal_value: deal?.estimated_value,
        deal_probability: dealProbability,
        deal_id: signal.deal_id,
        company_id: signal.company_id,
      }, { signal_type: signal.type });

      item.momentum_score = score.score;
      item.score_factors = score.factors;
      item.score_explanation = score.explanation;
      item.base_priority = score.factors.base?.value || 0;
      item.value_score = score.factors.value?.value || 0;

      const { error } = await supabase.from('command_center_items').insert(item);

      if (error) {
        result.errors.push(`Signal ${signal.id}: ${error.message}`);
      } else {
        result.created++;
      }
    }
  } catch (error) {
    result.errors.push(`AI signals: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// ============================================
// HELPERS
// ============================================

function mapSignalToAction(signalType: string): ActionType {
  const mapping: Record<string, ActionType> = {
    'stale_deal': 'call',
    'stuck_stage': 'call',
    'high_engagement': 'call',
    'champion_identified': 'call_with_prep',
    'multi_thread_opportunity': 'research_account',
    'competitor_mentioned': 'call_with_prep',
    'budget_confirmed': 'proposal_review',
  };

  return mapping[signalType] || 'task_simple';
}

function formatMinutesUntil(date: Date): string {
  const now = new Date();
  const minutes = Math.round((date.getTime() - now.getTime()) / 60000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * Generate "Why Now" text for an item based on context
 */
export function generateWhyNow(params: {
  action_type: string;
  due_at?: string | null;
  deal_value?: number | null;
  deal_stage?: string | null;
  stale_days?: number;
  signal_type?: string;
  product_name?: string | null;
  product_status?: string | null;
  product_mrr?: number | null;
}): string {
  const { action_type, due_at, deal_value, deal_stage, stale_days, signal_type, product_name, product_status, product_mrr } = params;

  // Product-based messages (check these first)
  if (product_name && product_status) {
    const mrr = product_mrr ? ` ($${product_mrr.toLocaleString()}/mo)` : '';

    switch (product_status) {
      case 'in_sales':
        return `${product_name}${mrr} opportunity - advance the sale`;
      case 'in_onboarding':
        return `${product_name} onboarding in progress - ensure customer success`;
      case 'active':
        return `${product_name} customer${mrr} - maintain and grow relationship`;
    }
  }

  // If there's a due date, mention urgency
  if (due_at) {
    const due = new Date(due_at);
    const now = new Date();
    const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) {
      return 'This action is overdue - immediate attention needed';
    }
    if (hoursUntilDue <= 2) {
      return 'Due very soon - prioritize this action';
    }
    if (hoursUntilDue <= 8) {
      return 'Due today - schedule time to complete';
    }
    if (hoursUntilDue <= 24) {
      return 'Due within 24 hours';
    }
  }

  // Stale deal
  if (stale_days && stale_days > 5) {
    return `Deal going cold - ${stale_days} days without contact`;
  }

  // Signal-based why now
  if (signal_type) {
    const signalMessages: Record<string, string> = {
      stale_deal: 'Re-engage before deal goes cold',
      stuck_stage: 'Deal needs movement - identify blockers',
      high_engagement: 'Buyer is active - strike while hot',
      champion_identified: 'New champion identified - build relationship',
      competitor_mentioned: 'Competitive threat detected - address concerns',
      budget_confirmed: 'Budget confirmed - advance to proposal',
    };
    if (signalMessages[signal_type]) {
      return signalMessages[signal_type];
    }
  }

  // High-value deal
  if (deal_value && deal_value >= 50000) {
    return `High-value opportunity ($${Math.round(deal_value / 1000)}K) - prioritize engagement`;
  }

  // Stage-based messages
  if (deal_stage) {
    const stageMessages: Record<string, string> = {
      negotiation: 'In negotiation - close the deal',
      trial: 'Active trial - ensure success',
      demo: 'Demo scheduled - prepare and deliver',
      discovery: 'Discovery phase - uncover pain points',
      qualifying: 'New lead - qualify quickly',
    };
    if (stageMessages[deal_stage]) {
      return stageMessages[deal_stage];
    }
  }

  // Action-type based defaults
  const actionMessages: Record<string, string> = {
    call: 'Direct contact builds trust faster than email',
    call_with_prep: 'Prepared calls have higher success rates',
    email_send_draft: 'Draft ready - review and send while context is fresh',
    email_respond: 'Quick responses show responsiveness',
    meeting_prep: 'Preparation is key to meeting success',
    meeting_follow_up: 'Timely follow-ups improve close rates',
    proposal_review: 'Proposal needs review before sending',
    linkedin_touch: 'Social touches keep you top of mind',
    research_account: 'Know your customer before you call',
  };

  return actionMessages[action_type] || 'Take action to move this forward';
}

/**
 * Find active deals for a company
 * Returns the highest-value active deal if multiple exist
 */
export async function findDealForCompany(
  companyId: string
): Promise<{ id: string; name: string; stage: string; estimated_value: number | null; probability: number | null } | null> {
  const supabase = createAdminClient();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage, estimated_value, probability')
    .eq('organization_id', companyId)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('estimated_value', { ascending: false, nullsFirst: false })
    .limit(1);

  if (!deals || deals.length === 0) {
    return null;
  }

  return deals[0];
}

/**
 * Find the primary company_product for a company
 * Returns the highest-priority active product (in_sales > in_onboarding > active)
 */
export async function findCompanyProductForCompany(
  companyId: string
): Promise<{
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  mrr: number | null;
  stage_name: string | null;
} | null> {
  const supabase = createAdminClient();

  // Priority order: in_sales first (active sales), then onboarding, then active customers
  const { data: products, error } = await supabase
    .from('company_products')
    .select(`
      id,
      product_id,
      status,
      mrr,
      current_stage:product_sales_stages(id, name),
      product:products(id, name)
    `)
    .eq('company_id', companyId)
    .in('status', ['in_sales', 'in_onboarding', 'active'])
    .order('status', { ascending: true })
    .limit(5);

  if (error) {
    console.error('[findCompanyProductForCompany] Error:', error);
    return null;
  }

  if (!products || products.length === 0) {
    return null;
  }

  // Priority: in_sales > in_onboarding > active
  const priorityOrder = ['in_sales', 'in_onboarding', 'active'];
  const sorted = products.sort((a, b) => {
    return priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status);
  });

  const cp = sorted[0];
  const product = getRelation(cp.product as { id: string; name: string } | { id: string; name: string }[] | null);
  const stage = getRelation(cp.current_stage as { id: string; name: string } | { id: string; name: string }[] | null);

  return {
    id: cp.id,
    product_id: cp.product_id,
    product_name: product?.name || 'Unknown Product',
    status: cp.status,
    mrr: cp.mrr,
    stage_name: stage?.name || null,
  };
}

// ============================================
// ITEM MANAGEMENT
// ============================================

/**
 * Create a new command center item
 */
export async function createCommandCenterItem(
  item: Partial<CommandCenterItem>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = createAdminClient();

  // If company_id provided but no company_product_id, try to find one
  if (item.company_id && !item.company_product_id) {
    const productData = await findCompanyProductForCompany(item.company_id);
    if (productData) {
      item.company_product_id = productData.id;
      item.product_name = productData.product_name;
      item.product_status = productData.status;
      item.product_mrr = productData.mrr;
      item.product_stage = productData.stage_name;
    }
  }

  // Calculate score if not provided (include product_mrr for value scoring)
  if (!item.momentum_score) {
    const score = calculateMomentumScore({
      action_type: item.action_type || 'task_simple',
      due_at: item.due_at || null,
      deal_value: item.deal_value || null,
      deal_probability: item.deal_probability || null,
      deal_id: item.deal_id || null,
      company_id: item.company_id || null,
      product_mrr: item.product_mrr || null,
    });

    item.momentum_score = score.score;
    item.score_factors = score.factors;
    item.score_explanation = score.explanation;
    item.base_priority = score.factors.base?.value || 0;
    item.time_pressure = score.factors.time?.value || 0;
    item.value_score = score.factors.value?.value || 0;
    item.engagement_score = score.factors.engagement?.value || 0;
  }

  // Set defaults
  if (!item.estimated_minutes && item.action_type) {
    item.estimated_minutes = getTypicalDuration(item.action_type);
  }

  const { data, error } = await supabase
    .from('command_center_items')
    .insert(item)
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * Update momentum score for a single item
 */
export async function updateItemScore(itemId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from('command_center_items')
    .select('action_type, due_at, deal_value, deal_probability, deal_id, company_id')
    .eq('id', itemId)
    .single();

  if (!item) return false;

  const score = calculateMomentumScore({
    action_type: item.action_type,
    due_at: item.due_at,
    deal_value: item.deal_value,
    deal_probability: item.deal_probability,
    deal_id: item.deal_id,
    company_id: item.company_id,
  });

  const { error } = await supabase
    .from('command_center_items')
    .update({
      momentum_score: score.score,
      score_factors: score.factors,
      score_explanation: score.explanation,
      base_priority: score.factors.base?.value || 0,
      time_pressure: score.factors.time?.value || 0,
      value_score: score.factors.value?.value || 0,
      engagement_score: score.factors.engagement?.value || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  return !error;
}

/**
 * Refresh all momentum scores for a user's pending items
 */
export async function refreshAllScores(
  userId: string
): Promise<{ updated: number; failed: number }> {
  const supabase = createAdminClient();
  const result = { updated: 0, failed: 0 };

  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, action_type, due_at, deal_value, deal_probability, deal_id, company_id')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (!items || items.length === 0) {
    return result;
  }

  for (const item of items) {
    const score = calculateMomentumScore({
      action_type: item.action_type,
      due_at: item.due_at,
      deal_value: item.deal_value,
      deal_probability: item.deal_probability,
      deal_id: item.deal_id,
      company_id: item.company_id,
    });

    const { error } = await supabase
      .from('command_center_items')
      .update({
        momentum_score: score.score,
        score_factors: score.factors,
        score_explanation: score.explanation,
        base_priority: score.factors.base?.value || 0,
        time_pressure: score.factors.time?.value || 0,
        value_score: score.factors.value?.value || 0,
        engagement_score: score.factors.engagement?.value || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      result.failed++;
    } else {
      result.updated++;
    }
  }

  return result;
}
