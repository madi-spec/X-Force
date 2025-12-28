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
  Zap,
  Phone,
  UserPlus,
  Swords,
  Target,
  Building2,
  CheckCircle,
  Clock,
  Filter,
  Award,
  Trophy,
  Users,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { SignalsList } from '@/components/ai/signals';
import { HealthScoreRing } from '@/components/ai/health';

// ============================================
// TYPES
// ============================================

interface Stats {
  totalOpenDeals: number;
  atRiskDeals: number;
  decliningDeals: number;
  healthyDeals: number;
  totalPipelineValue: number;
  atRiskValue: number;
}

interface UnifiedCommandCenterProps {
  userName: string;
  stats: Stats;
}

interface LeverageMoment {
  id: string;
  type: string;
  urgency: string;
  required_role: string;
  confidence: number;
  situation: string;
  what_human_must_do: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  dismissed_at: string | null;
  outcome: string | null;
  company: { id: string; name: string } | null;
  deal: { id: string; name: string; stage: string; estimated_value: number } | null;
}

interface TrustProfile {
  trust_score: number;
  moments_received: number;
  moments_completed: number;
  moments_dismissed: number;
  moments_ignored: number;
  completions_successful: number;
  completions_unsuccessful: number;
  avg_response_time_hours: number | null;
}

interface TrustRecommendations {
  momentFrequency: 'high' | 'normal' | 'low';
  detailLevel: 'full' | 'summary';
  escalationThreshold: number;
}

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  trust_score: number;
  completion_rate: number;
  success_rate: number;
}

interface CalibrationStats {
  trigger_type: string;
  total_fired: number;
  total_completed: number;
  total_successful: number;
  total_dismissed: number;
  success_rate: number;
  completion_rate: number;
  calibration_score: number;
}

interface OverallStats {
  totalFired: number;
  totalCompleted: number;
  totalSuccessful: number;
  totalDismissed: number;
  successRate: number;
  completionRate: number;
}

// ============================================
// CONFIGURATION
// ============================================

const typeConfig: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  relationship_repair: { label: 'Re-engage', icon: Phone, color: 'text-amber-600 bg-amber-50' },
  exec_intro: { label: 'Exec Access', icon: UserPlus, color: 'text-purple-600 bg-purple-50' },
  competitive_threat: { label: 'Competitive', icon: Swords, color: 'text-red-600 bg-red-50' },
  pricing_exception: { label: 'Pricing', icon: DollarSign, color: 'text-green-600 bg-green-50' },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  immediate: { label: 'Now', color: 'bg-red-100 text-red-700' },
  today: { label: 'Today', color: 'bg-amber-100 text-amber-700' },
  this_week: { label: 'This Week', color: 'bg-blue-100 text-blue-700' },
  before_next_milestone: { label: 'Soon', color: 'bg-gray-100 text-gray-600' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-600' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export function UnifiedCommandCenter({ userName, stats }: UnifiedCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'performance' | 'overview'>('actions');

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-normal text-gray-900">AI Command Center</h1>
              <p className="text-sm text-gray-500">
                Good {getGreeting()}, {userName}. Here&apos;s your pipeline intelligence.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-8">
            {[
              { id: 'actions', label: 'Action Items', icon: Zap },
              { id: 'performance', label: 'Performance', icon: Trophy },
              { id: 'overview', label: 'Overview', icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  'flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'actions' && <ActionItemsTab />}
        {activeTab === 'performance' && <PerformanceTab />}
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
      </div>
    </div>
  );
}

// ============================================
// ACTION ITEMS TAB (from Leverage)
// ============================================

function ActionItemsTab() {
  const [moments, setMoments] = useState<LeverageMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [scanning, setScanning] = useState(false);

  const fetchMoments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leverage-moments?status=${statusFilter}&limit=50`);
      const data = await response.json();
      setMoments(data.moments || []);
    } catch (err) {
      console.error('Error fetching moments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();
  }, [statusFilter]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const response = await fetch('/api/leverage-moments/scan', { method: 'POST' });
      const data = await response.json();

      let message = `Scan complete: ${data.momentsCreated} new action items detected`;
      if (data.momentsCreated > 0) {
        alert(message);
      }
      fetchMoments();
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            AI-detected opportunities that need your personal touch
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="h-9 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', scanning && 'animate-spin')} />
          Scan Deals
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">Status:</span>
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                statusFilter === key
                  ? config.color
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Moments List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
        ) : moments.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-gray-600">No {statusFilter} action items</p>
            {statusFilter === 'pending' && (
              <p className="text-sm text-gray-400 mt-1">
                AI is handling routine tasks. You&apos;re all caught up!
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {moments.map((moment) => {
              const config = typeConfig[moment.type] || typeConfig.relationship_repair;
              const urgency = urgencyConfig[moment.urgency] || urgencyConfig.this_week;
              const Icon = config.icon;

              return (
                <Link
                  key={moment.id}
                  href={`/leverage/${moment.id}`}
                  className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={cn('p-2.5 rounded-lg', config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {moment.company?.name || 'Unknown Company'}
                      </span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', urgency.color)}>
                        {urgency.label}
                      </span>
                      {moment.outcome && (
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            moment.outcome === 'successful'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          {moment.outcome}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {moment.what_human_must_do}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {moment.confidence}%
                      </span>
                      {moment.deal && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {moment.deal.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(moment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// PERFORMANCE TAB (from Learning)
// ============================================

function PerformanceTab() {
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'profile' | 'leaderboard' | 'calibration'>('profile');
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [recommendations, setRecommendations] = useState<TrustRecommendations | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [calibration, setCalibration] = useState<CalibrationStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const profileRes = await fetch('/api/learning/trust-profiles');
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.profile);
        setRecommendations(profileData.recommendations);
      }

      const leaderboardRes = await fetch('/api/learning/trust-profiles?view=leaderboard');
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setLeaderboard(leaderboardData.leaderboard || []);
      }

      const calibrationRes = await fetch('/api/learning/calibration');
      if (calibrationRes.ok) {
        const calibrationData = await calibrationRes.json();
        setCalibration(calibrationData.byTriggerType || []);
        setOverallStats(calibrationData.overall);
      }
    } catch (err) {
      console.error('Error fetching learning data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation */}
      <div className="flex gap-2">
        {[
          { id: 'profile', label: 'My Trust Profile', icon: Brain },
          { id: 'leaderboard', label: 'Team Leaderboard', icon: Trophy },
          { id: 'calibration', label: 'AI Calibration', icon: Target },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              subTab === tab.id
                ? 'bg-violet-100 text-violet-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Trust Profile */}
      {subTab === 'profile' && profile && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Your Trust Score</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Based on how you respond to AI recommendations
                </p>
              </div>
              <div className="text-right">
                <div className={cn(
                  'text-4xl font-light',
                  profile.trust_score >= 70 ? 'text-green-600' :
                  profile.trust_score >= 40 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {profile.trust_score}
                </div>
                <div className="text-sm text-gray-500">out of 100</div>
              </div>
            </div>

            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  profile.trust_score >= 70 ? 'bg-green-500' :
                  profile.trust_score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${profile.trust_score}%` }}
              />
            </div>

            {recommendations && (
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Moment Frequency</div>
                  <div className="mt-1 font-medium text-gray-900 capitalize">{recommendations.momentFrequency}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Detail Level</div>
                  <div className="mt-1 font-medium text-gray-900 capitalize">{recommendations.detailLevel}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Escalation Threshold</div>
                  <div className="mt-1 font-medium text-gray-900">{recommendations.escalationThreshold}%</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Zap} iconColor="text-blue-600 bg-blue-50" label="Moments Received" value={profile.moments_received} />
            <StatCard
              icon={CheckCircle}
              iconColor="text-green-600 bg-green-50"
              label="Completed"
              value={profile.moments_completed}
              subValue={profile.moments_received > 0 ? `${Math.round((profile.moments_completed / profile.moments_received) * 100)}%` : undefined}
            />
            <StatCard icon={XCircle} iconColor="text-amber-600 bg-amber-50" label="Dismissed" value={profile.moments_dismissed} />
            <StatCard
              icon={Award}
              iconColor="text-purple-600 bg-purple-50"
              label="Successful Outcomes"
              value={profile.completions_successful}
              subValue={profile.moments_completed > 0 ? `${Math.round((profile.completions_successful / profile.moments_completed) * 100)}% success` : undefined}
            />
          </div>

          {profile.avg_response_time_hours !== null && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="h-4 w-4" />
                Average response time: <strong>{profile.avg_response_time_hours.toFixed(1)} hours</strong>
                {profile.avg_response_time_hours <= 24 && (
                  <span className="text-green-600">(Quick responder!)</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {subTab === 'leaderboard' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {leaderboard.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Rank</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Rep</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Trust Score</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Completion Rate</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.user_id} className="border-b border-gray-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-700' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-500'
                      )}>
                        {i + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{entry.user_name}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        'font-medium',
                        entry.trust_score >= 70 ? 'text-green-600' :
                        entry.trust_score >= 40 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        {entry.trust_score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{entry.completion_rate}%</td>
                    <td className="px-6 py-4 text-right text-gray-600">{entry.success_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No leaderboard data available</p>
              <p className="text-sm text-gray-400 mt-1">Data will appear once reps start completing action items</p>
            </div>
          )}
        </div>
      )}

      {/* Calibration */}
      {subTab === 'calibration' && (
        <div className="space-y-6">
          {overallStats && (
            <div className="grid grid-cols-4 gap-4">
              <StatCard icon={Zap} iconColor="text-blue-600 bg-blue-50" label="Total Triggers Fired" value={overallStats.totalFired} />
              <StatCard icon={CheckCircle} iconColor="text-green-600 bg-green-50" label="Completion Rate" value={`${overallStats.completionRate}%`} />
              <StatCard icon={Award} iconColor="text-purple-600 bg-purple-50" label="Success Rate" value={`${overallStats.successRate}%`} />
              <StatCard icon={XCircle} iconColor="text-amber-600 bg-amber-50" label="Total Dismissed" value={overallStats.totalDismissed} />
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Calibration by Trigger Type</h3>
              <p className="text-sm text-gray-500">How well AI predictions match actual outcomes</p>
            </div>
            {calibration.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Trigger Type</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Fired</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Completed</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Success Rate</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Calibration</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.map((stat) => (
                    <tr key={stat.trigger_type} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-900 capitalize">{stat.trigger_type.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{stat.total_fired}</td>
                      <td className="px-6 py-4 text-right text-gray-600">{stat.total_completed}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          'font-medium',
                          stat.success_rate >= 70 ? 'text-green-600' :
                          stat.success_rate >= 40 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {stat.success_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          stat.calibration_score >= 80 ? 'bg-green-100 text-green-700' :
                          stat.calibration_score >= 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {stat.calibration_score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No calibration data available</p>
                <p className="text-sm text-gray-400 mt-1">Data will appear once moments have outcomes recorded</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// OVERVIEW TAB (from CommandCenter)
// ============================================

function OverviewTab({ stats }: { stats: Stats }) {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState<{ processed: number; updated: number } | null>(null);
  const [signalKey, setSignalKey] = useState(0);

  const handleScan = async () => {
    setScanning(true);
    try {
      setSignalKey(prev => prev + 1);
      setLastScan(new Date());
    } catch (err) {
      console.error('Error scanning:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    setRecalculateResult(null);
    try {
      const response = await fetch('/api/ai/health-score', { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to recalculate');
      const result = await response.json();
      setRecalculateResult({ processed: result.processed, updated: result.updated });
      setTimeout(() => { window.location.reload(); }, 2000);
    } catch (err) {
      console.error('Error recalculating:', err);
    } finally {
      setRecalculating(false);
    }
  };

  const healthPercentage = stats.totalOpenDeals > 0
    ? Math.round((stats.healthyDeals / stats.totalOpenDeals) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Recalculate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleRecalculateAll}
          disabled={recalculating}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            recalculating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          )}
        >
          {recalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {recalculating ? 'Recalculating...' : 'Recalculate Health Scores'}
        </button>
      </div>

      {recalculateResult && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            Recalculated {recalculateResult.processed} deals, {recalculateResult.updated} updated. Refreshing...
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">At Risk</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.atRiskDeals}</p>
          <p className="text-xs text-gray-500">
            deals need attention
            {stats.atRiskValue > 0 && (
              <span className="text-amber-600 ml-1">({formatCurrency(stats.atRiskValue)})</span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Momentum</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.decliningDeals}</p>
          <p className="text-xs text-gray-500">deals losing momentum</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Pipeline Value</span>
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPipelineValue)}</p>
          <p className="text-xs text-gray-500">across {stats.totalOpenDeals} open deals</p>
        </div>
      </div>

      {/* Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {scanning ? 'Scanning...' : 'Scan Pipeline'}
              </button>
            </div>

            <SignalsList key={signalKey} showFilters={true} showRefresh={false} groupByCategory={true} />

            {lastScan && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                Last scanned {formatRelativeTime(lastScan)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/pipeline" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                <span className="text-sm text-gray-700">View Pipeline</span>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Link>
              <Link href="/deals?filter=at_risk" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                <span className="text-sm text-gray-700">View At-Risk Deals</span>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Link>
              <Link href="/inbox" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                <span className="text-sm text-gray-700">My Tasks</span>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-5 w-5 text-violet-600" />
              <h2 className="text-sm font-semibold text-violet-900">AI Tip</h2>
            </div>
            <p className="text-sm text-violet-800">{getAITip(stats)}</p>
          </div>

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
  );
}

// ============================================
// SUB-COMPONENTS & HELPERS
// ============================================

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  subValue,
}: {
  icon: typeof Zap;
  iconColor: string;
  label: string;
  value: number | string;
  subValue?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-2xl font-light text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
          {subValue && <div className="text-xs text-green-600 mt-0.5">{subValue}</div>}
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
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
