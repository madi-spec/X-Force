/**
 * SendRemindersJob - Send meeting reminders
 *
 * This job:
 * 1. Finds confirmed meetings happening in the next 24-48 hours
 * 2. Generates reminder email drafts
 * 3. Updates request status to reminder_sent
 */

import { JobRunner, type JobContext, type ProcessingStats } from './JobRunner';
import { SCHEDULER_JOBS, type JobDefinition } from './registry';
import { STATUS, TIMING } from '../core/constants';
import { generateDraft } from '../draftService';

export class SendRemindersJob extends JobRunner {
  constructor() {
    super(SCHEDULER_JOBS.SEND_REMINDERS.id);
  }

  protected getJobDefinition(): JobDefinition {
    return SCHEDULER_JOBS.SEND_REMINDERS;
  }

  protected async run(context: JobContext): Promise<ProcessingStats> {
    const stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };

    // Find confirmed meetings happening in reminder window
    const reminderWindowStart = new Date(
      Date.now() + (TIMING.REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000
    );
    const reminderWindowEnd = new Date(
      Date.now() + (TIMING.REMINDER_HOURS_BEFORE + 1) * 60 * 60 * 1000
    );

    const { data: requests, error } = await context.supabase
      .from('scheduling_requests')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, email, first_name, last_name, timezone)
      `)
      .eq('status', STATUS.CONFIRMED)
      .is('reminder_sent_at', null)
      .gte('confirmed_time', reminderWindowStart.toISOString())
      .lte('confirmed_time', reminderWindowEnd.toISOString())
      .limit(100);

    if (error) {
      context.error('Failed to fetch requests', error);
      stats.errors.push(error.message);
      return stats;
    }

    if (!requests || requests.length === 0) {
      context.log('No reminders to send');
      return stats;
    }

    context.log(`Found ${requests.length} meetings needing reminders`);

    for (const request of requests) {
      try {
        await this.sendReminder(request, context);
        stats.processed++;
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Request ${request.id}: ${err}`);
        context.error(`Failed to send reminder for request ${request.id}`, err);
      }
    }

    return stats;
  }

  private async sendReminder(request: any, context: JobContext): Promise<void> {
    context.log(`Sending reminder for meeting ${request.id}`, {
      company: request.company?.name,
      confirmedTime: request.confirmed_time,
    });

    // Generate reminder draft
    // Note: generateDraft signature is (requestId, userId, emailType)
    await generateDraft(request.id, request.created_by, 'reminder');

    // Update request
    await context.supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.REMINDER_SENT,
        reminder_sent_at: new Date().toISOString(),
        next_action_type: 'check_no_show',
        next_action_at: new Date(
          new Date(request.confirmed_time).getTime() + 30 * 60 * 1000 // 30 min after meeting start
        ).toISOString(),
      })
      .eq('id', request.id);

    // Log the action
    await context.supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: 'reminder_generated',
      actor: 'ai',
      ai_reasoning: 'Generated 24-hour meeting reminder',
      metadata: {
        meeting_time: request.confirmed_time,
        correlation_id: context.correlationId,
      },
    });
  }
}

// Factory function
export function createSendRemindersJob(): SendRemindersJob {
  return new SendRemindersJob();
}
