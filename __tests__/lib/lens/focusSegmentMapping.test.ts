/**
 * Focus → Segment Mapping Tests
 *
 * Verifies:
 * - CS users see unified queues (at_risk, expansion_ready, unresolved_issues + cross-lens)
 * - Specialist users (onboarding, support) are restricted to their domain
 * - Role-based nav hiding works correctly
 * - Work item → Customer Hub deep linking provides correct tab
 */

import { describe, it, expect } from 'vitest';
import {
  FOCUS_SEGMENT_CONFIGS,
  ROLE_FOCUS_RESTRICTIONS,
  getFocusSegmentConfig,
  getVisibleQueuesForLens,
  isQueueVisibleForLens,
  getCTALabel,
  canAccessLens,
  canSwitchLens,
  getDefaultLensForRole,
  isNavItemHidden,
  getOrderedQueuesForLens,
  UserRole,
} from '../../../src/lib/lens/focusSegmentMapping';

// ============================================================================
// CS USER UNIFIED QUEUES
// ============================================================================

describe('CS User Unified Queues', () => {
  const csConfig = FOCUS_SEGMENT_CONFIGS.customer_success;

  it('CS focus shows at_risk, expansion_ready, and unresolved_issues queues', () => {
    expect(csConfig.visibleQueues).toContain('at_risk');
    expect(csConfig.visibleQueues).toContain('expansion_ready');
    expect(csConfig.visibleQueues).toContain('unresolved_issues');
  });

  it('CS focus has cross-lens visibility into support queues', () => {
    expect(csConfig.crossLensQueues).toContain('sla_breaches');
    expect(csConfig.crossLensQueues).toContain('high_severity');
  });

  it('getVisibleQueuesForLens returns combined queues + cross-lens', () => {
    const queues = getVisibleQueuesForLens('customer_success');

    // Direct queues
    expect(queues).toContain('at_risk');
    expect(queues).toContain('expansion_ready');
    expect(queues).toContain('unresolved_issues');

    // Cross-lens queues
    expect(queues).toContain('sla_breaches');
    expect(queues).toContain('high_severity');
  });

  it('CS focus is marked as unified view', () => {
    expect(csConfig.isUnifiedView).toBe(true);
  });

  it('CS focus has relevant KPIs', () => {
    expect(csConfig.visibleKPIs).toContain('health_score');
    expect(csConfig.visibleKPIs).toContain('at_risk_count');
    expect(csConfig.visibleKPIs).toContain('expansion_value');
  });

  it('isQueueVisibleForLens correctly identifies visible queues', () => {
    expect(isQueueVisibleForLens('customer_success', 'at_risk')).toBe(true);
    expect(isQueueVisibleForLens('customer_success', 'sla_breaches')).toBe(true);
    expect(isQueueVisibleForLens('customer_success', 'blocked')).toBe(false); // Onboarding queue
  });
});

// ============================================================================
// ONBOARDING-ONLY USER RESTRICTIONS
// ============================================================================

describe('Onboarding-Only User Restrictions', () => {
  const restriction = ROLE_FOCUS_RESTRICTIONS.onboarding_specialist;

  it('onboarding_specialist can only access onboarding lens', () => {
    expect(restriction.allowedLenses).toEqual(['onboarding']);
  });

  it('onboarding_specialist cannot switch lenses', () => {
    expect(restriction.canSwitchLens).toBe(false);
    expect(canSwitchLens('onboarding_specialist')).toBe(false);
  });

  it('onboarding_specialist has hidden nav items', () => {
    expect(restriction.hiddenNavItems).toContain('pipeline');
    expect(restriction.hiddenNavItems).toContain('support_cases');
    expect(restriction.hiddenNavItems).toContain('products');
  });

  it('canAccessLens returns false for non-onboarding lenses', () => {
    expect(canAccessLens('onboarding_specialist', 'onboarding')).toBe(true);
    expect(canAccessLens('onboarding_specialist', 'sales')).toBe(false);
    expect(canAccessLens('onboarding_specialist', 'support')).toBe(false);
    expect(canAccessLens('onboarding_specialist', 'customer_success')).toBe(false);
  });

  it('isNavItemHidden hides correct items for onboarding_specialist', () => {
    expect(isNavItemHidden('onboarding_specialist', 'pipeline')).toBe(true);
    expect(isNavItemHidden('onboarding_specialist', 'support_cases')).toBe(true);
    expect(isNavItemHidden('onboarding_specialist', 'products')).toBe(true);
    expect(isNavItemHidden('onboarding_specialist', 'work')).toBe(false);
  });

  it('getDefaultLensForRole returns onboarding for onboarding_specialist', () => {
    expect(getDefaultLensForRole('onboarding_specialist')).toBe('onboarding');
  });
});

// ============================================================================
// SUPPORT-ONLY USER RESTRICTIONS
// ============================================================================

describe('Support-Only User Restrictions', () => {
  const restriction = ROLE_FOCUS_RESTRICTIONS.support_agent;

  it('support_agent can only access support lens', () => {
    expect(restriction.allowedLenses).toEqual(['support']);
  });

  it('support_agent cannot switch lenses', () => {
    expect(canSwitchLens('support_agent')).toBe(false);
  });

  it('support_agent has hidden nav items', () => {
    expect(restriction.hiddenNavItems).toContain('pipeline');
    expect(restriction.hiddenNavItems).toContain('onboarding_dashboard');
    expect(restriction.hiddenNavItems).toContain('products');
  });

  it('support focus shows correct queues', () => {
    const queues = getVisibleQueuesForLens('support');
    expect(queues).toContain('sla_breaches');
    expect(queues).toContain('high_severity');
    expect(queues).toContain('unassigned');
  });
});

// ============================================================================
// ADMIN/MANAGER FULL ACCESS
// ============================================================================

describe('Admin and Manager Full Access', () => {
  it('admin can access all lenses', () => {
    const restriction = ROLE_FOCUS_RESTRICTIONS.admin;
    expect(restriction.allowedLenses).toEqual([
      'customer_success',
      'sales',
      'onboarding',
      'support',
    ]);
    expect(canSwitchLens('admin')).toBe(true);
  });

  it('cs_manager can access all lenses', () => {
    expect(canAccessLens('cs_manager', 'customer_success')).toBe(true);
    expect(canAccessLens('cs_manager', 'sales')).toBe(true);
    expect(canAccessLens('cs_manager', 'onboarding')).toBe(true);
    expect(canAccessLens('cs_manager', 'support')).toBe(true);
    expect(canSwitchLens('cs_manager')).toBe(true);
  });

  it('admin has no hidden nav items', () => {
    const restriction = ROLE_FOCUS_RESTRICTIONS.admin;
    expect(restriction.hiddenNavItems).toHaveLength(0);
  });

  it('sales_manager can switch to CS lens for account visibility', () => {
    expect(canAccessLens('sales_manager', 'sales')).toBe(true);
    expect(canAccessLens('sales_manager', 'customer_success')).toBe(true);
    expect(canSwitchLens('sales_manager')).toBe(true);
  });
});

// ============================================================================
// SALES FOCUS CONFIGURATION
// ============================================================================

describe('Sales Focus Configuration', () => {
  const salesConfig = FOCUS_SEGMENT_CONFIGS.sales;

  it('sales focus shows follow_ups, stalled_deals, new_leads queues', () => {
    expect(salesConfig.visibleQueues).toContain('follow_ups');
    expect(salesConfig.visibleQueues).toContain('stalled_deals');
    expect(salesConfig.visibleQueues).toContain('new_leads');
  });

  it('sales focus has no cross-lens queues (focused on pipeline)', () => {
    expect(salesConfig.crossLensQueues).toHaveLength(0);
  });

  it('sales focus is NOT unified view', () => {
    expect(salesConfig.isUnifiedView).toBe(false);
  });

  it('sales focus has relevant KPIs', () => {
    expect(salesConfig.visibleKPIs).toContain('pipeline_value');
    expect(salesConfig.visibleKPIs).toContain('stalled_deals');
    expect(salesConfig.visibleKPIs).toContain('close_rate');
  });

  it('sales_rep cannot access other lenses', () => {
    expect(canAccessLens('sales_rep', 'sales')).toBe(true);
    expect(canAccessLens('sales_rep', 'customer_success')).toBe(false);
    expect(canSwitchLens('sales_rep')).toBe(false);
  });
});

// ============================================================================
// CTA LABELS BY FOCUS
// ============================================================================

describe('CTA Labels by Focus', () => {
  it('CS focus has appropriate CTA labels', () => {
    expect(getCTALabel('customer_success', 'schedule_meeting', 'Schedule')).toBe(
      'Schedule Check-in'
    );
    expect(getCTALabel('customer_success', 'send_email', 'Email')).toBe(
      'Send Health Update'
    );
    expect(getCTALabel('customer_success', 'open_customer', 'Open')).toBe(
      'View Account'
    );
  });

  it('sales focus has appropriate CTA labels', () => {
    expect(getCTALabel('sales', 'schedule_meeting', 'Schedule')).toBe(
      'Schedule Demo'
    );
    expect(getCTALabel('sales', 'send_email', 'Email')).toBe('Send Proposal');
    expect(getCTALabel('sales', 'open_customer', 'Open')).toBe('View Deal');
  });

  it('onboarding focus has appropriate CTA labels', () => {
    expect(getCTALabel('onboarding', 'schedule_meeting', 'Schedule')).toBe(
      'Schedule Training'
    );
    expect(getCTALabel('onboarding', 'send_email', 'Email')).toBe(
      'Send Setup Guide'
    );
  });

  it('support focus has appropriate CTA labels', () => {
    expect(getCTALabel('support', 'schedule_meeting', 'Schedule')).toBe(
      'Schedule Call'
    );
    expect(getCTALabel('support', 'send_email', 'Email')).toBe('Send Update');
  });

  it('unknown CTA returns default label', () => {
    expect(getCTALabel('sales', 'unknown_cta', 'Fallback')).toBe('Fallback');
  });
});

// ============================================================================
// QUEUE ORDERING
// ============================================================================

describe('Queue Ordering', () => {
  it('CS focus has correct queue order', () => {
    const config = getFocusSegmentConfig('customer_success');
    expect(config.queueOrder).toEqual([
      'at_risk',
      'expansion_ready',
      'unresolved_issues',
    ]);
  });

  it('sales focus has correct queue order', () => {
    const config = getFocusSegmentConfig('sales');
    expect(config.queueOrder).toEqual(['follow_ups', 'stalled_deals', 'new_leads']);
  });

  it('onboarding focus has correct queue order', () => {
    const config = getFocusSegmentConfig('onboarding');
    expect(config.queueOrder).toEqual(['blocked', 'due_this_week', 'new_kickoffs']);
  });

  it('support focus has correct queue order', () => {
    const config = getFocusSegmentConfig('support');
    expect(config.queueOrder).toEqual(['sla_breaches', 'high_severity', 'unassigned']);
  });
});

// ============================================================================
// EXPANDED QUEUES (DEFAULT VIEW)
// ============================================================================

describe('Expanded Queues (Default View)', () => {
  it('CS focus expands at_risk and expansion_ready by default', () => {
    const config = getFocusSegmentConfig('customer_success');
    expect(config.expandedQueues).toContain('at_risk');
    expect(config.expandedQueues).toContain('expansion_ready');
    expect(config.expandedQueues).not.toContain('unresolved_issues');
  });

  it('support focus expands sla_breaches and high_severity by default', () => {
    const config = getFocusSegmentConfig('support');
    expect(config.expandedQueues).toContain('sla_breaches');
    expect(config.expandedQueues).toContain('high_severity');
    expect(config.expandedQueues).not.toContain('unassigned');
  });
});

// ============================================================================
// ALL ROLE CONFIGURATIONS VALID
// ============================================================================

describe('All Role Configurations Valid', () => {
  const allRoles: UserRole[] = [
    'admin',
    'sales_rep',
    'sales_manager',
    'onboarding_specialist',
    'onboarding_manager',
    'support_agent',
    'support_manager',
    'customer_success_manager',
    'cs_manager',
  ];

  it('every role has a default lens', () => {
    for (const role of allRoles) {
      const defaultLens = getDefaultLensForRole(role);
      expect(defaultLens).toBeDefined();
      expect(['customer_success', 'sales', 'onboarding', 'support']).toContain(
        defaultLens
      );
    }
  });

  it('every role can access at least their default lens', () => {
    for (const role of allRoles) {
      const defaultLens = getDefaultLensForRole(role);
      expect(canAccessLens(role, defaultLens)).toBe(true);
    }
  });

  it('non-switching roles have exactly one allowed lens', () => {
    const nonSwitchingRoles: UserRole[] = [
      'sales_rep',
      'onboarding_specialist',
      'support_agent',
    ];

    for (const role of nonSwitchingRoles) {
      expect(canSwitchLens(role)).toBe(false);
      const restriction = ROLE_FOCUS_RESTRICTIONS[role];
      expect(restriction.allowedLenses).toHaveLength(1);
    }
  });
});
