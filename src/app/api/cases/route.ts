/**
 * Support Cases API
 *
 * GET /api/cases - List cases from projection (support_case_read_model)
 * POST /api/cases - Create new case via command
 *
 * All reads are from projections only.
 * All writes go through command handlers that emit events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSupportCase } from '@/lib/supportCase/commands';
import type { SupportCaseSource, SupportCaseSeverity } from '@/types/supportCase';

/**
 * GET /api/cases
 *
 * Query parameters:
 * - product_id: Filter by product
 * - company_id: Filter by company
 * - company_product_id: Filter by company_product
 * - status: Filter by status (comma-separated for multiple)
 * - severity: Filter by severity (comma-separated for multiple)
 * - owner_id: Filter by owner
 * - sla_breached: Filter by SLA breach status (true/false)
 * - search: Search in title
 * - sort: Sort field (default: opened_at)
 * - order: Sort order (asc/desc, default: desc)
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const productId = searchParams.get('product_id');
  const companyId = searchParams.get('company_id');
  const companyProductId = searchParams.get('company_product_id');
  const statuses = searchParams.get('status')?.split(',').filter(Boolean);
  const severities = searchParams.get('severity')?.split(',').filter(Boolean);
  const ownerId = searchParams.get('owner_id');
  const slaBreached = searchParams.get('sla_breached');
  const search = searchParams.get('search');
  const sortField = searchParams.get('sort') || 'opened_at';
  const sortOrder = searchParams.get('order') === 'asc' ? true : false;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build query from projection
  let query = supabase
    .from('support_case_read_model')
    .select(`
      *,
      company:companies!company_id (
        id,
        name
      )
    `, { count: 'exact' });

  // Apply filters
  if (productId) {
    // Need to join through company_products to filter by product
    query = query.eq('company_product_id', productId);
  }

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  if (companyProductId) {
    query = query.eq('company_product_id', companyProductId);
  }

  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses);
  }

  if (severities && severities.length > 0) {
    query = query.in('severity', severities);
  }

  if (ownerId) {
    query = query.eq('owner_id', ownerId);
  }

  if (slaBreached === 'true') {
    query = query.or('first_response_breached.eq.true,resolution_breached.eq.true');
  } else if (slaBreached === 'false') {
    query = query.eq('first_response_breached', false).eq('resolution_breached', false);
  }

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  // Apply sorting
  query = query.order(sortField, { ascending: sortOrder });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
}

/**
 * POST /api/cases
 *
 * Create a new support case via command.
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const body = await request.json();

    const {
      company_id,
      company_product_id,
      title,
      description,
      severity = 'medium',
      category,
      subcategory,
      source = 'portal',
      external_id,
      contact_id,
      contact_email,
      contact_name,
    } = body;

    if (!company_id || !title) {
      return NextResponse.json(
        { error: 'company_id and title are required' },
        { status: 400 }
      );
    }

    // Generate a new case ID
    const supportCaseId = crypto.randomUUID();

    // Create case via command
    const result = await createSupportCase(supabase, {
      supportCaseId,
      companyId: company_id,
      companyProductId: company_product_id,
      title,
      description,
      severity: severity as SupportCaseSeverity,
      category,
      subcategory,
      source: source as SupportCaseSource,
      externalId: external_id,
      contactId: contact_id,
      contactEmail: contact_email,
      contactName: contact_name,
      actor: { type: 'user', id: user.id },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create case' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      caseId: supportCaseId,
      eventId: result.eventId,
    });
  } catch (err) {
    console.error('Failed to create case:', err);
    return NextResponse.json(
      { error: 'Failed to create case' },
      { status: 500 }
    );
  }
}
