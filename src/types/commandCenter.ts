// AI Command Center v3.1 Types
// Updated with Priority Tiers System

// ============================================
// PRIORITY TIERS
// ============================================

export type PriorityTier = 1 | 2 | 3 | 4 | 5;

export type TierTrigger =
  // Tier 1: RESPOND NOW
  | 'demo_request'
  | 'pricing_request'
  | 'direct_question'
  | 'email_reply'
  | 'form_submission'
  | 'calendly_booking'
  // Tier 2: DON'T LOSE THIS
  | 'deadline_critical'
  | 'deadline_approaching'
  | 'competitive_risk'
  | 'proposal_hot'
  | 'champion_dark'
  | 'urgency_keywords'
  // Tier 3: KEEP YOUR WORD
  | 'transcript_commitment'
  | 'meeting_follow_up'
  | 'action_item_due'
  // Tier 4: MOVE BIG DEALS
  | 'high_value'
  | 'strategic_account'
  | 'csuite_contact'
  | 'deal_stale';

export type TierSlaStatus = 'on_track' | 'warning' | 'breached';

export interface TierConfig {
  tier: PriorityTier;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const TIER_CONFIGS: Record<PriorityTier, TierConfig> = {
  1: {
    tier: 1,
    name: 'RESPOND NOW',
    icon: '🔴',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    description: 'People are waiting. Response speed = close rate.',
  },
  2: {
    tier: 2,
    name: "DON'T LOSE THIS",
    icon: '🟠',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    description: 'Deadlines, competition, or decisions in motion.',
  },
  3: {
    tier: 3,
    name: 'KEEP YOUR WORD',
    icon: '🟡',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    description: 'You promised these.',
  },
  4: {
    tier: 4,
    name: 'MOVE BIG DEALS',
    icon: '🟢',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    description: 'High-value opportunities worth your attention.',
  },
  5: {
    tier: 5,
    name: 'BUILD PIPELINE',
    icon: '🔵',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    description: 'Important but not urgent.',
  },
};

// ============================================
// ACTION TYPES
// ============================================

export type ActionType =
  | 'call'
  | 'call_with_prep'
  | 'email_send_draft'
  | 'email_compose'
  | 'email_respond'
  | 'meeting_prep'
  | 'meeting_follow_up'
  | 'proposal_review'
  | 'linkedin_touch'
  | 'research_account'
  | 'internal_sync'
  | 'task_simple'
  | 'task_complex';

export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'snoozed' | 'dismissed';

export type ItemSource =
  | 'system'
  | 'manual'
  | 'email_sync'
  | 'calendar_sync'
  | 'signal_detection'
  | 'ai_recommendation'
  | 'transcription'
  | 'crm_sync'
  | 'slack'
  | 'form_submission'
  | 'calendly';

export type TimeBlockType = 'available' | 'meeting' | 'prep' | 'buffer';

// ============================================
// COMMAND CENTER ITEM
// ============================================

export interface CommandCenterItem {
  id: string;
  user_id: string;

  // Source linking
  task_id?: string | null;
  conversation_id?: string | null;
  deal_id?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  signal_id?: string | null;
  meeting_id?: string | null;

  // Action details
  action_type: ActionType;
  title: string;
  description?: string | null;

  // Targets
  target_name?: string | null;
  company_name?: string | null;

  // Value context
  deal_value?: number | null;
  deal_probability?: number | null;
  deal_stage?: string | null;

  // Time estimates
  estimated_minutes: number;

  // Momentum scoring
  momentum_score: number;
  score_factors: ScoreFactors;
  score_explanation: string[];

  // Score components
  base_priority: number;
  time_pressure: number;
  value_score: number;
  engagement_score: number;
  risk_score: number;

  // Timing
  due_at?: string | null;
  optimal_hours?: number[] | null;
  optimal_days?: string[] | null;

  // Priority Tier
  tier: PriorityTier;
  tier_trigger?: TierTrigger | null;
  sla_minutes?: number | null;
  sla_status?: TierSlaStatus | null;
  urgency_score?: number | null;
  promise_date?: string | null;
  commitment_text?: string | null;
  received_at?: string | null;

  // AI context
  why_now?: string | null;
  context_brief?: string | null;
  win_tip?: string | null;
  landmine_warnings?: string[] | null;

  // Win patterns
  win_pattern_id?: string | null;
  win_pattern_match_score?: number | null;
  win_pattern_sample_size?: number | null;

  // Sentiment & Human Review
  sentiment_score?: number | null;
  sentiment_trend?: 'improving' | 'stable' | 'declining' | null;
  sentiment_routing?: string | null;
  requires_human_review?: boolean | null;
  human_leverage_brief?: Record<string, unknown> | null;

  // Status
  status: ItemStatus;
  started_at?: string | null;
  completed_at?: string | null;
  dismissed_at?: string | null;
  dismissed_reason?: string | null;

  // Snooze
  snoozed_until?: string | null;
  snooze_count: number;
  last_snoozed_at?: string | null;

  // Skip tracking
  skip_count: number;
  last_skipped_at?: string | null;

  // Planning
  planned_for_date?: string | null;
  planned_block_index?: number | null;
  planned_order?: number | null;

  // Action configuration
  primary_action_label: string;
  primary_action_url?: string | null;
  fallback_action_label?: string | null;

  // Source tracking
  source: ItemSource;
  source_id?: string | null;

  created_at: string;
  updated_at: string;

  // Relations (optional, for joined queries)
  deal?: { id: string; name: string; stage: string; estimated_value?: number } | null;
  company?: { id: string; name: string } | null;
  contact?: { id: string; name: string; email?: string } | null;
}

// ============================================
// SCORE FACTORS
// ============================================

export interface ScoreFactors {
  base?: {
    value: number;
    explanation: string;
  };
  time?: {
    value: number;
    explanation: string;
  };
  value?: {
    value: number;
    explanation: string;
  };
  engagement?: {
    value: number;
    explanation: string;
    signals?: string[];
  };
  risk?: {
    value: number;
    explanation: string;
    signals?: string[];
  };
  orphan?: {
    value: number;
    explanation: string;
  };
  // Future: win_pattern, timing
}

export interface MomentumScore {
  score: number;
  factors: ScoreFactors;
  explanation: string[];
}

// ============================================
// TIME BLOCKS
// ============================================

export interface TimeBlock {
  start: string;  // ISO datetime
  end: string;    // ISO datetime
  duration_minutes: number;
  type: TimeBlockType;
  meeting_id?: string;
  meeting_title?: string;
  is_external?: boolean;  // External meeting (needs prep)
  planned_items?: PlannedAction[];
}

export interface PlannedAction {
  item_id: string;
  action_type: ActionType;
  title: string;
  estimated_minutes: number;
  momentum_score: number;
  deal_value?: number | null;
}

// ============================================
// DAILY PLAN
// ============================================

export interface DailyPlan {
  id: string;
  user_id: string;
  plan_date: string;  // YYYY-MM-DD

  // Capacity (minutes)
  total_work_minutes: number;
  meeting_minutes: number;
  prep_buffer_minutes: number;
  reactive_buffer_minutes: number;
  available_minutes: number;
  planned_minutes: number;

  // Time blocks
  time_blocks: TimeBlock[];

  // Planned items
  planned_item_ids: string[];

  // Metrics
  total_potential_value: number;
  completed_value: number;
  items_planned: number;
  items_completed: number;
  completion_rate: number;

  // Generation
  generated_at: string;
  last_refreshed_at?: string | null;
  calendar_hash?: string | null;
}

export interface DailyCapacity {
  total_work_minutes: number;
  meeting_minutes: number;
  prep_buffer_minutes: number;
  reactive_buffer_minutes: number;
  available_minutes: number;
  time_blocks: TimeBlock[];
}

// ============================================
// REP TIME PROFILE
// ============================================

export interface RepTimeProfile {
  id: string;
  user_id: string;

  // Work schedule
  work_start_time: string;  // HH:mm
  work_end_time: string;    // HH:mm
  work_days: string[];      // ['Mon', 'Tue', ...]
  timezone: string;

  // Buffers (minutes)
  meeting_prep_buffer: number;
  reactive_buffer: number;
  focus_block_preference: number;

  // Learned durations (overrides defaults)
  action_durations: Record<string, number>;

  // Preferences
  prefer_calls_morning: boolean;
  prefer_email_batching: boolean;
  max_calls_per_day: number;
  max_emails_per_day: number;

  // Stats
  total_actions_completed: number;
  avg_actions_per_day: number;

  created_at: string;
  updated_at: string;
}

// ============================================
// API TYPES
// ============================================

export interface GetDailyPlanResponse {
  success: boolean;
  plan: DailyPlan;

  // All items (for backward compatibility)
  items: CommandCenterItem[];

  // Tier-grouped items (new)
  tier1_items: CommandCenterItem[];  // RESPOND NOW
  tier2_items: CommandCenterItem[];  // DON'T LOSE THIS
  tier3_items: CommandCenterItem[];  // KEEP YOUR WORD
  tier4_items: CommandCenterItem[];  // MOVE BIG DEALS
  tier5_items: CommandCenterItem[];  // BUILD PIPELINE

  // Legacy (deprecated, use tier groups)
  current_item?: CommandCenterItem | null;
  next_items: CommandCenterItem[];
  at_risk_items: CommandCenterItem[];

  overflow_count: number;
  is_work_day?: boolean;
  debug?: {
    server_time: string;
    queried_date: string;
    day_name?: string;
    is_work_day?: boolean;
    user_timezone?: string;
    calendar_events_count: number;
    tier_counts?: {
      tier1: number;
      tier2: number;
      tier3: number;
      tier4: number;
      tier5: number;
    };
  };
}

export interface UpdateItemRequest {
  status?: ItemStatus;
  snoozed_until?: string;
  dismissed_reason?: string;
}

export interface CreateItemRequest {
  action_type: ActionType;
  title: string;
  description?: string;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  due_at?: string;
  estimated_minutes?: number;
}

// ============================================
// UI STATE
// ============================================

export interface CommandCenterState {
  isLoading: boolean;
  plan: DailyPlan | null;
  currentItem: CommandCenterItem | null;
  upNextItems: CommandCenterItem[];
  laterItems: CommandCenterItem[];
  atRiskItems: CommandCenterItem[];
  showScoreBreakdown: boolean;
  currentTime: Date;
}

// ============================================
// ACTION CONFIG
// ============================================

export interface ActionTypeConfig {
  type: ActionType;
  label: string;
  icon: string;
  color: string;
  defaultDuration: number;
  primaryCTA: string;
  fallbackCTA?: string;
}

export const ACTION_TYPE_CONFIGS: Record<ActionType, ActionTypeConfig> = {
  call: {
    type: 'call',
    label: 'Call',
    icon: 'Phone',
    color: 'bg-green-100 text-green-700',
    defaultDuration: 15,
    primaryCTA: 'Call Now',
    fallbackCTA: 'If No Answer',
  },
  call_with_prep: {
    type: 'call_with_prep',
    label: 'Call (with prep)',
    icon: 'PhoneOutgoing',
    color: 'bg-green-100 text-green-700',
    defaultDuration: 25,
    primaryCTA: 'Review & Call',
  },
  email_send_draft: {
    type: 'email_send_draft',
    label: 'Send Email',
    icon: 'Send',
    color: 'bg-blue-100 text-blue-700',
    defaultDuration: 3,
    primaryCTA: 'Review & Send',
  },
  email_compose: {
    type: 'email_compose',
    label: 'Compose Email',
    icon: 'Mail',
    color: 'bg-blue-100 text-blue-700',
    defaultDuration: 10,
    primaryCTA: 'Compose',
  },
  email_respond: {
    type: 'email_respond',
    label: 'Reply',
    icon: 'Reply',
    color: 'bg-blue-100 text-blue-700',
    defaultDuration: 8,
    primaryCTA: 'Reply',
  },
  meeting_prep: {
    type: 'meeting_prep',
    label: 'Meeting Prep',
    icon: 'Calendar',
    color: 'bg-purple-100 text-purple-700',
    defaultDuration: 15,
    primaryCTA: 'Review Brief',
  },
  meeting_follow_up: {
    type: 'meeting_follow_up',
    label: 'Follow Up',
    icon: 'MessageSquare',
    color: 'bg-purple-100 text-purple-700',
    defaultDuration: 10,
    primaryCTA: 'Send Follow-up',
  },
  proposal_review: {
    type: 'proposal_review',
    label: 'Proposal',
    icon: 'FileText',
    color: 'bg-amber-100 text-amber-700',
    defaultDuration: 30,
    primaryCTA: 'Review Proposal',
  },
  linkedin_touch: {
    type: 'linkedin_touch',
    label: 'LinkedIn',
    icon: 'Linkedin',
    color: 'bg-sky-100 text-sky-700',
    defaultDuration: 3,
    primaryCTA: 'Open LinkedIn',
  },
  research_account: {
    type: 'research_account',
    label: 'Research',
    icon: 'Search',
    color: 'bg-gray-100 text-gray-700',
    defaultDuration: 20,
    primaryCTA: 'Start Research',
  },
  internal_sync: {
    type: 'internal_sync',
    label: 'Internal Sync',
    icon: 'Users',
    color: 'bg-gray-100 text-gray-700',
    defaultDuration: 15,
    primaryCTA: 'Schedule Sync',
  },
  task_simple: {
    type: 'task_simple',
    label: 'Task',
    icon: 'CheckSquare',
    color: 'bg-gray-100 text-gray-700',
    defaultDuration: 5,
    primaryCTA: 'Complete',
  },
  task_complex: {
    type: 'task_complex',
    label: 'Task',
    icon: 'ClipboardList',
    color: 'bg-gray-100 text-gray-700',
    defaultDuration: 30,
    primaryCTA: 'Start',
  },
};

// ============================================
// RICH CONTEXT TYPES
// ============================================

export type AvailableAction = 'complete' | 'email' | 'schedule' | 'call';

export interface SourceLink {
  type: 'email' | 'call' | 'meeting' | 'deal' | 'note' | 'document';
  label: string;
  url: string;
}

export interface PrimaryContact {
  name: string;
  email: string;
  title?: string;
  phone?: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
  confidence: number; // 0-100
  generated_at?: string;
}

export interface ScheduleSuggestions {
  suggested_times: string[]; // ISO date strings
  duration_minutes: number;
  meeting_title: string;
  location?: string;
}

// ============================================
// MEETING PREP TYPES
// ============================================

export interface MeetingAttendee {
  email: string;
  name?: string;
  title?: string;
  role?: 'decision_maker' | 'influencer' | 'champion' | 'blocker' | 'unknown';
  relationship_notes?: string;
  meeting_count?: number;
  last_met_at?: string;
}

export interface MeetingPrepContent {
  objective: string;
  talking_points: string[];
  landmines: string[];
  questions_to_ask: string[];
}

export interface PrepMaterial {
  type: 'meeting_notes' | 'email' | 'deal' | 'document' | 'research' | 'meeting' | 'transcript';
  label: string;
  url: string;
}

export interface MeetingWithPrep {
  id: string;
  meeting_id: string;
  meeting_external_id?: string;

  // Meeting details
  title: string;
  start_time: string;
  end_time: string;
  join_url?: string;

  // Context
  company_id?: string;
  company_name?: string;
  deal_id?: string;
  deal_name?: string;
  deal_value?: number;
  deal_stage?: string;
  deal_health?: number;

  // Enriched attendees
  attendees: MeetingAttendee[];

  // AI-generated prep
  prep: MeetingPrepContent;

  // Materials
  prep_materials: PrepMaterial[];

  // Metadata
  generated_at?: string;
  last_refreshed_at?: string;
}

// ============================================
// ENRICHED COMMAND CENTER ITEM
// ============================================

export interface EnrichedCommandCenterItem extends CommandCenterItem {
  // Rich context (new fields)
  context_summary?: string;
  considerations?: string[];
  source_links?: SourceLink[];
  primary_contact?: PrimaryContact;
  email_draft?: EmailDraft;
  schedule_suggestions?: ScheduleSuggestions;
  available_actions?: AvailableAction[];
}
