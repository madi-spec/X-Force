/**
 * Communications API
 *
 * GET /api/communications
 *
 * Returns communications with filters and pagination.
 * Joins company, contact, deal, and current analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Filters
  const companyId = searchParams.get('company_id');
  const contactId = searchParams.get('contact_id');
  const dealId = searchParams.get('deal_id');
  const channel = searchParams.get('channel');
  const direction = searchParams.get('direction');
  const awaitingResponse = searchParams.get('awaiting_response') === 'true';
  const aiOnly = searchParams.get('ai_only') === 'true';

  // Pagination
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('communications')
    .select(`
      *,
      company:companies(id, name, domain),
      contact:contacts(id, name, email),
      deal:deals(id, name, stage, estimated_value),
      current_analysis:communication_analysis!current_analysis_id(*)
    `, { count: 'exact' })
    .order('occurred_at', { ascending: false });

  // Apply filters
  if (companyId) query = query.eq('company_id', companyId);
  if (contactId) query = query.eq('contact_id', contactId);
  if (dealId) query = query.eq('deal_id', dealId);
  if (channel) query = query.eq('channel', channel);
  if (direction) query = query.eq('direction', direction);
  if (awaitingResponse) query = query.eq('awaiting_our_response', true);
  if (aiOnly) query = query.eq('is_ai_generated', true);

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[Communications API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    communications: data,
    total: count,
    limit,
    offset,
  });
}
