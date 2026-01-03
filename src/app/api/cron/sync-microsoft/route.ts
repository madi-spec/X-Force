import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEmailsDirectToCommunications } from '@/lib/communicationHub';
import { syncCalendarEvents } from '@/lib/microsoft/calendarSync';
import { processSchedulingEmails } from '@/lib/scheduler/responseProcessor';
import { renewExpiringSubscriptions } from '@/app/api/webhooks/microsoft/subscribe/route';
import { logCronStart, logCronSuccess, logCronError } from '@/lib/cron/logging';

// Required for Vercel Cron - extend timeout and ensure fresh execution
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes - Microsoft sync can be slow
export const dynamic = 'force-dynamic';

const JOB_NAME = 'sync-microsoft';

/**
 * Background cron job to sync Microsoft 365 data for all active connections
 * GET /api/cron/sync-microsoft
 *
 * This endpoint should be called by a cron job (e.g., Vercel Cron)
 * Protected by CRON_SECRET environment variable
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const executionId = await logCronStart(JOB_NAME);

  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
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
    emailsMatched: number;
    eventsImported: number;
    schedulingResponsesProcessed: number;
    errors: string[];
  }> = [];

  // Sync each user's data
  for (const connection of connections) {
    try {
      // Use direct Graph → communications sync (consolidated path)
      const [emailResult, calendarResult] = await Promise.all([
        syncEmailsDirectToCommunications(connection.user_id),
        syncCalendarEvents(connection.user_id),
      ]);

      // Note: Analysis is triggered automatically by syncEmailsDirectToCommunications
      // for inbound emails (async, non-blocking)

      let schedulingResponsesProcessed = 0;

      if (emailResult.imported > 0) {
        // Process scheduling responses from inbound emails
        try {
          const schedulingResult = await processSchedulingEmails(connection.user_id);
          schedulingResponsesProcessed = schedulingResult.matched;
          if (schedulingResult.errors.length > 0) {
            console.warn(`Scheduling response errors for user ${connection.user_id}:`, schedulingResult.errors);
          }
        } catch (schedulingErr) {
          console.error(`Scheduling response processing failed for user ${connection.user_id}:`, schedulingErr);
        }
      }

      results.push({
        userId: connection.user_id,
        emailsImported: emailResult.imported,
        emailsMatched: emailResult.matched,
        eventsImported: calendarResult.imported,
        schedulingResponsesProcessed,
        errors: [...emailResult.errors, ...calendarResult.errors],
      });
    } catch (err) {
      console.error(`Sync failed for user ${connection.user_id}:`, err);
      results.push({
        userId: connection.user_id,
        emailsImported: 0,
        emailsMatched: 0,
        eventsImported: 0,
        schedulingResponsesProcessed: 0,
        errors: [`Sync failed: ${err}`],
      });
    }
  }

  const totalEmails = results.reduce((sum, r) => sum + r.emailsImported, 0);
  const totalMatched = results.reduce((sum, r) => sum + r.emailsMatched, 0);
  const totalEvents = results.reduce((sum, r) => sum + r.eventsImported, 0);
  const totalSchedulingResponses = results.reduce((sum, r) => sum + r.schedulingResponsesProcessed, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  // Renew any expiring webhook subscriptions
  let subscriptionRenewals = { renewed: 0, failed: 0, errors: [] as string[] };
  try {
    subscriptionRenewals = await renewExpiringSubscriptions();
    if (subscriptionRenewals.renewed > 0 || subscriptionRenewals.failed > 0) {
      console.log(`[Cron] Webhook subscriptions: ${subscriptionRenewals.renewed} renewed, ${subscriptionRenewals.failed} failed`);
    }
  } catch (renewErr) {
    console.error('[Cron] Failed to renew subscriptions:', renewErr);
  }

  console.log(`Microsoft sync completed: ${totalEmails} emails (${totalMatched} matched), ${totalEvents} events, ${totalSchedulingResponses} scheduling responses, ${totalErrors} errors`);

  const responseData = {
    success: true,
    synced: connections.length,
    totalEmailsImported: totalEmails,
    totalEmailsMatched: totalMatched,
    totalEventsImported: totalEvents,
    totalSchedulingResponsesProcessed: totalSchedulingResponses,
    subscriptionsRenewed: subscriptionRenewals.renewed,
    subscriptionRenewalsFailed: subscriptionRenewals.failed,
    totalErrors,
    details: results,
  };

  await logCronSuccess(executionId, JOB_NAME, startTime, responseData);
  return NextResponse.json(responseData);
  } catch (err) {
    await logCronError(executionId, JOB_NAME, startTime, err);
    console.error('[Cron/sync-microsoft] Fatal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
