import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/contacts
 *
 * List contacts with optional filters
 * Query params:
 * - limit: number (default 100)
 * - company_id: filter by company
 * - search: search by name or email
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
  const company_id = searchParams.get('company_id');
  const search = searchParams.get('search');

  let query = supabase
    .from('contacts')
    .select(`
      id,
      name,
      email,
      phone,
      title,
      role,
      company_id,
      company:companies(id, name)
    `)
    .order('name')
    .limit(limit);

  if (company_id) {
    query = query.eq('company_id', company_id);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: contacts, error } = await query;

  if (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }

  return NextResponse.json({ contacts: contacts || [] });
}

/**
 * POST /api/contacts
 *
 * Create a new contact
 * Body:
 * {
 *   name: string,
 *   email?: string,
 *   phone?: string,
 *   title?: string,
 *   role?: string,
 *   company_id: string,
 *   linkedin_url?: string,
 *   seniority?: string,
 *   department?: string,
 *   source?: string,
 *   notes?: string
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
  const {
    name,
    email,
    phone,
    title,
    role,
    company_id,
    linkedin_url,
    seniority,
    department,
    source,
    notes,
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!company_id) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  // Check if contact already exists by email or name at this company
  if (email) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('email', email.toLowerCase())
      .eq('company_id', company_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: 'Contact with this email already exists at this company',
        existing: existing[0],
      }, { status: 409 });
    }
  } else {
    // Check by name if no email
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('company_id', company_id)
      .ilike('name', name)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: 'Contact with this name already exists at this company',
        existing: existing[0],
      }, { status: 409 });
    }
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      name,
      email: email?.toLowerCase() || null,
      phone: phone || null,
      title: title || null,
      role: role || null,
      company_id,
      linkedin_url: linkedin_url || null,
      seniority: seniority || null,
      department: department || null,
      source: source || null,
      notes: notes || null,
    })
    .select(`
      id,
      name,
      email,
      phone,
      title,
      role,
      company_id,
      linkedin_url,
      seniority,
      department,
      company:companies(id, name)
    `)
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }

  return NextResponse.json(contact);
}
