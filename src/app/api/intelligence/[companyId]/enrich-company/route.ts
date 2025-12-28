/**
 * Company Enrichment API
 * POST: Enrich company fields from collected intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrichCompanyFromIntelligence, autoDetectCompanyDomain } from '@/lib/intelligence/enrichment/companyEnrichment';
import { getIntelligence } from '@/lib/intelligence';
import type { CompanyEnrichmentResult } from '@/lib/intelligence/types';

// ============================================
// POST - Enrich Company
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<NextResponse<CompanyEnrichmentResult | { error: string }>> {
  try {
    const { companyId } = await params;
    const supabase = createAdminClient();

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get intelligence data
    const intelligence = await getIntelligence(companyId);
    if (!intelligence) {
      return NextResponse.json(
        { error: 'No intelligence data found. Run intelligence collection first.' },
        { status: 400 }
      );
    }

    // Get intelligence sources
    const { data: sources } = await supabase
      .from('intelligence_sources')
      .select('*')
      .eq('account_intelligence_id', intelligence.id);

    if (!sources || sources.length === 0) {
      return NextResponse.json(
        { error: 'No intelligence sources found. Run intelligence collection first.' },
        { status: 400 }
      );
    }

    // Run enrichment
    const result = await enrichCompanyFromIntelligence(
      companyId,
      intelligence,
      sources
    );

    // Also try to auto-detect domain from contacts if not already set
    if (!result.newValues.domain) {
      const detectedDomain = await autoDetectCompanyDomain(companyId);
      if (detectedDomain) {
        result.fieldsUpdated.push('domain');
        result.newValues.domain = detectedDomain;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error enriching company:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
