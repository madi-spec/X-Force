import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CollateralFilters, DocumentType, MeetingType, ProductTag, IndustryTag } from '@/types/collateral';

/**
 * GET /api/collateral
 *
 * List collateral with optional filters
 * Query params:
 * - document_type: filter by document type
 * - meeting_type: filter by meeting type
 * - product: filter by product
 * - industry: filter by industry
 * - search: search by name or description
 * - include_archived: include archived items (default false)
 * - limit: max number of results (default 50)
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;

  const documentType = searchParams.get('document_type') as DocumentType | null;
  const meetingType = searchParams.get('meeting_type') as MeetingType | null;
  const product = searchParams.get('product') as ProductTag | null;
  const industry = searchParams.get('industry') as IndustryTag | null;
  const search = searchParams.get('search');
  const includeArchived = searchParams.get('include_archived') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  let query = supabase
    .from('collateral')
    .select('*')
    .eq('is_current', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  // Apply filters
  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  if (meetingType) {
    query = query.contains('meeting_types', [meetingType]);
  }

  if (product) {
    query = query.contains('products', [product]);
  }

  if (industry) {
    query = query.contains('industries', [industry]);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data: collateral, error } = await query;

  if (error) {
    console.error('Error fetching collateral:', error);
    return NextResponse.json({ error: 'Failed to fetch collateral' }, { status: 500 });
  }

  return NextResponse.json({ collateral: collateral || [] });
}

/**
 * POST /api/collateral
 *
 * Create new collateral
 * Body:
 * {
 *   name: string,
 *   description?: string,
 *   file_type: string,
 *   file_path?: string,
 *   file_name?: string,
 *   file_size?: number,
 *   external_url?: string,
 *   document_type: DocumentType,
 *   meeting_types?: MeetingType[],
 *   products?: ProductTag[],
 *   industries?: IndustryTag[],
 *   company_sizes?: CompanySizeTag[],
 *   visibility?: 'team' | 'personal' | 'public'
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
    description,
    file_type,
    file_path,
    file_name,
    file_size,
    external_url,
    document_type,
    meeting_types = [],
    products = [],
    industries = [],
    company_sizes = [],
    visibility = 'team',
  } = body;

  // Validation
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!file_type) {
    return NextResponse.json({ error: 'file_type is required' }, { status: 400 });
  }

  if (!document_type) {
    return NextResponse.json({ error: 'document_type is required' }, { status: 400 });
  }

  // For link type, external_url is required
  if (file_type === 'link' && !external_url) {
    return NextResponse.json({ error: 'external_url is required for link type' }, { status: 400 });
  }

  const { data: collateral, error } = await supabase
    .from('collateral')
    .insert({
      name,
      description,
      file_type,
      file_path,
      file_name,
      file_size,
      external_url,
      document_type,
      meeting_types,
      products,
      industries,
      company_sizes,
      visibility,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating collateral:', error);
    return NextResponse.json({ error: 'Failed to create collateral' }, { status: 500 });
  }

  return NextResponse.json({ collateral });
}
