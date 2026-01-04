import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/attention-flags
 *
 * Returns attention flags filtered by various criteria
 * Only returns flags for company_products owned by the current user
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const supabaseClient = await createClient();
  const { data: { user: authUser } } = await supabaseClient.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get internal user ID from auth_id
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userId = dbUser.id;

  const { searchParams } = new URL(request.url);

  const companyId = searchParams.get('company_id');
  const status = searchParams.get('status');
  const sourceType = searchParams.get('source_type');

  // Filter attention_flags through company_products owned by current user
  let query = supabase
    .from('attention_flags')
    .select(`
      id, source_id, source_type, flag_type, status, severity, company_id,
      company_product:company_products!company_product_id(id, owner_user_id)
    `)
    .eq('company_products.owner_user_id', userId);

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

  // Filter out any flags where company_product doesn't match (defensive filter)
  const filteredFlags = (flags || []).filter(flag => flag.company_product !== null);

  return NextResponse.json({ flags: filteredFlags });
}
