/**
 * Email Adapter for Communication Hub
 *
 * Converts email_messages to communications format
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Communication } from '@/types/communicationHub';
import { classifyEmailNoise } from '@/lib/email/noiseDetection';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';

interface EmailMessage {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  to_names: (string | null)[] | null;
  body_text: string | null;
  body_html: string | null;
  body_preview: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_sent_by_user: boolean;
  conversation_ref: string | null;
  message_id: string | null;
  has_attachments: boolean;
  user_id: string | null;
}

export function emailToCommunication(email: EmailMessage): Partial<Communication> {
  const isOutbound = email.is_sent_by_user;

  // Build participants arrays
  const toParticipants = (email.to_emails || []).map((toEmail, i) => ({
    email: toEmail || '',
    name: email.to_names?.[i] || '',
  }));

  const fromParticipant = {
    email: email.from_email || '',
    name: email.from_name || '',
  };

  // Check for noise emails (AI notetakers, etc.) - these don't need response
  const noiseClassification = !isOutbound
    ? classifyEmailNoise(email.from_email, email.subject, email.body_preview)
    : null;

  const isNoiseEmail = noiseClassification?.autoProcess ?? false;

  // Noise emails are auto-processed: no response needed, already "responded"
  const awaitingOurResponse = !isOutbound && !isNoiseEmail;
  const respondedAt = isNoiseEmail ? new Date().toISOString() : null;

  return {
    // Channel
    channel: 'email',
    direction: isOutbound ? 'outbound' : 'inbound',

    // Timing
    occurred_at: email.received_at || email.sent_at || new Date().toISOString(),

    // Content
    subject: email.subject,
    content_preview: email.body_preview || email.body_text?.substring(0, 500) || null,
    full_content: email.body_text,
    content_html: email.body_html,
    attachments: email.has_attachments ? [{ name: 'attachment', type: 'unknown', size: 0, url: '' }] : [],

    // Participants - properly handle arrays
    our_participants: isOutbound
      ? [{ ...fromParticipant, role: 'sender' }]
      : toParticipants.map(p => ({ ...p, role: 'recipient' as const })),
    their_participants: isOutbound
      ? toParticipants
      : [fromParticipant],

    // Source
    source_table: 'email_messages',
    source_id: email.id,
    external_id: email.message_id,
    thread_id: email.conversation_ref,

    // Response state
    // Noise emails (AI notetakers) are auto-processed and don't need response
    awaiting_our_response: awaitingOurResponse,
    awaiting_their_response: isOutbound,
    response_sla_minutes: awaitingOurResponse ? 240 : null,  // 4 hour default SLA for inbound
    response_due_by: awaitingOurResponse
      ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      : null,
    responded_at: respondedAt,

    // Relationships - email_messages doesn't have these columns
    company_id: null,
    contact_id: null,
    deal_id: null,
    user_id: email.user_id,

    // AI
    is_ai_generated: false,

    // Noise emails are pre-classified
    analysis_status: isNoiseEmail ? 'complete' : 'pending',
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

  // Check if this is an auto-processed noise email
  const noiseCheck = classifyEmailNoise(email.from_email, email.subject, email.body_preview);

  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();

  if (insertError) {
    console.error(`[EmailAdapter] Failed to insert communication:`, insertError);
    return null;
  }

  if (noiseCheck.autoProcess) {
    console.log(`[EmailAdapter] Auto-processed ${noiseCheck.noiseType}: ${email.from_email} → ${inserted.id} (${noiseCheck.reason})`);

    // Tag the email in Outlook with X-FORCE category
    if (email.message_id) {
      try {
        // Get Microsoft connection for this user
        const { data: msConnection } = await supabase
          .from('microsoft_connections')
          .select('user_id')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (msConnection) {
          const token = await getValidToken(msConnection.user_id);
          if (token) {
            const graphClient = new MicrosoftGraphClient(token);
            await graphClient.addCategoryToMessage(email.message_id, 'X-FORCE');
            console.log(`[EmailAdapter] Tagged notetaker email in Outlook: ${email.message_id}`);
          }
        }
      } catch (tagError) {
        // Non-critical, just log
        console.warn(`[EmailAdapter] Could not tag email in Outlook:`, tagError);
      }
    }
  } else {
    console.log(`[EmailAdapter] Synced email ${emailId} → communication ${inserted.id}`);
  }
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
