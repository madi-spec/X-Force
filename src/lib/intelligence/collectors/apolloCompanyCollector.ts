/**
 * Apollo.io Company Collector
 * Uses Apollo.io API to enrich company data
 */

import { BaseCollector } from './base';
import type {
  ApolloCompanyData,
  CollectorOptions,
  CollectorResult,
} from '../types';

// ============================================
// APOLLO COMPANY COLLECTOR
// ============================================

export class ApolloCompanyCollector extends BaseCollector<ApolloCompanyData, CollectorOptions> {
  readonly sourceType = 'linkedin_company' as const;
  readonly displayName = 'LinkedIn Company (via Apollo)';

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
    options: CollectorOptions = {}
  ): Promise<CollectorResult<ApolloCompanyData>> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.errorResult(
        'Apollo API key not configured',
        Date.now() - startTime
      );
    }

    try {
      const data = await this.withRetry(async () => {
        // First try to enrich by domain
        if (domain) {
          const enriched = await this.enrichByDomain(domain);
          if (enriched) return enriched;
        }

        // Fall back to search
        return await this.searchCompany(companyName, domain);
      }, options.maxRetries || 2);

      if (!data) {
        return this.errorResult(
          'Company not found in Apollo',
          Date.now() - startTime
        );
      }

      return this.successResult(data, Date.now() - startTime);
    } catch (error) {
      console.error('[ApolloCompanyCollector] Error:', error);
      return this.errorResult(
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data: ApolloCompanyData): number {
    if (!data) return 0;

    let score = 0;

    if (data.apolloId) score += 10;
    if (data.name) score += 10;
    if (data.domain) score += 5;
    if (data.description) score += 15;
    if (data.industry) score += 10;
    if (data.employeeCount) score += 10;
    if (data.revenue) score += 10;
    if (data.headquarters) score += 5;
    if (data.linkedinUrl) score += 10;
    if (data.technologies.length > 0) score += 10;
    if (data.foundedYear) score += 5;

    return Math.min(100, score);
  }

  /**
   * Enrich company by domain
   */
  private async enrichByDomain(domain: string): Promise<ApolloCompanyData | null> {
    const normalizedDomain = this.normalizeDomain(domain);

    const response = await fetch(`${this.baseUrl}/organizations/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': this.apiKey!,
      },
      body: JSON.stringify({ domain: normalizedDomain }),
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.organization) return null;

    return this.transformOrganization(data.organization);
  }

  /**
   * Search for company
   */
  private async searchCompany(
    companyName: string,
    domain: string | null
  ): Promise<ApolloCompanyData | null> {
    const searchParams: Record<string, unknown> = {
      q_organization_name: companyName,
      page: 1,
      per_page: 5,
    };

    if (domain) {
      searchParams.q_organization_domains = this.normalizeDomain(domain);
    }

    const response = await fetch(`${this.baseUrl}/mixed_companies/search`, {
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

    if (!data.organizations?.length) return null;

    // Find best match
    const org = this.findBestMatch(data.organizations, companyName, domain);

    return org ? this.transformOrganization(org) : null;
  }

  /**
   * Find best matching organization
   */
  private findBestMatch(
    organizations: ApolloOrganization[],
    companyName: string,
    domain: string | null
  ): ApolloOrganization | null {
    const normalizedName = companyName.toLowerCase();
    const normalizedDomain = domain ? this.normalizeDomain(domain) : null;

    // First try exact domain match
    if (normalizedDomain) {
      const domainMatch = organizations.find((org) =>
        org.primary_domain?.toLowerCase() === normalizedDomain ||
        org.website_url?.toLowerCase().includes(normalizedDomain)
      );
      if (domainMatch) return domainMatch;
    }

    // Then try name match
    const nameMatch = organizations.find((org) =>
      org.name?.toLowerCase() === normalizedName
    );
    if (nameMatch) return nameMatch;

    // Return first result
    return organizations[0] || null;
  }

  /**
   * Transform Apollo organization to our format
   */
  private transformOrganization(org: ApolloOrganization): ApolloCompanyData {
    return {
      apolloId: org.id || null,
      name: org.name || '',
      domain: org.primary_domain || org.website_url || null,
      description: org.short_description || org.seo_description || null,
      shortDescription: org.short_description || null,
      industry: org.industry || null,
      subIndustry: org.sub_industry || null,
      employeeCount: org.estimated_num_employees || null,
      employeeRange: org.employee_count_range?.split('_').join('-') || null,
      revenue: org.annual_revenue ? parseInt(String(org.annual_revenue), 10) : null,
      revenueRange: org.annual_revenue_printed || null,
      headquarters: org.city || org.state || org.country
        ? {
            city: org.city || null,
            state: org.state || null,
            country: org.country || null,
          }
        : null,
      linkedinUrl: org.linkedin_url || null,
      twitterUrl: org.twitter_url || null,
      facebookUrl: org.facebook_url || null,
      technologies: org.technologies || [],
      foundedYear: org.founded_year || null,
      keywords: org.keywords || [],
      collectedAt: new Date().toISOString(),
    };
  }
}

// ============================================
// APOLLO API TYPES
// ============================================

interface ApolloOrganization {
  id?: string;
  name?: string;
  primary_domain?: string;
  website_url?: string;
  short_description?: string;
  seo_description?: string;
  industry?: string;
  sub_industry?: string;
  estimated_num_employees?: number;
  employee_count_range?: string;
  annual_revenue?: number | string;
  annual_revenue_printed?: string;
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  technologies?: string[];
  founded_year?: number;
  keywords?: string[];
}

// Export singleton
export const apolloCompanyCollector = new ApolloCompanyCollector();
