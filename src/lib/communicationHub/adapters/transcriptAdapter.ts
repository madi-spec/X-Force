/**
 * Transcript Adapter for Communication Hub
 *
 * Converts meeting_transcriptions to communications format
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Communication } from '@/types/communicationHub';

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
  company_product_id: string | null;
  user_id: string | null;
}

interface Attendee {
  name?: string;
  email?: string;
  title?: string;
  role?: string;
  is_internal?: boolean;
}

export function transcriptToCommunication(transcript: MeetingTranscription): Partial<Communication> {
  // Parse attendees into our/their
  const attendees = (transcript.attendees || []) as Attendee[];
  const ourParticipants = attendees
    .filter((a) => a.is_internal)
    .map((a) => ({ name: a.name || '', email: a.email, role: a.role || 'attendee' }));
  const theirParticipants = attendees
    .filter((a) => !a.is_internal)
    .map((a) => ({ name: a.name || '', email: a.email, title: a.title }));

  // Calculate duration in seconds (prefer duration_seconds, fallback to minutes * 60)
  const durationSeconds = transcript.duration_seconds
    || (transcript.duration_minutes ? transcript.duration_minutes * 60 : null);

  return {
    // Channel
    channel: 'meeting',
    direction: 'internal',  // Meetings are bidirectional

    // Timing
    occurred_at: transcript.meeting_date || new Date().toISOString(),
    duration_seconds: durationSeconds,

    // Content
    subject: transcript.title,
    content_preview: transcript.summary?.substring(0, 500) || null,
    full_content: transcript.transcript_text,
    recording_url: transcript.video_url || transcript.audio_url,

    // Participants
    our_participants: ourParticipants,
    their_participants: theirParticipants,

    // Source
    source_table: 'meeting_transcriptions',
    source_id: transcript.id,
    external_id: transcript.fireflies_id,

    // Response state (meetings don't wait for response)
    awaiting_our_response: false,
    awaiting_their_response: false,

    // Relationships
    company_id: transcript.company_id,
    contact_id: transcript.contact_id,
    deal_id: transcript.deal_id,
    user_id: transcript.user_id,

    // AI
    is_ai_generated: false,

    // Analysis pending
    analysis_status: 'pending',
  };
}

export async function syncTranscriptToCommunications(transcriptId: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Fetch transcript
  const { data: transcript, error: transcriptError } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('id', transcriptId)
    .single();

  if (transcriptError || !transcript) {
    console.error(`[TranscriptAdapter] Transcript not found: ${transcriptId}`, transcriptError);
    return null;
  }

  // Check if already synced
  const { data: existing } = await supabase
    .from('communications')
    .select('id')
    .eq('source_table', 'meeting_transcriptions')
    .eq('source_id', transcriptId)
    .single();

  if (existing) {
    return existing.id;
  }

  // Convert and insert
  const communication = transcriptToCommunication(transcript as MeetingTranscription);

  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();

  if (insertError) {
    console.error(`[TranscriptAdapter] Failed to insert communication:`, insertError);
    return null;
  }

  console.log(`[TranscriptAdapter] Synced transcript ${transcriptId} → communication ${inserted.id}`);
  return inserted.id;
}

export async function syncAllTranscriptsToCommunications(
  options?: { limit?: number; since?: string }
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from('meeting_transcriptions')
    .select('id')
    .order('meeting_date', { ascending: true });

  if (options?.since) {
    query = query.gte('meeting_date', options.since);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: transcripts, error } = await query;

  if (error || !transcripts) {
    console.error('[TranscriptAdapter] Failed to fetch transcripts:', error);
    return { synced: 0, errors: 1 };
  }

  let synced = 0;
  let errors = 0;

  for (const transcript of transcripts) {
    const result = await syncTranscriptToCommunications(transcript.id);
    if (result) {
      synced++;
    } else {
      errors++;
    }
  }

  console.log(`[TranscriptAdapter] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}
