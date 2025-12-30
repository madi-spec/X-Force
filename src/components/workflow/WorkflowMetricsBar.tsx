'use client';

import { useState } from 'react';
import { useWorkflow, PROCESS_TYPE_CONFIG } from '@/lib/workflow';
import { ChevronUp, ChevronDown, BarChart3, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessMetrics {
  sales: {
    activeDeals: number;
    conversionRate: number;
    avgCycleTime: number;
    pipelineValue: number;
  };
  onboarding: {
    inProgress: number;
    completionRate: number;
    avgTimeToValue: number;
    stalled: number;
  };
  support: {
    openTickets: number;
    avgResolution: number;
    slaCompliance: number;
    escalationRate: number;
  };
  engagement: {
    monitored: number;
    atRisk: number;
    avgHealthScore: number;
    renewalPipeline: number;
  };
}

// Mock metrics for demo purposes
const mockMetrics: ProcessMetrics = {
  sales: {
    activeDeals: 47,
    conversionRate: 68,
    avgCycleTime: 26,
    pipelineValue: 245000,
  },
  onboarding: {
    inProgress: 12,
    completionRate: 89,
    avgTimeToValue: 14,
    stalled: 2,
  },
  support: {
    openTickets: 34,
    avgResolution: 4.2,
    slaCompliance: 94,
    escalationRate: 8,
  },
  engagement: {
    monitored: 156,
    atRisk: 12,
    avgHealthScore: 76,
    renewalPipeline: 1250000,
  },
};

export function WorkflowMetricsBar() {
  const { processType } = useWorkflow();
  const [isExpanded, setIsExpanded] = useState(true);
  const config = PROCESS_TYPE_CONFIG[processType];

  const renderMetrics = () => {
    switch (processType) {
      case 'sales':
        return <SalesMetrics metrics={mockMetrics.sales} />;
      case 'onboarding':
        return <OnboardingMetrics metrics={mockMetrics.onboarding} />;
      case 'support':
        return <SupportMetrics metrics={mockMetrics.support} />;
      case 'engagement':
        return <EngagementMetrics metrics={mockMetrics.engagement} />;
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-t-lg text-xs text-gray-600 hover:text-gray-800 transition-colors"
      >
        <BarChart3 className="w-3 h-3" />
        Metrics
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )}
      </button>

      {/* Metrics content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'h-16' : 'h-0'
        )}
      >
        <div className="h-full flex items-center justify-center gap-8 px-6">
          {renderMetrics()}
        </div>
      </div>
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
  unit,
  trend,
  trendDirection,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold text-gray-900">{value}</span>
          {unit && <span className="text-xs text-gray-500">{unit}</span>}
          {trend !== undefined && (
            <span
              className={cn(
                'text-xs font-medium',
                trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trendDirection === 'up' ? '+' : ''}{trend}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SalesMetrics({ metrics }: { metrics: ProcessMetrics['sales'] }) {
  return (
    <>
      <MetricItem
        icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        label="Active Deals"
        value={metrics.activeDeals}
      />
      <MetricItem
        icon={<BarChart3 className="w-4 h-4 text-green-600" />}
        label="Conversion Rate"
        value={metrics.conversionRate}
        unit="%"
        trend={5}
        trendDirection="up"
      />
      <MetricItem
        icon={<Clock className="w-4 h-4 text-orange-600" />}
        label="Avg Cycle Time"
        value={metrics.avgCycleTime}
        unit="days"
      />
      <MetricItem
        icon={<TrendingUp className="w-4 h-4 text-purple-600" />}
        label="Pipeline Value"
        value={`$${(metrics.pipelineValue / 1000).toFixed(0)}K`}
      />
    </>
  );
}

function OnboardingMetrics({ metrics }: { metrics: ProcessMetrics['onboarding'] }) {
  return (
    <>
      <MetricItem
        icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        label="In Progress"
        value={metrics.inProgress}
      />
      <MetricItem
        icon={<BarChart3 className="w-4 h-4 text-green-600" />}
        label="Completion Rate"
        value={metrics.completionRate}
        unit="%"
      />
      <MetricItem
        icon={<Clock className="w-4 h-4 text-orange-600" />}
        label="Avg Time to Value"
        value={metrics.avgTimeToValue}
        unit="days"
      />
      <MetricItem
        icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        label="Stalled"
        value={metrics.stalled}
      />
    </>
  );
}

function SupportMetrics({ metrics }: { metrics: ProcessMetrics['support'] }) {
  return (
    <>
      <MetricItem
        icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        label="Open Tickets"
        value={metrics.openTickets}
      />
      <MetricItem
        icon={<Clock className="w-4 h-4 text-orange-600" />}
        label="Avg Resolution"
        value={metrics.avgResolution}
        unit="hrs"
      />
      <MetricItem
        icon={<BarChart3 className="w-4 h-4 text-green-600" />}
        label="SLA Compliance"
        value={metrics.slaCompliance}
        unit="%"
      />
      <MetricItem
        icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        label="Escalation Rate"
        value={metrics.escalationRate}
        unit="%"
      />
    </>
  );
}

function EngagementMetrics({ metrics }: { metrics: ProcessMetrics['engagement'] }) {
  return (
    <>
      <MetricItem
        icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
        label="Monitored"
        value={metrics.monitored}
      />
      <MetricItem
        icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        label="At Risk"
        value={metrics.atRisk}
      />
      <MetricItem
        icon={<BarChart3 className="w-4 h-4 text-green-600" />}
        label="Avg Health Score"
        value={metrics.avgHealthScore}
      />
      <MetricItem
        icon={<TrendingUp className="w-4 h-4 text-purple-600" />}
        label="Renewal Pipeline"
        value={`$${(metrics.renewalPipeline / 1000000).toFixed(1)}M`}
      />
    </>
  );
}
