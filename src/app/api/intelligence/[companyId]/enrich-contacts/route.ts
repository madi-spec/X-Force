/**
 * Contact Enrichment API
 * POST: Enrich existing contacts from Apollo people data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrichExistingContacts } from '@/lib/intelligence/enrichment/contactEnrichment';
import { getIntelligence } from '@/lib/intelligence';
import type { ContactEnrichmentResult, EnhancedApolloPerson, ApolloPeopleData } from '@/lib/intelligence/types';

// ============================================
// POST - Enrich Contacts
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<NextResponse<ContactEnrichmentResult | { error: string }>> {
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

    // Get LinkedIn People source
    const { data: sources } = await supabase
      .from('intelligence_sources')
      .select('*')
      .eq('account_intelligence_id', intelligence.id)
      .eq('source_type', 'linkedin_people')
      .single();

    if (!sources || !sources.processed_data) {
      return NextResponse.json(
        { error: 'No LinkedIn/Apollo people data found. Run intelligence collection first.' },
        { status: 400 }
      );
    }

    // Extract people data
    const peopleData = sources.processed_data as unknown as ApolloPeopleData;
    const people = peopleData.people as unknown as EnhancedApolloPerson[];

    if (!people || people.length === 0) {
      return NextResponse.json({
        success: true,
        enrichedCount: 0,
        createdCount: 0,
        matchedContacts: [],
        error: 'No people data available for enrichment',
      });
    }

    // Run enrichment
    const result = await enrichExistingContacts(companyId, people);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error enriching contacts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
