/**
 * Rep Trust Profile Service
 *
 * Tracks how reps interact with leverage moments to build trust scores.
 * Trust score influences:
 * - Frequency of leverage moments shown
 * - Level of detail in briefs
 * - Escalation thresholds
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// TYPES
// ============================================

export interface RepTrustProfile {
  id: string;
  user_id: string;
  moments_received: number;
  moments_completed: number;
  moments_dismissed: number;
  moments_ignored: number;
  completions_successful: number;
  completions_unsuccessful: number;
  overrides_total: number;
  overrides_correct: number;
  avg_response_time_hours: number | null;
  trust_score: number;
  updated_at: string;
}

export interface TrustUpdateResult {
  previousScore: number;
  newScore: number;
  change: number;
  reason: string;
}

// ============================================
// TRUST SCORE WEIGHTS
// ============================================

const TRUST_WEIGHTS = {
  // Positive actions
  completion: 3,           // Completing a moment
  successful_outcome: 5,   // Outcome was successful
  quick_response: 2,       // Responded within 24 hours
  override_correct: 4,     // Override that proved correct

  // Negative actions
  dismiss: -1,             // Dismissing a moment
  ignore: -3,              // Ignoring (expired without action)
  unsuccessful_outcome: -2, // Outcome was unsuccessful
  override_wrong: -3,      // Override that proved wrong

  // Bounds
  min_score: 0,
  max_score: 100,
  default_score: 50,
};

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Get or create a trust profile for a user
 */
export async function getRepTrustProfile(userId: string): Promise<RepTrustProfile> {
  const supabase = createAdminClient();

  let { data: profile } = await supabase
    .from('rep_trust_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    const { data: newProfile, error } = await supabase
      .from('rep_trust_profiles')
      .insert({
        user_id: userId,
        trust_score: TRUST_WEIGHTS.default_score,
      })
      .select()
      .single();

    if (error) {
      console.error('[TrustProfile] Error creating profile:', error);
      throw error;
    }
    profile = newProfile;
  }

  return profile as RepTrustProfile;
}

/**
 * Record that a moment was shown to a rep
 */
export async function recordMomentReceived(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.rpc('increment_trust_field', {
    p_user_id: userId,
    p_field: 'moments_received',
    p_amount: 1,
  });

  if (error) {
    // Fallback if RPC doesn't exist
    const profile = await getRepTrustProfile(userId);
    await supabase
      .from('rep_trust_profiles')
      .update({ moments_received: profile.moments_received + 1 })
      .eq('user_id', userId);
  }
}

/**
 * Record that a rep completed a moment
 */
export async function recordMomentCompleted(
  userId: string,
  momentId: string,
  responseTimeHours: number
): Promise<TrustUpdateResult> {
  const supabase = createAdminClient();
  const profile = await getRepTrustProfile(userId);

  let scoreChange = TRUST_WEIGHTS.completion;
  let reason = 'Completed leverage moment';

  // Bonus for quick response
  if (responseTimeHours <= 24) {
    scoreChange += TRUST_WEIGHTS.quick_response;
    reason += ' (quick response bonus)';
  }

  const newScore = clampScore(profile.trust_score + scoreChange);

  // Calculate new average response time
  const totalCompleted = profile.moments_completed + 1;
  const currentAvg = profile.avg_response_time_hours || responseTimeHours;
  const newAvgResponseTime =
    (currentAvg * profile.moments_completed + responseTimeHours) / totalCompleted;

  await supabase
    .from('rep_trust_profiles')
    .update({
      moments_completed: totalCompleted,
      avg_response_time_hours: newAvgResponseTime,
      trust_score: newScore,
    })
    .eq('user_id', userId);

  // Update the moment record
  await supabase
    .from('human_leverage_moments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', momentId);

  return {
    previousScore: profile.trust_score,
    newScore,
    change: scoreChange,
    reason,
  };
}

/**
 * Record that a rep dismissed a moment
 */
export async function recordMomentDismissed(
  userId: string,
  momentId: string,
  dismissReason: string
): Promise<TrustUpdateResult> {
  const supabase = createAdminClient();
  const profile = await getRepTrustProfile(userId);

  const scoreChange = TRUST_WEIGHTS.dismiss;
  const newScore = clampScore(profile.trust_score + scoreChange);

  await supabase
    .from('rep_trust_profiles')
    .update({
      moments_dismissed: profile.moments_dismissed + 1,
      trust_score: newScore,
    })
    .eq('user_id', userId);

  // Update the moment record
  await supabase
    .from('human_leverage_moments')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
      dismissed_reason: dismissReason,
    })
    .eq('id', momentId);

  return {
    previousScore: profile.trust_score,
    newScore,
    change: scoreChange,
    reason: `Dismissed: ${dismissReason}`,
  };
}

/**
 * Record the outcome of a completed moment
 */
export async function recordMomentOutcome(
  userId: string,
  momentId: string,
  outcome: 'successful' | 'unsuccessful',
  notes?: string
): Promise<TrustUpdateResult> {
  const supabase = createAdminClient();
  const profile = await getRepTrustProfile(userId);

  const isSuccessful = outcome === 'successful';
  const scoreChange = isSuccessful
    ? TRUST_WEIGHTS.successful_outcome
    : TRUST_WEIGHTS.unsuccessful_outcome;
  const newScore = clampScore(profile.trust_score + scoreChange);

  const updateData = isSuccessful
    ? { completions_successful: profile.completions_successful + 1 }
    : { completions_unsuccessful: profile.completions_unsuccessful + 1 };

  await supabase
    .from('rep_trust_profiles')
    .update({
      ...updateData,
      trust_score: newScore,
    })
    .eq('user_id', userId);

  // Update the moment record
  await supabase
    .from('human_leverage_moments')
    .update({
      outcome,
      outcome_notes: notes || null,
    })
    .eq('id', momentId);

  // Update trigger accuracy
  const { data: moment } = await supabase
    .from('human_leverage_moments')
    .select('type, confidence')
    .eq('id', momentId)
    .single();

  if (moment) {
    await updateTriggerAccuracy(moment.type, outcome, moment.confidence);
  }

  return {
    previousScore: profile.trust_score,
    newScore,
    change: scoreChange,
    reason: `Outcome: ${outcome}`,
  };
}

/**
 * Record that a moment was ignored (expired without action)
 */
export async function recordMomentIgnored(
  userId: string,
  momentId: string
): Promise<TrustUpdateResult> {
  const supabase = createAdminClient();
  const profile = await getRepTrustProfile(userId);

  const scoreChange = TRUST_WEIGHTS.ignore;
  const newScore = clampScore(profile.trust_score + scoreChange);

  await supabase
    .from('rep_trust_profiles')
    .update({
      moments_ignored: profile.moments_ignored + 1,
      trust_score: newScore,
    })
    .eq('user_id', userId);

  return {
    previousScore: profile.trust_score,
    newScore,
    change: scoreChange,
    reason: 'Moment ignored (expired)',
  };
}

/**
 * Get trust-based recommendations for a rep
 */
export function getTrustRecommendations(profile: RepTrustProfile): {
  momentFrequency: 'high' | 'normal' | 'low';
  detailLevel: 'full' | 'summary';
  escalationThreshold: number;
} {
  const score = profile.trust_score;

  if (score >= 75) {
    return {
      momentFrequency: 'low',      // Trust them to handle most things
      detailLevel: 'summary',      // Less hand-holding needed
      escalationThreshold: 90,     // High bar for escalation
    };
  } else if (score >= 40) {
    return {
      momentFrequency: 'normal',
      detailLevel: 'full',
      escalationThreshold: 75,
    };
  } else {
    return {
      momentFrequency: 'high',     // More guidance needed
      detailLevel: 'full',
      escalationThreshold: 60,     // Lower bar for escalation
    };
  }
}

/**
 * Get rep leaderboard by trust score
 */
export async function getTrustLeaderboard(limit: number = 10): Promise<Array<{
  user_id: string;
  user_name: string;
  trust_score: number;
  completion_rate: number;
  success_rate: number;
}>> {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from('rep_trust_profiles')
    .select(`
      user_id,
      trust_score,
      moments_received,
      moments_completed,
      completions_successful,
      completions_unsuccessful,
      user:users(name)
    `)
    .order('trust_score', { ascending: false })
    .limit(limit);

  if (!profiles) return [];

  return profiles.map(p => {
    const totalCompleted = p.moments_completed || 0;
    const totalReceived = p.moments_received || 1; // Avoid division by zero
    const totalOutcomes = (p.completions_successful || 0) + (p.completions_unsuccessful || 0) || 1;

    return {
      user_id: p.user_id,
      user_name: (p.user as unknown as { name: string } | null)?.name || 'Unknown',
      trust_score: p.trust_score,
      completion_rate: Math.round((totalCompleted / totalReceived) * 100),
      success_rate: Math.round(((p.completions_successful || 0) / totalOutcomes) * 100),
    };
  });
}

// ============================================
// CALIBRATION TRACKING
// ============================================

/**
 * Update trigger accuracy statistics
 */
async function updateTriggerAccuracy(
  triggerType: string,
  outcome: 'successful' | 'unsuccessful',
  confidence: number
): Promise<void> {
  const supabase = createAdminClient();

  // Get or create accuracy record
  let { data: accuracy } = await supabase
    .from('trigger_accuracy')
    .select('*')
    .eq('trigger_type', triggerType)
    .single();

  if (!accuracy) {
    const { data: newAccuracy, error } = await supabase
      .from('trigger_accuracy')
      .insert({ trigger_type: triggerType })
      .select()
      .single();

    if (error) {
      console.error('[Calibration] Error creating accuracy record:', error);
      return;
    }
    accuracy = newAccuracy;
  }

  const isSuccessful = outcome === 'successful';
  const totalCompleted = (accuracy.total_completed || 0) + 1;
  const totalSuccessful = (accuracy.total_successful || 0) + (isSuccessful ? 1 : 0);

  // Update rolling average confidence
  const currentAvg = isSuccessful
    ? accuracy.avg_confidence_successful
    : accuracy.avg_confidence_unsuccessful;
  const currentCount = isSuccessful
    ? accuracy.total_successful
    : (accuracy.total_completed - accuracy.total_successful);
  const newAvg = currentCount > 0
    ? (currentAvg * currentCount + confidence) / (currentCount + 1)
    : confidence;

  const updateData: Record<string, unknown> = {
    total_completed: totalCompleted,
    total_successful: totalSuccessful,
  };

  if (isSuccessful) {
    updateData.avg_confidence_successful = newAvg;
  } else {
    updateData.avg_confidence_unsuccessful = newAvg;
  }

  await supabase
    .from('trigger_accuracy')
    .update(updateData)
    .eq('trigger_type', triggerType);

  console.log(`[Calibration] ${triggerType}: ${totalSuccessful}/${totalCompleted} successful`);
}

/**
 * Get calibration statistics for all trigger types
 */
export async function getCalibrationStats(): Promise<Array<{
  trigger_type: string;
  total_fired: number;
  total_completed: number;
  total_successful: number;
  total_dismissed: number;
  success_rate: number;
  completion_rate: number;
  avg_confidence_successful: number;
  avg_confidence_unsuccessful: number;
  calibration_score: number;
}>> {
  const supabase = createAdminClient();

  const { data: stats } = await supabase
    .from('trigger_accuracy')
    .select('*')
    .order('total_fired', { ascending: false });

  if (!stats) return [];

  return stats.map(s => {
    const completionRate = s.total_fired > 0
      ? Math.round((s.total_completed / s.total_fired) * 100)
      : 0;
    const successRate = s.total_completed > 0
      ? Math.round((s.total_successful / s.total_completed) * 100)
      : 0;

    // Calibration score: how well confidence predicts success
    // Perfect calibration = avg_confidence_successful matches success_rate
    const avgSuccessConf = s.avg_confidence_successful || 50;
    const calibrationScore = 100 - Math.abs(avgSuccessConf - successRate);

    return {
      trigger_type: s.trigger_type,
      total_fired: s.total_fired || 0,
      total_completed: s.total_completed || 0,
      total_successful: s.total_successful || 0,
      total_dismissed: s.total_dismissed || 0,
      success_rate: successRate,
      completion_rate: completionRate,
      avg_confidence_successful: Math.round(s.avg_confidence_successful || 0),
      avg_confidence_unsuccessful: Math.round(s.avg_confidence_unsuccessful || 0),
      calibration_score: Math.round(calibrationScore),
    };
  });
}

/**
 * Record that a trigger was fired (for calibration tracking)
 */
export async function recordTriggerFired(triggerType: string): Promise<void> {
  const supabase = createAdminClient();

  // Upsert to increment total_fired
  const { error } = await supabase.rpc('increment_trigger_fired', {
    p_trigger_type: triggerType,
  });

  if (error) {
    // Fallback if RPC doesn't exist
    const { data: existing } = await supabase
      .from('trigger_accuracy')
      .select('total_fired')
      .eq('trigger_type', triggerType)
      .single();

    if (existing) {
      await supabase
        .from('trigger_accuracy')
        .update({ total_fired: (existing.total_fired || 0) + 1 })
        .eq('trigger_type', triggerType);
    } else {
      await supabase
        .from('trigger_accuracy')
        .insert({ trigger_type: triggerType, total_fired: 1 });
    }
  }
}

/**
 * Record that a trigger was dismissed (for calibration tracking)
 */
export async function recordTriggerDismissed(triggerType: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('trigger_accuracy')
    .select('total_dismissed')
    .eq('trigger_type', triggerType)
    .single();

  if (existing) {
    await supabase
      .from('trigger_accuracy')
      .update({ total_dismissed: (existing.total_dismissed || 0) + 1 })
      .eq('trigger_type', triggerType);
  }
}

// ============================================
// HELPERS
// ============================================

function clampScore(score: number): number {
  return Math.max(TRUST_WEIGHTS.min_score, Math.min(TRUST_WEIGHTS.max_score, score));
}
