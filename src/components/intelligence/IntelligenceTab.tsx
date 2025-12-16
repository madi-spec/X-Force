'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Users,
  Star,
  Newspaper,
  Linkedin,
  Facebook,
  Target,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type {
  GetIntelligenceResponse,
  AccountIntelligence,
  IntelligenceSource,
  ContactIntelligence,
  IndustryMention,
  PainPoint,
  Opportunity,
  TalkingPoint,
} from '@/lib/intelligence/types';

// ============================================
// TYPES
// ============================================

interface IntelligenceTabProps {
  companyId: string;
  companyName: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function IntelligenceTab({ companyId, companyName }: IntelligenceTabProps) {
  const [data, setData] = useState<GetIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState('');

  const fetchIntelligence = useCallback(async () => {
    try {
      const response = await fetch(`/api/intelligence/${companyId}`);
      if (!response.ok) throw new Error('Failed to fetch intelligence');
      const result = await response.json();
      setData(result);
      // Pre-fill domain input with stored domain or suggested domain from contacts
      if (!domain) {
        if (result.companyDomain) {
          setDomain(result.companyDomain);
        } else if (result.suggestedDomain) {
          setDomain(result.suggestedDomain);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId, domain]);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/intelligence/${companyId}/refresh`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to refresh');
      await fetchIntelligence();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCollect = async (forceDomain?: string) => {
    setRefreshing(true);
    try {
      const domainToUse = forceDomain || domain;
      const response = await fetch(`/api/intelligence/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false, domain: domainToUse || undefined }),
      });
      if (!response.ok) throw new Error('Failed to start collection');
      await fetchIntelligence();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collection failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveDomain = async (newDomain: string) => {
    try {
      // Save domain by triggering a collection with the new domain
      // The API will save it to the company record
      const response = await fetch(`/api/intelligence/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false, domain: newDomain }),
      });
      if (!response.ok) throw new Error('Failed to save domain');
      setDomain(newDomain);
      await fetchIntelligence();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save domain');
    }
  };

  if (loading) {
    return <IntelligenceSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Intelligence</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={fetchIntelligence}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data?.intelligence) {
    const hasSuggestedDomain = data?.suggestedDomain && !data?.companyDomain;

    return (
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-200 dark:border-[#2a2a2a] p-8 text-center">
        <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Intelligence Yet</h3>
        <p className="text-gray-500 mb-6">
          Gather AI-powered insights about {companyName} from multiple sources.
        </p>

        {/* Domain Input */}
        <div className="max-w-md mx-auto mb-6">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 text-left">
            Company Website Domain
            {hasSuggestedDomain && (
              <span className="ml-2 text-green-600 normal-case font-normal">
                (detected from contact emails)
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className={cn(
                  "w-full pl-10 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  hasSuggestedDomain ? "border-green-300 dark:border-green-700" : "border-gray-200 dark:border-gray-700"
                )}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-left">
            {hasSuggestedDomain
              ? "This domain was detected from contact email addresses. Edit if needed."
              : "Enter the company's website domain to enable website and social media collection."}
          </p>
        </div>

        <button
          onClick={() => handleCollect()}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          {refreshing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Collecting...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Gather Intelligence
            </>
          )}
        </button>
      </div>
    );
  }

  const { intelligence, sources, contacts, mentions, isStale, lastCollectedAt, companyDomain } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <IntelligenceHeader
        intelligence={intelligence}
        isStale={isStale}
        lastCollectedAt={lastCollectedAt}
        companyDomain={companyDomain}
        onRefresh={handleRefresh}
        onSaveDomain={handleSaveDomain}
        refreshing={refreshing}
      />

      {/* Score Cards */}
      <ScoreCards intelligence={intelligence} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Executive Summary */}
        <div className="col-span-2">
          <ExecutiveSummary intelligence={intelligence} />
        </div>

        {/* Pain Points */}
        <PainPointsCard painPoints={intelligence.pain_points as PainPoint[] || []} />

        {/* Opportunities */}
        <OpportunitiesCard opportunities={intelligence.opportunities as Opportunity[] || []} />

        {/* Key People */}
        <KeyPeopleCard contacts={contacts} />

        {/* Talking Points */}
        <TalkingPointsCard talkingPoints={intelligence.talking_points as TalkingPoint[] || []} />

        {/* Industry Mentions */}
        <div className="col-span-2">
          <IndustryMentionsCard mentions={mentions} />
        </div>

        {/* Recommended Approach */}
        <div className="col-span-2">
          <RecommendedApproachCard approach={intelligence.recommended_approach} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function IntelligenceHeader({
  intelligence,
  isStale,
  lastCollectedAt,
  companyDomain,
  onRefresh,
  onSaveDomain,
  refreshing,
}: {
  intelligence: AccountIntelligence;
  isStale: boolean;
  lastCollectedAt: string | null;
  companyDomain: string | null;
  onRefresh: () => void;
  onSaveDomain: (domain: string) => Promise<void>;
  refreshing: boolean;
}) {
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [editDomain, setEditDomain] = useState(companyDomain || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editDomain.trim()) return;
    setSaving(true);
    try {
      await onSaveDomain(editDomain.trim());
      setIsEditingDomain(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditDomain(companyDomain || '');
    setIsEditingDomain(false);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <Brain className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Account Intelligence</h2>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              {lastCollectedAt ? (
                <>Last updated {formatRelativeTime(lastCollectedAt)}</>
              ) : (
                'Never collected'
              )}
              {isStale && (
                <span className="ml-2 text-amber-600">(Stale)</span>
              )}
            </span>
            {isEditingDomain ? (
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3 text-gray-400" />
                <input
                  type="text"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-40 px-2 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !editDomain.trim()}
                  className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                  title="Save"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingDomain(true)}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 group"
                title="Edit domain"
              >
                <Globe className="h-3 w-3" />
                <span>{companyDomain || 'Add domain'}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}

function ScoreCards({ intelligence }: { intelligence: AccountIntelligence }) {
  const scores = [
    {
      label: 'Overall',
      score: intelligence.overall_score,
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Website',
      score: intelligence.website_score,
      icon: Globe,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Social',
      score: intelligence.social_score,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Reviews',
      score: intelligence.review_score,
      icon: Star,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Industry',
      score: intelligence.industry_score,
      icon: Newspaper,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {scores.map(({ label, score, icon: Icon, color, bg }) => (
        <div
          key={label}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('p-1.5 rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <span className="text-sm font-medium text-gray-600">{label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-light text-gray-900">
              {score ?? '-'}
            </span>
            <span className="text-sm text-gray-400">/100</span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                (score ?? 0) >= 70 ? 'bg-green-500' :
                (score ?? 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${score ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutiveSummary({ intelligence }: { intelligence: AccountIntelligence }) {
  if (!intelligence.executive_summary) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-gray-400" />
        Executive Summary
      </h3>
      <div className="prose prose-sm max-w-none text-gray-600">
        {intelligence.executive_summary.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  );
}

function PainPointsCard({ painPoints }: { painPoints: PainPoint[] }) {
  if (painPoints.length === 0) return null;

  const severityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        Pain Points ({painPoints.length})
      </h3>
      <div className="space-y-3">
        {painPoints.map((point, i) => (
          <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{point.pain}</p>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border whitespace-nowrap',
                severityColors[point.severity]
              )}>
                {point.severity}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{point.evidence}</p>
            <p className="text-xs text-gray-400 mt-1">Source: {point.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunitiesCard({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) return null;

  const confidenceColors = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-amber-400" />
        Opportunities ({opportunities.length})
      </h3>
      <div className="space-y-3">
        {opportunities.map((opp, i) => (
          <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{opp.opportunity}</p>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border whitespace-nowrap',
                confidenceColors[opp.confidence]
              )}>
                {opp.confidence}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{opp.approach}</p>
            <p className="text-xs text-gray-400 mt-1">Source: {opp.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyPeopleCard({ contacts }: { contacts: ContactIntelligence[] }) {
  if (contacts.length === 0) return null;

  const decisionMakers = contacts.filter(c => c.is_decision_maker);
  const others = contacts.filter(c => !c.is_decision_maker);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-blue-400" />
        Key People ({contacts.length})
      </h3>

      {decisionMakers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Decision Makers
          </h4>
          <div className="space-y-2">
            {decisionMakers.slice(0, 5).map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Other Contacts
          </h4>
          <div className="space-y-2">
            {others.slice(0, 5).map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact }: { contact: ContactIntelligence }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        {contact.photo_url ? (
          <img
            src={contact.photo_url}
            alt={contact.full_name || ''}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <Users className="h-4 w-4 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {contact.full_name}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {contact.title}
          {contact.seniority && ` (${contact.seniority})`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
          >
            <Linkedin className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function TalkingPointsCard({ talkingPoints }: { talkingPoints: TalkingPoint[] }) {
  if (talkingPoints.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-green-400" />
        Talking Points ({talkingPoints.length})
      </h3>
      <div className="space-y-3">
        {talkingPoints.map((point, i) => (
          <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <p className="text-sm font-medium text-gray-900">{point.topic}</p>
            <p className="text-xs text-gray-600 mt-1">{point.angle}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span>Use: {point.useCase}</span>
              <span>•</span>
              <span>Source: {point.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IndustryMentionsCard({ mentions }: { mentions: IndustryMention[] }) {
  if (mentions.length === 0) return null;

  const sentimentColors = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-gray-100 text-gray-700',
    negative: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-indigo-400" />
        Industry Mentions ({mentions.length})
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {mentions.slice(0, 6).map((mention) => (
          <a
            key={mention.id}
            href={mention.source_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 block"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                {mention.title}
              </p>
              {mention.sentiment && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                  sentimentColors[mention.sentiment]
                )}>
                  {mention.sentiment}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <span>{mention.source_name}</span>
              {mention.published_at && (
                <>
                  <span>•</span>
                  <span>{formatRelativeTime(mention.published_at)}</span>
                </>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function RecommendedApproachCard({ approach }: { approach: string | null }) {
  if (!approach) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-blue-600" />
        Recommended Sales Approach
      </h3>
      <div className="prose prose-sm max-w-none text-gray-700">
        {approach.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

function IntelligenceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div>
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-100 rounded mt-1" />
          </div>
        </div>
        <div className="h-9 w-24 bg-gray-200 rounded-lg" />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-12 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-4 w-4/6 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}

export default IntelligenceTab;
