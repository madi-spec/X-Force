/**
 * Company Auto-Enrichment Service
 * Automatically enriches company fields from collected intelligence data
 */

import { createClient } from '@supabase/supabase-js';
import type {
  AccountIntelligence,
  IntelligenceSource,
  EnhancedWebsiteData,
  GoogleReviewsData,
  ApolloCompanyData,
  CompanyEnrichmentResult,
} from '../types';

// ============================================
// SUPABASE CLIENT (Lazy Initialization)
// ============================================

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabase;
}

// ============================================
// COMPANY ENRICHMENT SERVICE
// ============================================

/**
 * Enrich a company record from collected intelligence
 */
export async function enrichCompanyFromIntelligence(
  companyId: string,
  intelligence: AccountIntelligence,
  sources: IntelligenceSource[]
): Promise<CompanyEnrichmentResult> {
  try {
    // Get current company data
    const { data: company, error: fetchError } = await getSupabase()
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (fetchError || !company) {
      return {
        success: false,
        fieldsUpdated: [],
        newValues: {},
        previousValues: {},
        error: fetchError?.message || 'Company not found',
      };
    }

    // Extract data from sources
    const websiteData = extractSourceData<EnhancedWebsiteData>(sources, 'website');
    const googleData = extractSourceData<GoogleReviewsData>(sources, 'google_reviews');
    const apolloCompanyData = extractSourceData<ApolloCompanyData>(sources, 'linkedin_company');

    // Build update object
    const updates: Record<string, unknown> = {};
    const previousValues: Record<string, unknown> = {};
    const fieldsUpdated: string[] = [];

    // Domain (from website or Apollo)
    if (!company.domain) {
      const domain = websiteData?.url
        ? extractDomainFromUrl(websiteData.url)
        : apolloCompanyData?.domain;
      if (domain) {
        updates.domain = domain;
        previousValues.domain = company.domain;
        fieldsUpdated.push('domain');
      }
    }

    // Address (from Google, Website, or Apollo)
    if (!company.address) {
      const address = googleData?.address ||
        websiteData?.address ||
        formatApolloAddress(apolloCompanyData);
      if (address) {
        updates.address = address;
        previousValues.address = company.address;
        fieldsUpdated.push('address');
      }
    }

    // Phone (from Google, Website)
    if (!company.phone) {
      const phone = googleData?.phone || websiteData?.phone;
      if (phone) {
        updates.phone = phone;
        previousValues.phone = company.phone;
        fieldsUpdated.push('phone');
      }
    }

    // Employee count (from Apollo)
    if (!company.employee_count && apolloCompanyData?.employeeCount) {
      updates.employee_count = apolloCompanyData.employeeCount;
      previousValues.employee_count = company.employee_count;
      fieldsUpdated.push('employee_count');
    }

    // Revenue estimate (from Apollo)
    if (!company.revenue_estimate && apolloCompanyData?.revenueRange) {
      updates.revenue_estimate = apolloCompanyData.revenueRange;
      previousValues.revenue_estimate = company.revenue_estimate;
      fieldsUpdated.push('revenue_estimate');
    }

    // Founded year (from Apollo)
    if (!company.founded_year && apolloCompanyData?.foundedYear) {
      updates.founded_year = apolloCompanyData.foundedYear;
      previousValues.founded_year = company.founded_year;
      fieldsUpdated.push('founded_year');
    }

    // Technologies (from Apollo or Website)
    const technologies = apolloCompanyData?.technologies || websiteData?.technologies;
    if (technologies && technologies.length > 0) {
      updates.technologies = technologies;
      previousValues.technologies = company.technologies;
      fieldsUpdated.push('technologies');
    }

    // Mark as enriched
    if (fieldsUpdated.length > 0) {
      updates.enriched_at = new Date().toISOString();
      updates.enrichment_source = 'intelligence';
    }

    // Apply updates if any
    if (fieldsUpdated.length > 0) {
      const { error: updateError } = await getSupabase()
        .from('companies')
        .update(updates)
        .eq('id', companyId);

      if (updateError) {
        return {
          success: false,
          fieldsUpdated: [],
          newValues: {},
          previousValues: {},
          error: updateError.message,
        };
      }

      // Log the enrichment
      await logEnrichment('company', companyId, 'intelligence', fieldsUpdated, previousValues, updates);
    }

    return {
      success: true,
      fieldsUpdated,
      newValues: updates,
      previousValues,
      error: null,
    };
  } catch (error) {
    console.error('[CompanyEnrichment] Error:', error);
    return {
      success: false,
      fieldsUpdated: [],
      newValues: {},
      previousValues: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract domain from company contacts' emails
 */
export async function extractDomainFromContacts(companyId: string): Promise<string | null> {
  const { data: contacts } = await getSupabase()
    .from('contacts')
    .select('email')
    .eq('company_id', companyId)
    .not('email', 'is', null);

  if (!contacts || contacts.length === 0) return null;

  // Extract domains from emails
  const domainCounts: Record<string, number> = {};

  for (const contact of contacts) {
    if (contact.email) {
      const domain = contact.email.split('@')[1]?.toLowerCase();
      if (domain && !isPersonalEmailDomain(domain)) {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
    }
  }

  // Return most common domain
  const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

/**
 * Auto-detect and update company domain from contact emails
 */
export async function autoDetectCompanyDomain(companyId: string): Promise<string | null> {
  // Check if company already has a domain
  const { data: company } = await getSupabase()
    .from('companies')
    .select('domain')
    .eq('id', companyId)
    .single();

  if (company?.domain) {
    return company.domain; // Already has domain
  }

  // Try to detect from contacts
  const detectedDomain = await extractDomainFromContacts(companyId);

  if (detectedDomain) {
    // Update company
    await getSupabase()
      .from('companies')
      .update({
        domain: detectedDomain,
        enriched_at: new Date().toISOString(),
        enrichment_source: 'contact_emails',
      })
      .eq('id', companyId);

    // Log enrichment
    await logEnrichment(
      'company',
      companyId,
      'contact_emails',
      ['domain'],
      { domain: null },
      { domain: detectedDomain }
    );
  }

  return detectedDomain;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract data from sources array by type
 */
function extractSourceData<T>(
  sources: IntelligenceSource[],
  sourceType: string
): T | null {
  const source = sources.find((s) => s.source_type === sourceType);
  if (!source?.processed_data) return null;
  return source.processed_data as unknown as T;
}

/**
 * Extract domain from URL
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Format Apollo headquarters into address string
 */
function formatApolloAddress(data: ApolloCompanyData | null): string | null {
  if (!data?.headquarters) return null;

  const { city, state, country } = data.headquarters;
  const parts = [city, state, country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Check if email domain is a personal email provider
 */
function isPersonalEmailDomain(domain: string): boolean {
  const personalDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'live.com',
    'msn.com',
    'mail.com',
    'protonmail.com',
    'ymail.com',
  ];
  return personalDomains.includes(domain.toLowerCase());
}

/**
 * Log enrichment operation
 */
async function logEnrichment(
  entityType: 'company' | 'contact',
  entityId: string,
  source: string,
  fieldsUpdated: string[],
  previousValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Promise<void> {
  try {
    await getSupabase().from('enrichment_log').insert({
      entity_type: entityType,
      entity_id: entityId,
      source,
      fields_updated: fieldsUpdated,
      previous_values: previousValues,
      new_values: newValues,
    });
  } catch (error) {
    console.error('[EnrichmentLog] Failed to log enrichment:', error);
  }
}
