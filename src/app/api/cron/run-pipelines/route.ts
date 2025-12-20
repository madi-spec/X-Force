/**
 * Cron API: Run Command Center Pipelines
 *
 * Runs all pipelines to populate the Command Center:
 * 1. Process Transcript Analysis (Tier 2 + 3)
 * 2. Detect Inbound Emails (Tier 1)
 * 3. Deal Deadline Proximity (Tier 2)
 * 4. Meeting Follow-ups (Tier 3)
 * 5. Update SLA Status (Tier 1)
 *
 * Schedule: Every 5 minutes
 */

import { NextResponse } from 'next/server';
import { runAllPipelines } from '@/lib/pipelines';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const startTime = Date.now();

  // Verify cron secret for production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run all pipelines
    const results = await runAllPipelines();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      totalItemsCreated: results.totalItemsCreated,
      slaUpdates: results.slaUpdates,
      errorCount: results.errors.length,
      details: {
        transcripts: {
          processed: results.details.transcripts.transcriptsProcessed,
          itemsCreated: results.details.transcripts.itemsCreated,
          tier2: results.details.transcripts.tier2Items,
          tier3: results.details.transcripts.tier3Items,
        },
        emails: {
          processed: results.details.emails.messagesProcessed,
          itemsCreated: results.details.emails.itemsCreated,
          byTrigger: results.details.emails.byTrigger,
        },
        deadlines: {
          processed: results.details.deadlines.dealsProcessed,
          itemsCreated: results.details.deadlines.itemsCreated,
          byTrigger: results.details.deadlines.byTrigger,
        },
        followups: {
          processed: results.details.followups.meetingsProcessed,
          itemsCreated: results.details.followups.itemsCreated,
        },
        sla: {
          processed: results.details.sla.itemsProcessed,
          toWarning: results.details.sla.statusChanges.toWarning,
          toBreached: results.details.sla.statusChanges.toBreached,
        },
      },
      errors: results.errors.slice(0, 10), // Limit errors in response
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Pipeline cron error:', errorMessage);

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
