import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/deals
 *
 * List deals with optional filters
 * Query params:
 * - limit: number (default 100)
 * - stage: filter by stage
 * - search: search by name
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const stage = searchParams.get('stage');
  const search = searchParams.get('search');

  let query = supabase
    .from('deals')
    .select(`
      id,
      name,
      stage,
      estimated_value,
      company:companies(id, name)
    `)
    .order('updated_at', { ascending: false })
    .limit(limit);

  // Exclude closed deals by default (they clutter the dropdown)
  if (!stage) {
    query = query.not('stage', 'in', '(closed_won,closed_lost)');
  } else {
    query = query.eq('stage', stage);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: deals, error } = await query;

  if (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }

  return NextResponse.json({ deals: deals || [] });
}

/**
 * POST /api/deals
 *
 * Create a new deal
 * Body:
 * {
 *   name: string,
 *   company_id: string,
 *   stage?: string,
 *   estimated_value?: number,
 *   deal_type?: string,
 *   sales_team?: string
 * }
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get current user profile
  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { name, company_id, stage, estimated_value, deal_type, sales_team } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!company_id) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      name,
      company_id,
      owner_id: profile.id,
      stage: stage || 'new_lead',
      estimated_value: estimated_value || 0,
      deal_type: deal_type || 'new_business',
      sales_team: sales_team || 'xrai',
      health_score: 50,
      quoted_products: [],
      stage_entered_at: new Date().toISOString(),
    })
    .select(`
      id,
      name,
      stage,
      estimated_value,
      company:companies(id, name)
    `)
    .single();

  if (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }

  return NextResponse.json({ deal });
}
