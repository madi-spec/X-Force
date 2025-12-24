/**
 * Communications API
 *
 * GET /api/communications
 *
 * Returns communications with filters and pagination.
 * Joins company, contact, deal, and current analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  // Filters
  const companyId = searchParams.get('company_id');
  const contactId = searchParams.get('contact_id');
  const dealId = searchParams.get('deal_id');
  const senderEmail = searchParams.get('sender_email');
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
      company:companies!company_id(id, name, domain),
      contact:contacts!contact_id(id, name, email),
      deal:deals!deal_id(id, name, stage, estimated_value),
      current_analysis:communication_analysis!current_analysis_id(*)
    `, { count: 'exact' })
    .order('occurred_at', { ascending: false });

  // Apply filters
  if (companyId) {
    query = query.eq('company_id', companyId);
  } else if (senderEmail) {
    // For unlinked emails: filter by company_id is null
    // We'll filter by email in JS after fetching
    query = query.is('company_id', null);
  }
  if (contactId) query = query.eq('contact_id', contactId);
  if (dealId) query = query.eq('deal_id', dealId);
  if (channel) query = query.eq('channel', channel);
  if (direction) query = query.eq('direction', direction);
  if (awaitingResponse) query = query.eq('awaiting_our_response', true);
  if (aiOnly) query = query.eq('is_ai_generated', true);

  // Pagination (only apply if not filtering by senderEmail, as we'll filter in JS)
  if (!senderEmail) {
    query = query.range(offset, offset + limit - 1);
  }

  let { data, error, count } = await query;

  // For senderEmail filter, filter results in JS and apply pagination
  if (senderEmail && data) {
    const emailLower = senderEmail.toLowerCase();
    data = data.filter(comm => {
      const theirEmails = (comm.their_participants as Array<{ email?: string }> || [])
        .map(p => p.email?.toLowerCase());
      const ourEmails = (comm.our_participants as Array<{ email?: string }> || [])
        .map(p => p.email?.toLowerCase());
      return theirEmails.includes(emailLower) || ourEmails.includes(emailLower);
    });
    count = data.length;
    data = data.slice(offset, offset + limit);
  }

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
