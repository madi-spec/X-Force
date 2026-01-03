import { LensType, LensConfig } from './types';

/**
 * Lens Configuration
 *
 * Single source of truth for what each lens affects:
 * - Default customer tab
 * - Queue presets
 * - Visible/hidden widgets
 * - Primary CTAs
 */
export const lensConfigs: Record<LensType, LensConfig> = {
  focus: {
    id: 'focus',
    label: 'Focus',
    shortLabel: 'All',
    description: 'Complete view of all work across all areas',
    icon: 'LayoutGrid',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',

    defaultCustomerTab: 'overview',
    tabOrder: ['overview', 'conversations', 'meetings', 'sales', 'onboarding', 'engagement', 'support', 'timeline'],

    headerChips: ['stage', 'health', 'deal_value', 'open_cases', 'owner'],
    hiddenHeaderChips: [],

    defaultQueues: ['commandCenter', 'scheduler', 'supportCases', 'responses'],

    primaryCTAs: [
      'schedule_demo',
      'send_proposal',
      'log_call',
      'create_ticket',
      'schedule_check_in',
    ],

    visibleWidgets: [
      'health_score',
      'deal_pipeline',
      'sales_stages',
      'engagement_timeline',
      'onboarding_progress',
      'open_tickets',
      'recent_communications',
      'account_notes',
      'unified_task_stream',
    ],

    hiddenWidgets: [],

    breadcrumbPrefix: 'Focus',
  },

  customer_success: {
    id: 'customer_success',
    label: 'Customer Success',
    shortLabel: 'CS',
    description: 'Focus on retention, health, and expansion',
    icon: 'HeartHandshake',
    color: 'text-green-600',
    bgColor: 'bg-green-50',

    defaultCustomerTab: 'engagement',
    tabOrder: ['overview', 'engagement', 'conversations', 'meetings', 'support', 'onboarding', 'sales', 'timeline'],

    headerChips: ['health', 'renewal', 'mrr', 'open_cases', 'expansion'],
    hiddenHeaderChips: [],

    defaultQueues: ['commandCenter', 'responses'],

    primaryCTAs: [
      'schedule_check_in',
      'send_health_survey',
      'create_expansion_opportunity',
      'log_interaction',
    ],

    visibleWidgets: [
      'health_score',
      'engagement_timeline',
      'nps_score',
      'usage_metrics',
      'renewal_date',
      'expansion_opportunities',
      'recent_communications',
      'account_notes',
      'unified_task_stream',
    ],

    hiddenWidgets: [
      'deal_pipeline',
      'sales_stages',
      'qualification_criteria',
    ],

    breadcrumbPrefix: 'CS',
  },

  sales: {
    id: 'sales',
    label: 'Sales',
    shortLabel: 'Sales',
    description: 'Focus on pipeline, deals, and revenue',
    icon: 'Target',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',

    defaultCustomerTab: 'sales',
    tabOrder: ['overview', 'sales', 'conversations', 'meetings', 'onboarding', 'engagement', 'support', 'timeline'],

    headerChips: ['stage', 'deal_value', 'close_date', 'owner'],
    hiddenHeaderChips: ['health', 'open_cases', 'sla_status'],

    defaultQueues: ['commandCenter', 'scheduler'],

    primaryCTAs: [
      'create_deal',
      'schedule_demo',
      'send_proposal',
      'log_call',
      'update_stage',
    ],

    visibleWidgets: [
      'deal_pipeline',
      'sales_stages',
      'qualification_criteria',
      'decision_makers',
      'competitor_analysis',
      'deal_value',
      'close_probability',
      'recent_communications',
    ],

    hiddenWidgets: [
      'support_tickets',
      'onboarding_progress',
      'nps_score',
      'health_score',
      'unified_task_stream',
    ],

    breadcrumbPrefix: 'Sales',
  },

  onboarding: {
    id: 'onboarding',
    label: 'Onboarding',
    shortLabel: 'Onboard',
    description: 'Focus on activation and time-to-value',
    icon: 'Rocket',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',

    defaultCustomerTab: 'onboarding',
    tabOrder: ['overview', 'onboarding', 'conversations', 'meetings', 'engagement', 'sales', 'support', 'timeline'],

    headerChips: ['onboarding_stage', 'go_live_date', 'activation_progress', 'owner'],
    hiddenHeaderChips: ['deal_value', 'expansion'],

    defaultQueues: ['commandCenter', 'scheduler'],

    primaryCTAs: [
      'schedule_training',
      'send_welcome_email',
      'create_onboarding_task',
      'mark_milestone_complete',
      'assign_success_manager',
    ],

    visibleWidgets: [
      'onboarding_progress',
      'activation_checklist',
      'training_sessions',
      'time_to_value',
      'key_contacts',
      'implementation_notes',
      'recent_communications',
    ],

    hiddenWidgets: [
      'deal_pipeline',
      'sales_stages',
      'renewal_date',
      'expansion_opportunities',
    ],

    breadcrumbPrefix: 'Onboarding',
  },

  support: {
    id: 'support',
    label: 'Support',
    shortLabel: 'Support',
    description: 'Focus on issue resolution and SLAs',
    icon: 'Ticket',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',

    defaultCustomerTab: 'support',
    tabOrder: ['overview', 'support', 'conversations', 'meetings', 'engagement', 'onboarding', 'sales', 'timeline'],

    headerChips: ['open_cases', 'sla_status', 'severity', 'last_contact'],
    hiddenHeaderChips: ['deal_value', 'expansion', 'health'],

    defaultQueues: ['supportCases', 'responses'],

    primaryCTAs: [
      'create_ticket',
      'escalate_issue',
      'send_update',
      'resolve_ticket',
      'schedule_call',
    ],

    visibleWidgets: [
      'open_tickets',
      'sla_status',
      'ticket_history',
      'known_issues',
      'product_version',
      'contact_preferences',
      'recent_communications',
    ],

    hiddenWidgets: [
      'deal_pipeline',
      'sales_stages',
      'expansion_opportunities',
      'onboarding_progress',
      'unified_task_stream',
    ],

    breadcrumbPrefix: 'Support',
  },
};

/**
 * Get lens config by ID
 */
export function getLensConfig(lens: LensType): LensConfig {
  return lensConfigs[lens];
}

/**
 * Get all lens options for selector
 */
export function getAllLenses(): LensConfig[] {
  return Object.values(lensConfigs);
}

/**
 * Check if a widget should be visible for the current lens
 */
export function isWidgetVisible(lens: LensType, widgetId: string): boolean {
  const config = getLensConfig(lens);
  if (config.hiddenWidgets.includes(widgetId)) return false;
  // If visibleWidgets is specified, only those are visible
  if (config.visibleWidgets.length > 0) {
    return config.visibleWidgets.includes(widgetId);
  }
  return true;
}

/**
 * Check if a CTA should be emphasized for the current lens
 */
export function isPrimaryCTA(lens: LensType, ctaId: string): boolean {
  const config = getLensConfig(lens);
  return config.primaryCTAs.includes(ctaId);
}

/**
 * Check if a queue should be visible by default for the current lens
 */
export function isQueueDefault(lens: LensType, queueId: string): boolean {
  const config = getLensConfig(lens);
  return config.defaultQueues.includes(queueId as LensConfig['defaultQueues'][number]);
}

/**
 * Default lens for new users
 */
export const DEFAULT_LENS: LensType = 'customer_success';
