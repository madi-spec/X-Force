/**
 * Communication Hub Sync Cron
 *
 * Catches up any emails or transcripts that weren't synced to the communications table.
 * Runs hourly to ensure data consistency.
 *
 * GET /api/cron/sync-communications
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEmailToCommunication } from '@/lib/communicationHub/sync/syncEmail';
import { syncTranscriptToCommunication } from '@/lib/communicationHub/sync/syncTranscript';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const supabase = createAdminClient();

  // Check for optional auth header (for Vercel cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow unauthenticated in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = {
    emailsSynced: 0,
    emailsSkipped: 0,
    emailErrors: 0,
    transcriptsSynced: 0,
    transcriptsSkipped: 0,
    transcriptErrors: 0,
  };

  try {
    // Find emails from last 24 hours not yet in communications
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get email IDs that are NOT in communications
    const { data: allEmails } = await supabase
      .from('email_messages')
      .select('id')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: true });

    if (allEmails && allEmails.length > 0) {
      // Get synced email IDs
      const { data: syncedEmails } = await supabase
        .from('communications')
        .select('source_id')
        .eq('source_table', 'email_messages')
        .in('source_id', allEmails.map((e) => e.id));

      const syncedIds = new Set((syncedEmails || []).map((s) => s.source_id));

      // Sync unsynced emails
      for (const email of allEmails) {
        if (syncedIds.has(email.id)) {
          results.emailsSkipped++;
          continue;
        }

        try {
          const result = await syncEmailToCommunication(email.id);
          if (result) {
            results.emailsSynced++;
          } else {
            results.emailErrors++;
          }
        } catch (err) {
          console.error(`[SyncCron] Error syncing email ${email.id}:`, err);
          results.emailErrors++;
        }
      }
    }

    // Find transcripts from last 24 hours not yet in communications
    const { data: allTranscripts } = await supabase
      .from('meeting_transcriptions')
      .select('id')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: true });

    if (allTranscripts && allTranscripts.length > 0) {
      // Get synced transcript IDs
      const { data: syncedTranscripts } = await supabase
        .from('communications')
        .select('source_id')
        .eq('source_table', 'meeting_transcriptions')
        .in('source_id', allTranscripts.map((t) => t.id));

      const syncedIds = new Set((syncedTranscripts || []).map((s) => s.source_id));

      // Sync unsynced transcripts
      for (const transcript of allTranscripts) {
        if (syncedIds.has(transcript.id)) {
          results.transcriptsSkipped++;
          continue;
        }

        try {
          const result = await syncTranscriptToCommunication(transcript.id);
          if (result) {
            results.transcriptsSynced++;
          } else {
            results.transcriptErrors++;
          }
        } catch (err) {
          console.error(`[SyncCron] Error syncing transcript ${transcript.id}:`, err);
          results.transcriptErrors++;
        }
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      ...results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SyncCron] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration: `${Date.now() - startTime}ms`,
        ...results,
      },
      { status: 500 }
    );
  }
}
