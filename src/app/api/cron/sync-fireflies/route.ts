import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncFirefliesTranscripts } from '@/lib/fireflies';

/**
 * Background cron job to sync Fireflies transcripts for all active connections
 * GET /api/cron/sync-fireflies
 *
 * This endpoint should be called by a cron job (e.g., Vercel Cron)
 * Protected by CRON_SECRET environment variable
 *
 * Runs every 30 minutes via vercel.json cron configuration
 */
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all active Fireflies connections
  const { data: connections, error } = await supabase
    .from('fireflies_connections')
    .select('user_id')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch Fireflies connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No active Fireflies connections to sync',
      synced: 0,
    });
  }

  const results: Array<{
    userId: string;
    transcriptsSynced: number;
    transcriptsAnalyzed: number;
    errors: string[];
  }> = [];

  // Sync each user's transcripts
  for (const connection of connections) {
    try {
      const result = await syncFirefliesTranscripts(connection.user_id);

      results.push({
        userId: connection.user_id,
        transcriptsSynced: result.synced,
        transcriptsAnalyzed: result.analyzed,
        errors: result.errors,
      });
    } catch (err) {
      console.error(`Fireflies sync failed for user ${connection.user_id}:`, err);
      results.push({
        userId: connection.user_id,
        transcriptsSynced: 0,
        transcriptsAnalyzed: 0,
        errors: [`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
      });
    }
  }

  const totalSynced = results.reduce((sum, r) => sum + r.transcriptsSynced, 0);
  const totalAnalyzed = results.reduce((sum, r) => sum + r.transcriptsAnalyzed, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(
    `Fireflies sync completed: ${totalSynced} transcripts synced, ${totalAnalyzed} analyzed, ${totalErrors} errors`
  );

  return NextResponse.json({
    success: true,
    connectionsProcessed: connections.length,
    totalTranscriptsSynced: totalSynced,
    totalTranscriptsAnalyzed: totalAnalyzed,
    totalErrors,
    details: results,
  });
}
