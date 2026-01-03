/**
 * CheckNoShowsJob - Detect and handle meeting no-shows
 *
 * This job:
 * 1. Finds meetings that should have started but no one joined
 * 2. Marks them as no-show
 * 3. Initiates recovery workflow (re-scheduling offer)
 */

import { JobRunner, type JobContext, type ProcessingStats } from './JobRunner';
import { SCHEDULER_JOBS, type JobDefinition } from './registry';
import { STATUS } from '../core/constants';
import { generateDraft } from '../draftService';

export class CheckNoShowsJob extends JobRunner {
  constructor() {
    super(SCHEDULER_JOBS.CHECK_NO_SHOWS.id);
  }

  protected getJobDefinition(): JobDefinition {
    return SCHEDULER_JOBS.CHECK_NO_SHOWS;
  }

  protected async run(context: JobContext): Promise<ProcessingStats> {
    const stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };

    // Find meetings that started 30+ minutes ago with reminder sent
    const checkWindow = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

    const { data: requests, error } = await context.supabase
      .from('scheduling_requests')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, email, first_name, last_name, timezone)
      `)
      .eq('status', STATUS.REMINDER_SENT)
      .eq('next_action_type', 'check_no_show')
      .lte('confirmed_time', checkWindow.toISOString())
      .limit(50);

    if (error) {
      context.error('Failed to fetch requests', error);
      stats.errors.push(error.message);
      return stats;
    }

    if (!requests || requests.length === 0) {
      context.log('No meetings to check for no-shows');
      return stats;
    }

    context.log(`Found ${requests.length} meetings to check for no-shows`);

    for (const request of requests) {
      try {
        const wasNoShow = await this.checkMeeting(request, context);
        if (wasNoShow) {
          stats.processed++;
        } else {
          stats.skipped++;
        }
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Request ${request.id}: ${err}`);
        context.error(`Failed to check meeting ${request.id}`, err);
      }
    }

    return stats;
  }

  private async checkMeeting(request: any, context: JobContext): Promise<boolean> {
    context.log(`Checking meeting ${request.id} for no-show`, {
      company: request.company?.name,
      confirmedTime: request.confirmed_time,
    });

    // Check if meeting was marked as completed via other means
    // (e.g., transcript exists, or calendar event has attendees)
    const hasEvidence = await this.checkForMeetingEvidence(request, context);

    if (hasEvidence) {
      context.log('Meeting has evidence of attendance, marking as completed');
      await this.markAsCompleted(request, context);
      return false;
    }

    // No evidence of meeting - mark as no-show
    context.log('No evidence of meeting, marking as no-show');
    await this.markAsNoShow(request, context);
    return true;
  }

  private async checkForMeetingEvidence(request: any, context: JobContext): Promise<boolean> {
    // Check 1: Does a transcript exist for this meeting time?
    const meetingWindow = {
      start: new Date(new Date(request.confirmed_time).getTime() - 15 * 60 * 1000),
      end: new Date(new Date(request.confirmed_time).getTime() + 90 * 60 * 1000),
    };

    const { data: transcripts } = await context.supabase
      .from('transcripts')
      .select('id')
      .eq('company_id', request.company_id)
      .gte('meeting_date', meetingWindow.start.toISOString())
      .lte('meeting_date', meetingWindow.end.toISOString())
      .limit(1);

    if (transcripts && transcripts.length > 0) {
      return true;
    }

    // Check 2: Was the meeting manually marked as completed?
    const { data: actions } = await context.supabase
      .from('scheduling_actions')
      .select('id')
      .eq('scheduling_request_id', request.id)
      .eq('action_type', 'meeting_completed')
      .limit(1);

    if (actions && actions.length > 0) {
      return true;
    }

    return false;
  }

  private async markAsCompleted(request: any, context: JobContext): Promise<void> {
    await context.supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.COMPLETED,
        completed_at: new Date().toISOString(),
        next_action_type: null,
        next_action_at: null,
      })
      .eq('id', request.id);

    await context.supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: 'meeting_completed',
      actor: 'system',
      ai_reasoning: 'Meeting evidence found, marked as completed',
      metadata: {
        correlation_id: context.correlationId,
      },
    });
  }

  private async markAsNoShow(request: any, context: JobContext): Promise<void> {
    // Update request status
    await context.supabase
      .from('scheduling_requests')
      .update({
        status: STATUS.NO_SHOW,
        no_show_at: new Date().toISOString(),
        next_action_type: null,
        next_action_at: null,
      })
      .eq('id', request.id);

    // Generate recovery email draft
    // Note: generateDraft signature is (requestId, userId, emailType)
    await generateDraft(request.id, request.created_by, 'no_show');

    // Log the action
    await context.supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: 'no_show_detected',
      actor: 'system',
      ai_reasoning: 'No evidence of meeting attendance found after 30 minutes',
      metadata: {
        meeting_time: request.confirmed_time,
        correlation_id: context.correlationId,
      },
    });
  }
}

// Factory function
export function createCheckNoShowsJob(): CheckNoShowsJob {
  return new CheckNoShowsJob();
}
