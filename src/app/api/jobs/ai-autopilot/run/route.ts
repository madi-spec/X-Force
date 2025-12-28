/**
 * AI Autopilot Job Endpoint
 *
 * POST /api/jobs/ai-autopilot/run
 *
 * Runs the AI autopilot workflows:
 * - scheduler: Process scheduling requests, auto-book or create approval flags
 * - needs-reply: Process response queue, auto-send safe replies or escalate
 * - transcript: Process transcript follow-ups, auto-send or create flags
 *
 * Query params:
 * - workflows: comma-separated list (scheduler,needs-reply,transcript) or 'all' (default: all)
 * - dryRun: 'true' to log what would happen without executing (default: false)
 * - limit: max items to process per workflow (default: 50)
 *
 * Returns:
 * {
 *   success: boolean,
 *   results: { scheduler?, needsReply?, transcript? },
 *   totalActionsExecuted: number,
 *   totalFlagsCreated: number,
 *   totalErrors: number,
 *   runAt: string,
 *   dryRun: boolean
 * }
 *
 * This endpoint should be called by a cron job or manually triggered.
 * Recommended cron schedule: every 5-15 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runAutopilot,
  parseWorkflows,
  getAutopilotStatus,
} from '@/lib/autopilot';

// ============================================
// POST - Run Autopilot
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const workflowsStr = searchParams.get('workflows');
    const dryRunStr = searchParams.get('dryRun');
    const limitStr = searchParams.get('limit');

    const workflows = parseWorkflows(workflowsStr);
    const dryRun = dryRunStr === 'true';
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    // Validate workflows
    if (workflows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid workflows specified. Use: scheduler, needs-reply, transcript, or all',
        },
        { status: 400 }
      );
    }

    // Run autopilot
    const result = await runAutopilot({
      workflows,
      dryRun,
      limit,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      meta: {
        duration: `${duration}ms`,
        workflowsRun: workflows,
      },
    });
  } catch (err) {
    console.error('[AI Autopilot] Error running autopilot:', err);

    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
        totalActionsExecuted: 0,
        totalFlagsCreated: 0,
        totalErrors: 1,
        runAt: new Date().toISOString(),
        dryRun: false,
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Get Autopilot Status
// ============================================

export async function GET() {
  try {
    const status = await getAutopilotStatus();

    return NextResponse.json({
      success: true,
      status,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AI Autopilot] Error getting status:', err);

    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
