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
  Zap,
  Heart,
  Shield,
  ChevronDown,
  ChevronUp,
  Calendar,
  Award,
  TrendingUp as Growth,
  DollarSign,
  Briefcase,
  MapPin,
  BadgeCheck,
  Megaphone,
  Quote,
  Mic,
  Package,
  UserPlus,
  Youtube,
  BookOpen,
  BarChart3,
  Activity,
  Instagram,
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
  Recommendation,
  ConnectionPoint,
  ObjectionPrep,
  SignalEvent,
  CompetitiveIntel,
  CompanyProfile,
  ReviewPainPoint,
  MarketingProfile,
  VisibleEmployee,
  ProductService,
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

// Marketing intelligence types
interface MarketingIntelligenceData {
  blog: {
    exists: boolean;
    url: string | null;
    platform: string | null;
    postCount: number;
    postsLast30Days: number;
    postsLast90Days: number;
    lastPostDate: string | null;
    lastPostTitle: string | null;
    hasRssFeed: boolean;
    hasEmailCapture: boolean;
    topTopics: string[];
  } | null;
  youtube: {
    exists: boolean;
    channelUrl: string | null;
    channelName: string | null;
    subscribers: number;
    videoCount: number;
    videosLast30Days: number;
    videosLast90Days: number;
    lastUploadDate: string | null;
    hasShorts: boolean;
    activityScore: number;
  } | null;
  facebook: {
    exists: boolean;
    pageUrl: string | null;
    followers: number;
    postsLast30Days: number;
    activityScore: number;
  } | null;
  reviewVelocity: {
    combinedMonthlyReviews: number;
    combinedAvgRating: number;
    velocityScore: number;
    hasReviewManagement: boolean;
  } | null;
  websiteMarketing: {
    sophisticationScore: number;
    email: { hasNewsletterSignup: boolean; detectedPlatform: string | null };
    conversion: { hasLiveChat: boolean; liveChatProvider: string | null; hasCallTracking: boolean };
    trust: { trustBadges: string[] };
  } | null;
  scores: {
    content: number;
    social: number;
    engagement: number;
    frequency: number;
    reach: number;
    sophistication: number;
    reviews: number;
    overall: number;
  };
}

export function IntelligenceTab({ companyId, companyName }: IntelligenceTabProps) {
  const [data, setData] = useState<GetIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState('');
  const [marketingIntelligence, setMarketingIntelligence] = useState<MarketingIntelligenceData | null>(null);

  const fetchMarketingIntelligence = useCallback(async () => {
    try {
      const response = await fetch(`/api/intelligence/${companyId}/marketing`);
      if (response.ok) {
        const result = await response.json();
        setMarketingIntelligence(result);
      }
    } catch (err) {
      console.error('Failed to fetch marketing intelligence:', err);
    }
  }, [companyId]);

  const fetchIntelligence = useCallback(async () => {
    try {
      const response = await fetch(`/api/intelligence/${companyId}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch intelligence');
      }
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
      // Also fetch marketing intelligence
      fetchMarketingIntelligence();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [companyId, domain, fetchMarketingIntelligence]);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/intelligence/${companyId}/refresh`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to refresh');
      }
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start collection');
      }
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save domain');
      }
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Intelligence Yet</h3>
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
                  "w-full pl-10 pr-4 py-2 text-sm border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  hasSuggestedDomain ? "border-green-300" : "border-gray-200"
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
        {/* Top 5 Recommendations - Full Width, Prominent */}
        <div className="col-span-2">
          <RecommendationsPanel recommendations={intelligence.recommendations as Recommendation[] || []} />
        </div>

        {/* Executive Summary */}
        <div className="col-span-2">
          <ExecutiveSummary intelligence={intelligence} />
        </div>

        {/* Company Profile & Products/Services - Side by Side */}
        <CompanyProfileCard profile={intelligence.company_profile as CompanyProfile | null} />
        <ProductsServicesCard
          products={intelligence.products_services as ProductService[] || []}
          certifications={intelligence.certifications as string[] || []}
          serviceAreas={intelligence.service_areas as string[] || []}
        />

        {/* Key People */}
        <KeyPeopleCard contacts={contacts} />

        {/* Discovered Employees (from Apollo) */}
        <VisibleEmployeesCard employees={intelligence.visible_employees as VisibleEmployee[] || []} />

        {/* Review Pain Points with Quotes */}
        <div className="col-span-2">
          <ReviewPainPointsCard painPoints={intelligence.review_pain_points as ReviewPainPoint[] || []} />
        </div>

        {/* Marketing Activity */}
        <MarketingActivityCard profile={intelligence.marketing_profile as MarketingProfile | null} />

        {/* Enhanced Marketing Intelligence */}
        {marketingIntelligence && (
          <EnhancedMarketingCard data={marketingIntelligence} />
        )}

        {/* Signals Timeline */}
        <SignalsTimelineCard signals={intelligence.signals_timeline as SignalEvent[] || []} />

        {/* Pain Points */}
        <PainPointsCard painPoints={intelligence.pain_points as PainPoint[] || []} />

        {/* Opportunities */}
        <OpportunitiesCard opportunities={intelligence.opportunities as Opportunity[] || []} />

        {/* Talking Points */}
        <TalkingPointsCard talkingPoints={intelligence.talking_points as TalkingPoint[] || []} />

        {/* Connection Points */}
        <ConnectionPointsCard connectionPoints={intelligence.connection_points as ConnectionPoint[] || []} />

        {/* Industry Mentions */}
        <div className="col-span-2">
          <IndustryMentionsCard mentions={mentions} />
        </div>

        {/* Objection Prep - Full Width */}
        <div className="col-span-2">
          <ObjectionPrepCard objectionPrep={intelligence.objection_prep as ObjectionPrep[] || []} />
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

function RecommendationsPanel({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations || recommendations.length === 0) return null;

  const sortedRecs = [...recommendations].sort((a, b) => a.priority - b.priority);

  const confidenceColors = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const categoryIcons: Record<string, typeof Target> = {
    outreach: Mail,
    messaging: MessageSquare,
    timing: Clock,
    stakeholder: Users,
    product: Zap,
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5 text-purple-600" />
        Top 5 Recommendations
      </h3>
      <div className="space-y-3">
        {sortedRecs.slice(0, 5).map((rec, i) => {
          const CategoryIcon = categoryIcons[rec.category] || Target;
          return (
            <div
              key={i}
              className="bg-white rounded-lg p-4 border border-purple-100"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold text-sm">
                  {rec.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {rec.title}
                    </p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border whitespace-nowrap',
                      confidenceColors[rec.confidence]
                    )}>
                      {rec.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {rec.description}
                  </p>
                  <div className="bg-gray-50 rounded p-2 text-xs text-gray-700 italic">
                    {rec.action}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <CategoryIcon className="h-3 w-3" />
                    <span className="capitalize">{rec.category}</span>
                    <span>•</span>
                    <span>{rec.source}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionPointsCard({ connectionPoints }: { connectionPoints: ConnectionPoint[] }) {
  if (!connectionPoints || connectionPoints.length === 0) return null;

  const typeConfig: Record<string, { label: string; icon: typeof Heart; color: string }> = {
    shared_interest: { label: 'Shared Interest', icon: Heart, color: 'text-pink-600 bg-pink-50' },
    mutual_connection: { label: 'Mutual Connection', icon: Users, color: 'text-blue-600 bg-blue-50' },
    common_background: { label: 'Common Background', icon: Building2, color: 'text-amber-600 bg-amber-50' },
    local_community: { label: 'Local Community', icon: Globe, color: 'text-green-600 bg-green-50' },
    industry_event: { label: 'Industry Event', icon: Calendar, color: 'text-indigo-600 bg-indigo-50' },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Heart className="h-5 w-5 text-pink-500" />
        Connection Points ({connectionPoints.length})
      </h3>
      <div className="space-y-3">
        {connectionPoints.map((point, i) => {
          const config = typeConfig[point.type] || typeConfig.shared_interest;
          const Icon = config.icon;
          return (
            <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
              <div className="flex items-start gap-2">
                <div className={cn('p-1.5 rounded-lg', config.color.split(' ')[1])}>
                  <Icon className={cn('h-3.5 w-3.5', config.color.split(' ')[0])} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{point.point}</p>
                  <p className="text-xs text-gray-500 mt-1">{point.context}</p>
                  <div className="mt-2 bg-white rounded p-2 text-xs text-gray-600 border border-gray-100">
                    <span className="font-medium">Use case:</span> {point.useCase}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Source: {point.source}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ObjectionPrepCard({ objectionPrep }: { objectionPrep: ObjectionPrep[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!objectionPrep || objectionPrep.length === 0) return null;

  const likelihoodColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-orange-500" />
        Objection Prep ({objectionPrep.length})
      </h3>
      <div className="space-y-2">
        {objectionPrep.map((obj, i) => (
          <div
            key={i}
            className="border border-gray-100 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full border whitespace-nowrap',
                  likelihoodColors[obj.likelihood]
                )}>
                  {obj.likelihood}
                </span>
                <p className="text-sm font-medium text-gray-900 truncate">
                  "{obj.objection}"
                </p>
              </div>
              {expandedIndex === i ? (
                <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
            </button>
            {expandedIndex === i && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                <div className="bg-green-50 rounded-lg p-3 mb-2">
                  <p className="text-xs font-medium text-green-800 mb-1">Recommended Response:</p>
                  <p className="text-sm text-green-700">{obj.response}</p>
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Evidence:</span> {obj.evidence}
                </div>
                <p className="text-xs text-gray-400 mt-1">Source: {obj.source}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalsTimelineCard({ signals }: { signals: SignalEvent[] }) {
  if (!signals || signals.length === 0) return null;

  const sortedSignals = [...signals].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const typeConfig: Record<string, { icon: typeof Calendar; color: string }> = {
    news: { icon: Newspaper, color: 'text-blue-600 bg-blue-50' },
    hire: { icon: Users, color: 'text-purple-600 bg-purple-50' },
    growth: { icon: Growth, color: 'text-green-600 bg-green-50' },
    funding: { icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    review: { icon: Star, color: 'text-amber-600 bg-amber-50' },
    social: { icon: MessageSquare, color: 'text-indigo-600 bg-indigo-50' },
    award: { icon: Award, color: 'text-yellow-600 bg-yellow-50' },
  };

  const sentimentColors = {
    positive: 'border-l-green-500',
    neutral: 'border-l-gray-300',
    negative: 'border-l-red-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-indigo-500" />
        Signals Timeline ({signals.length})
      </h3>
      <div className="space-y-3">
        {sortedSignals.slice(0, 8).map((signal, i) => {
          const config = typeConfig[signal.type] || typeConfig.news;
          const Icon = config.icon;
          return (
            <div
              key={i}
              className={cn(
                'pl-3 border-l-2 py-2',
                sentimentColors[signal.sentiment]
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn('p-1 rounded', config.color.split(' ')[1])}>
                  <Icon className={cn('h-3 w-3', config.color.split(' ')[0])} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{signal.title}</p>
                    <span className="text-xs text-gray-400">{signal.date}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{signal.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span className="capitalize">{signal.type}</span>
                    <span>•</span>
                    <span>{signal.source}</span>
                    {signal.url && (
                      <>
                        <span>•</span>
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// DEEP INTELLIGENCE CARDS
// ============================================

function CompanyProfileCard({ profile }: { profile: CompanyProfile | null }) {
  if (!profile) return null;

  const sizeTierLabels: Record<string, string> = {
    startup: 'Startup (<10)',
    smb: 'SMB (10-50)',
    mid_market: 'Mid-Market (50-200)',
    enterprise: 'Enterprise (200+)',
  };

  const techAdoptionColors: Record<string, string> = {
    legacy: 'bg-red-100 text-red-700',
    mixed: 'bg-amber-100 text-amber-700',
    modern: 'bg-green-100 text-green-700',
    cutting_edge: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-500" />
        Company Profile
      </h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Size Tier</p>
            <p className="text-sm font-medium text-gray-900">
              {sizeTierLabels[profile.sizeTier] || profile.sizeTier}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Employees</p>
            <p className="text-sm font-medium text-gray-900">
              {profile.employeeEstimate ? profile.employeeEstimate.toLocaleString() : 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Years in Business</p>
            <p className="text-sm font-medium text-gray-900">
              {profile.yearsInBusiness ? `${profile.yearsInBusiness} years` : 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tech Adoption</p>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              techAdoptionColors[profile.techAdoption] || 'bg-gray-100 text-gray-700'
            )}>
              {profile.techAdoption}
            </span>
          </div>
        </div>
        {profile.operationalMaturity && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Operational Maturity</p>
            <p className="text-sm text-gray-700">{profile.operationalMaturity}</p>
          </div>
        )}
        {profile.serviceModel && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Service Model</p>
            <p className="text-sm text-gray-700 capitalize">
              {profile.serviceModel.replace(/_/g, ' ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductsServicesCard({
  products,
  certifications,
  serviceAreas,
}: {
  products: ProductService[];
  certifications: string[];
  serviceAreas: string[];
}) {
  if (products.length === 0 && certifications.length === 0 && serviceAreas.length === 0) return null;

  const [showAllAreas, setShowAllAreas] = useState(false);
  const displayedAreas = showAllAreas ? serviceAreas : serviceAreas.slice(0, 6);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-emerald-500" />
        Products & Services
      </h3>

      {/* Services */}
      {products.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Services Offered</p>
          <div className="space-y-1.5">
            {products.slice(0, 6).map((product, i) => (
              <div key={i} className="flex items-center gap-2">
                {product.isPrimary && (
                  <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-700">{product.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Certifications</p>
          <div className="flex flex-wrap gap-1.5">
            {certifications.map((cert, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs"
              >
                <BadgeCheck className="h-3 w-3" />
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Service Areas */}
      {serviceAreas.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Service Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {displayedAreas.map((area, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
              >
                <MapPin className="h-3 w-3" />
                {area}
              </span>
            ))}
          </div>
          {serviceAreas.length > 6 && (
            <button
              onClick={() => setShowAllAreas(!showAllAreas)}
              className="text-xs text-blue-600 hover:underline mt-2"
            >
              {showAllAreas ? 'Show less' : `+${serviceAreas.length - 6} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewPainPointsCard({ painPoints }: { painPoints: ReviewPainPoint[] }) {
  if (!painPoints || painPoints.length === 0) return null;

  const severityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const categoryLabels: Record<string, string> = {
    wait_times: 'Wait Times',
    communication: 'Communication',
    pricing: 'Pricing',
    quality: 'Service Quality',
    scheduling: 'Scheduling',
    staff: 'Staff Issues',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Quote className="h-5 w-5 text-orange-500" />
        Review Pain Points ({painPoints.length})
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {painPoints.map((point, i) => (
          <div key={i} className="p-4 rounded-lg border border-gray-100 bg-gray-50">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-gray-900">
                {categoryLabels[point.category] || point.category}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{point.frequency} mentions</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full border whitespace-nowrap',
                  severityColors[point.severity]
                )}>
                  {point.severity}
                </span>
              </div>
            </div>
            {point.quotes && point.quotes.length > 0 && (
              <div className="space-y-2 mt-3">
                {point.quotes.slice(0, 2).map((quote, qi) => (
                  <div key={qi} className="flex gap-2">
                    <Quote className="h-3 w-3 text-gray-400 flex-shrink-0 mt-1" />
                    <p className="text-xs text-gray-600 italic">
                      "{quote}"
                    </p>
                  </div>
                ))}
              </div>
            )}
            {point.implication && (
              <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-200">
                <span className="font-medium">Implication:</span> {point.implication}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketingActivityCard({ profile }: { profile: MarketingProfile | null }) {
  if (!profile) return null;

  const maturityColors: Record<string, string> = {
    sophisticated: 'bg-green-100 text-green-700',
    active: 'bg-blue-100 text-blue-700',
    basic: 'bg-amber-100 text-amber-700',
    minimal: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-pink-500" />
        Marketing Activity
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Maturity Level</span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full capitalize',
            maturityColors[profile.maturityLevel] || 'bg-gray-100 text-gray-700'
          )}>
            {profile.maturityLevel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Digital Presence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  profile.digitalPresence >= 70 ? 'bg-green-500' :
                  profile.digitalPresence >= 40 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${profile.digitalPresence}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{profile.digitalPresence}/100</span>
          </div>
        </div>

        {profile.primaryChannels && profile.primaryChannels.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Primary Channels</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.primaryChannels.map((channel, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-purple-50/20 text-purple-700 rounded text-xs"
                >
                  {channel}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.contentStrategy && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Content Strategy</p>
            <p className="text-sm text-gray-700">{profile.contentStrategy}</p>
          </div>
        )}

        {profile.recommendation && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-800 mb-1">Recommended Approach</p>
            <p className="text-sm text-blue-700">{profile.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VisibleEmployeesCard({ employees }: { employees: VisibleEmployee[] }) {
  if (!employees || employees.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Mic className="h-5 w-5 text-indigo-500" />
        Visible Employees ({employees.length})
      </h3>
      <div className="space-y-3">
        {employees.slice(0, 5).map((emp, i) => (
          <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                {emp.title && (
                  <p className="text-xs text-gray-500">{emp.title}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    emp.linkedinActive ? 'bg-green-500' : 'bg-gray-300'
                  )} />
                  <Linkedin className="h-3 w-3 text-gray-400" />
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                  {emp.visibilityScore}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{emp.mediaAppearances} media mentions</span>
            </div>
            {emp.connectionOpportunity && (
              <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                <span className="font-medium">Connection:</span> {emp.connectionOpportunity}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EnhancedMarketingCard({ data }: { data: MarketingIntelligenceData }) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-violet-500" />
        Marketing Intelligence
        <span className={cn(
          'ml-auto text-sm px-2 py-0.5 rounded-full font-medium',
          getScoreColor(data.scores.overall)
        )}>
          {data.scores.overall}/100
        </span>
      </h3>

      {/* Score Breakdown */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Content', score: data.scores.content, icon: BookOpen },
          { label: 'Social', score: data.scores.social, icon: Users },
          { label: 'Reviews', score: data.scores.reviews, icon: Star },
          { label: 'Tech', score: data.scores.sophistication, icon: Zap },
        ].map(({ label, score, icon: Icon }) => (
          <div key={label} className="text-center p-2 rounded-lg bg-gray-50">
            <Icon className="h-4 w-4 mx-auto mb-1 text-gray-400" />
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-medium text-gray-900">{score}</p>
            <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', getProgressColor(score))}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Channel Overview */}
      <div className="space-y-3">
        {/* Blog */}
        {data.blog && (
          <div className={cn(
            'p-3 rounded-lg border',
            data.blog.exists ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className={cn('h-4 w-4', data.blog.exists ? 'text-green-600' : 'text-gray-400')} />
                <span className="text-sm font-medium text-gray-900">Blog</span>
                {data.blog.exists && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    {data.blog.platform || 'Active'}
                  </span>
                )}
              </div>
              {data.blog.exists ? (
                <div className="text-xs text-gray-500">
                  {data.blog.postCount} posts • {data.blog.postsLast30Days} last 30d
                </div>
              ) : (
                <span className="text-xs text-gray-400">Not detected</span>
              )}
            </div>
            {data.blog.exists && data.blog.topTopics && data.blog.topTopics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.blog.topTopics.slice(0, 4).map((topic, i) => (
                  <span key={i} className="text-xs bg-white px-1.5 py-0.5 rounded text-gray-600">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* YouTube */}
        {data.youtube && (
          <div className={cn(
            'p-3 rounded-lg border',
            data.youtube.exists ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className={cn('h-4 w-4', data.youtube.exists ? 'text-red-600' : 'text-gray-400')} />
                <span className="text-sm font-medium text-gray-900">YouTube</span>
                {data.youtube.exists && data.youtube.hasShorts && (
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                    Uses Shorts
                  </span>
                )}
              </div>
              {data.youtube.exists ? (
                <div className="text-xs text-gray-500">
                  {data.youtube.subscribers.toLocaleString()} subs • {data.youtube.videoCount} videos
                </div>
              ) : (
                <span className="text-xs text-gray-400">Not detected</span>
              )}
            </div>
            {data.youtube.exists && (
              <div className="mt-2 text-xs text-gray-500">
                {data.youtube.videosLast30Days > 0
                  ? `${data.youtube.videosLast30Days} videos in last 30 days`
                  : data.youtube.videosLast90Days > 0
                    ? `${data.youtube.videosLast90Days} videos in last 90 days`
                    : 'No recent uploads'}
              </div>
            )}
          </div>
        )}

        {/* Facebook */}
        {data.facebook && (
          <div className={cn(
            'p-3 rounded-lg border',
            data.facebook.exists ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Facebook className={cn('h-4 w-4', data.facebook.exists ? 'text-blue-600' : 'text-gray-400')} />
                <span className="text-sm font-medium text-gray-900">Facebook</span>
              </div>
              {data.facebook.exists ? (
                <div className="text-xs text-gray-500">
                  {data.facebook.followers.toLocaleString()} followers • {data.facebook.postsLast30Days} posts/30d
                </div>
              ) : (
                <span className="text-xs text-gray-400">Not detected</span>
              )}
            </div>
          </div>
        )}

        {/* Review Velocity */}
        {data.reviewVelocity && (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-gray-900">Review Velocity</span>
                {data.reviewVelocity.hasReviewManagement && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                    Managed
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                ~{data.reviewVelocity.combinedMonthlyReviews}/month • {data.reviewVelocity.combinedAvgRating.toFixed(1)} avg
              </div>
            </div>
          </div>
        )}

        {/* Website Marketing Tech */}
        {data.websiteMarketing && expanded && (
          <div className="p-3 rounded-lg border border-violet-200 bg-violet-50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-gray-900">Website Marketing Tech</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  data.websiteMarketing.email.hasNewsletterSignup ? 'bg-green-500' : 'bg-gray-300'
                )} />
                <span className="text-gray-600">Email Capture</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  data.websiteMarketing.conversion.hasLiveChat ? 'bg-green-500' : 'bg-gray-300'
                )} />
                <span className="text-gray-600">Live Chat</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  data.websiteMarketing.conversion.hasCallTracking ? 'bg-green-500' : 'bg-gray-300'
                )} />
                <span className="text-gray-600">Call Tracking</span>
              </div>
              {data.websiteMarketing.trust.trustBadges.length > 0 && (
                <div className="col-span-2 mt-1">
                  <span className="text-gray-500">Trust Badges: </span>
                  <span className="text-gray-700">{data.websiteMarketing.trust.trustBadges.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Show website tech details
          </>
        )}
      </button>
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
