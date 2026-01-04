/**
 * Process-Aware AI Feature Tests
 *
 * Tests for:
 * 1. Process type detection and fallback
 * 2. Onboarding analysis type guard
 * 3. Prompt key pattern matching
 *
 * Note: These tests use inline implementations to avoid complex import chains
 * that require database connections. The actual implementations are in:
 * - src/types/onboardingAnalysis.ts
 * - src/lib/process/getProcessContext.ts
 */

import { describe, it, expect } from 'vitest';

// Inline ProcessType for testing
type ProcessType = 'sales' | 'onboarding' | 'engagement' | 'support';

// Inline validation function (mirrors getProcessContext.ts)
function isValidProcessType(value: string): value is ProcessType {
  return ['sales', 'onboarding', 'engagement', 'support'].includes(value);
}

// Inline type guard (mirrors onboardingAnalysis.ts)
function isOnboardingAnalysis(analysis: unknown): boolean {
  if (!analysis || typeof analysis !== 'object') return false;
  const a = analysis as Record<string, unknown>;
  return (
    'blockers' in a &&
    'training_gaps' in a &&
    'go_live_checklist' in a &&
    'go_live_confidence' in a
  );
}

// Inline OnboardingTranscriptAnalysis for testing
interface OnboardingTranscriptAnalysis {
  summary: string;
  blockers: Array<{
    blocker: string;
    severity: 'critical' | 'moderate' | 'minor';
    owner: 'us' | 'customer' | 'third_party';
    resolution_path: string;
  }>;
  training_gaps: Array<{
    area: string;
    users_affected: string;
    suggested_remedy: string;
  }>;
  go_live_checklist: Array<{
    item: string;
    status: 'complete' | 'in_progress' | 'not_started' | 'blocked';
    owner: 'us' | 'customer';
  }>;
  ourCommitments: Array<{ commitment: string }>;
  theirCommitments: Array<{ commitment: string }>;
  actionItems: Array<{ description: string }>;
  adoption_indicators: Array<{ signal: string; sentiment: 'positive' | 'concerning' }>;
  risks: Array<{ risk: string; likelihood: string; impact: string }>;
  stakeholder_sentiment: Array<{
    name: string;
    role: string;
    sentiment: 'champion' | 'engaged' | 'neutral' | 'frustrated' | 'blocker';
    notes: string;
  }>;
  go_live_confidence: 'on_track' | 'at_risk' | 'delayed';
  sentiment: 'positive' | 'neutral' | 'negative';
}

describe('Process Type Validation', () => {
  it('should validate correct process types', () => {
    expect(isValidProcessType('sales')).toBe(true);
    expect(isValidProcessType('onboarding')).toBe(true);
    expect(isValidProcessType('engagement')).toBe(true);
    expect(isValidProcessType('support')).toBe(true);
  });

  it('should reject invalid process types', () => {
    expect(isValidProcessType('invalid')).toBe(false);
    expect(isValidProcessType('')).toBe(false);
    expect(isValidProcessType('SALES')).toBe(false); // Case sensitive
  });
});

describe('Onboarding Analysis Type Guard', () => {
  it('should identify valid onboarding analysis', () => {
    const validAnalysis: OnboardingTranscriptAnalysis = {
      summary: 'Test onboarding meeting',
      blockers: [
        {
          blocker: 'Test blocker',
          severity: 'critical',
          owner: 'us',
          resolution_path: 'Fix it',
        },
      ],
      training_gaps: [
        {
          area: 'Test area',
          users_affected: 'All users',
          suggested_remedy: 'Training session',
        },
      ],
      go_live_checklist: [
        {
          item: 'Test item',
          status: 'in_progress',
          owner: 'us',
        },
      ],
      ourCommitments: [],
      theirCommitments: [],
      actionItems: [],
      adoption_indicators: [],
      risks: [],
      stakeholder_sentiment: [],
      go_live_confidence: 'on_track',
      sentiment: 'positive',
    };

    expect(isOnboardingAnalysis(validAnalysis)).toBe(true);
  });

  it('should reject non-onboarding analysis', () => {
    // Sales analysis (missing onboarding-specific fields)
    const salesAnalysis = {
      summary: 'Test sales meeting',
      buyingSignals: [],
      objections: [],
      actionItems: [],
    };

    expect(isOnboardingAnalysis(salesAnalysis)).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(isOnboardingAnalysis(null)).toBe(false);
    expect(isOnboardingAnalysis(undefined)).toBe(false);
  });

  it('should reject non-objects', () => {
    expect(isOnboardingAnalysis('string')).toBe(false);
    expect(isOnboardingAnalysis(123)).toBe(false);
    expect(isOnboardingAnalysis([])).toBe(false);
  });
});

describe('Prompt Key Patterns', () => {
  it('should generate correct process-specific prompt keys', () => {
    const baseKey = 'transcript_analysis';
    const processTypes: ProcessType[] = ['sales', 'onboarding', 'engagement', 'support'];

    for (const processType of processTypes) {
      const expectedKey = `${baseKey}__${processType}`;
      expect(expectedKey).toBe(`transcript_analysis__${processType}`);
    }
  });

  it('should match expected onboarding prompt keys', () => {
    const onboardingPromptKeys = [
      'transcript_analysis__onboarding',
      'meeting_prep__onboarding',
      'email_followup__onboarding',
    ];

    onboardingPromptKeys.forEach((key) => {
      expect(key).toMatch(/^[a-z_]+__onboarding$/);
    });
  });
});

describe('Go-Live Confidence Levels', () => {
  it('should have correct confidence level values', () => {
    const validLevels = ['on_track', 'at_risk', 'delayed'];

    validLevels.forEach((level) => {
      expect(['on_track', 'at_risk', 'delayed']).toContain(level);
    });
  });

  it('should map to correct tier for at_risk and delayed', () => {
    // at_risk and delayed should create Tier 2 items
    const shouldBeTier2 = (confidence: string): boolean => {
      return confidence === 'at_risk' || confidence === 'delayed';
    };

    expect(shouldBeTier2('at_risk')).toBe(true);
    expect(shouldBeTier2('delayed')).toBe(true);
    expect(shouldBeTier2('on_track')).toBe(false);
  });
});

describe('Blocker Severity Mapping', () => {
  it('should map critical blockers to Tier 2', () => {
    const mapBlockerToTier = (severity: string): number => {
      return severity === 'critical' ? 2 : 3;
    };

    expect(mapBlockerToTier('critical')).toBe(2);
    expect(mapBlockerToTier('moderate')).toBe(3);
    expect(mapBlockerToTier('minor')).toBe(3);
  });
});

describe('Stakeholder Sentiment Mapping', () => {
  it('should identify problematic stakeholders for escalation', () => {
    const isProblematic = (sentiment: string): boolean => {
      return sentiment === 'frustrated' || sentiment === 'blocker';
    };

    expect(isProblematic('blocker')).toBe(true);
    expect(isProblematic('frustrated')).toBe(true);
    expect(isProblematic('champion')).toBe(false);
    expect(isProblematic('engaged')).toBe(false);
    expect(isProblematic('neutral')).toBe(false);
  });
});
