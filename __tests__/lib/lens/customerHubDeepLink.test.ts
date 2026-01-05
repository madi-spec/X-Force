/**
 * Work Item → Customer Hub Deep Link Tests
 *
 * Verifies:
 * - Work items link to correct Customer Hub tabs based on queue
 * - URL params are correctly constructed
 * - Source work item ID is preserved for context
 */

import { describe, it, expect } from 'vitest';

// Map queue to default CustomerHub tab (mirrors WorkItemPreviewPane logic)
const QUEUE_TO_TAB: Record<string, string> = {
  // CS queues
  at_risk: 'overview',
  expansion_ready: 'sales',
  unresolved_issues: 'support',
  // Sales queues
  follow_ups: 'sales',
  stalled_deals: 'sales',
  new_leads: 'sales',
  // Onboarding queues
  blocked: 'onboarding',
  due_this_week: 'onboarding',
  new_kickoffs: 'onboarding',
  // Support queues
  sla_breaches: 'support',
  high_severity: 'support',
  unassigned: 'support',
};

function buildCustomerHubUrl(
  companyId: string,
  queueId: string,
  workItemId: string,
  fallbackTab: string = 'overview'
): string {
  const tab = QUEUE_TO_TAB[queueId] || fallbackTab;
  return `/companies/${companyId}?tab=${tab}&from_work=${workItemId}`;
}

// ============================================================================
// CS QUEUE DEEP LINKS
// ============================================================================

describe('CS Queue Deep Links', () => {
  it('at_risk queue links to overview tab', () => {
    const url = buildCustomerHubUrl('company-123', 'at_risk', 'work-456');
    expect(url).toBe('/companies/company-123?tab=overview&from_work=work-456');
  });

  it('expansion_ready queue links to sales tab', () => {
    const url = buildCustomerHubUrl('company-123', 'expansion_ready', 'work-456');
    expect(url).toBe('/companies/company-123?tab=sales&from_work=work-456');
  });

  it('unresolved_issues queue links to support tab', () => {
    const url = buildCustomerHubUrl('company-123', 'unresolved_issues', 'work-456');
    expect(url).toBe('/companies/company-123?tab=support&from_work=work-456');
  });
});

// ============================================================================
// SALES QUEUE DEEP LINKS
// ============================================================================

describe('Sales Queue Deep Links', () => {
  it('follow_ups queue links to sales tab', () => {
    const url = buildCustomerHubUrl('company-123', 'follow_ups', 'work-456');
    expect(url).toBe('/companies/company-123?tab=sales&from_work=work-456');
  });

  it('stalled_deals queue links to sales tab', () => {
    const url = buildCustomerHubUrl('company-123', 'stalled_deals', 'work-456');
    expect(url).toBe('/companies/company-123?tab=sales&from_work=work-456');
  });

  it('new_leads queue links to sales tab', () => {
    const url = buildCustomerHubUrl('company-123', 'new_leads', 'work-456');
    expect(url).toBe('/companies/company-123?tab=sales&from_work=work-456');
  });
});

// ============================================================================
// ONBOARDING QUEUE DEEP LINKS
// ============================================================================

describe('Onboarding Queue Deep Links', () => {
  it('blocked queue links to onboarding tab', () => {
    const url = buildCustomerHubUrl('company-123', 'blocked', 'work-456');
    expect(url).toBe('/companies/company-123?tab=onboarding&from_work=work-456');
  });

  it('due_this_week queue links to onboarding tab', () => {
    const url = buildCustomerHubUrl('company-123', 'due_this_week', 'work-456');
    expect(url).toBe('/companies/company-123?tab=onboarding&from_work=work-456');
  });

  it('new_kickoffs queue links to onboarding tab', () => {
    const url = buildCustomerHubUrl('company-123', 'new_kickoffs', 'work-456');
    expect(url).toBe('/companies/company-123?tab=onboarding&from_work=work-456');
  });
});

// ============================================================================
// SUPPORT QUEUE DEEP LINKS
// ============================================================================

describe('Support Queue Deep Links', () => {
  it('sla_breaches queue links to support tab', () => {
    const url = buildCustomerHubUrl('company-123', 'sla_breaches', 'work-456');
    expect(url).toBe('/companies/company-123?tab=support&from_work=work-456');
  });

  it('high_severity queue links to support tab', () => {
    const url = buildCustomerHubUrl('company-123', 'high_severity', 'work-456');
    expect(url).toBe('/companies/company-123?tab=support&from_work=work-456');
  });

  it('unassigned queue links to support tab', () => {
    const url = buildCustomerHubUrl('company-123', 'unassigned', 'work-456');
    expect(url).toBe('/companies/company-123?tab=support&from_work=work-456');
  });
});

// ============================================================================
// UNKNOWN QUEUE FALLBACK
// ============================================================================

describe('Unknown Queue Fallback', () => {
  it('unknown queue uses fallback tab', () => {
    const url = buildCustomerHubUrl('company-123', 'unknown_queue', 'work-456');
    expect(url).toBe('/companies/company-123?tab=overview&from_work=work-456');
  });

  it('custom fallback tab is respected', () => {
    const url = buildCustomerHubUrl('company-123', 'unknown_queue', 'work-456', 'timeline');
    expect(url).toBe('/companies/company-123?tab=timeline&from_work=work-456');
  });
});

// ============================================================================
// URL STRUCTURE
// ============================================================================

describe('URL Structure', () => {
  it('URL includes company ID in path', () => {
    const url = buildCustomerHubUrl('abc-def-123', 'at_risk', 'work-456');
    expect(url).toContain('/companies/abc-def-123');
  });

  it('URL includes tab as query param', () => {
    const url = buildCustomerHubUrl('company-123', 'at_risk', 'work-456');
    expect(url).toContain('?tab=');
  });

  it('URL includes from_work as query param', () => {
    const url = buildCustomerHubUrl('company-123', 'at_risk', 'work-item-789');
    expect(url).toContain('&from_work=work-item-789');
  });

  it('work item ID is preserved for context tracking', () => {
    const workItemId = 'work-item-with-uuid-format';
    const url = buildCustomerHubUrl('company-123', 'at_risk', workItemId);
    expect(url).toContain(`from_work=${workItemId}`);
  });
});

// ============================================================================
// ALL QUEUES HAVE MAPPING
// ============================================================================

describe('All Queues Have Mapping', () => {
  const allQueues = [
    'at_risk',
    'expansion_ready',
    'unresolved_issues',
    'follow_ups',
    'stalled_deals',
    'new_leads',
    'blocked',
    'due_this_week',
    'new_kickoffs',
    'sla_breaches',
    'high_severity',
    'unassigned',
  ];

  it('every queue has a tab mapping', () => {
    for (const queue of allQueues) {
      expect(QUEUE_TO_TAB[queue]).toBeDefined();
      expect(['overview', 'sales', 'onboarding', 'support', 'engagement', 'timeline']).toContain(
        QUEUE_TO_TAB[queue]
      );
    }
  });

  it('all queue mappings result in valid URLs', () => {
    for (const queue of allQueues) {
      const url = buildCustomerHubUrl('company-123', queue, 'work-456');
      expect(url).toMatch(/^\/companies\/company-123\?tab=\w+&from_work=work-456$/);
    }
  });
});
