/**
 * Apollo.io People Collector
 * Uses Apollo.io API to find key contacts at a company
 * Enhanced to return more people with richer contact data
 */

import { BaseCollector } from './base';
import type {
  ApolloPeopleData,
  ApolloPerson,
  EnhancedApolloPerson,
  ApolloEmployment,
  ApolloCollectorOptions,
  ContactSeniority,
  CollectorResult,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

// Increased from 25 to 50 for deeper employee discovery
const DEFAULT_MAX_PEOPLE = 50;

// Target seniority levels for sales outreach - FOCUSED ON EXECUTIVES ONLY
// We want decision makers, not all employees
const TARGET_SENIORITIES: ContactSeniority[] = [
  'c_level',
  'owner',
  'partner',
  'vp',
  'director',
];

// Executive title patterns to identify decision makers
const EXECUTIVE_TITLE_PATTERNS = [
  /\bceo\b/i, /\bchief executive/i,
  /\bpresident\b/i,
  /\bowner\b/i, /\bfounder\b/i, /\bco-founder\b/i,
  /\bcoo\b/i, /\bcfo\b/i, /\bcmo\b/i, /\bcto\b/i, /\bcio\b/i,
  /\bchief\b/i,
  /\bvice president\b/i, /\bvp\b/i,
  /\bdirector\b/i,
  /\bgeneral manager\b/i, /\bgm\b/i,
  /\bpartner\b/i,
  /\bprincipal\b/i,
  /\bevp\b/i, /\bsvp\b/i,
];

// Target departments - expanded to include all relevant areas
const TARGET_DEPARTMENTS = [
  'operations',
  'information_technology',
  'finance',
  'executive',
  'master_data',
  'sales',
  'marketing',
  'customer_service',
  'human_resources',
  'administrative',
];

// ============================================
// APOLLO PEOPLE COLLECTOR
// ============================================

export class ApolloPeopleCollector extends BaseCollector<ApolloPeopleData, ApolloCollectorOptions> {
  readonly sourceType = 'linkedin_people' as const;
  readonly displayName = 'LinkedIn People (via Apollo)';

  private apiKey: string | null = null;
  private baseUrl = 'https://api.apollo.io/v1';

  constructor() {
    super();
    this.apiKey = process.env.APOLLO_API_KEY || null;
  }

  /**
   * Main collection method
   */
  async collect(
    companyName: string,
    domain: string | null,
    options: ApolloCollectorOptions = {}
  ): Promise<CollectorResult<ApolloPeopleData>> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.errorResult(
        'Apollo API key not configured',
        Date.now() - startTime
      );
    }

    if (!domain) {
      return this.errorResult(
        'Domain required for people search',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.withRetry(async () => {
        return await this.searchPeople(domain, options);
      }, options.maxRetries || 2);

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[ApolloPeopleCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: ApolloPeopleData): number {
    if (!data) return 0;

    let score = 0;

    // Base score for having results
    if (data.people.length > 0) score += 20;

    // Score based on number of contacts found
    score += Math.min(30, data.people.length * 3);

    // Bonus for having decision makers
    const decisionMakers = data.people.filter((p) =>
      ['c_level', 'owner', 'partner', 'vp', 'director'].includes(p.seniority || '')
    );
    score += Math.min(30, decisionMakers.length * 6);

    // Bonus for having email addresses
    const withEmails = data.people.filter((p) => p.email);
    score += Math.min(20, withEmails.length * 2);

    return Math.min(100, score);
  }

  /**
   * Search for people at company
   */
  private async searchPeople(
    domain: string,
    options: ApolloCollectorOptions
  ): Promise<ApolloPeopleData> {
    const normalizedDomain = this.normalizeDomain(domain);
    const maxPeople = options.maxPeople || DEFAULT_MAX_PEOPLE;
    const seniorityFilter = options.seniorityFilter || TARGET_SENIORITIES;
    const departmentFilter = options.departmentFilter || TARGET_DEPARTMENTS;

    const searchParams = {
      q_organization_domains: normalizedDomain,
      person_seniorities: seniorityFilter,
      person_departments: departmentFilter,
      page: 1,
      per_page: Math.min(maxPeople, 100),
    };

    console.log('[Apollo] Search params:', JSON.stringify(searchParams, null, 2));

    // Use the new api_search endpoint (mixed_people/search is deprecated)
    const response = await fetch(`${this.baseUrl}/mixed_people/api_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey!,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read error body');
      console.error('[Apollo] API error response:', response.status, errorBody);
      throw new Error(`Apollo API error: ${response.status} - ${errorBody.substring(0, 200)}`);
    }

    const data = await response.json();

    // Transform people to enhanced format and filter to executives only
    const allPeople: EnhancedApolloPerson[] = (data.people || [])
      .map((person: ApolloPerson_) => this.transformPerson(person));

    // Filter to only include people with executive titles
    const people = allPeople.filter(person => {
      const title = person.title || '';
      const lowerTitle = title.toLowerCase();

      // Always include if seniority is c_level, owner, or partner
      if (['c_level', 'owner', 'partner'].includes(person.seniority || '')) {
        return true;
      }

      // Check if title matches executive patterns (CEO, President, Owner, etc.)
      const isExecutiveTitle = EXECUTIVE_TITLE_PATTERNS.some(pattern => pattern.test(title));
      if (isExecutiveTitle) {
        // But exclude non-executive "Director" titles (project manager, HR, marketing directors)
        const nonExecutiveDirectors = [
          'project', 'hr ', 'human resources', 'marketing', 'content', 'video',
          'social media', 'digital', 'brand', 'creative', 'recruitment', 'talent',
          'technical', 'safety', 'training', 'learning', 'customer',
        ];
        if (lowerTitle.includes('director') && nonExecutiveDirectors.some(t => lowerTitle.includes(t))) {
          return false;
        }
        return true;
      }

      // Exclude common non-executive titles
      const nonExecutiveTitles = [
        'technician', 'specialist', 'analyst', 'coordinator', 'associate',
        'assistant', 'representative', 'admin', 'clerk', 'support',
        'plumber', 'driver', 'field', 'service', 'sales rep', 'account manager',
        'recruiter', 'recruitment', 'hr business partner', 'project manager',
        'ppc', 'marketing', 'social media', 'content', 'designer', 'developer',
        'human resources', 'video', 'technical', 'safety', 'training',
      ];

      if (nonExecutiveTitles.some(t => lowerTitle.includes(t))) {
        return false;
      }

      // Only include VPs (not directors unless they matched executive patterns above)
      if (person.seniority === 'vp') {
        return true;
      }

      // Default: exclude to focus on executives
      return false;
    }).slice(0, maxPeople);

    console.log(`[Apollo] Filtered ${allPeople.length} people to ${people.length} executives`);

    // Sort by seniority (c-level first)
    people.sort((a, b) => {
      const seniorityOrder: Record<string, number> = {
        c_level: 1,
        owner: 2,
        partner: 3,
        vp: 4,
        director: 5,
        manager: 6,
        senior: 7,
        entry: 8,
      };
      const aOrder = seniorityOrder[a.seniority || 'entry'] || 9;
      const bOrder = seniorityOrder[b.seniority || 'entry'] || 9;
      return aOrder - bOrder;
    });

    return {
      companyId: normalizedDomain,
      people,
      totalResults: data.pagination?.total_entries || people.length,
      collectedAt: new Date().toISOString(),
    };
  }

  /**
   * Transform Apollo person to our enhanced format
   */
  private transformPerson(person: ApolloPerson_): EnhancedApolloPerson {
    const seniority = this.mapSeniority(person.seniority);

    // Build employment history
    const employmentHistory: ApolloEmployment[] = (person.employment_history || [])
      .slice(0, 5)
      .map((emp: EmploymentHistory_) => ({
        company: emp.organization_name || '',
        title: emp.title || '',
        startDate: emp.start_date || null,
        endDate: emp.end_date || null,
        current: emp.current || false,
      }));

    // Calculate years at company from employment history
    const currentJob = employmentHistory.find((e) => e.current);
    const yearsAtCompany = currentJob?.startDate
      ? Math.floor((Date.now() - new Date(currentJob.startDate).getTime()) / (365 * 24 * 60 * 60 * 1000))
      : null;

    // Determine if likely budget authority based on title/seniority
    const budgetAuthority = this.hasBudgetAuthority(seniority, person.title || '');

    // Determine if tech buyer based on department/title
    const techBuyer = this.isTechBuyer(person.departments || [], person.title || '');

    // Extract phone numbers
    const phoneNumbers = person.phone_numbers || [];
    const directDial = phoneNumbers.find((p) => p.type === 'work_direct')?.sanitized_number || null;
    const mobilePhone = phoneNumbers.find((p) => p.type === 'mobile')?.sanitized_number || null;
    const mainPhone = phoneNumbers[0]?.sanitized_number || null;

    return {
      // Base ApolloPerson fields
      apolloId: person.id || '',
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      fullName: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      title: person.title || null,
      headline: person.headline || null,
      department: person.departments?.[0] || null,
      seniority,
      email: person.email || null,
      phone: mainPhone,
      linkedinUrl: person.linkedin_url || null,
      photoUrl: person.photo_url || null,
      employmentHistory,
      // Enhanced fields
      personalEmail: person.personal_emails?.[0] || null,
      mobilePhone,
      directDial,
      bio: person.headline || null, // Apollo uses headline for bio-like info
      skills: [], // Apollo doesn't provide skills in basic search
      certifications: [], // Would require LinkedIn scraping
      yearsInRole: null, // Would need current job start date which isn't always available
      yearsAtCompany,
      budgetAuthority,
      techBuyer,
      reportsTo: null, // Not available from Apollo
      teamSize: null, // Not available from Apollo
      linkedinActivityLevel: 'none', // Would require LinkedIn scraping
      recentPosts: 0, // Would require LinkedIn scraping
      connectionCount: null, // Not available from Apollo
    };
  }

  /**
   * Determine if person likely has budget authority
   */
  private hasBudgetAuthority(seniority: ContactSeniority | null, title: string): boolean {
    // C-level, owners, partners always have budget authority
    if (['c_level', 'owner', 'partner'].includes(seniority || '')) {
      return true;
    }

    // VPs and Directors typically have budget authority
    if (['vp', 'director'].includes(seniority || '')) {
      return true;
    }

    // Check title for budget indicators
    const lowerTitle = title.toLowerCase();
    const budgetTitles = [
      'ceo', 'cfo', 'coo', 'cto', 'cio', 'president', 'owner',
      'chief', 'vice president', 'vp', 'director', 'head of',
    ];

    return budgetTitles.some((t) => lowerTitle.includes(t));
  }

  /**
   * Determine if person is likely a tech buyer
   */
  private isTechBuyer(departments: string[], title: string): boolean {
    const techDepartments = ['information_technology', 'engineering', 'product'];
    const hasTechDept = departments.some((d) => techDepartments.includes(d));

    const lowerTitle = title.toLowerCase();
    const techTitles = [
      'it ', 'technology', 'software', 'systems', 'developer',
      'engineer', 'technical', 'digital', 'data', 'infrastructure',
    ];

    const hasTechTitle = techTitles.some((t) => lowerTitle.includes(t));

    // Operations people are tech buyers in pest control (they buy routing software)
    const isOps = departments.includes('operations') ||
      lowerTitle.includes('operations') ||
      lowerTitle.includes('dispatch') ||
      lowerTitle.includes('fleet');

    return hasTechDept || hasTechTitle || isOps;
  }

  /**
   * Map Apollo seniority to our enum
   */
  private mapSeniority(seniority: string | undefined): ContactSeniority | null {
    if (!seniority) return null;

    const mapping: Record<string, ContactSeniority> = {
      c_suite: 'c_level',
      owner: 'owner',
      founder: 'owner',
      partner: 'partner',
      vp: 'vp',
      director: 'director',
      manager: 'manager',
      senior: 'senior',
      entry: 'entry',
    };

    return mapping[seniority.toLowerCase()] || null;
  }
}

// ============================================
// APOLLO API TYPES
// ============================================

interface ApolloPerson_ {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  headline?: string;
  seniority?: string;
  departments?: string[];
  email?: string;
  personal_emails?: string[];
  phone_numbers?: Array<{
    sanitized_number?: string;
    type?: string; // 'work_direct', 'mobile', 'work', etc.
  }>;
  linkedin_url?: string;
  photo_url?: string;
  employment_history?: EmploymentHistory_[];
  city?: string;
  state?: string;
  country?: string;
}

interface EmploymentHistory_ {
  organization_name?: string;
  title?: string;
  start_date?: string;
  end_date?: string;
  current?: boolean;
}

// Export singleton
export const apolloPeopleCollector = new ApolloPeopleCollector();
