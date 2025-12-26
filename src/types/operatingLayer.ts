/**
 * Operating Layer Types
 *
 * Core types for the AI-driven sales orchestration layer:
 * - AttentionFlags: Items needing human attention
 * - TriageDecisions: AI decisions on handling communications
 * - CompanyProduct extensions: Pipeline health metrics
 *
 * Intelligence comes from AI analysis → communicationType → sales playbook mapping
 * NO keyword-based logic - the AI provides semantic understanding
 */

// ============================================
// ATTENTION FLAGS
// ============================================

export type AttentionFlagSourceType = 'communication' | 'pipeline' | 'system';

export type AttentionFlagType =
  | 'NEEDS_REPLY'
  | 'BOOK_MEETING_APPROVAL'
  | 'PROPOSAL_APPROVAL'
  | 'PRICING_EXCEPTION'
  | 'CLOSE_DECISION'
  | 'HIGH_RISK_OBJECTION'
  | 'NO_NEXT_STEP_AFTER_MEETING'
  | 'STALE_IN_STAGE'
  | 'GHOSTING_AFTER_PROPOSAL'
  | 'DATA_MISSING_BLOCKER'
  | 'SYSTEM_ERROR';

export type AttentionFlagSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AttentionFlagOwner = 'human' | 'ai';

export type AttentionFlagStatus = 'open' | 'snoozed' | 'resolved';

export interface AttentionFlag {
  id: string;

  // Relationships
  company_id: string;
  company_product_id: string | null;

  // Source
  source_type: AttentionFlagSourceType;
  source_id: string | null;

  // Flag Details
  flag_type: AttentionFlagType;
  severity: AttentionFlagSeverity;
  reason: string;
  recommended_action: string | null;

  // Ownership
  owner: AttentionFlagOwner;

  // Status
  status: AttentionFlagStatus;
  snoozed_until: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  resolved_at: string | null;

  // Joined data
  company?: {
    id: string;
    name: string;
  };
  company_product?: {
    id: string;
    product_id: string;
    product?: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

// Attention Flag Type Info for UI
export interface AttentionFlagTypeInfo {
  type: AttentionFlagType;
  label: string;
  description: string;
  icon: string;
  defaultSeverity: AttentionFlagSeverity;
}

export const ATTENTION_FLAG_TYPES: AttentionFlagTypeInfo[] = [
  {
    type: 'NEEDS_REPLY',
    label: 'Needs Reply',
    description: 'Awaiting response from us',
    icon: 'mail',
    defaultSeverity: 'high',
  },
  {
    type: 'BOOK_MEETING_APPROVAL',
    label: 'Meeting Approval',
    description: 'AI wants to book meeting, needs approval',
    icon: 'calendar',
    defaultSeverity: 'medium',
  },
  {
    type: 'PROPOSAL_APPROVAL',
    label: 'Proposal Approval',
    description: 'Proposal ready for review/send',
    icon: 'file-text',
    defaultSeverity: 'high',
  },
  {
    type: 'PRICING_EXCEPTION',
    label: 'Pricing Exception',
    description: 'Non-standard pricing needs approval',
    icon: 'dollar-sign',
    defaultSeverity: 'high',
  },
  {
    type: 'CLOSE_DECISION',
    label: 'Close Decision',
    description: 'Ready to close, human decision needed',
    icon: 'check-circle',
    defaultSeverity: 'critical',
  },
  {
    type: 'HIGH_RISK_OBJECTION',
    label: 'High-Risk Objection',
    description: 'Serious objection detected',
    icon: 'alert-triangle',
    defaultSeverity: 'high',
  },
  {
    type: 'NO_NEXT_STEP_AFTER_MEETING',
    label: 'No Next Step',
    description: 'Meeting happened but no next step scheduled',
    icon: 'help-circle',
    defaultSeverity: 'medium',
  },
  {
    type: 'STALE_IN_STAGE',
    label: 'Stale in Stage',
    description: 'Too long in current stage',
    icon: 'clock',
    defaultSeverity: 'medium',
  },
  {
    type: 'GHOSTING_AFTER_PROPOSAL',
    label: 'Ghosting After Proposal',
    description: 'No response after proposal sent',
    icon: 'ghost',
    defaultSeverity: 'high',
  },
  {
    type: 'DATA_MISSING_BLOCKER',
    label: 'Data Missing',
    description: 'Missing critical data blocking progress',
    icon: 'alert-circle',
    defaultSeverity: 'medium',
  },
  {
    type: 'SYSTEM_ERROR',
    label: 'System Error',
    description: 'System/integration error needs attention',
    icon: 'zap-off',
    defaultSeverity: 'high',
  },
];

// Severity Info for UI
export interface SeverityInfo {
  level: AttentionFlagSeverity;
  label: string;
  color: string;
  bgColor: string;
  order: number;
}

export const SEVERITY_LEVELS: SeverityInfo[] = [
  { level: 'critical', label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100', order: 1 },
  { level: 'high', label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100', order: 2 },
  { level: 'medium', label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100', order: 3 },
  { level: 'low', label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-100', order: 4 },
];


// ============================================
// TRIAGE DECISIONS
// ============================================

export type TriageDecisionType = 'REJECT' | 'NURTURE' | 'BOOK' | 'ROUTE_TO_PIPELINE';

export interface TriageDecision {
  id: string;

  // Relationships
  company_id: string | null;
  contact_id: string | null;
  communication_id: string;

  // Decision
  decision: TriageDecisionType;
  product_slug: string | null;
  confidence: number; // 0-100
  reason: string;

  // Playbook Reference
  playbook_type: string; // Maps to communicationType from analysis

  // Timestamps
  created_at: string;

  // Joined data
  company?: {
    id: string;
    name: string;
  };
  contact?: {
    id: string;
    name: string;
    email: string;
  };
  communication?: {
    id: string;
    channel: string;
    subject: string | null;
    occurred_at: string;
  };
}

// Triage Decision Type Info for UI
export interface TriageDecisionTypeInfo {
  type: TriageDecisionType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const TRIAGE_DECISION_TYPES: TriageDecisionTypeInfo[] = [
  {
    type: 'REJECT',
    label: 'Reject',
    description: 'Not a qualified lead, archive',
    icon: 'x-circle',
    color: 'text-gray-500',
  },
  {
    type: 'NURTURE',
    label: 'Nurture',
    description: 'Not ready, add to nurture sequence',
    icon: 'clock',
    color: 'text-blue-500',
  },
  {
    type: 'BOOK',
    label: 'Book Meeting',
    description: 'Book a meeting with this contact',
    icon: 'calendar-plus',
    color: 'text-green-500',
  },
  {
    type: 'ROUTE_TO_PIPELINE',
    label: 'Route to Pipeline',
    description: 'Create/update company product pipeline entry',
    icon: 'git-branch',
    color: 'text-purple-500',
  },
];


// ============================================
// COMPANY PRODUCT EXTENSIONS
// ============================================

export type CompanyProductRiskLevel = 'none' | 'low' | 'med' | 'high';

// Extended objection type for the open_objections JSONB field
export interface OpenObjection {
  objection: string;
  detected_at: string;
  severity: 'low' | 'medium' | 'high';
  source_communication_id?: string;
  addressed?: boolean;
}

// Extended CompanyProduct fields (adds to existing CompanyProduct type)
export interface CompanyProductExtensions {
  last_stage_moved_at: string | null;
  last_human_touch_at: string | null;
  last_ai_touch_at: string | null;
  close_confidence: number | null; // 0-100
  close_ready: boolean;
  risk_level: CompanyProductRiskLevel | null;
  open_objections: OpenObjection[];
  next_step_due_at: string | null;
}

// Risk Level Info for UI
export interface RiskLevelInfo {
  level: CompanyProductRiskLevel;
  label: string;
  color: string;
  bgColor: string;
}

export const RISK_LEVELS: RiskLevelInfo[] = [
  { level: 'none', label: 'None', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  { level: 'low', label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' },
  { level: 'med', label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { level: 'high', label: 'High', color: 'text-red-700', bgColor: 'bg-red-100' },
];


// ============================================
// API RESPONSE TYPES
// ============================================

export interface AttentionFlagsResponse {
  flags: AttentionFlag[];
  total: number;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  by_type: Record<AttentionFlagType, number>;
}

export interface TriageDecisionsResponse {
  decisions: TriageDecision[];
  total: number;
  by_decision: Record<TriageDecisionType, number>;
}


// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAttentionFlagTypeInfo(type: AttentionFlagType): AttentionFlagTypeInfo | undefined {
  return ATTENTION_FLAG_TYPES.find(t => t.type === type);
}

export function getSeverityInfo(severity: AttentionFlagSeverity): SeverityInfo | undefined {
  return SEVERITY_LEVELS.find(s => s.level === severity);
}

export function getTriageDecisionTypeInfo(type: TriageDecisionType): TriageDecisionTypeInfo | undefined {
  return TRIAGE_DECISION_TYPES.find(t => t.type === type);
}

export function getRiskLevelInfo(level: CompanyProductRiskLevel): RiskLevelInfo | undefined {
  return RISK_LEVELS.find(r => r.level === level);
}

export function getSeverityColor(severity: AttentionFlagSeverity): string {
  const info = getSeverityInfo(severity);
  return info?.color || 'text-gray-700';
}

export function getRiskLevelColor(level: CompanyProductRiskLevel): string {
  const info = getRiskLevelInfo(level);
  return info?.color || 'text-gray-500';
}

// Sort flags by severity (critical first)
export function sortByPriority(flags: AttentionFlag[]): AttentionFlag[] {
  const severityOrder: Record<AttentionFlagSeverity, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  return [...flags].sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    // If same severity, newer first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// Filter open flags by severity threshold
export function filterBySeverityThreshold(
  flags: AttentionFlag[],
  minSeverity: AttentionFlagSeverity
): AttentionFlag[] {
  const severityOrder: Record<AttentionFlagSeverity, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  const threshold = severityOrder[minSeverity];
  return flags.filter(f => severityOrder[f.severity] <= threshold);
}

// ============================================
// DAILY DRIVER TYPES
// ============================================

/**
 * Attention levels for cognitive load management.
 * Controls visual weight and grouping in the Daily Driver UI.
 *
 * - "now": Action needed today (strongest visual weight, expanded)
 * - "soon": Action needed this week (calmer styling, visible)
 * - "monitor": Informational only (collapsed by default)
 */
export type AttentionLevel = 'now' | 'soon' | 'monitor';

/**
 * Attention level metadata for UI rendering
 */
export interface AttentionLevelInfo {
  level: AttentionLevel;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultExpanded: boolean;
}

export const ATTENTION_LEVELS: AttentionLevelInfo[] = [
  {
    level: 'now',
    label: 'Action Now',
    description: 'Requires attention today',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    defaultExpanded: true,
  },
  {
    level: 'soon',
    label: 'This Week',
    description: 'Action needed this week',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    defaultExpanded: true,
  },
  {
    level: 'monitor',
    label: 'Monitor',
    description: 'Keep an eye on these',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    defaultExpanded: false,
  },
];

export function getAttentionLevelInfo(level: AttentionLevel): AttentionLevelInfo | undefined {
  return ATTENTION_LEVELS.find((l) => l.level === level);
}

/**
 * Normalized item shape for Daily Driver views.
 * Presents a consistent interface for different source types
 * (attention flags, company products, etc.)
 */
export interface DailyDriverItem {
  id: string;

  // Core identifiers
  company_id: string;
  company_name: string;
  company_product_id: string | null;
  product_id: string | null;
  product_name: string | null;
  product_slug: string | null;

  // Stage context
  stage_id: string | null;
  stage_name: string | null;
  stage_order: number | null;

  // Attention level (computed)
  attention_level: AttentionLevel;

  // Flag details (for needsHuman and stalled)
  attention_flag_id: string | null;
  flag_type: AttentionFlagType | null;
  severity: AttentionFlagSeverity | null;
  reason: string | null;
  recommended_action: string | null;
  source_type: AttentionFlagSourceType | null;
  source_id: string | null;

  // Close readiness (for readyToClose)
  close_confidence: number | null;
  close_ready: boolean;
  mrr_estimate: number | null;

  // Ownership
  owner_user_id: string | null;
  owner_name: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  stage_entered_at: string | null;
  last_stage_moved_at: string | null;
}

/**
 * Items grouped by attention level for UI rendering
 */
export interface DailyDriverItemsByLevel {
  now: DailyDriverItem[];
  soon: DailyDriverItem[];
  monitor: DailyDriverItem[];
}

/**
 * Response shape for GET /api/daily-driver
 *
 * Query params:
 * - includeSnoozed=true: Include snoozed flags in needsHuman/stalled
 * - debug=true: Include extra debug fields (flag_id, source_type, source_id)
 */
export interface DailyDriverResponse {
  // Legacy groupings (for backward compatibility)
  needsHuman: DailyDriverItem[];
  stalled: DailyDriverItem[];
  readyToClose: DailyDriverItem[];

  // New: Items grouped by attention level
  byAttentionLevel: DailyDriverItemsByLevel;

  // Summary counts
  counts: {
    needsHuman: number;
    stalled: number;
    readyToClose: number;
    total: number;
    // Counts by attention level
    now: number;
    soon: number;
    monitor: number;
  };

  // Breakdown by severity for needsHuman
  needsHumanBySeverity: {
    critical: number;
    high: number;
    medium: number;
  };

  // Response metadata
  meta: {
    generatedAt: string; // ISO timestamp
    includeSnoozed: boolean;
    debug: boolean;
  };
}

/**
 * Request body for snoozing an attention flag
 */
export interface SnoozeAttentionFlagRequest {
  snooze_until: string; // ISO timestamp
  reason?: string;
}

/**
 * Response for attention flag mutations
 */
export interface AttentionFlagMutationResponse {
  success: boolean;
  flag: AttentionFlag;
}
