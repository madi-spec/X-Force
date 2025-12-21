/**
 * Cron API: Analyze Inbound Emails with AI
 *
 * Runs deep AI analysis on unanalyzed inbound emails:
 * - Detects buying signals and concerns
 * - Classifies into priority tiers
 * - Generates response drafts
 * - Creates enriched command center items
 *
 * Schedule: Every 15 minutes (AI analysis is more expensive)
 */

import { NextResponse } from 'next/server';
import { processUnanalyzedEmails } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for AI processing

export async function GET(request: Request) {
  const startTime = Date.now();

  // Verify cron secret for production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get optional user_id filter from query params
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  try {
    const result = await processUnanalyzedEmails(userId, limit);

    const duration = Date.now() - startTime;

    console.log(
      `[Email AI Analysis] Processed ${result.processed} emails, ` +
      `created ${result.itemsCreated} items, ` +
      `skipped ${result.skippedAlreadyReplied} replied, ` +
      `${result.errors.length} errors in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      processed: result.processed,
      itemsCreated: result.itemsCreated,
      skippedAlreadyReplied: result.skippedAlreadyReplied,
      skippedAlreadyAnalyzed: result.skippedAlreadyAnalyzed,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 10), // Limit errors in response
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email AI Analysis] Cron error:', errorMessage);

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

/**
 * POST handler for manual triggering with specific email IDs
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  // Verify cron secret or API key
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email_ids, user_id, limit = 10 } = body;

    if (email_ids && Array.isArray(email_ids)) {
      // Process specific emails
      const { processInboundEmail } = await import('@/lib/email');

      const results = await Promise.all(
        email_ids.slice(0, 20).map((id: string) => processInboundEmail(id))
      );

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return NextResponse.json({
        success: true,
        duration: `${Date.now() - startTime}ms`,
        processed: results.length,
        successful: successful.length,
        failed: failed.length,
        results: results.map(r => ({
          emailId: r.emailId,
          success: r.success,
          alreadyReplied: r.alreadyReplied,
          commandCenterItemId: r.commandCenterItemId,
          error: r.error,
        })),
      });
    } else {
      // Process unanalyzed emails for user
      const result = await processUnanalyzedEmails(user_id, limit);

      return NextResponse.json({
        success: true,
        duration: `${Date.now() - startTime}ms`,
        ...result,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email AI Analysis] POST error:', errorMessage);

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
