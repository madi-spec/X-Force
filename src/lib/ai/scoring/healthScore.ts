import { createClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

export interface HealthScoreResult {
  overall: number; // 0-100

  components: {
    engagement: ComponentScore;
    velocity: ComponentScore;
    stakeholder: ComponentScore;
    activity: ComponentScore;
    sentiment: ComponentScore;
  };

  trend: 'improving' | 'stable' | 'declining';
  changeFromLast: number;

  riskFactors: string[];
  positiveFactors: string[];

  recommendation: string;
}

export interface ComponentScore {
  score: number;
  weight: number;
  factors: string[];
}

interface DealWithRelations {
  id: string;
  name: string;
  stage: string;
  estimated_value: number | null;
  health_score: number | null;
  stage_entered_at: string | null;
  created_at: string;
  close_date: string | null;
  company_id: string | null;
  company?: {
    name: string;
    segment: string | null;
  } | null;
  activities?: Activity[];
  contacts?: Array<{
    contact: {
      id: string;
      name: string;
      title: string | null;
      role: string | null;
    };
    is_primary: boolean;
  }>;
}

interface Activity {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  summary: string | null;
  occurred_at: string;
  sentiment: string | null;
  metadata: any;
}

// ============================================
// CONFIGURATION
// ============================================

const WEIGHTS = {
  engagement: 0.25,
  velocity: 0.20,
  stakeholder: 0.20,
  activity: 0.20,
  sentiment: 0.15,
};

// Expected days in each stage (pest control sales cycle)
const STAGE_BENCHMARKS: Record<string, number> = {
  new_lead: 5,
  qualifying: 7,
  discovery: 10,
  demo: 10,
  data_review: 7,
  trial: 21,
  negotiation: 14,
  closed_won: 0,
  closed_lost: 0,
};

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Calculate comprehensive health score for a deal
 */
export async function calculateDealHealth(dealId: string): Promise<HealthScoreResult> {
  const supabase = await createClient();

  // Fetch deal with all related data (except contacts - fetched separately)
  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(name, segment),
      activities:activities(
        id,
        type,
        subject,
        body,
        summary,
        occurred_at,
        sentiment,
        metadata
      )
    `)
    .eq('id', dealId)
    .single();

  if (error || !deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  // Fetch contacts via company (deal_contacts table doesn't exist)
  let contacts: DealWithRelations['contacts'] = [];
  if (deal.company_id) {
    const { data: companyContacts } = await supabase
      .from('contacts')
      .select('id, name, title, role')
      .eq('company_id', deal.company_id);

    if (companyContacts) {
      contacts = companyContacts.map((c, idx) => ({
        is_primary: idx === 0, // First contact treated as primary
        contact: c,
      }));
    }
  }

  // Sort activities by date (most recent first)
  const activities = (deal.activities || []).sort(
    (a: Activity, b: Activity) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  // Calculate component scores
  const engagement = calculateEngagementScore(activities);
  const velocity = calculateVelocityScore(deal);
  const stakeholder = calculateStakeholderScore(contacts, deal.company?.segment);
  const activity = calculateActivityScore(activities);
  const sentiment = calculateSentimentScore(activities);

  // Calculate weighted overall score
  const overall = Math.round(
    engagement.score * WEIGHTS.engagement +
      velocity.score * WEIGHTS.velocity +
      stakeholder.score * WEIGHTS.stakeholder +
      activity.score * WEIGHTS.activity +
      sentiment.score * WEIGHTS.sentiment
  );

  // Collect all factors
  const riskFactors = [
    ...engagement.factors.filter((f) => f.startsWith('⚠')),
    ...velocity.factors.filter((f) => f.startsWith('⚠')),
    ...stakeholder.factors.filter((f) => f.startsWith('⚠')),
    ...activity.factors.filter((f) => f.startsWith('⚠')),
    ...sentiment.factors.filter((f) => f.startsWith('⚠')),
  ];

  const positiveFactors = [
    ...engagement.factors.filter((f) => f.startsWith('✓')),
    ...velocity.factors.filter((f) => f.startsWith('✓')),
    ...stakeholder.factors.filter((f) => f.startsWith('✓')),
    ...activity.factors.filter((f) => f.startsWith('✓')),
    ...sentiment.factors.filter((f) => f.startsWith('✓')),
  ];

  // Calculate trend from history
  const { trend, changeFromLast } = await calculateTrend(supabase, dealId, overall);

  // Generate recommendation
  const recommendation = generateRecommendation(overall, riskFactors, deal.stage);

  // Save to history
  await saveHealthHistory(supabase, dealId, {
    overall,
    engagement: engagement.score,
    velocity: velocity.score,
    stakeholder: stakeholder.score,
    activity: activity.score,
    sentiment: sentiment.score,
    trend,
    changeFromLast,
    riskFactors,
    positiveFactors,
  });

  // Update deal's health_score
  await supabase
    .from('deals')
    .update({
      health_score: overall,
      health_updated_at: new Date().toISOString(),
      health_trend: trend,
    })
    .eq('id', dealId);

  return {
    overall,
    components: {
      engagement: { ...engagement, weight: WEIGHTS.engagement },
      velocity: { ...velocity, weight: WEIGHTS.velocity },
      stakeholder: { ...stakeholder, weight: WEIGHTS.stakeholder },
      activity: { ...activity, weight: WEIGHTS.activity },
      sentiment: { ...sentiment, weight: WEIGHTS.sentiment },
    },
    trend,
    changeFromLast,
    riskFactors,
    positiveFactors,
    recommendation,
  };
}

// ============================================
// COMPONENT CALCULATORS
// ============================================

function calculateEngagementScore(activities: Activity[]): Omit<ComponentScore, 'weight'> {
  const factors: string[] = [];
  let score = 50;

  // Days since last activity
  if (activities.length === 0) {
    score = 20;
    factors.push('⚠ No activity recorded');
    return { score, factors };
  }

  const lastActivity = activities[0];
  const daysSinceContact = Math.floor(
    (Date.now() - new Date(lastActivity.occurred_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceContact <= 2) {
    score += 30;
    factors.push('✓ Recent contact (within 2 days)');
  } else if (daysSinceContact <= 5) {
    score += 20;
    factors.push('✓ Active engagement (within 5 days)');
  } else if (daysSinceContact <= 7) {
    score += 5;
    factors.push('✓ Contact within past week');
  } else if (daysSinceContact <= 14) {
    score -= 15;
    factors.push(`⚠ ${daysSinceContact} days since last contact`);
  } else {
    score -= 30;
    factors.push(`⚠ No contact in ${daysSinceContact} days - deal going cold`);
  }

  // Email responses in last 2 weeks
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentEmails = activities.filter(
    (a) =>
      a.type === 'email_received' && new Date(a.occurred_at).getTime() > twoWeeksAgo
  );

  if (recentEmails.length >= 3) {
    score += 15;
    factors.push('✓ Active email engagement (3+ responses in 2 weeks)');
  } else if (recentEmails.length === 0 && daysSinceContact > 7) {
    score -= 10;
    factors.push('⚠ No email responses in 2 weeks');
  }

  // Meetings in last 2 weeks
  const recentMeetings = activities.filter(
    (a) => a.type === 'meeting' && new Date(a.occurred_at).getTime() > twoWeeksAgo
  );

  if (recentMeetings.length > 0) {
    score += 10;
    factors.push('✓ Recent meeting activity');
  }

  return { score: clamp(score), factors };
}

function calculateVelocityScore(deal: DealWithRelations): Omit<ComponentScore, 'weight'> {
  const factors: string[] = [];
  let score = 50;

  // Skip for closed deals
  if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
    return { score: 100, factors: ['✓ Deal closed'] };
  }

  // Days in current stage
  const stageEnteredAt = deal.stage_entered_at || deal.created_at;
  const daysInStage = Math.floor(
    (Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const expectedDays = STAGE_BENCHMARKS[deal.stage] || 14;

  if (daysInStage <= expectedDays * 0.5) {
    score += 25;
    factors.push('✓ Moving faster than average');
  } else if (daysInStage <= expectedDays) {
    score += 15;
    factors.push('✓ On track for stage duration');
  } else if (daysInStage <= expectedDays * 1.5) {
    score -= 10;
    factors.push(`⚠ ${daysInStage} days in ${deal.stage.replace('_', ' ')} (expected: ${expectedDays})`);
  } else if (daysInStage <= expectedDays * 2) {
    score -= 25;
    factors.push(`⚠ Stalling: ${daysInStage} days in ${deal.stage.replace('_', ' ')}`);
  } else {
    score -= 35;
    factors.push(`⚠ Stuck: ${daysInStage} days in ${deal.stage.replace('_', ' ')} - needs attention`);
  }

  // Overall deal age vs stage progression
  const dealAge = Math.floor(
    (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const stageOrder = [
    'new_lead',
    'qualifying',
    'discovery',
    'demo',
    'data_review',
    'trial',
    'negotiation',
  ];
  const currentStageIndex = stageOrder.indexOf(deal.stage);
  const expectedStageIndex = Math.min(Math.floor(dealAge / 12), stageOrder.length - 1);

  if (currentStageIndex >= expectedStageIndex) {
    score += 10;
    factors.push('✓ Deal progressing at healthy pace');
  } else if (currentStageIndex < expectedStageIndex - 1) {
    score -= 15;
    factors.push('⚠ Deal progression slower than typical');
  }

  return { score: clamp(score), factors };
}

function calculateStakeholderScore(
  contacts: DealWithRelations['contacts'],
  segment?: string | null
): Omit<ComponentScore, 'weight'> {
  const factors: string[] = [];
  let score = 50;

  const contactList = contacts || [];
  const contactCount = contactList.length;

  // No contacts
  if (contactCount === 0) {
    factors.push('⚠ No contacts linked to deal');
    return { score: 20, factors };
  }

  // Check for decision maker
  const hasDecisionMaker = contactList.some((c) => {
    const title = c.contact.title?.toLowerCase() || '';
    const role = c.contact.role?.toLowerCase() || '';
    return (
      role.includes('decision') ||
      title.includes('owner') ||
      title.includes('ceo') ||
      title.includes('president') ||
      title.includes('vp') ||
      title.includes('director')
    );
  });

  // Check for champion
  const hasChampion = contactList.some(
    (c) => c.is_primary || c.contact.role?.toLowerCase().includes('champion')
  );

  // Enterprise deals need more coverage
  const isEnterprise = segment === 'enterprise' || segment === 'pe_platform';

  if (isEnterprise) {
    // Enterprise scoring
    if (contactCount >= 4 && hasDecisionMaker) {
      score += 30;
      factors.push('✓ Strong stakeholder coverage (4+ contacts including decision maker)');
    } else if (contactCount >= 2 && hasDecisionMaker) {
      score += 15;
      factors.push('✓ Decision maker engaged with supporting contacts');
    } else if (contactCount >= 2) {
      score -= 5;
      factors.push('⚠ No decision maker identified for enterprise deal');
    } else {
      score -= 20;
      factors.push('⚠ Single thread - risky for enterprise deal');
    }
  } else {
    // SMB/Mid-Market scoring
    if (hasDecisionMaker && contactCount >= 2) {
      score += 25;
      factors.push('✓ Decision maker engaged with additional stakeholders');
    } else if (hasDecisionMaker) {
      score += 15;
      factors.push('✓ Decision maker identified');
    } else if (contactCount >= 2) {
      score += 5;
      factors.push('✓ Multiple contacts engaged');
      factors.push('⚠ No decision maker identified yet');
    } else {
      score -= 10;
      factors.push('⚠ Single contact - identify decision maker');
    }
  }

  if (hasChampion) {
    score += 10;
    factors.push('✓ Champion identified');
  }

  return { score: clamp(score), factors };
}

function calculateActivityScore(activities: Activity[]): Omit<ComponentScore, 'weight'> {
  const factors: string[] = [];
  let score = 50;

  if (activities.length === 0) {
    factors.push('⚠ No activity history');
    return { score: 25, factors };
  }

  // Total activity count
  if (activities.length >= 15) {
    score += 15;
    factors.push('✓ Strong activity history (15+ activities)');
  } else if (activities.length >= 8) {
    score += 10;
    factors.push('✓ Good activity history');
  } else if (activities.length < 4) {
    score -= 10;
    factors.push('⚠ Limited activity history');
  }

  // Activity diversity
  const activityTypes = new Set(activities.map((a) => a.type));
  if (activityTypes.size >= 4) {
    score += 10;
    factors.push('✓ Diverse engagement (calls, emails, meetings, etc.)');
  }

  // Response ratio (their activity vs our outreach)
  const ourActivity = activities.filter(
    (a) => a.type === 'email_sent' || a.type === 'call' || a.type === 'meeting'
  ).length;
  const theirActivity = activities.filter((a) => a.type === 'email_received').length;

  if (ourActivity > 0 && theirActivity > 0) {
    const ratio = theirActivity / ourActivity;
    if (ratio >= 0.5) {
      score += 15;
      factors.push('✓ Good response rate from prospect');
    } else if (ratio < 0.2) {
      score -= 15;
      factors.push('⚠ Low response rate - review outreach strategy');
    }
  }

  // Check for meeting in recent activities
  const hasMeeting = activities.slice(0, 10).some((a) => a.type === 'meeting');
  if (hasMeeting) {
    score += 5;
    factors.push('✓ Recent meetings held');
  }

  return { score: clamp(score), factors };
}

function calculateSentimentScore(activities: Activity[]): Omit<ComponentScore, 'weight'> {
  const factors: string[] = [];
  let score = 50;

  const recentActivities = activities.slice(0, 15);

  if (recentActivities.length === 0) {
    return { score: 50, factors: ['Not enough data for sentiment analysis'] };
  }

  // Count sentiment
  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  for (const activity of recentActivities) {
    if (activity.sentiment === 'positive') sentimentCounts.positive++;
    else if (activity.sentiment === 'negative') sentimentCounts.negative++;
    else sentimentCounts.neutral++;
  }

  // Score based on sentiment ratio
  const total = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
  const positiveRatio = sentimentCounts.positive / total;
  const negativeRatio = sentimentCounts.negative / total;

  if (positiveRatio > 0.5) {
    score += 25;
    factors.push('✓ Very positive engagement sentiment');
  } else if (positiveRatio > 0.3) {
    score += 15;
    factors.push('✓ Positive sentiment trend');
  }

  if (negativeRatio > 0.3) {
    score -= 25;
    factors.push('⚠ Negative sentiment detected - address concerns');
  } else if (negativeRatio > 0.1) {
    score -= 10;
    factors.push('⚠ Some negative interactions detected');
  }

  // Look for keywords in summaries/bodies that indicate sentiment
  const allText = recentActivities
    .map((a) => `${a.summary || ''} ${a.body || ''}`)
    .join(' ')
    .toLowerCase();

  const positiveKeywords = [
    'interested',
    'excited',
    'great',
    'love',
    'perfect',
    'yes',
    'agree',
    'moving forward',
    'next steps',
  ];
  const negativeKeywords = [
    'concerned',
    'worried',
    'competitor',
    'budget',
    'delay',
    'not sure',
    'hold',
    'pause',
    'problem',
  ];

  const positiveHits = positiveKeywords.filter((k) => allText.includes(k)).length;
  const negativeHits = negativeKeywords.filter((k) => allText.includes(k)).length;

  if (positiveHits > negativeHits + 2) {
    score += 10;
  } else if (negativeHits > positiveHits + 2) {
    score -= 10;
    factors.push('⚠ Concerns or objections mentioned in communications');
  }

  return { score: clamp(score), factors };
}

// ============================================
// HELPERS
// ============================================

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

async function calculateTrend(
  supabase: any,
  dealId: string,
  currentScore: number
): Promise<{ trend: 'improving' | 'stable' | 'declining'; changeFromLast: number }> {
  // Get previous health score from history (7 days ago)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: history } = await supabase
    .from('deal_health_history')
    .select('overall_score')
    .eq('deal_id', dealId)
    .lt('recorded_at', sevenDaysAgo)
    .order('recorded_at', { ascending: false })
    .limit(1);

  if (!history || history.length === 0) {
    return { trend: 'stable', changeFromLast: 0 };
  }

  const previousScore = history[0].overall_score;
  const change = currentScore - previousScore;

  let trend: 'improving' | 'stable' | 'declining';
  if (change >= 5) {
    trend = 'improving';
  } else if (change <= -5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return { trend, changeFromLast: change };
}

async function saveHealthHistory(
  supabase: any,
  dealId: string,
  data: {
    overall: number;
    engagement: number;
    velocity: number;
    stakeholder: number;
    activity: number;
    sentiment: number;
    trend: 'improving' | 'stable' | 'declining';
    changeFromLast: number;
    riskFactors: string[];
    positiveFactors: string[];
  }
): Promise<void> {
  await supabase.from('deal_health_history').insert({
    deal_id: dealId,
    overall_score: data.overall,
    engagement_score: data.engagement,
    velocity_score: data.velocity,
    stakeholder_score: data.stakeholder,
    activity_score: data.activity,
    sentiment_score: data.sentiment,
    trend: data.trend,
    change_from_last: data.changeFromLast,
    risk_factors: data.riskFactors,
    positive_factors: data.positiveFactors,
    score_breakdown: {
      engagement: data.engagement,
      velocity: data.velocity,
      stakeholder: data.stakeholder,
      activity: data.activity,
      sentiment: data.sentiment,
    },
  });
}

function generateRecommendation(
  score: number,
  riskFactors: string[],
  stage: string
): string {
  // Find the most critical risk
  const criticalRisks = riskFactors.filter(
    (f) => f.includes('No contact') || f.includes('Stuck') || f.includes('going cold')
  );

  if (criticalRisks.length > 0) {
    if (criticalRisks[0].includes('going cold') || criticalRisks[0].includes('No contact')) {
      return 'Immediate action needed: Re-engage with prospect via call or personalized email before deal goes cold.';
    }
    if (criticalRisks[0].includes('Stuck')) {
      return 'Deal stalled in current stage. Schedule a call to identify blockers and define clear next steps.';
    }
  }

  if (score < 40) {
    return 'Deal health is critical. Review all open issues and create an action plan to get back on track.';
  }

  if (score < 60) {
    return 'Deal needs attention. Focus on addressing risk factors and increasing engagement frequency.';
  }

  if (score < 80) {
    const stageActions: Record<string, string> = {
      qualifying: 'Continue qualifying - confirm budget, timeline, and decision process.',
      discovery: 'Good progress. Schedule a demo to showcase relevant solutions.',
      demo: 'Demo stage - ensure all stakeholders see value. Prepare proposal.',
      proposal: 'Proposal sent. Follow up to address any questions or objections.',
      negotiation: 'Active negotiation. Work toward closing timeline and terms.',
      trial: 'Monitor trial engagement and schedule check-in call.',
    };
    return stageActions[stage] || 'Maintain engagement momentum and push toward next milestone.';
  }

  return 'Deal is healthy. Maintain current momentum and keep stakeholders engaged.';
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Recalculate health scores for all open deals
 */
export async function recalculateAllDealHealth(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = await createClient();

  // Get all open deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id')
    .not('stage', 'in', '("closed_won","closed_lost")');

  if (!deals) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const deal of deals) {
    try {
      await calculateDealHealth(deal.id);
      processed++;
    } catch (error) {
      console.error(`Error calculating health for deal ${deal.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}
