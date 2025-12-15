'use server';

import { createClient } from '@/lib/supabase/server';
import type { Deal, Activity, Contact } from '@/types';

// Signal types that can be detected
export type SignalType =
  | 'stale_deal'
  | 'stuck_stage'
  | 'high_engagement'
  | 'champion_identified'
  | 'competitor_mentioned'
  | 'budget_confirmed'
  | 'decision_timeline'
  | 'risk_escalation'
  | 'momentum_shift'
  | 'multi_thread_opportunity';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SignalCategory = 'risk' | 'opportunity' | 'insight' | 'action_needed';

export interface DetectedSignal {
  type: SignalType;
  severity: SignalSeverity;
  category: SignalCategory;
  title: string;
  description: string;
  dealId: string;
  dealName: string;
  companyName?: string;
  suggestedAction?: string;
  metadata: Record<string, unknown>;
  detectedAt: Date;
}

interface SignalRule {
  type: SignalType;
  name: string;
  category: SignalCategory;
  detect: (deal: DealWithRelations) => DetectedSignal | null;
}

interface DealWithRelations extends Omit<Deal, 'company'> {
  activities?: Activity[];
  contacts?: Contact[];
  company?: { id: string; name: string };
}

// Configuration thresholds
const THRESHOLDS = {
  STALE_DAYS: 7,
  STUCK_STAGE_DAYS: 14,
  HIGH_ENGAGEMENT_ACTIVITIES: 5,
  HIGH_ENGAGEMENT_DAYS: 7,
  LARGE_DEAL_THRESHOLD: 50000,
  MULTI_THREAD_MIN_CONTACTS: 3,
};

// Signal detection rules
const signalRules: SignalRule[] = [
  // STALE DEAL - No activity in X days
  {
    type: 'stale_deal',
    name: 'Stale Deal',
    category: 'risk',
    detect: (deal) => {
      if (!deal.activities || deal.activities.length === 0) {
        const daysSinceCreated = daysBetween(new Date(deal.created_at), new Date());
        if (daysSinceCreated > THRESHOLDS.STALE_DAYS) {
          return {
            type: 'stale_deal',
            severity: daysSinceCreated > 21 ? 'critical' : daysSinceCreated > 14 ? 'high' : 'medium',
            category: 'risk',
            title: 'No activity recorded',
            description: `This deal has no activities logged and was created ${daysSinceCreated} days ago.`,
            dealId: deal.id,
            dealName: deal.name,
            companyName: deal.company?.name,
            suggestedAction: 'Log a recent interaction or reach out to re-engage the prospect',
            metadata: { daysSinceCreated, hasActivities: false },
            detectedAt: new Date(),
          };
        }
        return null;
      }

      const lastActivity = deal.activities.sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      )[0];
      const daysSinceActivity = daysBetween(new Date(lastActivity.occurred_at), new Date());

      if (daysSinceActivity > THRESHOLDS.STALE_DAYS) {
        const severity: SignalSeverity =
          daysSinceActivity > 21 ? 'critical' :
          daysSinceActivity > 14 ? 'high' : 'medium';

        return {
          type: 'stale_deal',
          severity,
          category: 'risk',
          title: 'Deal going stale',
          description: `No activity in ${daysSinceActivity} days. Last contact was ${lastActivity.type}: "${lastActivity.subject || 'No subject'}".`,
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company?.name,
          suggestedAction: `Follow up on the ${lastActivity.type} from ${formatDate(lastActivity.occurred_at)}`,
          metadata: {
            daysSinceActivity,
            lastActivityType: lastActivity.type,
            lastActivityDate: lastActivity.occurred_at,
          },
          detectedAt: new Date(),
        };
      }
      return null;
    },
  },

  // STUCK STAGE - Deal in same stage too long
  {
    type: 'stuck_stage',
    name: 'Stuck in Stage',
    category: 'risk',
    detect: (deal) => {
      if (!deal.stage_entered_at) return null;

      const daysInStage = daysBetween(new Date(deal.stage_entered_at), new Date());

      // Different thresholds based on stage
      const stageThresholds: Record<string, number> = {
        'new_lead': 7,
        'qualifying': 10,
        'discovery': 14,
        'demo': 10,
        'data_review': 7,
        'trial': 21,
        'negotiation': 14,
      };

      const threshold = stageThresholds[deal.stage] || THRESHOLDS.STUCK_STAGE_DAYS;

      if (daysInStage > threshold) {
        const severity: SignalSeverity =
          daysInStage > threshold * 2 ? 'critical' :
          daysInStage > threshold * 1.5 ? 'high' : 'medium';

        return {
          type: 'stuck_stage',
          severity,
          category: 'risk',
          title: `Stuck in ${formatStage(deal.stage)}`,
          description: `Deal has been in ${formatStage(deal.stage)} stage for ${daysInStage} days (typical: ${threshold} days).`,
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company?.name,
          suggestedAction: getStageAdvanceAction(deal.stage),
          metadata: {
            daysInStage,
            stage: deal.stage,
            threshold,
            expectedDays: threshold,
          },
          detectedAt: new Date(),
        };
      }
      return null;
    },
  },

  // HIGH ENGAGEMENT - Lots of recent activity (opportunity)
  {
    type: 'high_engagement',
    name: 'High Engagement',
    category: 'opportunity',
    detect: (deal) => {
      if (!deal.activities) return null;

      const recentActivities = deal.activities.filter(a =>
        daysBetween(new Date(a.occurred_at), new Date()) <= THRESHOLDS.HIGH_ENGAGEMENT_DAYS
      );

      if (recentActivities.length >= THRESHOLDS.HIGH_ENGAGEMENT_ACTIVITIES) {
        const activityTypes = [...new Set(recentActivities.map(a => a.type))];

        return {
          type: 'high_engagement',
          severity: 'low',
          category: 'opportunity',
          title: 'High engagement detected',
          description: `${recentActivities.length} activities in the last ${THRESHOLDS.HIGH_ENGAGEMENT_DAYS} days including ${activityTypes.join(', ')}.`,
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company?.name,
          suggestedAction: 'Capitalize on momentum - consider accelerating the timeline or expanding scope',
          metadata: {
            activityCount: recentActivities.length,
            activityTypes,
            periodDays: THRESHOLDS.HIGH_ENGAGEMENT_DAYS,
          },
          detectedAt: new Date(),
        };
      }
      return null;
    },
  },

  // MULTI-THREAD OPPORTUNITY - Only talking to one person
  {
    type: 'multi_thread_opportunity',
    name: 'Multi-thread Opportunity',
    category: 'action_needed',
    detect: (deal) => {
      if (!deal.contacts) return null;

      const contactCount = deal.contacts.length;

      // Large deals need more stakeholders
      const minContacts = deal.estimated_value && deal.estimated_value > THRESHOLDS.LARGE_DEAL_THRESHOLD
        ? THRESHOLDS.MULTI_THREAD_MIN_CONTACTS
        : 2;

      if (contactCount < minContacts && deal.stage !== 'new_lead' && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') {
        return {
          type: 'multi_thread_opportunity',
          severity: deal.estimated_value && deal.estimated_value > THRESHOLDS.LARGE_DEAL_THRESHOLD ? 'high' : 'medium',
          category: 'action_needed',
          title: 'Single-threaded deal',
          description: `Only ${contactCount} contact${contactCount === 1 ? '' : 's'} on a ${deal.estimated_value ? formatCurrency(deal.estimated_value) : 'this'} deal. Multi-threading reduces risk.`,
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company?.name,
          suggestedAction: 'Ask your contact to introduce you to other stakeholders or decision-makers',
          metadata: {
            contactCount,
            dealValue: deal.estimated_value,
            recommendedContacts: minContacts,
          },
          detectedAt: new Date(),
        };
      }
      return null;
    },
  },

  // MOMENTUM SHIFT - Health score dropping
  {
    type: 'momentum_shift',
    name: 'Momentum Shift',
    category: 'risk',
    detect: (deal) => {
      // Check if health trend is declining
      if (deal.health_trend === 'declining' && deal.health_score !== undefined) {
        const severity: SignalSeverity =
          deal.health_score < 30 ? 'critical' :
          deal.health_score < 50 ? 'high' : 'medium';

        return {
          type: 'momentum_shift',
          severity,
          category: 'risk',
          title: 'Deal momentum declining',
          description: `Health score is ${deal.health_score} and trending downward. Take action to re-engage.`,
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company?.name,
          suggestedAction: 'Review recent interactions and identify what may have caused the slowdown',
          metadata: {
            healthScore: deal.health_score,
            healthTrend: deal.health_trend,
          },
          detectedAt: new Date(),
        };
      }
      return null;
    },
  },

  // RISK ESCALATION - Low health + high value
  {
    type: 'risk_escalation',
    name: 'Risk Escalation',
    category: 'risk',
    detect: (deal) => {
      const isHighValue = deal.estimated_value && deal.estimated_value >= THRESHOLDS.LARGE_DEAL_THRESHOLD;
      const isLowHealth = deal.health_score !== undefined && deal.health_score < 50;

      if (isHighValue && isLowHealth) {
        return {
          type: 'risk_escalation',
          severity: deal.health_score! < 30 ? 'critical' : 'high',
          category: 'risk',
          title: 'High-value deal at risk',
          description: `${formatCurrency(deal.estimated_value!)} deal with health score of ${deal.health_score}. Needs immediate attention.`,
          dealId: deal.id,
          dealName: deal.name,
          companyName: deal.company?.name,
          suggestedAction: 'Escalate internally and develop a recovery plan',
          metadata: {
            dealValue: deal.estimated_value,
            healthScore: deal.health_score,
          },
          detectedAt: new Date(),
        };
      }
      return null;
    },
  },
];

/**
 * Detect signals for a single deal
 */
export async function detectDealSignals(dealId: string): Promise<DetectedSignal[]> {
  const supabase = await createClient();

  // Fetch deal with all related data
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name),
      contacts:deal_contacts(
        contact:contacts(*)
      ),
      activities(*)
    `)
    .eq('id', dealId)
    .single();

  if (dealError || !deal) {
    console.error('Error fetching deal for signal detection:', dealError);
    return [];
  }

  // Flatten contacts
  const dealWithRelations: DealWithRelations = {
    ...deal,
    contacts: deal.contacts?.map((dc: { contact: Contact }) => dc.contact) || [],
  };

  // Run all detection rules
  const signals: DetectedSignal[] = [];
  for (const rule of signalRules) {
    try {
      const signal = rule.detect(dealWithRelations);
      if (signal) {
        signals.push(signal);
      }
    } catch (err) {
      console.error(`Error running signal rule ${rule.type}:`, err);
    }
  }

  return signals;
}

/**
 * Detect signals for all open deals
 */
export async function detectAllSignals(): Promise<DetectedSignal[]> {
  const supabase = await createClient();

  // Fetch all open deals
  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name),
      contacts:deal_contacts(
        contact:contacts(*)
      ),
      activities(*)
    `)
    .not('stage', 'in', '("closed_won","closed_lost")');

  if (error || !deals) {
    console.error('Error fetching deals for signal detection:', error);
    return [];
  }

  const allSignals: DetectedSignal[] = [];

  for (const deal of deals) {
    const dealWithRelations: DealWithRelations = {
      ...deal,
      contacts: deal.contacts?.map((dc: { contact: Contact }) => dc.contact) || [],
    };

    for (const rule of signalRules) {
      try {
        const signal = rule.detect(dealWithRelations);
        if (signal) {
          allSignals.push(signal);
        }
      } catch (err) {
        console.error(`Error running signal rule ${rule.type} on deal ${deal.id}:`, err);
      }
    }
  }

  // Sort by severity (critical first) then by detected time
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allSignals.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.detectedAt.getTime() - a.detectedAt.getTime();
  });

  return allSignals;
}

/**
 * Save detected signals to database
 */
export async function saveSignals(signals: DetectedSignal[]): Promise<void> {
  if (signals.length === 0) return;

  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!dbUser) return;

  // Prepare signal records
  const signalRecords = signals.map(signal => ({
    deal_id: signal.dealId,
    user_id: dbUser.id,
    signal_type: signal.type,
    severity: signal.severity,
    category: signal.category,
    title: signal.title,
    description: signal.description,
    suggested_action: signal.suggestedAction,
    metadata: signal.metadata,
    detected_at: signal.detectedAt.toISOString(),
  }));

  // Upsert to avoid duplicates (same deal + type within 24 hours)
  for (const record of signalRecords) {
    // Check for existing recent signal of same type
    const { data: existing } = await supabase
      .from('ai_signals')
      .select('id')
      .eq('deal_id', record.deal_id)
      .eq('signal_type', record.signal_type)
      .eq('is_active', true)
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (!existing) {
      await supabase.from('ai_signals').insert(record);
    }
  }
}

/**
 * Get active signals for display
 */
export async function getActiveSignals(options?: {
  dealId?: string;
  category?: SignalCategory;
  severity?: SignalSeverity;
  limit?: number;
}): Promise<DetectedSignal[]> {
  const supabase = await createClient();

  let query = supabase
    .from('ai_signals')
    .select(`
      *,
      deal:deals(id, name, company:companies(name))
    `)
    .eq('is_active', true)
    .order('severity', { ascending: true })
    .order('detected_at', { ascending: false });

  if (options?.dealId) {
    query = query.eq('deal_id', options.dealId);
  }
  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.severity) {
    query = query.eq('severity', options.severity);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching active signals:', error);
    return [];
  }

  return data.map(row => ({
    type: row.signal_type as SignalType,
    severity: row.severity as SignalSeverity,
    category: row.category as SignalCategory,
    title: row.title,
    description: row.description,
    dealId: row.deal_id,
    dealName: row.deal?.name || 'Unknown Deal',
    companyName: row.deal?.company?.name,
    suggestedAction: row.suggested_action,
    metadata: row.metadata || {},
    detectedAt: new Date(row.detected_at),
  }));
}

/**
 * Dismiss a signal
 */
export async function dismissSignal(signalId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('ai_signals')
    .update({
      is_active: false,
      dismissed_at: new Date().toISOString()
    })
    .eq('id', signalId);
}

// Helper functions
function daysBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatStage(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getStageAdvanceAction(stage: string): string {
  const actions: Record<string, string> = {
    new_lead: 'Schedule a discovery call to qualify the opportunity',
    qualifying: 'Confirm budget, authority, need, and timeline (BANT)',
    discovery: 'Schedule a demo to showcase the solution',
    demo: 'Send data requirements and schedule data review',
    data_review: 'Present findings and propose a trial',
    trial: 'Check in on trial progress and address concerns',
    negotiation: 'Address final objections and send contract',
  };
  return actions[stage] || 'Move the deal forward to the next stage';
}
