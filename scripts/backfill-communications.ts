/**
 * Communication Hub Backfill Script
 *
 * Syncs existing emails and transcripts to the communications table.
 *
 * Usage: npx ts-node scripts/backfill-communications.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

interface MeetingTranscription {
  id: string;
  title: string | null;
  meeting_date: string | null;
  duration_seconds: number | null;
  duration_minutes: number | null;
  summary: string | null;
  transcript_text: string | null;
  video_url: string | null;
  audio_url: string | null;
  fireflies_id: string | null;
  attendees: unknown[];
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;
}

function emailToCommunication(email: EmailMessage) {
  const isOutbound = email.is_sent_by_user;

  return {
    channel: 'email',
    direction: isOutbound ? 'outbound' : 'inbound',
    occurred_at: email.received_at || email.sent_at || new Date().toISOString(),
    subject: email.subject,
    content_preview: email.body_text?.substring(0, 500) || null,
    full_content: email.body_text,
    content_html: email.body_html,
    attachments: email.attachments || [],
    our_participants: isOutbound
      ? [{ email: email.from_email || '', name: email.from_name || '', role: 'sender' }]
      : [{ email: email.to_email || '', name: email.to_name || '', role: 'recipient' }],
    their_participants: isOutbound
      ? [{ email: email.to_email || '', name: email.to_name || '' }]
      : [{ email: email.from_email || '', name: email.from_name || '' }],
    source_table: 'email_messages',
    source_id: email.id,
    external_id: email.message_id,
    thread_id: email.conversation_id,
    awaiting_our_response: !isOutbound,
    awaiting_their_response: isOutbound,
    response_sla_minutes: !isOutbound ? 240 : null,
    response_due_by: !isOutbound
      ? new Date(new Date(email.received_at || email.sent_at || Date.now()).getTime() + 4 * 60 * 60 * 1000).toISOString()
      : null,
    company_id: email.company_id,
    contact_id: email.contact_id,
    deal_id: email.deal_id,
    user_id: email.user_id,
    is_ai_generated: false,
    analysis_status: 'pending',
  };
}

function transcriptToCommunication(transcript: MeetingTranscription) {
  const attendees = (transcript.attendees || []) as Array<{ name?: string; email?: string; title?: string; role?: string; is_internal?: boolean }>;
  const ourParticipants = attendees
    .filter((a) => a.is_internal)
    .map((a) => ({ name: a.name || '', email: a.email, role: a.role || 'attendee' }));
  const theirParticipants = attendees
    .filter((a) => !a.is_internal)
    .map((a) => ({ name: a.name || '', email: a.email, title: a.title }));

  const durationSeconds = transcript.duration_seconds
    || (transcript.duration_minutes ? transcript.duration_minutes * 60 : null);

  return {
    channel: 'meeting',
    direction: 'internal',
    occurred_at: transcript.meeting_date || new Date().toISOString(),
    duration_seconds: durationSeconds,
    subject: transcript.title,
    content_preview: transcript.summary?.substring(0, 500) || null,
    full_content: transcript.transcript_text,
    recording_url: transcript.video_url || transcript.audio_url,
    our_participants: ourParticipants,
    their_participants: theirParticipants,
    source_table: 'meeting_transcriptions',
    source_id: transcript.id,
    external_id: transcript.fireflies_id,
    awaiting_our_response: false,
    awaiting_their_response: false,
    company_id: transcript.company_id,
    contact_id: transcript.contact_id,
    deal_id: transcript.deal_id,
    user_id: transcript.user_id,
    is_ai_generated: false,
    analysis_status: 'pending',
  };
}

async function syncEmails(): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log('Fetching emails...');
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('*')
    .order('received_at', { ascending: true });

  if (error || !emails) {
    console.error('Failed to fetch emails:', error);
    return { synced: 0, skipped: 0, errors: 1 };
  }

  console.log(`Found ${emails.length} emails`);
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const email of emails) {
    // Check if already synced
    const { data: existing } = await supabase
      .from('communications')
      .select('id')
      .eq('source_table', 'email_messages')
      .eq('source_id', email.id)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const communication = emailToCommunication(email as EmailMessage);
    const { error: insertError } = await supabase
      .from('communications')
      .insert(communication);

    if (insertError) {
      console.error(`Failed to sync email ${email.id}:`, insertError.message);
      errors++;
    } else {
      synced++;
    }
  }

  return { synced, skipped, errors };
}

async function syncTranscripts(): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log('Fetching transcripts...');
  const { data: transcripts, error } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .order('meeting_date', { ascending: true });

  if (error || !transcripts) {
    console.error('Failed to fetch transcripts:', error);
    return { synced: 0, skipped: 0, errors: 1 };
  }

  console.log(`Found ${transcripts.length} transcripts`);
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const transcript of transcripts) {
    // Check if already synced
    const { data: existing } = await supabase
      .from('communications')
      .select('id')
      .eq('source_table', 'meeting_transcriptions')
      .eq('source_id', transcript.id)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const communication = transcriptToCommunication(transcript as MeetingTranscription);
    const { error: insertError } = await supabase
      .from('communications')
      .insert(communication);

    if (insertError) {
      console.error(`Failed to sync transcript ${transcript.id}:`, insertError.message);
      errors++;
    } else {
      synced++;
    }
  }

  return { synced, skipped, errors };
}

async function main() {
  console.log('Starting Communication Hub backfill...\n');

  // Sync emails
  console.log('=== Backfilling Emails ===');
  const emailResult = await syncEmails();
  console.log(`Emails: ${emailResult.synced} synced, ${emailResult.skipped} skipped, ${emailResult.errors} errors\n`);

  // Sync transcripts
  console.log('=== Backfilling Transcripts ===');
  const transcriptResult = await syncTranscripts();
  console.log(`Transcripts: ${transcriptResult.synced} synced, ${transcriptResult.skipped} skipped, ${transcriptResult.errors} errors\n`);

  // Verify
  console.log('=== Verification ===');
  const { data: channelData } = await supabase
    .from('communications')
    .select('channel');

  const channelCounts: Record<string, number> = {};
  for (const row of channelData || []) {
    channelCounts[row.channel] = (channelCounts[row.channel] || 0) + 1;
  }

  console.log('Communications by channel:');
  for (const [channel, count] of Object.entries(channelCounts)) {
    console.log(`  ${channel}: ${count}`);
  }

  const { count: awaitingCount } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true })
    .eq('awaiting_our_response', true);

  console.log(`\nAwaiting our response: ${awaitingCount || 0}`);

  console.log('\n=== Backfill Complete ===');
  console.log(`Total synced: ${emailResult.synced + transcriptResult.synced}`);
  console.log(`Total skipped: ${emailResult.skipped + transcriptResult.skipped}`);
  console.log(`Total errors: ${emailResult.errors + transcriptResult.errors}`);
}

main().catch(console.error);
