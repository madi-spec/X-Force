/**
 * Pipeline 2: Detect Inbound Emails (Tier 1)
 *
 * Scans new inbound email messages for Tier 1 triggers:
 * - Demo requests (SLA: 15 min)
 * - Pricing inquiries (SLA: 2 hours)
 * - Meeting requests (SLA: 30 min)
 * - Direct questions (SLA: 4 hours)
 *
 * Creates command center items with appropriate SLA tracking.
 */

import { createClient } from '@/lib/supabase/server';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';

// Tier 1 trigger definitions with keywords and SLAs
const TIER1_TRIGGERS: {
  trigger: TierTrigger;
  keywords: string[];
  slaMinutes: number;
  actionType: string;
  titlePrefix: string;
}[] = [
  {
    trigger: 'demo_request',
    keywords: ['demo', 'demonstration', 'trial', 'see it in action', 'show me', 'see a demo', 'schedule a demo', 'book a demo'],
    slaMinutes: 15,
    actionType: 'call',
    titlePrefix: 'Demo request from',
  },
  {
    trigger: 'pricing_request',
    keywords: ['pricing', 'price', 'cost', 'quote', 'proposal', 'how much', 'what does it cost', 'budget'],
    slaMinutes: 120,
    actionType: 'email_respond',
    titlePrefix: 'Pricing inquiry from',
  },
  {
    trigger: 'meeting_request',
    keywords: ['meet', 'meeting', 'schedule', 'calendar', 'call', 'chat', 'discuss', 'connect', 'touch base'],
    slaMinutes: 30,
    actionType: 'email_respond',
    titlePrefix: 'Meeting request from',
  },
  {
    trigger: 'direct_question',
    keywords: ['?'],
    slaMinutes: 240,
    actionType: 'email_respond',
    titlePrefix: 'Question from',
  },
];

interface EmailMessage {
  id: string;
  user_id: string;
  conversation_ref: string;
  subject: string | null;
  body_text: string | null;
  body_preview: string | null;
  from_email: string;
  from_name: string | null;
  received_at: string;
  is_sent_by_user: boolean;
}

interface EmailConversation {
  id: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
}

interface PipelineResult {
  messagesProcessed: number;
  itemsCreated: number;
  byTrigger: Record<string, number>;
  errors: string[];
}

/**
 * Detect which Tier 1 trigger matches this email
 */
function detectTrigger(
  subject: string | null,
  body: string | null
): (typeof TIER1_TRIGGERS)[0] | null {
  const text = `${subject || ''} ${body || ''}`.toLowerCase();

  // Check triggers in priority order (demo first, question last)
  for (const trigger of TIER1_TRIGGERS) {
    // Skip "direct_question" unless explicitly a question
    if (trigger.trigger === 'direct_question') {
      // Only trigger if there's actually a question mark in the text
      if (text.includes('?')) {
        return trigger;
      }
      continue;
    }

    for (const keyword of trigger.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return trigger;
      }
    }
  }

  return null;
}

/**
 * Calculate SLA breach time
 */
function calculateSlaDueAt(receivedAt: string, slaMinutes: number): string {
  const received = new Date(receivedAt);
  received.setMinutes(received.getMinutes() + slaMinutes);
  return received.toISOString();
}

/**
 * Generate "why now" text based on trigger and timing
 */
function generateWhyNow(
  trigger: (typeof TIER1_TRIGGERS)[0],
  fromName: string | null,
  receivedAt: string
): string {
  const received = new Date(receivedAt);
  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - received.getTime()) / (1000 * 60));

  const name = fromName || 'They';
  const timeAgo =
    minutesAgo < 60
      ? `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`
      : `${Math.floor(minutesAgo / 60)} hour${Math.floor(minutesAgo / 60) !== 1 ? 's' : ''} ago`;

  switch (trigger.trigger) {
    case 'demo_request':
      return `${name} asked for a demo ${timeAgo}.`;
    case 'pricing_request':
      return `${name} asked about pricing ${timeAgo}.`;
    case 'meeting_request':
      return `${name} wants to schedule a call ${timeAgo}.`;
    case 'direct_question':
      return `${name} sent a question ${timeAgo}.`;
    default:
      return `${name} reached out ${timeAgo}.`;
  }
}

/**
 * Check if a CC item already exists for this message
 */
async function itemExists(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  conversationId: string,
  trigger: string
): Promise<boolean> {
  const { data } = await supabase
    .from('command_center_items')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('tier', 1)
    .eq('tier_trigger', trigger)
    .eq('status', 'pending')
    .single();

  return !!data;
}

/**
 * Main pipeline function: Process new inbound emails
 */
export async function detectInboundEmails(userId?: string): Promise<PipelineResult> {
  const supabase = await createClient();
  const result: PipelineResult = {
    messagesProcessed: 0,
    itemsCreated: 0,
    byTrigger: {},
    errors: [],
  };

  // Query for unprocessed inbound messages
  let query = supabase
    .from('email_messages')
    .select(`
      id,
      user_id,
      conversation_ref,
      subject,
      body_text,
      body_preview,
      from_email,
      from_name,
      received_at,
      is_sent_by_user
    `)
    .eq('processed_for_cc', false)
    .eq('is_sent_by_user', false)
    .order('received_at', { ascending: false })
    .limit(100);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: messages, error } = await query;

  if (error) {
    result.errors.push(`Query error: ${error.message}`);
    return result;
  }

  if (!messages || messages.length === 0) {
    return result;
  }

  // Get conversation details for linking
  const conversationIds = [...new Set(messages.map((m) => m.conversation_ref).filter(Boolean))];
  const { data: conversations } = await supabase
    .from('email_conversations')
    .select('id, deal_id, company_id, contact_id')
    .in('id', conversationIds);

  const conversationMap = new Map<string, EmailConversation>();
  for (const conv of conversations || []) {
    conversationMap.set(conv.id, conv);
  }

  for (const message of messages as EmailMessage[]) {
    try {
      result.messagesProcessed++;

      // Detect trigger
      const trigger = detectTrigger(message.subject, message.body_text || message.body_preview);

      if (trigger) {
        // Check if item already exists
        const exists = await itemExists(supabase, message.conversation_ref, trigger.trigger);

        if (!exists) {
          const conv = conversationMap.get(message.conversation_ref);
          const now = new Date().toISOString();
          const fromName = message.from_name || message.from_email.split('@')[0];

          await supabase.from('command_center_items').insert({
            user_id: message.user_id,
            conversation_id: message.conversation_ref,
            deal_id: conv?.deal_id || null,
            company_id: conv?.company_id || null,
            contact_id: conv?.contact_id || null,
            action_type: trigger.actionType,
            title: `${trigger.titlePrefix} ${fromName}`,
            description: message.subject || 'Email response needed',
            why_now: generateWhyNow(trigger, message.from_name, message.received_at),
            tier: 1 as PriorityTier,
            tier_trigger: trigger.trigger,
            sla_minutes: trigger.slaMinutes,
            sla_status: 'on_track',
            received_at: message.received_at,
            due_at: calculateSlaDueAt(message.received_at, trigger.slaMinutes),
            target_name: fromName,
            status: 'pending',
            source: 'email_sync',
            created_at: now,
            updated_at: now,
          });

          result.itemsCreated++;
          result.byTrigger[trigger.trigger] = (result.byTrigger[trigger.trigger] || 0) + 1;
        }
      }

      // Mark message as processed
      await supabase
        .from('email_messages')
        .update({
          processed_for_cc: true,
          cc_processed_at: new Date().toISOString(),
        })
        .eq('id', message.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Message ${message.id}: ${errorMsg}`);
    }
  }

  return result;
}

export default detectInboundEmails;
