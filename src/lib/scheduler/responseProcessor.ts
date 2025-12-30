/**
 * Scheduling Response Processor
 *
 * Detects and processes incoming email responses to scheduling requests.
 * Integrates with Microsoft email sync to automatically handle responses.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { parseSchedulingResponse, generateSchedulingEmail, formatTimeSlotsForEmail } from './emailGeneration';
import { adminSchedulingService } from './schedulingService';
import { sendEmail } from '@/lib/microsoft/emailSync';
import { createMeetingCalendarEvent, getMultiAttendeeAvailability } from './calendarIntegration';
import { callAIJson } from '@/lib/ai/core/aiClient';
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
  receivedDateTime: string;
  conversationId?: string;
}

interface ProcessingResult {
  processed: boolean;
  schedulingRequestId?: string;
  action?: string;
  newStatus?: SchedulingStatus;
  error?: string;
}

interface ResponseAnalysis {
  intent: 'accept' | 'decline' | 'counter_propose' | 'question' | 'unclear';
  selectedTime?: string;
  counterProposedTimes?: string[];
  question?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  reasoning: string;
  isConfused?: boolean;
  confusionReason?: string;
}

// ============================================
// RESPONSE DETECTION
// ============================================

/**
 * Find scheduling request matching an incoming email
 */
export async function findMatchingSchedulingRequest(
  email: IncomingEmail
): Promise<SchedulingRequest | null> {
  const supabase = createAdminClient();

  // Strategy 1: Match by conversation/thread ID
  if (email.conversationId) {
    const { data: byThread } = await supabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*)
      `)
      .eq('email_thread_id', email.conversationId)
      .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED},${SCHEDULING_STATUS.CONFIRMED})`)
      .single();

    if (byThread) {
      return byThread as SchedulingRequest;
    }
  }

  // Strategy 2: Match by sender email to active scheduling request attendees
  const { data: byEmail } = await supabase
    .from('scheduling_attendees')
    .select(`
      scheduling_request_id,
      scheduling_request:scheduling_requests(
        *,
        attendees:scheduling_attendees(*)
      )
    `)
    .eq('email', email.from.address.toLowerCase())
    .eq('side', 'external');

  if (byEmail && byEmail.length > 0) {
    // Find active scheduling request for this contact
    for (const attendee of byEmail) {
      const request = attendee.scheduling_request as unknown as SchedulingRequest;
      if (
        request &&
        request.status !== SCHEDULING_STATUS.COMPLETED &&
        request.status !== SCHEDULING_STATUS.CANCELLED &&
        request.status !== SCHEDULING_STATUS.CONFIRMED
      ) {
        // Check if email subject might relate to scheduling
        const schedulingKeywords = [
          'schedule', 'meeting', 'calendar', 'time', 'available',
          'works', 'demo', 'call', 'tuesday', 'wednesday', 'thursday',
          'friday', 'monday', 'morning', 'afternoon', 'pm', 'am',
        ];
        const subjectLower = email.subject.toLowerCase();
        const hasSchedulingKeyword = schedulingKeywords.some(kw => subjectLower.includes(kw));

        if (hasSchedulingKeyword || request.status === SCHEDULING_STATUS.AWAITING_RESPONSE) {
          return request;
        }
      }
    }
  }

  return null;
}

// ============================================
// RESPONSE PROCESSING
// ============================================

// TEMPORARY KILL SWITCH - Set to true to disable all scheduler auto-replies
const SCHEDULER_AUTO_REPLY_DISABLED = false;

// Minimum delay in milliseconds before responding to a scheduling email
// This prevents instant robotic-feeling responses and gives time for human review
const RESPONSE_DELAY_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Process an incoming email response to a scheduling request
 */
export async function processSchedulingResponse(
  email: IncomingEmail,
  schedulingRequest: SchedulingRequest
): Promise<ProcessingResult> {
  // Kill switch - don't send any automatic replies
  if (SCHEDULER_AUTO_REPLY_DISABLED) {
    console.log('[processSchedulingResponse] DISABLED - Auto-reply is temporarily turned off');
    return {
      processed: false,
      error: 'Scheduler auto-reply temporarily disabled',
    };
  }

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
  if (timeSinceEmail < RESPONSE_DELAY_MS) {
    const delayRemaining = RESPONSE_DELAY_MS - timeSinceEmail;
    console.log(`[processSchedulingResponse] Email received ${Math.round(timeSinceEmail / 1000)}s ago, deferring by ${Math.round(delayRemaining / 1000)}s`);

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

  try {
    // Parse the response using AI
    const proposedTimesFormatted = (schedulingRequest.proposed_times || []).map((t, i) => {
      const date = new Date(t);
      return `Option ${i + 1}: ${date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    });

    const analysis = await parseSchedulingResponse(
      email.body || email.bodyPreview,
      proposedTimesFormatted
    );

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

    await supabase
      .from('scheduling_requests')
      .update({
        conversation_history: conversationHistory,
        email_thread_id: email.conversationId || schedulingRequest.email_thread_id,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', schedulingRequest.id);

    // Handle based on intent
    switch (analysis.intent) {
      case 'accept':
        return await handleTimeAccepted(schedulingRequest, analysis, email);

      case 'counter_propose':
        return await handleCounterProposal(schedulingRequest, analysis, email);

      case 'decline':
        return await handleDecline(schedulingRequest, analysis, email);

      case 'question':
        return await handleQuestion(schedulingRequest, analysis, email);

      case 'unclear':
        return await handleUnclearResponse(schedulingRequest, analysis, email);

      default:
        return { processed: false, error: 'Unknown intent' };
    }
  } catch (err) {
    console.error('[ResponseProcessor] Error processing response:', err);
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
    // Try to match based on their response
    const selectedTime = matchSelectedTime(request.proposed_times || [], email.body);

    if (!selectedTime) {
      return await handleUnclearResponse(request, analysis, email);
    }

    analysis.selectedTime = selectedTime;
  }

  const selectedDate = new Date(analysis.selectedTime);

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

  console.log('[handleCounterProposal] Processing counter-proposal:', analysis.counterProposedTimes);

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
    console.error('[handleCounterProposal] No external attendee found');
    return await fallbackToHumanReview(request, analysis, 'No external attendee found');
  }

  // Get internal attendee emails for availability check
  const internalEmails = (request.attendees || [])
    .filter((a: SchedulingAttendee) => a.side === 'internal')
    .map((a: SchedulingAttendee) => a.email);

  // Try to parse the proposed time(s)
  const proposedTimeDescriptions = analysis.counterProposedTimes || [];

  if (proposedTimeDescriptions.length === 0) {
    // No specific times mentioned - try to extract from email body
    const timePatterns = [
      /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?(?:\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?)?)/gi,
      /(monday|tuesday|wednesday|thursday|friday)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi,
    ];

    for (const pattern of timePatterns) {
      const matches = email.body.match(pattern);
      if (matches && matches.length > 0) {
        proposedTimeDescriptions.push(...matches.slice(0, 3));
        break;
      }
    }
  }

  if (proposedTimeDescriptions.length === 0) {
    console.log('[handleCounterProposal] Could not extract proposed times from email');
    return await fallbackToHumanReview(request, analysis, 'Could not parse proposed time');
  }

  // Parse the first proposed time using AI
  const timeDescription = proposedTimeDescriptions[0];
  const userTimezone = request.timezone || DEFAULT_TIMEZONE;
  console.log('[handleCounterProposal] Parsing time:', timeDescription, 'in timezone:', userTimezone);

  const parsedTime = await parseProposedDateTime(timeDescription, email.body, userTimezone);
  console.log('[handleCounterProposal] Parsed result:', parsedTime);

  if (!parsedTime.isoTimestamp || parsedTime.confidence === 'low') {
    console.log('[handleCounterProposal] Low confidence parse, falling back to human review');
    return await fallbackToHumanReview(request, analysis, `Low confidence parsing: ${parsedTime.reasoning}`);
  }

  const proposedDate = new Date(parsedTime.isoTimestamp);

  // Check availability for all internal attendees
  console.log('[handleCounterProposal] Checking availability for:', proposedDate.toISOString());

  const availabilityResult = await checkSlotAvailability(
    request.created_by,
    internalEmails,
    proposedDate,
    request.duration_minutes || 30,
    userTimezone
  );

  if (availabilityResult.error) {
    console.error('[handleCounterProposal] Availability check error:', availabilityResult.error);
    return await fallbackToHumanReview(request, analysis, `Availability check failed: ${availabilityResult.error}`);
  }

  if (availabilityResult.available) {
    // TIME WORKS! Automatically confirm and book the meeting
    console.log('[handleCounterProposal] Time is available! Auto-confirming...');

    const bookResult = await confirmAndBookMeeting(
      request,
      proposedDate,
      externalAttendee.email,
      externalAttendee.name || 'there',
      request.created_by,
      email.id
    );

    if (bookResult.success) {
      await adminSchedulingService.logAction(request.id, {
        action_type: ACTION_TYPES.STATUS_CHANGED,
        message_content: `Automatically confirmed meeting for ${proposedDate.toISOString()}`,
        actor: 'ai',
        ai_reasoning: `Counter-proposal "${timeDescription}" parsed to ${proposedDate.toISOString()}, availability confirmed, meeting booked automatically.`,
      });

      return {
        processed: true,
        schedulingRequestId: request.id,
        action: 'counter_proposal_auto_accepted',
        newStatus: SCHEDULING_STATUS.CONFIRMED,
      };
    } else {
      console.error('[handleCounterProposal] Failed to book meeting:', bookResult.error);
      return await fallbackToHumanReview(request, analysis, `Booking failed: ${bookResult.error}`);
    }
  } else {
    // TIME DOESN'T WORK - Send alternative times
    console.log('[handleCounterProposal] Time not available. Conflicts:', availabilityResult.conflictingAttendees);

    // Use the parsed timestamp with timezone, not the raw description
    // This ensures correct timezone handling on UTC servers
    const formattedRequestedTime = parsedTime.isoTimestamp || timeDescription;

    const alternativeResult = await sendAlternativeTimes(
      request,
      externalAttendee.email,
      externalAttendee.name || 'there',
      request.created_by,
      formattedRequestedTime,
      email.id
    );

    if (alternativeResult.success) {
      await adminSchedulingService.logAction(request.id, {
        action_type: ACTION_TYPES.EMAIL_SENT,
        message_content: `Sent alternative times because "${timeDescription}" has conflicts`,
        actor: 'ai',
        ai_reasoning: `Counter-proposal conflicts with: ${availabilityResult.conflictingAttendees.join(', ')}. Sent alternative times automatically.`,
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
 */
async function sendEmailWithCategory(
  token: string,
  message: {
    subject: string;
    body: { contentType: 'Text' | 'HTML'; content: string };
    toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
  },
  replyToMessageId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
      // For replies, we need to update the body and add category
      const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: message.body,
          categories: ['X-FORCE'],
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        return { success: false, error: `Failed to update reply draft: ${errorText}` };
      }
    }

    // Step 3: Send the draft
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
 * CRITICAL: This function now properly handles timezone conversion.
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

  const prompt = `Parse this proposed meeting time into an ISO timestamp.

TODAY'S DATE: ${dateContext.todayFormatted}
CURRENT YEAR: ${dateContext.currentYear}
${dateContext.timezoneInfo}

TIME DESCRIPTION: "${timeDescription}"

FULL EMAIL CONTEXT:
${emailBody.substring(0, 500)}

CRITICAL DATE PARSING RULES:

RULE 1 - SPECIFIC DATE NUMBER TAKES PRIORITY:
When someone says "[day] the [number]" (e.g., "Monday the 5th", "Tuesday the 14th"):
- The NUMBER is the most important part - they mean the Xth day of a month
- Find the NEAREST FUTURE date where the Xth falls on that day of week
- Example: Today is Dec 27, 2025. "Monday the 5th" = January 5, ${dateContext.nextYear} (because Jan 5, ${dateContext.nextYear} is a Monday)
- Do NOT interpret this as just "next Monday" - the person explicitly mentioned "the 5th"

RULE 2 - YEAR DETERMINATION:
- The meeting MUST be in the FUTURE. Never return a date in the past.
- ${dateContext.yearGuidance}
- If we're in late December and they mention early January dates, use ${dateContext.nextYear}.
- ALWAYS double-check: Is the resulting date AFTER ${dateContext.todayFormatted}? If not, add a year.

RULE 3 - DAY/DATE MISMATCH:
- If they say "Monday the 5th" and the 5th isn't actually a Monday in the nearest month, prioritize the DATE NUMBER over the day name
- People often get day names wrong but rarely get date numbers wrong

RULE 4 - TIMEZONE HANDLING (CRITICAL):
${timestampInstructions}

Return a JSON object with:
- isoTimestamp: The ISO timestamp string WITH TIMEZONE (e.g., "${dateContext.nextYear}-01-05T14:00:00-05:00" for 2pm EST), or null if unparseable
- confidence: "high", "medium", or "low"
- reasoning: Brief explanation including the timezone interpretation`;

  try {
    const response = await callAIJson<{
      isoTimestamp: string | null;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    }>({
      prompt,
      systemPrompt: `You are an expert at parsing natural language date/time expressions into precise timestamps.

CRITICAL TIMEZONE RULE: The user is in ${tz}. When they say "2pm" they mean 2pm in THEIR timezone, not UTC.
- If they say "2pm EST", return "...T14:00:00-05:00" (with -05:00 offset)
- If they say "2pm" without timezone, assume ${tz} and include the appropriate offset
- NEVER return a bare timestamp like "...T14:00:00" without timezone info

CRITICAL DATE RULE: When someone says "[day] the [number]" like "Monday the 5th", the DATE NUMBER is the key information - find the nearest future month where the Xth day matches (or is close to) that day of week.`,
      schema: `{
        "isoTimestamp": "ISO 8601 timestamp string WITH timezone offset (e.g., 2026-01-05T14:00:00-05:00) or null",
        "confidence": "high|medium|low",
        "reasoning": "Brief explanation including timezone interpretation"
      }`,
      maxTokens: 500,
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

    const tz = normalizeTimezone(timezone);
    const startTime = formatForGraphAPI(proposedTime, tz);
    const endDate = addMinutes(proposedTime, durationMinutes);
    const endTime = formatForGraphAPI(endDate, tz);

    console.log(`[checkSlotAvailability] Checking ${startTime} to ${endTime} (${tz}) for ${attendeeEmails.join(', ')}`);

    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: attendeeEmails,
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

/**
 * Send confirmation email and create calendar event
 */
async function confirmAndBookMeeting(
  request: SchedulingRequest,
  confirmedTime: Date,
  prospectEmail: string,
  prospectName: string,
  userId: string,
  replyToMessageId?: string
): Promise<{ success: boolean; calendarEventId?: string; error?: string }> {
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
      timeZone: 'America/New_York',
    });

    // Generate confirmation email (for future use with AI-generated content)
    const _generatedEmail = await generateSchedulingEmail({
      emailType: 'confirmation',
      request,
      attendees: request.attendees || [],
      senderName: 'Brent Allen',
      senderTitle: 'Sales, X-RAI Labs',
    });

    // Send confirmation email with X-FORCE category (as reply if we have the original message ID)
    const emailResult = await sendEmailWithCategory(token, {
      subject: `Confirmed: ${request.title} - ${formattedTime}`,
      body: {
        contentType: 'Text',
        content: `Hi ${prospectName},\n\nGreat news! Our meeting is confirmed for ${formattedTime}.\n\nYou'll receive a calendar invite shortly with the Microsoft Teams link.\n\nLooking forward to speaking with you!\n\nBest,\nBrent Allen\nX-RAI Labs`,
      },
      toRecipients: [{ emailAddress: { address: prospectEmail, name: prospectName } }],
    }, replyToMessageId);

    if (!emailResult.success) {
      console.error('[confirmAndBookMeeting] Failed to send email:', emailResult.error);
      return { success: false, error: `Email send failed: ${emailResult.error}` };
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getValidToken } = await import('@/lib/microsoft/auth');
    const token = await getValidToken(userId);

    if (!token) {
      return { success: false, error: 'No valid token' };
    }

    // Get internal attendee emails
    const internalEmails = (request.attendees || [])
      .filter((a: SchedulingAttendee) => a.side === 'internal')
      .map((a: SchedulingAttendee) => a.email);

    // Find alternative slots
    const slotsResult = await getMultiAttendeeAvailability(userId, internalEmails, {
      daysAhead: 10,
      slotDuration: request.duration_minutes || 30,
      maxSlots: 4,
    });

    if (!slotsResult.slots || slotsResult.slots.length === 0) {
      // No slots available - flag for human review
      return { success: false, error: 'No alternative slots available' };
    }

    // Format slots for email
    const formattedSlots = slotsResult.slots.map(slot => {
      const date = new Date(slot.start);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: 'America/New_York',
      });
    });

    // Format the proposed time nicely (in case it's an ISO string)
    let formattedProposedTime = proposedTimeDescription;
    if (proposedTimeDescription.match(/^\d{4}-\d{2}-\d{2}/)) {
      // It's an ISO timestamp - format it nicely
      try {
        const proposedDate = new Date(proposedTimeDescription);
        formattedProposedTime = proposedDate.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
          timeZone: 'America/New_York',
        });
      } catch {
        // Keep original if parsing fails
      }
    }

    const emailBody = `Hi ${prospectName},

Thank you for your response! Unfortunately, ${formattedProposedTime} doesn't work with our team's availability.

Here are some alternative times that work for everyone:

${formattedSlots.map((t, i) => `• ${t}`).join('\n')}

Just reply with which time works best for you, and I'll get us scheduled right away.

Best,
Brent Allen
X-RAI Labs`;

    // Send alternative times email with X-FORCE category (as reply if we have the original message ID)
    const sendResult = await sendEmailWithCategory(token, {
      subject: `Re: ${request.title} - Alternative Times`,
      body: { contentType: 'Text', content: emailBody },
      toRecipients: [{ emailAddress: { address: prospectEmail, name: prospectName } }],
    }, replyToMessageId);

    if (!sendResult.success) {
      return { success: false, error: `Email send failed: ${sendResult.error}` };
    }

    // Update the proposed times on the request
    const supabase = createAdminClient();
    await supabase
      .from('scheduling_requests')
      .update({
        proposed_times: slotsResult.slots.map(s => s.start),
        last_action_at: new Date().toISOString(),
        status: SCHEDULING_STATUS.AWAITING_RESPONSE,
        next_action_type: null, // Clear since automation handled it
        next_action_at: null,
      })
      .eq('id', request.id);

    console.log('[sendAlternativeTimes] Alternative times email sent');
    return { success: true };
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
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < proposedTimes.length; i++) {
    const time = new Date(proposedTimes[i]);
    const dayName = days[time.getDay()];
    if (bodyLower.includes(dayName)) {
      return proposedTimes[i];
    }
  }

  // Check for date patterns (e.g., "the 15th", "December 20")
  for (let i = 0; i < proposedTimes.length; i++) {
    const time = new Date(proposedTimes[i]);
    const day = time.getDate();
    const monthName = time.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();

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
    // Get recent inbound emails that haven't been processed for scheduling
    const { data: recentEmails } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'email_received')
      .eq('user_id', userId)
      .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (!recentEmails || recentEmails.length === 0) {
      return result;
    }

    for (const activity of recentEmails) {
      result.processed++;

      const email: IncomingEmail = {
        id: activity.external_id || activity.id,
        subject: activity.subject || '',
        body: activity.body || '',
        bodyPreview: activity.body?.slice(0, 500) || '',
        from: {
          address: activity.metadata?.from?.address || '',
          name: activity.metadata?.from?.name,
        },
        receivedDateTime: activity.occurred_at,
        conversationId: activity.metadata?.conversation_id,
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
