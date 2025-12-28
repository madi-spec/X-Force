/**
 * AI Autopilot Helpers
 *
 * Shared utility functions for the autopilot system:
 * - Logging actions to ai_action_log
 * - Creating attention flags
 * - Checking idempotency
 * - Generating idempotency keys
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  AIActionSource,
  AIActionType,
  AIActionStatus,
  CreateAIActionLogInput,
  AIActionLogEntry,
  AutopilotWorkflowResult,
} from './types';
import {
  AttentionFlagType,
  AttentionFlagSeverity,
  AttentionFlagSourceType,
} from '@/types/operatingLayer';

// ============================================
// IDEMPOTENCY
// ============================================

/**
 * Generate a unique idempotency key for an action.
 * Format: source:entity_id:action_context:date
 */
export function generateIdempotencyKey(
  source: AIActionSource,
  entityId: string,
  actionContext: string = 'default'
): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${source}:${entityId}:${actionContext}:${today}`;
}

/**
 * Check if an action has already been processed (idempotency check).
 * Returns true if the action should proceed (not yet processed).
 */
export async function checkIdempotency(idempotencyKey: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('ai_action_log')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  return !existing; // Return true if no existing record (can proceed)
}

// ============================================
// AI ACTION LOGGING
// ============================================

/**
 * Log an AI action to the audit trail.
 */
export async function logAIAction(
  input: CreateAIActionLogInput
): Promise<AIActionLogEntry | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ai_action_log')
    .insert({
      source: input.source,
      action_type: input.action_type,
      status: input.status || 'success',
      user_id: input.user_id,
      company_id: input.company_id,
      contact_id: input.contact_id,
      company_product_id: input.company_product_id,
      communication_id: input.communication_id,
      scheduling_request_id: input.scheduling_request_id,
      transcription_id: input.transcription_id,
      attention_flag_id: input.attention_flag_id,
      inputs: input.inputs || {},
      outputs: input.outputs || {},
      ai_reasoning: input.ai_reasoning,
      idempotency_key: input.idempotency_key,
      error_message: input.error_message,
      error_details: input.error_details,
      completed_at: input.status === 'success' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Autopilot] Failed to log action:', error);
    return null;
  }

  return data as AIActionLogEntry;
}

/**
 * Log a successful action.
 */
export async function logSuccess(
  source: AIActionSource,
  actionType: AIActionType,
  input: Omit<CreateAIActionLogInput, 'source' | 'action_type' | 'status'>
): Promise<AIActionLogEntry | null> {
  return logAIAction({
    source,
    action_type: actionType,
    status: 'success',
    ...input,
  });
}

/**
 * Log a skipped action.
 */
export async function logSkipped(
  source: AIActionSource,
  actionType: AIActionType,
  reason: string,
  input: Omit<CreateAIActionLogInput, 'source' | 'action_type' | 'status' | 'ai_reasoning'>
): Promise<AIActionLogEntry | null> {
  return logAIAction({
    source,
    action_type: actionType,
    status: 'skipped',
    ai_reasoning: reason,
    ...input,
  });
}

/**
 * Log a failed action.
 */
export async function logFailure(
  source: AIActionSource,
  actionType: AIActionType,
  errorMessage: string,
  input: Omit<CreateAIActionLogInput, 'source' | 'action_type' | 'status' | 'error_message'>
): Promise<AIActionLogEntry | null> {
  return logAIAction({
    source,
    action_type: actionType,
    status: 'failed',
    error_message: errorMessage,
    ...input,
  });
}

// ============================================
// ATTENTION FLAG CREATION
// ============================================

interface CreateFlagInput {
  companyId: string;
  companyProductId?: string;
  flagType: AttentionFlagType;
  severity: AttentionFlagSeverity;
  reason: string;
  recommendedAction?: string;
  sourceType: AttentionFlagSourceType;
  sourceId?: string;
}

/**
 * Create an attention flag for human review.
 * Returns the created flag's ID.
 */
export async function createAttentionFlag(
  input: CreateFlagInput
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('attention_flags')
    .insert({
      company_id: input.companyId,
      company_product_id: input.companyProductId,
      flag_type: input.flagType,
      severity: input.severity,
      reason: input.reason,
      recommended_action: input.recommendedAction,
      source_type: input.sourceType,
      source_id: input.sourceId,
      owner: 'human', // AI creates flags for human review
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Autopilot] Failed to create attention flag:', error);
    return null;
  }

  return data.id;
}

/**
 * Create a BOOK_MEETING_APPROVAL flag.
 */
export async function createBookMeetingApprovalFlag(
  companyId: string,
  reason: string,
  schedulingRequestId: string,
  companyProductId?: string
): Promise<string | null> {
  return createAttentionFlag({
    companyId,
    companyProductId,
    flagType: 'BOOK_MEETING_APPROVAL',
    severity: 'medium',
    reason,
    recommendedAction: 'Review and approve the meeting booking, or reschedule if needed',
    sourceType: 'system',
    sourceId: schedulingRequestId,
  });
}

/**
 * Create a NEEDS_REPLY flag.
 */
export async function createNeedsReplyFlag(
  companyId: string,
  reason: string,
  communicationId: string,
  companyProductId?: string,
  severity: AttentionFlagSeverity = 'medium'
): Promise<string | null> {
  return createAttentionFlag({
    companyId,
    companyProductId,
    flagType: 'NEEDS_REPLY',
    severity,
    reason,
    recommendedAction: 'Draft and send a personalized response',
    sourceType: 'communication',
    sourceId: communicationId,
  });
}

/**
 * Create a NO_NEXT_STEP_AFTER_MEETING flag.
 */
export async function createNoNextStepFlag(
  companyId: string,
  reason: string,
  transcriptionId: string,
  companyProductId?: string
): Promise<string | null> {
  return createAttentionFlag({
    companyId,
    companyProductId,
    flagType: 'NO_NEXT_STEP_AFTER_MEETING',
    severity: 'medium',
    reason,
    recommendedAction: 'Send meeting follow-up and schedule next step',
    sourceType: 'system',
    sourceId: transcriptionId,
  });
}

/**
 * Create a SYSTEM_ERROR flag.
 */
export async function createSystemErrorFlag(
  companyId: string,
  reason: string,
  sourceId?: string
): Promise<string | null> {
  return createAttentionFlag({
    companyId,
    flagType: 'SYSTEM_ERROR',
    severity: 'high',
    reason,
    recommendedAction: 'Review the error and take corrective action',
    sourceType: 'system',
    sourceId,
  });
}

// ============================================
// RESULT HELPERS
// ============================================

/**
 * Create an empty workflow result.
 */
export function createEmptyResult(): AutopilotWorkflowResult {
  return {
    processed: 0,
    actionsExecuted: 0,
    actionsSent: 0,
    actionsSkipped: 0,
    flagsCreated: 0,
    errors: [],
  };
}

/**
 * Increment a result counter safely.
 */
export function incrementResult(
  result: AutopilotWorkflowResult,
  field: keyof Omit<AutopilotWorkflowResult, 'errors'>
): void {
  result[field]++;
}

/**
 * Add an error to the result.
 */
export function addError(result: AutopilotWorkflowResult, error: string): void {
  result.errors.push(error);
}

// ============================================
// CONTENT ANALYSIS
// ============================================

/**
 * Check if content contains pricing-related keywords.
 */
export function containsPricingKeywords(content: string): boolean {
  const pricingKeywords = [
    'price',
    'pricing',
    'cost',
    'quote',
    'proposal',
    'discount',
    'budget',
    'investment',
    'rate',
    'fee',
    'payment',
    'invoice',
  ];

  const lowerContent = content.toLowerCase();
  return pricingKeywords.some((kw) => lowerContent.includes(kw));
}

/**
 * Check if content contains objection signals.
 */
export function containsObjectionSignals(content: string): boolean {
  const objectionKeywords = [
    'concern',
    'worried',
    'issue',
    'problem',
    'not sure',
    'hesitant',
    'competitor',
    'alternative',
    'too expensive',
    'cant afford',
    "can't afford",
    'not ready',
    'think about it',
    'discuss internally',
    'hold off',
  ];

  const lowerContent = content.toLowerCase();
  return objectionKeywords.some((kw) => lowerContent.includes(kw));
}

/**
 * Check if content appears to be simple logistics (safe to auto-reply).
 */
export function isSimpleLogistics(content: string): boolean {
  const logisticsPatterns = [
    /yes,?\s*(that\s+)?works/i,
    /sounds\s+good/i,
    /confirmed/i,
    /looking\s+forward/i,
    /see\s+you\s+(then|there|at)/i,
    /thank\s+you\s+for\s+confirming/i,
    /got\s+it/i,
    /will\s+be\s+there/i,
  ];

  return logisticsPatterns.some((pattern) => pattern.test(content));
}

// ============================================
// ENTITY HELPERS
// ============================================

/**
 * Extract first item from potentially array or single value.
 * Supabase sometimes returns arrays for joined relations.
 */
export function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

/**
 * Update company product's last_ai_touch_at timestamp.
 */
export async function updateLastAITouch(companyProductId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('company_products')
    .update({ last_ai_touch_at: new Date().toISOString() })
    .eq('id', companyProductId);
}

/**
 * Update company product's next_step_due_at.
 */
export async function setNextStepDueAt(
  companyProductId: string,
  daysFromNow: number = 3
): Promise<void> {
  const supabase = createAdminClient();

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysFromNow);

  await supabase
    .from('company_products')
    .update({ next_step_due_at: dueDate.toISOString() })
    .eq('id', companyProductId);
}
