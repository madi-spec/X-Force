/**
 * Intelligence API - Get and Trigger
 * GET: Get intelligence for a company
 * POST: Trigger intelligence collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  collectIntelligence,
  getIntelligence,
  isIntelligenceStale,
  type GetIntelligenceResponse,
  type TriggerCollectionResponse,
} from '@/lib/intelligence';

// ============================================
// GET - Retrieve Intelligence
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<NextResponse<GetIntelligenceResponse | { error: string }>> {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    // Get company domain
    const { data: company } = await supabase
      .from('companies')
      .select('domain')
      .eq('id', companyId)
      .single();

    const companyDomain = company?.domain || null;

    // Try to get suggested domain from contacts if no stored domain
    const suggestedDomain = companyDomain ? null : await extractDomainFromContacts(supabase, companyId);

    // Get main intelligence record
    const intelligence = await getIntelligence(companyId);

    if (!intelligence) {
      return NextResponse.json({
        intelligence: null,
        sources: [],
        contacts: [],
        mentions: [],
        isStale: true,
        lastCollectedAt: null,
        companyDomain,
        suggestedDomain,
      });
    }

    // Get related data
    const [sourcesResult, contactsResult, mentionsResult] = await Promise.all([
      supabase
        .from('intelligence_sources')
        .select('*')
        .eq('account_intelligence_id', intelligence.id)
        .order('source_type'),

      supabase
        .from('contact_intelligence')
        .select('*')
        .eq('company_id', companyId)
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .limit(30),

      supabase
        .from('industry_mentions')
        .select('*')
        .eq('company_id', companyId)
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .limit(20),
    ]);

    const isStale = await isIntelligenceStale(companyId);

    // Ensure deep intelligence fields have defaults if not present in DB
    const enrichedIntelligence = {
      ...intelligence,
      company_profile: intelligence.company_profile || null,
      review_pain_points: intelligence.review_pain_points || [],
      marketing_profile: intelligence.marketing_profile || null,
      visible_employees: intelligence.visible_employees || [],
      products_services: intelligence.products_services || [],
      service_areas: intelligence.service_areas || [],
      certifications: intelligence.certifications || [],
    };

    return NextResponse.json({
      intelligence: enrichedIntelligence,
      sources: sourcesResult.data || [],
      contacts: contactsResult.data || [],
      mentions: mentionsResult.data || [],
      isStale,
      lastCollectedAt: intelligence.last_collected_at,
      companyDomain,
      suggestedDomain,
    });
  } catch (error) {
    console.error('[API] Error getting intelligence:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Trigger Collection
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<NextResponse<TriggerCollectionResponse | { error: string }>> {
  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));
    const { force = false, sources, domain: requestDomain } = body;

    const supabase = createAdminClient();

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, address, domain')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Save domain to company if provided and not already set
    if (requestDomain && requestDomain !== company.domain) {
      await supabase
        .from('companies')
        .update({ domain: requestDomain })
        .eq('id', companyId);
    }

    // Check if collection is already running
    const existing = await getIntelligence(companyId);
    if (existing?.collection_status === 'collecting') {
      return NextResponse.json({
        status: 'already_running',
        intelligenceId: existing.id,
        message: 'Intelligence collection is already in progress',
      });
    }

    // Check if stale (unless forcing)
    if (!force && existing && !(await isIntelligenceStale(companyId))) {
      return NextResponse.json({
        status: 'queued',
        intelligenceId: existing.id,
        message: 'Intelligence is fresh, collection not needed',
      });
    }

    // Use provided domain, stored domain, or try to extract from contacts
    let domain = requestDomain || company.domain;
    if (!domain) {
      domain = await extractDomainFromContacts(supabase, companyId);
    }

    // Start collection (in background for this example, or could be async job)
    // For simplicity, we'll run it inline but this could be a queue job
    const result = await collectIntelligence({
      companyId,
      companyName: company.name,
      domain,
      sources,
      force,
    });

    return NextResponse.json({
      status: 'started',
      intelligenceId: result.intelligence?.id || null,
      message: result.success
        ? 'Intelligence collection complete'
        : 'Collection partially completed',
    });
  } catch (error) {
    console.error('[API] Error triggering collection:', error);
    // Capture more details about the error
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

// Generic/personal email domains to exclude
const GENERIC_EMAIL_DOMAINS = new Set([
  // Major providers
  'gmail.com', 'googlemail.com', 'google.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'aim.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'zoho.com', 'zohomail.com',
  'mail.com', 'email.com',
  'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru',
  'qq.com', '163.com', '126.com',
  // ISP emails
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net',
  'charter.net', 'cox.net', 'earthlink.net', 'frontier.com',
  // Other common
  'fastmail.com', 'tutanota.com', 'hushmail.com',
  'inbox.com', 'mail.ru', 'rediffmail.com',
]);

/**
 * Extract business domain from contact email addresses
 */
async function extractDomainFromContacts(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string
): Promise<string | null> {
  // Get contacts for this company
  const { data: contacts } = await supabase
    .from('contacts')
    .select('email')
    .eq('company_id', companyId)
    .not('email', 'is', null);

  if (!contacts || contacts.length === 0) {
    return null;
  }

  // Extract unique domains from emails, excluding generic ones
  const businessDomains: Map<string, number> = new Map();

  for (const contact of contacts) {
    if (!contact.email) continue;

    const email = contact.email.toLowerCase().trim();
    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) continue;

    const domain = email.substring(atIndex + 1);
    if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

    // Count occurrences of each domain
    businessDomains.set(domain, (businessDomains.get(domain) || 0) + 1);
  }

  if (businessDomains.size === 0) {
    return null;
  }

  // Return the most common business domain
  let bestDomain = '';
  let bestCount = 0;
  for (const [domain, count] of businessDomains) {
    if (count > bestCount) {
      bestDomain = domain;
      bestCount = count;
    }
  }

  return bestDomain || null;
}

function extractDomain(company: { name: string; address?: unknown; domain?: string | null }): string | null {
  // This is a placeholder - in a real app, you'd store domain on company
  // Or use an enrichment API to find it
  return null;
}
