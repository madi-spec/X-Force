/**
 * ExpireDraftsJob - Expire stale unapproved drafts
 *
 * This job:
 * 1. Finds drafts that have been pending for too long
 * 2. Marks them as expired
 * 3. Optionally creates new drafts with updated times
 */

import { JobRunner, type JobContext, type ProcessingStats } from './JobRunner';
import { SCHEDULER_JOBS, type JobDefinition } from './registry';

// Drafts expire after 24 hours of inactivity
const DRAFT_EXPIRY_HOURS = 24;

export class ExpireDraftsJob extends JobRunner {
  constructor() {
    super(SCHEDULER_JOBS.EXPIRE_DRAFTS.id);
  }

  protected getJobDefinition(): JobDefinition {
    return SCHEDULER_JOBS.EXPIRE_DRAFTS;
  }

  protected async run(context: JobContext): Promise<ProcessingStats> {
    const stats: ProcessingStats = { processed: 0, failed: 0, skipped: 0, errors: [] };

    const expiryThreshold = new Date(Date.now() - DRAFT_EXPIRY_HOURS * 60 * 60 * 1000);

    // Find stale pending/rejected drafts
    const { data: drafts, error } = await context.supabase
      .from('scheduling_drafts')
      .select(`
        *,
        request:scheduling_requests(id, created_by, status)
      `)
      .in('status', ['pending', 'rejected'])
      .lte('created_at', expiryThreshold.toISOString())
      .limit(100);

    if (error) {
      context.error('Failed to fetch stale drafts', error);
      stats.errors.push(error.message);
      return stats;
    }

    if (!drafts || drafts.length === 0) {
      context.log('No stale drafts to expire');
      return stats;
    }

    context.log(`Found ${drafts.length} stale drafts to expire`);

    for (const draft of drafts) {
      try {
        await this.expireDraft(draft, context);
        stats.processed++;
      } catch (err) {
        stats.failed++;
        stats.errors.push(`Draft ${draft.id}: ${err}`);
        context.error(`Failed to expire draft ${draft.id}`, err);
      }
    }

    return stats;
  }

  private async expireDraft(draft: any, context: JobContext): Promise<void> {
    context.log(`Expiring draft ${draft.id}`, {
      type: draft.draft_type,
      createdAt: draft.created_at,
    });

    // Mark draft as expired
    await context.supabase
      .from('scheduling_drafts')
      .update({
        status: 'expired',
        expired_at: new Date().toISOString(),
        expiry_reason: `Stale for more than ${DRAFT_EXPIRY_HOURS} hours`,
      })
      .eq('id', draft.id);

    // Log the action
    if (draft.request?.id) {
      await context.supabase.from('scheduling_actions').insert({
        scheduling_request_id: draft.request.id,
        action_type: 'draft_expired',
        actor: 'system',
        ai_reasoning: `Draft expired after ${DRAFT_EXPIRY_HOURS} hours without approval`,
        metadata: {
          draft_id: draft.id,
          draft_type: draft.draft_type,
          correlation_id: context.correlationId,
        },
      });

      // Check if we should regenerate the draft with fresh times
      if (this.shouldRegenerate(draft)) {
        context.log('Draft has time-sensitive content, flagging for regeneration');

        await context.supabase
          .from('scheduling_requests')
          .update({
            next_action_type: 'regenerate_draft',
            next_action_at: new Date().toISOString(),
          })
          .eq('id', draft.request.id);
      }
    }
  }

  private shouldRegenerate(draft: any): boolean {
    // Regenerate drafts that contain proposed times (they may be stale)
    const typesWithTimes = [
      'initial_outreach',
      'time_proposal',
      'counter_response',
      'first_follow_up',
      'second_follow_up',
    ];

    return typesWithTimes.includes(draft.draft_type);
  }
}

// Factory function
export function createExpireDraftsJob(): ExpireDraftsJob {
  return new ExpireDraftsJob();
}
