/**
 * Transcript Sync for Communication Hub
 *
 * Syncs transcripts from meeting_transcriptions to communications table
 * and triggers analysis.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { syncTranscriptToCommunications } from '../adapters/transcriptAdapter';
import { analyzeCommunication } from '../analysis/analyzeCommunication';

/**
 * Sync a single transcript to communications and trigger analysis
 */
export async function syncTranscriptToCommunication(transcriptId: string): Promise<string | null> {
  try {
    // Sync to communications table
    const communicationId = await syncTranscriptToCommunications(transcriptId);

    if (!communicationId) {
      console.log(`[TranscriptSync] Failed to sync transcript ${transcriptId}`);
      return null;
    }

    console.log(`[TranscriptSync] Synced transcript ${transcriptId} → communication ${communicationId}`);

    // Trigger analysis in background (don't block)
    triggerAnalysis(communicationId).catch((err) => {
      console.error(`[TranscriptSync] Analysis failed for ${communicationId}:`, err);
    });

    return communicationId;
  } catch (error) {
    console.error(`[TranscriptSync] Error syncing transcript ${transcriptId}:`, error);
    return null;
  }
}

/**
 * Sync all recent transcripts to communications
 */
export async function syncRecentTranscriptsToCommunications(
  options?: { since?: string; limit?: number }
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();
  const since = options?.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = options?.limit || 100;

  // Find transcripts not yet synced
  const { data: transcripts, error } = await supabase
    .from('meeting_transcriptions')
    .select('id')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !transcripts) {
    console.error('[TranscriptSync] Failed to fetch transcripts:', error);
    return { synced: 0, errors: 1 };
  }

  let synced = 0;
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
      continue; // Already synced
    }

    const result = await syncTranscriptToCommunication(transcript.id);
    if (result) {
      synced++;
    } else {
      errors++;
    }
  }

  console.log(`[TranscriptSync] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Trigger analysis for a communication (non-blocking)
 */
async function triggerAnalysis(communicationId: string): Promise<void> {
  try {
    // Run analysis directly
    await analyzeCommunication(communicationId);
    console.log(`[TranscriptSync] Analysis complete for ${communicationId}`);
  } catch (error) {
    console.error(`[TranscriptSync] Analysis failed:`, error);
    // Don't throw - we don't want to fail the sync just because analysis failed
  }
}
