/**
 * Fireflies Webhook Endpoint
 *
 * Receives notifications from Fireflies.ai when:
 * - New transcript is available
 * - Transcript processing is complete
 *
 * POST /api/webhooks/fireflies
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncFirefliesTranscripts } from '@/lib/fireflies';
import { processSingleTranscript } from '@/lib/pipelines';
import { analyzeMeetingTranscription } from '@/lib/ai/meetingAnalysisService';
import { FirefliesClient } from '@/lib/fireflies/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface FirefliesWebhookPayload {
  event: 'transcription.complete' | 'transcription.ready' | string;
  meeting_id?: string;
  transcript_id?: string;
  data?: {
    id?: string;
    title?: string;
    organizer_email?: string;
  };
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const payload: FirefliesWebhookPayload = await request.json();

    console.log('[Fireflies Webhook] Received:', {
      event: payload.event,
      meeting_id: payload.meeting_id,
      transcript_id: payload.transcript_id,
    });

    // Get the transcript ID from various possible fields
    const transcriptId = payload.transcript_id || payload.meeting_id || payload.data?.id;

    if (!transcriptId) {
      console.log('[Fireflies Webhook] No transcript ID in payload, triggering full sync');
      // Trigger sync for all active connections
      return await triggerFullSync();
    }

    // Find which user this transcript belongs to by checking connections
    const supabase = createAdminClient();

    // Try to find existing transcript
    const firefliesId = `fireflies_${transcriptId}`;
    const { data: existingTranscript } = await supabase
      .from('meeting_transcriptions')
      .select('id, user_id, analysis')
      .eq('external_id', firefliesId)
      .single();

    if (existingTranscript) {
      // Transcript already exists - maybe re-analyze or process for CC
      console.log('[Fireflies Webhook] Transcript exists:', existingTranscript.id);

      // If analysis exists but CC items not created, process them
      if (existingTranscript.analysis) {
        const ccResult = await processSingleTranscript(existingTranscript.id);
        return NextResponse.json({
          success: true,
          action: 'processed_existing',
          transcriptId: existingTranscript.id,
          ccItemsCreated: ccResult.itemsCreated,
          duration: `${Date.now() - startTime}ms`,
        });
      }

      return NextResponse.json({
        success: true,
        action: 'already_exists',
        transcriptId: existingTranscript.id,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Transcript doesn't exist - need to sync it
    // Find user by organizer email if available
    let userId: string | null = null;

    if (payload.data?.organizer_email) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', payload.data.organizer_email)
        .single();

      if (user) {
        userId = user.id;
      }
    }

    // If we found a user, sync their transcripts
    if (userId) {
      const result = await syncFirefliesTranscripts(userId);
      return NextResponse.json({
        success: true,
        action: 'synced_user',
        userId,
        transcriptsSynced: result.synced,
        ccItemsCreated: result.ccItemsCreated,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // No user found, trigger sync for all connections
    console.log('[Fireflies Webhook] No user found, triggering full sync');
    return await triggerFullSync();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Fireflies Webhook] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

async function triggerFullSync(): Promise<NextResponse> {
  const supabase = createAdminClient();

  const { data: connections } = await supabase
    .from('fireflies_connections')
    .select('user_id')
    .eq('is_active', true);

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      success: true,
      action: 'no_connections',
      message: 'No active Fireflies connections',
    });
  }

  let totalSynced = 0;
  let totalCCItems = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    try {
      const result = await syncFirefliesTranscripts(conn.user_id);
      totalSynced += result.synced;
      totalCCItems += result.ccItemsCreated;
      errors.push(...result.errors);
    } catch (err) {
      errors.push(`User ${conn.user_id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({
    success: true,
    action: 'full_sync',
    usersProcessed: connections.length,
    totalSynced,
    totalCCItems,
    errorCount: errors.length,
  });
}

/**
 * GET handler for webhook verification (some services require this)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('challenge');

  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    status: 'ok',
    endpoint: 'fireflies-webhook',
    timestamp: new Date().toISOString(),
  });
}
