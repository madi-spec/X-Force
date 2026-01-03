/**
 * Scheduler Jobs - Module Index
 *
 * Exports all job-related functionality for the scheduler.
 */

// Registry
export * from './registry';

// Base Runner
export * from './JobRunner';

// Import factory functions for local use
import { createSendFollowUpsJob } from './SendFollowUpsJob';
import { createSendRemindersJob } from './SendRemindersJob';
import { createCheckNoShowsJob } from './CheckNoShowsJob';
import { createExecuteDraftsJob } from './ExecuteDraftsJob';
import { createExpireDraftsJob } from './ExpireDraftsJob';

// Re-export individual job classes and factory functions
// NOTE: ProcessResponsesJob was removed - response processing is now handled
// directly by the webhook via responseProcessor.ts
export { SendFollowUpsJob, createSendFollowUpsJob } from './SendFollowUpsJob';
export { SendRemindersJob, createSendRemindersJob } from './SendRemindersJob';
export { CheckNoShowsJob, createCheckNoShowsJob } from './CheckNoShowsJob';
export { ExecuteDraftsJob, createExecuteDraftsJob } from './ExecuteDraftsJob';
export { ExpireDraftsJob, createExpireDraftsJob } from './ExpireDraftsJob';

// Factory to get all job instances
export function createAllJobs() {
  return {
    sendFollowUps: createSendFollowUpsJob(),
    sendReminders: createSendRemindersJob(),
    checkNoShows: createCheckNoShowsJob(),
    executeDrafts: createExecuteDraftsJob(),
    expireDrafts: createExpireDraftsJob(),
  };
}

// Run a specific job by ID
export async function runJobById(jobId: string) {
  const jobs = createAllJobs();

  switch (jobId) {
    case 'scheduler:send-follow-ups':
      return jobs.sendFollowUps.execute();
    case 'scheduler:send-reminders':
      return jobs.sendReminders.execute();
    case 'scheduler:check-no-shows':
      return jobs.checkNoShows.execute();
    case 'scheduler:execute-drafts':
      return jobs.executeDrafts.execute();
    case 'scheduler:expire-drafts':
      return jobs.expireDrafts.execute();
    default:
      throw new Error(`Unknown job ID: ${jobId}`);
  }
}
