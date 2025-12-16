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

    return NextResponse.json({
      intelligence,
      sources: sourcesResult.data || [],
      contacts: contactsResult.data || [],
      mentions: mentionsResult.data || [],
      isStale,
      lastCollectedAt: intelligence.last_collected_at,
      companyDomain,
    });
  } catch (error) {
    console.error('[API] Error getting intelligence:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
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

    // Use provided domain, stored domain, or try to extract from company
    const domain = requestDomain || company.domain || extractDomain(company);

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

function extractDomain(company: { name: string; address?: unknown; domain?: string | null }): string | null {
  // This is a placeholder - in a real app, you'd store domain on company
  // Or use an enrichment API to find it

  // Try to derive from company name (very basic)
  const name = company.name.toLowerCase();

  // Common patterns
  const cleanName = name
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

  // Return a guess (in production, use Apollo or similar to find actual domain)
  // For now, return null to indicate we don't know
  return null;
}
