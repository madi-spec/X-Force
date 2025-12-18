/**
 * SLA Service
 *
 * Manages response SLA tracking for email conversations
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// Types
// ============================================================================

export interface SlaRule {
  dealStage?: string;
  persona?: string;
  defaultHours: number;
  warningPercent: number;
}

export interface SlaCheckResult {
  warnings: number;
  overdue: number;
}

// ============================================================================
// Configuration
// ============================================================================

const SLA_RULES: SlaRule[] = [
  { dealStage: 'negotiation', defaultHours: 4, warningPercent: 50 },
  { dealStage: 'proposal', defaultHours: 24, warningPercent: 75 },
  { dealStage: 'demo', persona: 'executive', defaultHours: 12, warningPercent: 50 },
  { dealStage: 'demo', defaultHours: 24, warningPercent: 75 },
  { defaultHours: 48, warningPercent: 75 }, // Default
];

// ============================================================================
// SLA Management
// ============================================================================

/**
 * Set response SLA for a conversation
 */
export async function setResponseSla(
  conversationId: string,
  options?: {
    dealStage?: string;
    contactPersona?: string;
    contactPatternAvgHours?: number;
  }
): Promise<void> {
  const supabase = createAdminClient();

  // Find matching rule
  const rule = SLA_RULES.find(
    (r) =>
      (!r.dealStage || r.dealStage === options?.dealStage) &&
      (!r.persona || r.persona === options?.contactPersona)
  ) || SLA_RULES[SLA_RULES.length - 1];

  // Adjust based on contact pattern if available
  let slaHours = rule.defaultHours;
  if (options?.contactPatternAvgHours && options.contactPatternAvgHours > 0) {
    slaHours = Math.max(rule.defaultHours, Math.ceil(options.contactPatternAvgHours * 1.5));
  }

  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + slaHours);

  await supabase
    .from('email_conversations')
    .update({
      response_due_at: dueAt.toISOString(),
      sla_hours: slaHours,
      sla_status: 'ok',
    })
    .eq('id', conversationId);
}

/**
 * Clear SLA for a conversation
 */
export async function clearSla(conversationId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('email_conversations')
    .update({
      response_due_at: null,
      sla_hours: null,
      sla_status: 'ok',
    })
    .eq('id', conversationId);
}

/**
 * Check and update SLA statuses (background job)
 */
export async function checkSlaStatuses(): Promise<SlaCheckResult> {
  const supabase = createAdminClient();

  const { data } = await supabase.rpc('update_sla_statuses');

  if (!data || data.length === 0) {
    return { warnings: 0, overdue: 0 };
  }

  return {
    warnings: data[0].warnings || 0,
    overdue: data[0].overdue || 0,
  };
}

/**
 * Get overdue conversations
 */
export async function getOverdueConversations(userId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_conversations')
    .select(
      `
      *,
      contact:contacts(id, name, email),
      company:companies(id, name),
      deal:deals(id, name, stage)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'awaiting_response')
    .eq('sla_status', 'overdue')
    .order('response_due_at', { ascending: true });

  return data || [];
}

/**
 * Get conversations with SLA warnings
 */
export async function getWarningConversations(userId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_conversations')
    .select(
      `
      *,
      contact:contacts(id, name, email),
      company:companies(id, name),
      deal:deals(id, name, stage)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'awaiting_response')
    .eq('sla_status', 'warning')
    .order('response_due_at', { ascending: true });

  return data || [];
}

// ============================================================================
// Snooze Wake-up
// ============================================================================

/**
 * Wake up snoozed conversations (background job)
 */
export async function wakeupSnoozedConversations(): Promise<number> {
  const supabase = createAdminClient();

  const { data } = await supabase.rpc('wake_snoozed_conversations');

  return data || 0;
}

// ============================================================================
// Contact Velocity
// ============================================================================

/**
 * Update contact email patterns based on response history
 */
export async function updateContactPattern(
  contactId: string,
  userId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Get all threads with this contact
  const { data: threads } = await supabase
    .from('email_conversations')
    .select('id, last_outbound_at')
    .eq('user_id', userId)
    .eq('contact_id', contactId);

  if (!threads || threads.length === 0) return;

  // Calculate response times
  let totalResponses = 0;
  let totalResponseTimeHours = 0;
  const responseTimes: number[] = [];

  for (const thread of threads) {
    const { data: messages } = await supabase
      .from('email_messages')
      .select('is_sent_by_user, received_at, sent_at')
      .eq('conversation_ref', thread.id)
      .order('received_at', { ascending: true });

    if (!messages) continue;

    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];

      // We sent → they replied
      if (prev.is_sent_by_user && !curr.is_sent_by_user) {
        const sentAt = new Date(prev.sent_at || prev.received_at);
        const receivedAt = new Date(curr.received_at);
        const diffHours = (receivedAt.getTime() - sentAt.getTime()) / (1000 * 60 * 60);

        if (diffHours > 0) {
          totalResponses++;
          totalResponseTimeHours += diffHours;
          responseTimes.push(diffHours);
        }
      }
    }
  }

  if (totalResponses === 0) return;

  const avgResponseTimeHours = totalResponseTimeHours / totalResponses;
  const responseRate = totalResponses / threads.length;

  // Sort and get median
  responseTimes.sort((a, b) => a - b);
  const medianIndex = Math.floor(responseTimes.length / 2);
  const medianResponseTimeHours =
    responseTimes.length % 2 === 0
      ? (responseTimes[medianIndex - 1] + responseTimes[medianIndex]) / 2
      : responseTimes[medianIndex];

  await supabase.from('contact_email_patterns').upsert(
    {
      contact_id: contactId,
      user_id: userId,
      total_threads: threads.length,
      total_responses: totalResponses,
      response_rate: responseRate,
      avg_response_time_hours: avgResponseTimeHours,
      median_response_time_hours: medianResponseTimeHours,
      fastest_response_hours: Math.min(...responseTimes),
      slowest_response_hours: Math.max(...responseTimes),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'contact_id,user_id' }
  );
}

/**
 * Get contact response pattern
 */
export async function getContactPattern(contactId: string, userId: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('contact_email_patterns')
    .select('*')
    .eq('contact_id', contactId)
    .eq('user_id', userId)
    .single();

  return data;
}
