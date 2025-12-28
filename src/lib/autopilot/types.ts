/**
 * AI Autopilot Types
 *
 * Type definitions for the autopilot system that handles automatic
 * scheduling, replies, and follow-ups with human-auditable logging.
 */

// ============================================
// DATABASE ENUMS (match migration)
// ============================================

export type AIActionSource =
  | 'scheduler'
  | 'communications'
  | 'transcript'
  | 'pipeline'
  | 'system';

export type AIActionType =
  | 'EMAIL_SENT'
  | 'EMAIL_DRAFTED'
  | 'MEETING_BOOKED'
  | 'MEETING_PROPOSED'
  | 'MEETING_RESCHEDULED'
  | 'FOLLOWUP_CREATED'
  | 'NEXT_STEP_SET'
  | 'FLAG_CREATED'
  | 'FLAG_RESOLVED'
  | 'ESCALATED_TO_HUMAN'
  | 'ERROR';

export type AIActionStatus = 'success' | 'skipped' | 'failed' | 'pending';

// ============================================
// AI ACTION LOG
// ============================================

export interface AIActionLogEntry {
  id: string;
  source: AIActionSource;
  action_type: AIActionType;
  status: AIActionStatus;

  // Entity relationships
  user_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  company_product_id: string | null;
  communication_id: string | null;
  scheduling_request_id: string | null;
  transcription_id: string | null;
  attention_flag_id: string | null;

  // Action details
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  ai_reasoning: string | null;

  // Idempotency
  idempotency_key: string | null;

  // Error handling
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  retry_count: number;

  // Timestamps
  created_at: string;
  completed_at: string | null;

  // Joined data (optional, from queries)
  company?: { id: string; name: string };
  contact?: { id: string; name: string; email: string };
  communication?: { id: string; subject: string };
}

export interface CreateAIActionLogInput {
  source: AIActionSource;
  action_type: AIActionType;
  status?: AIActionStatus;

  user_id?: string;
  company_id?: string;
  contact_id?: string;
  company_product_id?: string;
  communication_id?: string;
  scheduling_request_id?: string;
  transcription_id?: string;
  attention_flag_id?: string;

  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  ai_reasoning?: string;
  idempotency_key?: string;
  error_message?: string;
  error_details?: Record<string, unknown>;
}

// ============================================
// AUTOPILOT RESULTS
// ============================================

export interface AutopilotWorkflowResult {
  processed: number;
  actionsExecuted: number;
  actionsSent: number;
  actionsSkipped: number;
  flagsCreated: number;
  errors: string[];
}

export interface AutopilotResponse {
  success: boolean;
  results: {
    scheduler?: AutopilotWorkflowResult;
    needsReply?: AutopilotWorkflowResult;
    transcript?: AutopilotWorkflowResult;
  };
  totalActionsExecuted: number;
  totalFlagsCreated: number;
  totalErrors: number;
  runAt: string;
  dryRun: boolean;
}

// ============================================
// AUTOPILOT OPTIONS
// ============================================

export type AutopilotWorkflow = 'scheduler' | 'needs-reply' | 'transcript';

export interface AutopilotOptions {
  workflows: AutopilotWorkflow[];
  dryRun?: boolean;
  userId?: string;
  limit?: number; // Max items to process per workflow
}

// ============================================
// SAFETY EVALUATION
// ============================================

export interface SafetyEvaluation {
  canProceed: boolean;
  reason: string;
  riskLevel?: 'low' | 'medium' | 'high';
  suggestedAction?: 'auto_execute' | 'create_flag' | 'skip';
}

// ============================================
// WORKFLOW-SPECIFIC TYPES
// ============================================

// Scheduler Autopilot
export interface SchedulerAutopilotItem {
  id: string;
  company_id: string;
  status: string;
  attempt_count: number;
  next_action_at: string | null;
  next_action_type: string | null;
  attendees: Array<{
    id: string;
    side: 'internal' | 'external';
    email: string | null;
    name: string | null;
  }>;
  company_product?: {
    id: string;
    risk_level: string | null;
    open_objections: unknown[];
  };
}

// Needs Reply Autopilot
export interface NeedsReplyAutopilotItem {
  id: string;
  company_id: string;
  contact_id: string | null;
  subject: string | null;
  content_preview: string | null;
  channel: string;
  direction: string;
  response_due_by: string | null;
  company?: { id: string; name: string };
  contact?: { id: string; name: string; email: string | null };
  company_product?: {
    id: string;
    risk_level: string | null;
    open_objections: unknown[];
  };
}

// Transcript Autopilot
export interface TranscriptAutopilotItem {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  user_id: string;
  meeting_date: string;
  title: string | null;
  analysis: Record<string, unknown> | null;
  follow_up_sent: boolean;
  company?: { id: string; name: string };
  contact?: { id: string; name: string; email: string | null };
}

// ============================================
// AI ACTIVITY PAGE TYPES
// ============================================

export interface AIActivityFilters {
  sources?: AIActionSource[];
  statuses?: AIActionStatus[];
  actionTypes?: AIActionType[];
  companyId?: string;
  since?: string;
  until?: string;
}

export interface AIActivityResponse {
  actions: AIActionLogEntry[];
  total: number;
  limit: number;
  offset: number;
  stats: {
    success: number;
    skipped: number;
    failed: number;
    bySource: Record<AIActionSource, number>;
  };
}
