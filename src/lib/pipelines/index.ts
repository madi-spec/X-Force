/**
 * Command Center Data Pipelines
 *
 * Pipelines that populate the Command Center with actionable items
 * by scanning various data sources for tier-specific triggers.
 *
 * NOTE: Email processing uses AI analysis (processUnanalyzedEmails) instead of
 * keyword detection (detectInboundEmails) to properly determine tier and communication_type.
 */

export { processTranscriptAnalysis, processSingleTranscript } from './processTranscriptAnalysis';
// DEPRECATED: detectInboundEmails uses keyword matching - use processUnanalyzedEmails instead
export { detectInboundEmails } from './detectInboundEmails';
export { detectDealDeadlines } from './detectDealDeadlines';
export { detectMeetingFollowups } from './detectMeetingFollowups';
export { updateSlaStatus } from './updateSlaStatus';

/**
 * Run all pipelines for a user (or all users if no userId provided)
 *
 * Email processing uses AI analysis to determine tier and communication_type
 * from the Sales Playbook, rather than keyword matching.
 */
export async function runAllPipelines(userId?: string) {
  const { processTranscriptAnalysis } = await import('./processTranscriptAnalysis');
  const { processUnanalyzedEmails } = await import('@/lib/email');
  const { detectDealDeadlines } = await import('./detectDealDeadlines');
  const { detectMeetingFollowups } = await import('./detectMeetingFollowups');
  const { updateSlaStatus } = await import('./updateSlaStatus');

  // Process emails with AI analysis (correct approach - uses playbook for tier detection)
  const emailResult = await processUnanalyzedEmails(userId, 20);

  const results = {
    transcripts: await processTranscriptAnalysis(userId),
    emails: {
      messagesProcessed: emailResult.processed,
      itemsCreated: emailResult.itemsCreated,
      byTrigger: { ai_analysis: emailResult.itemsCreated },
      errors: emailResult.errors,
    },
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
