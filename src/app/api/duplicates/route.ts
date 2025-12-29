/**
 * GET /api/duplicates
 * List duplicate groups with filters
 *
 * Query params:
 * - entityType: 'company' | 'contact' | 'customer'
 * - status: 'pending' | 'merged' | 'marked_separate'
 * - confidence: 'exact' | 'high' | 'medium' | 'low'
 * - groupId: specific group ID to fetch
 * - limit: max number of results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DuplicateGroup } from '@/types/duplicates';

export const dynamic = 'force-dynamic';

interface DuplicatesResponse {
  groups: DuplicateGroup[];
  total?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse<DuplicatesResponse | { error: string }>> {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const status = searchParams.get('status');
    const confidence = searchParams.get('confidence');
    const groupId = searchParams.get('groupId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('duplicate_groups')
      .select(
        `
        *,
        members:duplicate_group_members(
          id,
          record_id,
          field_count,
          completeness_score,
          is_primary,
          record_snapshot,
          created_at
        )
      `
      )
      .order('detected_at', { ascending: false });

    // Apply filters
    if (groupId) {
      query = query.eq('id', groupId);
    }
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (confidence) {
      query = query.eq('confidence', confidence);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[duplicates] Error fetching groups:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      groups: (data as DuplicateGroup[]) || [],
    });
  } catch (error) {
    console.error('[duplicates] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch duplicates' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/duplicates/count
 * Get count of pending duplicates by entity type
 */
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse(null, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');

    let query = supabase
      .from('duplicate_groups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { count } = await query;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Count': String(count || 0),
      },
    });
  } catch (error) {
    console.error('[duplicates/count] Error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
