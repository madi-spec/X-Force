/**
 * Focus → Segment Mapping Configuration
 *
 * Defines which queue segments are visible for each focus lens,
 * and what CTA labels and KPIs to show. This is the single source
 * of truth for lens-based UI filtering.
 *
 * Key principles:
 * - Focus does NOT hide underlying customer reality
 * - Focus FILTERS and EMPHASIZES relevant work
 * - Customer Success sees unified view (At Risk + Expansion + Issues)
 * - Specialists see their domain-specific queues
 */

import { LensType } from './types';
import { QueueId, QUEUE_CONFIGS } from '../work';
import { LifecycleEvent } from '../../types/eventSourcing';

// ============================================================================
// SEGMENT MAPPING TYPES
// ============================================================================

export interface FocusSegmentConfig {
  lens: LensType;

  // Which queue segments are visible for this focus
  visibleQueues: QueueId[];

  // Which queue segments are expanded by default (vs collapsed)
  expandedQueues: QueueId[];

  // Queue display order (first = top of list)
  queueOrder: QueueId[];

  // KPI cards to show in header
  visibleKPIs: FocusKPI[];

  // CTA labels override (empty = use defaults)
  ctaLabels: Record<string, string>;

  // Whether this focus shows unified customer view (CS) or segmented (specialists)
  isUnifiedView: boolean;

  // Optional: Cross-lens queues to show (for CS seeing support issues)
  crossLensQueues: QueueId[];
}

export type FocusKPI =
  | 'health_score'
  | 'at_risk_count'
  | 'expansion_value'
  | 'open_cases'
  | 'avg_resolution_time'
  | 'pipeline_value'
  | 'stalled_deals'
  | 'close_rate'
  | 'onboarding_active'
  | 'blocked_count'
  | 'avg_time_to_value'
  | 'sla_breaches'
  | 'high_severity_count'
  | 'unassigned_count';

// ============================================================================
// DEFAULT SEGMENT CONFIGURATIONS
// ============================================================================

export const FOCUS_SEGMENT_CONFIGS: Record<LensType, FocusSegmentConfig> = {
  focus: {
    lens: 'focus',

    // Focus lens sees ALL queues from all lenses
    visibleQueues: [
      'at_risk', 'expansion_ready', 'unresolved_issues',
      'follow_ups', 'stalled_deals', 'new_leads', 'needs_response', 'scheduling',
      'blocked', 'due_this_week', 'new_kickoffs',
      'sla_breaches', 'high_severity', 'unassigned',
    ],
    expandedQueues: ['at_risk', 'follow_ups', 'sla_breaches'],
    queueOrder: [
      'at_risk', 'follow_ups', 'sla_breaches',
      'expansion_ready', 'stalled_deals', 'high_severity',
      'unresolved_issues', 'new_leads', 'needs_response', 'scheduling',
      'blocked', 'due_this_week', 'new_kickoffs', 'unassigned',
    ],

    crossLensQueues: [], // Focus already sees everything

    visibleKPIs: [
      'at_risk_count',
      'pipeline_value',
      'sla_breaches',
      'health_score',
    ],

    ctaLabels: {
      schedule_meeting: 'Schedule Meeting',
      send_email: 'Send Email',
      create_task: 'Create Task',
      open_customer: 'View Customer',
    },

    isUnifiedView: true,
  },

  customer_success: {
    lens: 'customer_success',

    // CS sees unified view: their queues + cross-lens visibility
    visibleQueues: ['at_risk', 'expansion_ready', 'unresolved_issues'],
    expandedQueues: ['at_risk', 'expansion_ready'],
    queueOrder: ['at_risk', 'expansion_ready', 'unresolved_issues'],

    // Cross-lens: CS can see high-priority support issues
    crossLensQueues: ['sla_breaches', 'high_severity'],

    visibleKPIs: [
      'health_score',
      'at_risk_count',
      'expansion_value',
      'open_cases',
    ],

    ctaLabels: {
      schedule_meeting: 'Schedule Check-in',
      send_email: 'Send Health Update',
      create_task: 'Create Follow-up',
      open_customer: 'View Account',
    },

    isUnifiedView: true,
  },

  sales: {
    lens: 'sales',

    visibleQueues: ['follow_ups', 'stalled_deals', 'new_leads'],
    expandedQueues: ['follow_ups', 'stalled_deals'],
    queueOrder: ['follow_ups', 'stalled_deals', 'new_leads'],

    crossLensQueues: [], // Sales focuses on pipeline only

    visibleKPIs: [
      'pipeline_value',
      'stalled_deals',
      'close_rate',
    ],

    ctaLabels: {
      schedule_meeting: 'Schedule Demo',
      send_email: 'Send Proposal',
      create_task: 'Add Next Step',
      open_customer: 'View Deal',
    },

    isUnifiedView: false,
  },

  onboarding: {
    lens: 'onboarding',

    visibleQueues: ['blocked', 'due_this_week', 'new_kickoffs'],
    expandedQueues: ['blocked', 'due_this_week'],
    queueOrder: ['blocked', 'due_this_week', 'new_kickoffs'],

    crossLensQueues: [], // Onboarding specialists focus on their domain

    visibleKPIs: [
      'onboarding_active',
      'blocked_count',
      'avg_time_to_value',
    ],

    ctaLabels: {
      schedule_meeting: 'Schedule Training',
      send_email: 'Send Setup Guide',
      create_task: 'Add Milestone',
      open_customer: 'View Onboarding',
    },

    isUnifiedView: false,
  },

  support: {
    lens: 'support',

    visibleQueues: ['sla_breaches', 'high_severity', 'unassigned'],
    expandedQueues: ['sla_breaches', 'high_severity'],
    queueOrder: ['sla_breaches', 'high_severity', 'unassigned'],

    crossLensQueues: [], // Support specialists focus on cases

    visibleKPIs: [
      'sla_breaches',
      'high_severity_count',
      'avg_resolution_time',
      'unassigned_count',
    ],

    ctaLabels: {
      schedule_meeting: 'Schedule Call',
      send_email: 'Send Update',
      create_task: 'Add Action Item',
      open_customer: 'View Tickets',
    },

    isUnifiedView: false,
  },
};

// ============================================================================
// ROLE-BASED FOCUS RESTRICTIONS
// ============================================================================

export type UserRole =
  | 'admin'
  | 'sales_rep'
  | 'sales_manager'
  | 'onboarding_specialist'
  | 'onboarding_manager'
  | 'support_agent'
  | 'support_manager'
  | 'customer_success_manager'
  | 'cs_manager';

export interface FocusRestriction {
  role: UserRole;
  // Allowed lenses (empty = all allowed)
  allowedLenses: LensType[];
  // Default lens for this role
  defaultLens: LensType;
  // Can this role switch lenses?
  canSwitchLens: boolean;
  // Navigation items to hide
  hiddenNavItems: string[];
}

export const ROLE_FOCUS_RESTRICTIONS: Record<UserRole, FocusRestriction> = {
  admin: {
    role: 'admin',
    allowedLenses: ['focus', 'customer_success', 'sales', 'onboarding', 'support'],
    defaultLens: 'focus',
    canSwitchLens: true,
    hiddenNavItems: [],
  },

  sales_rep: {
    role: 'sales_rep',
    allowedLenses: ['focus', 'sales'],
    defaultLens: 'sales',
    canSwitchLens: true,
    hiddenNavItems: ['support_cases', 'onboarding_dashboard'],
  },

  sales_manager: {
    role: 'sales_manager',
    allowedLenses: ['focus', 'sales', 'customer_success'],
    defaultLens: 'sales',
    canSwitchLens: true,
    hiddenNavItems: [],
  },

  onboarding_specialist: {
    role: 'onboarding_specialist',
    allowedLenses: ['focus', 'onboarding'],
    defaultLens: 'onboarding',
    canSwitchLens: true,
    hiddenNavItems: ['pipeline', 'support_cases', 'products'],
  },

  onboarding_manager: {
    role: 'onboarding_manager',
    allowedLenses: ['focus', 'onboarding', 'customer_success'],
    defaultLens: 'onboarding',
    canSwitchLens: true,
    hiddenNavItems: [],
  },

  support_agent: {
    role: 'support_agent',
    allowedLenses: ['focus', 'support'],
    defaultLens: 'support',
    canSwitchLens: true,
    hiddenNavItems: ['pipeline', 'onboarding_dashboard', 'products'],
  },

  support_manager: {
    role: 'support_manager',
    allowedLenses: ['focus', 'support', 'customer_success'],
    defaultLens: 'support',
    canSwitchLens: true,
    hiddenNavItems: [],
  },

  customer_success_manager: {
    role: 'customer_success_manager',
    allowedLenses: ['focus', 'customer_success', 'sales', 'support'],
    defaultLens: 'customer_success',
    canSwitchLens: true,
    hiddenNavItems: [],
  },

  cs_manager: {
    role: 'cs_manager',
    allowedLenses: ['focus', 'customer_success', 'sales', 'onboarding', 'support'],
    defaultLens: 'focus',
    canSwitchLens: true,
    hiddenNavItems: [],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get segment config for a lens
 */
export function getFocusSegmentConfig(lens: LensType): FocusSegmentConfig {
  return FOCUS_SEGMENT_CONFIGS[lens];
}

/**
 * Get all visible queues for a lens (including cross-lens)
 */
export function getVisibleQueuesForLens(lens: LensType): QueueId[] {
  const config = FOCUS_SEGMENT_CONFIGS[lens];
  return [...config.visibleQueues, ...config.crossLensQueues];
}

/**
 * Check if a queue is visible for a lens
 */
export function isQueueVisibleForLens(lens: LensType, queueId: QueueId): boolean {
  const visibleQueues = getVisibleQueuesForLens(lens);
  return visibleQueues.includes(queueId);
}

/**
 * Get CTA label for current lens (with fallback)
 */
export function getCTALabel(lens: LensType, ctaId: string, defaultLabel: string): string {
  const config = FOCUS_SEGMENT_CONFIGS[lens];
  return config.ctaLabels[ctaId] || defaultLabel;
}

/**
 * Get focus restriction for a user role
 */
export function getFocusRestriction(role: UserRole): FocusRestriction {
  return ROLE_FOCUS_RESTRICTIONS[role];
}

/**
 * Check if a user can access a lens
 */
export function canAccessLens(role: UserRole, lens: LensType): boolean {
  const restriction = ROLE_FOCUS_RESTRICTIONS[role];
  if (restriction.allowedLenses.length === 0) return true;
  return restriction.allowedLenses.includes(lens);
}

/**
 * Check if a user can switch lenses
 */
export function canSwitchLens(role: UserRole): boolean {
  return ROLE_FOCUS_RESTRICTIONS[role].canSwitchLens;
}

/**
 * Get default lens for a user role
 */
export function getDefaultLensForRole(role: UserRole): LensType {
  return ROLE_FOCUS_RESTRICTIONS[role].defaultLens;
}

/**
 * Check if a nav item should be hidden for a role
 */
export function isNavItemHidden(role: UserRole, navItemId: string): boolean {
  const restriction = ROLE_FOCUS_RESTRICTIONS[role];
  return restriction.hiddenNavItems.includes(navItemId);
}

/**
 * Get ordered queue configs for a lens
 */
export function getOrderedQueuesForLens(lens: LensType) {
  const segmentConfig = FOCUS_SEGMENT_CONFIGS[lens];

  // Get queue configs in the specified order
  return segmentConfig.queueOrder
    .map(queueId => QUEUE_CONFIGS.find(q => q.id === queueId))
    .filter((q): q is (typeof QUEUE_CONFIGS)[number] => q !== undefined);
}

// ============================================================================
// EVENTED CONFIGURATION (for admin overrides)
// ============================================================================

/**
 * Event for when focus segment mapping is updated by admin
 */
export interface FocusSegmentMappingUpdatedEvent extends LifecycleEvent<'FocusSegmentMappingUpdated'> {
  event_data: {
    lens: LensType;
    previous_config: FocusSegmentConfig;
    new_config: FocusSegmentConfig;
    updated_by_user_id: string;
    reason?: string;
  };
}

/**
 * Event for when role focus restriction is updated by admin
 */
export interface RoleFocusRestrictionUpdatedEvent extends LifecycleEvent<'RoleFocusRestrictionUpdated'> {
  event_data: {
    role: UserRole;
    previous_restriction: FocusRestriction;
    new_restriction: FocusRestriction;
    updated_by_user_id: string;
    reason?: string;
  };
}

export type FocusConfigEvent =
  | FocusSegmentMappingUpdatedEvent
  | RoleFocusRestrictionUpdatedEvent;
