/**
 * Trigger Detection
 *
 * Detects when human intervention is needed based on deal signals.
 * Each trigger type has specific detection logic and confidence calculation.
 *
 * Trigger Types:
 * - relationship_repair: No inbound 10+ days + 2+ outbound attempts
 * - exec_intro: Authority confidence <50% + not prospecting
 * - competitive_threat: Competitor mentions + evaluation/proposal stage
 * - pricing_exception: Price objection + high-value deal
 */

import { DealIntelligence } from '../intelligence';
import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export type TriggerType =
  | 'relationship_repair'
  | 'exec_intro'
  | 'competitive_threat'
  | 'pricing_exception';

export type UrgencyLevel = 'immediate' | 'today' | 'this_week' | 'before_next_milestone';
export type RequiredRole = 'rep' | 'sales_manager' | 'exec' | 'founder';

export interface TriggerResult {
  triggered: boolean;
  type: TriggerType;
  confidence: number;
  confidenceLow: number;
  confidenceHigh: number;
  urgency: UrgencyLevel;
  requiredRole: RequiredRole;
  signalSources: string[];
  dataPoints: Record<string, unknown>;
}

export interface TriggerContext {
  dealId: string;
  companyId: string;
  intelligence: DealIntelligence;
  deal: {
    stage: string;
    estimated_value: number;
    competitor_mentioned: string | null;
    expected_close_date: string | null;
  };
  recentActivities: Array<{
    type: string;
    direction: string | null;
    occurred_at: string;
  }>;
  contacts: Array<{
    role: string | null;
    title: string | null;
  }>;
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

export async function detectTriggers(context: TriggerContext): Promise<TriggerResult[]> {
  const triggers: TriggerResult[] = [];

  // Check each trigger type
  const relationshipRepair = detectRelationshipRepair(context);
  if (relationshipRepair.triggered) triggers.push(relationshipRepair);

  const execIntro = detectExecIntro(context);
  if (execIntro.triggered) triggers.push(execIntro);

  const competitiveThreat = detectCompetitiveThreat(context);
  if (competitiveThreat.triggered) triggers.push(competitiveThreat);

  const pricingException = await detectPricingException(context);
  if (pricingException.triggered) triggers.push(pricingException);

  // Sort by confidence (highest first)
  triggers.sort((a, b) => b.confidence - a.confidence);

  return triggers;
}

// ============================================
// RELATIONSHIP REPAIR
// No inbound 10+ days + 2+ outbound attempts
// ============================================

function detectRelationshipRepair(context: TriggerContext): TriggerResult {
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Count recent activities
  const recentActivities = context.recentActivities.filter(
    (a) => new Date(a.occurred_at) >= tenDaysAgo
  );

  const inboundCount = recentActivities.filter((a) => a.direction === 'inbound').length;
  const outboundCount = recentActivities.filter((a) => a.direction === 'outbound').length;

  // Find last inbound activity
  const lastInbound = context.recentActivities
    .filter((a) => a.direction === 'inbound')
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];

  const daysSinceInbound = lastInbound
    ? Math.floor((now.getTime() - new Date(lastInbound.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Detection logic - MVP: Also trigger for stalling/dead momentum without activities
  const noRecentInbound = daysSinceInbound >= 10;
  const multipleOutbound = outboundCount >= 2;
  const hasNoActivitiesAndStalling = context.recentActivities.length === 0 &&
    ['stalling', 'dead'].includes(context.intelligence.momentum || '');

  const triggered = (noRecentInbound && multipleOutbound) || hasNoActivitiesAndStalling;

  // Calculate confidence
  let confidence = 60;
  if (daysSinceInbound >= 21) confidence += 20;
  else if (daysSinceInbound >= 14) confidence += 10;

  if (outboundCount >= 4) confidence += 15;
  else if (outboundCount >= 3) confidence += 10;

  // Momentum affects confidence
  if (context.intelligence.momentum === 'dead') confidence += 10;
  else if (context.intelligence.momentum === 'stalling') confidence += 5;

  confidence = Math.min(95, confidence);
  const confidenceLow = Math.max(50, confidence - 15);
  const confidenceHigh = Math.min(95, confidence + 10);

  // Determine urgency
  let urgency: UrgencyLevel = 'this_week';
  if (daysSinceInbound >= 21) urgency = 'today';
  if (daysSinceInbound >= 30) urgency = 'immediate';

  return {
    triggered,
    type: 'relationship_repair',
    confidence,
    confidenceLow,
    confidenceHigh,
    urgency,
    requiredRole: 'rep',
    signalSources: [
      `No inbound activity in ${daysSinceInbound} days`,
      `${outboundCount} outbound attempts without response`,
    ],
    dataPoints: {
      daysSinceInbound,
      outboundCount,
      inboundCount,
      momentum: context.intelligence.momentum,
    },
  };
}

// ============================================
// EXEC INTRO
// Authority confidence <50% + not prospecting
// ============================================

function detectExecIntro(context: TriggerContext): TriggerResult {
  const { intelligence, deal, contacts } = context;

  // Detection logic - MVP: Low authority is the key signal
  // Stages: new_lead -> qualifying -> discovery -> demo -> data_review -> trial -> negotiation
  const lowAuthority = intelligence.confidence_authority < 50;
  const veryLowAuthority = intelligence.confidence_authority < 30;
  const earlyStages = ['new_lead', 'qualifying'];
  const pastProspecting = !earlyStages.includes(deal.stage);
  const noDecisionMaker = !contacts.some(
    (c) => c.role === 'decision_maker' ||
    (c.title && ['owner', 'ceo', 'president', 'founder', 'vp', 'director'].some(t =>
      c.title?.toLowerCase().includes(t)
    ))
  );

  // Trigger if: (low authority + past prospecting + no DM) OR (very low authority + past prospecting)
  const triggered = (lowAuthority && pastProspecting && noDecisionMaker) ||
                   (veryLowAuthority && pastProspecting);

  // Calculate confidence
  let confidence = 65;
  if (intelligence.confidence_authority < 30) confidence += 15;
  else if (intelligence.confidence_authority < 40) confidence += 10;

  if (['demo', 'data_review', 'trial', 'negotiation'].includes(deal.stage)) {
    confidence += 10;
  }

  if (intelligence.confidence_champion >= 60) confidence += 10; // Have champion but not exec

  confidence = Math.min(95, confidence);
  const confidenceLow = Math.max(55, confidence - 15);
  const confidenceHigh = Math.min(95, confidence + 10);

  // Determine urgency based on stage
  let urgency: UrgencyLevel = 'this_week';
  if (deal.stage === 'negotiation') urgency = 'immediate';
  else if (deal.stage === 'trial') urgency = 'today';

  return {
    triggered,
    type: 'exec_intro',
    confidence,
    confidenceLow,
    confidenceHigh,
    urgency,
    requiredRole: intelligence.confidence_champion >= 50 ? 'rep' : 'sales_manager',
    signalSources: [
      `Authority confidence at ${intelligence.confidence_authority}%`,
      `Deal in ${deal.stage} stage without decision maker access`,
    ],
    dataPoints: {
      authorityConfidence: intelligence.confidence_authority,
      championConfidence: intelligence.confidence_champion,
      stage: deal.stage,
      contactCount: contacts.length,
    },
  };
}

// ============================================
// COMPETITIVE THREAT
// Competitor mentions + evaluation/proposal stage
// ============================================

function detectCompetitiveThreat(context: TriggerContext): TriggerResult {
  const { deal, intelligence } = context;

  // Detection logic
  const hasCompetitor = !!deal.competitor_mentioned;
  const evaluationStages = ['demo', 'data_review', 'trial', 'negotiation'];
  const inEvaluationStage = evaluationStages.includes(deal.stage);

  const triggered = hasCompetitor && inEvaluationStage;

  // Calculate confidence
  let confidence = 70;

  // Higher confidence in later stages
  if (deal.stage === 'negotiation') confidence += 10;
  else if (deal.stage === 'trial') confidence += 5;

  // Stalling momentum increases threat
  if (intelligence.momentum === 'stalling') confidence += 10;
  else if (intelligence.momentum === 'dead') confidence += 15;

  // Low timeline confidence suggests they may be evaluating alternatives
  if (intelligence.confidence_timeline < 40) confidence += 5;

  confidence = Math.min(85, confidence);
  const confidenceLow = Math.max(60, confidence - 10);
  const confidenceHigh = Math.min(90, confidence + 5);

  // Urgency based on stage
  let urgency: UrgencyLevel = 'this_week';
  if (deal.stage === 'negotiation') urgency = 'immediate';
  else if (deal.stage === 'trial') urgency = 'today';

  return {
    triggered,
    type: 'competitive_threat',
    confidence,
    confidenceLow,
    confidenceHigh,
    urgency,
    requiredRole: 'rep',
    signalSources: [
      `Competitor "${deal.competitor_mentioned}" mentioned`,
      `Deal in ${deal.stage} stage`,
    ],
    dataPoints: {
      competitor: deal.competitor_mentioned,
      stage: deal.stage,
      momentum: intelligence.momentum,
      timelineConfidence: intelligence.confidence_timeline,
    },
  };
}

// ============================================
// PRICING EXCEPTION
// Price objection + high-value deal
// ============================================

async function detectPricingException(context: TriggerContext): Promise<TriggerResult> {
  const { deal, intelligence, companyId } = context;
  const supabase = createAdminClient();

  // Check for price-related objections in recent activities
  const { data: recentActivities } = await supabase
    .from('activities')
    .select('body, subject, metadata')
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false })
    .limit(20);

  const priceKeywords = ['price', 'cost', 'budget', 'expensive', 'afford', 'discount', 'cheaper'];
  const hasPriceObjection = (recentActivities || []).some((a) => {
    const text = `${a.subject || ''} ${a.body || ''}`.toLowerCase();
    return priceKeywords.some((kw) => text.includes(kw));
  });

  // High value deal threshold
  const highValueThreshold = 25000;
  const isHighValue = deal.estimated_value >= highValueThreshold ||
                      intelligence.estimated_acv >= highValueThreshold;

  const triggered = hasPriceObjection && isHighValue;

  // Calculate confidence
  let confidence = 65;

  // Higher value = higher confidence we should consider exception
  if (intelligence.estimated_acv >= 50000) confidence += 15;
  else if (intelligence.estimated_acv >= 35000) confidence += 10;

  // Good momentum despite price objection = worth saving
  if (intelligence.momentum === 'stable') confidence += 5;
  else if (intelligence.momentum === 'accelerating') confidence += 10;

  // Strong champion = they're fighting for us
  if (intelligence.confidence_champion >= 70) confidence += 10;

  confidence = Math.min(80, confidence);
  const confidenceLow = Math.max(55, confidence - 10);
  const confidenceHigh = Math.min(85, confidence + 5);

  return {
    triggered,
    type: 'pricing_exception',
    confidence,
    confidenceLow,
    confidenceHigh,
    urgency: 'this_week',
    requiredRole: 'sales_manager',
    signalSources: [
      'Price objection detected in recent communications',
      `High-value deal: $${intelligence.estimated_acv.toLocaleString()} ACV`,
    ],
    dataPoints: {
      estimatedAcv: intelligence.estimated_acv,
      expectedValue: intelligence.expected_value,
      hasPriceObjection,
      championConfidence: intelligence.confidence_champion,
      momentum: intelligence.momentum,
    },
  };
}

// ============================================
// HELPER: Get all triggers for a deal
// ============================================

export async function getTriggerContext(dealId: string): Promise<TriggerContext | null> {
  const supabase = createAdminClient();

  // Fetch deal
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      company_id,
      stage,
      estimated_value,
      competitor_mentioned,
      expected_close_date
    `)
    .eq('id', dealId)
    .single();

  if (!deal) return null;

  // Fetch intelligence
  const { data: intelligence } = await supabase
    .from('deal_intelligence')
    .select('*')
    .eq('deal_id', dealId)
    .single();

  if (!intelligence) return null;

  // Fetch recent activities (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: activities } = await supabase
    .from('activities')
    .select('type, sentiment, occurred_at')
    .eq('deal_id', dealId)
    .gte('occurred_at', thirtyDaysAgo.toISOString())
    .order('occurred_at', { ascending: false });

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('role, title')
    .eq('company_id', deal.company_id);

  // Map activities to include direction
  const recentActivities = (activities || []).map((a) => ({
    type: a.type,
    direction: inferDirection(a.type),
    occurred_at: a.occurred_at,
  }));

  return {
    dealId,
    companyId: deal.company_id,
    intelligence: intelligence as DealIntelligence,
    deal: {
      stage: deal.stage,
      estimated_value: deal.estimated_value || 0,
      competitor_mentioned: deal.competitor_mentioned,
      expected_close_date: deal.expected_close_date,
    },
    recentActivities,
    contacts: contacts || [],
  };
}

function inferDirection(activityType: string): 'inbound' | 'outbound' | null {
  switch (activityType) {
    case 'email_received':
      return 'inbound';
    case 'email_sent':
    case 'call_made':
    case 'proposal_sent':
      return 'outbound';
    default:
      return null;
  }
}
