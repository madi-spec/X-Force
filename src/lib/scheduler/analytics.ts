/**
 * Scheduling Analytics Service
 *
 * Comprehensive analytics for scheduling performance,
 * channel effectiveness, and learning insights.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// Types
export interface DateRange {
  start: Date;
  end: Date;
}

export interface SchedulingFunnelMetrics {
  initiated: number;
  proposing: number;
  awaiting_response: number;
  negotiating: number;
  confirming: number;
  confirmed: number;
  completed: number;
  no_show: number;
  cancelled: number;
  conversion_rates: {
    initiated_to_confirmed: number;
    confirmed_to_held: number;
    overall: number;
  };
}

export interface ChannelMetrics {
  channel: string;
  attempts: number;
  responses: number;
  meetings_scheduled: number;
  response_rate: number;
  conversion_rate: number;
  avg_response_time_hours: number | null;
}

export interface TimeSlotMetrics {
  day_of_week: string;
  hour: number;
  attempts: number;
  responses: number;
  response_rate: number;
}

export interface MeetingTypeMetrics {
  meeting_type: string;
  total_requests: number;
  completed: number;
  success_rate: number;
  avg_attempts: number;
  avg_days_to_schedule: number;
}

export interface RepMetrics {
  rep_id: string;
  rep_name: string;
  total_requests: number;
  completed: number;
  success_rate: number;
  avg_attempts: number;
  avg_days_to_schedule: number;
  no_show_rate: number;
}

export interface SocialProofMetrics {
  id: string;
  type: string;
  title: string | null;
  times_used: number;
  response_count: number;
  scheduling_count: number;
  response_rate: number;
  conversion_rate: number;
}

export interface SeasonalMetrics {
  month: number;
  month_name: string;
  total_requests: number;
  success_rate: number;
  avg_attempts: number;
  business_level: string;
}

export interface SchedulingAnalyticsSummary {
  period: DateRange;
  funnel: SchedulingFunnelMetrics;
  channels: ChannelMetrics[];
  meeting_types: MeetingTypeMetrics[];
  time_slots: {
    best_days: string[];
    best_hours: number[];
    worst_days: string[];
    data: TimeSlotMetrics[];
  };
  social_proof: {
    top_performers: SocialProofMetrics[];
    by_type: Record<string, { response_rate: number; count: number }>;
  };
  trends: {
    requests_trend: number; // percentage change from previous period
    success_trend: number;
    efficiency_trend: number;
  };
  insights: string[];
}

/**
 * Get scheduling funnel metrics
 */
export async function getSchedulingFunnel(
  dateRange?: DateRange
): Promise<SchedulingFunnelMetrics> {
  const supabase = createAdminClient();

  let query = supabase.from('scheduling_requests').select('status');

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());
  }

  const { data: requests } = await query;

  if (!requests?.length) {
    return {
      initiated: 0,
      proposing: 0,
      awaiting_response: 0,
      negotiating: 0,
      confirming: 0,
      confirmed: 0,
      completed: 0,
      no_show: 0,
      cancelled: 0,
      conversion_rates: {
        initiated_to_confirmed: 0,
        confirmed_to_held: 0,
        overall: 0,
      },
    };
  }

  // Count by status
  const counts: Record<string, number> = {};
  for (const req of requests) {
    counts[req.status] = (counts[req.status] || 0) + 1;
  }

  const total = requests.length;
  const confirmed = (counts['confirmed'] || 0) + (counts['reminder_sent'] || 0) +
                    (counts['completed'] || 0) + (counts['no_show'] || 0);
  const completed = counts['completed'] || 0;

  return {
    initiated: counts['initiated'] || 0,
    proposing: counts['proposing'] || 0,
    awaiting_response: counts['awaiting_response'] || 0,
    negotiating: counts['negotiating'] || 0,
    confirming: counts['confirming'] || 0,
    confirmed: counts['confirmed'] || 0,
    completed: counts['completed'] || 0,
    no_show: counts['no_show'] || 0,
    cancelled: counts['cancelled'] || 0,
    conversion_rates: {
      initiated_to_confirmed: total > 0 ? confirmed / total : 0,
      confirmed_to_held: confirmed > 0 ? completed / confirmed : 0,
      overall: total > 0 ? completed / total : 0,
    },
  };
}

/**
 * Get channel effectiveness metrics
 */
export async function getChannelMetrics(
  dateRange?: DateRange
): Promise<ChannelMetrics[]> {
  const supabase = createAdminClient();

  let query = supabase.from('scheduling_attempts').select(`
    channel,
    outcome,
    sent_at,
    response_received_at
  `);

  if (dateRange) {
    query = query
      .gte('sent_at', dateRange.start.toISOString())
      .lte('sent_at', dateRange.end.toISOString());
  }

  const { data: attempts } = await query;

  if (!attempts?.length) {
    return [];
  }

  // Group by channel
  const channelData: Record<string, {
    attempts: number;
    responses: number;
    meetings: number;
    responseTimes: number[];
  }> = {};

  for (const attempt of attempts) {
    const channel = attempt.channel || 'email';
    if (!channelData[channel]) {
      channelData[channel] = { attempts: 0, responses: 0, meetings: 0, responseTimes: [] };
    }

    channelData[channel].attempts++;

    if (attempt.outcome === 'response_received' || attempt.outcome === 'meeting_scheduled') {
      channelData[channel].responses++;

      if (attempt.sent_at && attempt.response_received_at) {
        const sentTime = new Date(attempt.sent_at).getTime();
        const responseTime = new Date(attempt.response_received_at).getTime();
        const hoursToResponse = (responseTime - sentTime) / (1000 * 60 * 60);
        channelData[channel].responseTimes.push(hoursToResponse);
      }
    }

    if (attempt.outcome === 'meeting_scheduled') {
      channelData[channel].meetings++;
    }
  }

  // Calculate metrics
  return Object.entries(channelData).map(([channel, data]) => ({
    channel,
    attempts: data.attempts,
    responses: data.responses,
    meetings_scheduled: data.meetings,
    response_rate: data.attempts > 0 ? data.responses / data.attempts : 0,
    conversion_rate: data.attempts > 0 ? data.meetings / data.attempts : 0,
    avg_response_time_hours: data.responseTimes.length > 0
      ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
      : null,
  })).sort((a, b) => b.response_rate - a.response_rate);
}

/**
 * Get time slot effectiveness
 */
export async function getTimeSlotMetrics(
  dateRange?: DateRange
): Promise<TimeSlotMetrics[]> {
  const supabase = createAdminClient();

  let query = supabase.from('scheduling_attempts').select(`
    sent_at,
    outcome
  `);

  if (dateRange) {
    query = query
      .gte('sent_at', dateRange.start.toISOString())
      .lte('sent_at', dateRange.end.toISOString());
  }

  const { data: attempts } = await query;

  if (!attempts?.length) {
    return [];
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Group by day and hour
  const slotData: Record<string, { attempts: number; responses: number }> = {};

  for (const attempt of attempts) {
    if (!attempt.sent_at) continue;

    const date = new Date(attempt.sent_at);
    const day = dayNames[date.getDay()];
    const hour = date.getHours();
    const key = `${day}-${hour}`;

    if (!slotData[key]) {
      slotData[key] = { attempts: 0, responses: 0 };
    }

    slotData[key].attempts++;
    if (attempt.outcome === 'response_received' || attempt.outcome === 'meeting_scheduled') {
      slotData[key].responses++;
    }
  }

  return Object.entries(slotData).map(([key, data]) => {
    const [day, hour] = key.split('-');
    return {
      day_of_week: day,
      hour: parseInt(hour),
      attempts: data.attempts,
      responses: data.responses,
      response_rate: data.attempts > 0 ? data.responses / data.attempts : 0,
    };
  }).sort((a, b) => b.response_rate - a.response_rate);
}

/**
 * Get meeting type metrics
 */
export async function getMeetingTypeMetrics(
  dateRange?: DateRange
): Promise<MeetingTypeMetrics[]> {
  const supabase = createAdminClient();

  let query = supabase.from('scheduling_postmortems').select('*');

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());
  }

  const { data: postmortems } = await query;

  if (!postmortems?.length) {
    return [];
  }

  // Group by meeting type
  const typeData: Record<string, {
    total: number;
    completed: number;
    attempts: number[];
    days: number[];
  }> = {};

  for (const pm of postmortems) {
    const type = pm.meeting_type || 'unknown';
    if (!typeData[type]) {
      typeData[type] = { total: 0, completed: 0, attempts: [], days: [] };
    }

    typeData[type].total++;
    typeData[type].attempts.push(pm.total_attempts || 0);

    if (pm.outcome === 'meeting_held') {
      typeData[type].completed++;
      if (pm.total_days_to_schedule) {
        typeData[type].days.push(pm.total_days_to_schedule);
      }
    }
  }

  return Object.entries(typeData).map(([type, data]) => ({
    meeting_type: type,
    total_requests: data.total,
    completed: data.completed,
    success_rate: data.total > 0 ? data.completed / data.total : 0,
    avg_attempts: data.attempts.length > 0
      ? data.attempts.reduce((a, b) => a + b, 0) / data.attempts.length
      : 0,
    avg_days_to_schedule: data.days.length > 0
      ? data.days.reduce((a, b) => a + b, 0) / data.days.length
      : 0,
  })).sort((a, b) => b.success_rate - a.success_rate);
}

/**
 * Get rep performance metrics
 */
export async function getRepMetrics(
  dateRange?: DateRange
): Promise<RepMetrics[]> {
  const supabase = createAdminClient();

  let query = supabase.from('scheduling_requests').select(`
    id,
    status,
    owner_id,
    created_at,
    meeting_scheduled_at,
    profiles:owner_id (
      id,
      full_name
    )
  `);

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());
  }

  const { data: requests } = await query;

  if (!requests?.length) {
    return [];
  }

  // Get attempt counts
  const requestIds = requests.map(r => r.id);
  const { data: attempts } = await supabase
    .from('scheduling_attempts')
    .select('scheduling_request_id')
    .in('scheduling_request_id', requestIds);

  const attemptCounts: Record<string, number> = {};
  for (const attempt of attempts || []) {
    attemptCounts[attempt.scheduling_request_id] =
      (attemptCounts[attempt.scheduling_request_id] || 0) + 1;
  }

  // Group by rep
  const repData: Record<string, {
    name: string;
    total: number;
    completed: number;
    noShows: number;
    attempts: number[];
    days: number[];
  }> = {};

  for (const req of requests) {
    const repId = req.owner_id || 'unassigned';
    const repName = (req.profiles as { full_name?: string } | null)?.full_name || 'Unassigned';

    if (!repData[repId]) {
      repData[repId] = { name: repName, total: 0, completed: 0, noShows: 0, attempts: [], days: [] };
    }

    repData[repId].total++;
    repData[repId].attempts.push(attemptCounts[req.id] || 0);

    if (req.status === 'completed') {
      repData[repId].completed++;
      if (req.created_at && req.meeting_scheduled_at) {
        const created = new Date(req.created_at).getTime();
        const scheduled = new Date(req.meeting_scheduled_at).getTime();
        const days = Math.ceil((scheduled - created) / (1000 * 60 * 60 * 24));
        repData[repId].days.push(days);
      }
    }

    if (req.status === 'no_show') {
      repData[repId].noShows++;
    }
  }

  return Object.entries(repData).map(([repId, data]) => ({
    rep_id: repId,
    rep_name: data.name,
    total_requests: data.total,
    completed: data.completed,
    success_rate: data.total > 0 ? data.completed / data.total : 0,
    avg_attempts: data.attempts.length > 0
      ? data.attempts.reduce((a, b) => a + b, 0) / data.attempts.length
      : 0,
    avg_days_to_schedule: data.days.length > 0
      ? data.days.reduce((a, b) => a + b, 0) / data.days.length
      : 0,
    no_show_rate: data.total > 0 ? data.noShows / data.total : 0,
  })).sort((a, b) => b.success_rate - a.success_rate);
}

/**
 * Get social proof effectiveness metrics
 */
export async function getSocialProofMetrics(): Promise<SocialProofMetrics[]> {
  const supabase = createAdminClient();

  const { data: proofs } = await supabase
    .from('social_proof_library')
    .select('*')
    .eq('is_active', true)
    .gt('times_used', 0)
    .order('times_used', { ascending: false });

  if (!proofs?.length) {
    return [];
  }

  return proofs.map(proof => ({
    id: proof.id,
    type: proof.type,
    title: proof.title,
    times_used: proof.times_used || 0,
    response_count: proof.response_count || 0,
    scheduling_count: proof.scheduling_count || 0,
    response_rate: proof.times_used > 0 ? (proof.response_count || 0) / proof.times_used : 0,
    conversion_rate: proof.times_used > 0 ? (proof.scheduling_count || 0) / proof.times_used : 0,
  }));
}

/**
 * Get seasonal performance metrics
 */
export async function getSeasonalMetrics(): Promise<SeasonalMetrics[]> {
  const supabase = createAdminClient();

  // Get postmortems with month data
  const { data: postmortems } = await supabase
    .from('scheduling_postmortems')
    .select('created_at, outcome, total_attempts');

  // Get seasonality patterns
  const { data: patterns } = await supabase
    .from('seasonality_patterns')
    .select('month, business_level')
    .is('state', null);

  const patternMap: Record<number, string> = {};
  for (const p of patterns || []) {
    patternMap[p.month] = p.business_level;
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Group postmortems by month
  const monthData: Record<number, { total: number; completed: number; attempts: number[] }> = {};

  for (const pm of postmortems || []) {
    const month = new Date(pm.created_at).getMonth() + 1;
    if (!monthData[month]) {
      monthData[month] = { total: 0, completed: 0, attempts: [] };
    }

    monthData[month].total++;
    monthData[month].attempts.push(pm.total_attempts || 0);
    if (pm.outcome === 'meeting_held') {
      monthData[month].completed++;
    }
  }

  return Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
    const data = monthData[month] || { total: 0, completed: 0, attempts: [] };
    return {
      month,
      month_name: monthNames[month - 1],
      total_requests: data.total,
      success_rate: data.total > 0 ? data.completed / data.total : 0,
      avg_attempts: data.attempts.length > 0
        ? data.attempts.reduce((a, b) => a + b, 0) / data.attempts.length
        : 0,
      business_level: patternMap[month] || 'normal',
    };
  });
}

/**
 * Generate insights from analytics data
 */
function generateInsights(
  funnel: SchedulingFunnelMetrics,
  channels: ChannelMetrics[],
  timeSlots: TimeSlotMetrics[],
  meetingTypes: MeetingTypeMetrics[]
): string[] {
  const insights: string[] = [];

  // Funnel insights
  if (funnel.conversion_rates.overall < 0.3) {
    insights.push('Overall conversion rate is below 30% - consider reviewing outreach strategy');
  }
  if (funnel.conversion_rates.confirmed_to_held < 0.8) {
    insights.push(`${Math.round((1 - funnel.conversion_rates.confirmed_to_held) * 100)}% of confirmed meetings don't happen - improve confirmation/reminder process`);
  }
  if (funnel.no_show > funnel.completed * 0.2) {
    insights.push('High no-show rate detected - consider stronger confirmation workflows');
  }

  // Channel insights
  if (channels.length > 1) {
    const bestChannel = channels[0];
    const worstChannel = channels[channels.length - 1];
    if (bestChannel.response_rate > worstChannel.response_rate * 2) {
      insights.push(`${bestChannel.channel} has ${Math.round(bestChannel.response_rate * 100)}% response rate vs ${Math.round(worstChannel.response_rate * 100)}% for ${worstChannel.channel}`);
    }
  }

  // Time slot insights
  if (timeSlots.length > 0) {
    const bestSlots = timeSlots.slice(0, 3);
    const bestDays = [...new Set(bestSlots.map(s => s.day_of_week))];
    if (bestDays.length > 0) {
      insights.push(`Best response days: ${bestDays.join(', ')}`);
    }
  }

  // Meeting type insights
  const strugglingTypes = meetingTypes.filter(mt => mt.success_rate < 0.3 && mt.total_requests > 3);
  for (const type of strugglingTypes) {
    insights.push(`${type.meeting_type} meetings have low ${Math.round(type.success_rate * 100)}% success rate`);
  }

  return insights;
}

/**
 * Get complete analytics summary
 */
export async function getAnalyticsSummary(
  dateRange?: DateRange
): Promise<SchedulingAnalyticsSummary> {
  const period = dateRange || {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  };

  // Fetch all metrics in parallel
  const [funnel, channels, timeSlots, meetingTypes, socialProof] = await Promise.all([
    getSchedulingFunnel(period),
    getChannelMetrics(period),
    getTimeSlotMetrics(period),
    getMeetingTypeMetrics(period),
    getSocialProofMetrics(),
  ]);

  // Calculate best/worst time slots
  const sortedSlots = [...timeSlots].sort((a, b) => b.response_rate - a.response_rate);
  const bestDays = [...new Set(sortedSlots.slice(0, 5).map(s => s.day_of_week))];
  const worstDays = [...new Set(sortedSlots.slice(-5).map(s => s.day_of_week))];
  const bestHours = [...new Set(sortedSlots.slice(0, 5).map(s => s.hour))];

  // Social proof by type
  const proofByType: Record<string, { response_rate: number; count: number }> = {};
  for (const proof of socialProof) {
    if (!proofByType[proof.type]) {
      proofByType[proof.type] = { response_rate: 0, count: 0 };
    }
    proofByType[proof.type].count++;
    proofByType[proof.type].response_rate += proof.response_rate;
  }
  for (const type in proofByType) {
    proofByType[type].response_rate = proofByType[type].response_rate / proofByType[type].count;
  }

  // Calculate trends (compare to previous period)
  const periodLength = period.end.getTime() - period.start.getTime();
  const previousPeriod = {
    start: new Date(period.start.getTime() - periodLength),
    end: new Date(period.start.getTime()),
  };

  const previousFunnel = await getSchedulingFunnel(previousPeriod);

  const currentTotal = Object.values(funnel).reduce((sum, val) =>
    typeof val === 'number' ? sum + val : sum, 0);
  const previousTotal = Object.values(previousFunnel).reduce((sum, val) =>
    typeof val === 'number' ? sum + val : sum, 0);

  const insights = generateInsights(funnel, channels, timeSlots, meetingTypes);

  return {
    period,
    funnel,
    channels,
    meeting_types: meetingTypes,
    time_slots: {
      best_days: bestDays,
      best_hours: bestHours,
      worst_days: worstDays,
      data: timeSlots,
    },
    social_proof: {
      top_performers: socialProof.slice(0, 5),
      by_type: proofByType,
    },
    trends: {
      requests_trend: previousTotal > 0 ? (currentTotal - previousTotal) / previousTotal : 0,
      success_trend: previousFunnel.conversion_rates.overall > 0
        ? (funnel.conversion_rates.overall - previousFunnel.conversion_rates.overall) / previousFunnel.conversion_rates.overall
        : 0,
      efficiency_trend: 0, // Would need more data to calculate
    },
    insights,
  };
}
