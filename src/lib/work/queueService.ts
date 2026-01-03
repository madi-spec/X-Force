/**
 * Queue Service - Unified Work Queues
 *
 * All work items flow through command_center_items table.
 * Queues are filtered views of CC items based on queue_id.
 *
 * Data sources that create CC items:
 * - Email sync (inbound/outbound)
 * - Calendar sync (meeting prep)
 * - Fireflies sync (transcript follow-ups)
 * - Pipeline changes (stage transitions)
 * - AI recommendations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  QueueId,
  QueueItem,
  QueueResult,
  QueueStats,
  QUEUE_CONFIGS,
  getQueueConfig,
  getActionVerb,
} from './types';

interface QueueFetchOptions {
  limit?: number;
  offset?: number;
}

/**
 * Map momentum_score to urgency level
 */
function scoreToUrgency(score: number): QueueItem['urgency'] {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Calculate waiting time as human-readable string
 * Based on time since last customer message needing response
 */
function calculateWaitingTime(lastCustomerMessageAt: string | null, createdAt: string): string | null {
  const baseTime = lastCustomerMessageAt || createdAt;
  if (!baseTime) return null;

  const diff = Date.now() - new Date(baseTime).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  }
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;

  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Convert CC item to QueueItem format
 */
function ccItemToQueueItem(item: any, queueId: QueueId): QueueItem {
  const urgency = scoreToUrgency(item.momentum_score || 50);

  // Note: metadata column doesn't exist in the DB schema
  // We populate these fields with defaults for now
  const threadCount = 1;
  const contactName = null;
  const stage = null;

  // Build subtitle from description or why_now
  const subtitle = item.description?.substring(0, 100) || item.why_now || null;
  const urgencyReason = item.why_now || `Score: ${item.momentum_score}`;

  return {
    id: item.id,
    company_id: item.company_id,
    company_name: item.company_name || item.company?.name || 'Unknown',
    company_domain: item.company?.domain || null,
    queue_id: queueId,
    title: item.title,
    subtitle,
    urgency,
    urgency_reason: urgencyReason,

    // New action-oriented fields - pass context for smarter verb detection
    action_verb: getActionVerb(item.action_type, queueId, {
      urgency_reason: urgencyReason,
      description: item.description,
      title: item.title,
      subtitle,
    }),
    thread_count: threadCount,
    waiting_time: calculateWaitingTime(null, item.created_at),
    contact_name: contactName,
    stage: stage,

    priority_score: item.momentum_score || 50,
    days_in_queue: item.days_stale || Math.ceil(
      (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
    mrr: null,
    health_score: null,
    owner_name: null,
    source_type: item.source || 'system',
    source_id: item.source_id || null,
    created_at: item.created_at,
    last_activity_at: item.last_activity_at || item.updated_at,
    metadata: {
      action_type: item.action_type,
      source: item.source,
      estimated_minutes: item.estimated_minutes,
    },
  };
}

/**
 * Fetch queue items for a specific queue
 */
export async function fetchQueueItems(
  supabase: SupabaseClient,
  queueId: QueueId,
  options: QueueFetchOptions = {}
): Promise<QueueResult> {
  const config = getQueueConfig(queueId);
  if (!config) {
    throw new Error(`Unknown queue: ${queueId}`);
  }

  const { limit = 20, offset = 0 } = options;


  // Build query based on queue type
  // Note: We don't select queue_id, days_stale, last_activity_at, metadata from DB
  // because they may not exist yet. We compute/assign these locally.
  let query = supabase
    .from('command_center_items')
    .select(`
      id,
      company_id,
      company_name,
      title,
      description,
      action_type,
      status,
      momentum_score,
      source,
      source_id,
      why_now,
      estimated_minutes,
      created_at,
      updated_at,
      due_at,
      company:companies(id, name, domain)
    `)
    .eq('status', 'pending');

  // Apply queue-specific filters
  switch (queueId) {
    case 'action_now':
      // Critical items or items due soon
      query = query.or('momentum_score.gte.90,due_at.lte.' + new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());
      break;

    case 'needs_response':
      // Email responses needed
      query = query.in('action_type', ['email_respond', 'respond']);
      break;

    case 'meeting_prep':
      // Meeting preparation items
      query = query.in('action_type', ['prepare', 'meeting_prep', 'call_with_prep']);
      break;

    case 'follow_ups':
      // Follow-up actions
      query = query.in('action_type', ['follow_up', 'meeting_follow_up', 'call']);
      break;

    case 'new_leads':
      // Research and new accounts
      query = query.in('action_type', ['research_account']);
      break;

    case 'scheduling':
      // Scheduling tasks
      query = query.in('action_type', ['schedule']);
      break;

    case 'stalled_deals': {
      // Items with no activity for 7+ days - filter by updated_at
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lt('updated_at', sevenDaysAgo);
      break;
    }

    case 'at_risk':
      // Escalations and at-risk items
      query = query.in('action_type', ['escalate']);
      break;

    case 'expansion_ready':
      // Expansion opportunities - for now, items marked with upsell/expand action types
      query = query.in('action_type', ['upsell', 'expand', 'renewal']);
      break;

    case 'unresolved_issues':
      // Open issues - items marked as needing resolution
      query = query.in('action_type', ['resolve', 'support', 'issue']);
      break;

    case 'blocked':
      // Blocked onboarding items
      query = query.in('action_type', ['blocked', 'waiting', 'onboarding_blocked']);
      break;

    case 'due_this_week': {
      // Due this week
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.not('due_at', 'is', null).lte('due_at', weekFromNow);
      break;
    }

    case 'new_kickoffs':
      // New kickoffs - recently started onboarding
      query = query.in('action_type', ['kickoff', 'onboarding_start', 'welcome']);
      break;

    case 'sla_breaches':
      // SLA breaches - items past due
      query = query.not('due_at', 'is', null).lt('due_at', new Date().toISOString());
      break;

    case 'high_severity':
      // High severity items - high momentum urgent items
      query = query.gte('momentum_score', 85);
      break;

    case 'unassigned':
      // Unassigned items - items without an owner (use low momentum as proxy)
      query = query.lte('momentum_score', 30);
      break;

    default:
      // Fallback: show all pending items for this queue
      console.warn(`[QueueService] No specific filter for queue: ${queueId}`);
  }

  // Order by momentum score (highest first) and apply pagination
  const { data: items, error } = await query
    .order('momentum_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);


  if (error) {
    console.error(`[QueueService] Error fetching ${queueId}:`, error);
    return {
      queue: config,
      items: [],
      stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      hasMore: false,
    };
  }

  // Deduplicate by company_id (keep highest scoring item per company)
  const companyMap = new Map<string, any>();
  for (const item of items || []) {
    const companyId = item.company_id || 'no_company';
    const existing = companyMap.get(companyId);
    if (!existing || (item.momentum_score || 0) > (existing.momentum_score || 0)) {
      companyMap.set(companyId, item);
    }
  }
  const dedupedItems = Array.from(companyMap.values());

  // Convert to QueueItem format
  const queueItems = dedupedItems.map(item => ccItemToQueueItem(item, queueId));

  // Calculate stats
  const stats: QueueStats = {
    total: queueItems.length,
    critical: queueItems.filter(i => i.urgency === 'critical').length,
    high: queueItems.filter(i => i.urgency === 'high').length,
    medium: queueItems.filter(i => i.urgency === 'medium').length,
    low: queueItems.filter(i => i.urgency === 'low').length,
  };

  return {
    queue: config,
    items: queueItems.slice(0, limit),
    stats,
    hasMore: (items?.length || 0) === limit,
  };
}

/**
 * Fetch multiple queues at once (for initial load)
 */
export async function fetchQueuesForLens(
  supabase: SupabaseClient,
  lens: string
): Promise<Map<QueueId, QueueResult>> {
  const queues = QUEUE_CONFIGS.filter(q => q.lens === lens);
  const results = new Map<QueueId, QueueResult>();

  await Promise.all(
    queues.map(async (queue) => {
      const result = await fetchQueueItems(supabase, queue.id, { limit: 10 });
      results.set(queue.id, result);
    })
  );

  return results;
}

/**
 * Get queue counts for badge display
 */
export async function getQueueCounts(
  supabase: SupabaseClient
): Promise<Record<QueueId, number>> {
  const counts: Record<string, number> = {};

  // Get counts by action_type groupings
  const { data } = await supabase
    .from('command_center_items')
    .select('action_type')
    .eq('status', 'pending');

  if (data) {
    // Map action_types to queue counts
    const actionTypeCounts: Record<string, number> = {};
    for (const item of data) {
      actionTypeCounts[item.action_type] = (actionTypeCounts[item.action_type] || 0) + 1;
    }

    counts['needs_response'] = (actionTypeCounts['email_respond'] || 0) + (actionTypeCounts['respond'] || 0);
    counts['meeting_prep'] = (actionTypeCounts['prepare'] || 0) + (actionTypeCounts['meeting_prep'] || 0) + (actionTypeCounts['call_with_prep'] || 0);
    counts['follow_ups'] = (actionTypeCounts['follow_up'] || 0) + (actionTypeCounts['meeting_follow_up'] || 0) + (actionTypeCounts['call'] || 0);
    counts['new_leads'] = actionTypeCounts['research_account'] || 0;
    counts['scheduling'] = actionTypeCounts['schedule'] || 0;
    counts['at_risk'] = actionTypeCounts['escalate'] || 0;
  }

  // Get action_now count (high momentum items)
  const { count: actionNowCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('momentum_score', 90);

  counts['action_now'] = actionNowCount || 0;

  return counts as Record<QueueId, number>;
}

/**
 * Mark a queue item as completed
 */
export async function completeQueueItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('command_center_items')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  return !error;
}

/**
 * Snooze a queue item
 */
export async function snoozeQueueItem(
  supabase: SupabaseClient,
  itemId: string,
  snoozedUntil: Date
): Promise<boolean> {
  const { error } = await supabase
    .from('command_center_items')
    .update({
      status: 'snoozed',
      snoozed_until: snoozedUntil.toISOString(),
      snooze_count: supabase.rpc('increment', { row_id: itemId, column_name: 'snooze_count' }),
      last_snoozed_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  return !error;
}

/**
 * Dismiss a queue item
 */
export async function dismissQueueItem(
  supabase: SupabaseClient,
  itemId: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('command_center_items')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
      dismissed_reason: reason,
    })
    .eq('id', itemId);

  return !error;
}
