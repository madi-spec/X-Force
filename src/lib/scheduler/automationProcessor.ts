/**
 * Scheduling Automation Processor
 *
 * Handles automated scheduling actions:
 * - Follow-up emails for non-responses
 * - Meeting reminders
 * - No-show detection and recovery
 * - Time proposal for new requests
 *
 * This should be called periodically via cron job or API endpoint.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { adminSchedulingService } from './schedulingService';
import {
  generateSchedulingEmail,
  formatTimeSlotsForEmail,
  generateProposedTimes,
} from './emailGeneration';
import { sendMeetingReminder, executeConfirmationWorkflow } from './confirmationWorkflow';
import { sendEmail } from '@/lib/microsoft/sendEmail';
import { getAvailableTimeSlots } from './calendarIntegration';
import {
  SchedulingRequest,
  SCHEDULING_STATUS,
  ACTION_TYPES,
  ConversationMessage,
} from './types';

// ============================================
// TYPES
// ============================================

interface ProcessingStats {
  processed: number;
  followUpsSent: number;
  remindersSent: number;
  proposalsSent: number;
  noShowsHandled: number;
  errors: string[];
}

// ============================================
// MAIN PROCESSOR
// ============================================

// TEMPORARY KILL SWITCH - Set to true to disable all scheduler automation
const SCHEDULER_AUTOMATION_DISABLED = false;

/**
 * Process all scheduling requests that need automated action
 */
export async function processSchedulingAutomation(
  userId: string
): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    processed: 0,
    followUpsSent: 0,
    remindersSent: 0,
    proposalsSent: 0,
    noShowsHandled: 0,
    errors: [],
  };

  // Kill switch - return early if automation is disabled
  if (SCHEDULER_AUTOMATION_DISABLED) {
    console.log('[AutomationProcessor] DISABLED - Scheduler automation is temporarily turned off');
    return stats;
  }

  const supabase = createAdminClient();

  try {
    // Get all requests needing action
    const { data: requests, error } = await supabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*)
      `)
      .lte('next_action_at', new Date().toISOString())
      .eq('created_by', userId)
      .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED},${SCHEDULING_STATUS.PAUSED})`);

    if (error) {
      stats.errors.push(`Failed to fetch requests: ${error.message}`);
      return stats;
    }

    if (!requests || requests.length === 0) {
      return stats;
    }

    console.log(`[AutomationProcessor] Processing ${requests.length} requests`);

    for (const request of requests as SchedulingRequest[]) {
      stats.processed++;

      try {
        const result = await processRequest(request, userId);

        switch (result.action) {
          case 'follow_up':
            stats.followUpsSent++;
            break;
          case 'reminder':
            stats.remindersSent++;
            break;
          case 'proposal':
            stats.proposalsSent++;
            break;
          case 'no_show':
            stats.noShowsHandled++;
            break;
        }

        if (result.error) {
          stats.errors.push(`Request ${request.id}: ${result.error}`);
        }
      } catch (err) {
        stats.errors.push(`Request ${request.id}: ${err}`);
      }
    }

    console.log('[AutomationProcessor] Complete:', stats);
    return stats;

  } catch (err) {
    stats.errors.push(`Processor error: ${err}`);
    return stats;
  }
}

/**
 * Process a single scheduling request
 */
async function processRequest(
  request: SchedulingRequest,
  userId: string
): Promise<{ action?: string; error?: string }> {
  const actionType = request.next_action_type;

  switch (actionType) {
    case 'send_initial':
      return await sendInitialProposal(request, userId);

    case 'send_options':
      return await sendInitialProposal(request, userId);

    case 'follow_up':
      return await sendFollowUp(request, userId);

    case 'second_follow_up':
      return await sendFollowUp(request, userId, true);

    case 'send_reminder':
      return await handleReminder(request, userId);

    case 'check_no_show':
      return await checkNoShow(request, userId);

    default:
      // Determine action based on status
      return await determineAndExecuteAction(request, userId);
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

/**
 * Send initial time proposal email
 */
async function sendInitialProposal(
  request: SchedulingRequest,
  userId: string
): Promise<{ action?: string; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Generate available time slots
    const startDate = request.date_range_start
      ? new Date(request.date_range_start)
      : new Date();
    const endDate = request.date_range_end
      ? new Date(request.date_range_end)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const proposedTimes = await getAvailableTimeSlots(
      userId,
      startDate,
      endDate,
      request.duration_minutes,
      request.preferred_times,
      request.avoid_days || []
    );

    if (proposedTimes.length === 0) {
      return { error: 'No available time slots found' };
    }

    // Format times for email
    const formattedTimes = formatTimeSlotsForEmail(proposedTimes, request.timezone);

    // Get user and company info
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();

    let companyName = 'Prospect';
    if (request.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', request.company_id)
        .single();
      companyName = company?.name || companyName;
    }

    // Generate email
    const { email, reasoning } = await generateSchedulingEmail({
      emailType: 'initial_outreach',
      request,
      attendees: request.attendees || [],
      proposedTimes: formattedTimes,
      senderName: user?.name || 'Sales Team',
      companyContext: { name: companyName },
    });

    // Get primary contact
    const primaryContact = request.attendees?.find(a => a.is_primary_contact);
    if (!primaryContact?.email) {
      return { error: 'No primary contact email' };
    }

    // Send email
    const sendResult = await sendEmail(
      userId,
      [primaryContact.email],
      email.subject,
      email.body
    );

    if (!sendResult.success) {
      return { error: sendResult.error };
    }

    // Capture email_thread_id for response matching
    if (sendResult.conversationId) {
      await supabase
        .from('scheduling_requests')
        .update({ email_thread_id: sendResult.conversationId })
        .eq('id', request.id);

      console.log(`[AutomationProcessor] Captured email_thread_id: ${sendResult.conversationId} for request ${request.id}`);
    }

    // Update request
    const proposedTimeStrings = proposedTimes.map(t => t.toISOString());

    await adminSchedulingService.proposeTimeslots(
      request.id,
      proposedTimeStrings,
      {
        emailSubject: email.subject,
        emailContent: email.body,
        reasoning,
      }
    );

    // Transition to awaiting response
    await adminSchedulingService.transitionState(
      request.id,
      SCHEDULING_STATUS.AWAITING_RESPONSE,
      { actor: 'ai', reasoning: 'Initial proposal email sent' }
    );

    // Schedule follow-up in 24 hours
    await adminSchedulingService.scheduleNextAction(
      request.id,
      'follow_up',
      24
    );

    // Add to conversation history
    const message: ConversationMessage = {
      id: `proposal_${Date.now()}`,
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      channel: 'email',
      subject: email.subject,
      body: email.body,
      sender: user?.email || 'us',
      recipient: primaryContact.email,
    };

    await supabase
      .from('scheduling_requests')
      .update({
        conversation_history: [
          ...(request.conversation_history || []),
          message,
        ],
      })
      .eq('id', request.id);

    return { action: 'proposal' };

  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Send follow-up email for non-response
 */
async function sendFollowUp(
  request: SchedulingRequest,
  userId: string,
  isSecondFollowUp: boolean = false
): Promise<{ action?: string; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Check max attempts
    if (request.attempt_count >= 5) {
      // Too many attempts - pause for human review
      await adminSchedulingService.transitionState(
        request.id,
        SCHEDULING_STATUS.PAUSED,
        { actor: 'ai', reasoning: 'Maximum follow-up attempts reached' }
      );

      await supabase
        .from('scheduling_requests')
        .update({
          next_action_type: 'human_review_max_attempts',
          next_action_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      return { action: 'paused_max_attempts' };
    }

    // Get user and company info
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();

    let companyName = 'Prospect';
    if (request.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', request.company_id)
        .single();
      companyName = company?.name || companyName;
    }

    // Generate follow-up email
    const emailType = isSecondFollowUp ? 'second_follow_up' : 'follow_up';
    const { email, reasoning } = await generateSchedulingEmail({
      emailType,
      request,
      attendees: request.attendees || [],
      senderName: user?.name || 'Sales Team',
      companyContext: { name: companyName },
      conversationHistory: request.conversation_history,
    });

    // Get primary contact
    const primaryContact = request.attendees?.find(a => a.is_primary_contact);
    if (!primaryContact?.email) {
      return { error: 'No primary contact email' };
    }

    // Send email
    const sendResult = await sendEmail(
      userId,
      [primaryContact.email],
      email.subject,
      email.body
    );

    if (!sendResult.success) {
      return { error: sendResult.error };
    }

    // Capture email_thread_id for response matching (update if not already set)
    if (sendResult.conversationId && !request.email_thread_id) {
      await supabase
        .from('scheduling_requests')
        .update({ email_thread_id: sendResult.conversationId })
        .eq('id', request.id);

      console.log(`[AutomationProcessor] Captured email_thread_id on follow-up: ${sendResult.conversationId} for request ${request.id}`);
    }

    // Log action
    await adminSchedulingService.logAction(request.id, {
      action_type: ACTION_TYPES.FOLLOW_UP_SENT,
      message_subject: email.subject,
      message_content: email.body,
      actor: 'ai',
      ai_reasoning: reasoning,
    });

    // Update attempt count
    await supabase
      .from('scheduling_requests')
      .update({
        attempt_count: request.attempt_count + 1,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    // Schedule next follow-up (longer delay each time)
    const nextDelay = isSecondFollowUp ? 72 : 48; // 48 or 72 hours
    const nextType = isSecondFollowUp ? 'follow_up' : 'second_follow_up';

    await adminSchedulingService.scheduleNextAction(
      request.id,
      nextType,
      nextDelay
    );

    // Add to conversation history
    const message: ConversationMessage = {
      id: `followup_${Date.now()}`,
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      channel: 'email',
      subject: email.subject,
      body: email.body,
      sender: user?.email || 'us',
      recipient: primaryContact.email,
    };

    await supabase
      .from('scheduling_requests')
      .update({
        conversation_history: [
          ...(request.conversation_history || []),
          message,
        ],
      })
      .eq('id', request.id);

    return { action: 'follow_up' };

  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Handle meeting reminder
 */
async function handleReminder(
  request: SchedulingRequest,
  userId: string
): Promise<{ action?: string; error?: string }> {
  const result = await sendMeetingReminder(request.id, userId);

  if (!result.success) {
    return { error: result.error };
  }

  return { action: 'reminder' };
}

/**
 * Check if meeting was a no-show
 */
async function checkNoShow(
  request: SchedulingRequest,
  userId: string
): Promise<{ action?: string; error?: string }> {
  const supabase = createAdminClient();

  // For now, we'll flag for human review
  // In future, could integrate with meeting platform to detect attendance

  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'confirm_attendance',
      next_action_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  return { action: 'no_show_check' };
}

/**
 * Determine appropriate action based on current status
 */
async function determineAndExecuteAction(
  request: SchedulingRequest,
  userId: string
): Promise<{ action?: string; error?: string }> {
  switch (request.status) {
    case SCHEDULING_STATUS.INITIATED:
      // Need to send initial proposal
      return await sendInitialProposal(request, userId);

    case SCHEDULING_STATUS.AWAITING_RESPONSE:
      // Need to follow up
      return await sendFollowUp(request, userId);

    case SCHEDULING_STATUS.CONFIRMED:
      // Need to send reminder
      return await handleReminder(request, userId);

    case SCHEDULING_STATUS.REMINDER_SENT:
      // Check for no-show
      return await checkNoShow(request, userId);

    default:
      return { error: `No automated action for status: ${request.status}` };
  }
}

// ============================================
// NO-SHOW RECOVERY
// ============================================

/**
 * Handle a confirmed no-show and attempt to reschedule
 */
export async function handleNoShowRecovery(
  schedulingRequestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get request
    const { data: request, error: fetchError } = await adminSchedulingService.getSchedulingRequest(
      schedulingRequestId
    );

    if (fetchError || !request) {
      return { success: false, error: fetchError || 'Request not found' };
    }

    // Mark as no-show
    await adminSchedulingService.completeMeeting(
      schedulingRequestId,
      'no_show',
      'Prospect did not attend scheduled meeting'
    );

    // Generate no-show email
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    let companyName = 'Prospect';
    if (request.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', request.company_id)
        .single();
      companyName = company?.name || companyName;
    }

    // Generate new time options
    const newTimes = await getAvailableTimeSlots(
      userId,
      new Date(),
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      request.duration_minutes,
      request.preferred_times,
      request.avoid_days || []
    );

    const formattedTimes = formatTimeSlotsForEmail(newTimes, request.timezone);

    const { email } = await generateSchedulingEmail({
      emailType: 'no_show',
      request,
      attendees: request.attendees || [],
      proposedTimes: formattedTimes,
      senderName: user?.name || 'Sales Team',
      companyContext: { name: companyName },
    });

    // Get primary contact
    const primaryContact = request.attendees?.find(a => a.is_primary_contact);
    if (!primaryContact?.email) {
      return { success: false, error: 'No primary contact' };
    }

    // Send no-show recovery email
    const sendResult = await sendEmail(
      userId,
      [primaryContact.email],
      email.subject,
      email.body
    );

    if (!sendResult.success) {
      return { success: false, error: sendResult.error };
    }

    // Capture email_thread_id for response matching
    if (sendResult.conversationId) {
      await supabase
        .from('scheduling_requests')
        .update({ email_thread_id: sendResult.conversationId })
        .eq('id', schedulingRequestId);

      console.log(`[AutomationProcessor] Captured email_thread_id on no-show recovery: ${sendResult.conversationId} for request ${schedulingRequestId}`);
    }

    // Transition back to proposing for rescheduling
    await adminSchedulingService.transitionState(
      schedulingRequestId,
      SCHEDULING_STATUS.PROPOSING,
      { actor: 'ai', reasoning: 'No-show recovery email sent, attempting to reschedule' }
    );

    // Update with new proposed times
    await supabase
      .from('scheduling_requests')
      .update({
        proposed_times: newTimes.map(t => t.toISOString()),
        scheduled_time: null,
        calendar_event_id: null,
        invite_accepted: false,
      })
      .eq('id', schedulingRequestId);

    // Schedule follow-up
    await adminSchedulingService.scheduleNextAction(
      schedulingRequestId,
      'follow_up',
      48
    );

    return { success: true };

  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  type ProcessingStats,
};
