import { type Deal, type Activity, type DealStage, type HealthFactors } from '@/types';

// Average days expected in each stage
const STAGE_VELOCITY_BENCHMARKS: Record<DealStage, number> = {
  new_lead: 1,
  qualifying: 3,
  discovery: 5,
  demo: 7,
  data_review: 5,
  trial: 14,
  negotiation: 7,
  closed_won: 0,
  closed_lost: 0,
};

// Weights for each factor (must sum to 100)
const WEIGHTS = {
  engagement_recency: 25,
  stage_velocity: 20,
  stakeholder_coverage: 15,
  activity_quality: 15,
  competitor_risk: 10,
  trial_engagement: 15,
};

interface HealthScoreInput {
  deal: Deal;
  activities: Activity[];
  contactCount: number;
  decisionMakerCount: number;
  trialLogins?: number;
  trialDaysRemaining?: number;
}

export function calculateHealthScore(input: HealthScoreInput): {
  score: number;
  factors: HealthFactors;
} {
  const factors: HealthFactors = {
    engagement_recency: calculateEngagementRecency(input.activities),
    stage_velocity: calculateStageVelocity(input.deal),
    stakeholder_coverage: calculateStakeholderCoverage(
      input.contactCount,
      input.decisionMakerCount,
      input.deal.organization?.segment
    ),
    activity_quality: calculateActivityQuality(input.activities),
    competitor_risk: calculateCompetitorRisk(input.deal, input.activities),
    trial_engagement: calculateTrialEngagement(
      input.deal,
      input.trialLogins,
      input.trialDaysRemaining
    ),
  };

  // Calculate weighted score
  const score = Math.round(
    (factors.engagement_recency * WEIGHTS.engagement_recency +
      factors.stage_velocity * WEIGHTS.stage_velocity +
      factors.stakeholder_coverage * WEIGHTS.stakeholder_coverage +
      factors.activity_quality * WEIGHTS.activity_quality +
      factors.competitor_risk * WEIGHTS.competitor_risk +
      factors.trial_engagement * WEIGHTS.trial_engagement) /
      100
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
  };
}

function calculateEngagementRecency(activities: Activity[]): number {
  if (activities.length === 0) return 20;

  const now = new Date();
  const lastActivity = new Date(activities[0].occurred_at);
  const daysSinceLastActivity = Math.floor(
    (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Score based on days since last meaningful interaction
  if (daysSinceLastActivity <= 1) return 100;
  if (daysSinceLastActivity <= 3) return 90;
  if (daysSinceLastActivity <= 7) return 75;
  if (daysSinceLastActivity <= 14) return 50;
  if (daysSinceLastActivity <= 21) return 30;
  return 10;
}

function calculateStageVelocity(deal: Deal): number {
  const benchmark = STAGE_VELOCITY_BENCHMARKS[deal.stage];
  if (benchmark === 0) return 100; // Closed stages

  const stageEnteredAt = new Date(deal.stage_entered_at);
  const now = new Date();
  const daysInStage = Math.floor(
    (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const ratio = daysInStage / benchmark;

  if (ratio <= 0.5) return 100; // Ahead of schedule
  if (ratio <= 1) return 85; // On track
  if (ratio <= 1.5) return 65; // Slightly behind
  if (ratio <= 2) return 40; // Behind
  return 20; // Significantly behind
}

function calculateStakeholderCoverage(
  contactCount: number,
  decisionMakerCount: number,
  segment?: string
): number {
  // Enterprise deals need more stakeholder coverage
  const isEnterprise = segment === 'enterprise' || segment === 'pe_platform';

  if (isEnterprise) {
    // Enterprise: need multiple decision makers
    if (decisionMakerCount >= 3 && contactCount >= 5) return 100;
    if (decisionMakerCount >= 2 && contactCount >= 3) return 75;
    if (decisionMakerCount >= 1 && contactCount >= 2) return 50;
    return 25;
  } else {
    // SMB/Mid-Market: simpler requirements
    if (decisionMakerCount >= 1 && contactCount >= 2) return 100;
    if (contactCount >= 1) return 70;
    return 30;
  }
}

function calculateActivityQuality(activities: Activity[]): number {
  if (activities.length === 0) return 30;

  const recentActivities = activities.slice(0, 10); // Last 10 activities

  let positiveCount = 0;
  let negativeCount = 0;
  let meetingCount = 0;

  for (const activity of recentActivities) {
    if (activity.sentiment === 'positive') positiveCount++;
    if (activity.sentiment === 'negative') negativeCount++;
    if (activity.type === 'meeting_held') meetingCount++;
  }

  // Calculate base score from sentiment
  const sentimentScore =
    recentActivities.length > 0
      ? ((positiveCount - negativeCount) / recentActivities.length + 1) * 50
      : 50;

  // Bonus for meetings (shows engagement)
  const meetingBonus = Math.min(meetingCount * 5, 20);

  return Math.min(100, Math.max(0, sentimentScore + meetingBonus));
}

function calculateCompetitorRisk(deal: Deal, activities: Activity[]): number {
  // Check if competitor is mentioned in deal
  if (deal.competitor_mentioned) {
    // Having a competitor mentioned reduces score
    return 60;
  }

  // Check activities for competitor mentions (would be extracted by AI in real implementation)
  // For now, return high score if no competitor
  return 100;
}

function calculateTrialEngagement(
  deal: Deal,
  trialLogins?: number,
  trialDaysRemaining?: number
): number {
  // Only relevant for trial stage
  if (deal.stage !== 'trial') return 80; // Neutral for non-trial stages

  if (!deal.trial_start_date) return 50;

  // If we have login data
  if (trialLogins !== undefined) {
    if (trialLogins >= 10) return 100;
    if (trialLogins >= 5) return 80;
    if (trialLogins >= 2) return 60;
    if (trialLogins >= 1) return 40;
    return 20;
  }

  // If no login data, base on time remaining
  if (trialDaysRemaining !== undefined) {
    if (trialDaysRemaining > 7) return 70;
    if (trialDaysRemaining > 3) return 50;
    return 30; // Trial ending soon with no data
  }

  return 50;
}

// Recalculate health score for a deal
export async function recalculateHealthScore(
  supabase: any,
  dealId: string
): Promise<{ score: number; factors: HealthFactors }> {
  // Fetch deal with organization
  const { data: deal } = await supabase
    .from('deals')
    .select('*, organization:organizations(segment)')
    .eq('id', dealId)
    .single();

  if (!deal) {
    throw new Error('Deal not found');
  }

  // Fetch recent activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false })
    .limit(20);

  // Fetch contacts for stakeholder coverage
  const { data: contacts } = await supabase
    .from('contacts')
    .select('role')
    .eq('organization_id', deal.organization_id);

  const contactCount = contacts?.length || 0;
  const decisionMakerCount =
    contacts?.filter((c: any) => c.role === 'decision_maker').length || 0;

  const result = calculateHealthScore({
    deal,
    activities: activities || [],
    contactCount,
    decisionMakerCount,
  });

  // Update deal with new health score
  await supabase
    .from('deals')
    .update({
      health_score: result.score,
      health_factors: result.factors,
    })
    .eq('id', dealId);

  return result;
}
