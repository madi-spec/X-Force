/**
 * Apollo.io People Collector
 * Uses Apollo.io API to find key contacts at a company
 */

import { BaseCollector } from './base';
import type {
  ApolloPeopleData,
  ApolloPerson,
  ApolloEmployment,
  ApolloCollectorOptions,
  ContactSeniority,
  CollectorResult,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MAX_PEOPLE = 25;

// Target seniority levels for sales outreach
const TARGET_SENIORITIES: ContactSeniority[] = [
  'c_level',
  'owner',
  'partner',
  'vp',
  'director',
  'manager',
];

// Target departments for pest control software
const TARGET_DEPARTMENTS = [
  'operations',
  'information_technology',
  'finance',
  'executive',
  'master_data',
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

    const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey!,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform people
    const people: ApolloPerson[] = (data.people || [])
      .slice(0, maxPeople)
      .map((person: ApolloPerson_) => this.transformPerson(person));

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
   * Transform Apollo person to our format
   */
  private transformPerson(person: ApolloPerson_): ApolloPerson {
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

    return {
      apolloId: person.id || '',
      firstName: person.first_name || null,
      lastName: person.last_name || null,
      fullName: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      title: person.title || null,
      headline: person.headline || null,
      department: person.departments?.[0] || null,
      seniority,
      email: person.email || null,
      phone: person.phone_numbers?.[0]?.sanitized_number || null,
      linkedinUrl: person.linkedin_url || null,
      photoUrl: person.photo_url || null,
      employmentHistory,
    };
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
  phone_numbers?: Array<{ sanitized_number?: string }>;
  linkedin_url?: string;
  photo_url?: string;
  employment_history?: EmploymentHistory_[];
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
