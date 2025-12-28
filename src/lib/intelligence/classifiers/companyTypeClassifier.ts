/**
 * Company Type Classifier
 * Classifies companies into strategic segments for sales approach customization
 */

import type { CompanyIntelligence } from '../dataLayerTypes';
import type { SerperResearchData } from '../collectors/serperResearchCollector';

// ============================================
// TYPES
// ============================================

export type CompanyType =
  | 'pe_backed_platform'
  | 'family_owned_enterprise'
  | 'franchise_system'
  | 'growth_stage_regional'
  | 'local_operator'
  | 'unknown';

export interface CompanyTypeClassification {
  type: CompanyType;
  confidence: 'high' | 'medium' | 'low';

  // Classification signals
  signals: ClassificationSignal[];

  // Additional tags (e.g., PCT_TOP_100, ACTIVE_ACQUIRER, FAST_GROWING)
  tags: string[];

  // Sales approach recommendations based on type
  salesApproach: SalesApproachRecommendation;

  // Additional context
  ownershipDetails: string | null;
  peBackerName: string | null;
  estimatedTier: 'enterprise' | 'mid_market' | 'smb' | 'startup';
}

export interface ClassificationSignal {
  signal: string;
  weight: number;
  source: string;
  contributesToType: CompanyType[];
}

export interface SalesApproachRecommendation {
  primaryFocus: string;
  keyDecisionMakers: string[];
  valueProposition: string;
  objectionCategories: string[];
  timingConsiderations: string;
  recommendedEntryPoint: string;
}

// ============================================
// CLASSIFICATION RULES
// ============================================

const COMPANY_TYPE_DEFINITIONS: Record<CompanyType, {
  description: string;
  criteria: string[];
  salesFocus: SalesApproachRecommendation;
}> = {
  pe_backed_platform: {
    description: 'Private equity backed company focused on acquisitions and platform growth',
    criteria: [
      'Has PE investment or is part of PE portfolio',
      'Multiple acquisitions in recent years',
      'Aggressive growth strategy',
      'Professional management team',
      'Multi-location operation',
    ],
    salesFocus: {
      primaryFocus: 'Operational efficiency and scalability',
      keyDecisionMakers: ['VP Operations', 'CTO', 'COO', 'CFO'],
      valueProposition: 'Enterprise-scale efficiency gains that improve EBITDA and support M&A integration',
      objectionCategories: ['Integration complexity', 'ROI timeline', 'Contract flexibility for acquisitions'],
      timingConsiderations: 'Best timing is post-acquisition during integration or during annual budget planning',
      recommendedEntryPoint: 'Operations or technology leadership via referral from PE portfolio companies',
    },
  },

  family_owned_enterprise: {
    description: 'Established family business with multi-generational ownership',
    criteria: [
      'Founded 20+ years ago',
      'Owner/founder still involved or next generation',
      'Strong local/regional brand recognition',
      'Conservative growth approach',
      'Employee tenure often 10+ years',
    ],
    salesFocus: {
      primaryFocus: 'Legacy preservation and next-generation transition',
      keyDecisionMakers: ['Owner', 'President', 'GM', 'Next-gen family member'],
      valueProposition: 'Modernize operations while preserving what makes the business special, prepare for succession',
      objectionCategories: ['Change resistance', 'Technology complexity', 'Employee adoption', 'Cost'],
      timingConsiderations: 'Best timing during succession planning or when next generation takes more responsibility',
      recommendedEntryPoint: 'Direct to owner, industry events, peer referrals from similar family businesses',
    },
  },

  franchise_system: {
    description: 'Franchise network with corporate and franchisee structure',
    criteria: [
      'Operates as franchisor or franchisee',
      'Multiple locations with franchise model',
      'Standardized operations',
      'Corporate oversight',
    ],
    salesFocus: {
      primaryFocus: 'Standardization and franchisor/franchisee alignment',
      keyDecisionMakers: ['VP Franchise Operations', 'Corporate IT', 'Regional Directors'],
      valueProposition: 'System-wide consistency and visibility while supporting individual franchisee success',
      objectionCategories: ['Franchisee buy-in', 'System integration', 'Per-location economics'],
      timingConsiderations: 'Best timing during annual franchise conventions or system-wide initiatives',
      recommendedEntryPoint: 'Corporate leadership, present at franchise conventions, pilot with top franchisees',
    },
  },

  growth_stage_regional: {
    description: 'Growing regional player expanding beyond initial market',
    criteria: [
      'Founded 5-15 years ago',
      'Expanding into new markets',
      'Professionalizing operations',
      'Hiring for growth roles',
      '20-100 employees',
    ],
    salesFocus: {
      primaryFocus: 'Scaling operations and supporting expansion',
      keyDecisionMakers: ['Owner', 'Operations Manager', 'GM'],
      valueProposition: 'Scale without adding overhead, maintain service quality during growth',
      objectionCategories: ['Implementation disruption', 'Cash flow timing', 'Training resources'],
      timingConsiderations: 'Best timing during expansion planning or after pain from rapid growth',
      recommendedEntryPoint: 'Owner direct outreach, industry peer referrals, targeted advertising',
    },
  },

  local_operator: {
    description: 'Local business serving a single market',
    criteria: [
      'Single location or small service area',
      'Owner-operator model',
      'Under 20 employees',
      'Focus on local reputation',
    ],
    salesFocus: {
      primaryFocus: 'Immediate ROI and operational simplicity',
      keyDecisionMakers: ['Owner'],
      valueProposition: 'Simple tools that save time and help compete with larger players',
      objectionCategories: ['Price sensitivity', 'Time to learn', 'Existing relationships'],
      timingConsiderations: 'Best timing during slow season or when facing competitive pressure',
      recommendedEntryPoint: 'Direct to owner, local trade associations, referral from non-competing businesses',
    },
  },

  unknown: {
    description: 'Insufficient data to classify',
    criteria: ['Limited information available'],
    salesFocus: {
      primaryFocus: 'Discovery and relationship building',
      keyDecisionMakers: ['Owner', 'Manager'],
      valueProposition: 'Tailored solution based on specific needs',
      objectionCategories: ['Standard objections'],
      timingConsiderations: 'Gather more information before determining approach',
      recommendedEntryPoint: 'Discovery call to understand their situation',
    },
  },
};

// ============================================
// CLASSIFIER
// ============================================

export class CompanyTypeClassifier {
  /**
   * Classify a company based on intelligence data
   */
  classify(
    intelligence: CompanyIntelligence,
    research?: SerperResearchData
  ): CompanyTypeClassification {
    const signals: ClassificationSignal[] = [];

    // Gather signals from various sources
    this.gatherOwnershipSignals(intelligence, research, signals);
    this.gatherSizeSignals(intelligence, signals);
    this.gatherAgeSignals(intelligence, signals);
    this.gatherGrowthSignals(intelligence, research, signals);
    this.gatherStructureSignals(intelligence, signals);

    // Calculate scores for each type
    const scores: Record<CompanyType, number> = {
      pe_backed_platform: 0,
      family_owned_enterprise: 0,
      franchise_system: 0,
      growth_stage_regional: 0,
      local_operator: 0,
      unknown: 0,
    };

    // Sum signal weights for each type
    for (const signal of signals) {
      for (const type of signal.contributesToType) {
        scores[type] += signal.weight;
      }
    }

    // Determine the winning type
    let bestType: CompanyType = 'unknown';
    let bestScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (type !== 'unknown' && score > bestScore) {
        bestScore = score;
        bestType = type as CompanyType;
      }
    }

    // Determine confidence based on score margin
    const sortedScores = Object.entries(scores)
      .filter(([t]) => t !== 'unknown')
      .sort((a, b) => b[1] - a[1]);

    const topScore = sortedScores[0]?.[1] || 0;
    const secondScore = sortedScores[1]?.[1] || 0;
    const margin = topScore - secondScore;

    let confidence: 'high' | 'medium' | 'low';
    if (topScore < 2) {
      confidence = 'low';
      bestType = 'unknown';
    } else if (margin >= 3) {
      confidence = 'high';
    } else if (margin >= 1.5) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Determine tier
    const estimatedTier = this.determineTier(intelligence);

    // Get ownership details
    const ownershipDetails = this.getOwnershipDetails(intelligence, research);

    // Generate additional tags
    const tags = this.generateTags(intelligence, research);

    return {
      type: bestType,
      confidence,
      signals,
      tags,
      salesApproach: COMPANY_TYPE_DEFINITIONS[bestType].salesFocus,
      ownershipDetails,
      peBackerName: research?.peBackerName || null,
      estimatedTier,
    };
  }

  /**
   * Generate additional classification tags
   */
  private generateTags(
    intel: CompanyIntelligence,
    research: SerperResearchData | undefined
  ): string[] {
    const tags: string[] = [];
    const awards = intel.services?.awards?.value || [];
    const allText = JSON.stringify(intel).toLowerCase();

    // FAMILY_BUSINESS
    const ownership = intel.company_profile?.ownership?.value?.toLowerCase() || '';
    if (ownership.includes('family') ||
        /family[\s-]owned|generation|family business/i.test(allText)) {
      tags.push('FAMILY_BUSINESS');
    }

    // ACTIVE_ACQUIRER - if 2+ acquisitions detected
    if (research?.mnActivity && research.mnActivity.length >= 2) {
      tags.push('ACTIVE_ACQUIRER');
    }

    // PCT_TOP_100 - match full name "Pest Control Technology Top 100" or abbreviation "PCT Top 100"
    if (awards.some((a: string) => /pct.*top.*100|top.*100.*pct|pest.*control.*tech.*top.*100|top.*100.*pest.*control/i.test(a))) {
      tags.push('PCT_TOP_100');
    }

    // FAST_GROWING (Inc 5000, Fast 50, etc.)
    if (awards.some((a: string) => /inc.*5000|fast.*50|fastest.*growing/i.test(a))) {
      tags.push('FAST_GROWING');
    }

    // PE_BACKED
    if (research?.isPEBacked || /private equity|PE[\s-]backed/i.test(allText)) {
      tags.push('PE_BACKED');
    }

    // QUALITYPRO_CERTIFIED
    const certs = intel.services?.certifications?.value || [];
    if (certs.some((c: string) => /qualitypro/i.test(c)) ||
        awards.some((a: string) => /qualitypro/i.test(a))) {
      tags.push('QUALITYPRO_CERTIFIED');
    }

    // MULTI_LOCATION
    const locations = intel.company_profile?.locations_count?.value || 0;
    if (locations >= 5) {
      tags.push('MULTI_LOCATION');
    }

    // Default if no tags
    if (tags.length === 0) {
      tags.push('INDEPENDENT');
    }

    return tags;
  }

  /**
   * Gather ownership-related signals
   */
  private gatherOwnershipSignals(
    intel: CompanyIntelligence,
    research: SerperResearchData | undefined,
    signals: ClassificationSignal[]
  ): void {
    // PE backing signals
    if (research?.isPEBacked) {
      signals.push({
        signal: 'PE-backed company',
        weight: 5,
        source: 'serper_research',
        contributesToType: ['pe_backed_platform'],
      });
    }

    // M&A activity
    if (research?.hasMnAHistory) {
      signals.push({
        signal: 'Has M&A history',
        weight: 3,
        source: 'serper_research',
        contributesToType: ['pe_backed_platform'],
      });
    }

    // Ownership field analysis
    const ownership = intel.company_profile?.ownership?.value?.toLowerCase() || '';
    if (ownership.includes('family') || ownership.includes('founder')) {
      signals.push({
        signal: 'Family/founder ownership indicated',
        weight: 4,
        source: 'company_profile',
        contributesToType: ['family_owned_enterprise'],
      });
    }

    if (ownership.includes('private equity') || ownership.includes('pe ') || ownership.includes('pe-')) {
      signals.push({
        signal: 'PE ownership indicated in profile',
        weight: 5,
        source: 'company_profile',
        contributesToType: ['pe_backed_platform'],
      });
    }

    // Franchise indicators
    if (ownership.includes('franchise') || ownership.includes('franchis')) {
      signals.push({
        signal: 'Franchise structure indicated',
        weight: 4,
        source: 'company_profile',
        contributesToType: ['franchise_system'],
      });
    }

    // Key people analysis - look for founder/owner titles
    const keyPeople = intel.key_people || [];
    const hasFounderOwner = keyPeople.some(p =>
      p.title?.toLowerCase().includes('founder') ||
      p.title?.toLowerCase().includes('owner')
    );

    if (hasFounderOwner) {
      signals.push({
        signal: 'Founder/owner in key people',
        weight: 2,
        source: 'key_people',
        contributesToType: ['family_owned_enterprise', 'local_operator'],
      });
    }

    // Look for professional management titles
    const hasProfessionalMgmt = keyPeople.some(p =>
      p.title?.toLowerCase().includes('vp') ||
      p.title?.toLowerCase().includes('vice president') ||
      p.title?.toLowerCase().includes('chief') ||
      p.title?.toLowerCase().includes('director')
    );

    if (hasProfessionalMgmt && keyPeople.length > 5) {
      signals.push({
        signal: 'Professional management structure',
        weight: 2,
        source: 'key_people',
        contributesToType: ['pe_backed_platform', 'franchise_system'],
      });
    }
  }

  /**
   * Gather size-related signals
   */
  private gatherSizeSignals(
    intel: CompanyIntelligence,
    signals: ClassificationSignal[]
  ): void {
    const employeeCount = intel.company_profile?.employee_count?.value || 0;
    const locationsCount = intel.company_profile?.locations_count?.value || 1;
    const revenue = intel.financial?.estimated_revenue?.value || 0;

    // Very small company
    if (employeeCount > 0 && employeeCount < 20) {
      signals.push({
        signal: `Small employee count (${employeeCount})`,
        weight: 3,
        source: 'company_profile',
        contributesToType: ['local_operator'],
      });
    }

    // Medium company
    if (employeeCount >= 20 && employeeCount <= 100) {
      signals.push({
        signal: `Mid-size employee count (${employeeCount})`,
        weight: 2,
        source: 'company_profile',
        contributesToType: ['growth_stage_regional', 'family_owned_enterprise'],
      });
    }

    // Large company
    if (employeeCount > 100) {
      signals.push({
        signal: `Large employee count (${employeeCount})`,
        weight: 3,
        source: 'company_profile',
        contributesToType: ['pe_backed_platform', 'franchise_system'],
      });
    }

    // Multi-location
    if (locationsCount > 5) {
      signals.push({
        signal: `Multiple locations (${locationsCount})`,
        weight: 3,
        source: 'company_profile',
        contributesToType: ['pe_backed_platform', 'franchise_system', 'family_owned_enterprise'],
      });
    }

    // Single location
    if (locationsCount === 1) {
      signals.push({
        signal: 'Single location',
        weight: 2,
        source: 'company_profile',
        contributesToType: ['local_operator'],
      });
    }

    // Revenue signals
    if (revenue > 50_000_000) {
      signals.push({
        signal: `High revenue ($${(revenue / 1_000_000).toFixed(0)}M+)`,
        weight: 3,
        source: 'financial',
        contributesToType: ['pe_backed_platform', 'franchise_system'],
      });
    } else if (revenue > 10_000_000) {
      signals.push({
        signal: `Mid-range revenue ($${(revenue / 1_000_000).toFixed(0)}M)`,
        weight: 2,
        source: 'financial',
        contributesToType: ['family_owned_enterprise', 'growth_stage_regional'],
      });
    }
  }

  /**
   * Gather age-related signals
   */
  private gatherAgeSignals(
    intel: CompanyIntelligence,
    signals: ClassificationSignal[]
  ): void {
    const foundedYear = intel.company_profile?.founded_year?.value;
    if (!foundedYear) return;

    const yearsInBusiness = new Date().getFullYear() - foundedYear;

    if (yearsInBusiness >= 30) {
      signals.push({
        signal: `Long-established business (${yearsInBusiness} years)`,
        weight: 3,
        source: 'company_profile',
        contributesToType: ['family_owned_enterprise'],
      });
    } else if (yearsInBusiness >= 10 && yearsInBusiness < 30) {
      signals.push({
        signal: `Established business (${yearsInBusiness} years)`,
        weight: 2,
        source: 'company_profile',
        contributesToType: ['family_owned_enterprise', 'growth_stage_regional'],
      });
    } else if (yearsInBusiness >= 3 && yearsInBusiness < 10) {
      signals.push({
        signal: `Growth-stage business (${yearsInBusiness} years)`,
        weight: 2,
        source: 'company_profile',
        contributesToType: ['growth_stage_regional', 'local_operator'],
      });
    }
  }

  /**
   * Gather growth-related signals
   */
  private gatherGrowthSignals(
    intel: CompanyIntelligence,
    research: SerperResearchData | undefined,
    signals: ClassificationSignal[]
  ): void {
    const hiringActivity = intel.financial?.hiring_activity?.value;
    const jobPostings = intel.financial?.job_postings_count?.value || 0;

    // Active hiring indicates growth
    if (hiringActivity === 'very_high' || hiringActivity === 'high' || jobPostings > 5) {
      signals.push({
        signal: 'High hiring activity',
        weight: 2,
        source: 'financial',
        contributesToType: ['pe_backed_platform', 'growth_stage_regional'],
      });
    }

    // Growth signals from financial data
    const growthSignals = intel.financial?.growth_signals?.value || [];
    if (growthSignals.length > 0) {
      signals.push({
        signal: `Growth signals detected: ${growthSignals.slice(0, 2).join(', ')}`,
        weight: 2,
        source: 'financial',
        contributesToType: ['growth_stage_regional', 'pe_backed_platform'],
      });
    }

    // Awards indicate established presence
    if (research && research.totalAwardsFound > 3) {
      signals.push({
        signal: `Multiple industry awards (${research.totalAwardsFound})`,
        weight: 2,
        source: 'serper_research',
        contributesToType: ['family_owned_enterprise', 'pe_backed_platform'],
      });
    }
  }

  /**
   * Gather structure-related signals
   */
  private gatherStructureSignals(
    intel: CompanyIntelligence,
    signals: ClassificationSignal[]
  ): void {
    const companyType = intel.company_profile?.company_type?.value?.toLowerCase() || '';

    if (companyType.includes('franchise')) {
      signals.push({
        signal: 'Company type is franchise',
        weight: 5,
        source: 'company_profile',
        contributesToType: ['franchise_system'],
      });
    }

    if (companyType.includes('platform') || companyType.includes('holding')) {
      signals.push({
        signal: 'Platform/holding company structure',
        weight: 4,
        source: 'company_profile',
        contributesToType: ['pe_backed_platform'],
      });
    }

    // Service areas indicate geographic scope
    const serviceAreas = intel.services?.service_areas?.value || [];
    if (serviceAreas.length > 10) {
      signals.push({
        signal: 'Broad geographic coverage',
        weight: 2,
        source: 'services',
        contributesToType: ['pe_backed_platform', 'franchise_system'],
      });
    } else if (serviceAreas.length >= 3 && serviceAreas.length <= 10) {
      signals.push({
        signal: 'Regional coverage',
        weight: 1.5,
        source: 'services',
        contributesToType: ['growth_stage_regional', 'family_owned_enterprise'],
      });
    }

    // Technology adoption signals
    const hasCRM = intel.technology?.crm_system?.value;
    const hasLiveChat = intel.technology?.has_live_chat?.value;
    const hasOnlineBooking = intel.technology?.has_online_booking?.value;

    if (hasCRM && hasLiveChat && hasOnlineBooking) {
      signals.push({
        signal: 'Modern tech stack',
        weight: 1.5,
        source: 'technology',
        contributesToType: ['pe_backed_platform', 'growth_stage_regional'],
      });
    }
  }

  /**
   * Determine company tier based on size indicators
   */
  private determineTier(
    intel: CompanyIntelligence
  ): 'enterprise' | 'mid_market' | 'smb' | 'startup' {
    const employeeCount = intel.company_profile?.employee_count?.value || 0;
    const revenue = intel.financial?.estimated_revenue?.value || 0;
    const locations = intel.company_profile?.locations_count?.value || 1;

    // Enterprise: Large companies
    if (employeeCount > 200 || revenue > 50_000_000 || locations > 20) {
      return 'enterprise';
    }

    // Mid-market: Substantial regional players
    if (employeeCount > 50 || revenue > 10_000_000 || locations > 5) {
      return 'mid_market';
    }

    // SMB: Small but established
    if (employeeCount > 10 || revenue > 1_000_000 || locations > 1) {
      return 'smb';
    }

    // Startup: Very small
    return 'startup';
  }

  /**
   * Get detailed ownership information
   */
  private getOwnershipDetails(
    intel: CompanyIntelligence,
    research: SerperResearchData | undefined
  ): string | null {
    const parts: string[] = [];

    // Ownership from profile
    const ownership = intel.company_profile?.ownership?.value;
    if (ownership) {
      parts.push(ownership);
    }

    // PE backer
    if (research?.peBackerName) {
      parts.push(`PE-backed by ${research.peBackerName}`);
    } else if (research?.isPEBacked) {
      parts.push('PE-backed');
    }

    // Owner from key people
    const owner = intel.key_people?.find(p =>
      p.title?.toLowerCase().includes('owner') ||
      p.title?.toLowerCase().includes('founder') ||
      p.title?.toLowerCase().includes('ceo')
    );

    if (owner) {
      parts.push(`Led by ${owner.name}${owner.title ? ` (${owner.title})` : ''}`);
    }

    return parts.length > 0 ? parts.join('. ') : null;
  }

  /**
   * Get the definition for a company type
   */
  getTypeDefinition(type: CompanyType): typeof COMPANY_TYPE_DEFINITIONS[CompanyType] {
    return COMPANY_TYPE_DEFINITIONS[type];
  }
}

// Export singleton
export const companyTypeClassifier = new CompanyTypeClassifier();
