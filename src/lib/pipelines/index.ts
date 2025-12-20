/**
 * Command Center Data Pipelines
 *
 * Pipelines that populate the Command Center with actionable items
 * by scanning various data sources for tier-specific triggers.
 */

export { processTranscriptAnalysis } from './processTranscriptAnalysis';
export { detectInboundEmails } from './detectInboundEmails';
export { detectDealDeadlines } from './detectDealDeadlines';
export { detectMeetingFollowups } from './detectMeetingFollowups';
export { updateSlaStatus } from './updateSlaStatus';

/**
 * Run all pipelines for a user (or all users if no userId provided)
 */
export async function runAllPipelines(userId?: string) {
  const { processTranscriptAnalysis } = await import('./processTranscriptAnalysis');
  const { detectInboundEmails } = await import('./detectInboundEmails');
  const { detectDealDeadlines } = await import('./detectDealDeadlines');
  const { detectMeetingFollowups } = await import('./detectMeetingFollowups');
  const { updateSlaStatus } = await import('./updateSlaStatus');

  const results = {
    transcripts: await processTranscriptAnalysis(userId),
    emails: await detectInboundEmails(userId),
    deadlines: await detectDealDeadlines(userId),
    followups: await detectMeetingFollowups(userId),
    sla: await updateSlaStatus(userId),
  };

  return {
    totalItemsCreated:
      results.transcripts.itemsCreated +
      results.emails.itemsCreated +
      results.deadlines.itemsCreated +
      results.followups.itemsCreated,
    slaUpdates:
      results.sla.statusChanges.toWarning +
      results.sla.statusChanges.toBreached,
    errors: [
      ...results.transcripts.errors,
      ...results.emails.errors,
      ...results.deadlines.errors,
      ...results.followups.errors,
      ...results.sla.errors,
    ],
    details: results,
  };
}
