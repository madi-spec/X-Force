/**
 * Stop Rules
 *
 * Prevents AI nagging. Strict limits on interruptions:
 * - Max 2 leverage moments per day per rep
 * - Cooldowns after human action
 * - Economic thresholds (don't flag low-value deals)
 * - Dismissal tracking
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================
// CONFIGURATION
// ============================================

export const STOP_RULES = {
  // Frequency limits
  max_leverage_flags_per_day: 5,
  max_active_moments_per_deal: 3,
  max_active_moments_per_company: 5,

  // Cooldowns
  cooldown_after_human_action_hours: 24,
  cooldown_after_dismiss_hours: 48,
  cooldown_after_completion_hours: 72,

  // Quality thresholds
  min_confidence_threshold: 60,
  economic_threshold: 2000, // Don't flag for deals with expected value < $2K

  // Rate limits
  max_same_type_per_week: 3, // Don't keep suggesting same type of action
} as const;

// ============================================
// TYPES
// ============================================

export interface StopRuleCheck {
  canCreate: boolean;
  blockedBy: string | null;
  reason: string | null;
}

export interface StopRuleContext {
  userId: string;
  dealId?: string;
  companyId: string;
  triggerType: string;
  confidence: number;
  expectedValue: number;
}

// ============================================
// MAIN CHECK FUNCTION
// ============================================

export async function checkStopRules(context: StopRuleContext): Promise<StopRuleCheck> {
  const supabase = createAdminClient();

  // Check each rule in order of priority
  const checks = [
    () => checkConfidenceThreshold(context),
    () => checkEconomicThreshold(context),
    () => checkDailyLimit(supabase, context),
    () => checkActiveMomentsPerDeal(supabase, context),
    () => checkActiveMomentsPerCompany(supabase, context),
    () => checkRecentDismissal(supabase, context),
    () => checkRecentCompletion(supabase, context),
    () => checkRecentHumanAction(supabase, context),
    () => checkSameTypeLimit(supabase, context),
  ];

  for (const check of checks) {
    const result = await check();
    if (!result.canCreate) {
      return result;
    }
  }

  return {
    canCreate: true,
    blockedBy: null,
    reason: null,
  };
}

// ============================================
// INDIVIDUAL RULE CHECKS
// ============================================

function checkConfidenceThreshold(context: StopRuleContext): StopRuleCheck {
  if (context.confidence < STOP_RULES.min_confidence_threshold) {
    return {
      canCreate: false,
      blockedBy: 'confidence_threshold',
      reason: `Confidence ${context.confidence}% is below minimum ${STOP_RULES.min_confidence_threshold}%`,
    };
  }
  return { canCreate: true, blockedBy: null, reason: null };
}

function checkEconomicThreshold(context: StopRuleContext): StopRuleCheck {
  if (context.expectedValue < STOP_RULES.economic_threshold) {
    return {
      canCreate: false,
      blockedBy: 'economic_threshold',
      reason: `Expected value $${context.expectedValue} is below minimum $${STOP_RULES.economic_threshold}`,
    };
  }
  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkDailyLimit(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get deal owner to check their daily limit
  let ownerId = context.userId;
  if (context.dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('owner_id')
      .eq('id', context.dealId)
      .single();
    if (deal?.owner_id) {
      ownerId = deal.owner_id;
    }
  }

  // First get the user's deal IDs
  const { data: userDeals } = await supabase
    .from('deals')
    .select('id')
    .eq('owner_id', ownerId);

  const dealIds = userDeals?.map(d => d.id) || [];

  if (dealIds.length === 0) {
    return { canCreate: true, blockedBy: null, reason: null };
  }

  // Count moments created today for this user's deals
  const { count } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())
    .in('deal_id', dealIds);

  if ((count || 0) >= STOP_RULES.max_leverage_flags_per_day) {
    return {
      canCreate: false,
      blockedBy: 'daily_limit',
      reason: `Daily limit of ${STOP_RULES.max_leverage_flags_per_day} leverage moments reached`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkActiveMomentsPerDeal(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  if (!context.dealId) {
    return { canCreate: true, blockedBy: null, reason: null };
  }

  const { count } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true })
    .eq('deal_id', context.dealId)
    .eq('status', 'pending');

  if ((count || 0) >= STOP_RULES.max_active_moments_per_deal) {
    return {
      canCreate: false,
      blockedBy: 'deal_limit',
      reason: `Deal already has ${STOP_RULES.max_active_moments_per_deal} active moments`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkActiveMomentsPerCompany(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  const { count } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .eq('status', 'pending');

  if ((count || 0) >= STOP_RULES.max_active_moments_per_company) {
    return {
      canCreate: false,
      blockedBy: 'company_limit',
      reason: `Company already has ${STOP_RULES.max_active_moments_per_company} active moments`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkRecentDismissal(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  const cooldownTime = new Date();
  cooldownTime.setHours(cooldownTime.getHours() - STOP_RULES.cooldown_after_dismiss_hours);

  const { data: recentDismissal } = await supabase
    .from('human_leverage_moments')
    .select('dismissed_at')
    .eq('company_id', context.companyId)
    .eq('type', context.triggerType)
    .eq('status', 'dismissed')
    .gte('dismissed_at', cooldownTime.toISOString())
    .limit(1)
    .single();

  if (recentDismissal) {
    return {
      canCreate: false,
      blockedBy: 'dismissal_cooldown',
      reason: `Same trigger type was dismissed within ${STOP_RULES.cooldown_after_dismiss_hours} hours`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkRecentCompletion(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  const cooldownTime = new Date();
  cooldownTime.setHours(cooldownTime.getHours() - STOP_RULES.cooldown_after_completion_hours);

  const { data: recentCompletion } = await supabase
    .from('human_leverage_moments')
    .select('completed_at')
    .eq('company_id', context.companyId)
    .eq('type', context.triggerType)
    .eq('status', 'completed')
    .gte('completed_at', cooldownTime.toISOString())
    .limit(1)
    .single();

  if (recentCompletion) {
    return {
      canCreate: false,
      blockedBy: 'completion_cooldown',
      reason: `Same trigger type was completed within ${STOP_RULES.cooldown_after_completion_hours} hours`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkRecentHumanAction(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  const cooldownTime = new Date();
  cooldownTime.setHours(cooldownTime.getHours() - STOP_RULES.cooldown_after_human_action_hours);

  // Check for recent activities on this company/deal
  const query = supabase
    .from('activities')
    .select('id')
    .eq('company_id', context.companyId)
    .gte('occurred_at', cooldownTime.toISOString())
    .in('type', ['call_made', 'meeting_held'])
    .limit(1);

  if (context.dealId) {
    query.eq('deal_id', context.dealId);
  }

  const { data: recentAction } = await query.single();

  if (recentAction) {
    return {
      canCreate: false,
      blockedBy: 'recent_human_action',
      reason: `Human action taken within ${STOP_RULES.cooldown_after_human_action_hours} hours`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}

async function checkSameTypeLimit(
  supabase: ReturnType<typeof createAdminClient>,
  context: StopRuleContext
): Promise<StopRuleCheck> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { count } = await supabase
    .from('human_leverage_moments')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', context.companyId)
    .eq('type', context.triggerType)
    .gte('created_at', oneWeekAgo.toISOString());

  if ((count || 0) >= STOP_RULES.max_same_type_per_week) {
    return {
      canCreate: false,
      blockedBy: 'same_type_limit',
      reason: `Already created ${STOP_RULES.max_same_type_per_week} "${context.triggerType}" moments this week`,
    };
  }

  return { canCreate: true, blockedBy: null, reason: null };
}
