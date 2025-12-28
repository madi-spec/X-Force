/**
 * Scheduling Integration for Deal Intelligence
 *
 * Connects scheduling patterns and signals to deal intelligence,
 * providing additional confidence factor adjustments based on
 * meeting scheduling behavior.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeSchedulingIntelligence,
  DealSchedulingSignal,
  SchedulingIntelligence,
} from '@/lib/scheduler/schedulingIntelligence';
import { ConfidenceResult } from './confidenceCalculator';

// ============================================
// TYPES
// ============================================

export interface SchedulingConfidenceAdjustment {
  engagement: number;   // Adjustment to add (-50 to +50)
  champion: number;
  authority: number;
  need: number;
  timeline: number;
  signals: DealSchedulingSignal[];
  source_requests: string[];
  computed_at: string;
}

export interface DealSchedulingContext {
  deal_id: string;
  scheduling_requests: SchedulingIntelligence[];
  aggregated_signals: DealSchedulingSignal[];
  scheduling_health: 'healthy' | 'at_risk' | 'critical' | 'unknown';
  avg_success_probability: number;
  has_active_scheduling: boolean;
  has_completed_meetings: boolean;
  total_no_shows: number;
  confidence_adjustments: SchedulingConfidenceAdjustment;
}

// ============================================
// MAIN INTEGRATION FUNCTION
// ============================================

/**
 * Get scheduling context for a deal to integrate with deal intelligence.
 */
export async function getDealSchedulingContext(
  dealId: string
): Promise<DealSchedulingContext | null> {
  const supabase = createAdminClient();

  // Find all scheduling requests for this deal
  const { data: requests, error } = await supabase
    .from('scheduling_requests')
    .select('id, status, no_show_count, scheduled_time')
    .eq('deal_id', dealId);

  if (error || !requests || requests.length === 0) {
    return null;
  }

  // Compute intelligence for each request
  const intelligenceResults: SchedulingIntelligence[] = [];
  const allSignals: DealSchedulingSignal[] = [];

  for (const req of requests) {
    const intelligence = await computeSchedulingIntelligence(req.id);
    if (intelligence) {
      intelligenceResults.push(intelligence);
      allSignals.push(...intelligence.deal_signals);
    }
  }

  if (intelligenceResults.length === 0) {
    return null;
  }

  // Aggregate health
  const healthCounts = intelligenceResults.reduce(
    (acc, i) => {
      acc[i.scheduling_health]++;
      return acc;
    },
    { healthy: 0, at_risk: 0, critical: 0 } as Record<string, number>
  );

  let aggregatedHealth: 'healthy' | 'at_risk' | 'critical' | 'unknown' = 'unknown';
  if (healthCounts.critical > 0) aggregatedHealth = 'critical';
  else if (healthCounts.at_risk > healthCounts.healthy) aggregatedHealth = 'at_risk';
  else if (healthCounts.healthy > 0) aggregatedHealth = 'healthy';

  // Calculate averages
  const avgProbability = intelligenceResults.reduce(
    (sum, i) => sum + i.success_probability, 0
  ) / intelligenceResults.length;

  // Check for active scheduling and completed meetings
  const hasActive = requests.some(r =>
    !['completed', 'cancelled', 'confirmed'].includes(r.status)
  );
  const hasCompleted = requests.some(r =>
    r.status === 'completed'
  );

  // Sum no-shows
  const totalNoShows = requests.reduce((sum, r) => sum + (r.no_show_count || 0), 0);

  // Calculate confidence adjustments
  const confidenceAdjustments = calculateConfidenceAdjustments(allSignals);

  return {
    deal_id: dealId,
    scheduling_requests: intelligenceResults,
    aggregated_signals: allSignals,
    scheduling_health: aggregatedHealth,
    avg_success_probability: Math.round(avgProbability),
    has_active_scheduling: hasActive,
    has_completed_meetings: hasCompleted,
    total_no_shows: totalNoShows,
    confidence_adjustments: {
      ...confidenceAdjustments,
      signals: allSignals,
      source_requests: requests.map(r => r.id),
      computed_at: new Date().toISOString(),
    },
  };
}

// ============================================
// CONFIDENCE ADJUSTMENT CALCULATION
// ============================================

/**
 * Calculate adjustments to confidence factors based on scheduling signals.
 * Returns values to ADD to base confidence calculations.
 */
function calculateConfidenceAdjustments(
  signals: DealSchedulingSignal[]
): Omit<SchedulingConfidenceAdjustment, 'signals' | 'source_requests' | 'computed_at'> {
  const adjustments = {
    engagement: 0,
    champion: 0,
    authority: 0,
    need: 0,
    timeline: 0,
  };

  // Group signals by factor
  const signalsByFactor: Record<string, DealSchedulingSignal[]> = {
    engagement: [],
    champion: [],
    authority: [],
    need: [],
    timeline: [],
  };

  for (const signal of signals) {
    if (signalsByFactor[signal.for_deal_factor]) {
      signalsByFactor[signal.for_deal_factor].push(signal);
    }
  }

  // Calculate adjustment for each factor
  for (const [factor, factorSignals] of Object.entries(signalsByFactor)) {
    let adjustment = 0;

    for (const signal of factorSignals) {
      // Base impact: +/- 10 points
      const baseImpact = signal.impact === 'positive' ? 10 : -10;
      // Scale by confidence (0-1)
      const scaledImpact = baseImpact * signal.confidence;
      adjustment += scaledImpact;
    }

    // Clamp adjustment to reasonable bounds
    adjustment = Math.max(-30, Math.min(30, adjustment));

    adjustments[factor as keyof typeof adjustments] = Math.round(adjustment);
  }

  return adjustments;
}

// ============================================
// ENHANCED CONFIDENCE CALCULATION
// ============================================

/**
 * Apply scheduling adjustments to base confidence results.
 * Call this after calculateConfidence() to get enhanced scores.
 */
export function applySchedulingAdjustments(
  baseConfidence: ConfidenceResult,
  adjustments: SchedulingConfidenceAdjustment
): ConfidenceResult {
  return {
    engagement: clamp(baseConfidence.engagement + adjustments.engagement, 0, 100),
    champion: clamp(baseConfidence.champion + adjustments.champion, 0, 100),
    authority: clamp(baseConfidence.authority + adjustments.authority, 0, 100),
    need: clamp(baseConfidence.need + adjustments.need, 0, 100),
    timeline: clamp(baseConfidence.timeline + adjustments.timeline, 0, 100),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================
// BATCH PROCESSING
// ============================================

/**
 * Get scheduling context for multiple deals efficiently.
 */
export async function getBatchDealSchedulingContext(
  dealIds: string[]
): Promise<Map<string, DealSchedulingContext>> {
  const results = new Map<string, DealSchedulingContext>();

  // Process in parallel but with concurrency limit
  const BATCH_SIZE = 5;

  for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
    const batch = dealIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(id => getDealSchedulingContext(id))
    );

    batchResults.forEach((result, idx) => {
      if (result) {
        results.set(batch[idx], result);
      }
    });
  }

  return results;
}

// ============================================
// SIGNAL INTERPRETATION
// ============================================

/**
 * Get human-readable interpretation of scheduling signals for a deal.
 */
export function interpretSchedulingSignals(
  context: DealSchedulingContext
): string[] {
  const interpretations: string[] = [];

  // Health status
  switch (context.scheduling_health) {
    case 'healthy':
      interpretations.push('Scheduling engagement is positive');
      break;
    case 'at_risk':
      interpretations.push('Scheduling shows signs of difficulty');
      break;
    case 'critical':
      interpretations.push('Significant scheduling challenges detected');
      break;
  }

  // Completed meetings
  if (context.has_completed_meetings) {
    interpretations.push('Has completed scheduled meetings');
  }

  // No-shows
  if (context.total_no_shows > 0) {
    interpretations.push(`${context.total_no_shows} no-show(s) on record`);
  }

  // Key signals
  for (const signal of context.aggregated_signals) {
    if (signal.confidence >= 0.7) {
      interpretations.push(signal.signal);
    }
  }

  return interpretations;
}

// ============================================
// SCHEDULING HEALTH SUMMARY
// ============================================

/**
 * Generate a brief summary of scheduling health for deal cards/lists.
 */
export function getSchedulingHealthSummary(
  context: DealSchedulingContext
): {
  status: 'good' | 'warning' | 'danger' | 'neutral';
  label: string;
  tooltip: string;
} {
  if (context.has_completed_meetings && context.total_no_shows === 0) {
    return {
      status: 'good',
      label: 'Met',
      tooltip: 'Successfully completed scheduled meetings',
    };
  }

  if (context.total_no_shows >= 2) {
    return {
      status: 'danger',
      label: 'No-shows',
      tooltip: `${context.total_no_shows} no-shows recorded`,
    };
  }

  if (context.scheduling_health === 'critical') {
    return {
      status: 'danger',
      label: 'At risk',
      tooltip: 'Scheduling is facing significant challenges',
    };
  }

  if (context.scheduling_health === 'at_risk') {
    return {
      status: 'warning',
      label: 'Needs attention',
      tooltip: 'Scheduling engagement could improve',
    };
  }

  if (context.has_active_scheduling) {
    return {
      status: 'neutral',
      label: 'Scheduling',
      tooltip: 'Meeting scheduling in progress',
    };
  }

  return {
    status: 'neutral',
    label: '-',
    tooltip: 'No scheduling data',
  };
}
