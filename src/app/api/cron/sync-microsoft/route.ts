import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEmails } from '@/lib/microsoft/emailSync';
import { syncCalendarEvents } from '@/lib/microsoft/calendarSync';
import { processUnanalyzedEmails } from '@/lib/email';

/**
 * Background cron job to sync Microsoft 365 data for all active connections
 * GET /api/cron/sync-microsoft
 *
 * This endpoint should be called by a cron job (e.g., Vercel Cron)
 * Protected by CRON_SECRET environment variable
 */
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  // Get all active Microsoft connections
  const { data: connections, error } = await supabase
    .from('microsoft_connections')
    .select('user_id')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No active connections to sync',
      synced: 0,
    });
  }

  const results: Array<{
    userId: string;
    emailsImported: number;
    eventsImported: number;
    emailsAnalyzed: number;
    errors: string[];
  }> = [];

  // Sync each user's data
  for (const connection of connections) {
    try {
      const [emailResult, calendarResult] = await Promise.all([
        syncEmails(connection.user_id),
        syncCalendarEvents(connection.user_id),
      ]);

      // Run AI analysis on newly synced emails (limit to 5 per user to avoid timeout)
      let emailsAnalyzed = 0;
      if (emailResult.imported > 0) {
        try {
          const analysisResult = await processUnanalyzedEmails(connection.user_id, 5);
          emailsAnalyzed = analysisResult.itemsCreated;
        } catch (analysisErr) {
          console.error(`Email analysis failed for user ${connection.user_id}:`, analysisErr);
        }
      }

      results.push({
        userId: connection.user_id,
        emailsImported: emailResult.imported,
        eventsImported: calendarResult.imported,
        emailsAnalyzed,
        errors: [...emailResult.errors, ...calendarResult.errors],
      });
    } catch (err) {
      console.error(`Sync failed for user ${connection.user_id}:`, err);
      results.push({
        userId: connection.user_id,
        emailsImported: 0,
        eventsImported: 0,
        emailsAnalyzed: 0,
        errors: [`Sync failed: ${err}`],
      });
    }
  }

  const totalEmails = results.reduce((sum, r) => sum + r.emailsImported, 0);
  const totalEvents = results.reduce((sum, r) => sum + r.eventsImported, 0);
  const totalAnalyzed = results.reduce((sum, r) => sum + r.emailsAnalyzed, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`Microsoft sync completed: ${totalEmails} emails, ${totalEvents} events, ${totalAnalyzed} analyzed, ${totalErrors} errors`);

  return NextResponse.json({
    success: true,
    synced: connections.length,
    totalEmailsImported: totalEmails,
    totalEventsImported: totalEvents,
    totalEmailsAnalyzed: totalAnalyzed,
    totalErrors,
    details: results,
  });
}
