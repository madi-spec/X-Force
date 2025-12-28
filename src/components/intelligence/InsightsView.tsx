'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Target,
  MessageSquare,
  Users,
  Shield,
  TrendingUp,
  Award,
  Clock,
  Loader2,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  XCircle,
  FileText,
  Copy,
  Check,
  Zap,
  Heart,
  Building2,
  DollarSign,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type {
  IntelligenceAnalysis,
  CompanySignals,
  TalkingPoint,
  ObjectionEntry,
} from '@/lib/intelligence/types/rawIntelligence';

// ============================================
// TYPES
// ============================================

interface InsightsViewProps {
  companyId: string;
  companyName: string;
}

// ============================================
// SIGNAL CARD
// ============================================

function SignalCard({
  title,
  active,
  evidence,
  icon: Icon,
  activeColor = 'green',
}: {
  title: string;
  active: boolean;
  evidence?: string[];
  icon: React.ElementType;
  activeColor?: 'green' | 'blue' | 'purple' | 'amber' | 'red';
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
  };

  const iconColors = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        active
          ? colorClasses[activeColor]
          : 'bg-gray-50 border-gray-200 opacity-60'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            active
              ? `bg-white`
              : 'bg-gray-100'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              active ? iconColors[activeColor] : 'text-gray-400'
            )}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                active
                  ? 'text-gray-900'
                  : 'text-gray-500'
              )}
            >
              {title}
            </span>
            {active && (
              <CheckCircle className={cn('h-4 w-4', iconColors[activeColor])} />
            )}
          </div>
          {active && evidence && evidence.length > 0 && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
              {evidence[0]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COLLAPSIBLE SECTION
// ============================================

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {badge}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// TALKING POINT CARD
// ============================================

function TalkingPointCard({ point, index }: { point: TalkingPoint; index: number }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
          {index + 1}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {point.point}
          </p>
          {point.dataReference && (
            <p className="text-xs text-gray-500 mt-1">
              Based on: {point.dataReference}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// OBJECTION CARD
// ============================================

function ObjectionCard({ objection, index }: { objection: ObjectionEntry; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-3 w-3 text-amber-700" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            "{objection.objection}"
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && objection.response && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-xs font-medium text-green-800 mb-1">
              Recommended Response:
            </p>
            <p className="text-sm text-green-700">
              {objection.response}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MARKDOWN REPORT
// ============================================

function MarkdownReport({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>

      <div className="bg-gray-50 rounded-lg p-6 max-h-[600px] overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
          {markdown}
        </pre>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InsightsView({ companyId, companyName }: InsightsViewProps) {
  const [analysis, setAnalysis] = useState<IntelligenceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  // Fetch existing analysis
  const fetchAnalysis = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v3/${companyId}/analyze`);
      if (!res.ok) {
        throw new Error('Failed to fetch analysis');
      }

      const data = await res.json();
      if (data.exists) {
        setAnalysis(data.analysis);
      } else {
        setAnalysis(null);
      }
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Initial fetch
  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Generate analysis
  const handleGenerate = async (regenerate = false) => {
    try {
      setIsGenerating(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v3/${companyId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate analysis');
      }

      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Error generating analysis:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading analysis...</span>
        </div>
      </div>
    );
  }

  // No analysis yet
  if (!analysis) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-normal text-gray-900">
              AI Sales Insights
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Generate personalized sales intelligence from collected data
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-500">
              ×
            </button>
          </div>
        )}

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16 gap-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100">
          <div className="p-4 bg-white rounded-2xl shadow-lg">
            <Sparkles className="h-12 w-12 text-purple-500" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-lg font-medium text-gray-900">
              No Analysis Generated
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              Generate AI-powered sales insights based on the collected data for {companyName}.
              This will create talking points, objection handlers, and a personalized approach.
            </p>
          </div>
          <button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Insights...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate AI Insights
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const { signals } = analysis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-normal text-gray-900">
            AI Sales Insights
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Generated {formatRelativeTime(new Date(analysis.generated_at))}
          </p>
        </div>

        <button
          onClick={() => handleGenerate(true)}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Regenerate
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-500">
            ×
          </button>
        </div>
      )}

      {/* Primary Positioning */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{analysis.positioning_emoji || '🎯'}</div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              {analysis.primary_positioning}
            </h3>
            {analysis.signal_summary && (
              <p className="text-sm text-gray-600 mt-2">
                {analysis.signal_summary}
              </p>
            )}

            {/* Classification Tags */}
            {analysis.classification_tags && analysis.classification_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {analysis.classification_tags.map((tag, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full',
                      tag.includes('ACQUIRER') ? 'bg-blue-100 text-blue-800' :
                      tag.includes('GROWING') ? 'bg-green-100 text-green-800' :
                      tag.includes('PE') ? 'bg-purple-100 text-purple-800' :
                      tag.includes('FAMILY') ? 'bg-orange-100 text-orange-800' :
                      tag.includes('TECH') ? 'bg-cyan-100 text-cyan-800' :
                      'bg-gray-100 text-gray-700'
                    )}
                  >
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Signals Grid */}
      <Section title="Detected Signals" icon={Zap} defaultOpen={true}>
        <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <SignalCard
            title="Active Acquirer"
            active={signals.isActiveAcquirer}
            evidence={signals.acquisitionCount > 0 ? [`${signals.acquisitionCount} acquisitions`] : undefined}
            icon={TrendingUp}
            activeColor="blue"
          />
          <SignalCard
            title="Fast Growing"
            active={signals.isFastGrowing}
            evidence={signals.growthAwards}
            icon={TrendingUp}
            activeColor="green"
          />
          <SignalCard
            title="PE Backed"
            active={signals.isPEBacked}
            evidence={signals.peFirmName ? [signals.peFirmName] : undefined}
            icon={DollarSign}
            activeColor="purple"
          />
          <SignalCard
            title="Tech Forward"
            active={signals.isTechForward}
            evidence={signals.techForwardEvidence}
            icon={Zap}
            activeColor="blue"
          />
          <SignalCard
            title="Industry Leader"
            active={signals.isIndustryLeader}
            evidence={signals.pctRank ? [`PCT #${signals.pctRank}`] : undefined}
            icon={Award}
            activeColor="amber"
          />
          <SignalCard
            title="Hiring"
            active={signals.isHiring}
            evidence={signals.hiringIntensity !== 'none' ? [signals.hiringIntensity] : undefined}
            icon={Users}
            activeColor="green"
          />
          <SignalCard
            title="Founder Led"
            active={signals.isFounderLed}
            icon={Building2}
            activeColor="purple"
          />
          <SignalCard
            title="Next Gen Led"
            active={signals.isNextGenLed}
            evidence={signals.generationNumber ? [`${signals.generationNumber}${signals.generationNumber === 2 ? 'nd' : signals.generationNumber === 3 ? 'rd' : 'th'} generation`] : undefined}
            icon={Users}
            activeColor="amber"
          />
          <SignalCard
            title="Values Innovation"
            active={signals.valuesInnovation}
            icon={Heart}
            activeColor="blue"
          />
        </div>
      </Section>

      {/* Why They Buy */}
      <Section title="Why They Buy" icon={Target} defaultOpen={true}>
        <div className="pt-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {analysis.why_they_buy}
          </p>
        </div>
      </Section>

      {/* Key Messages */}
      {analysis.key_messages && analysis.key_messages.length > 0 && (
        <Section title="Key Messages" icon={MessageSquare} defaultOpen={true}>
          <div className="pt-4 space-y-2">
            {analysis.key_messages.map((message, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg"
              >
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-800">{message}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Talking Points */}
      {analysis.talking_points && analysis.talking_points.length > 0 && (
        <Section
          title="Talking Points"
          icon={Lightbulb}
          defaultOpen={true}
          badge={
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {analysis.talking_points.length}
            </span>
          }
        >
          <div className="pt-4 space-y-3">
            {analysis.talking_points.map((point, i) => (
              <TalkingPointCard key={i} point={point} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Likely Objections */}
      {analysis.likely_objections && analysis.likely_objections.length > 0 && (
        <Section
          title="Likely Objections"
          icon={Shield}
          defaultOpen={false}
          badge={
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {analysis.likely_objections.length}
            </span>
          }
        >
          <div className="pt-4 space-y-2">
            {analysis.likely_objections.map((objection, i) => (
              <ObjectionCard key={i} objection={objection} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Questions to Ask */}
      {analysis.questions_to_ask && analysis.questions_to_ask.length > 0 && (
        <Section title="Questions to Ask" icon={HelpCircle} defaultOpen={false}>
          <div className="pt-4 space-y-2">
            {analysis.questions_to_ask.map((question, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <HelpCircle className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">{question}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Things to Avoid */}
      {analysis.things_to_avoid && analysis.things_to_avoid.length > 0 && (
        <Section title="Things to Avoid" icon={XCircle} defaultOpen={false}>
          <div className="pt-4 space-y-2">
            {analysis.things_to_avoid.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-red-50 rounded-lg"
              >
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{item}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Entry Point & Timing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-medium text-gray-700">Entry Point</h4>
          </div>
          <p className="text-sm text-gray-600">
            {analysis.entry_point || 'Not specified'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-medium text-gray-700">Best Timing</h4>
          </div>
          <p className="text-sm text-gray-600">
            {analysis.best_timing || 'Not specified'}
          </p>
        </div>
      </div>

      {/* Target Roles */}
      {analysis.target_roles && analysis.target_roles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-medium text-gray-700">Target Roles</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.target_roles.map((role, i) => (
              <span
                key={i}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Call Prep Checklist */}
      {analysis.call_prep_checklist && analysis.call_prep_checklist.length > 0 && (
        <Section title="Call Prep Checklist" icon={CheckCircle} defaultOpen={false}>
          <div className="pt-4 space-y-2">
            {analysis.call_prep_checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="w-5 h-5 rounded border-2 border-gray-300" />
                <p className="text-sm text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Full Report */}
      {analysis.full_report_markdown && (
        <Section
          title="Full Report"
          icon={FileText}
          defaultOpen={false}
          badge={
            <button
              onClick={() => setShowFullReport(!showFullReport)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showFullReport ? 'Collapse' : 'Expand'}
            </button>
          }
        >
          <div className="pt-4">
            <MarkdownReport markdown={analysis.full_report_markdown} />
          </div>
        </Section>
      )}
    </div>
  );
}

export default InsightsView;
