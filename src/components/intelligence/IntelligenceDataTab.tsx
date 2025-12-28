'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  RefreshCw,
  Building2,
  Globe,
  Star,
  Megaphone,
  Cpu,
  DollarSign,
  Package,
  Users,
  Newspaper,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Sparkles,
  BarChart3,
  Mail,
  Phone,
  Linkedin,
  Pencil,
  Loader2,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { DataField, ListDataField } from './DataField';
import type {
  CompanyIntelligence,
  IntelligenceAnalysis,
  KeyPerson,
  IndustryMention,
  SourcedField,
  FieldDefinition,
  FIELD_DEFINITIONS,
} from '@/lib/intelligence/dataLayerTypes';

// ============================================
// TYPES
// ============================================

interface IntelligenceDataTabProps {
  companyId: string;
  companyName: string;
  initialDomain?: string | null;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}

// ============================================
// COLLAPSIBLE SECTION
// ============================================

function Section({ title, icon, children, defaultOpen = true, badge }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-500">{icon}</div>
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
// KEY PERSON CARD
// ============================================

function KeyPersonCard({
  person,
  companyId,
  onContactCreated,
}: {
  person: KeyPerson;
  companyId: string;
  onContactCreated?: (contactId: string) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);

  const handleAddToContacts = async () => {
    if (isCreating || isCreated) return;

    try {
      setIsCreating(true);

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: person.name,
          title: person.title || null,
          email: person.email || null,
          phone: person.phone || null,
          linkedin_url: person.linkedinUrl || null,
          seniority: person.seniority || null,
          department: person.department || null,
          source: 'intelligence',
          notes: `Discovered via ${person.source || 'intelligence'} collection`,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create contact');
      }

      const data = await res.json();
      setIsCreated(true);
      onContactCreated?.(data.id);
    } catch (error) {
      console.error('Error creating contact:', error);
      alert(error instanceof Error ? error.message : 'Failed to create contact');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start gap-3">
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <Users className="h-5 w-5 text-gray-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {person.name}
              </h4>
              {person.isDecisionMaker && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded shrink-0">
                  DM
                </span>
              )}
            </div>

            {/* Add to Contacts button */}
            <button
              onClick={handleAddToContacts}
              disabled={isCreating || isCreated}
              className={cn(
                'px-2 py-1 text-[10px] font-medium rounded transition-colors shrink-0',
                isCreated
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : isCreating
                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              )}
            >
              {isCreated ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Added
                </span>
              ) : isCreating ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Adding...
                </span>
              ) : (
                '+ Contact'
              )}
            </button>
          </div>

          {person.title && (
            <p className="text-xs text-gray-500 truncate">
              {person.title}
            </p>
          )}

          {person.seniority && (
            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded capitalize">
              {person.seniority.replace('_', ' ')}
            </span>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
              >
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{person.email}</span>
              </a>
            )}
            {person.phone && (
              <a
                href={`tel:${person.phone}`}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
              >
                <Phone className="h-3 w-3" />
                <span>{person.phone}</span>
              </a>
            )}
            {person.linkedinUrl && (
              <a
                href={person.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
              >
                <Linkedin className="h-3 w-3" />
                <span>LinkedIn</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INDUSTRY MENTION CARD
// ============================================

function MentionCard({ mention }: { mention: IndustryMention }) {
  const sentimentColors = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-gray-100 text-gray-700',
    negative: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={mention.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
          >
            {mention.title}
          </a>

          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{mention.source}</span>
            {mention.date && (
              <>
                <span>-</span>
                <span>{new Date(mention.date).toLocaleDateString()}</span>
              </>
            )}
          </div>

          {mention.snippet && (
            <p className="mt-2 text-xs text-gray-600 line-clamp-2">
              {mention.snippet}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 items-end">
          <span className={cn('px-2 py-0.5 text-[10px] font-medium rounded', sentimentColors[mention.sentiment])}>
            {mention.sentiment}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
            {mention.type}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPLETENESS INDICATOR
// ============================================

function CompletenessBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600">
        {score}%
      </span>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

// Classification type labels
const COMPANY_TYPE_LABELS: Record<string, string> = {
  pe_backed_platform: 'PE-Backed Platform',
  family_owned_enterprise: 'Family-Owned Enterprise',
  franchise_system: 'Franchise System',
  growth_stage_regional: 'Growth-Stage Regional',
  local_operator: 'Local Operator',
  unknown: 'Unknown',
};

interface CompanyClassification {
  type: string;
  confidence: 'high' | 'medium' | 'low';
  estimatedTier: string;
  ownershipDetails: string | null;
  peBackerName: string | null;
  tags: string[];
  salesApproach: {
    primaryFocus: string;
    keyDecisionMakers: string[];
    valueProposition: string;
    recommendedEntryPoint: string;
  };
}

interface SalesReport {
  markdown: string;
  generatedAt: string;
  dataQualityScore: number;
}

export function IntelligenceDataTab({ companyId, companyName, initialDomain }: IntelligenceDataTabProps) {
  const [intelligence, setIntelligence] = useState<CompanyIntelligence | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<IntelligenceAnalysis | null>(null);
  const [classification, setClassification] = useState<CompanyClassification | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState(initialDomain || '');
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [isRegeneratingReport, setIsRegeneratingReport] = useState(false);

  // Fetch intelligence data
  const fetchIntelligence = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v2/${companyId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch intelligence data');
      }

      const data = await res.json();
      setIntelligence(data.intelligence);
      setLatestAnalysis(data.latestAnalysis);
      // Update domain from company record if available
      if (data.companyDomain && !domain) {
        setDomain(data.companyDomain);
      }
    } catch (err) {
      console.error('Error fetching intelligence:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, domain]);

  // Initial fetch
  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  // Save domain to company record
  const saveDomain = async (newDomain: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      if (!res.ok) {
        throw new Error('Failed to save domain');
      }
      setDomain(newDomain);
      setIsEditingDomain(false);
    } catch (err) {
      console.error('Error saving domain:', err);
      setError(err instanceof Error ? err.message : 'Failed to save domain');
    }
  };

  // Collect new intelligence
  const handleCollect = async () => {
    // Require domain before collection
    if (!domain) {
      setError('Please enter a domain before collecting intelligence');
      setIsEditingDomain(true);
      return;
    }

    try {
      setIsCollecting(true);
      setError(null);

      // Save domain first if it's not saved yet
      await saveDomain(domain);

      const res = await fetch(`/api/intelligence-v2/${companyId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to collect intelligence');
      }

      const data = await res.json();
      setIntelligence(data.intelligence);

      // Store classification and sales report from collection
      if (data.classification) {
        setClassification(data.classification);
      }
      if (data.salesReport) {
        setSalesReport(data.salesReport);
      }
    } catch (err) {
      console.error('Error collecting intelligence:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCollecting(false);
    }
  };

  // Regenerate sales report from existing data
  const handleRegenerateReport = async () => {
    try {
      setIsRegeneratingReport(true);
      setError(null);

      const res = await fetch(`/api/intelligence-v2/${companyId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to regenerate report');
      }

      const data = await res.json();

      if (data.classification) {
        setClassification(data.classification);
      }
      if (data.salesReport) {
        setSalesReport(data.salesReport);
        setShowSalesReport(true); // Auto-show the regenerated report
      }
    } catch (err) {
      console.error('Error regenerating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate report');
    } finally {
      setIsRegeneratingReport(false);
    }
  };

  // Update a field
  const handleUpdateField = async (
    category: string,
    fieldKey: string,
    value: unknown,
    source?: string,
    sourceUrl?: string,
    reason?: string
  ) => {
    if (!intelligence) return;

    try {
      setIsUpdating(true);

      const res = await fetch(`/api/intelligence-v2/${companyId}/field`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldPath: `${category}.${fieldKey}`,
          value,
          source: source || 'manual',
          sourceUrl,
          reason,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update field');
      }

      const data = await res.json();
      setIntelligence(data.intelligence);
    } catch (err) {
      console.error('Error updating field:', err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  // Navigate to AI Analysis page
  const handleOpenAnalysis = () => {
    window.location.href = `/companies/${companyId}/intelligence/analysis`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading intelligence data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !intelligence) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchIntelligence}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-normal text-gray-900">
            Company Intelligence
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {intelligence?.last_collected_at
              ? `Last updated ${formatRelativeTime(new Date(intelligence.last_collected_at))}`
              : 'No data collected yet'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Analysis Button */}
          <button
            onClick={handleOpenAnalysis}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
          >
            <Sparkles className="h-4 w-4" />
            AI Analysis
          </button>

          {/* Collect Button */}
          <button
            onClick={handleCollect}
            disabled={isCollecting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors border',
              isCollecting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isCollecting && 'animate-spin')} />
            {isCollecting ? 'Collecting...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Domain Input Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Globe className="h-4 w-4" />
            <span className="font-medium">Domain:</span>
          </div>

          {isEditingDomain || !domain ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && domain) {
                    saveDomain(domain);
                  }
                }}
                autoFocus={isEditingDomain}
              />
              {domain && (
                <>
                  <button
                    onClick={() => saveDomain(domain)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  {isEditingDomain && (
                    <button
                      onClick={() => setIsEditingDomain(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                {domain}
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => setIsEditingDomain(true)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          {!domain && (
            <p className="text-xs text-amber-600">
              Enter a domain to enable website and social media collection
            </p>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-500"
          >
            ×
          </button>
        </div>
      )}

      {/* Data Completeness */}
      {intelligence && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Data Completeness
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {intelligence.completeness_score >= 80
                ? 'Excellent'
                : intelligence.completeness_score >= 50
                ? 'Good'
                : 'Needs Data'}
            </span>
          </div>
          <CompletenessBar score={intelligence.completeness_score} />
        </div>
      )}

      {/* Classification & Sales Intelligence */}
      {classification && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-900">
                  Sales Intelligence Classification
                </h3>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  classification.confidence === 'high' ? 'bg-green-100 text-green-700' :
                  classification.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {classification.confidence} confidence
                </span>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <div className="px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-500 block">Company Type</span>
                  <span className="text-sm font-medium text-gray-900">
                    {COMPANY_TYPE_LABELS[classification.type] || classification.type}
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-500 block">Tier</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {classification.estimatedTier?.replace('_', ' ')}
                  </span>
                </div>
                {classification.peBackerName && (
                  <div className="px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-500 block">PE Backer</span>
                    <span className="text-sm font-medium text-gray-900">
                      {classification.peBackerName}
                    </span>
                  </div>
                )}
              </div>

              {/* Classification Tags */}
              {classification.tags && classification.tags.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {classification.tags.map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        tag === 'PCT_TOP_100' ? 'bg-amber-100 text-amber-800' :
                        tag === 'FAST_GROWING' ? 'bg-green-100 text-green-800' :
                        tag === 'PE_BACKED' ? 'bg-purple-100 text-purple-800' :
                        tag === 'ACTIVE_ACQUIRER' ? 'bg-blue-100 text-blue-800' :
                        tag === 'FAMILY_BUSINESS' ? 'bg-orange-100 text-orange-800' :
                        tag === 'QUALITYPRO_CERTIFIED' ? 'bg-emerald-100 text-emerald-800' :
                        tag === 'MULTI_LOCATION' ? 'bg-cyan-100 text-cyan-800' :
                        'bg-gray-100 text-gray-700'
                      )}
                    >
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {classification.salesApproach && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Primary Focus: </span>
                  {classification.salesApproach.primaryFocus}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {salesReport && (
                <button
                  onClick={() => setShowSalesReport(!showSalesReport)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  {showSalesReport ? 'Hide' : 'View'} Sales Report
                </button>
              )}
              {/* Regenerate Report Button - always show if intelligence exists */}
              {intelligence && (
                <button
                  onClick={handleRegenerateReport}
                  disabled={isRegeneratingReport}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {isRegeneratingReport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isRegeneratingReport ? 'Regenerating...' : (salesReport ? 'Regenerate Report' : 'Generate Report')}
                </button>
              )}
              {salesReport && (
                <span className="text-xs text-gray-500 text-center">
                  Quality: {salesReport.dataQualityScore}%
                </span>
              )}
            </div>
          </div>

          {/* Sales Report Markdown */}
          {showSalesReport && salesReport && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="bg-white rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                  {salesReport.markdown}
                </pre>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Generated: {new Date(salesReport.generatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Generate Report Button - show when intelligence exists but no classification yet */}
      {intelligence && !classification && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Sales Intelligence Report
                </h3>
                <p className="text-xs text-gray-500">
                  Generate a classification and sales report from the collected data
                </p>
              </div>
            </div>
            <button
              onClick={handleRegenerateReport}
              disabled={isRegeneratingReport}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isRegeneratingReport ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isRegeneratingReport ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {/* Company Profile Section */}
      {intelligence && (
        <Section
          title="Company Profile"
          icon={<Building2 className="h-5 w-5" />}
          defaultOpen={true}
        >
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-6">
            <DataField
              field={{ key: 'founded_year', label: 'Founded', category: 'company_profile', type: 'number', editable: true }}
              data={intelligence.company_profile.founded_year}
              onUpdate={(v, s, u, r) => handleUpdateField('company_profile', 'founded_year', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'employee_count', label: 'Employees', category: 'company_profile', type: 'number', editable: true }}
              data={intelligence.company_profile.employee_count}
              onUpdate={(v, s, u, r) => handleUpdateField('company_profile', 'employee_count', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'headquarters', label: 'Headquarters', category: 'company_profile', type: 'text', editable: true }}
              data={intelligence.company_profile.headquarters}
              onUpdate={(v, s, u, r) => handleUpdateField('company_profile', 'headquarters', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'locations_count', label: 'Locations', category: 'company_profile', type: 'number', editable: true }}
              data={intelligence.company_profile.locations_count}
              onUpdate={(v, s, u, r) => handleUpdateField('company_profile', 'locations_count', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'company_type', label: 'Company Type', category: 'company_profile', type: 'text', editable: true }}
              data={intelligence.company_profile.company_type}
              onUpdate={(v, s, u, r) => handleUpdateField('company_profile', 'company_type', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'ownership', label: 'Ownership', category: 'company_profile', type: 'text', editable: true }}
              data={intelligence.company_profile.ownership}
              onUpdate={(v, s, u, r) => handleUpdateField('company_profile', 'ownership', v, s, u, r)}
              isUpdating={isUpdating}
            />
          </div>
        </Section>
      )}

      {/* Online Presence Section */}
      {intelligence && (
        <Section
          title="Online Presence"
          icon={<Globe className="h-5 w-5" />}
          defaultOpen={true}
        >
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-6">
            <DataField
              field={{ key: 'website_url', label: 'Website', category: 'online_presence', type: 'url', editable: true }}
              data={intelligence.online_presence.website_url}
              onUpdate={(v, s, u, r) => handleUpdateField('online_presence', 'website_url', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'linkedin_url', label: 'LinkedIn', category: 'online_presence', type: 'url', editable: true }}
              data={intelligence.online_presence.linkedin_url}
              onUpdate={(v, s, u, r) => handleUpdateField('online_presence', 'linkedin_url', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'linkedin_followers', label: 'LinkedIn Followers', category: 'online_presence', type: 'number', editable: true }}
              data={intelligence.online_presence.linkedin_followers}
              onUpdate={(v, s, u, r) => handleUpdateField('online_presence', 'linkedin_followers', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'facebook_url', label: 'Facebook', category: 'online_presence', type: 'url', editable: true }}
              data={intelligence.online_presence.facebook_url}
              onUpdate={(v, s, u, r) => handleUpdateField('online_presence', 'facebook_url', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'facebook_followers', label: 'Facebook Followers', category: 'online_presence', type: 'number', editable: true }}
              data={intelligence.online_presence.facebook_followers}
              onUpdate={(v, s, u, r) => handleUpdateField('online_presence', 'facebook_followers', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'youtube_url', label: 'YouTube', category: 'online_presence', type: 'url', editable: true }}
              data={intelligence.online_presence.youtube_url}
              onUpdate={(v, s, u, r) => handleUpdateField('online_presence', 'youtube_url', v, s, u, r)}
              isUpdating={isUpdating}
            />
          </div>
        </Section>
      )}

      {/* Reviews Section */}
      {intelligence && (
        <Section
          title="Reviews"
          icon={<Star className="h-5 w-5" />}
          defaultOpen={true}
          badge={
            intelligence.reviews.google_rating.value !== null && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />
                {intelligence.reviews.google_rating.value}
              </span>
            )
          }
        >
          <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-6">
            <DataField
              field={{ key: 'google_rating', label: 'Google Rating', category: 'reviews', type: 'number', editable: false }}
              data={intelligence.reviews.google_rating}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'google_review_count', label: 'Google Reviews', category: 'reviews', type: 'number', editable: false }}
              data={intelligence.reviews.google_review_count}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'facebook_rating', label: 'Facebook Rating', category: 'reviews', type: 'number', editable: false }}
              data={intelligence.reviews.facebook_rating}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'review_velocity_30d', label: 'Reviews (30 days)', category: 'reviews', type: 'number', editable: false }}
              data={intelligence.reviews.review_velocity_30d}
              isUpdating={isUpdating}
            />
          </div>
        </Section>
      )}

      {/* Marketing Section */}
      {intelligence && (
        <Section
          title="Marketing Activity"
          icon={<Megaphone className="h-5 w-5" />}
          defaultOpen={true}
        >
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-6">
            <DataField
              field={{ key: 'has_blog', label: 'Has Blog', category: 'marketing', type: 'boolean', editable: false }}
              data={intelligence.marketing.has_blog}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'blog_url', label: 'Blog URL', category: 'marketing', type: 'url', editable: true }}
              data={intelligence.marketing.blog_url}
              onUpdate={(v, s, u, r) => handleUpdateField('marketing', 'blog_url', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'blog_post_frequency', label: 'Blog Frequency', category: 'marketing', type: 'text', editable: false }}
              data={intelligence.marketing.blog_post_frequency}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'marketing_sophistication', label: 'Sophistication', category: 'marketing', type: 'text', editable: false }}
              data={intelligence.marketing.marketing_sophistication}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'email_marketing', label: 'Email Marketing', category: 'marketing', type: 'boolean', editable: true }}
              data={intelligence.marketing.email_marketing}
              onUpdate={(v, s, u, r) => handleUpdateField('marketing', 'email_marketing', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'has_paid_ads', label: 'Paid Ads', category: 'marketing', type: 'boolean', editable: true }}
              data={intelligence.marketing.has_paid_ads}
              onUpdate={(v, s, u, r) => handleUpdateField('marketing', 'has_paid_ads', v, s, u, r)}
              isUpdating={isUpdating}
            />
          </div>
        </Section>
      )}

      {/* Technology Section */}
      {intelligence && (
        <Section
          title="Technology Stack"
          icon={<Cpu className="h-5 w-5" />}
          defaultOpen={true}
        >
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-6">
            <DataField
              field={{ key: 'crm_system', label: 'CRM System', category: 'technology', type: 'text', editable: true, placeholder: 'e.g., FieldRoutes' }}
              data={intelligence.technology.crm_system}
              onUpdate={(v, s, u, r) => handleUpdateField('technology', 'crm_system', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'routing_software', label: 'Routing Software', category: 'technology', type: 'text', editable: true }}
              data={intelligence.technology.routing_software}
              onUpdate={(v, s, u, r) => handleUpdateField('technology', 'routing_software', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'phone_system', label: 'Phone System', category: 'technology', type: 'text', editable: true }}
              data={intelligence.technology.phone_system}
              onUpdate={(v, s, u, r) => handleUpdateField('technology', 'phone_system', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'website_platform', label: 'Website Platform', category: 'technology', type: 'text', editable: false }}
              data={intelligence.technology.website_platform}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'has_online_booking', label: 'Online Booking', category: 'technology', type: 'boolean', editable: false }}
              data={intelligence.technology.has_online_booking}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'has_live_chat', label: 'Live Chat', category: 'technology', type: 'boolean', editable: false }}
              data={intelligence.technology.has_live_chat}
              isUpdating={isUpdating}
            />
          </div>

          {/* Detected Technologies */}
          {intelligence.technology.detected_technologies.value &&
            intelligence.technology.detected_technologies.value.length > 0 && (
              <div className="mt-6">
                <ListDataField
                  field={{ key: 'detected_technologies', label: 'Detected Technologies', category: 'technology', type: 'list', editable: false }}
                  data={intelligence.technology.detected_technologies as SourcedField<string[]>}
                  isUpdating={isUpdating}
                />
              </div>
            )}
        </Section>
      )}

      {/* Financial Section */}
      {intelligence && (
        <Section
          title="Financial Indicators"
          icon={<DollarSign className="h-5 w-5" />}
          defaultOpen={false}
        >
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-6">
            <DataField
              field={{ key: 'estimated_revenue', label: 'Estimated Revenue', category: 'financial', type: 'currency', editable: true }}
              data={intelligence.financial.estimated_revenue}
              onUpdate={(v, s, u, r) => handleUpdateField('financial', 'estimated_revenue', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'funding_status', label: 'Funding Status', category: 'financial', type: 'text', editable: true }}
              data={intelligence.financial.funding_status}
              onUpdate={(v, s, u, r) => handleUpdateField('financial', 'funding_status', v, s, u, r)}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'hiring_activity', label: 'Hiring Activity', category: 'financial', type: 'text', editable: false }}
              data={intelligence.financial.hiring_activity}
              isUpdating={isUpdating}
            />
            <DataField
              field={{ key: 'job_postings_count', label: 'Open Positions', category: 'financial', type: 'number', editable: false }}
              data={intelligence.financial.job_postings_count}
              isUpdating={isUpdating}
            />
          </div>
        </Section>
      )}

      {/* Services Section */}
      {intelligence && (
        <Section
          title="Services & Operations"
          icon={<Package className="h-5 w-5" />}
          defaultOpen={false}
        >
          <div className="pt-4 space-y-6">
            <ListDataField
              field={{ key: 'primary_services', label: 'Primary Services', category: 'services', type: 'list', editable: true }}
              data={intelligence.services.primary_services as SourcedField<string[]>}
              onUpdate={(v, s) => handleUpdateField('services', 'primary_services', v, s)}
              isUpdating={isUpdating}
            />
            <ListDataField
              field={{ key: 'service_areas', label: 'Service Areas', category: 'services', type: 'list', editable: true }}
              data={intelligence.services.service_areas as SourcedField<string[]>}
              onUpdate={(v, s) => handleUpdateField('services', 'service_areas', v, s)}
              isUpdating={isUpdating}
            />
            <ListDataField
              field={{ key: 'certifications', label: 'Certifications', category: 'services', type: 'list', editable: true }}
              data={intelligence.services.certifications as SourcedField<string[]>}
              onUpdate={(v, s) => handleUpdateField('services', 'certifications', v, s)}
              isUpdating={isUpdating}
            />
            <ListDataField
              field={{ key: 'awards', label: 'Awards', category: 'services', type: 'list', editable: true }}
              data={intelligence.services.awards as SourcedField<string[]>}
              onUpdate={(v, s) => handleUpdateField('services', 'awards', v, s)}
              isUpdating={isUpdating}
            />
          </div>
        </Section>
      )}

      {/* Key People Section */}
      {intelligence && intelligence.key_people.length > 0 && (
        <Section
          title="Key People"
          icon={<Users className="h-5 w-5" />}
          defaultOpen={true}
          badge={
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {intelligence.key_people.length}
            </span>
          }
        >
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {intelligence.key_people.slice(0, 10).map((person, index) => (
              <KeyPersonCard key={index} person={person} companyId={companyId} />
            ))}
          </div>
          {intelligence.key_people.length > 10 && (
            <p className="mt-4 text-xs text-gray-500 text-center">
              And {intelligence.key_people.length - 10} more...
            </p>
          )}
        </Section>
      )}

      {/* Industry Mentions Section */}
      {intelligence && intelligence.industry_mentions.length > 0 && (
        <Section
          title="Industry Mentions"
          icon={<Newspaper className="h-5 w-5" />}
          defaultOpen={false}
          badge={
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {intelligence.industry_mentions.length}
            </span>
          }
        >
          <div className="pt-4 space-y-3">
            {intelligence.industry_mentions.slice(0, 5).map((mention, index) => (
              <MentionCard key={index} mention={mention} />
            ))}
          </div>
          {intelligence.industry_mentions.length > 5 && (
            <p className="mt-4 text-xs text-gray-500 text-center">
              And {intelligence.industry_mentions.length - 5} more mentions...
            </p>
          )}
        </Section>
      )}

      {/* Empty State */}
      {!intelligence && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Brain className="h-12 w-12 text-gray-300" />
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-900">
              No Intelligence Data
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Start collecting intelligence about {companyName}
            </p>
          </div>
          <button
            onClick={handleCollect}
            disabled={isCollecting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', isCollecting && 'animate-spin')} />
            {isCollecting ? 'Collecting...' : 'Collect Intelligence'}
          </button>
        </div>
      )}
    </div>
  );
}

export default IntelligenceDataTab;
