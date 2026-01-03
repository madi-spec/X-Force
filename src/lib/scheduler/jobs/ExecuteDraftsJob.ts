/**
 * ExecuteDraftsJob - Send approved scheduling drafts
 *
 * This job:
 * 1. Finds drafts with status 'approved'
 * 2. Sends the emails
 * 3. Updates draft status to 'sent'
 * 4. Captures email_thread_id for response tracking
 */

import { JobRunner, type JobContext, type ProcessingStats } from './JobRunner';
import { SCHEDULER_JOBS, type JobDefinition } from './registry';
import { sendEmail } from '@/lib/microsoft/sendEmail';
import { STATUS } from '../core/constants';

export class ExecuteDraftsJob extends JobRunner {
  constructor() {
    super(SCHEDULER_JOBS.EXECUTE_DRAFTS.id);
  }

  protected getJobDefinition(): JobDefinition {
    return SCHEDULER_JOBS.EXECUTE_DRAFTS;
  }

  protected async run(context: JobContext): Promise<ProcessingStats> {
    const stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };

    // Find approved drafts ready to send
    const { data: drafts, error } = await context.supabase
      .from('scheduling_drafts')
      .select(`
        *,
        request:scheduling_requests(
          id,
          created_by,
          email_thread_id,
          company:companies(id, name),
          contact:contacts(id, email, first_name, last_name)
        )
      `)
      .eq('status', 'approved')
      .lte('approved_at', new Date().toISOString())
      .limit(50);

    if (error) {
      context.error('Failed to fetch approved drafts', error);
      stats.errors.push(error.message);
      return stats;
    }

    if (!drafts || drafts.length === 0) {
      context.log('No approved drafts to execute');
      return stats;
    }

    context.log(`Found ${drafts.length} approved drafts to send`);

    for (const draft of drafts) {
      try {
        await this.sendDraft(draft, context);
        stats.processed++;
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Draft ${draft.id}: ${err}`);
        context.error(`Failed to send draft ${draft.id}`, err);

        // Mark draft as failed
        await context.supabase
          .from('scheduling_drafts')
          .update({
            status: 'failed',
            error_message: String(err),
          })
          .eq('id', draft.id);
      }
    }

    return stats;
  }

  private async sendDraft(draft: any, context: JobContext): Promise<void> {
    const request = draft.request;

    if (!request?.contact?.email) {
      throw new Error('No contact email found for draft');
    }

    context.log(`Sending draft ${draft.id}`, {
      type: draft.draft_type,
      to: request.contact.email,
    });

    // Send the email
    // Note: sendEmail signature is (userId, to[], subject, body, cc?, isHtml?)
    const sendResult = await sendEmail(
      request.created_by,
      [request.contact.email],
      draft.subject,
      draft.body_html || draft.body_text,
      undefined, // cc
      !!draft.body_html
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'Failed to send email');
    }

    context.log(`Email sent successfully, messageId: ${sendResult.messageId}`);

    // Update draft status
    await context.supabase
      .from('scheduling_drafts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_message_id: sendResult.messageId,
      })
      .eq('id', draft.id);

    // Build the update object for the scheduling request
    const requestUpdate: Record<string, unknown> = {
      last_action_at: new Date().toISOString(),
    };

    // CRITICAL: Capture Microsoft's conversationId immediately after sending.
    // This is the ONLY reliable way to track the email thread for response matching.
    // For initial_outreach, this establishes the thread. For follow-ups, the request
    // should already have email_thread_id set, but we update it just in case.
    if (sendResult.conversationId && !request.email_thread_id) {
      requestUpdate.email_thread_id = sendResult.conversationId;
      context.log(`Captured conversationId for thread tracking: ${sendResult.conversationId}`);
    }

    // Update request next action based on draft type
    const nextAction = this.getNextAction(draft.draft_type);
    if (nextAction) {
      requestUpdate.next_action_type = nextAction.type;
      requestUpdate.next_action_at = nextAction.at.toISOString();
    }

    // Apply updates to scheduling request
    await context.supabase
      .from('scheduling_requests')
      .update(requestUpdate)
      .eq('id', request.id);

    // Log the action
    await context.supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: `${draft.draft_type}_sent`,
      actor: 'system',
      ai_reasoning: `Sent ${draft.draft_type} email to ${request.contact.email}`,
      metadata: {
        draft_id: draft.id,
        message_id: sendResult.messageId,
        conversation_id: sendResult.conversationId,
        correlation_id: context.correlationId,
      },
    });
  }

  private getNextAction(draftType: string): { type: string; at: Date } | null {
    switch (draftType) {
      case 'initial_outreach':
      case 'time_proposal':
        return {
          type: 'process_response',
          at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };
      case 'first_follow_up':
      case 'second_follow_up':
        return {
          type: 'process_response',
          at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        };
      case 'confirmation':
        return {
          type: 'send_reminder',
          at: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours (adjusted by reminder job)
        };
      case 'meeting_reminder':
        return {
          type: 'check_no_show',
          at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour (adjusted by no-show job)
        };
      default:
        return null;
    }
  }
}

// Factory function
export function createExecuteDraftsJob(): ExecuteDraftsJob {
  return new ExecuteDraftsJob();
}
