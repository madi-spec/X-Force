/**
 * Escalation - Handle cases requiring human review
 *
 * When the AI cannot confidently process a scheduling request,
 * this module handles escalation to human review.
 *
 * Escalation creates:
 * 1. A work item for the rep to review
 * 2. Pause on the scheduling request
 * 3. Audit trail in scheduling_actions
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { STATUS, ERROR_CODES } from '../core/constants';
import type { SchedulingRequest } from '../types';
import type { IntentAnalysis } from './IntentDetector';

// ============================================
// TYPES
// ============================================

export interface EscalationReason {
  /** Primary reason for escalation */
  reason: string;
  /** Reason code for categorization */
  code: EscalationCode;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Suggested action for the human reviewer */
  suggestedAction?: string;
  /** Priority level */
  priority?: 'high' | 'medium' | 'low';
}

export type EscalationCode =
  | 'confusion_detected'
  | 'low_confidence'
  | 'unclear_intent'
  | 'delegation_unclear'
  | 'question_needs_answer'
  | 'counter_proposal_complex'
  | 'sentiment_negative'
  | 'max_attempts_reached'
  | 'ai_error'
  | 'manual_review_requested';

export interface EscalationResult {
  success: boolean;
  workItemId?: string;
  error?: string;
}

// ============================================
// MAIN ESCALATION FUNCTION
// ============================================

/**
 * Escalate a scheduling request to human review
 * Creates a work item and pauses the request
 */
export async function escalateToHumanReview(
  request: SchedulingRequest,
  escalation: EscalationReason,
  correlationId?: string
): Promise<EscalationResult> {
  const logPrefix = correlationId ? `[Escalation:${correlationId}]` : '[Escalation]';
  console.log(`${logPrefix} Escalating request ${request.id}: ${escalation.reason}`);

  const supabase = createAdminClient();

  try {
    // 1. Update request status to PAUSED with reason
    const { error: updateError } = await supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.PAUSED,
        pause_reason: escalation.reason,
        pause_details: escalation.details,
        next_action_type: `human_review_${escalation.code}`,
        next_action_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (updateError) {
      console.error(`${logPrefix} Failed to update request:`, updateError);
      return { success: false, error: updateError.message };
    }

    // 2. Create command center work item for review
    const workItemTitle = buildWorkItemTitle(request, escalation);
    const workItemDescription = buildWorkItemDescription(request, escalation);

    const { data: workItem, error: insertError } = await supabase
      .from('command_center_items')
      .insert({
        user_id: request.created_by,
        type: 'scheduling_review',
        title: workItemTitle,
        description: workItemDescription,
        priority: escalation.priority || 'high',
        status: 'pending',
        context: {
          scheduling_request_id: request.id,
          escalation_code: escalation.code,
          escalation_reason: escalation.reason,
          details: escalation.details,
          suggested_action: escalation.suggestedAction,
          correlation_id: correlationId,
        },
        source_type: 'scheduler',
        source_id: request.id,
        due_at: getDueDate(escalation.priority),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`${logPrefix} Failed to create work item:`, insertError);
      // Don't fail the whole operation - the request is paused at least
    }

    // 3. Log the escalation action
    await supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: 'escalated_to_human',
      actor: 'ai',
      ai_reasoning: escalation.reason,
      metadata: {
        escalation_code: escalation.code,
        details: escalation.details,
        work_item_id: workItem?.id,
        correlation_id: correlationId,
      },
    });

    console.log(`${logPrefix} Escalation complete - work item: ${workItem?.id || 'N/A'}`);

    return {
      success: true,
      workItemId: workItem?.id,
    };
  } catch (err) {
    console.error(`${logPrefix} Escalation failed:`, err);
    return {
      success: false,
      error: String(err),
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build an escalation from intent analysis
 */
export function buildEscalationFromIntent(
  analysis: IntentAnalysis,
  emailBody?: string
): EscalationReason {
  if (analysis.isConfused) {
    return {
      reason: 'Prospect appears confused or is correcting us',
      code: 'confusion_detected',
      details: {
        confusionReason: analysis.confusionReason,
        emailBody: emailBody?.slice(0, 500),
      },
      suggestedAction: 'Review the email thread and respond manually',
      priority: 'high',
    };
  }

  if (analysis.confidence === 'low') {
    return {
      reason: 'Could not confidently determine prospect intent',
      code: 'low_confidence',
      details: {
        detectedIntent: analysis.intent,
        reasoning: analysis.reasoning,
        emailBody: emailBody?.slice(0, 500),
      },
      suggestedAction: 'Read the email and determine appropriate response',
      priority: 'medium',
    };
  }

  if (analysis.intent === 'unclear') {
    return {
      reason: 'Unable to determine what the prospect wants',
      code: 'unclear_intent',
      details: {
        reasoning: analysis.reasoning,
        emailBody: emailBody?.slice(0, 500),
      },
      suggestedAction: 'Read the email and respond appropriately',
      priority: 'medium',
    };
  }

  if (analysis.isDelegating && !analysis.delegateTo) {
    return {
      reason: 'Prospect delegated to someone but no contact info provided',
      code: 'delegation_unclear',
      details: {
        emailBody: emailBody?.slice(0, 500),
      },
      suggestedAction: 'Identify the delegate and update contact information',
      priority: 'medium',
    };
  }

  if (analysis.hasQuestion) {
    return {
      reason: 'Prospect has a question that needs answering',
      code: 'question_needs_answer',
      details: {
        question: analysis.question,
        emailBody: emailBody?.slice(0, 500),
      },
      suggestedAction: 'Answer their question and continue scheduling',
      priority: 'high',
    };
  }

  if (analysis.sentiment === 'negative') {
    return {
      reason: 'Negative sentiment detected - approach with care',
      code: 'sentiment_negative',
      details: {
        reasoning: analysis.reasoning,
        emailBody: emailBody?.slice(0, 500),
      },
      suggestedAction: 'Review and respond with extra care',
      priority: 'high',
    };
  }

  // Default escalation
  return {
    reason: 'Manual review needed',
    code: 'manual_review_requested',
    details: {
      analysis,
      emailBody: emailBody?.slice(0, 500),
    },
    priority: 'medium',
  };
}

/**
 * Escalate due to AI/system error
 */
export async function escalateOnError(
  request: SchedulingRequest,
  error: Error | string,
  correlationId?: string
): Promise<EscalationResult> {
  return escalateToHumanReview(
    request,
    {
      reason: 'System error during processing',
      code: 'ai_error',
      details: {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      suggestedAction: 'Review request and retry or process manually',
      priority: 'high',
    },
    correlationId
  );
}

/**
 * Escalate due to max attempts reached
 */
export async function escalateMaxAttempts(
  request: SchedulingRequest,
  attemptCount: number,
  correlationId?: string
): Promise<EscalationResult> {
  return escalateToHumanReview(
    request,
    {
      reason: `Maximum follow-up attempts (${attemptCount}) reached without response`,
      code: 'max_attempts_reached',
      details: {
        attemptCount,
        lastAttempt: request.last_action_at,
      },
      suggestedAction: 'Consider calling or using a different approach',
      priority: 'medium',
    },
    correlationId
  );
}

function buildWorkItemTitle(request: SchedulingRequest, escalation: EscalationReason): string {
  const companyName = (request as any).company?.name || 'Unknown Company';
  const titleMap: Record<EscalationCode, string> = {
    confusion_detected: `⚠️ Confused response: ${companyName}`,
    low_confidence: `❓ Review needed: ${companyName}`,
    unclear_intent: `❓ Unclear response: ${companyName}`,
    delegation_unclear: `👤 Delegation: ${companyName}`,
    question_needs_answer: `❔ Question from: ${companyName}`,
    counter_proposal_complex: `📅 Complex proposal: ${companyName}`,
    sentiment_negative: `😟 Negative sentiment: ${companyName}`,
    max_attempts_reached: `⏰ Max attempts: ${companyName}`,
    ai_error: `🔧 System error: ${companyName}`,
    manual_review_requested: `📋 Review: ${companyName}`,
  };

  return titleMap[escalation.code] || `Scheduling review: ${companyName}`;
}

function buildWorkItemDescription(
  request: SchedulingRequest,
  escalation: EscalationReason
): string {
  let description = escalation.reason;

  if (escalation.suggestedAction) {
    description += `\n\n**Suggested Action:** ${escalation.suggestedAction}`;
  }

  if (escalation.details?.emailBody) {
    description += `\n\n**Email Preview:**\n${String(escalation.details.emailBody).slice(0, 300)}...`;
  }

  return description;
}

function getDueDate(priority?: 'high' | 'medium' | 'low'): string {
  const now = new Date();
  switch (priority) {
    case 'high':
      // Due in 2 hours
      return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    case 'low':
      // Due in 24 hours
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    default:
      // Due in 8 hours
      return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  }
}

// ============================================
// RESUME FROM ESCALATION
// ============================================

/**
 * Resume a paused request after human review
 */
export async function resumeFromEscalation(
  requestId: string,
  resolution: {
    action: 'continue' | 'cancel' | 'manual_response';
    notes?: string;
    actorId: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get the current request
    const { data: request, error: fetchError } = await supabase
      .from('scheduling_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { success: false, error: 'Request not found' };
    }

    let newStatus: string;
    let nextAction: string | null = null;
    let nextActionAt: string | null = null;

    switch (resolution.action) {
      case 'continue':
        // Resume normal processing
        newStatus = STATUS.AWAITING_RESPONSE;
        nextAction = 'follow_up';
        nextActionAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'cancel':
        newStatus = STATUS.CANCELLED;
        break;
      case 'manual_response':
        // Human will respond manually - just clear the pause
        newStatus = STATUS.AWAITING_RESPONSE;
        break;
      default:
        return { success: false, error: 'Invalid resolution action' };
    }

    // Update the request
    const { error: updateError } = await supabase
      .from('scheduling_requests')
      .update({
        status: newStatus,
        pause_reason: null,
        pause_details: null,
        next_action_type: nextAction,
        next_action_at: nextActionAt,
      })
      .eq('id', requestId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the resolution
    await supabase.from('scheduling_actions').insert({
      scheduling_request_id: requestId,
      action_type: 'escalation_resolved',
      actor: resolution.actorId,
      ai_reasoning: resolution.notes,
      metadata: {
        resolution_action: resolution.action,
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
