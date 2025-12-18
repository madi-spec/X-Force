/**
 * Seasonality Awareness Module
 *
 * Adjusts scheduling strategy based on seasonal patterns
 * and business cycles in the pest control industry.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// Types
export interface SeasonalityPattern {
  id: string;
  state: string | null;
  region: string | null;
  month: number;
  week_of_month: number | null;
  business_level: 'peak' | 'high' | 'normal' | 'low' | 'slow';
  scheduling_difficulty: number; // 0-1
  recommended_approach: string | null;
  avoid_days: string[] | null;
  best_times: string[] | null;
  based_on_samples: number;
}

export interface SeasonalContext {
  pattern: SeasonalityPattern | null;
  business_level: string;
  scheduling_difficulty: number;
  recommendations: SeasonalRecommendations;
}

export interface SeasonalRecommendations {
  approach: string;
  timing_advice: string[];
  avoid: string[];
  urgency_modifier: number; // 0.5 to 1.5 multiplier
  patience_required: boolean;
  alternative_strategies: string[];
}

/**
 * Get seasonal context for scheduling
 */
export async function getSeasonalContext(
  state?: string,
  date?: Date
): Promise<SeasonalContext> {
  const supabase = createAdminClient();
  const targetDate = date || new Date();
  const month = targetDate.getMonth() + 1; // 1-12
  const weekOfMonth = Math.ceil(targetDate.getDate() / 7);

  // Try to find state-specific pattern first
  let pattern: SeasonalityPattern | null = null;

  if (state) {
    const { data: statePattern } = await supabase
      .from('seasonality_patterns')
      .select('*')
      .eq('state', state)
      .eq('month', month)
      .single();

    if (statePattern) {
      pattern = statePattern as SeasonalityPattern;
    }
  }

  // Fall back to national pattern
  if (!pattern) {
    const { data: nationalPattern } = await supabase
      .from('seasonality_patterns')
      .select('*')
      .is('state', null)
      .eq('month', month)
      .single();

    if (nationalPattern) {
      pattern = nationalPattern as SeasonalityPattern;
    }
  }

  // Generate recommendations based on pattern
  const recommendations = generateSeasonalRecommendations(pattern, targetDate);

  return {
    pattern,
    business_level: pattern?.business_level || 'normal',
    scheduling_difficulty: pattern?.scheduling_difficulty || 0.5,
    recommendations,
  };
}

/**
 * Generate recommendations based on seasonal pattern
 */
function generateSeasonalRecommendations(
  pattern: SeasonalityPattern | null,
  date: Date
): SeasonalRecommendations {
  const dayOfWeek = date.getDay(); // 0 = Sunday
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[dayOfWeek];

  // Default recommendations
  const defaults: SeasonalRecommendations = {
    approach: 'Standard scheduling approach',
    timing_advice: ['Mid-morning typically works well', 'Early afternoon is another option'],
    avoid: [],
    urgency_modifier: 1.0,
    patience_required: false,
    alternative_strategies: [],
  };

  if (!pattern) {
    return defaults;
  }

  const recommendations: SeasonalRecommendations = {
    approach: pattern.recommended_approach || defaults.approach,
    timing_advice: [],
    avoid: pattern.avoid_days || [],
    urgency_modifier: 1.0,
    patience_required: false,
    alternative_strategies: [],
  };

  // Timing advice from best_times
  if (pattern.best_times?.length) {
    recommendations.timing_advice = pattern.best_times.map(formatTimeAdvice);
  }

  // Adjust based on business level
  switch (pattern.business_level) {
    case 'peak':
      recommendations.urgency_modifier = 0.7; // Less urgent - they're busy
      recommendations.patience_required = true;
      recommendations.alternative_strategies = [
        'Offer multiple week options, not just this week',
        'Be flexible on exact times - any slot is valuable',
        'Consider early morning or late afternoon slots',
        'Expect 2-3 day response delays',
      ];
      break;

    case 'high':
      recommendations.urgency_modifier = 0.85;
      recommendations.patience_required = true;
      recommendations.alternative_strategies = [
        'Provide 2-3 time options across different days',
        'Be prepared to reschedule if needed',
      ];
      break;

    case 'normal':
      recommendations.urgency_modifier = 1.0;
      recommendations.alternative_strategies = [
        'Standard scheduling approach should work',
        'Good time for demos and detailed conversations',
      ];
      break;

    case 'low':
      recommendations.urgency_modifier = 1.2;
      recommendations.alternative_strategies = [
        'Good time to schedule longer meetings',
        'Decision makers more available',
        'Consider multi-stakeholder meetings',
      ];
      break;

    case 'slow':
      recommendations.urgency_modifier = 1.3;
      recommendations.alternative_strategies = [
        'Excellent time for strategic discussions',
        'Focus on annual planning conversations',
        'Be mindful of holiday schedules',
      ];
      break;
  }

  // Check if today is a day to avoid
  if (recommendations.avoid.includes(currentDay)) {
    recommendations.timing_advice.unshift(
      `${currentDay.charAt(0).toUpperCase() + currentDay.slice(1)} may not be ideal - consider other days`
    );
  }

  return recommendations;
}

/**
 * Format time slot advice
 */
function formatTimeAdvice(slot: string): string {
  const timeMap: Record<string, string> = {
    early_morning: 'Early morning (7-9 AM) - before the day gets busy',
    mid_morning: 'Mid-morning (9-11 AM) - good availability',
    lunch: 'Around lunch (11 AM - 1 PM) - informal slot',
    early_afternoon: 'Early afternoon (1-3 PM) - post-lunch energy',
    late_afternoon: 'Late afternoon (3-5 PM) - wrapping up the day',
    after_hours: 'After hours (5-7 PM) - for busy owners',
    any: 'Flexible on timing - most slots work',
  };

  return timeMap[slot] || slot;
}

/**
 * Get difficulty-adjusted scheduling parameters
 */
export function getSchedulingAdjustments(difficulty: number): {
  maxAttemptsPerDay: number;
  minHoursBetweenAttempts: number;
  followUpDelayMultiplier: number;
  escalationDelayMultiplier: number;
} {
  // Higher difficulty = more conservative approach
  return {
    maxAttemptsPerDay: difficulty > 0.7 ? 1 : difficulty > 0.4 ? 2 : 3,
    minHoursBetweenAttempts: Math.round(24 + difficulty * 24), // 24-48 hours
    followUpDelayMultiplier: 1 + difficulty * 0.5, // 1.0 - 1.5x
    escalationDelayMultiplier: 1 + difficulty * 1.0, // 1.0 - 2.0x
  };
}

/**
 * Should we be more patient with this scheduling request?
 */
export async function shouldBeMorePatient(
  companyState?: string
): Promise<{
  bePatient: boolean;
  reason: string;
  suggestedDelay: number; // hours
}> {
  const context = await getSeasonalContext(companyState);

  if (context.recommendations.patience_required) {
    return {
      bePatient: true,
      reason: `${context.business_level} season - expect slower responses`,
      suggestedDelay: 48, // 2 days
    };
  }

  // Check for upcoming holidays
  const holiday = getUpcomingHoliday();
  if (holiday) {
    return {
      bePatient: true,
      reason: `${holiday.name} approaching - may cause delays`,
      suggestedDelay: holiday.daysAway > 3 ? 24 : 72,
    };
  }

  return {
    bePatient: false,
    reason: 'Normal scheduling timeframe',
    suggestedDelay: 24,
  };
}

/**
 * Check for upcoming holidays that affect scheduling
 */
function getUpcomingHoliday(): { name: string; daysAway: number } | null {
  const today = new Date();
  const year = today.getFullYear();

  // Major US holidays that affect pest control scheduling
  const holidays = [
    { name: 'New Year', date: new Date(year, 0, 1) },
    { name: 'Memorial Day', date: getLastMonday(year, 4) },
    { name: 'Independence Day', date: new Date(year, 6, 4) },
    { name: 'Labor Day', date: getFirstMonday(year, 8) },
    { name: 'Thanksgiving', date: getFourthThursday(year, 10) },
    { name: 'Christmas', date: new Date(year, 11, 25) },
  ];

  // Check next year's New Year if we're in late December
  if (today.getMonth() === 11) {
    holidays.push({ name: 'New Year', date: new Date(year + 1, 0, 1) });
  }

  for (const holiday of holidays) {
    const daysAway = Math.ceil((holiday.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAway > 0 && daysAway <= 7) {
      return { name: holiday.name, daysAway };
    }
  }

  return null;
}

// Holiday date helpers
function getLastMonday(year: number, month: number): Date {
  const date = new Date(year, month + 1, 0);
  while (date.getDay() !== 1) date.setDate(date.getDate() - 1);
  return date;
}

function getFirstMonday(year: number, month: number): Date {
  const date = new Date(year, month, 1);
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  return date;
}

function getFourthThursday(year: number, month: number): Date {
  const date = new Date(year, month, 1);
  let count = 0;
  while (count < 4) {
    if (date.getDay() === 4) count++;
    if (count < 4) date.setDate(date.getDate() + 1);
  }
  return date;
}

/**
 * Get optimal scheduling window for a request
 */
export async function getOptimalSchedulingWindow(
  companyState?: string,
  meetingDurationMinutes: number = 30
): Promise<{
  suggestedDays: string[];
  suggestedTimeSlots: string[];
  avoidDays: string[];
  notes: string[];
}> {
  const context = await getSeasonalContext(companyState);
  const adjustments = getSchedulingAdjustments(context.scheduling_difficulty);

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const avoidLower = context.recommendations.avoid.map(d => d.toLowerCase());
  const suggestedDays = allDays.filter(
    d => !avoidLower.includes(d.toLowerCase())
  );

  // Adjust time slots based on meeting duration
  let suggestedTimeSlots: string[];
  if (meetingDurationMinutes >= 60) {
    // Longer meetings need more flexibility
    suggestedTimeSlots = [
      '9:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '2:00 PM - 3:00 PM',
      '3:00 PM - 4:00 PM',
    ];
  } else {
    suggestedTimeSlots = [
      '9:00 AM - 9:30 AM',
      '10:00 AM - 10:30 AM',
      '11:00 AM - 11:30 AM',
      '2:00 PM - 2:30 PM',
      '3:00 PM - 3:30 PM',
      '4:00 PM - 4:30 PM',
    ];
  }

  const notes: string[] = [];

  if (context.recommendations.patience_required) {
    notes.push(`${context.business_level} season - be patient with responses`);
  }

  if (adjustments.followUpDelayMultiplier > 1.2) {
    notes.push('Consider longer delays between follow-ups');
  }

  if (context.pattern?.best_times?.includes('early_morning')) {
    notes.push('Early morning slots (before 9 AM) may work well');
    suggestedTimeSlots.unshift('7:30 AM - 8:00 AM', '8:00 AM - 8:30 AM');
  }

  if (context.pattern?.best_times?.includes('after_hours')) {
    notes.push('After-hours slots may be better for busy owners');
    suggestedTimeSlots.push('5:00 PM - 5:30 PM', '5:30 PM - 6:00 PM');
  }

  return {
    suggestedDays,
    suggestedTimeSlots,
    avoidDays: context.recommendations.avoid,
    notes,
  };
}

/**
 * Learn from scheduling outcome to improve patterns
 */
export async function recordSeasonalOutcome(
  state: string | null,
  month: number,
  outcome: {
    days_to_schedule: number;
    total_attempts: number;
    successful: boolean;
  }
): Promise<void> {
  const supabase = createAdminClient();

  // Calculate implied difficulty from actual outcome
  const impliedDifficulty =
    outcome.successful
      ? Math.min(1, outcome.total_attempts / 10) // More attempts = higher difficulty
      : 0.9; // Failed = high difficulty

  // Get current pattern
  const { data: existingPattern } = await supabase
    .from('seasonality_patterns')
    .select('*')
    .eq('state', state)
    .eq('month', month)
    .single();

  if (existingPattern) {
    // Update with weighted average
    const samples = existingPattern.based_on_samples || 1;
    const newSamples = samples + 1;
    const newDifficulty =
      (existingPattern.scheduling_difficulty * samples + impliedDifficulty) / newSamples;

    await supabase
      .from('seasonality_patterns')
      .update({
        scheduling_difficulty: Math.round(newDifficulty * 100) / 100,
        based_on_samples: newSamples,
        last_updated: new Date().toISOString(),
      })
      .eq('id', existingPattern.id);
  } else if (state) {
    // Create new state-specific pattern
    await supabase.from('seasonality_patterns').insert({
      state,
      month,
      business_level: impliedDifficulty > 0.7 ? 'high' : impliedDifficulty > 0.4 ? 'normal' : 'low',
      scheduling_difficulty: Math.round(impliedDifficulty * 100) / 100,
      based_on_samples: 1,
    });
  }
}

/**
 * Get seasonality report for analytics
 */
export async function getSeasonalityReport(): Promise<{
  currentMonth: SeasonalityPattern | null;
  nextMonth: SeasonalityPattern | null;
  yearOverview: Array<{
    month: number;
    monthName: string;
    difficulty: number;
    level: string;
  }>;
}> {
  const supabase = createAdminClient();
  const currentMonth = new Date().getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  // Get national patterns for all months
  const { data: patterns } = await supabase
    .from('seasonality_patterns')
    .select('*')
    .is('state', null)
    .order('month');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const yearOverview = (patterns || []).map(p => ({
    month: p.month,
    monthName: monthNames[p.month - 1],
    difficulty: p.scheduling_difficulty,
    level: p.business_level,
  }));

  return {
    currentMonth: patterns?.find(p => p.month === currentMonth) || null,
    nextMonth: patterns?.find(p => p.month === nextMonth) || null,
    yearOverview,
  };
}
