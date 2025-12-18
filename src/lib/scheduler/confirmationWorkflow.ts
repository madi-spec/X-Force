/**
 * Confirmation Workflow Service
 *
 * Handles the full confirmation flow when a meeting time is agreed upon:
 * 1. Create calendar event with meeting link
 * 2. Send confirmation email
 * 3. Update scheduling request status
 * 4. Schedule reminder
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createMeetingCalendarEvent } from './calendarIntegration';
import { generateSchedulingEmail } from './emailGeneration';
import { adminSchedulingService } from './schedulingService';
import { sendEmail } from '@/lib/microsoft/emailSync';
import {
  SchedulingRequest,
  SchedulingAttendee,
  SCHEDULING_STATUS,
  ACTION_TYPES,
  ConversationMessage,
} from './types';

// ============================================
// TYPES
// ============================================

interface ConfirmationInput {
  schedulingRequestId: string;
  userId: string;
  confirmedTime: Date;
  sendConfirmationEmail?: boolean;
  customMessage?: string;
}

interface ConfirmationResult {
  success: boolean;
  calendarEventId?: string;
  meetingLink?: string;
  confirmationEmailSent?: boolean;
  reminderScheduled?: boolean;
  error?: string;
}

// ============================================
// MAIN WORKFLOW
// ============================================

/**
 * Execute the full confirmation workflow
 */
export async function executeConfirmationWorkflow(
  input: ConfirmationInput
): Promise<ConfirmationResult> {
  const supabase = createAdminClient();
  const result: ConfirmationResult = { success: false };

  try {
    // 1. Get the scheduling request with attendees
    const { data: request, error: fetchError } = await adminSchedulingService.getSchedulingRequest(
      input.schedulingRequestId
    );

    if (fetchError || !request) {
      return { success: false, error: fetchError || 'Scheduling request not found' };
    }

    // Validate state - should be in CONFIRMING state
    if (request.status !== SCHEDULING_STATUS.CONFIRMING) {
      // If not in confirming, transition first
      if (request.status === SCHEDULING_STATUS.AWAITING_RESPONSE ||
          request.status === SCHEDULING_STATUS.NEGOTIATING) {
        await adminSchedulingService.selectTime(
          input.schedulingRequestId,
          input.confirmedTime.toISOString(),
          { actor: 'user', actorId: input.userId }
        );
      } else {
        return {
          success: false,
          error: `Cannot confirm meeting in ${request.status} state`,
        };
      }
    }

    // 2. Create calendar event with Teams meeting
    console.log('[ConfirmationWorkflow] Creating calendar event...');

    const calendarResult = await createMeetingCalendarEvent({
      schedulingRequestId: input.schedulingRequestId,
      userId: input.userId,
      scheduledTime: input.confirmedTime,
      durationMinutes: request.duration_minutes,
      title: request.title || undefined,
      description: request.context || undefined,
      platform: request.meeting_platform,
      location: request.meeting_location || undefined,
    });

    if (!calendarResult.success) {
      return {
        success: false,
        error: `Failed to create calendar event: ${calendarResult.error}`,
      };
    }

    result.calendarEventId = calendarResult.eventId;
    result.meetingLink = calendarResult.meetingLink;

    // Log the invite sent action
    await adminSchedulingService.logAction(input.schedulingRequestId, {
      action_type: ACTION_TYPES.INVITE_SENT,
      time_selected: input.confirmedTime.toISOString(),
      actor: 'ai',
      ai_reasoning: 'Calendar invite created with Teams meeting link',
    });

    // 3. Send confirmation email (if enabled)
    if (input.sendConfirmationEmail !== false) {
      console.log('[ConfirmationWorkflow] Sending confirmation email...');

      const emailResult = await sendConfirmationEmail(
        request,
        input.userId,
        input.confirmedTime,
        result.meetingLink,
        input.customMessage
      );

      result.confirmationEmailSent = emailResult.success;

      if (emailResult.success) {
        // Log the email sent
        await adminSchedulingService.logAction(input.schedulingRequestId, {
          action_type: ACTION_TYPES.EMAIL_SENT,
          message_subject: emailResult.subject,
          message_content: emailResult.body,
          actor: 'ai',
          ai_reasoning: 'Confirmation email sent to prospect',
        });

        // Add to conversation history
        if (emailResult.subject && emailResult.body) {
          const message: ConversationMessage = {
            id: `confirmation_${Date.now()}`,
            timestamp: new Date().toISOString(),
            direction: 'outbound',
            channel: 'email',
            subject: emailResult.subject,
            body: emailResult.body,
            sender: 'us',
            recipient: request.attendees?.find(a => a.is_primary_contact)?.email || '',
          };

          await supabase
            .from('scheduling_requests')
            .update({
              conversation_history: [
                ...(request.conversation_history || []),
                message,
              ],
            })
            .eq('id', input.schedulingRequestId);
        }
      }
    }

    // 4. Update status to CONFIRMED
    await adminSchedulingService.confirmMeeting(
      input.schedulingRequestId,
      result.calendarEventId
    );

    // 5. Schedule reminder (3 hours before meeting by default)
    const reminderTime = new Date(input.confirmedTime);
    reminderTime.setHours(reminderTime.getHours() - 3);

    // Don't schedule reminder if meeting is less than 3 hours away
    if (reminderTime > new Date()) {
      await adminSchedulingService.scheduleNextAction(
        input.schedulingRequestId,
        'send_reminder',
        Math.floor((reminderTime.getTime() - Date.now()) / (1000 * 60 * 60))
      );
      result.reminderScheduled = true;
    } else {
      // Meeting is soon - schedule reminder for 30 minutes before if possible
      const shortReminder = new Date(input.confirmedTime);
      shortReminder.setMinutes(shortReminder.getMinutes() - 30);

      if (shortReminder > new Date()) {
        await supabase
          .from('scheduling_requests')
          .update({
            next_action_at: shortReminder.toISOString(),
            next_action_type: 'send_reminder',
          })
          .eq('id', input.schedulingRequestId);
        result.reminderScheduled = true;
      }
    }

    result.success = true;
    console.log('[ConfirmationWorkflow] Complete:', result);

    return result;

  } catch (err) {
    console.error('[ConfirmationWorkflow] Error:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send confirmation email to the prospect
 */
async function sendConfirmationEmail(
  request: SchedulingRequest,
  userId: string,
  confirmedTime: Date,
  meetingLink?: string,
  customMessage?: string
): Promise<{ success: boolean; subject?: string; body?: string; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Get user info for sender
    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();

    // Get company name
    let companyName = 'your company';
    if (request.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', request.company_id)
        .single();
      companyName = company?.name || companyName;
    }

    // Generate confirmation email using AI
    const { email } = await generateSchedulingEmail({
      emailType: 'confirmation',
      request,
      attendees: request.attendees || [],
      senderName: user?.name || 'Sales Team',
      companyContext: { name: companyName },
    });

    // Add meeting link to body if available
    let emailBody = email.body;
    if (meetingLink) {
      emailBody = emailBody.replace(
        '</p>\n\nBest',
        `</p>\n\n<p><strong>Join Meeting:</strong> <a href="${meetingLink}">${meetingLink}</a></p>\n\nBest`
      );

      // If the replacement didn't work, append it
      if (!emailBody.includes(meetingLink)) {
        emailBody = `${emailBody}\n\n<p><strong>Join Meeting:</strong> <a href="${meetingLink}">${meetingLink}</a></p>`;
      }
    }

    if (customMessage) {
      emailBody = `${customMessage}\n\n${emailBody}`;
    }

    // Get primary contact email
    const primaryContact = request.attendees?.find(a => a.is_primary_contact);
    const toEmail = primaryContact?.email;

    if (!toEmail) {
      return { success: false, error: 'No recipient email found' };
    }

    // Get CC emails (other external attendees)
    const ccEmails = request.attendees
      ?.filter(a => a.side === 'external' && !a.is_primary_contact && a.email)
      .map(a => a.email) || [];

    // Send the email
    const sendResult = await sendEmail(
      userId,
      [toEmail],
      email.subject,
      emailBody,
      ccEmails.length > 0 ? ccEmails : undefined
    );

    if (!sendResult.success) {
      return { success: false, error: sendResult.error };
    }

    return {
      success: true,
      subject: email.subject,
      body: emailBody,
    };

  } catch (err) {
    console.error('[ConfirmationWorkflow] Email send error:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// REMINDER WORKFLOW
// ============================================

/**
 * Send day-of meeting reminder
 */
export async function sendMeetingReminder(
  schedulingRequestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Get the scheduling request
    const { data: request, error: fetchError } = await adminSchedulingService.getSchedulingRequest(
      schedulingRequestId
    );

    if (fetchError || !request) {
      return { success: false, error: fetchError || 'Request not found' };
    }

    // Validate state
    if (request.status !== SCHEDULING_STATUS.CONFIRMED) {
      return { success: false, error: `Cannot send reminder in ${request.status} state` };
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    // Get company name
    let companyName = 'Prospect';
    if (request.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', request.company_id)
        .single();
      companyName = company?.name || companyName;
    }

    // Generate reminder email
    const { email } = await generateSchedulingEmail({
      emailType: 'reminder',
      request,
      attendees: request.attendees || [],
      senderName: user?.name || 'Sales Team',
      companyContext: { name: companyName },
    });

    // Add meeting link if available
    let emailBody = email.body;
    if (request.meeting_link) {
      emailBody = `${emailBody}\n\n<p><strong>Join here:</strong> <a href="${request.meeting_link}">${request.meeting_link}</a></p>`;
    }

    // Get primary contact
    const primaryContact = request.attendees?.find(a => a.is_primary_contact);
    if (!primaryContact?.email) {
      return { success: false, error: 'No recipient email' };
    }

    // Send reminder
    const sendResult = await sendEmail(
      userId,
      [primaryContact.email],
      email.subject,
      emailBody
    );

    if (!sendResult.success) {
      return { success: false, error: sendResult.error };
    }

    // Update status and log
    await adminSchedulingService.transitionState(
      schedulingRequestId,
      SCHEDULING_STATUS.REMINDER_SENT,
      { actor: 'ai', reasoning: 'Day-of reminder sent' }
    );

    await adminSchedulingService.logAction(schedulingRequestId, {
      action_type: ACTION_TYPES.REMINDER_SENT,
      message_subject: email.subject,
      message_content: emailBody,
      actor: 'ai',
    });

    // Schedule no-show check (15 minutes after meeting end)
    const meetingEnd = new Date(request.scheduled_time!);
    meetingEnd.setMinutes(meetingEnd.getMinutes() + request.duration_minutes + 15);

    await supabase
      .from('scheduling_requests')
      .update({
        next_action_at: meetingEnd.toISOString(),
        next_action_type: 'check_no_show',
      })
      .eq('id', schedulingRequestId);

    return { success: true };

  } catch (err) {
    console.error('[ConfirmationWorkflow] Reminder error:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  type ConfirmationInput,
  type ConfirmationResult,
};
