/**
 * Scheduling Response Processor
 *
 * Detects and processes incoming email responses to scheduling requests.
 * Integrates with Microsoft email sync to automatically handle responses.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateSchedulingEmail,
  formatTimeSlotsForEmail,
} from './emailGeneration';
import { adminSchedulingService } from './schedulingService';
// ============================================
// MODULAR IMPORTS
// Note: Intent detection is now handled by analyzeSchedulingResponse()
// using managed 'scheduler_response_parsing' prompt.
// IntentAnalysis type is now in ./types.
// ============================================
import {
  matchToProposedTime,
  type TimeParseContext,
  type ParsedTime,
} from './core/TimeParser';
import {
  escalateToHumanReview,
  buildEscalationFromIntent,
} from './processors/Escalation';
import { sendEmail } from '@/lib/microsoft/emailSync';
import { createMeetingCalendarEvent, getMultiAttendeeAvailability } from './calendarIntegration';
import { callAIJson } from '@/lib/ai/core/aiClient';
import { getPromptWithVariables } from '@/lib/ai/promptManager';
import {
  SchedulingRequest,
  SchedulingAttendee,
  SchedulingStatus,
  SCHEDULING_STATUS,
  ACTION_TYPES,
  ConversationMessage,
  MEETING_PLATFORMS,
} from './types';
import {
  normalizeTimezone,
  parseLocalTimeToUTC,
  formatForDisplay,
  formatForGraphAPI,
  buildDateContextForAI,
  normalizeAITimestamp,
  getAITimestampInstructions,
  DEFAULT_TIMEZONE,
  addMinutes,
} from './timezone';
import {
  TaggedTimestamp,
  createTaggedTimestamp,
  createTaggedFromUtc,
  formatTaggedForDisplay,
  logTaggedTimestamp,
} from './taggedTimestamp';
import {
  validateProposedTime,
  logTimestampConversion,
} from './timestampValidator';

// ============================================
// TYPES
// ============================================

interface IncomingEmail {
  id: string;
  subject: string;
  body: string;
  bodyPreview: string;
  from: {
    address: string;
    name?: string;
  };
  /** CC recipients on the email */
  ccRecipients?: Array<{ address: string; name?: string }>;
  receivedDateTime: string;
  conversationId?: string;
}

interface ProcessingResult {
  processed: boolean;
  schedulingRequestId?: string;
  action?: string;
  newStatus?: SchedulingStatus;
  error?: string;
  /** Whether this result requires human review */
  requiresHumanReview?: boolean;
  /** Reason for human review */
  reviewReason?: string;
}

interface ResponseAnalysis {
  intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'out_of_office' | 'add_attendees' | 'time_in_past' | 'unclear';
  selectedTime?: string;
  selectedTimeTagged?: TaggedTimestamp;
  counterProposedTimes?: string[];
  counterProposedTimesTagged?: TaggedTimestamp[];
  question?: string;
  /** Additional attendees the prospect wants to add */
  additionalAttendees?: Array<{ name?: string; email?: string }>;
  /** Return date if out-of-office */
  outOfOfficeReturnDate?: string;
  /** Whether this requires human review */
  requiresHumanReview?: boolean;
  /** Reason for human review */
  humanReviewReason?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  isConfused?: boolean;
  confusionReason?: string;
  validationErrors?: string[];
}

// ============================================
// HELPERS
// ============================================

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, 4th, etc.)
 */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// ============================================
// UNIFIED RESPONSE ANALYSIS (Managed Prompt)
// ============================================

/**
 * Options for analyzeSchedulingResponse
 */
interface AnalyzeSchedulingOptions {
  /** CC recipients from the email for attendee detection */
  ccRecipients?: string[];
  /** Correlation ID for logging */
  correlationId?: string;
}

/**
 * Response from analyzeSchedulingResponse
 */
export interface SchedulingAnalysisResult {
  intent: 'accept' | 'counter_propose' | 'decline' | 'question' | 'out_of_office' | 'add_attendees' | 'time_in_past' | 'reschedule' | 'delegate' | 'confused' | 'unclear';
  selectedTime?: string;
  counterProposedTimes?: Array<{ description: string; isoTimestamp: string; displayText: string }>;
  question?: string;
  /** Additional attendees the prospect wants to add to the meeting */
  additionalAttendees?: Array<{ name?: string; email?: string }>;
  /** Return date if out-of-office response */
  outOfOfficeReturnDate?: string;
  /** Whether this response requires human review */
  requiresHumanReview?: boolean;
  /** Reason for human review */
  humanReviewReason?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Analyze a scheduling email response using the managed prompt from the database.
 * This replaces the fragmented detectIntent() + extractTimesFromText() approach.
 *
 * The prompt is editable at /settings/ai-prompts (key: scheduler_response_parsing)
 *
 * Handles:
 * - Standard accept/decline/counter-propose intents
 * - Out-of-office responses → flags for human review
 * - Requests to add attendees → extracts from CC and body
 * - Time validation → flags times <4 hours in future
 */
async function analyzeSchedulingResponse(
  emailBody: string,
  proposedTimes: Array<{ utc: string; display: string }> | string[] | null,
  timezone: string,
  options?: AnalyzeSchedulingOptions
): Promise<SchedulingAnalysisResult> {
  const correlationId = options?.correlationId;
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;

  // Format today's date for context
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });

  // Year guidance for December/January edge cases
  let yearGuidance = '';
  if (currentMonth === 12) {
    yearGuidance = `CRITICAL: We are in December ${currentYear}. Any mention of January, February, or March means ${nextYear}. All dates must be in the FUTURE.`;
  } else if (currentMonth === 1) {
    yearGuidance = `We are in January ${currentYear}. All dates must be in the FUTURE from today.`;
  } else if (currentMonth >= 10) {
    yearGuidance = `Note: Today is in late ${currentYear}. If they mention January/February/March, use ${nextYear}.`;
  }

  // Generate explicit calendar reference for next 3 weeks
  // This prevents AI from guessing day-to-date mappings incorrectly
  const calendarLines: string[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i < 21; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = dayNames[date.getDay()];
    const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: timezone });
    const dayNum = date.getDate();
    const year = date.getFullYear();
    const suffix = getDaySuffix(dayNum);
    calendarLines.push(`${dayName} = ${monthName} ${dayNum}${suffix}, ${year}`);
  }
  const calendarContext = calendarLines.join('\n');

  // Format proposed times for the prompt
  let proposedTimesFormatted = 'None provided';
  if (proposedTimes && proposedTimes.length > 0) {
    proposedTimesFormatted = proposedTimes
      .map((t, i) => {
        const display = typeof t === 'string' ? t : t.display;
        return `${i + 1}. ${display}`;
      })
      .join('\n');
  }

  console.log(`[analyzeSchedulingResponse] Correlation: ${correlationId}`);
  console.log(`[analyzeSchedulingResponse] Timezone: ${timezone}`);
  console.log(`[analyzeSchedulingResponse] Email body length: ${emailBody.length}`);

  try {
    // Get current timestamp for 4-hour validation
    const currentTimestamp = new Date().toISOString();

    // Extract CC recipients if available (passed in options)
    const ccRecipients = options?.ccRecipients?.join(', ') || 'None';

    // Load the managed prompt from database
    const promptResult = await getPromptWithVariables('scheduler_response_parsing', {
      todayFormatted,
      currentTimestamp,
      yearGuidance,
      calendarContext,
      proposedTimes: proposedTimesFormatted,
      emailBody,
      ccRecipients,
    });

    if (!promptResult || !promptResult.prompt) {
      console.error('[analyzeSchedulingResponse] Failed to load scheduler_response_parsing prompt from database');
      throw new Error('Failed to load scheduler_response_parsing prompt');
    }

    console.log(`[analyzeSchedulingResponse] Loaded prompt, calling AI...`);

    // Call AI with the managed prompt
    const { data: response } = await callAIJson<SchedulingAnalysisResult>({
      prompt: promptResult.prompt,
      schema: promptResult.schema || undefined,
      model: (promptResult.model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514') || 'claude-sonnet-4-20250514',
      maxTokens: promptResult.maxTokens || 1000,
    });

    console.log(`[analyzeSchedulingResponse] AI response:`, {
      intent: response.intent,
      confidence: response.confidence,
      sentiment: response.sentiment,
      counterProposedCount: response.counterProposedTimes?.length || 0,
      additionalAttendeesCount: response.additionalAttendees?.length || 0,
      requiresHumanReview: response.requiresHumanReview || false,
    });

    // Log special cases
    if (response.requiresHumanReview) {
      console.log(`[analyzeSchedulingResponse] ⚠️ Human review required: ${response.humanReviewReason}`);
    }
    if (response.additionalAttendees?.length) {
      console.log(`[analyzeSchedulingResponse] 👥 Additional attendees detected:`, response.additionalAttendees);
    }
    if (response.intent === 'out_of_office') {
      console.log(`[analyzeSchedulingResponse] 📅 Out of office - return date: ${response.outOfOfficeReturnDate || 'not specified'}`);
    }

    return response;
  } catch (err) {
    console.error('[analyzeSchedulingResponse] Error:', err);
    // Return unclear intent on error so it falls back to human review
    return {
      intent: 'unclear',
      sentiment: 'neutral',
      confidence: 'low',
      reasoning: `Analysis failed: ${err}`,
      requiresHumanReview: true,
      humanReviewReason: `AI analysis failed: ${err}`,
    };
  }
}

// ============================================
// RESPONSE DETECTION
// ============================================

/**
 * Find scheduling request matching an incoming email
 *
 * Strategies (in order of priority):
 * 1. Thread ID match - Most reliable when we have it
 * 2. Attendee email match - Match sender to external attendee
 * 3. Subject line fallback - For "Re:" replies when thread ID is missing
 */
export async function findMatchingSchedulingRequest(
  email: IncomingEmail
): Promise<SchedulingRequest | null> {
  const supabase = createAdminClient();
  const senderEmail = email.from.address.toLowerCase();

  console.log('[findMatch] ====== FINDING MATCHING REQUEST ======');
  console.log('[findMatch] Email subject:', email.subject);
  console.log('[findMatch] From:', senderEmail);
  console.log('[findMatch] ConversationId:', email.conversationId || 'NONE');

  // Strategy 1: Match by conversation/thread ID
  console.log('[findMatch] Strategy 1: Thread ID match...');
  if (email.conversationId) {
    const { data: byThread, error: threadError } = await supabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*)
      `)
      .eq('email_thread_id', email.conversationId)
      .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED},${SCHEDULING_STATUS.CONFIRMED})`)
      .single();

    if (threadError && threadError.code !== 'PGRST116') {
      console.log('[findMatch]   Query error:', threadError.message);
    }

    if (byThread) {
      console.log('[findMatch]   ✓ MATCHED by thread_id! Request:', byThread.id, 'Title:', byThread.title);
      return byThread as SchedulingRequest;
    }
    console.log('[findMatch]   ✗ No match - email_thread_id not found in any active request');
  } else {
    console.log('[findMatch]   ✗ Skipped - no conversationId on email');
  }

  // Strategy 2: Match by sender email to active scheduling request attendees
  console.log('[findMatch] Strategy 2: Attendee email match for:', senderEmail);
  const { data: byEmail, error: emailError } = await supabase
    .from('scheduling_attendees')
    .select(`
      scheduling_request_id,
      scheduling_request:scheduling_requests(
        *,
        attendees:scheduling_attendees(*)
      )
    `)
    .eq('email', senderEmail)
    .eq('side', 'external');

  if (emailError) {
    console.log('[findMatch]   Query error:', emailError.message);
  }

  console.log('[findMatch]   Found', byEmail?.length || 0, 'attendee records for this sender');

  if (byEmail && byEmail.length > 0) {
    // Find active scheduling request for this contact
    const schedulingKeywords = [
      'schedule', 'meeting', 'calendar', 'time', 'available',
      'works', 'demo', 'call', 'tuesday', 'wednesday', 'thursday',
      'friday', 'monday', 'morning', 'afternoon', 'pm', 'am', 're:',
    ];
    const subjectLower = email.subject.toLowerCase();
    const hasSchedulingKeyword = schedulingKeywords.some(kw => subjectLower.includes(kw));

    console.log('[findMatch]   Subject has scheduling keyword:', hasSchedulingKeyword);

    for (const attendee of byEmail) {
      const request = attendee.scheduling_request as unknown as SchedulingRequest;
      if (!request) {
        console.log('[findMatch]   - Request null for attendee record');
        continue;
      }

      const isActiveStatus =
        request.status !== SCHEDULING_STATUS.COMPLETED &&
        request.status !== SCHEDULING_STATUS.CANCELLED &&
        request.status !== SCHEDULING_STATUS.CONFIRMED;

      console.log('[findMatch]   - Request:', request.id, 'status:', request.status, 'active:', isActiveStatus);

      if (isActiveStatus) {
        if (hasSchedulingKeyword || request.status === SCHEDULING_STATUS.AWAITING_RESPONSE) {
          console.log('[findMatch]   ✓ MATCHED by attendee email! Request:', request.id);

          // FALLBACK: Thread ID should be captured on send, this is a backup
          if (email.conversationId && !request.email_thread_id) {
            console.warn('[findMatch]   ⚠️ FALLBACK: Capturing thread_id from inbound (should be set on send)');
            await supabase
              .from('scheduling_requests')
              .update({ email_thread_id: email.conversationId })
              .eq('id', request.id);
          }

          return request;
        } else {
          console.log('[findMatch]   - Skipped: no scheduling keyword and status is not awaiting_response');
        }
      }
    }
    console.log('[findMatch]   ✗ No active request matched criteria');
  }

  // Strategy 3: Subject line fallback for "Re:" replies
  console.log('[findMatch] Strategy 3: Subject line fallback...');
  const isReply = email.subject.toLowerCase().startsWith('re:');

  if (isReply) {
    console.log('[findMatch]   Email is a reply, looking for recent awaiting_response requests to this sender');

    // Find recent requests awaiting response where this person is an attendee
    const { data: recentRequests, error: recentError } = await supabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*)
      `)
      .eq('status', SCHEDULING_STATUS.AWAITING_RESPONSE)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.log('[findMatch]   Query error:', recentError.message);
    }

    if (recentRequests && recentRequests.length > 0) {
      // Find one where this sender is an external attendee
      for (const req of recentRequests) {
        const hasMatchingAttendee = (req.attendees || []).some(
          (a: SchedulingAttendee) => a.side === 'external' && a.email.toLowerCase() === senderEmail
        );

        if (hasMatchingAttendee) {
          console.log('[findMatch]   ✓ MATCHED by subject fallback! Request:', req.id);

          // FALLBACK: Thread ID should be captured on send, this is a backup
          if (email.conversationId && !req.email_thread_id) {
            console.warn('[findMatch]   ⚠️ FALLBACK: Capturing thread_id from inbound (should be set on send)');
            await supabase
              .from('scheduling_requests')
              .update({ email_thread_id: email.conversationId })
              .eq('id', req.id);
          }

          return req as SchedulingRequest;
        }
      }
    }
    console.log('[findMatch]   ✗ No matching request found via subject fallback');
  } else {
    console.log('[findMatch]   ✗ Skipped - email is not a reply');
  }

  console.log('[findMatch] ====== NO MATCH FOUND ======');
  return null;
}

// ============================================
// RESPONSE PROCESSING
// ============================================

// TEMPORARY KILL SWITCH - Set to true to disable all scheduler auto-replies
const SCHEDULER_AUTO_REPLY_DISABLED = false;

// SAFEGUARD: Save emails as drafts instead of sending automatically
// Set to true to require manual review before sending scheduler emails
const SCHEDULER_DRAFT_ONLY_MODE = true;

// Minimum delay in milliseconds before responding to a scheduling email
// This prevents instant robotic-feeling responses and gives time for human review
const RESPONSE_DELAY_MS = 1 * 60 * 1000; // 1 minute (reduced from 3 minutes)

/**
 * Process an incoming email response to a scheduling request
 */
export async function processSchedulingResponse(
  email: IncomingEmail,
  schedulingRequest: SchedulingRequest
): Promise<ProcessingResult> {
  console.log('[processResponse] ====== PROCESSING SCHEDULING RESPONSE ======');
  console.log('[processResponse] Request ID:', schedulingRequest.id);
  console.log('[processResponse] Request Title:', schedulingRequest.title);
  console.log('[processResponse] Request Status:', schedulingRequest.status);
  console.log('[processResponse] Email Subject:', email.subject);
  console.log('[processResponse] Email From:', email.from.address);

  // Kill switch - don't send any automatic replies
  if (SCHEDULER_AUTO_REPLY_DISABLED) {
    console.log('[processResponse] ✗ BLOCKED: SCHEDULER_AUTO_REPLY_DISABLED is true');
    return {
      processed: false,
      error: 'Scheduler auto-reply temporarily disabled',
    };
  }
  console.log('[processResponse] ✓ Kill switch OK (auto_reply_enabled)');

  const supabase = createAdminClient();

  // Check if we should delay the response
  // This prevents instant robotic-feeling auto-replies
  const lastActionTime = schedulingRequest.last_action_at
    ? new Date(schedulingRequest.last_action_at)
    : null;
  const emailReceivedTime = new Date(email.receivedDateTime);
  const now = new Date();

  // If we sent something recently (within the delay window), defer processing
  if (lastActionTime) {
    const timeSinceLastAction = now.getTime() - lastActionTime.getTime();
    if (timeSinceLastAction < RESPONSE_DELAY_MS) {
      const delayRemaining = RESPONSE_DELAY_MS - timeSinceLastAction;
      console.log(`[processSchedulingResponse] Deferring response by ${Math.round(delayRemaining / 1000)}s to avoid instant reply`);

      // Schedule the processing for later
      const processAt = new Date(now.getTime() + delayRemaining);
      await supabase
        .from('scheduling_requests')
        .update({
          next_action_at: processAt.toISOString(),
          next_action_type: 'process_response',
        })
        .eq('id', schedulingRequest.id);

      return {
        processed: false,
        schedulingRequestId: schedulingRequest.id,
        action: 'deferred',
        error: `Response deferred until ${processAt.toISOString()} to avoid instant reply`,
      };
    }
  }

  // Also check time since email was received - don't respond to very recent emails
  const timeSinceEmail = now.getTime() - emailReceivedTime.getTime();
  console.log(`[processResponse] Email age: ${Math.round(timeSinceEmail / 1000)}s, required delay: ${Math.round(RESPONSE_DELAY_MS / 1000)}s`);

  if (timeSinceEmail < RESPONSE_DELAY_MS) {
    const delayRemaining = RESPONSE_DELAY_MS - timeSinceEmail;
    console.log(`[processResponse] ✗ DEFERRED: Email too recent, will retry in ${Math.round(delayRemaining / 1000)}s`);

    // Schedule the processing for later
    const processAt = new Date(now.getTime() + delayRemaining);
    await supabase
      .from('scheduling_requests')
      .update({
        next_action_at: processAt.toISOString(),
        next_action_type: 'process_response',
      })
      .eq('id', schedulingRequest.id);

    return {
      processed: false,
      schedulingRequestId: schedulingRequest.id,
      action: 'deferred',
      error: `Response deferred until ${processAt.toISOString()} to avoid instant reply`,
    };
  }
  console.log('[processResponse] ✓ Response delay OK - proceeding with AI parsing');

  // Generate correlation ID for tracing through both steps
  const correlationId = `proc_${schedulingRequest.id.slice(0, 8)}_${Date.now()}`;
  console.log(`[processResponse:${correlationId}] Starting two-step analysis`);

  try {
    const userTimezone = schedulingRequest.timezone || DEFAULT_TIMEZONE;

    // Format proposed times for context
    const proposedTimesContext = (schedulingRequest.proposed_times || []).map((t) => ({
      utc: t,
      display: new Date(t).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: userTimezone,
        timeZoneName: 'short',
      }),
    }));

    // ============================================
    // UNIFIED ANALYSIS: Intent + Time Extraction
    // Uses managed prompt from database (scheduler_response_parsing)
    // ============================================
    console.log(`[processResponse:${correlationId}] Using unified analysis with managed prompt...`);

    // Extract CC recipients from email for attendee detection
    const ccRecipients = email.ccRecipients?.map(r => r.address) || [];

    const unifiedAnalysis = await analyzeSchedulingResponse(
      email.body || email.bodyPreview || '',
      proposedTimesContext,
      userTimezone,
      { correlationId, ccRecipients }
    );

    console.log(`[processResponse:${correlationId}] Unified analysis complete:`, {
      intent: unifiedAnalysis.intent,
      confidence: unifiedAnalysis.confidence,
      sentiment: unifiedAnalysis.sentiment,
      counterProposedCount: unifiedAnalysis.counterProposedTimes?.length || 0,
    });

    // ============================================
    // ESCALATION CHECK: Should this go to human?
    // ============================================
    if (unifiedAnalysis.confidence === 'low' || unifiedAnalysis.intent === 'unclear' || unifiedAnalysis.intent === 'confused') {
      console.log(`[processResponse:${correlationId}] Low confidence or unclear intent, escalating to human review`);
      const escalationCode = unifiedAnalysis.intent === 'confused'
        ? 'confusion_detected' as const
        : unifiedAnalysis.intent === 'unclear'
          ? 'unclear_intent' as const
          : 'low_confidence' as const;
      const escalationReason = unifiedAnalysis.intent === 'confused'
        ? 'Prospect appears confused'
        : 'Low confidence in response analysis';

      await escalateToHumanReview(schedulingRequest, {
        reason: escalationReason,
        code: escalationCode,
        details: {
          intent: unifiedAnalysis.intent,
          confidence: unifiedAnalysis.confidence,
          reasoning: unifiedAnalysis.reasoning,
          emailPreview: (email.body || '').substring(0, 300),
        },
      }, correlationId);

      // Log the action
      await adminSchedulingService.logAction(schedulingRequest.id, {
        action_type: ACTION_TYPES.EMAIL_RECEIVED,
        email_id: email.id,
        message_subject: email.subject,
        message_content: email.body || email.bodyPreview,
        actor: 'prospect',
        ai_reasoning: `Escalated: ${escalationReason}`,
      });

      return {
        processed: false,
        schedulingRequestId: schedulingRequest.id,
        action: 'escalated_to_human_review',
        error: `Escalated: ${escalationReason}`,
      };
    }

    // Build analysis object (compatible with existing handlers)
    // Times are already extracted by analyzeSchedulingResponse
    const analysis: ResponseAnalysis = {
      intent: unifiedAnalysis.intent as ResponseAnalysis['intent'],
      selectedTime: unifiedAnalysis.selectedTime,
      counterProposedTimes: unifiedAnalysis.counterProposedTimes?.map(t => t.isoTimestamp),
      question: unifiedAnalysis.question,
      additionalAttendees: unifiedAnalysis.additionalAttendees,
      outOfOfficeReturnDate: unifiedAnalysis.outOfOfficeReturnDate,
      requiresHumanReview: unifiedAnalysis.requiresHumanReview,
      humanReviewReason: unifiedAnalysis.humanReviewReason,
      sentiment: unifiedAnalysis.sentiment,
      confidence: unifiedAnalysis.confidence || 'medium',
      reasoning: unifiedAnalysis.reasoning,
    };

    // Log the tagged timestamps for debugging
    if (analysis.selectedTimeTagged) {
      logTaggedTimestamp('Selected time from prospect', analysis.selectedTimeTagged);
    }

    // Log the incoming email as an action
    await adminSchedulingService.logAction(schedulingRequest.id, {
      action_type: ACTION_TYPES.EMAIL_RECEIVED,
      email_id: email.id,
      message_subject: email.subject,
      message_content: email.body || email.bodyPreview,
      actor: 'prospect',
      ai_reasoning: analysis.reasoning,
    });

    // GUARDRAIL: Check for confusion/frustration and stop auto-reply
    if (analysis.isConfused) {
      console.log('[processSchedulingResponse] CONFUSION DETECTED - stopping auto-reply');
      console.log('[processSchedulingResponse] Confusion reason:', analysis.confusionReason);

      // Pause the request for human review
      await supabase
        .from('scheduling_requests')
        .update({
          status: SCHEDULING_STATUS.PAUSED,
          next_action_type: 'human_review_confusion',
          next_action_at: new Date().toISOString(),
        })
        .eq('id', schedulingRequest.id);

      await adminSchedulingService.logAction(schedulingRequest.id, {
        action_type: ACTION_TYPES.STATUS_CHANGED,
        message_content: `Auto-reply stopped due to confusion detection: ${analysis.confusionReason}`,
        actor: 'ai',
        ai_reasoning: 'Prospect appears confused or frustrated. Human review required.',
      });

      return {
        processed: false,
        schedulingRequestId: schedulingRequest.id,
        action: 'paused_confusion_detected',
        error: `Confusion detected: ${analysis.confusionReason}. Auto-reply disabled for human review.`,
      };
    }

    // Add X-FORCE category to the inbound email
    try {
      const { getValidToken } = await import('@/lib/microsoft/auth');
      const token = await getValidToken(schedulingRequest.created_by);
      if (token && email.id) {
        await addCategoryToEmail(token, email.id, 'X-FORCE');
        console.log('[processSchedulingResponse] Added X-FORCE category to inbound email:', email.id);
      }
    } catch (categoryErr) {
      console.warn('[processSchedulingResponse] Failed to add X-FORCE category to email:', categoryErr);
      // Don't fail the whole process if category fails
    }

    // Add to conversation history
    const newMessage: ConversationMessage = {
      id: email.id,
      timestamp: email.receivedDateTime,
      direction: 'inbound',
      channel: 'email',
      subject: email.subject,
      body: email.body || email.bodyPreview,
      sender: email.from.address,
      recipient: 'us',
    };

    const conversationHistory = [
      ...(schedulingRequest.conversation_history || []),
      newMessage,
    ];

    console.log('[processResponse] Updating conversation_history and last_inbound_message_id');
    console.log('[processResponse]   email.id:', email.id);
    console.log('[processResponse]   schedulingRequest.id:', schedulingRequest.id);
    console.log('[processResponse]   conversationHistory length:', conversationHistory.length);

    const { error: updateError, data: updateData } = await supabase
      .from('scheduling_requests')
      .update({
        conversation_history: conversationHistory,
        // Preserve existing email_thread_id - don't overwrite with current email's thread
        // This prevents corruption when fallback matching links to the wrong thread
        email_thread_id: schedulingRequest.email_thread_id || email.conversationId,
        // Capture the messageId of the prospect's latest email for proper reply threading
        last_inbound_message_id: email.id,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', schedulingRequest.id)
      .select('id, last_inbound_message_id');

    if (updateError) {
      console.error('[processResponse] ✗ UPDATE FAILED:', updateError);
    } else {
      console.log('[processResponse] ✓ UPDATE SUCCESS');
      console.log('[processResponse]   Result:', updateData);
    }

    // Handle based on intent
    console.log('[processResponse] ====== AI PARSING COMPLETE ======');
    console.log('[processResponse] Intent:', analysis.intent);
    console.log('[processResponse] Confidence/Sentiment:', analysis.sentiment);
    console.log('[processResponse] Selected Time:', analysis.selectedTime || 'none');
    console.log('[processResponse] Counter-Proposed Times:', analysis.counterProposedTimes || 'none');
    console.log('[processResponse] AI Reasoning:', analysis.reasoning);
    console.log('[processResponse] Routing to handler for intent:', analysis.intent);

    switch (analysis.intent) {
      case 'accept':
        console.log('[processResponse] → handleTimeAccepted()');
        return await handleTimeAccepted(schedulingRequest, analysis, email);

      case 'counter_propose':
        console.log('[processResponse] → handleCounterProposal()');
        return await handleCounterProposal(schedulingRequest, analysis, email);

      case 'decline':
        console.log('[processResponse] → handleDecline()');
        return await handleDecline(schedulingRequest, analysis, email);

      case 'question':
        console.log('[processResponse] → handleQuestion()');
        return await handleQuestion(schedulingRequest, analysis, email);

      case 'unclear':
        console.log('[processResponse] → handleUnclearResponse()');
        return await handleUnclearResponse(schedulingRequest, analysis, email);

      case 'out_of_office':
        console.log('[processResponse] → handleOutOfOffice() - flagging for human review');
        return await handleHumanReviewRequired(schedulingRequest, analysis, email, 'out_of_office');

      case 'add_attendees':
        console.log('[processResponse] → handleAddAttendees() - flagging for human review');
        return await handleHumanReviewRequired(schedulingRequest, analysis, email, 'add_attendees');

      case 'time_in_past':
        console.log('[processResponse] → handleTimeInPast() - flagging for human review');
        return await handleHumanReviewRequired(schedulingRequest, analysis, email, 'time_in_past');

      default:
        console.log('[processResponse] → Unknown intent, returning error');
        return { processed: false, error: 'Unknown intent' };
    }
  } catch (err) {
    console.error('[processResponse] ====== ERROR ======');
    console.error('[processResponse] Error processing response:', err);
    return {
      processed: false,
      schedulingRequestId: schedulingRequest.id,
      error: String(err),
    };
  }
}

// ============================================
// INTENT HANDLERS
// ============================================

/**
 * Handle when prospect accepts a proposed time
 */
async function handleTimeAccepted(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail
): Promise<ProcessingResult> {
  if (!analysis.selectedTime) {
    // They said yes but we couldn't parse which time
    // Try to match using TimeParser (single source of truth)
    const userTimezone = request.timezone || DEFAULT_TIMEZONE;
    const timeContext: TimeParseContext = {
      timezone: userTimezone,
      emailBody: email.body,
      proposedTimes: (request.proposed_times || []).map((t) => ({
        utc: t,
        display: new Date(t).toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: userTimezone,
          timeZoneName: 'short',
        }),
      })),
    };

    const matchResult = matchToProposedTime(email.body, timeContext.proposedTimes || [], timeContext);

    if (!matchResult?.utc) {
      // If we can't match to a proposed time, treat as unclear
      // The managed prompt (scheduler_response_parsing) should have already extracted times
      // via analysis.selectedTime. If matchToProposedTime also fails, we need human review.
      console.log('[handleTimeAccepted] Could not match to proposed time, escalating');
      return await handleUnclearResponse(request, analysis, email);
    }

    analysis.selectedTime = matchResult.utc.toISOString();
    analysis.selectedTimeTagged = matchResult.tagged;
  }

  // CRITICAL: Normalize the selected time using the user's timezone
  // The AI might return times without timezone info (e.g., "2026-01-06T10:30:00")
  // which would be interpreted as UTC by new Date(), causing timezone bugs
  const userTimezone = request.timezone || DEFAULT_TIMEZONE;
  const normalized = normalizeAITimestamp(analysis.selectedTime, userTimezone);
  const selectedDate = normalized.utc || new Date(analysis.selectedTime);

  console.log('[handleTimeAccepted] Time normalization:', {
    original: analysis.selectedTime,
    normalized: selectedDate.toISOString(),
    timezone: userTimezone,
    wasConverted: normalized.wasConverted,
  });

  // Get internal attendee emails for availability check
  const internalEmails = (request.attendees || [])
    .filter((a: SchedulingAttendee) => a.side === 'internal')
    .map((a: SchedulingAttendee) => a.email);

  // Get external attendee for potential alternative times email
  const externalAttendee = (request.attendees || []).find(
    (a: SchedulingAttendee) => a.side === 'external'
  );

  // CRITICAL: Re-check availability in case the slot was booked since we proposed it
  console.log('[handleTimeAccepted] Checking if selected time is still available:', selectedDate.toISOString());

  const availabilityResult = await checkSlotAvailability(
    request.created_by,
    internalEmails,
    selectedDate,
    request.duration_minutes || 30,
    request.timezone || DEFAULT_TIMEZONE
  );

  if (availabilityResult.error) {
    console.warn('[handleTimeAccepted] Availability check failed, proceeding with booking:', availabilityResult.error);
    // If availability check fails, proceed anyway (better to potentially double-book than fail silently)
  } else if (!availabilityResult.available) {
    // SLOT NO LONGER AVAILABLE - send alternative times
    console.log('[handleTimeAccepted] Selected time no longer available! Conflicts:', availabilityResult.conflictingAttendees);

    if (!externalAttendee) {
      console.error('[handleTimeAccepted] No external attendee found for alternative times email');
      return await fallbackToHumanReview(request, analysis, 'Selected time no longer available, no external attendee');
    }

    // Log the issue
    await adminSchedulingService.logAction(request.id, {
      action_type: ACTION_TYPES.STATUS_CHANGED,
      message_content: `Prospect accepted ${selectedDate.toISOString()} but slot is no longer available (conflicts: ${availabilityResult.conflictingAttendees.join(', ')})`,
      actor: 'ai',
      ai_reasoning: 'Time was booked by another meeting since we proposed it. Sending alternative times.',
    });

    // Send alternative times (as reply to maintain thread)
    const alternativeResult = await sendAlternativeTimes(
      request,
      externalAttendee.email,
      externalAttendee.name || 'there',
      request.created_by,
      selectedDate.toISOString(),
      email.id
    );

    if (alternativeResult.success) {
      // Log the email_sent action with the alternative times
      await adminSchedulingService.logAction(request.id, {
        action_type: ACTION_TYPES.EMAIL_SENT,
        message_content: `Sent alternative times because ${selectedDate.toISOString()} is no longer available`,
        actor: 'ai',
        ai_reasoning: `Previously accepted time became unavailable (conflicts: ${availabilityResult.conflictingAttendees.join(', ')}). Sent alternative times.`,
        times_proposed: alternativeResult.proposedTimes, // Store the alternative times so AI can match later
      });
      return {
        processed: true,
        schedulingRequestId: request.id,
        action: 'accepted_time_unavailable_sent_alternatives',
        newStatus: SCHEDULING_STATUS.AWAITING_RESPONSE,
      };
    } else {
      return await fallbackToHumanReview(request, analysis, `Time unavailable, failed to send alternatives: ${alternativeResult.error}`);
    }
  }

  console.log('[handleTimeAccepted] Time is still available, proceeding with booking');

  // Transition to confirming and record selected time
  const result = await adminSchedulingService.selectTime(
    request.id,
    analysis.selectedTime,
    { actor: 'prospect' }
  );

  if (!result.success) {
    return {
      processed: false,
      schedulingRequestId: request.id,
      error: result.error || 'Failed to select time',
    };
  }

  // Create calendar event automatically
  const calendarResult = await createMeetingCalendarEvent({
    schedulingRequestId: request.id,
    userId: request.created_by,
    scheduledTime: selectedDate,
    durationMinutes: request.duration_minutes,
    title: request.title || undefined,
    platform: request.meeting_platform || MEETING_PLATFORMS.TEAMS,
    location: request.meeting_location || undefined,
  });

  if (calendarResult.success) {
    console.log(`[ResponseProcessor] Calendar event created: ${calendarResult.eventId}`);
    return {
      processed: true,
      schedulingRequestId: request.id,
      action: 'time_accepted_and_booked',
      newStatus: SCHEDULING_STATUS.CONFIRMED,
    };
  } else {
    // Calendar event failed, but time was selected - flag for manual booking
    console.warn(`[ResponseProcessor] Calendar event creation failed: ${calendarResult.error}`);
    return {
      processed: true,
      schedulingRequestId: request.id,
      action: 'time_accepted',
      newStatus: SCHEDULING_STATUS.CONFIRMING,
    };
  }
}

/**
 * Handle when prospect proposes alternative times
 * NOW WITH AUTOMATIC AVAILABILITY CHECK AND RESPONSE
 */
async function handleCounterProposal(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  console.log('[counterProposal] ====== HANDLING COUNTER-PROPOSAL ======');
  console.log('[counterProposal] Request ID:', request.id);
  console.log('[counterProposal] Request Title:', request.title);
  console.log('[counterProposal] Counter-proposed times from AI:', analysis.counterProposedTimes);

  // Log the counter proposal
  await adminSchedulingService.logAction(request.id, {
    action_type: ACTION_TYPES.TIMES_PROPOSED,
    times_proposed: analysis.counterProposedTimes || [],
    actor: 'prospect',
    ai_reasoning: `Prospect suggested: ${analysis.counterProposedTimes?.join(', ')}`,
  });

  // Get the external attendee (prospect)
  const externalAttendee = (request.attendees || []).find(
    (a: SchedulingAttendee) => a.side === 'external'
  );

  if (!externalAttendee) {
    console.log('[counterProposal] ✗ No external attendee found in request');
    return await fallbackToHumanReview(request, analysis, 'No external attendee found');
  }
  console.log('[counterProposal] External attendee:', externalAttendee.email);

  // Get internal attendee emails for availability check
  const internalEmails = (request.attendees || [])
    .filter((a: SchedulingAttendee) => a.side === 'internal')
    .map((a: SchedulingAttendee) => a.email);
  console.log('[counterProposal] Internal attendees to check:', internalEmails);

  // Get counter-proposed times from AI analysis
  // Note: counterProposedTimes contains ISO timestamp strings (already parsed by the managed prompt)
  const counterProposedTimestamps = analysis.counterProposedTimes || [];
  const userTimezone = request.timezone || DEFAULT_TIMEZONE;

  if (counterProposedTimestamps.length === 0) {
    console.log('[counterProposal] ✗ No counter-proposed times from AI analysis');
    return await fallbackToHumanReview(request, analysis, 'Could not extract proposed time from response');
  }

  // Use the first proposed time (already an ISO timestamp from the managed prompt)
  const firstTimestamp = counterProposedTimestamps[0];
  console.log('[counterProposal] Using counter-proposed time from AI:', firstTimestamp);

  // Parse the ISO timestamp into a Date
  let proposedDate: Date;
  try {
    // Handle both UTC timestamps and bare local timestamps
    const normalized = normalizeAITimestamp(firstTimestamp, userTimezone);
    proposedDate = normalized.utc || new Date(firstTimestamp);

    if (isNaN(proposedDate.getTime())) {
      throw new Error('Invalid date');
    }

    // Ensure it's in the future
    if (proposedDate <= new Date()) {
      console.log('[counterProposal] ✗ Proposed time is in the past:', proposedDate.toISOString());
      return await fallbackToHumanReview(request, analysis, 'Proposed time is in the past');
    }

    console.log('[counterProposal] Parsed proposed time:', proposedDate.toISOString());
  } catch (err) {
    console.log('[counterProposal] ✗ Failed to parse timestamp:', firstTimestamp, err);
    return await fallbackToHumanReview(request, analysis, `Failed to parse proposed time: ${firstTimestamp}`);
  }

  // Check availability for all internal attendees
  console.log('[counterProposal] Checking availability...');
  console.log('[counterProposal]   Proposed time:', proposedDate.toISOString());
  console.log('[counterProposal]   Duration:', request.duration_minutes || 30, 'minutes');
  console.log('[counterProposal]   Checking calendars for:', internalEmails);

  const availabilityResult = await checkSlotAvailability(
    request.created_by,
    internalEmails,
    proposedDate,
    request.duration_minutes || 30,
    userTimezone
  );

  console.log('[counterProposal] Availability result:', {
    available: availabilityResult.available,
    conflictingAttendees: availabilityResult.conflictingAttendees,
    error: availabilityResult.error
  });

  if (availabilityResult.error) {
    console.log('[counterProposal] ✗ Availability check error:', availabilityResult.error);
    return await fallbackToHumanReview(request, analysis, `Availability check failed: ${availabilityResult.error}`);
  }

  if (availabilityResult.available) {
    // TIME WORKS! Automatically confirm and book the meeting
    console.log('[counterProposal] ✓ Time is AVAILABLE!');
    console.log('[counterProposal] MEETING_AUTO_CONFIRM_DISABLED =', MEETING_AUTO_CONFIRM_DISABLED);
    console.log('[counterProposal] Calling confirmAndBookMeeting...');

    const bookResult = await confirmAndBookMeeting(
      request,
      proposedDate,
      externalAttendee.email,
      externalAttendee.name || 'there',
      request.created_by,
      email.id
    );

    console.log('[counterProposal] Booking result:', {
      success: bookResult.success,
      isDraft: bookResult.isDraft,
      calendarEventId: bookResult.calendarEventId,
      error: bookResult.error
    });

    if (bookResult.success) {
      if (bookResult.isDraft) {
        // Draft was created - time is available but needs manual confirmation
        console.log('[counterProposal] ✓ Draft created for counter-proposal - awaiting manual confirmation');
        return {
          processed: true,
          schedulingRequestId: request.id,
          action: 'counter_proposal_draft_created',
          newStatus: SCHEDULING_STATUS.CONFIRMING, // Draft ready for manual confirmation
        };
      }

      // Full confirmation - email sent and calendar created
      console.log('[counterProposal] ✓ Meeting confirmed and calendar event created!');
      await adminSchedulingService.logAction(request.id, {
        action_type: ACTION_TYPES.STATUS_CHANGED,
        message_content: `Automatically confirmed meeting for ${proposedDate.toISOString()}`,
        actor: 'ai',
        ai_reasoning: `Counter-proposal "${firstTimestamp}" parsed to ${proposedDate.toISOString()}, availability confirmed, meeting booked automatically.`,
      });

      return {
        processed: true,
        schedulingRequestId: request.id,
        action: 'counter_proposal_auto_accepted',
        newStatus: SCHEDULING_STATUS.CONFIRMED,
      };
    } else {
      console.log('[counterProposal] ✗ Booking failed:', bookResult.error);
      return await fallbackToHumanReview(request, analysis, `Booking failed: ${bookResult.error}`);
    }
  } else {
    // TIME DOESN'T WORK - Send alternative times
    console.log('[counterProposal] ✗ Time NOT available');
    console.log('[counterProposal]   Conflicts with:', availabilityResult.conflictingAttendees);
    console.log('[counterProposal] Sending alternative times...');

    // Use the parsed timestamp for display
    const formattedRequestedTime = proposedDate.toISOString();

    const alternativeResult = await sendAlternativeTimes(
      request,
      externalAttendee.email,
      externalAttendee.name || 'there',
      request.created_by,
      formattedRequestedTime,
      email.id
    );

    console.log('[counterProposal] sendAlternativeTimes result:', {
      success: alternativeResult.success,
      isDraft: alternativeResult.isDraft,
      error: alternativeResult.error
    });

    if (alternativeResult.success) {
      console.log('[counterProposal] ✓ Alternative times sent successfully, isDraft:', alternativeResult.isDraft);
      console.log('[counterProposal] Alternative times offered:', alternativeResult.proposedTimes);
      await adminSchedulingService.logAction(request.id, {
        action_type: ACTION_TYPES.EMAIL_SENT,
        message_content: `Sent alternative times because "${firstTimestamp}" has conflicts`,
        actor: 'ai',
        ai_reasoning: `Counter-proposal conflicts with: ${availabilityResult.conflictingAttendees.join(', ')}. Sent alternative times automatically.`,
        times_proposed: alternativeResult.proposedTimes, // Store the alternative times so AI can match later
      });

      return {
        processed: true,
        schedulingRequestId: request.id,
        action: 'counter_proposal_auto_declined_with_alternatives',
        newStatus: SCHEDULING_STATUS.AWAITING_RESPONSE,
      };
    } else {
      console.error('[handleCounterProposal] Failed to send alternatives:', alternativeResult.error);
      return await fallbackToHumanReview(request, analysis, `Failed to send alternatives: ${alternativeResult.error}`);
    }
  }
}

/**
 * Fallback to human review when automation can't proceed
 */
async function fallbackToHumanReview(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  reason: string
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  console.log('[fallbackToHumanReview] Reason:', reason);

  // Transition to negotiating
  await adminSchedulingService.transitionState(
    request.id,
    SCHEDULING_STATUS.NEGOTIATING,
    {
      actor: 'ai',
      reasoning: `Automation fallback: ${reason}. Prospect suggested: ${analysis.counterProposedTimes?.join(', ')}`,
    }
  );

  // Flag for human review
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'review_counter_proposal',
      next_action_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: 'counter_proposal_needs_review',
    newStatus: SCHEDULING_STATUS.NEGOTIATING,
  };
}

/**
 * Handle when prospect declines the meeting
 */
async function handleDecline(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  // Check sentiment - if negative, might need to pause or cancel
  if (analysis.sentiment === 'negative') {
    // Pause for human review
    await adminSchedulingService.transitionState(
      request.id,
      SCHEDULING_STATUS.PAUSED,
      {
        actor: 'ai',
        reasoning: `Prospect declined with negative sentiment. Reason: ${analysis.reasoning}`,
      }
    );

    await supabase
      .from('scheduling_requests')
      .update({
        next_action_type: 'human_review_decline',
        next_action_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    return {
      processed: true,
      schedulingRequestId: request.id,
      action: 'declined_needs_review',
      newStatus: SCHEDULING_STATUS.PAUSED,
    };
  }

  // Neutral/positive decline - might be timing, try to reschedule later
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'offer_future_scheduling',
      // Schedule follow-up in a week
      next_action_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', request.id);

  await adminSchedulingService.transitionState(
    request.id,
    SCHEDULING_STATUS.PAUSED,
    {
      actor: 'ai',
      reasoning: `Prospect declined but sentiment was ${analysis.sentiment}. Scheduled future outreach.`,
    }
  );

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: 'declined_schedule_later',
    newStatus: SCHEDULING_STATUS.PAUSED,
  };
}

/**
 * Handle when prospect asks a question
 */
async function handleQuestion(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  // Questions need human review - we don't auto-respond to questions
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'answer_question',
      next_action_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  await adminSchedulingService.logAction(request.id, {
    action_type: ACTION_TYPES.EMAIL_RECEIVED,
    message_content: `Question detected: ${analysis.question}`,
    actor: 'prospect',
    ai_reasoning: 'Question requires human response',
  });

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: 'question_needs_response',
  };
}

/**
 * Handle unclear responses
 */
async function handleUnclearResponse(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  // Flag for human review
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'clarify_response',
      next_action_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: 'unclear_needs_review',
  };
}

/**
 * Handle responses that require human review
 * - out_of_office: Prospect is away, need to wait or reschedule
 * - add_attendees: Prospect wants to add people to the meeting
 * - time_in_past: Prospect suggested a time that has passed or is <4 hours away
 */
async function handleHumanReviewRequired(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail,
  reviewType: 'out_of_office' | 'add_attendees' | 'time_in_past'
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  // Determine the appropriate next action based on review type
  let nextActionType: string;
  let actionDescription: string;

  switch (reviewType) {
    case 'out_of_office':
      nextActionType = 'human_review_ooo';
      actionDescription = `Out of office response detected${
        analysis.outOfOfficeReturnDate ? `. Returns: ${analysis.outOfOfficeReturnDate}` : ''
      }`;
      break;

    case 'add_attendees':
      nextActionType = 'human_review_attendees';
      const attendeeInfo = analysis.additionalAttendees
        ?.map(a => a.email || a.name || 'unknown')
        .join(', ');
      actionDescription = `Prospect wants to add attendees: ${attendeeInfo || 'see email'}`;
      break;

    case 'time_in_past':
      nextActionType = 'human_review_past_time';
      actionDescription = `Prospect suggested a time that is in the past or less than 4 hours away`;
      break;

    default:
      nextActionType = 'human_review';
      actionDescription = analysis.humanReviewReason || 'Unknown reason';
  }

  console.log(`[handleHumanReviewRequired] Type: ${reviewType}`);
  console.log(`[handleHumanReviewRequired] Action: ${nextActionType}`);
  console.log(`[handleHumanReviewRequired] Description: ${actionDescription}`);

  // Update the scheduling request to flag for human review
  await supabase
    .from('scheduling_requests')
    .update({
      status: 'negotiating',
      next_action_type: nextActionType,
      next_action_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  // Log the action for audit trail
  await supabase.from('scheduling_actions').insert({
    scheduling_request_id: request.id,
    action_type: 'human_review_flagged',
    ai_reasoning: `${actionDescription}. AI reasoning: ${analysis.reasoning}`,
    previous_status: request.status,
    new_status: 'negotiating',
    actor: 'system',
  });

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: nextActionType,
    requiresHumanReview: true,
    reviewReason: actionDescription,
  };
}

// ============================================
// EMAIL HELPER WITH X-FORCE CATEGORY
// ============================================

/**
 * Add a category to an existing email message
 */
async function addCategoryToEmail(
  token: string,
  messageId: string,
  category: string
): Promise<void> {
  // First get existing categories
  const getResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=categories`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!getResponse.ok) {
    throw new Error(`Failed to get message: ${await getResponse.text()}`);
  }

  const message = await getResponse.json();
  const existingCategories: string[] = message.categories || [];

  // Add new category if not already present
  if (!existingCategories.includes(category)) {
    existingCategories.push(category);

    const patchResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories: existingCategories }),
      }
    );

    if (!patchResponse.ok) {
      throw new Error(`Failed to update categories: ${await patchResponse.text()}`);
    }
  }
}

/**
 * Send an email with the X-FORCE category badge
 * Uses draft-then-send approach to add category before sending
 *
 * If replyToMessageId is provided, creates a reply to that message (preserving thread)
 * Otherwise creates a new message
 *
 * SAFEGUARD: When SCHEDULER_DRAFT_ONLY_MODE is true, emails are saved as drafts
 * for manual review instead of being sent automatically.
 */
async function sendEmailWithCategory(
  token: string,
  message: {
    subject: string;
    body: { contentType: 'Text' | 'HTML'; content: string };
    toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
  },
  replyToMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string; isDraft?: boolean }> {
  try {
    let draftResponse: Response;

    if (replyToMessageId) {
      // Step 1a: Create a reply draft (preserves thread/conversation)
      console.log('[sendEmailWithCategory] Creating reply to message:', replyToMessageId);
      draftResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${replyToMessageId}/createReply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'IdType="ImmutableId"',
        },
      });
    } else {
      // Step 1b: Create a new draft message
      draftResponse = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: message.subject,
          body: message.body,
          toRecipients: message.toRecipients,
          categories: ['X-FORCE'],
        }),
      });
    }

    if (!draftResponse.ok) {
      const errorText = await draftResponse.text();
      return { success: false, error: `Failed to create draft: ${errorText}` };
    }

    const draft = await draftResponse.json();
    const messageId = draft.id;

    // Step 2: Update the draft with our content and category
    if (replyToMessageId) {
      // For replies, prepend our new content to the existing quoted thread
      // IMPORTANT: createReply ALWAYS returns HTML body, so we must use HTML
      const existingBody = draft.body?.content || '';

      // Convert our message to HTML if it's plain text (safety measure)
      let ourContent = message.body.content;
      if (message.body.contentType !== 'HTML') {
        // Escape HTML entities and convert newlines to <br>
        ourContent = ourContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
      }

      // Always use HTML since existingBody from createReply is HTML
      const newBodyContent = `${ourContent}<br><br>${existingBody}`;

      const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: {
            contentType: 'HTML', // Always HTML for replies since createReply returns HTML
            content: newBodyContent,
          },
          categories: ['X-FORCE'],
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        return { success: false, error: `Failed to update reply draft: ${errorText}` };
      }
    }

    // SAFEGUARD: If draft-only mode is enabled, skip sending and leave as draft
    if (SCHEDULER_DRAFT_ONLY_MODE) {
      console.log(`[sendEmailWithCategory] DRAFT ONLY MODE - Email saved as draft for manual review:`, messageId);
      console.log(`[sendEmailWithCategory] Subject: ${message.subject}`);
      console.log(`[sendEmailWithCategory] To: ${message.toRecipients.map(r => r.emailAddress.address).join(', ')}`);
      return { success: true, messageId, isDraft: true };
    }

    // Step 3: Send the draft (only if not in draft-only mode)
    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sendResponse.ok && sendResponse.status !== 202) {
      const errorText = await sendResponse.text();
      return { success: false, error: `Failed to send: ${errorText}` };
    }

    console.log(`[sendEmailWithCategory] Email ${replyToMessageId ? 'reply' : 'new'} sent with X-FORCE category:`, messageId);
    return { success: true, messageId };
  } catch (err) {
    console.error('[sendEmailWithCategory] Error:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// COUNTER-PROPOSAL AUTOMATION
// ============================================

/**
 * Parse natural language time descriptions into ISO timestamps using AI
 *
 * Uses managed prompt: scheduler_datetime_parsing (editable at /settings/ai-prompts)
 *
 * CRITICAL: This function properly handles timezone conversion.
 * - AI returns times in the user's local timezone
 * - We convert to UTC for storage and comparison
 * - The returned isoTimestamp is ALWAYS in UTC (ends with Z)
 */
async function parseProposedDateTime(
  timeDescription: string,
  emailBody: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<{ isoTimestamp: string | null; confidence: 'high' | 'medium' | 'low'; reasoning: string }> {
  const tz = normalizeTimezone(userTimezone);
  const dateContext = buildDateContextForAI(tz);
  const timestampInstructions = getAITimestampInstructions(tz);

  try {
    // Try to use managed prompt from database
    const promptResult = await getPromptWithVariables('scheduler_datetime_parsing', {
      todayFormatted: dateContext.todayFormatted,
      currentYear: String(dateContext.currentYear),
      nextYear: String(dateContext.nextYear),
      timezoneInfo: dateContext.timezoneInfo,
      timeDescription,
      emailContext: emailBody.substring(0, 500),
      yearGuidance: dateContext.yearGuidance,
      timestampInstructions,
      timezone: tz,
    });

    let prompt: string;
    let model: string = 'claude-3-haiku-20240307';
    let maxTokens: number = 500;

    if (promptResult?.prompt) {
      prompt = promptResult.prompt;
      model = promptResult.model || model;
      maxTokens = promptResult.maxTokens || maxTokens;
    } else {
      // Fallback to inline prompt if managed prompt not available
      console.warn('[parseProposedDateTime] Managed prompt not found, using fallback');
      prompt = `You are an expert at parsing natural language date/time expressions into precise timestamps.

CRITICAL TIMEZONE RULE: The user is in ${tz}. When they say "2pm" they mean 2pm in THEIR timezone, not UTC.
- If they say "2pm EST", return "...T14:00:00-05:00" (with -05:00 offset)
- If they say "2pm" without timezone, assume ${tz} and include the appropriate offset
- NEVER return a bare timestamp like "...T14:00:00" without timezone info

---

Parse this proposed meeting time into an ISO timestamp.

TODAY'S DATE: ${dateContext.todayFormatted}
CURRENT YEAR: ${dateContext.currentYear}
${dateContext.timezoneInfo}

TIME DESCRIPTION: "${timeDescription}"

FULL EMAIL CONTEXT:
${emailBody.substring(0, 500)}

Return a JSON object with:
- isoTimestamp: The ISO timestamp string WITH TIMEZONE (e.g., "${dateContext.nextYear}-01-05T14:00:00-05:00" for 2pm EST), or null if unparseable
- confidence: "high", "medium", or "low"
- reasoning: Brief explanation including the timezone interpretation`;
    }

    const response = await callAIJson<{
      isoTimestamp: string | null;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    }>({
      prompt,
      model: model as 'claude-3-haiku-20240307' | 'claude-sonnet-4-20250514',
      maxTokens,
      temperature: 0.1,
    });

    // CRITICAL: Normalize the AI timestamp to proper UTC
    if (response.data.isoTimestamp) {
      const normalized = normalizeAITimestamp(response.data.isoTimestamp, tz);

      if (normalized.utc) {
        const now = new Date();

        // Validate the parsed date is in the future
        if (normalized.utc <= now) {
          // Date is in the past - try adding a year
          const correctedDate = new Date(normalized.utc);
          correctedDate.setFullYear(correctedDate.getFullYear() + 1);

          if (correctedDate > now) {
            console.warn(`[parseProposedDateTime] Fixed past date by adding year: ${normalized.utc.toISOString()} -> ${correctedDate.toISOString()}`);
            response.data.isoTimestamp = correctedDate.toISOString();
            response.data.reasoning += ` (Auto-corrected: date was in past, added 1 year)`;
          } else {
            console.warn(`[parseProposedDateTime] Date still in past after correction: ${correctedDate.toISOString()}`);
            response.data.isoTimestamp = correctedDate.toISOString();
          }
        } else {
          // Date is valid - store as UTC ISO string
          response.data.isoTimestamp = normalized.utc.toISOString();
        }

        if (normalized.wasConverted) {
          response.data.reasoning += ` (Converted from ${tz} to UTC)`;
        }

        console.log(`[parseProposedDateTime] Final UTC timestamp: ${response.data.isoTimestamp}`);
      } else {
        console.warn(`[parseProposedDateTime] Could not normalize timestamp: ${response.data.isoTimestamp}`);
      }
    }

    return response.data;
  } catch (err) {
    console.error('[parseProposedDateTime] AI parsing failed:', err);
    return {
      isoTimestamp: null,
      confidence: 'low',
      reasoning: `Failed to parse: ${err}`,
    };
  }
}

/**
 * Check if a specific time slot is available for all required attendees
 * IMPORTANT: This now includes the organizer's own calendar in the check
 */
async function checkSlotAvailability(
  userId: string,
  attendeeEmails: string[],
  proposedTime: Date,
  durationMinutes: number,
  timezone: string = DEFAULT_TIMEZONE
): Promise<{ available: boolean; conflictingAttendees: string[]; error?: string }> {
  try {
    const { getValidToken } = await import('@/lib/microsoft/auth');
    const token = await getValidToken(userId);

    if (!token) {
      return { available: false, conflictingAttendees: [], error: 'No valid token' };
    }

    // Get the organizer's email to include in the availability check
    let organizerEmail: string | null = null;
    try {
      const meResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        organizerEmail = meData.mail || meData.userPrincipalName;
      }
    } catch (err) {
      console.warn('[checkSlotAvailability] Could not get organizer email:', err);
    }

    // Combine organizer email with attendee emails (avoid duplicates)
    const allSchedulesToCheck = organizerEmail
      ? [...new Set([organizerEmail, ...attendeeEmails])]
      : attendeeEmails;

    const tz = normalizeTimezone(timezone);
    const startTime = formatForGraphAPI(proposedTime, tz);
    const endDate = addMinutes(proposedTime, durationMinutes);
    const endTime = formatForGraphAPI(endDate, tz);

    console.log(`[checkSlotAvailability] Checking ${startTime} to ${endTime} (${tz}) for ${allSchedulesToCheck.join(', ')}`);
    console.log(`[checkSlotAvailability] Organizer: ${organizerEmail || 'unknown'}, Attendees: ${attendeeEmails.join(', ')}`);

    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: allSchedulesToCheck,
        startTime: { dateTime: startTime, timeZone: tz },
        endTime: { dateTime: endTime, timeZone: tz },
        availabilityViewInterval: durationMinutes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[checkSlotAvailability] Graph API error:', errorText);
      return { available: false, conflictingAttendees: [], error: errorText };
    }

    const data = await response.json();
    const conflictingAttendees: string[] = [];

    for (const schedule of data.value) {
      // availabilityView: 0=free, 1=tentative, 2=busy, 3=OOO, 4=working elsewhere
      const view = schedule.availabilityView || '';
      const isFree = view === '0' || view === '' || view === '4';

      if (!isFree) {
        conflictingAttendees.push(schedule.scheduleId);
      }
    }

    console.log(`[checkSlotAvailability] Result: ${conflictingAttendees.length === 0 ? 'AVAILABLE' : 'CONFLICTS: ' + conflictingAttendees.join(', ')}`);

    return {
      available: conflictingAttendees.length === 0,
      conflictingAttendees,
    };
  } catch (err) {
    console.error('[checkSlotAvailability] Error:', err);
    return { available: false, conflictingAttendees: [], error: String(err) };
  }
}

// SAFEGUARD: Prevent automatic meeting confirmation and calendar creation
// Set to true to require manual confirmation until timezone issues are verified fixed
const MEETING_AUTO_CONFIRM_DISABLED = true;

/**
 * Send confirmation email and create calendar event
 * When MEETING_AUTO_CONFIRM_DISABLED is true, creates a draft email for manual review
 */
async function confirmAndBookMeeting(
  request: SchedulingRequest,
  confirmedTime: Date,
  prospectEmail: string,
  prospectName: string,
  userId: string,
  replyToMessageId?: string
): Promise<{ success: boolean; calendarEventId?: string; error?: string; isDraft?: boolean }> {
  const supabase = createAdminClient();

  try {
    const { getValidToken } = await import('@/lib/microsoft/auth');
    const token = await getValidToken(userId);

    if (!token) {
      return { success: false, error: 'No valid token' };
    }

    // Format the time for email
    const formattedTime = confirmedTime.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: request.timezone || 'America/New_York',
    });

    // Generate confirmation email using managed prompt
    let emailBody: string;
    try {
      const promptResult = await getPromptWithVariables('scheduler_counter_proposal_response', {
        prospectName,
        companyName: 'your company',
        meetingTitle: request.title || 'our meeting',
        proposedTime: formattedTime,
        isAvailable: 'true',
        alternativeTimes: '',
        declinedTimes: '',
        senderName: 'Brent',
      });

      if (promptResult && promptResult.prompt) {
        const { data: aiResponse } = await callAIJson<{ emailBody: string }>({
          prompt: promptResult.prompt + '\n\nReturn JSON: { "emailBody": "your email text here" }',
          model: (promptResult.model as 'claude-sonnet-4-20250514') || 'claude-sonnet-4-20250514',
          maxTokens: promptResult.maxTokens || 500,
        });
        emailBody = aiResponse.emailBody || '';
      } else {
        throw new Error('Prompt not found');
      }
    } catch (promptError) {
      console.warn('[confirmAndBookMeeting] Falling back to default email template:', promptError);
      emailBody = `Hi ${prospectName},

Great news! Our meeting is confirmed for ${formattedTime}.

You'll receive a calendar invite shortly with the meeting link.

Looking forward to speaking with you!

Best,
Brent`;
    }

    // Send confirmation email with X-FORCE category (as reply if we have the original message ID)
    // Use HTML content type since createReply returns HTML body with quoted thread
    const htmlEmailBody = emailBody.replace(/\n/g, '<br>');
    const emailResult = await sendEmailWithCategory(token, {
      subject: `Confirmed: ${request.title} - ${formattedTime}`,
      body: {
        contentType: 'HTML',
        content: htmlEmailBody,
      },
      toRecipients: [{ emailAddress: { address: prospectEmail, name: prospectName } }],
    }, replyToMessageId);

    if (!emailResult.success) {
      console.error('[confirmAndBookMeeting] Failed to send email:', emailResult.error);
      return { success: false, error: `Email send failed: ${emailResult.error}` };
    }

    // SAFEGUARD: When auto-confirmation is disabled, save email as draft and skip calendar/status updates
    if (MEETING_AUTO_CONFIRM_DISABLED) {
      console.log('[confirmAndBookMeeting] SAFEGUARD ACTIVE - Auto-confirmation disabled');
      console.log('[confirmAndBookMeeting] Draft email created for meeting at:', confirmedTime.toISOString());
      console.log('[confirmAndBookMeeting] Time in ET:', confirmedTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      console.log('[confirmAndBookMeeting] Email saved as draft - requires manual review before sending and creating calendar event');

      // Log action for visibility
      await adminSchedulingService.logAction(request.id, {
        action_type: ACTION_TYPES.STATUS_CHANGED,
        message_content: `Counter-proposal accepted - draft confirmation email created for ${formattedTime}. Requires manual review before sending.`,
        actor: 'ai',
        ai_reasoning: `Time slot is available. Draft created for manual review due to MEETING_AUTO_CONFIRM_DISABLED safeguard.`,
      });

      return {
        success: true,
        isDraft: true,
        error: 'Draft created for manual review. Calendar event not created - please confirm manually.',
      };
    }

    console.log('[confirmAndBookMeeting] Confirmation email sent with X-FORCE category');

    // Create calendar event
    const internalAttendees = (request.attendees || [])
      .filter((a: SchedulingAttendee) => a.side === 'internal')
      .map((a: SchedulingAttendee) => ({
        emailAddress: { address: a.email, name: a.name },
        type: 'required',
      }));

    const endTime = new Date(confirmedTime.getTime() + (request.duration_minutes || 30) * 60 * 1000);

    // Format times for Graph API in Eastern Time
    // Use sv-SE locale for ISO-like format (YYYY-MM-DD HH:mm:ss)
    const formatForGraph = (date: Date): string => {
      return date.toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', 'T');
    };

    const startDateTime = formatForGraph(confirmedTime);
    const endDateTime = formatForGraph(endTime);

    console.log('[confirmAndBookMeeting] Creating calendar event:', {
      start: startDateTime,
      end: endDateTime,
      confirmedTimeISO: confirmedTime.toISOString(),
    });

    const calendarResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="America/New_York"',
      },
      body: JSON.stringify({
        subject: request.title,
        body: {
          contentType: 'Text',
          content: `${request.title}\n\nAttendees: ${prospectName}, ${internalAttendees.map((a) => a.emailAddress.name || a.emailAddress.address).join(', ')}`,
        },
        start: {
          dateTime: startDateTime,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/New_York',
        },
        attendees: [
          ...internalAttendees,
          { emailAddress: { address: prospectEmail, name: prospectName }, type: 'required' },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      }),
    });

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('[confirmAndBookMeeting] Failed to create calendar event:', errorText);
      // Email was sent, so partial success - meeting confirmed but no calendar event
      return { success: true, error: `Calendar event failed: ${errorText}` };
    }

    const calendarEvent = await calendarResponse.json();
    console.log('[confirmAndBookMeeting] Calendar event created:', calendarEvent.id);

    // Update scheduling request
    const { error: updateError } = await supabase
      .from('scheduling_requests')
      .update({
        status: SCHEDULING_STATUS.CONFIRMED,
        scheduled_time: confirmedTime.toISOString(),
        calendar_event_id: calendarEvent.id,
        meeting_link: calendarEvent.onlineMeeting?.joinUrl,
        last_action_at: new Date().toISOString(),
        next_action_type: null,
        next_action_at: null,
      })
      .eq('id', request.id);

    if (updateError) {
      console.error('[confirmAndBookMeeting] Failed to update request status:', updateError);
      // Still return success since email and calendar were created
    } else {
      console.log('[confirmAndBookMeeting] Request status updated to CONFIRMED for:', request.id);
    }

    // ============================================
    // RESOLVE RELATED ITEMS (Consolidation Fix)
    // ============================================
    // When a meeting is confirmed, clean up all related Action Now items:
    // 1. Resolve any BOOK_MEETING_APPROVAL attention flags for this scheduling request
    // 2. Mark communications in the thread as responded

    // 1. Resolve attention flags linked to this scheduling request
    const { data: relatedFlags, error: flagsError } = await supabase
      .from('attention_flags')
      .select('id')
      .eq('source_id', request.id)
      .eq('status', 'open')
      .in('flag_type', ['BOOK_MEETING_APPROVAL', 'NEEDS_REPLY', 'NO_NEXT_STEP_AFTER_MEETING']);

    if (flagsError) {
      console.warn('[confirmAndBookMeeting] Error finding related flags:', flagsError);
    } else if (relatedFlags && relatedFlags.length > 0) {
      const flagIds = relatedFlags.map(f => f.id);
      const { error: resolveError } = await supabase
        .from('attention_flags')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: `Auto-resolved: Meeting confirmed for ${confirmedTime.toISOString()}`,
        })
        .in('id', flagIds);

      if (resolveError) {
        console.warn('[confirmAndBookMeeting] Error resolving flags:', resolveError);
      } else {
        console.log(`[confirmAndBookMeeting] Resolved ${flagIds.length} attention flags`);
      }
    }

    // 2. Also resolve flags by company_id if they are BOOK_MEETING_APPROVAL type
    if (request.company_id) {
      const { data: companyFlags, error: companyFlagsError } = await supabase
        .from('attention_flags')
        .select('id')
        .eq('company_id', request.company_id)
        .eq('status', 'open')
        .eq('flag_type', 'BOOK_MEETING_APPROVAL');

      if (!companyFlagsError && companyFlags && companyFlags.length > 0) {
        const flagIds = companyFlags.map(f => f.id);
        await supabase
          .from('attention_flags')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: `Auto-resolved: Meeting confirmed for ${confirmedTime.toISOString()}`,
          })
          .in('id', flagIds);
        console.log(`[confirmAndBookMeeting] Resolved ${flagIds.length} company BOOK_MEETING_APPROVAL flags`);
      }
    }

    // 3. Mark communications in the thread as responded
    if (request.email_thread_id) {
      const { error: commError } = await supabase
        .from('communications')
        .update({
          awaiting_our_response: false,
          responded_at: new Date().toISOString(),
        })
        .eq('thread_id', request.email_thread_id)
        .eq('awaiting_our_response', true);

      if (commError) {
        console.warn('[confirmAndBookMeeting] Error marking communications as responded:', commError);
      } else {
        console.log('[confirmAndBookMeeting] Marked thread communications as responded');
      }
    }

    // 4. Also mark communications by company if we have attendee emails
    const externalEmails = (request.attendees || [])
      .filter((a: SchedulingAttendee) => a.side === 'external')
      .map((a: SchedulingAttendee) => a.email.toLowerCase());

    if (externalEmails.length > 0 && request.company_id) {
      // Find recent communications from these attendees that are awaiting response
      const { data: recentComms } = await supabase
        .from('communications')
        .select('id')
        .eq('company_id', request.company_id)
        .eq('awaiting_our_response', true)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (recentComms && recentComms.length > 0) {
        const commIds = recentComms.map(c => c.id);
        await supabase
          .from('communications')
          .update({
            awaiting_our_response: false,
            responded_at: new Date().toISOString(),
          })
          .in('id', commIds);
        console.log(`[confirmAndBookMeeting] Marked ${commIds.length} company communications as responded`);
      }
    }

    return { success: true, calendarEventId: calendarEvent.id };
  } catch (err) {
    console.error('[confirmAndBookMeeting] Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send email with alternative time suggestions when proposed time doesn't work
 */
async function sendAlternativeTimes(
  request: SchedulingRequest,
  prospectEmail: string,
  prospectName: string,
  userId: string,
  proposedTimeDescription: string,
  replyToMessageId?: string
): Promise<{ success: boolean; error?: string; isDraft?: boolean; proposedTimes?: string[] }> {
  try {
    const { getValidToken } = await import('@/lib/microsoft/auth');
    const { getAlternativesAroundTime } = await import('./calendarIntegration');

    const token = await getValidToken(userId);

    if (!token) {
      return { success: false, error: 'No valid token' };
    }

    // Get internal attendee emails
    const internalEmails = (request.attendees || [])
      .filter((a: SchedulingAttendee) => a.side === 'internal')
      .map((a: SchedulingAttendee) => a.email);

    // Parse the proposed time to use as focal point
    let proposedDate: Date;
    if (proposedTimeDescription.match(/^\d{4}-\d{2}-\d{2}/)) {
      proposedDate = new Date(proposedTimeDescription);
    } else {
      // If not ISO format, try to parse
      proposedDate = new Date(proposedTimeDescription);
    }

    if (isNaN(proposedDate.getTime())) {
      // Default to next business day at noon if parsing fails
      proposedDate = new Date();
      proposedDate.setDate(proposedDate.getDate() + 1);
      proposedDate.setHours(12, 0, 0, 0);
    }

    // Get previously proposed times (these are times the prospect implicitly declined)
    const declinedTimes = request.proposed_times || [];

    console.log('[sendAlternativeTimes] Finding alternatives around:', proposedDate.toISOString());
    console.log('[sendAlternativeTimes] Excluding previously proposed times:', declinedTimes);

    // Find alternative slots FOCUSED around the prospect's requested time
    const slotsResult = await getAlternativesAroundTime(userId, internalEmails, {
      requestedTime: proposedDate,
      durationMinutes: request.duration_minutes || 30,
      excludeTimes: declinedTimes,
      maxAlternatives: 4,
      hourRange: 3, // Look ±3 hours from their requested time
      timezone: request.timezone || 'America/New_York',
    });

    if (!slotsResult.slots || slotsResult.slots.length === 0) {
      // No slots available - flag for human review
      return { success: false, error: 'No alternative slots available around requested time' };
    }

    // Format slots for display
    const formattedSlots = slotsResult.slots.map(slot => slot.formatted);

    // Format the proposed time nicely
    let formattedProposedTime = proposedTimeDescription;
    if (proposedTimeDescription.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        const pDate = new Date(proposedTimeDescription);
        formattedProposedTime = pDate.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
          timeZone: request.timezone || 'America/New_York',
        });
      } catch {
        // Keep original if parsing fails
      }
    }

    // Use the managed prompt for email generation
    let emailBody: string;
    try {
      const promptResult = await getPromptWithVariables('scheduler_counter_proposal_response', {
        prospectName,
        companyName: 'your company',
        meetingTitle: request.title || 'our meeting',
        proposedTime: formattedProposedTime,
        isAvailable: 'false',
        alternativeTimes: formattedSlots.map((t, i) => `• ${t}`).join('\n'),
        declinedTimes: declinedTimes.join(', ') || 'None',
        senderName: 'Brent',
      });

      if (promptResult && promptResult.prompt) {
        const { data: aiResponse } = await callAIJson<{ emailBody: string }>({
          prompt: promptResult.prompt + '\n\nReturn JSON: { "emailBody": "your email text here" }',
          model: (promptResult.model as 'claude-sonnet-4-20250514') || 'claude-sonnet-4-20250514',
          maxTokens: promptResult.maxTokens || 500,
        });
        emailBody = aiResponse.emailBody || '';
      } else {
        throw new Error('Prompt not found');
      }
    } catch (promptError) {
      console.warn('[sendAlternativeTimes] Falling back to default email template:', promptError);
      // Fallback to simple template if prompt fails
      emailBody = `Hi ${prospectName},

Thank you for your response! Unfortunately, ${formattedProposedTime} doesn't work with our team's availability.

Here are some alternative times around when you suggested that work for everyone:

${formattedSlots.map((t) => `• ${t}`).join('\n')}

Just reply with which time works best for you, and I'll get us scheduled right away.

Best,
Brent`;
    }

    // Send alternative times email with X-FORCE category (as reply to preserve thread)
    // Use HTML content type since createReply returns HTML body with quoted thread
    const htmlEmailBody = emailBody.replace(/\n/g, '<br>');
    const sendResult = await sendEmailWithCategory(token, {
      subject: `Re: ${request.title}`,
      body: { contentType: 'HTML', content: htmlEmailBody },
      toRecipients: [{ emailAddress: { address: prospectEmail, name: prospectName } }],
    }, replyToMessageId);

    if (!sendResult.success) {
      return { success: false, error: `Email send failed: ${sendResult.error}` };
    }

    // Update the proposed times on the request (replace with new alternatives)
    const supabase = createAdminClient();
    await supabase
      .from('scheduling_requests')
      .update({
        proposed_times: slotsResult.slots.map(s => s.formatted),
        last_action_at: new Date().toISOString(),
        status: SCHEDULING_STATUS.AWAITING_RESPONSE,
        next_action_type: null, // Clear since automation handled it
        next_action_at: null,
      })
      .eq('id', request.id);

    console.log('[sendAlternativeTimes] Alternative times email created, isDraft:', sendResult.isDraft);
    console.log('[sendAlternativeTimes] Alternatives focused around:', formattedProposedTime);
    console.log('[sendAlternativeTimes] Proposed times:', formattedSlots);
    return { success: true, isDraft: sendResult.isDraft, proposedTimes: formattedSlots };
  } catch (err) {
    console.error('[sendAlternativeTimes] Error:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Try to match a selected time from email body to proposed times
 */
function matchSelectedTime(proposedTimes: string[], emailBody: string): string | null {
  const bodyLower = emailBody.toLowerCase();

  // Check for option references (e.g., "option 1", "the first one", "#2")
  const optionPatterns = [
    /option\s*(\d)/i,
    /number\s*(\d)/i,
    /#(\d)/,
    /(first|second|third|fourth|fifth)/i,
  ];

  for (const pattern of optionPatterns) {
    const match = bodyLower.match(pattern);
    if (match) {
      let index: number;
      if (['first', 'second', 'third', 'fourth', 'fifth'].includes(match[1]?.toLowerCase())) {
        const ordinals: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4 };
        index = ordinals[match[1].toLowerCase()];
      } else {
        index = parseInt(match[1]) - 1;
      }

      if (index >= 0 && index < proposedTimes.length) {
        return proposedTimes[index];
      }
    }
  }

  // Check for day mentions
  // Use ET timezone for consistent day name extraction
  for (let i = 0; i < proposedTimes.length; i++) {
    const time = new Date(proposedTimes[i]);
    const dayName = time.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' }).toLowerCase();
    if (bodyLower.includes(dayName)) {
      return proposedTimes[i];
    }
  }

  // Check for date patterns (e.g., "the 15th", "December 20")
  // Use ET timezone for consistent date/month extraction
  for (let i = 0; i < proposedTimes.length; i++) {
    const time = new Date(proposedTimes[i]);
    const day = parseInt(time.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' }));
    const monthName = time.toLocaleDateString('en-US', { month: 'long', timeZone: 'America/New_York' }).toLowerCase();

    if (bodyLower.includes(`${day}th`) || bodyLower.includes(`${day}st`) ||
        bodyLower.includes(`${day}nd`) || bodyLower.includes(`${day}rd`) ||
        bodyLower.includes(monthName)) {
      return proposedTimes[i];
    }
  }

  return null;
}

// ============================================
// BATCH PROCESSING
// ============================================

/**
 * Process all unprocessed scheduling-related emails
 * Called after email sync to detect and handle responses
 *
 * UPDATED: Now reads from communications table instead of activities
 */
export async function processSchedulingEmails(userId: string): Promise<{
  processed: number;
  matched: number;
  errors: string[];
}> {
  const result = { processed: 0, matched: 0, errors: [] as string[] };

  // Kill switch - don't process any scheduling emails
  if (SCHEDULER_AUTO_REPLY_DISABLED) {
    console.log('[processSchedulingEmails] DISABLED - Scheduler auto-reply is temporarily turned off');
    return result;
  }

  const supabase = createAdminClient();

  try {
    // Get recent inbound emails from communications table
    const { data: recentCommunications } = await supabase
      .from('communications')
      .select('*')
      .eq('channel', 'email')
      .eq('direction', 'inbound')
      .eq('user_id', userId)
      .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (!recentCommunications || recentCommunications.length === 0) {
      return result;
    }

    for (const comm of recentCommunications) {
      result.processed++;

      // Extract sender from their_participants (for inbound emails, sender is in their_participants)
      const theirParticipants = (comm.their_participants as Array<{ email?: string; name?: string }>) || [];
      const sender = theirParticipants[0] || { email: '', name: '' };

      const email: IncomingEmail = {
        id: comm.external_id || comm.id,
        subject: comm.subject || '',
        body: comm.full_content || comm.content_preview || '',
        bodyPreview: comm.content_preview || '',
        from: {
          address: sender.email || '',
          name: sender.name,
        },
        receivedDateTime: comm.occurred_at,
        conversationId: comm.thread_id,
      };

      // Try to find matching scheduling request
      const matchingRequest = await findMatchingSchedulingRequest(email);

      if (matchingRequest) {
        result.matched++;

        // Check if already processed (by checking if action exists for this email)
        const { data: existingAction } = await supabase
          .from('scheduling_actions')
          .select('id')
          .eq('scheduling_request_id', matchingRequest.id)
          .eq('email_id', email.id)
          .single();

        if (existingAction) {
          continue; // Already processed
        }

        // Process the response
        const processResult = await processSchedulingResponse(email, matchingRequest);

        if (!processResult.processed) {
          result.errors.push(`Failed to process email ${email.id}: ${processResult.error}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Batch processing error: ${err}`);
  }

  return result;
}

// ============================================
// EXPORTS
// ============================================

export {
  type IncomingEmail,
  type ProcessingResult,
  type ResponseAnalysis,
};
