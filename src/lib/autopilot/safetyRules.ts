/**
 * AI Autopilot Safety Rules
 *
 * Centralized safety evaluation for all autopilot workflows.
 * Determines whether an action can be auto-executed or needs human review.
 *
 * Safety Philosophy:
 * - Never auto-send without valid contact email
 * - Never auto-send pricing information
 * - Never auto-respond to objections
 * - Never auto-execute for high-risk companies
 * - Always escalate when in doubt
 */

import {
  SafetyEvaluation,
  SchedulerAutopilotItem,
  NeedsReplyAutopilotItem,
  TranscriptAutopilotItem,
} from './types';
import {
  containsPricingKeywords,
  containsObjectionSignals,
  isSimpleLogistics,
  firstOrNull,
} from './helpers';

// ============================================
// CONSTANTS
// ============================================

const MAX_SCHEDULING_ATTEMPTS = 3;
const HIGH_RISK_LEVEL = 'high';

// ============================================
// SCHEDULER SAFETY
// ============================================

/**
 * Evaluate whether a scheduling request can be auto-processed.
 */
export function evaluateSchedulerSafety(
  request: SchedulerAutopilotItem
): SafetyEvaluation {
  // Rule 1: Must have external attendees with email
  const externalAttendees = request.attendees?.filter(
    (a) => a.side === 'external' && a.email
  ) || [];

  if (externalAttendees.length === 0) {
    return {
      canProceed: false,
      reason: 'No external attendee with email address',
      riskLevel: 'high',
      suggestedAction: 'skip',
    };
  }

  // Rule 2: Check company risk level
  const companyProduct = firstOrNull(request.company_product);
  if (companyProduct?.risk_level === HIGH_RISK_LEVEL) {
    return {
      canProceed: false,
      reason: 'High-risk deal requires human approval for scheduling',
      riskLevel: 'high',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 3: Check for unresolved high-severity objections
  const objections = (companyProduct?.open_objections as unknown[]) || [];
  const highSeverityObjections = objections.filter(
    (o: unknown) => (o as { severity?: string })?.severity === 'high'
  );

  if (highSeverityObjections.length > 0) {
    const firstObjection = highSeverityObjections[0] as { objection?: string };
    return {
      canProceed: false,
      reason: `Unresolved high-severity objection: ${firstObjection?.objection || 'Unknown'}`,
      riskLevel: 'high',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 4: Check attempt count
  if (request.attempt_count >= MAX_SCHEDULING_ATTEMPTS) {
    return {
      canProceed: false,
      reason: `Too many scheduling attempts (${request.attempt_count}) - needs human intervention`,
      riskLevel: 'medium',
      suggestedAction: 'create_flag',
    };
  }

  // All safety checks passed
  return {
    canProceed: true,
    reason: 'All safety checks passed',
    riskLevel: 'low',
    suggestedAction: 'auto_execute',
  };
}

// ============================================
// NEEDS REPLY SAFETY
// ============================================

/**
 * Evaluate whether a communication can be auto-replied to.
 */
export function evaluateNeedsReplySafety(
  comm: NeedsReplyAutopilotItem
): SafetyEvaluation {
  // Rule 1: Must have contact with email
  const contact = firstOrNull(comm.contact);
  if (!contact?.email) {
    return {
      canProceed: false,
      reason: 'No contact email address available',
      riskLevel: 'high',
      suggestedAction: 'skip',
    };
  }

  // Rule 2: Check content for pricing keywords
  const content = (comm.content_preview || '').toLowerCase();
  if (containsPricingKeywords(content)) {
    return {
      canProceed: false,
      reason: 'Pricing-related content requires human response',
      riskLevel: 'medium',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 3: Check for objection signals
  if (containsObjectionSignals(content)) {
    return {
      canProceed: false,
      reason: 'Potential objection detected - requires human touch',
      riskLevel: 'medium',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 4: Check company product risk level
  const companyProduct = firstOrNull(comm.company_product);
  if (companyProduct?.risk_level === HIGH_RISK_LEVEL) {
    return {
      canProceed: false,
      reason: 'High-risk company requires human response',
      riskLevel: 'high',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 5: Check for unresolved high-severity objections
  const objections = (companyProduct?.open_objections as unknown[]) || [];
  const highSeverityObjections = objections.filter(
    (o: unknown) => (o as { severity?: string })?.severity === 'high'
  );

  if (highSeverityObjections.length > 0) {
    return {
      canProceed: false,
      reason: 'Open high-severity objection on account',
      riskLevel: 'high',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 6: Prefer simple logistics for auto-reply
  if (!isSimpleLogistics(content)) {
    // Not obvious logistics - check if it's at least short and neutral
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 50) {
      return {
        canProceed: false,
        reason: 'Long message requires thoughtful human response',
        riskLevel: 'low',
        suggestedAction: 'create_flag',
      };
    }
  }

  // All safety checks passed
  return {
    canProceed: true,
    reason: 'Safe to auto-reply - simple logistics or neutral content',
    riskLevel: 'low',
    suggestedAction: 'auto_execute',
  };
}

// ============================================
// TRANSCRIPT FOLLOW-UP SAFETY
// ============================================

/**
 * Evaluate whether a transcript follow-up can be auto-sent.
 */
export function evaluateTranscriptFollowupSafety(
  transcript: TranscriptAutopilotItem
): SafetyEvaluation {
  // Rule 1: Must have contact with email
  const contact = firstOrNull(transcript.contact);
  if (!contact?.email) {
    return {
      canProceed: false,
      reason: 'No contact email address for follow-up',
      riskLevel: 'high',
      suggestedAction: 'skip',
    };
  }

  // Rule 2: Must have analysis with actionable content
  const analysis = transcript.analysis;
  if (!analysis) {
    return {
      canProceed: false,
      reason: 'No meeting analysis available',
      riskLevel: 'low',
      suggestedAction: 'skip',
    };
  }

  // Rule 3: Check analysis for pricing discussions
  const analysisStr = JSON.stringify(analysis).toLowerCase();
  if (containsPricingKeywords(analysisStr)) {
    return {
      canProceed: false,
      reason: 'Meeting involved pricing discussion - needs human follow-up',
      riskLevel: 'medium',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 4: Check analysis for objections or concerns
  const objections = (analysis as Record<string, unknown>)?.objections as unknown[];
  const hasUnresolvedObjections = Array.isArray(objections) &&
    objections.some((o: unknown) => (o as { resolved?: boolean })?.resolved === false);

  if (hasUnresolvedObjections) {
    return {
      canProceed: false,
      reason: 'Unresolved objections from meeting - needs human follow-up',
      riskLevel: 'medium',
      suggestedAction: 'create_flag',
    };
  }

  // Rule 5: Check for negative sentiment
  const sentiment = (analysis as Record<string, unknown>)?.sentiment;
  if (sentiment === 'negative' || sentiment === 'concerned') {
    return {
      canProceed: false,
      reason: 'Negative meeting sentiment - needs human follow-up',
      riskLevel: 'medium',
      suggestedAction: 'create_flag',
    };
  }

  // All safety checks passed
  return {
    canProceed: true,
    reason: 'Safe to auto-send meeting follow-up',
    riskLevel: 'low',
    suggestedAction: 'auto_execute',
  };
}

// ============================================
// GENERIC SAFETY HELPERS
// ============================================

/**
 * Check if an email address looks valid.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if we should skip an internal email address.
 */
export function isInternalEmail(email: string, internalDomains: string[] = []): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  // Default internal domains
  const defaultInternalDomains = [
    'x-rai.com',
    'xrai.com',
    'x-force.ai',
  ];

  const allInternalDomains = [...defaultInternalDomains, ...internalDomains];
  return allInternalDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * Combine multiple safety evaluations - fail if ANY fails.
 */
export function combineSafetyEvaluations(
  evaluations: SafetyEvaluation[]
): SafetyEvaluation {
  const failed = evaluations.find((e) => !e.canProceed);
  if (failed) {
    return failed;
  }

  return {
    canProceed: true,
    reason: 'All safety checks passed',
    riskLevel: 'low',
    suggestedAction: 'auto_execute',
  };
}
