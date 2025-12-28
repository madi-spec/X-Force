/**
 * Single Contact Enrichment API
 * POST: Enrich a single contact from Apollo/LinkedIn
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrichContactFromEmail } from '@/lib/intelligence/enrichment/contactEnrichment';
import type { SingleContactEnrichmentResult } from '@/lib/intelligence/types';

// ============================================
// POST - Enrich Single Contact
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SingleContactEnrichmentResult | { error: string }>> {
  try {
    const { id: contactId } = await params;
    const supabase = createAdminClient();

    // Get contact info
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Need email to enrich from Apollo
    if (!contact.email) {
      return NextResponse.json(
        { error: 'Contact does not have an email address. Cannot enrich without email.' },
        { status: 400 }
      );
    }

    // Run enrichment
    const result = await enrichContactFromEmail(contactId, contact.email);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error enriching contact:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
