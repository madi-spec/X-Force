/**
 * AI Autopilot System
 *
 * Main orchestrator for running autopilot workflows:
 * - Scheduler Autopilot: Auto-process scheduling requests
 * - Needs Reply Autopilot: Auto-respond to simple communications
 * - Transcript Autopilot: Auto-send meeting follow-ups
 *
 * Each workflow:
 * 1. Evaluates safety rules before acting
 * 2. Logs all actions to ai_action_log for audit trail
 * 3. Creates attention flags when human review is needed
 * 4. Uses idempotency to prevent duplicate actions
 */

import {
  AutopilotOptions,
  AutopilotResponse,
  AutopilotWorkflow,
  AutopilotWorkflowResult,
} from './types';
import { runSchedulerAutopilot, getSchedulerAutopilotStatus } from './schedulerAutopilot';
import { runNeedsReplyAutopilot, getNeedsReplyAutopilotStatus } from './needsReplyAutopilot';
import { runTranscriptAutopilot, getTranscriptAutopilotStatus } from './transcriptAutopilot';

// Re-export types
export * from './types';

// Re-export individual workflow runners for direct access
export {
  runSchedulerAutopilot,
  runNeedsReplyAutopilot,
  runTranscriptAutopilot,
  getSchedulerAutopilotStatus,
  getNeedsReplyAutopilotStatus,
  getTranscriptAutopilotStatus,
};

// ============================================
// MAIN ORCHESTRATOR
// ============================================

/**
 * Run autopilot workflows.
 *
 * @param options - Configuration for the autopilot run
 * @returns Summary of all workflow results
 */
export async function runAutopilot(
  options: AutopilotOptions
): Promise<AutopilotResponse> {
  const startTime = Date.now();
  const results: AutopilotResponse['results'] = {};

  // Run each requested workflow
  if (options.workflows.includes('scheduler')) {
    results.scheduler = await runSchedulerAutopilot({
      dryRun: options.dryRun,
      userId: options.userId,
      limit: options.limit,
    });
  }

  if (options.workflows.includes('needs-reply')) {
    results.needsReply = await runNeedsReplyAutopilot({
      dryRun: options.dryRun,
      userId: options.userId,
      limit: options.limit,
    });
  }

  if (options.workflows.includes('transcript')) {
    results.transcript = await runTranscriptAutopilot({
      dryRun: options.dryRun,
      userId: options.userId,
      limit: options.limit,
    });
  }

  // Calculate totals
  const totalActionsExecuted = Object.values(results).reduce(
    (sum, r) => sum + (r?.actionsExecuted || 0),
    0
  );
  const totalFlagsCreated = Object.values(results).reduce(
    (sum, r) => sum + (r?.flagsCreated || 0),
    0
  );
  const totalErrors = Object.values(results).reduce(
    (sum, r) => sum + (r?.errors?.length || 0),
    0
  );

  return {
    success: totalErrors === 0,
    results,
    totalActionsExecuted,
    totalFlagsCreated,
    totalErrors,
    runAt: new Date().toISOString(),
    dryRun: options.dryRun || false,
  };
}

/**
 * Run all autopilot workflows.
 */
export async function runAllAutopilots(
  options: Omit<AutopilotOptions, 'workflows'> = {}
): Promise<AutopilotResponse> {
  return runAutopilot({
    ...options,
    workflows: ['scheduler', 'needs-reply', 'transcript'],
  });
}

// ============================================
// STATUS & MONITORING
// ============================================

/**
 * Get combined status of all autopilot workflows.
 */
export async function getAutopilotStatus(): Promise<{
  scheduler: Awaited<ReturnType<typeof getSchedulerAutopilotStatus>>;
  needsReply: Awaited<ReturnType<typeof getNeedsReplyAutopilotStatus>>;
  transcript: Awaited<ReturnType<typeof getTranscriptAutopilotStatus>>;
  totals: {
    pendingItems: number;
    overdueItems: number;
    lastRunAt: string | null;
  };
}> {
  const [scheduler, needsReply, transcript] = await Promise.all([
    getSchedulerAutopilotStatus(),
    getNeedsReplyAutopilotStatus(),
    getTranscriptAutopilotStatus(),
  ]);

  // Calculate totals
  const pendingItems =
    scheduler.pendingRequests +
    needsReply.pendingReplies +
    transcript.pendingFollowups;

  const overdueItems =
    scheduler.overdueRequests +
    needsReply.overdueReplies;

  // Find most recent run across all workflows
  const lastRunTimes = [
    scheduler.lastRunAt,
    needsReply.lastRunAt,
    transcript.lastRunAt,
  ].filter(Boolean) as string[];

  const lastRunAt = lastRunTimes.length > 0
    ? lastRunTimes.reduce((a, b) => (a > b ? a : b))
    : null;

  return {
    scheduler,
    needsReply,
    transcript,
    totals: {
      pendingItems,
      overdueItems,
      lastRunAt,
    },
  };
}

// ============================================
// WORKFLOW HELPERS
// ============================================

/**
 * Parse workflow string into array.
 */
export function parseWorkflows(
  workflowsStr: string | null | undefined
): AutopilotWorkflow[] {
  if (!workflowsStr || workflowsStr === 'all') {
    return ['scheduler', 'needs-reply', 'transcript'];
  }

  const validWorkflows: AutopilotWorkflow[] = ['scheduler', 'needs-reply', 'transcript'];
  const requested = workflowsStr.split(',').map((w) => w.trim().toLowerCase());

  return requested.filter((w): w is AutopilotWorkflow =>
    validWorkflows.includes(w as AutopilotWorkflow)
  );
}

/**
 * Create an empty result summary.
 */
export function createEmptySummary(): AutopilotWorkflowResult {
  return {
    processed: 0,
    actionsExecuted: 0,
    actionsSent: 0,
    actionsSkipped: 0,
    flagsCreated: 0,
    errors: [],
  };
}
