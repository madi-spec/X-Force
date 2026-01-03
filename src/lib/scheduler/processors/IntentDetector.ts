/**
 * IntentDetector - Step 1 of Response Analysis
 *
 * @deprecated This module is DEPRECATED as of January 2026.
 * Intent detection has been unified into responseProcessor.ts using
 * the managed prompt 'scheduler_response_parsing' which combines
 * intent detection + time extraction in a single AI call.
 *
 * The functions in this file are retained for backward compatibility
 * but should NOT be used for new development.
 *
 * New code should use:
 * - responseProcessor.ts: analyzeResponseWithPrompt()
 * - Managed prompt key: 'scheduler_response_parsing'
 *
 * This file will be removed in a future version.
 *
 * OLD APPROACH (deprecated):
 * Determines WHAT the person wants to do, WITHOUT extracting specific times.
 * Time extraction is a separate step handled by TimeParser.
 *
 * This two-step separation improves accuracy for both:
 * 1. Intent detection (what do they want?)
 * 2. Time extraction (when do they want to meet?)
 */

import { callAIJson } from '@/lib/ai/core/aiClient';
import { INTENT, type SchedulingIntent } from '../core/constants';

// ============================================
// TYPES
// ============================================

export type { SchedulingIntent };

export interface IntentAnalysis {
  /** Primary detected intent */
  intent: SchedulingIntent;
  /** Confidence in the detection */
  confidence: 'high' | 'medium' | 'low';
  /** Sentiment toward the meeting */
  sentiment: 'positive' | 'neutral' | 'negative';
  /** AI's reasoning for this classification */
  reasoning: string;

  // Flags for special handling
  /** Is the person expressing confusion or correcting us? */
  isConfused: boolean;
  /** What are they confused about? */
  confusionReason?: string;
  /** Are they delegating to someone else? */
  isDelegating: boolean;
  /** Who are they delegating to? */
  delegateTo?: string;
  /** Do they have a question? */
  hasQuestion: boolean;
  /** What is their question? */
  question?: string;
  /** Did they mention they're out of office or unavailable? */
  isOutOfOffice: boolean;
  /** Any dates mentioned for unavailability */
  oooUntil?: string;
}

// ============================================
// CONFUSION PATTERNS
// ============================================

const CONFUSION_INDICATORS = [
  'wrong time',
  'wrong date',
  'that\'s not what',
  'i didn\'t say',
  'i meant',
  'i said',
  'confused',
  'misunderstood',
  'that\'s incorrect',
  'no, i',
  'already told you',
  'didn\'t work',
  'something went wrong',
  'technical issue',
  'i never',
  'we already',
  'frustrated',
  'this is the third',
  'again?',
];

const DELEGATION_INDICATORS = [
  'my assistant',
  'my ea',
  'executive assistant',
  'please work with',
  'cc\'d',
  'copied on this',
  'adding',
  'loop in',
  'forwarding to',
  'will handle',
  'better person',
  'colleague',
  'team member',
];

const OUT_OF_OFFICE_INDICATORS = [
  'out of office',
  'ooo',
  'on vacation',
  'on holiday',
  'traveling',
  'away from',
  'not available until',
  'back on',
  'returning',
  'limited availability',
];

// ============================================
// MAIN INTENT DETECTION
// ============================================

/**
 * Detect the intent of a scheduling response
 * This ONLY determines intent - does NOT extract times
 *
 * @deprecated Use responseProcessor.analyzeResponseWithPrompt() instead,
 * which combines intent detection with time extraction using the
 * managed 'scheduler_response_parsing' prompt.
 */
export async function detectIntent(
  emailBody: string,
  proposedTimes: string[],
  correlationId?: string
): Promise<IntentAnalysis> {
  const logPrefix = correlationId ? `[IntentDetector:${correlationId}]` : '[IntentDetector]';
  console.log(`${logPrefix} Analyzing intent for email (${emailBody.length} chars)`);

  // Quick pattern checks (before AI call)
  const bodyLower = emailBody.toLowerCase();
  const hasConfusionWords = CONFUSION_INDICATORS.some((p) => bodyLower.includes(p));
  const hasDelegationWords = DELEGATION_INDICATORS.some((p) => bodyLower.includes(p));
  const hasOOOWords = OUT_OF_OFFICE_INDICATORS.some((p) => bodyLower.includes(p));

  console.log(`${logPrefix} Pattern check - confusion: ${hasConfusionWords}, delegation: ${hasDelegationWords}, OOO: ${hasOOOWords}`);

  const prompt = `Analyze this email response to a meeting scheduling request.

## Context
We proposed these meeting times:
${proposedTimes.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(No specific times were proposed)'}

## Email Response to Analyze
${emailBody}

## Your Task
Determine ONLY what this person WANTS TO DO. Do NOT extract specific times (that's a separate step).

Classify their intent as one of:
- accept: They are agreeing to meet at one of the proposed times
- counter_propose: They are suggesting different times
- decline: They don't want to meet (now or ever)
- question: They are primarily asking a question
- reschedule: They want to change an already-scheduled meeting
- delegate: They are forwarding to someone else to handle
- confused: They are expressing confusion or correcting a mistake
- unclear: Cannot confidently determine what they want

SPECIAL ATTENTION:
1. CONFUSION - Look for signs they're correcting us or frustrated:
   - "I didn't say that"
   - "That's not what I meant"
   - "Wrong time/date"
   - Any indication we misunderstood them

2. DELEGATION - Are they handing this off?
   - "Please work with my assistant"
   - "CC'd [name] who can help"

3. OUT OF OFFICE - Are they temporarily unavailable?
   - "I'm on vacation until..."
   - "Back in the office on..."

4. QUESTIONS - They might accept but also have questions
   - If primarily a question, mark as question
   - Note the question content`;

  try {
    const response = await callAIJson<{
      intent: SchedulingIntent;
      confidence: 'high' | 'medium' | 'low';
      sentiment: 'positive' | 'neutral' | 'negative';
      reasoning: string;
      isConfused: boolean;
      confusionReason?: string;
      isDelegating: boolean;
      delegateTo?: string;
      hasQuestion: boolean;
      question?: string;
      isOutOfOffice: boolean;
      oooUntil?: string;
    }>({
      prompt,
      systemPrompt: `You are an expert at understanding the intent behind scheduling emails.

Your job is to classify what the sender WANTS TO DO - not to extract specific times.

Be especially vigilant for:
1. Signs of confusion or frustration (these should be escalated to humans)
2. Delegation to assistants or colleagues
3. Out of office notices
4. Questions that need answering before they can decide

When in doubt between "accept" and "counter_propose", lean toward counter_propose to be safe.
When in doubt about intent overall, use "unclear" and explain why in reasoning.`,
      schema: `{
        "intent": "accept|counter_propose|decline|question|reschedule|delegate|confused|unclear",
        "confidence": "high|medium|low",
        "sentiment": "positive|neutral|negative",
        "reasoning": "Brief explanation of your classification",
        "isConfused": true/false,
        "confusionReason": "What they seem confused about (if applicable)",
        "isDelegating": true/false,
        "delegateTo": "Name/email of delegate (if applicable)",
        "hasQuestion": true/false,
        "question": "Their question (if applicable)",
        "isOutOfOffice": true/false,
        "oooUntil": "Return date mentioned (if applicable)"
      }`,
      maxTokens: 800,
      temperature: 0.2,
    });

    const analysis: IntentAnalysis = {
      intent: response.data.intent || INTENT.UNCLEAR,
      confidence: response.data.confidence || 'low',
      sentiment: response.data.sentiment || 'neutral',
      reasoning: response.data.reasoning || '',
      isConfused: response.data.isConfused || hasConfusionWords,
      confusionReason: response.data.confusionReason,
      isDelegating: response.data.isDelegating || hasDelegationWords,
      delegateTo: response.data.delegateTo,
      hasQuestion: response.data.hasQuestion || false,
      question: response.data.question,
      isOutOfOffice: response.data.isOutOfOffice || hasOOOWords,
      oooUntil: response.data.oooUntil,
    };

    // Override to confused if we detected confusion but AI didn't
    if (hasConfusionWords && !analysis.isConfused) {
      console.log(`${logPrefix} Pattern detected confusion but AI didn't - flagging for review`);
      analysis.isConfused = true;
      analysis.confusionReason = 'Pattern matching detected potential confusion';
    }

    console.log(`${logPrefix} Intent analysis complete:`, {
      intent: analysis.intent,
      confidence: analysis.confidence,
      isConfused: analysis.isConfused,
      isDelegating: analysis.isDelegating,
    });

    return analysis;
  } catch (err) {
    console.error(`${logPrefix} AI analysis failed:`, err);

    // Return a safe fallback that will trigger human review
    return {
      intent: INTENT.UNCLEAR,
      confidence: 'low',
      sentiment: 'neutral',
      reasoning: `AI analysis failed: ${err}`,
      isConfused: hasConfusionWords,
      isDelegating: hasDelegationWords,
      hasQuestion: false,
      isOutOfOffice: hasOOOWords,
    };
  }
}

/**
 * Quick intent check without AI call
 * Use for pre-filtering or when AI is unavailable
 */
export function quickIntentCheck(emailBody: string): {
  likelyIntent: SchedulingIntent;
  flags: {
    hasConfusionWords: boolean;
    hasDelegationWords: boolean;
    hasOOOWords: boolean;
    hasPositiveWords: boolean;
    hasNegativeWords: boolean;
  };
} {
  const bodyLower = emailBody.toLowerCase();

  const flags = {
    hasConfusionWords: CONFUSION_INDICATORS.some((p) => bodyLower.includes(p)),
    hasDelegationWords: DELEGATION_INDICATORS.some((p) => bodyLower.includes(p)),
    hasOOOWords: OUT_OF_OFFICE_INDICATORS.some((p) => bodyLower.includes(p)),
    hasPositiveWords: ['yes', 'works', 'good', 'great', 'perfect', 'sounds good', 'let\'s do'].some(
      (p) => bodyLower.includes(p)
    ),
    hasNegativeWords: ['no', 'can\'t', 'won\'t', 'unable', 'not interested', 'decline'].some((p) =>
      bodyLower.includes(p)
    ),
  };

  let likelyIntent: SchedulingIntent = INTENT.UNCLEAR;

  if (flags.hasConfusionWords) {
    likelyIntent = INTENT.CONFUSED;
  } else if (flags.hasDelegationWords) {
    likelyIntent = INTENT.DELEGATE;
  } else if (flags.hasNegativeWords && !flags.hasPositiveWords) {
    likelyIntent = INTENT.DECLINE;
  } else if (flags.hasPositiveWords) {
    likelyIntent = INTENT.ACCEPT;
  }

  return { likelyIntent, flags };
}

/**
 * Check if an intent requires time extraction
 */
export function requiresTimeExtraction(intent: SchedulingIntent): boolean {
  return intent === INTENT.ACCEPT || intent === INTENT.COUNTER_PROPOSE;
}

/**
 * Check if an intent should trigger human review
 *
 * @deprecated Escalation logic is now handled directly in responseProcessor.ts
 * based on the unified response analysis from 'scheduler_response_parsing' prompt.
 */
export function shouldEscalate(analysis: IntentAnalysis): boolean {
  return (
    analysis.isConfused ||
    analysis.confidence === 'low' ||
    analysis.intent === INTENT.UNCLEAR ||
    analysis.intent === INTENT.CONFUSED ||
    (analysis.isDelegating && !analysis.delegateTo)
  );
}

/**
 * Get the recommended action for an intent
 */
export function getRecommendedAction(analysis: IntentAnalysis): string {
  if (shouldEscalate(analysis)) {
    return 'escalate';
  }

  switch (analysis.intent) {
    case INTENT.ACCEPT:
      return 'extract_time_and_confirm';
    case INTENT.COUNTER_PROPOSE:
      return 'extract_times_and_propose';
    case INTENT.DECLINE:
      return 'close_request';
    case INTENT.QUESTION:
      return 'answer_question';
    case INTENT.RESCHEDULE:
      return 'process_reschedule';
    case INTENT.DELEGATE:
      return analysis.delegateTo ? 'contact_delegate' : 'escalate';
    default:
      return 'escalate';
  }
}
