'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  Filter,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Mail,
} from 'lucide-react';

interface DealStats {
  total_deals: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  total_pipeline: number;
  won_value: number;
}

interface CustomerStats {
  total: number;
  active: number;
  churned: number;
  total_mrr: number;
}

interface RecentDeal {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  closed_at: string | null;
  company: { id: string; name: string } | null;
}

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

interface ReportsDashboardProps {
  dealStats: DealStats;
  customerStats: CustomerStats;
  recentDeals: RecentDeal[];
  pipelineSummary: PipelineStage[];
}

interface SchedulerHealth {
  status: 'healthy' | 'degraded' | 'critical';
  checked_at: string;
  metrics: {
    total_active: number;
    stuck_requests: number;
    missing_thread_id: number;
    pending_drafts: number;
    failed_drafts_24h: number;
  };
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    type: string;
    message: string;
  }>;
  recommendations: string[];
}

const stageLabels: Record<string, string> = {
  new_lead: 'New Lead',
  qualifying: 'Qualifying',
  discovery: 'Discovery',
  demo: 'Demo',
  data_review: 'Data Review',
  trial: 'Trial',
  negotiation: 'Negotiation',
  closed_won: 'Won',
  closed_lost: 'Lost',
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  iconColor,
  iconBg,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof TrendingUp;
  trend?: number;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-light text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  trend >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-xs text-gray-400">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
      </div>
    </div>
  );
}

export function ReportsDashboard({
  dealStats,
  customerStats,
  recentDeals,
  pipelineSummary,
}: ReportsDashboardProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [schedulerHealth, setSchedulerHealth] = useState<SchedulerHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/scheduler/health');
        if (res.ok) {
          const data = await res.json();
          setSchedulerHealth(data);
        }
      } catch (err) {
        console.error('Failed to fetch scheduler health:', err);
      } finally {
        setHealthLoading(false);
      }
    };

    fetchHealth();
    // Refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const refetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/scheduler/health');
      if (res.ok) {
        setSchedulerHealth(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch scheduler health:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  const winRate = dealStats.won_deals + dealStats.lost_deals > 0
    ? Math.round((dealStats.won_deals / (dealStats.won_deals + dealStats.lost_deals)) * 100)
    : 0;

  const churnRate = customerStats.total > 0
    ? ((customerStats.churned / customerStats.total) * 100).toFixed(1)
    : '0.0';

  // Sort pipeline by typical stage order
  const stageOrder = ['new_lead', 'qualifying', 'discovery', 'demo', 'data_review', 'trial', 'negotiation'];
  const sortedPipeline = [...pipelineSummary].sort(
    (a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
  );

  const totalPipelineValue = sortedPipeline.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Reports</h1>
          <p className="text-xs text-gray-500 mt-1">Leadership KPIs and business metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['week', 'month', 'quarter'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  period === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Pipeline"
          value={formatCurrency(dealStats.total_pipeline)}
          subtitle={`${dealStats.open_deals} open deals`}
          icon={Target}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <KPICard
          title="Won Revenue"
          value={formatCurrency(dealStats.won_value)}
          subtitle={`${dealStats.won_deals} deals closed`}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          trend={12}
        />
        <KPICard
          title="Win Rate"
          value={`${winRate}%`}
          subtitle={`${dealStats.won_deals}W / ${dealStats.lost_deals}L`}
          icon={BarChart3}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <KPICard
          title="Monthly Revenue"
          value={formatCurrency(customerStats.total_mrr)}
          subtitle={`${customerStats.active} active customers`}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          trend={8}
        />
      </div>

      {/* Scheduler Health Status */}
      <div className={cn(
        "rounded-xl border p-4 mb-6",
        schedulerHealth?.status === 'healthy' && "bg-emerald-50 border-emerald-200",
        schedulerHealth?.status === 'degraded' && "bg-amber-50 border-amber-200",
        schedulerHealth?.status === 'critical' && "bg-red-50 border-red-200",
        !schedulerHealth && "bg-gray-50 border-gray-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status Icon */}
            {healthLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            ) : schedulerHealth?.status === 'healthy' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : schedulerHealth?.status === 'degraded' ? (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            ) : schedulerHealth?.status === 'critical' ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}

            {/* Status Text */}
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-medium",
                  schedulerHealth?.status === 'healthy' && "text-emerald-900",
                  schedulerHealth?.status === 'degraded' && "text-amber-900",
                  schedulerHealth?.status === 'critical' && "text-red-900",
                  !schedulerHealth && "text-gray-600"
                )}>
                  AI Scheduler {schedulerHealth?.status === 'healthy' ? 'Healthy' :
                               schedulerHealth?.status === 'degraded' ? 'Needs Attention' :
                               schedulerHealth?.status === 'critical' ? 'Critical' : 'Unknown'}
                </span>
                {schedulerHealth && (
                  <span className="text-xs text-gray-500">
                    • {schedulerHealth.metrics.total_active} active requests
                  </span>
                )}
              </div>

              {/* Issues Summary */}
              {schedulerHealth?.issues && schedulerHealth.issues.length > 0 && (
                <div className="text-xs mt-0.5 text-gray-600">
                  {schedulerHealth.issues[0].message}
                  {schedulerHealth.issues.length > 1 && ` (+${schedulerHealth.issues.length - 1} more)`}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats & Actions */}
          <div className="flex items-center gap-4">
            {schedulerHealth && (
              <div className="flex items-center gap-4 text-xs">
                {schedulerHealth.metrics.stuck_requests > 0 && (
                  <div className="flex items-center gap-1 text-amber-700">
                    <Clock className="h-3 w-3" />
                    {schedulerHealth.metrics.stuck_requests} stuck
                  </div>
                )}
                {schedulerHealth.metrics.pending_drafts > 0 && (
                  <div className="flex items-center gap-1 text-blue-700">
                    <Mail className="h-3 w-3" />
                    {schedulerHealth.metrics.pending_drafts} drafts
                  </div>
                )}
              </div>
            )}
            <button
              onClick={refetchHealth}
              className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
              title="Refresh health status"
            >
              <RefreshCw className={cn("h-4 w-4 text-gray-500", healthLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Expanded Details (only show if NOT healthy) */}
        {schedulerHealth?.status !== 'healthy' && schedulerHealth?.issues && schedulerHealth.issues.length > 0 && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Issues */}
              <div>
                <div className="text-xs font-medium text-gray-600 mb-2">Issues</div>
                <div className="space-y-1">
                  {schedulerHealth.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className={cn(
                        "mt-0.5",
                        issue.severity === 'critical' && "text-red-500",
                        issue.severity === 'warning' && "text-amber-500",
                        issue.severity === 'info' && "text-blue-500"
                      )}>
                        {issue.severity === 'critical' ? '●' : issue.severity === 'warning' ? '◐' : '○'}
                      </span>
                      <span className="text-gray-700">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {schedulerHealth.recommendations && schedulerHealth.recommendations.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-2">Recommended Actions</div>
                  <div className="space-y-1">
                    {schedulerHealth.recommendations.slice(0, 3).map((rec, idx) => (
                      <div key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-gray-400">→</span> {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pipeline by Stage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Pipeline by Stage</h3>
            <PieChart className="h-4 w-4 text-gray-400" />
          </div>
          {sortedPipeline.length === 0 ? (
            <div className="py-8 text-center">
              <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active pipeline</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPipeline.map((stage) => {
                const percentage = totalPipelineValue > 0
                  ? (stage.value / totalPipelineValue) * 100
                  : 0;
                return (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">
                        {stageLabels[stage.stage] || stage.stage}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {formatCurrency(stage.value)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">
                        {stage.count} deals
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Closed Deals */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Recent Closes</h3>
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          {recentDeals.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No recent closes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeals.slice(0, 6).map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {deal.stage === 'closed_won' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm text-gray-900">{deal.company?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{deal.title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        deal.stage === 'closed_won' ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {formatCurrency(deal.value)}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(deal.closed_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Health Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Customer Health</h3>
          <Users className="h-4 w-4 text-gray-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-light text-gray-900">{customerStats.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Customers</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-2xl font-light text-green-600">{customerStats.active}</p>
            <p className="text-xs text-gray-500 mt-1">Active</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <p className="text-2xl font-light text-red-600">{customerStats.churned}</p>
            <p className="text-xs text-gray-500 mt-1">Churned</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <p className="text-2xl font-light text-amber-600">{churnRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Churn Rate</p>
          </div>
        </div>
      </div>

      {/* Next TODOs */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Next TODOs for Reports</h3>
        <ul className="text-xs text-gray-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-gray-400">1.</span>
            Add date range picker for custom periods
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">2.</span>
            Implement rep performance leaderboard
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">3.</span>
            Add product-wise revenue breakdown
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">4.</span>
            Create deal velocity metrics (avg time to close)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">5.</span>
            Add export to PDF/Excel functionality
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400">6.</span>
            Implement comparison charts (this period vs last)
          </li>
        </ul>
      </div>
    </div>
  );
}
