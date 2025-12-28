'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  Quote,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type {
  IntelligenceAnalysis,
  SWOTItem,
  PainPoint,
  TalkingPoint,
  ObjectionHandler,
  ConnectionPoint,
  BuyingSignal,
  DifferentiationAngle,
} from '@/lib/intelligence/dataLayerTypes';

// ============================================
// TYPES
// ============================================

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function SectionCard({
  title,
  icon,
  children,
  className,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 overflow-hidden',
        className
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-500">{icon}</div>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isOpen && <div className="px-6 pb-6 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function SWOTGrid({
  strengths,
  weaknesses,
  opportunities,
  threats,
}: {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
      {/* Strengths */}
      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
        <h4 className="text-sm font-medium text-green-800 mb-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Strengths
        </h4>
        <ul className="space-y-2">
          {strengths.map((item, i) => (
            <li key={i} className="text-sm text-green-700">
              <p className="font-medium">{item.point}</p>
              <p className="text-xs text-green-600 mt-0.5">{item.evidence}</p>
            </li>
          ))}
          {strengths.length === 0 && (
            <li className="text-sm text-green-600 italic">No strengths identified</li>
          )}
        </ul>
      </div>

      {/* Weaknesses */}
      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
        <h4 className="text-sm font-medium text-red-800 mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Weaknesses
        </h4>
        <ul className="space-y-2">
          {weaknesses.map((item, i) => (
            <li key={i} className="text-sm text-red-700">
              <p className="font-medium">{item.point}</p>
              <p className="text-xs text-red-600 mt-0.5">{item.evidence}</p>
            </li>
          ))}
          {weaknesses.length === 0 && (
            <li className="text-sm text-red-600 italic">No weaknesses identified</li>
          )}
        </ul>
      </div>

      {/* Opportunities */}
      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Opportunities
        </h4>
        <ul className="space-y-2">
          {opportunities.map((item, i) => (
            <li key={i} className="text-sm text-blue-700">
              <p className="font-medium">{item.point}</p>
              <p className="text-xs text-blue-600 mt-0.5">{item.evidence}</p>
            </li>
          ))}
          {opportunities.length === 0 && (
            <li className="text-sm text-blue-600 italic">No opportunities identified</li>
          )}
        </ul>
      </div>

      {/* Threats */}
      <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
        <h4 className="text-sm font-medium text-yellow-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Threats
        </h4>
        <ul className="space-y-2">
          {threats.map((item, i) => (
            <li key={i} className="text-sm text-yellow-700">
              <p className="font-medium">{item.point}</p>
              <p className="text-xs text-yellow-600 mt-0.5">{item.evidence}</p>
            </li>
          ))}
          {threats.length === 0 && (
            <li className="text-sm text-yellow-600 italic">No threats identified</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function PainPointCard({ painPoint }: { painPoint: PainPoint }) {
  const severityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium:
      'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{painPoint.pain}</p>
          <p className="text-xs text-gray-600 mt-1">{painPoint.evidence}</p>
          <p className="text-xs text-gray-500 mt-2">Source: {painPoint.source}</p>
        </div>
        <span
          className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', severityColors[painPoint.severity])}
        >
          {painPoint.severity}
        </span>
      </div>
    </div>
  );
}

function TalkingPointCard({ point }: { point: TalkingPoint }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start gap-3">
        <Quote className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{point.topic}</p>
          <p className="text-xs text-gray-600 mt-1">{point.angle}</p>
          <p className="text-xs text-blue-600 mt-2">Use case: {point.useCase}</p>
        </div>
      </div>
    </div>
  );
}

function ObjectionCard({ objection }: { objection: ObjectionHandler }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-sm font-medium text-gray-900">&ldquo;{objection.objection}&rdquo;</p>
      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Response</p>
        <p className="text-sm text-gray-700">{objection.response}</p>
      </div>
      <p className="text-xs text-gray-500 mt-2">Evidence: {objection.evidence}</p>
    </div>
  );
}

function ConnectionPointCard({ point }: { point: ConnectionPoint }) {
  const typeLabels: Record<ConnectionPoint['type'], string> = {
    shared_interest: 'Shared Interest',
    mutual_connection: 'Mutual Connection',
    common_background: 'Common Background',
    local_community: 'Local Community',
    industry_event: 'Industry Event',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start gap-3">
        <Users className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{point.point}</p>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
              {typeLabels[point.type]}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{point.context}</p>
          <p className="text-xs text-purple-600 mt-2">Use: {point.useCase}</p>
        </div>
      </div>
    </div>
  );
}

function BuyingSignalCard({ signal }: { signal: BuyingSignal }) {
  const strengthColors = {
    strong: 'bg-green-100 text-green-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    weak: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{signal.signal}</p>
          <p className="text-xs text-gray-600 mt-1">{signal.interpretation}</p>
          <p className="text-xs text-gray-500 mt-2">Source: {signal.source}</p>
        </div>
        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', strengthColors[signal.strength])}>
          {signal.strength}
        </span>
      </div>
    </div>
  );
}

function ScoreCard({ label, score, icon }: { label: string; score: number | null; icon: React.ReactNode }) {
  const getScoreColor = (s: number | null) => {
    if (s === null) return 'text-gray-400';
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
      <div className="text-gray-400 mb-2">{icon}</div>
      <span className={cn('text-2xl font-light', getScoreColor(score))}>{score !== null ? score : '-'}</span>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function IntelligenceAnalysisPage({ params }: PageProps) {
  const { id: companyId } = use(params);

  const [company, setCompany] = useState<Company | null>(null);
  const [analysis, setAnalysis] = useState<IntelligenceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch company details
  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      if (!res.ok) throw new Error('Failed to fetch company');
      const data = await res.json();
      setCompany(data);
    } catch (err) {
      console.error('Error fetching company:', err);
    }
  }, [companyId]);

  // Fetch latest analysis
  const fetchAnalysis = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v2/${companyId}/analysis`);
      if (!res.ok) {
        if (res.status === 404) {
          setAnalysis(null);
          return;
        }
        throw new Error('Failed to fetch analysis');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Generate new analysis
  const handleGenerate = async (type: 'full' | 'quick' = 'full') => {
    try {
      setIsGenerating(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v2/${companyId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: type,
          forceRefresh: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate analysis');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Error generating analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCompany();
    fetchAnalysis();
  }, [fetchCompany, fetchAnalysis]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/companies/${companyId}`}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-normal text-gray-900">AI Analysis</h1>
                {company && <p className="text-xs text-gray-500">{company.name}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {analysis && (
                <span className="text-xs text-gray-500">
                  Generated {formatRelativeTime(new Date(analysis.created_at))}
                </span>
              )}
              <button
                onClick={() => handleGenerate('full')}
                disabled={isGenerating}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all',
                  isGenerating
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-lg'
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {analysis ? 'Regenerate' : 'Generate Analysis'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading analysis...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !analysis && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-gray-600">{error}</p>
            <button
              onClick={fetchAnalysis}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State - No Analysis */}
        {!isLoading && !analysis && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 flex items-center justify-center">
              <Brain className="h-10 w-10 text-purple-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">No Analysis Yet</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Generate an AI-powered analysis to get insights, talking points, and strategic recommendations for{' '}
                {company?.name || 'this company'}.
              </p>
            </div>
            <button
              onClick={() => handleGenerate('full')}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              <Sparkles className="h-4 w-4" />
              Generate Analysis
            </button>
          </div>
        )}

        {/* Analysis Content */}
        {analysis && !isLoading && (
          <div className="space-y-6">
            {/* Scores Row */}
            <div className="grid grid-cols-3 gap-4">
              <ScoreCard label="Overall Score" score={analysis.overall_score} icon={<Target className="h-5 w-5" />} />
              <ScoreCard
                label="Engagement Score"
                score={analysis.engagement_score}
                icon={<Zap className="h-5 w-5" />}
              />
              <ScoreCard label="Fit Score" score={analysis.fit_score} icon={<CheckCircle className="h-5 w-5" />} />
            </div>

            {/* Executive Summary */}
            {analysis.executive_summary && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  Executive Summary
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{analysis.executive_summary}</p>
              </div>
            )}

            {/* Timing & Urgency */}
            {(analysis.timing_assessment || analysis.urgency_level) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  Timing Assessment
                </h3>
                <div className="flex items-start gap-4">
                  {analysis.urgency_level && (
                    <span
                      className={cn(
                        'px-3 py-1 text-sm font-medium rounded-full',
                        analysis.urgency_level === 'high'
                          ? 'bg-red-100 text-red-700'
                          : analysis.urgency_level === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      )}
                    >
                      {analysis.urgency_level.toUpperCase()} URGENCY
                    </span>
                  )}
                  {analysis.timing_assessment && (
                    <p className="text-sm text-gray-700">{analysis.timing_assessment}</p>
                  )}
                </div>
              </div>
            )}

            {/* SWOT Analysis */}
            <SectionCard title="SWOT Analysis" icon={<Target className="h-5 w-5" />}>
              <SWOTGrid
                strengths={analysis.strengths}
                weaknesses={analysis.weaknesses}
                opportunities={analysis.opportunities}
                threats={analysis.threats}
              />
            </SectionCard>

            {/* Pain Points */}
            {analysis.pain_points.length > 0 && (
              <SectionCard title="Pain Points" icon={<AlertTriangle className="h-5 w-5" />}>
                <div className="pt-4 space-y-3">
                  {analysis.pain_points.map((point, i) => (
                    <PainPointCard key={i} painPoint={point} />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Talking Points */}
            {analysis.talking_points.length > 0 && (
              <SectionCard title="Talking Points" icon={<MessageSquare className="h-5 w-5" />}>
                <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.talking_points.map((point, i) => (
                    <TalkingPointCard key={i} point={point} />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Recommended Approach */}
            {analysis.recommended_approach && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Recommended Approach
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {analysis.recommended_approach}
                </p>
              </div>
            )}

            {/* Objection Handlers */}
            {analysis.objection_handlers.length > 0 && (
              <SectionCard title="Objection Handlers" icon={<Shield className="h-5 w-5" />} defaultOpen={false}>
                <div className="pt-4 space-y-3">
                  {analysis.objection_handlers.map((obj, i) => (
                    <ObjectionCard key={i} objection={obj} />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Connection Points */}
            {analysis.connection_points.length > 0 && (
              <SectionCard title="Connection Points" icon={<Users className="h-5 w-5" />} defaultOpen={false}>
                <div className="pt-4 space-y-3">
                  {analysis.connection_points.map((point, i) => (
                    <ConnectionPointCard key={i} point={point} />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Buying Signals */}
            {analysis.buying_signals.length > 0 && (
              <SectionCard title="Buying Signals" icon={<TrendingUp className="h-5 w-5" />} defaultOpen={false}>
                <div className="pt-4 space-y-3">
                  {analysis.buying_signals.map((signal, i) => (
                    <BuyingSignalCard key={i} signal={signal} />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Competitive Position */}
            {analysis.competitive_position && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-500" />
                  Competitive Position
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {analysis.competitive_position}
                </p>

                {analysis.differentiation_angles.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Differentiation Angles
                    </h4>
                    <div className="space-y-2">
                      {analysis.differentiation_angles.map((angle, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">{angle.angle}</p>
                          <p className="text-xs text-gray-600 mt-1">{angle.approach}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-4">
              <span>
                Analysis type: {analysis.analysis_type} | Model: {analysis.model_version || 'default'}
              </span>
              <span>
                {analysis.tokens_used?.toLocaleString()} tokens | {analysis.generation_time_ms?.toLocaleString()}ms
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
