/**
 * Email Adapter for Communication Hub
 *
 * Converts email_messages to communications format
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Communication } from '@/types/communicationHub';

interface EmailMessage {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  to_name: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_sent_by_user: boolean;
  conversation_id: string | null;
  message_id: string | null;
  attachments: unknown[];
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;
}

export function emailToCommunication(email: EmailMessage): Partial<Communication> {
  const isOutbound = email.is_sent_by_user;

  return {
    // Channel
    channel: 'email',
    direction: isOutbound ? 'outbound' : 'inbound',

    // Timing
    occurred_at: email.received_at || email.sent_at || new Date().toISOString(),

    // Content
    subject: email.subject,
    content_preview: email.body_text?.substring(0, 500) || null,
    full_content: email.body_text,
    content_html: email.body_html,
    attachments: (email.attachments || []) as Communication['attachments'],

    // Participants
    our_participants: isOutbound
      ? [{ email: email.from_email || '', name: email.from_name || '', role: 'sender' }]
      : [{ email: email.to_email || '', name: email.to_name || '', role: 'recipient' }],
    their_participants: isOutbound
      ? [{ email: email.to_email || '', name: email.to_name || '' }]
      : [{ email: email.from_email || '', name: email.from_name || '' }],

    // Source
    source_table: 'email_messages',
    source_id: email.id,
    external_id: email.message_id,
    thread_id: email.conversation_id,

    // Response state (inbound = awaiting our response)
    awaiting_our_response: !isOutbound,
    awaiting_their_response: isOutbound,
    response_sla_minutes: !isOutbound ? 240 : null,  // 4 hour default SLA for inbound
    response_due_by: !isOutbound
      ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      : null,

    // Relationships
    company_id: email.company_id,
    contact_id: email.contact_id,
    deal_id: email.deal_id,
    user_id: email.user_id,

    // AI
    is_ai_generated: false,

    // Analysis pending
    analysis_status: 'pending',
  };
}

export async function syncEmailToCommunications(emailId: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Fetch email
  const { data: email, error: emailError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();

  if (emailError || !email) {
    console.error(`[EmailAdapter] Email not found: ${emailId}`, emailError);
    return null;
  }

  // Check if already synced
  const { data: existing } = await supabase
    .from('communications')
    .select('id')
    .eq('source_table', 'email_messages')
    .eq('source_id', emailId)
    .single();

  if (existing) {
    return existing.id;
  }

  // Convert and insert
  const communication = emailToCommunication(email as EmailMessage);

  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();

  if (insertError) {
    console.error(`[EmailAdapter] Failed to insert communication:`, insertError);
    return null;
  }

  console.log(`[EmailAdapter] Synced email ${emailId} → communication ${inserted.id}`);
  return inserted.id;
}

export async function syncAllEmailsToCommunications(
  options?: { limit?: number; since?: string }
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from('email_messages')
    .select('id')
    .order('received_at', { ascending: true });

  if (options?.since) {
    query = query.gte('received_at', options.since);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: emails, error } = await query;

  if (error || !emails) {
    console.error('[EmailAdapter] Failed to fetch emails:', error);
    return { synced: 0, errors: 1 };
  }

  let synced = 0;
  let errors = 0;

  for (const email of emails) {
    const result = await syncEmailToCommunications(email.id);
    if (result) {
      synced++;
    } else {
      errors++;
    }
  }

  console.log(`[EmailAdapter] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}
