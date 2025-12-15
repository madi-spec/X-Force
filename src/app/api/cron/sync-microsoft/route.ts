import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncEmails } from '@/lib/microsoft/emailSync';
import { syncCalendarEvents } from '@/lib/microsoft/calendarSync';

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

  const supabase = await createClient();

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
    errors: string[];
  }> = [];

  // Sync each user's data
  for (const connection of connections) {
    try {
      const [emailResult, calendarResult] = await Promise.all([
        syncEmails(connection.user_id),
        syncCalendarEvents(connection.user_id),
      ]);

      results.push({
        userId: connection.user_id,
        emailsImported: emailResult.imported,
        eventsImported: calendarResult.imported,
        errors: [...emailResult.errors, ...calendarResult.errors],
      });
    } catch (err) {
      console.error(`Sync failed for user ${connection.user_id}:`, err);
      results.push({
        userId: connection.user_id,
        emailsImported: 0,
        eventsImported: 0,
        errors: [`Sync failed: ${err}`],
      });
    }
  }

  const totalEmails = results.reduce((sum, r) => sum + r.emailsImported, 0);
  const totalEvents = results.reduce((sum, r) => sum + r.eventsImported, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`Microsoft sync completed: ${totalEmails} emails, ${totalEvents} events, ${totalErrors} errors`);

  return NextResponse.json({
    success: true,
    synced: connections.length,
    totalEmailsImported: totalEmails,
    totalEventsImported: totalEvents,
    totalErrors,
    details: results,
  });
}
