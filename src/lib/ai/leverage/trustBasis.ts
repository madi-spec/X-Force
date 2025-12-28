/**
 * Trust Basis
 *
 * Every recommendation includes historical accuracy.
 * This builds rep trust by showing WHY they should listen.
 *
 * "In 78% of deals that went dark for 10+ days, a direct call re-engaged the prospect"
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { TriggerType, TriggerResult } from './triggerDetection';

// ============================================
// TYPES
// ============================================

export interface TrustBasis {
  historicalAccuracy: number; // Percentage
  accuracyLabel: string; // "78% accuracy"
  similarOutcomes: string; // "In 78% of similar situations..."
  signalSources: string[];
  dataPoints: Array<{
    label: string;
    value: string;
  }>;
  sampleSize: number; // How many similar cases
}

// ============================================
// DEFAULT BASELINES
// These are used when we don't have enough historical data
// ============================================

const DEFAULT_BASELINES: Record<TriggerType, { accuracy: number; outcome: string }> = {
  relationship_repair: {
    accuracy: 72,
    outcome: 'deals that went dark for 10+ days, a direct call re-engaged the prospect',
  },
  exec_intro: {
    accuracy: 68,
    outcome: 'deals without exec access past discovery, getting an intro improved win rate',
  },
  competitive_threat: {
    accuracy: 65,
    outcome: 'competitive situations, addressing the threat directly improved outcomes',
  },
  pricing_exception: {
    accuracy: 58,
    outcome: 'price objections on high-value deals, a strategic discount closed the deal',
  },
};

// Minimum sample size before we trust historical data over baselines
const MIN_SAMPLE_SIZE = 20;

// ============================================
// MAIN FUNCTION
// ============================================

export async function buildTrustBasis(trigger: TriggerResult): Promise<TrustBasis> {
  const supabase = createAdminClient();

  // Get historical accuracy for this trigger type
  const { data: accuracy } = await supabase
    .from('trigger_accuracy')
    .select('*')
    .eq('trigger_type', trigger.type)
    .single();

  // Get count of similar completed moments
  const { count: sampleSize } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true })
    .eq('type', trigger.type)
    .in('status', ['completed', 'dismissed'])
    .not('outcome', 'is', null);

  // Determine if we have enough data to use historical accuracy
  const hasEnoughData = (sampleSize || 0) >= MIN_SAMPLE_SIZE && accuracy;

  let historicalAccuracy: number;
  let similarOutcomes: string;

  if (hasEnoughData && accuracy.accuracy_rate) {
    historicalAccuracy = Math.round(accuracy.accuracy_rate * 100);
    similarOutcomes = `In ${historicalAccuracy}% of similar situations we flagged, taking action led to a positive outcome`;
  } else {
    // Use baseline
    const baseline = DEFAULT_BASELINES[trigger.type];
    historicalAccuracy = baseline.accuracy;
    similarOutcomes = `In ${baseline.accuracy}% of ${baseline.outcome}`;
  }

  // Build data points from trigger
  const dataPoints = Object.entries(trigger.dataPoints)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 5)
    .map(([key, value]) => ({
      label: formatLabel(key),
      value: formatValue(value),
    }));

  return {
    historicalAccuracy,
    accuracyLabel: `${historicalAccuracy}% accuracy`,
    similarOutcomes,
    signalSources: trigger.signalSources,
    dataPoints,
    sampleSize: sampleSize || 0,
  };
}

// ============================================
// HELPER: Update accuracy after outcome
// ============================================

export async function updateTriggerAccuracy(
  triggerType: TriggerType,
  wasSuccessful: boolean
): Promise<void> {
  const supabase = createAdminClient();

  // Get current accuracy record
  const { data: current } = await supabase
    .from('trigger_accuracy')
    .select('*')
    .eq('trigger_type', triggerType)
    .single();

  if (!current) {
    // Create new record
    await supabase.from('trigger_accuracy').insert({
      trigger_type: triggerType,
      total_fired: 1,
      total_completed: 1,
      total_successful: wasSuccessful ? 1 : 0,
      accuracy_rate: wasSuccessful ? 1.0 : 0.0,
      period_start: new Date().toISOString(),
    });
    return;
  }

  // Update existing record
  const newTotalCompleted = (current.total_completed || 0) + 1;
  const newTotalSuccessful = (current.total_successful || 0) + (wasSuccessful ? 1 : 0);
  const newAccuracyRate = newTotalSuccessful / newTotalCompleted;

  await supabase
    .from('trigger_accuracy')
    .update({
      total_completed: newTotalCompleted,
      total_successful: newTotalSuccessful,
      accuracy_rate: newAccuracyRate,
      updated_at: new Date().toISOString(),
    })
    .eq('trigger_type', triggerType);
}

// ============================================
// HELPER: Record fired trigger
// ============================================

export async function recordTriggerFired(triggerType: TriggerType): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.rpc('increment_trigger_fired', {
    p_trigger_type: triggerType,
  });

  if (error) {
    // Fallback if RPC doesn't exist - do manual increment
    await supabase
      .from('trigger_accuracy')
      .update({
        total_fired: supabase.rpc('coalesce', { val: 'total_fired', default: 0 }) as unknown as number + 1,
      })
      .eq('trigger_type', triggerType);
  }
}

// ============================================
// HELPERS
// ============================================

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return String(value);
}
