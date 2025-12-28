'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface FunnelMetrics {
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

interface ChannelMetrics {
  channel: string;
  attempts: number;
  responses: number;
  meetings_scheduled: number;
  response_rate: number;
  conversion_rate: number;
  avg_response_time_hours: number | null;
}

interface TimeSlotMetrics {
  day_of_week: string;
  hour: number;
  attempts: number;
  responses: number;
  response_rate: number;
}

interface MeetingTypeMetrics {
  meeting_type: string;
  total_requests: number;
  completed: number;
  success_rate: number;
  avg_attempts: number;
  avg_days_to_schedule: number;
}

interface SocialProofMetrics {
  id: string;
  type: string;
  title: string | null;
  times_used: number;
  response_rate: number;
  conversion_rate: number;
}

interface AnalyticsSummary {
  period: { start: string; end: string };
  funnel: FunnelMetrics;
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
    requests_trend: number;
    success_trend: number;
    efficiency_trend: number;
  };
  insights: string[];
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  follow_up: 'Follow-up',
  technical: 'Technical',
  executive: 'Executive',
  custom: 'Custom',
  unknown: 'Unknown',
};

export default function SchedulerAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date().toISOString();

      const res = await fetch(`/api/scheduler/analytics?start=${start}&end=${end}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const { data } = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
  const formatHours = (hours: number | null) =>
    hours ? `${Math.round(hours)}h` : 'N/A';
  const formatTrend = (value: number) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <span className={cn(
        'flex items-center gap-1 text-xs',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPositive ? '+' : ''}{Math.round(value * 100)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const funnel = analytics?.funnel;
  const totalInFunnel = funnel
    ? funnel.initiated + funnel.proposing + funnel.awaiting_response +
      funnel.negotiating + funnel.confirming + funnel.confirmed +
      funnel.completed + funnel.no_show + funnel.cancelled
    : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/calendar"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-normal text-gray-900">
              Scheduling Analytics
            </h1>
            <p className="text-xs text-gray-500">
              Performance insights and optimization opportunities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  dateRange === range
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-gray-500">
              <Target className="h-4 w-4" />
              <span className="text-xs">Overall Conversion</span>
            </div>
            {formatTrend(analytics?.trends.success_trend || 0)}
          </div>
          <div className="text-2xl font-light text-gray-900">
            {formatPercent(funnel?.conversion_rates.overall || 0)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Meetings Held</span>
            </div>
            {formatTrend(analytics?.trends.requests_trend || 0)}
          </div>
          <div className="text-2xl font-light text-gray-900">
            {funnel?.completed || 0}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Confirmed → Held</span>
          </div>
          <div className="text-2xl font-light text-gray-900">
            {formatPercent(funnel?.conversion_rates.confirmed_to_held || 0)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-xs">No-Shows</span>
          </div>
          <div className="text-2xl font-light text-gray-900">
            {funnel?.no_show || 0}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Funnel & Channels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Funnel Visualization */}
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4" />
              Scheduling Funnel
            </h2>

            {totalInFunnel === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No scheduling data for this period
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Initiated', value: funnel?.initiated || 0, color: 'bg-gray-400' },
                  { label: 'Proposing', value: funnel?.proposing || 0, color: 'bg-blue-400' },
                  { label: 'Awaiting Response', value: funnel?.awaiting_response || 0, color: 'bg-yellow-400' },
                  { label: 'Negotiating', value: funnel?.negotiating || 0, color: 'bg-orange-400' },
                  { label: 'Confirming', value: funnel?.confirming || 0, color: 'bg-purple-400' },
                  { label: 'Confirmed', value: funnel?.confirmed || 0, color: 'bg-green-400' },
                  { label: 'Completed', value: funnel?.completed || 0, color: 'bg-emerald-500' },
                ].map((stage) => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-gray-600">
                      {stage.label}
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', stage.color)}
                        style={{ width: `${totalInFunnel > 0 ? (stage.value / totalInFunnel) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-sm font-medium text-gray-900">
                      {stage.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Channel Performance */}
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-4">
              <Mail className="h-4 w-4" />
              Channel Performance
            </h2>

            {!analytics?.channels?.length ? (
              <div className="text-center py-8 text-gray-500">
                No channel data for this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left py-2">Channel</th>
                      <th className="text-right py-2">Attempts</th>
                      <th className="text-right py-2">Responses</th>
                      <th className="text-right py-2">Response Rate</th>
                      <th className="text-right py-2">Avg Response Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.channels.map((channel) => (
                      <tr key={channel.channel}>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {CHANNEL_ICONS[channel.channel] || <Mail className="h-4 w-4" />}
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {channel.channel}
                            </span>
                          </div>
                        </td>
                        <td className="text-right text-sm text-gray-600">
                          {channel.attempts}
                        </td>
                        <td className="text-right text-sm text-gray-600">
                          {channel.responses}
                        </td>
                        <td className="text-right">
                          <span className={cn(
                            'text-sm font-medium',
                            channel.response_rate > 0.3
                              ? 'text-green-600'
                              : channel.response_rate > 0.15
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          )}>
                            {formatPercent(channel.response_rate)}
                          </span>
                        </td>
                        <td className="text-right text-sm text-gray-600">
                          {formatHours(channel.avg_response_time_hours)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Meeting Type Performance */}
          <div className="p-6 bg-white rounded-xl border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4" />
              Performance by Meeting Type
            </h2>

            {!analytics?.meeting_types?.length ? (
              <div className="text-center py-8 text-gray-500">
                No meeting type data for this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left py-2">Type</th>
                      <th className="text-right py-2">Total</th>
                      <th className="text-right py-2">Success Rate</th>
                      <th className="text-right py-2">Avg Attempts</th>
                      <th className="text-right py-2">Avg Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {analytics.meeting_types.map((mt) => (
                      <tr key={mt.meeting_type}>
                        <td className="py-3 text-sm font-medium text-gray-900">
                          {MEETING_TYPE_LABELS[mt.meeting_type] || mt.meeting_type}
                        </td>
                        <td className="text-right text-sm text-gray-600">
                          {mt.total_requests}
                        </td>
                        <td className="text-right">
                          <span className={cn(
                            'text-sm font-medium',
                            mt.success_rate > 0.5
                              ? 'text-green-600'
                              : mt.success_rate > 0.3
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          )}>
                            {formatPercent(mt.success_rate)}
                          </span>
                        </td>
                        <td className="text-right text-sm text-gray-600">
                          {mt.avg_attempts.toFixed(1)}
                        </td>
                        <td className="text-right text-sm text-gray-600">
                          {mt.avg_days_to_schedule.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Insights & Time Analysis */}
        <div className="space-y-6">
          {/* AI Insights */}
          {analytics?.insights && analytics.insights.length > 0 && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200">
              <h2 className="text-sm font-medium text-purple-900 flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4" />
                AI Insights
              </h2>
              <div className="space-y-2">
                {analytics.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-purple-800 flex items-start gap-2"
                  >
                    <span className="text-purple-400 mt-0.5">•</span>
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best Times */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4" />
              Best Times to Reach
            </h2>

            {analytics?.time_slots?.best_days?.length ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Best Days</div>
                  <div className="flex flex-wrap gap-1">
                    {analytics.time_slots.best_days.map((day) => (
                      <span
                        key={day}
                        className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Best Hours</div>
                  <div className="flex flex-wrap gap-1">
                    {analytics.time_slots.best_hours.map((hour) => (
                      <span
                        key={hour}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        {hour}:00
                      </span>
                    ))}
                  </div>
                </div>

                {analytics.time_slots.worst_days?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Avoid</div>
                    <div className="flex flex-wrap gap-1">
                      {analytics.time_slots.worst_days.map((day) => (
                        <span
                          key={day}
                          className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full"
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Not enough data yet
              </div>
            )}
          </div>

          {/* Social Proof Performance */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4" />
              Social Proof ROI
            </h2>

            {analytics?.social_proof?.top_performers?.length ? (
              <div className="space-y-2">
                {analytics.social_proof.top_performers.slice(0, 5).map((proof) => (
                  <div
                    key={proof.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {proof.title || proof.type}
                      </div>
                      <div className="text-xs text-gray-500">
                        Used {proof.times_used}x
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className={cn(
                        'text-sm font-medium',
                        proof.response_rate > 0.3
                          ? 'text-green-600'
                          : 'text-gray-600'
                      )}>
                        {formatPercent(proof.response_rate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                No social proof usage data yet
              </div>
            )}

            {/* By Type Summary */}
            {analytics?.social_proof?.by_type && Object.keys(analytics.social_proof.by_type).length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">By Type</div>
                <div className="space-y-1">
                  {Object.entries(analytics.social_proof.by_type).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                      <span className="text-gray-900 font-medium">
                        {formatPercent(data.response_rate)} ({data.count})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 mb-3">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href="/calendar"
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="text-sm text-gray-600">Back to Calendar</span>
                <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
              </Link>
              <Link
                href="/scheduler/settings"
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="text-sm text-gray-600">Scheduler Settings</span>
                <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
