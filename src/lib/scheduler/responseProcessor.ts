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
import {
  SchedulingRequest,
  SchedulingAttendee,
  SchedulingStatus,
  SCHEDULING_STATUS,
  ACTION_TYPES,
  ConversationMessage,
} from './types';

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
      .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED})`)
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
        request.status !== SCHEDULING_STATUS.CANCELLED
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

/**
 * Process an incoming email response to a scheduling request
 */
export async function processSchedulingResponse(
  email: IncomingEmail,
  schedulingRequest: SchedulingRequest
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

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

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: 'time_accepted',
    newStatus: SCHEDULING_STATUS.CONFIRMING,
  };
}

/**
 * Handle when prospect proposes alternative times
 */
async function handleCounterProposal(
  request: SchedulingRequest,
  analysis: ResponseAnalysis,
  email: IncomingEmail
): Promise<ProcessingResult> {
  const supabase = createAdminClient();

  // Transition to negotiating
  await adminSchedulingService.transitionState(
    request.id,
    SCHEDULING_STATUS.NEGOTIATING,
    {
      actor: 'prospect',
      reasoning: `Prospect proposed alternative times: ${analysis.counterProposedTimes?.join(', ')}`,
    }
  );

  // Store the proposed times for user review
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'review_counter_proposal',
      next_action_at: new Date().toISOString(), // Immediate attention needed
    })
    .eq('id', request.id);

  // Log the counter proposal
  await adminSchedulingService.logAction(request.id, {
    action_type: ACTION_TYPES.TIMES_PROPOSED,
    times_proposed: analysis.counterProposedTimes || [],
    actor: 'prospect',
    ai_reasoning: `Prospect suggested: ${analysis.counterProposedTimes?.join(', ')}`,
  });

  return {
    processed: true,
    schedulingRequestId: request.id,
    action: 'counter_proposal_received',
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
  const supabase = createAdminClient();
  const result = { processed: 0, matched: 0, errors: [] as string[] };

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
