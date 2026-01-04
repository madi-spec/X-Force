/**
 * Onboarding Transcript Analysis Types
 * Process-specific analysis output for onboarding meetings
 */

import type { Sentiment } from './index';

// Re-export shared types
export type { Sentiment };

/**
 * Commitment made during a meeting
 */
export interface Commitment {
  commitment: string;
  due_date?: string;
  owner?: string;
}

/**
 * Action item from meeting
 */
export interface ActionItem {
  description: string;
  owner?: string;
  due_date?: string;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Implementation blocker identified during onboarding
 */
export interface OnboardingBlocker {
  blocker: string;
  severity: 'critical' | 'moderate' | 'minor';
  owner: 'us' | 'customer' | 'third_party';
  resolution_path: string;
}

/**
 * Training gap identified during onboarding
 */
export interface TrainingGap {
  area: string;
  users_affected: string;
  suggested_remedy: string;
}

/**
 * Go-live checklist item status
 */
export interface GoLiveChecklistItem {
  item: string;
  status: 'complete' | 'in_progress' | 'not_started' | 'blocked';
  owner: 'us' | 'customer';
  due_date?: string;
}

/**
 * Adoption indicator signal
 */
export interface AdoptionIndicator {
  signal: string;
  sentiment: 'positive' | 'concerning';
  quote?: string;
}

/**
 * Risk to successful implementation
 */
export interface OnboardingRisk {
  risk: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

/**
 * Stakeholder sentiment from onboarding meeting
 */
export interface StakeholderSentiment {
  name: string;
  role: string;
  sentiment: 'champion' | 'engaged' | 'neutral' | 'frustrated' | 'blocker';
  notes: string;
}

/**
 * Go-live confidence level
 */
export type GoLiveConfidence = 'on_track' | 'at_risk' | 'delayed';

/**
 * Full onboarding transcript analysis output
 */
export interface OnboardingTranscriptAnalysis {
  /** 2-3 sentence summary of the meeting */
  summary: string;

  /** Implementation health - blockers identified */
  blockers: OnboardingBlocker[];

  /** Training effectiveness - gaps identified */
  training_gaps: TrainingGap[];

  /** Go-live readiness checklist */
  go_live_checklist: GoLiveChecklistItem[];

  /** Our commitments to the customer */
  ourCommitments: Commitment[];

  /** Customer commitments to us */
  theirCommitments: Commitment[];

  /** Action items from the meeting */
  actionItems: ActionItem[];

  /** Adoption signals - positive and concerning */
  adoption_indicators: AdoptionIndicator[];

  /** Risks to successful implementation */
  risks: OnboardingRisk[];

  /** Individual stakeholder sentiment */
  stakeholder_sentiment: StakeholderSentiment[];

  /** Target go-live date if mentioned */
  go_live_date?: string;

  /** Overall confidence in hitting go-live */
  go_live_confidence: GoLiveConfidence;

  /** Overall meeting sentiment */
  sentiment: Sentiment;
}

/**
 * Type guard to check if analysis is onboarding-specific
 */
export function isOnboardingAnalysis(
  analysis: unknown
): analysis is OnboardingTranscriptAnalysis {
  if (!analysis || typeof analysis !== 'object') return false;
  const a = analysis as Record<string, unknown>;
  return (
    'blockers' in a &&
    'training_gaps' in a &&
    'go_live_checklist' in a &&
    'go_live_confidence' in a
  );
}
