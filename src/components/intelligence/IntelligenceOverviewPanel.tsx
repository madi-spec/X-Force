'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain,
  Building2,
  Users,
  MapPin,
  TrendingUp,
  Award,
  Server,
  AlertCircle,
  ChevronRight,
  Crown,
  Briefcase,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Extraction {
  id: string;
  company_name: string;
  ownership_type: string | null;
  family_generation: string | null;
  pe_firm: string | null;
  franchise_brand: string | null;
  owner_name: string | null;
  employee_count: number | null;
  employee_count_range: string | null;
  location_count: number | null;
  revenue: number | null;
  founded_year: number | null;
  years_in_business: number | null;
  bbb_rating: string | null;
  google_rating: number | null;
  pct_rank: number | null;
  fsm_vendor: string | null;
  tech_stack: Array<{ vendor: string; category: string; confidence?: string }>;
  hiring_activity: string | null;
  geographic_expansion: boolean | null;
  service_line_expansion: boolean | null;
  leadership_team: Array<{ name: string; title: string; is_decision_maker?: boolean }>;
  hq_city: string | null;
  hq_state: string | null;
  status: string;
  extraction_confidence: number | null;
  updated_at: string;
}

interface Research {
  id: string;
  confidence_score: number;
  key_findings: string[];
  summary: string;
  canonical_identity: {
    operating_name: string;
    ownership_type: string;
    family_generation?: string;
    pe_firm?: string;
  };
  tech_stack: Array<{ vendor: string; category: string; confidence: string }>;
  growth_signals: Array<{ signal: string; value: unknown; interpretation: string }>;
  researched_at: string;
}

interface IntelligenceOverviewPanelProps {
  companyId: string;
  companyName: string;
}

export function IntelligenceOverviewPanel({ companyId, companyName }: IntelligenceOverviewPanelProps) {
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [research, setResearch] = useState<Research | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasResearch, setHasResearch] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const researchRes = await fetch(`/api/intelligence-v61/${companyId}/research`);
      if (researchRes.ok) {
        setHasResearch(true);
        const researchData = await researchRes.json();
        setResearch(researchData.research);

        const extractRes = await fetch(`/api/intelligence-v61/${companyId}/extract`);
        if (extractRes.ok) {
          const extractData = await extractRes.json();
          setExtraction(extractData.extraction);
        }
      }
    } catch (error) {
      console.error('Error fetching intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOwnershipIcon = (type: string | null) => {
    switch (type) {
      case 'family': return Crown;
      case 'pe_backed': return Briefcase;
      case 'franchise': return Building2;
      default: return Building2;
    }
  };

  const getOwnershipLabel = (type: string | null) => {
    switch (type) {
      case 'family': return 'Family-Owned';
      case 'pe_backed': return 'PE-Backed';
      case 'franchise': return 'Franchise';
      case 'independent': return 'Independent';
      default: return 'Unknown';
    }
  };

  const getOwnershipColor = (type: string | null) => {
    switch (type) {
      case 'family': return 'bg-amber-100 text-amber-800';
      case 'pe_backed': return 'bg-purple-100 text-purple-800';
      case 'franchise': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRevenue = (revenue: number | null) => {
    if (!revenue) return null;
    if (revenue >= 1_000_000_000) return `$${(revenue / 1_000_000_000).toFixed(1)}B`;
    if (revenue >= 1_000_000) return `$${(revenue / 1_000_000).toFixed(1)}M`;
    if (revenue >= 1_000) return `$${(revenue / 1_000).toFixed(0)}K`;
    return `$${revenue}`;
  };

  const formatRevenueRange = (revenue: number | null, employeeRange: string | null) => {
    // If we have employee range like "51-200", calculate revenue range using $125K/employee
    if (employeeRange) {
      const rangeMatch = employeeRange.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch) {
        const empLow = parseInt(rangeMatch[1], 10);
        const empHigh = parseInt(rangeMatch[2], 10);
        const revLow = empLow * 125000;
        const revHigh = empHigh * 125000;
        return `${formatRevenue(revLow)}-${formatRevenue(revHigh)}`;
      }
    }
    // Fall back to single revenue value with ±25% range
    if (revenue) {
      const low = Math.round(revenue * 0.75);
      const high = Math.round(revenue * 1.25);
      return `${formatRevenue(low)}-${formatRevenue(high)}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Intelligence</h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!hasResearch) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Intelligence</h2>
        </div>
        <div className="text-center py-6">
          <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">
            No intelligence data collected yet
          </p>
          <Link
            href={`/companies/${companyId}?tab=research`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Brain className="h-4 w-4" />
            Run Research
          </Link>
        </div>
      </div>
    );
  }

  // Use research data as fallback when extraction isn't available
  const ownershipType = extraction?.ownership_type || research?.canonical_identity?.ownership_type || null;
  const OwnershipIcon = getOwnershipIcon(ownershipType);
  const techStack = extraction?.tech_stack || research?.tech_stack || [];
  const fsmVendor = extraction?.fsm_vendor || techStack.find(t => t.category === 'fsm')?.vendor;
  const leadership = extraction?.leadership_team || [];
  const decisionMakers = leadership.filter(l => l.is_decision_maker);
  const keyFindings = research?.key_findings || [];
  const growthSignals = research?.growth_signals || [];
  const confidenceScore = research?.confidence_score || extraction?.extraction_confidence;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Intelligence</h2>
          {confidenceScore && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              confidenceScore >= 80 ? 'bg-green-100 text-green-700' :
              confidenceScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            )}>
              {confidenceScore}% confidence
            </span>
          )}
        </div>
        <Link
          href={`/companies/${companyId}?tab=research`}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Full Report
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Key Findings */}
        {keyFindings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Key Findings</p>
            <ul className="space-y-1">
              {keyFindings.slice(0, 3).map((finding, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{finding}</span>
                </li>
              ))}
              {keyFindings.length > 3 && (
                <li className="text-xs text-gray-500">+{keyFindings.length - 3} more findings</li>
              )}
            </ul>
          </div>
        )}

        {/* Ownership Badge */}
        <div className="flex items-center gap-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full',
            getOwnershipColor(ownershipType)
          )}>
            <OwnershipIcon className="h-4 w-4" />
            {getOwnershipLabel(ownershipType)}
          </span>
          {(extraction?.family_generation || research?.canonical_identity?.family_generation) && (
            <span className="text-sm text-gray-500">
              {extraction?.family_generation || research?.canonical_identity?.family_generation}
            </span>
          )}
          {(extraction?.pe_firm || research?.canonical_identity?.pe_firm) && (
            <span className="text-sm text-gray-500">
              ({extraction?.pe_firm || research?.canonical_identity?.pe_firm})
            </span>
          )}
        </div>

        {/* Key Metrics Grid */}
        {extraction && (
          <div className="grid grid-cols-2 gap-4">
            {/* Size */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Size</p>
              <div className="flex items-center gap-2 text-sm text-gray-900">
                <Users className="h-4 w-4 text-gray-400" />
                <span>
                  {extraction.employee_count_range || extraction.employee_count?.toLocaleString() || '—'} employees
                </span>
              </div>
              {extraction.location_count && (
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{extraction.location_count} locations</span>
                </div>
              )}
            </div>

            {/* Financials */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Financials</p>
              <div className="flex items-center gap-2 text-sm text-gray-900">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span>{formatRevenueRange(extraction.revenue, extraction.employee_count_range) || '—'} revenue</span>
              </div>
              {extraction.pct_rank && (
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span>PCT Top 100: #{extraction.pct_rank}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Technology */}
        {fsmVendor && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Technology</p>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{fsmVendor}</span>
              {techStack.length > 1 && (
                <span className="text-xs text-gray-500">
                  +{techStack.length - 1} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Decision Makers */}
        {decisionMakers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Decision Makers</p>
            <div className="space-y-1">
              {decisionMakers.slice(0, 3).map((person, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">{person.name}</span>
                  <span className="text-gray-500">—</span>
                  <span className="text-gray-500">{person.title}</span>
                </div>
              ))}
              {decisionMakers.length > 3 && (
                <p className="text-xs text-gray-500">
                  +{decisionMakers.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Growth Signals - from extraction or research */}
        {(extraction?.hiring_activity || extraction?.geographic_expansion || extraction?.service_line_expansion || growthSignals.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Growth Signals</p>
            <div className="flex flex-wrap gap-2">
              {extraction?.hiring_activity && extraction.hiring_activity !== 'none' && (
                <span className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  extraction.hiring_activity === 'very_high' || extraction.hiring_activity === 'high'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                )}>
                  Hiring: {extraction.hiring_activity.replace('_', ' ')}
                </span>
              )}
              {extraction?.geographic_expansion && (
                <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                  Geographic Expansion
                </span>
              )}
              {extraction?.service_line_expansion && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                  Service Expansion
                </span>
              )}
              {/* Show research growth signals if no extraction signals */}
              {!extraction && growthSignals.slice(0, 3).map((signal, idx) => (
                <span key={idx} className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                  {signal.signal}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ratings */}
        {(extraction?.bbb_rating || extraction?.google_rating) && (
          <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
            {extraction.bbb_rating && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-gray-500">BBB:</span>
                <span className="font-medium text-gray-900">{extraction.bbb_rating}</span>
              </div>
            )}
            {extraction.google_rating && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="font-medium text-gray-900">{extraction.google_rating}</span>
              </div>
            )}
          </div>
        )}

        {/* Extract prompt if research exists but no extraction */}
        {!extraction && (
          <div className="pt-2 border-t border-gray-100">
            <Link
              href={`/companies/${companyId}?tab=research`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Extract structured data →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
