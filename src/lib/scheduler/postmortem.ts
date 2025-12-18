/**
 * Scheduling Postmortem System
 *
 * Analyzes completed scheduling requests to learn what worked,
 * what failed, and how to improve future scheduling.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { recordSeasonalOutcome } from './seasonality';

// Types
export interface SchedulingPostmortem {
  id: string;
  scheduling_request_id: string;
  deal_id: string | null;
  company_id: string | null;
  outcome: 'meeting_held' | 'no_show' | 'cancelled' | 'never_scheduled';
  meeting_held_at: Date | null;
  total_days_to_schedule: number | null;
  total_attempts: number;
  channels_used: string[];
  de_escalated: boolean;
  social_proof_used: boolean;
  champion_involved: boolean;
  persona_detected: string | null;
  meeting_type: string | null;
  duration_minutes: number | null;
  company_size: number | null;
  ownership_type: string | null;
  what_worked: string[];
  what_failed: string[];
  learnings_for_account: string[];
  learnings_for_meeting_type: string[];
  learnings_for_season: string[];
  key_insight: string | null;
  scheduling_efficiency_score: number | null;
  relationship_health_score: number | null;
}

export interface PostmortemAnalysis {
  postmortem: Partial<SchedulingPostmortem>;
  insights: {
    what_worked: string[];
    what_failed: string[];
    key_insight: string;
    account_learnings: string[];
    meeting_type_learnings: string[];
    seasonal_learnings: string[];
  };
  scores: {
    efficiency: number;
    relationship_health: number;
  };
}

/**
 * Create a postmortem for a completed scheduling request
 */
export async function createSchedulingPostmortem(
  schedulingRequestId: string
): Promise<PostmortemAnalysis> {
  const supabase = createAdminClient();

  // Get scheduling request with full context
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      companies (
        id,
        name,
        state,
        ownership_type,
        employee_count
      ),
      deals (
        id,
        stage,
        value
      ),
      contacts:target_contact_id (
        id,
        persona
      )
    `)
    .eq('id', schedulingRequestId)
    .single();

  if (!request) {
    throw new Error('Scheduling request not found');
  }

  // Get all attempts
  const { data: attempts } = await supabase
    .from('scheduling_attempts')
    .select('*')
    .eq('scheduling_request_id', schedulingRequestId)
    .order('attempt_number', { ascending: true });

  // Get social proof usage
  const { data: socialProofUsage } = await supabase
    .from('scheduling_social_proof_usage')
    .select('*')
    .eq('scheduling_request_id', schedulingRequestId);

  // Get champion involvements
  const { data: championInvolvements } = await supabase
    .from('champion_involvements')
    .select('*')
    .eq('scheduling_request_id', schedulingRequestId);

  // Analyze the scheduling journey
  const analysis = analyzeSchedulingJourney(
    request,
    attempts || [],
    socialProofUsage || [],
    championInvolvements || []
  );

  // Create postmortem record
  const postmortemData: Partial<SchedulingPostmortem> = {
    scheduling_request_id: schedulingRequestId,
    deal_id: request.deal_id,
    company_id: request.company_id,
    outcome: determineOutcome(request),
    meeting_held_at: request.meeting_scheduled_at,
    total_days_to_schedule: calculateDaysToSchedule(request),
    total_attempts: attempts?.length || 0,
    channels_used: [...new Set(attempts?.map(a => a.channel) || [])],
    de_escalated: attempts?.some(a => a.de_escalation_used) || false,
    social_proof_used: (socialProofUsage?.length || 0) > 0,
    champion_involved: (championInvolvements?.length || 0) > 0,
    persona_detected: (request.contacts as { persona?: string } | null)?.persona || null,
    meeting_type: request.meeting_type,
    duration_minutes: request.duration_minutes,
    company_size: (request.companies as { employee_count?: number } | null)?.employee_count || null,
    ownership_type: (request.companies as { ownership_type?: string } | null)?.ownership_type || null,
    what_worked: analysis.insights.what_worked,
    what_failed: analysis.insights.what_failed,
    learnings_for_account: analysis.insights.account_learnings,
    learnings_for_meeting_type: analysis.insights.meeting_type_learnings,
    learnings_for_season: analysis.insights.seasonal_learnings,
    key_insight: analysis.insights.key_insight,
    scheduling_efficiency_score: analysis.scores.efficiency,
    relationship_health_score: analysis.scores.relationship_health,
  };

  // Insert postmortem
  const { error } = await supabase
    .from('scheduling_postmortems')
    .upsert(postmortemData, { onConflict: 'scheduling_request_id' });

  if (error) {
    console.error('[Postmortem] Error creating:', error);
  }

  // Record seasonal learning
  if (request.companies?.state) {
    const month = new Date().getMonth() + 1;
    await recordSeasonalOutcome(
      (request.companies as { state?: string }).state || null,
      month,
      {
        days_to_schedule: postmortemData.total_days_to_schedule || 0,
        total_attempts: postmortemData.total_attempts || 0,
        successful: postmortemData.outcome === 'meeting_held',
      }
    );
  }

  return {
    postmortem: postmortemData,
    insights: analysis.insights,
    scores: analysis.scores,
  };
}

/**
 * Determine the outcome of a scheduling request
 */
function determineOutcome(
  request: { status: string; meeting_scheduled_at?: string }
): SchedulingPostmortem['outcome'] {
  if (request.status === 'completed' && request.meeting_scheduled_at) {
    return 'meeting_held';
  }
  if (request.status === 'no_show') {
    return 'no_show';
  }
  if (request.status === 'cancelled') {
    return 'cancelled';
  }
  return 'never_scheduled';
}

/**
 * Calculate days from request to meeting
 */
function calculateDaysToSchedule(
  request: { created_at: string; meeting_scheduled_at?: string }
): number | null {
  if (!request.meeting_scheduled_at) return null;

  const created = new Date(request.created_at);
  const scheduled = new Date(request.meeting_scheduled_at);
  return Math.ceil((scheduled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Analyze the scheduling journey
 */
function analyzeSchedulingJourney(
  request: {
    status: string;
    meeting_type: string;
    created_at: string;
    meeting_scheduled_at?: string;
  },
  attempts: Array<{
    channel: string;
    outcome: string;
    de_escalation_used: boolean;
    attempt_number: number;
  }>,
  socialProofUsage: Array<{
    led_to_response?: boolean;
    led_to_scheduling?: boolean;
  }>,
  championInvolvements: Array<{
    champion_helped?: boolean;
    involvement_type: string;
  }>
): {
  insights: {
    what_worked: string[];
    what_failed: string[];
    key_insight: string;
    account_learnings: string[];
    meeting_type_learnings: string[];
    seasonal_learnings: string[];
  };
  scores: {
    efficiency: number;
    relationship_health: number;
  };
} {
  const what_worked: string[] = [];
  const what_failed: string[] = [];
  const account_learnings: string[] = [];
  const meeting_type_learnings: string[] = [];
  const seasonal_learnings: string[] = [];

  // Analyze attempt patterns
  const channelOutcomes: Record<string, { attempts: number; responses: number }> = {};

  for (const attempt of attempts) {
    if (!channelOutcomes[attempt.channel]) {
      channelOutcomes[attempt.channel] = { attempts: 0, responses: 0 };
    }
    channelOutcomes[attempt.channel].attempts++;
    if (attempt.outcome === 'response_received' || attempt.outcome === 'meeting_scheduled') {
      channelOutcomes[attempt.channel].responses++;
    }
  }

  // Find effective channels
  for (const [channel, stats] of Object.entries(channelOutcomes)) {
    if (stats.responses > 0) {
      what_worked.push(`${channel} got ${stats.responses} response(s) from ${stats.attempts} attempts`);
      account_learnings.push(`${channel} is effective for this contact`);
    } else if (stats.attempts >= 2) {
      what_failed.push(`${channel} had ${stats.attempts} attempts with no response`);
    }
  }

  // Analyze de-escalation
  const deEscalationAttempts = attempts.filter(a => a.de_escalation_used);
  if (deEscalationAttempts.length > 0) {
    const deEscalationWorked = deEscalationAttempts.some(
      a => a.outcome === 'response_received' || a.outcome === 'meeting_scheduled'
    );
    if (deEscalationWorked) {
      what_worked.push('De-escalation strategy helped get response');
      account_learnings.push('This contact responds better to lighter touch');
    } else {
      what_failed.push('De-escalation did not improve response rate');
    }
  }

  // Analyze social proof
  const effectiveSocialProof = socialProofUsage.filter(
    sp => sp.led_to_response || sp.led_to_scheduling
  );
  if (effectiveSocialProof.length > 0) {
    what_worked.push(`Social proof helped in ${effectiveSocialProof.length} attempt(s)`);
    meeting_type_learnings.push(`Social proof effective for ${request.meeting_type} meetings`);
  } else if (socialProofUsage.length > 0) {
    // Social proof was used but didn't help
    meeting_type_learnings.push('Social proof did not significantly impact this scheduling');
  }

  // Analyze champion involvement
  const helpfulChampions = championInvolvements.filter(ci => ci.champion_helped);
  if (helpfulChampions.length > 0) {
    what_worked.push(`Champion involvement helped (${helpfulChampions[0].involvement_type})`);
    account_learnings.push('Use champions for difficult scheduling at this account');
  } else if (championInvolvements.length > 0) {
    what_failed.push('Champion involvement did not help');
  }

  // Calculate efficiency score (0-100)
  let efficiencyScore = 100;
  const attemptCount = attempts.length;

  if (attemptCount > 1) efficiencyScore -= (attemptCount - 1) * 10;
  if (attemptCount > 5) efficiencyScore -= 20;
  if (request.status !== 'completed') efficiencyScore -= 30;

  efficiencyScore = Math.max(0, Math.min(100, efficiencyScore));

  // Calculate relationship health score
  let relationshipScore = 70; // Base score

  // Positive factors
  if (request.status === 'completed') relationshipScore += 15;
  if (attemptCount <= 2) relationshipScore += 10;
  if (helpfulChampions.length > 0) relationshipScore += 5;

  // Negative factors
  if (attemptCount > 5) relationshipScore -= 10;
  if (request.status === 'never_scheduled') relationshipScore -= 20;
  if (championInvolvements.length > 0 && helpfulChampions.length === 0) {
    relationshipScore -= 5; // Champion asked but didn't help
  }

  relationshipScore = Math.max(0, Math.min(100, relationshipScore));

  // Generate key insight
  let keyInsight = '';
  if (request.status === 'completed') {
    if (attemptCount === 1) {
      keyInsight = 'Excellent - scheduled on first attempt';
    } else if (attemptCount <= 3) {
      keyInsight = 'Good scheduling efficiency with minimal follow-up needed';
    } else {
      keyInsight = `Scheduled after ${attemptCount} attempts - consider adjusting initial approach`;
    }
  } else {
    if (attemptCount >= 5) {
      keyInsight = 'Multiple attempts failed - may need different approach or timing';
    } else {
      keyInsight = 'Did not complete - investigate blockers';
    }
  }

  // Add seasonal learnings based on timing
  const month = new Date(request.created_at).getMonth() + 1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (request.status === 'completed') {
    seasonal_learnings.push(
      `${monthNames[month - 1]}: Successfully scheduled ${request.meeting_type} in ${attemptCount} attempts`
    );
  } else {
    seasonal_learnings.push(
      `${monthNames[month - 1]}: Failed to schedule ${request.meeting_type} after ${attemptCount} attempts`
    );
  }

  return {
    insights: {
      what_worked,
      what_failed,
      key_insight: keyInsight,
      account_learnings,
      meeting_type_learnings,
      seasonal_learnings,
    },
    scores: {
      efficiency: Math.round(efficiencyScore),
      relationship_health: Math.round(relationshipScore),
    },
  };
}

/**
 * Get aggregated learnings for a company
 */
export async function getCompanySchedulingLearnings(
  companyId: string
): Promise<{
  totalRequests: number;
  successRate: number;
  avgDaysToSchedule: number;
  avgAttempts: number;
  effectiveChannels: string[];
  insights: string[];
}> {
  const supabase = createAdminClient();

  const { data: postmortems } = await supabase
    .from('scheduling_postmortems')
    .select('*')
    .eq('company_id', companyId);

  if (!postmortems?.length) {
    return {
      totalRequests: 0,
      successRate: 0,
      avgDaysToSchedule: 0,
      avgAttempts: 0,
      effectiveChannels: [],
      insights: [],
    };
  }

  const successful = postmortems.filter(p => p.outcome === 'meeting_held');
  const successRate = successful.length / postmortems.length;

  const daysWithData = successful.filter(p => p.total_days_to_schedule);
  const avgDaysToSchedule =
    daysWithData.length > 0
      ? daysWithData.reduce((sum, p) => sum + (p.total_days_to_schedule || 0), 0) / daysWithData.length
      : 0;

  const avgAttempts =
    postmortems.reduce((sum, p) => sum + p.total_attempts, 0) / postmortems.length;

  // Find effective channels
  const channelCounts: Record<string, number> = {};
  for (const pm of successful) {
    for (const channel of pm.channels_used || []) {
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    }
  }

  const effectiveChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([channel]) => channel);

  // Aggregate insights
  const allLearnings = postmortems.flatMap(p => p.learnings_for_account || []);
  const uniqueInsights = [...new Set(allLearnings)].slice(0, 5);

  return {
    totalRequests: postmortems.length,
    successRate: Math.round(successRate * 100) / 100,
    avgDaysToSchedule: Math.round(avgDaysToSchedule * 10) / 10,
    avgAttempts: Math.round(avgAttempts * 10) / 10,
    effectiveChannels,
    insights: uniqueInsights,
  };
}

/**
 * Get meeting type learnings
 */
export async function getMeetingTypeLearnings(
  meetingType: string
): Promise<{
  totalRequests: number;
  successRate: number;
  avgAttempts: number;
  bestChannels: string[];
  socialProofEffective: boolean;
  championHelpful: boolean;
  insights: string[];
}> {
  const supabase = createAdminClient();

  const { data: postmortems } = await supabase
    .from('scheduling_postmortems')
    .select('*')
    .eq('meeting_type', meetingType);

  if (!postmortems?.length) {
    return {
      totalRequests: 0,
      successRate: 0,
      avgAttempts: 0,
      bestChannels: [],
      socialProofEffective: false,
      championHelpful: false,
      insights: [],
    };
  }

  const successful = postmortems.filter(p => p.outcome === 'meeting_held');

  // Analyze social proof effectiveness
  const withSocialProof = successful.filter(p => p.social_proof_used);
  const withoutSocialProof = successful.filter(p => !p.social_proof_used);

  const socialProofEffective =
    withSocialProof.length > 0 &&
    (withSocialProof.length / postmortems.filter(p => p.social_proof_used).length >
      withoutSocialProof.length / postmortems.filter(p => !p.social_proof_used).length);

  // Analyze champion effectiveness
  const withChampion = successful.filter(p => p.champion_involved);
  const championHelpful = withChampion.length > postmortems.filter(p => p.champion_involved).length * 0.5;

  // Find best channels
  const channelCounts: Record<string, number> = {};
  for (const pm of successful) {
    for (const channel of pm.channels_used || []) {
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    }
  }

  const bestChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([channel]) => channel);

  // Aggregate insights
  const allLearnings = postmortems.flatMap(p => p.learnings_for_meeting_type || []);
  const uniqueInsights = [...new Set(allLearnings)].slice(0, 5);

  return {
    totalRequests: postmortems.length,
    successRate: Math.round((successful.length / postmortems.length) * 100) / 100,
    avgAttempts:
      Math.round((postmortems.reduce((sum, p) => sum + p.total_attempts, 0) / postmortems.length) * 10) / 10,
    bestChannels,
    socialProofEffective,
    championHelpful,
    insights: uniqueInsights,
  };
}

/**
 * Generate overall scheduling performance report
 */
export async function getSchedulingPerformanceReport(
  dateRange?: { start: Date; end: Date }
): Promise<{
  overview: {
    totalRequests: number;
    successRate: number;
    avgDaysToSchedule: number;
    avgAttempts: number;
  };
  byOutcome: Record<string, number>;
  byMeetingType: Record<string, { total: number; success: number }>;
  trends: {
    efficiency_improving: boolean;
    most_improved_area: string;
    needs_attention: string[];
  };
}> {
  const supabase = createAdminClient();

  let query = supabase.from('scheduling_postmortems').select('*');

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());
  }

  const { data: postmortems } = await query;

  if (!postmortems?.length) {
    return {
      overview: { totalRequests: 0, successRate: 0, avgDaysToSchedule: 0, avgAttempts: 0 },
      byOutcome: {},
      byMeetingType: {},
      trends: { efficiency_improving: false, most_improved_area: '', needs_attention: [] },
    };
  }

  // Overview
  const successful = postmortems.filter(p => p.outcome === 'meeting_held');
  const daysData = successful.filter(p => p.total_days_to_schedule);

  const overview = {
    totalRequests: postmortems.length,
    successRate: Math.round((successful.length / postmortems.length) * 100) / 100,
    avgDaysToSchedule:
      daysData.length > 0
        ? Math.round(
            (daysData.reduce((sum, p) => sum + (p.total_days_to_schedule || 0), 0) / daysData.length) * 10
          ) / 10
        : 0,
    avgAttempts:
      Math.round((postmortems.reduce((sum, p) => sum + p.total_attempts, 0) / postmortems.length) * 10) / 10,
  };

  // By outcome
  const byOutcome: Record<string, number> = {};
  for (const pm of postmortems) {
    byOutcome[pm.outcome] = (byOutcome[pm.outcome] || 0) + 1;
  }

  // By meeting type
  const byMeetingType: Record<string, { total: number; success: number }> = {};
  for (const pm of postmortems) {
    const type = pm.meeting_type || 'unknown';
    if (!byMeetingType[type]) {
      byMeetingType[type] = { total: 0, success: 0 };
    }
    byMeetingType[type].total++;
    if (pm.outcome === 'meeting_held') {
      byMeetingType[type].success++;
    }
  }

  // Simple trend analysis
  const recentPms = postmortems.slice(0, Math.floor(postmortems.length / 2));
  const olderPms = postmortems.slice(Math.floor(postmortems.length / 2));

  const recentEfficiency = recentPms.length > 0
    ? recentPms.filter(p => p.outcome === 'meeting_held').length / recentPms.length
    : 0;
  const olderEfficiency = olderPms.length > 0
    ? olderPms.filter(p => p.outcome === 'meeting_held').length / olderPms.length
    : 0;

  const needs_attention: string[] = [];
  if (overview.avgAttempts > 4) needs_attention.push('High average attempt count');
  if (overview.successRate < 0.5) needs_attention.push('Low overall success rate');
  if (byOutcome['no_show'] > postmortems.length * 0.1) needs_attention.push('High no-show rate');

  return {
    overview,
    byOutcome,
    byMeetingType,
    trends: {
      efficiency_improving: recentEfficiency > olderEfficiency,
      most_improved_area: recentEfficiency > olderEfficiency ? 'Overall scheduling efficiency' : '',
      needs_attention,
    },
  };
}
