import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/attention-flags
 *
 * Returns attention flags filtered by various criteria
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get('company_id');
  const status = searchParams.get('status');
  const sourceType = searchParams.get('source_type');

  let query = supabase
    .from('attention_flags')
    .select('id, source_id, source_type, flag_type, status, severity, company_id');

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }

  const { data: flags, error } = await query;

  if (error) {
    console.error('[AttentionFlags API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flags: flags || [] });
}
