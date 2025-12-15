'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Heart,
  DollarSign,
  RefreshCw,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { SignalsList } from '@/components/ai/signals';
import { HealthScoreRing } from '@/components/ai/health';

interface Stats {
  totalOpenDeals: number;
  atRiskDeals: number;
  decliningDeals: number;
  healthyDeals: number;
  totalPipelineValue: number;
  atRiskValue: number;
}

interface CommandCenterProps {
  userName: string;
  stats: Stats;
}

export function CommandCenter({ userName, stats }: CommandCenterProps) {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Run initial scan on mount
  useEffect(() => {
    handleScan();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/ai/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: true }),
      });
      setLastScan(new Date());
    } catch (err) {
      console.error('Error scanning:', err);
    } finally {
      setScanning(false);
    }
  };

  const healthPercentage = stats.totalOpenDeals > 0
    ? Math.round((stats.healthyDeals / stats.totalOpenDeals) * 100)
    : 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Command Center</h1>
              <p className="text-sm text-gray-500">
                Good {getGreeting()}, {userName}. Here&apos;s your pipeline intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Pipeline Health */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Pipeline Health</span>
              <Heart className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex items-center gap-3">
              <HealthScoreRing score={healthPercentage} size="md" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{healthPercentage}%</p>
                <p className="text-xs text-gray-500">deals healthy</p>
              </div>
            </div>
          </div>

          {/* At Risk */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">At Risk</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.atRiskDeals}</p>
            <p className="text-xs text-gray-500">
              deals need attention
              {stats.atRiskValue > 0 && (
                <span className="text-amber-600 ml-1">
                  ({formatCurrency(stats.atRiskValue)})
                </span>
              )}
            </p>
          </div>

          {/* Declining */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Momentum</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.decliningDeals}</p>
            <p className="text-xs text-gray-500">deals losing momentum</p>
          </div>

          {/* Pipeline Value */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Pipeline Value</span>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalPipelineValue)}
            </p>
            <p className="text-xs text-gray-500">
              across {stats.totalOpenDeals} open deals
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Signals Column - Takes 2/3 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Needs Attention</h2>
                </div>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {scanning ? 'Scanning...' : 'Scan Pipeline'}
                </button>
              </div>

              <SignalsList
                showFilters={true}
                showRefresh={false}
                groupByCategory={true}
              />

              {lastScan && (
                <p className="text-xs text-gray-400 mt-4 text-center">
                  Last scanned {formatRelativeTime(lastScan)}
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions Column - Takes 1/3 */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/pipeline"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm text-gray-700">View Pipeline</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                  href="/deals?filter=at_risk"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm text-gray-700">View At-Risk Deals</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
                <Link
                  href="/tasks"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm text-gray-700">My Tasks</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
              </div>
            </div>

            {/* AI Tips */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-5 w-5 text-violet-600" />
                <h2 className="text-sm font-semibold text-violet-900">AI Tip</h2>
              </div>
              <p className="text-sm text-violet-800">
                {getAITip(stats)}
              </p>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Signal Types</h2>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-600">Risk - Requires immediate action</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-gray-600">Action Needed - Follow up required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-600">Opportunity - Capitalize on momentum</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-gray-600">Insight - Information to consider</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString();
}

function getAITip(stats: Stats): string {
  if (stats.atRiskDeals > stats.totalOpenDeals * 0.3) {
    return 'Over 30% of your pipeline is at risk. Focus on re-engaging stale deals before pursuing new opportunities.';
  }
  if (stats.decliningDeals > 0) {
    return `${stats.decliningDeals} deal${stats.decliningDeals > 1 ? 's are' : ' is'} losing momentum. Quick follow-ups can often reverse declining trends.`;
  }
  if (stats.healthyDeals === stats.totalOpenDeals) {
    return 'Your pipeline is looking healthy! Consider expanding deal values or adding more qualified opportunities.';
  }
  return 'Review signals daily and address high-severity items first. Consistent follow-up is the key to healthy deals.';
}
