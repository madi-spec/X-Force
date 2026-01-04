import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/activities
 *
 * Returns activities filtered by various criteria
 *
 * Query parameters:
 * - company_id: Filter by company
 * - contact_id: Filter by contact
 * - type: Filter by activity type (meeting, email, call, etc.)
 * - upcoming: If 'true', only return activities with occurred_at > now
 * - limit: Maximum number of results (default 50)
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get('company_id');
  const contactId = searchParams.get('contact_id');
  const type = searchParams.get('type');
  const upcoming = searchParams.get('upcoming');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  let query = supabase
    .from('activities')
    .select(`
      id,
      type,
      subject,
      body,
      occurred_at,
      metadata,
      contact_id,
      company_id,
      company_product_id,
      deal_id,
      contact:contacts(id, name, email)
    `);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  if (contactId) {
    query = query.eq('contact_id', contactId);
  }

  if (type) {
    query = query.eq('type', type);
  }

  // Filter for upcoming activities (occurred_at > now)
  if (upcoming === 'true') {
    const now = new Date().toISOString();
    query = query.gte('occurred_at', now);
    query = query.order('occurred_at', { ascending: true });
  } else {
    query = query.order('occurred_at', { ascending: false });
  }

  query = query.limit(limit);

  const { data: activities, error } = await query;

  if (error) {
    console.error('[Activities API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: activities || [] });
}
