import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/companies
 *
 * List companies with optional filters
 * Query params:
 * - limit: number (default 100)
 * - search: search by name
 * - status: filter by status
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
  const search = searchParams.get('search');
  const status = searchParams.get('status');

  let query = supabase
    .from('companies')
    .select('id, name, status, segment, industry, agent_count')
    .order('name')
    .limit(limit);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data: companies, error } = await query;

  if (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }

  return NextResponse.json({ companies: companies || [] });
}

/**
 * POST /api/companies
 *
 * Create a new company
 * Body:
 * {
 *   name: string,
 *   status?: string,
 *   segment?: string,
 *   industry?: string,
 *   agent_count?: number
 * }
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { name, status, segment, industry, agent_count } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Check if company already exists
  const { data: existing } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', name)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({
      error: 'Company already exists',
      existing: existing[0],
    }, { status: 409 });
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      name,
      status: status || 'prospect',
      segment: segment || 'smb',
      industry: industry || 'pest',
      agent_count: agent_count || 1,
      voice_customer: false,
    })
    .select('id, name, status, segment, industry, agent_count')
    .single();

  if (error) {
    console.error('Error creating company:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }

  return NextResponse.json({ company });
}
