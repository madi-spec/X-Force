/**
 * Scheduler Autopilot
 *
 * Automatically processes scheduling requests:
 * 1. Finds requests where next_action_at <= now
 * 2. Evaluates safety rules for each request
 * 3. Auto-sends scheduling emails if safe
 * 4. Creates BOOK_MEETING_APPROVAL flags if human review needed
 *
 * Reuses existing SchedulingService from src/lib/scheduler/schedulingService.ts
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingService } from '@/lib/scheduler/schedulingService';
import {
  AutopilotWorkflowResult,
  SchedulerAutopilotItem,
} from './types';
import {
  generateIdempotencyKey,
  checkIdempotency,
  logSuccess,
  logFailure,
  logSkipped,
  createBookMeetingApprovalFlag,
  createSystemErrorFlag,
  createEmptyResult,
  incrementResult,
  addError,
  firstOrNull,
} from './helpers';
import { evaluateSchedulerSafety } from './safetyRules';

// ============================================
// SCHEDULER AUTOPILOT
// ============================================

interface SchedulerAutopilotOptions {
  dryRun?: boolean;
  userId?: string;
  limit?: number;
}

/**
 * Run the scheduler autopilot workflow.
 */
export async function runSchedulerAutopilot(
  options: SchedulerAutopilotOptions = {}
): Promise<AutopilotWorkflowResult> {
  const result = createEmptyResult();
  const supabase = createAdminClient();
  const schedulingService = new SchedulingService({ useAdmin: true });

  try {
    // 1. Get scheduling requests needing action
    const { data: requests, error: fetchError } = await schedulingService.getRequestsNeedingAction();

    if (fetchError) {
      addError(result, `Failed to fetch scheduling requests: ${fetchError}`);
      return result;
    }

    if (!requests || requests.length === 0) {
      return result;
    }

    // Apply limit if specified
    const toProcess = options.limit
      ? requests.slice(0, options.limit)
      : requests;

    // 2. Process each request
    for (const request of toProcess) {
      await processSchedulingRequest(
        request as unknown as SchedulerAutopilotItem,
        result,
        schedulingService,
        options
      );
    }
  } catch (err) {
    addError(result, `Scheduler autopilot error: ${(err as Error).message}`);
  }

  return result;
}

/**
 * Process a single scheduling request.
 */
async function processSchedulingRequest(
  request: SchedulerAutopilotItem,
  result: AutopilotWorkflowResult,
  schedulingService: SchedulingService,
  options: SchedulerAutopilotOptions
): Promise<void> {
  const supabase = createAdminClient();
  incrementResult(result, 'processed');

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(
    'scheduler',
    request.id,
    `${request.status}:action`
  );

  // Check if already processed
  const canProceed = await checkIdempotency(idempotencyKey);
  if (!canProceed) {
    incrementResult(result, 'actionsSkipped');
    return;
  }

  // Get company product for risk assessment
  let companyProduct = null;
  if (request.company_id) {
    const { data: cp } = await supabase
      .from('company_products')
      .select('id, risk_level, open_objections')
      .eq('company_id', request.company_id)
      .maybeSingle();
    companyProduct = cp;
  }

  // Build full item for safety evaluation
  const itemForSafety: SchedulerAutopilotItem = {
    ...request,
    company_product: companyProduct ? {
      id: companyProduct.id,
      risk_level: companyProduct.risk_level,
      open_objections: companyProduct.open_objections || [],
    } : undefined,
  };

  // Evaluate safety rules
  const safetyEval = evaluateSchedulerSafety(itemForSafety);

  if (!safetyEval.canProceed) {
    // Create attention flag for human review
    if (!options.dryRun) {
      const flagId = await createBookMeetingApprovalFlag(
        request.company_id,
        safetyEval.reason,
        request.id,
        companyProduct?.id
      );

      await logSuccess('scheduler', 'FLAG_CREATED', {
        scheduling_request_id: request.id,
        company_id: request.company_id,
        attention_flag_id: flagId || undefined,
        idempotency_key: idempotencyKey,
        ai_reasoning: safetyEval.reason,
        outputs: { flag_type: 'BOOK_MEETING_APPROVAL' },
      });

      // Also log an ESCALATED_TO_HUMAN action
      await logSuccess('scheduler', 'ESCALATED_TO_HUMAN', {
        scheduling_request_id: request.id,
        company_id: request.company_id,
        ai_reasoning: `Scheduling request escalated: ${safetyEval.reason}`,
      });
    }

    incrementResult(result, 'flagsCreated');
    return;
  }

  // Auto-send scheduling email
  if (!options.dryRun) {
    try {
      // Get the user ID from the request creator or use provided userId
      const userId = options.userId || (request as unknown as { created_by?: string }).created_by;

      if (!userId) {
        await logSkipped('scheduler', 'EMAIL_SENT', 'No user ID available to send email', {
          scheduling_request_id: request.id,
          company_id: request.company_id,
          idempotency_key: idempotencyKey,
        });
        incrementResult(result, 'actionsSkipped');
        return;
      }

      const sendResult = await schedulingService.sendSchedulingEmail(request.id, userId);

      if (sendResult.success) {
        await logSuccess('scheduler', 'EMAIL_SENT', {
          scheduling_request_id: request.id,
          company_id: request.company_id,
          idempotency_key: idempotencyKey,
          ai_reasoning: 'Auto-sent scheduling email - all safety checks passed',
          inputs: {
            requestId: request.id,
            status: request.status,
          },
          outputs: {
            subject: sendResult.email?.subject,
            proposedTimes: sendResult.proposedTimes,
          },
        });

        incrementResult(result, 'actionsSent');
      } else {
        await logFailure('scheduler', 'EMAIL_SENT', sendResult.error || 'Unknown error', {
          scheduling_request_id: request.id,
          company_id: request.company_id,
          idempotency_key: idempotencyKey,
        });

        // Create system error flag for failed sends
        if (request.company_id) {
          await createSystemErrorFlag(
            request.company_id,
            `Scheduling email send failed: ${sendResult.error}`,
            request.id
          );
          incrementResult(result, 'flagsCreated');
        }

        addError(result, `Request ${request.id}: ${sendResult.error}`);
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      await logFailure('scheduler', 'ERROR', errorMsg, {
        scheduling_request_id: request.id,
        company_id: request.company_id,
        idempotency_key: idempotencyKey,
      });
      addError(result, `Request ${request.id}: ${errorMsg}`);
    }
  } else {
    // Dry run - just count as executed
    incrementResult(result, 'actionsSent');
  }

  incrementResult(result, 'actionsExecuted');
}

/**
 * Get summary of pending scheduling requests (for debugging/monitoring).
 */
export async function getSchedulerAutopilotStatus(): Promise<{
  pendingRequests: number;
  overdueRequests: number;
  lastRunAt: string | null;
}> {
  const supabase = createAdminClient();

  // Count pending requests
  const { count: pendingCount } = await supabase
    .from('scheduling_requests')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '(completed,cancelled,paused)')
    .not('next_action_at', 'is', null);

  // Count overdue requests
  const { count: overdueCount } = await supabase
    .from('scheduling_requests')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '(completed,cancelled,paused)')
    .lte('next_action_at', new Date().toISOString());

  // Get last run time from ai_action_log
  const { data: lastAction } = await supabase
    .from('ai_action_log')
    .select('created_at')
    .eq('source', 'scheduler')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    pendingRequests: pendingCount || 0,
    overdueRequests: overdueCount || 0,
    lastRunAt: lastAction?.created_at || null,
  };
}
