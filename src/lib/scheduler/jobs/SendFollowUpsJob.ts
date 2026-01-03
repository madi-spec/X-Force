/**
 * SendFollowUpsJob - Send follow-up emails for requests awaiting response
 *
 * This job:
 * 1. Finds requests that need follow-up (based on timing rules)
 * 2. Generates appropriate follow-up email drafts
 * 3. Tracks attempt count and escalates after max attempts
 */

import { JobRunner, type JobContext, type ProcessingStats } from './JobRunner';
import { SCHEDULER_JOBS, type JobDefinition } from './registry';
import { STATUS, TIMING, AUTOMATION_ACTION_TYPES } from '../core/constants';
import { escalateMaxAttempts } from '../processors/Escalation';
import { generateDraft } from '../draftService';

export class SendFollowUpsJob extends JobRunner {
  constructor() {
    super(SCHEDULER_JOBS.SEND_FOLLOW_UPS.id);
  }

  protected getJobDefinition(): JobDefinition {
    return SCHEDULER_JOBS.SEND_FOLLOW_UPS;
  }

  protected async run(context: JobContext): Promise<ProcessingStats> {
    const stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };

    // Find requests needing follow-up
    const followUpTypes = ['follow_up', 'second_follow_up'];
    const { data: requests, error } = await context.supabase
      .from('scheduling_requests')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, email, first_name, last_name, timezone)
      `)
      .eq('status', STATUS.AWAITING_RESPONSE)
      .in('next_action_type', followUpTypes)
      .lte('next_action_at', new Date().toISOString())
      .limit(50);

    if (error) {
      context.error('Failed to fetch requests', error);
      stats.errors.push(error.message);
      return stats;
    }

    if (!requests || requests.length === 0) {
      context.log('No follow-ups needed');
      return stats;
    }

    context.log(`Found ${requests.length} requests needing follow-up`);

    for (const request of requests) {
      try {
        await this.processFollowUp(request, context);
        stats.processed++;
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Request ${request.id}: ${err}`);
        context.error(`Failed to process follow-up for request ${request.id}`, err);
      }
    }

    return stats;
  }

  private async processFollowUp(request: any, context: JobContext): Promise<void> {
    const attemptCount = (request.follow_up_count || 0) + 1;
    context.log(`Processing follow-up #${attemptCount} for request ${request.id}`, {
      company: request.company?.name,
    });

    // Check if we've exceeded max attempts
    if (attemptCount > TIMING.MAX_FOLLOW_UP_ATTEMPTS) {
      context.log('Max follow-up attempts reached, escalating');
      await escalateMaxAttempts(request, attemptCount, context.correlationId);
      return;
    }

    // Generate follow-up email draft
    // Note: EmailType only has 'follow_up' and 'second_follow_up'
    const emailType = attemptCount <= 1 ? 'follow_up' : 'second_follow_up';

    // Note: generateDraft signature is (requestId, userId, emailType)
    await generateDraft(request.id, request.created_by, emailType);

    // Calculate next follow-up time
    const nextFollowUpHours = attemptCount === 1 ? TIMING.FOLLOW_UP_DELAY_HOURS :
                              attemptCount === 2 ? TIMING.SECOND_FOLLOW_UP_DELAY_HOURS :
                              TIMING.FINAL_FOLLOW_UP_DELAY_HOURS;

    const nextActionAt = new Date(Date.now() + nextFollowUpHours * 60 * 60 * 1000);

    // Update request
    await context.supabase
      .from('scheduling_requests')
      .update({
        follow_up_count: attemptCount,
        last_follow_up_at: new Date().toISOString(),
        next_action_type: attemptCount >= TIMING.MAX_FOLLOW_UP_ATTEMPTS ?
          'human_review_max_attempts' : 'follow_up',
        next_action_at: nextActionAt.toISOString(),
      })
      .eq('id', request.id);

    // Log the action
    await context.supabase.from('scheduling_actions').insert({
      scheduling_request_id: request.id,
      action_type: 'follow_up_generated',
      actor: 'ai',
      ai_reasoning: `Generated ${emailType} (attempt ${attemptCount}/${TIMING.MAX_FOLLOW_UP_ATTEMPTS})`,
      metadata: {
        attempt_number: attemptCount,
        next_action_at: nextActionAt.toISOString(),
        correlation_id: context.correlationId,
      },
    });
  }
}

// Factory function
export function createSendFollowUpsJob(): SendFollowUpsJob {
  return new SendFollowUpsJob();
}
