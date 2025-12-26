/**
 * Legacy Deals API
 *
 * GET - Returns company_products that are considered "legacy":
 * - current_stage_id IS NULL
 * - OR last_human_touch_at IS NULL
 * - OR last_human_touch_at < 30 days ago
 *
 * These deals are intentionally separated from Daily Driver.
 * They do NOT generate attention flags or urgency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';

export interface LegacyDealItem {
  id: string;
  company_id: string;
  company_name: string;
  product_id: string;
  product_name: string;
  stage_id: string | null;
  stage_name: string | null;
  last_human_touch_at: string | null;
  created_at: string;
  status: string;
}

export interface LegacyDealsResponse {
  deals: LegacyDealItem[];
  count: number;
  meta: {
    generatedAt: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Query for legacy deals:
    // - status = 'in_sales' (active deals only)
    // - AND (current_stage_id IS NULL OR last_human_touch_at IS NULL OR last_human_touch_at < 30 days ago)
    const { data: legacyDeals, error: queryError } = await supabase
      .from('company_products')
      .select(`
        id,
        company_id,
        current_stage_id,
        last_human_touch_at,
        created_at,
        status,
        company:companies(id, name),
        product:products(id, name, slug),
        current_stage:product_sales_stages(id, name)
      `)
      .eq('status', 'in_sales')
      .or(`current_stage_id.is.null,last_human_touch_at.is.null,last_human_touch_at.lt.${thirtyDaysAgo.toISOString()}`)
      .order('created_at', { ascending: true });

    if (queryError) {
      console.error('[LegacyDeals] Query error:', queryError);
      throw queryError;
    }

    // Transform to response format
    const deals: LegacyDealItem[] = (legacyDeals || []).map((row) => {
      const company = firstOrNull(row.company as Record<string, unknown> | Record<string, unknown>[] | null);
      const product = firstOrNull(row.product as Record<string, unknown> | Record<string, unknown>[] | null);
      const stage = firstOrNull(row.current_stage as Record<string, unknown> | Record<string, unknown>[] | null);

      return {
        id: row.id,
        company_id: row.company_id,
        company_name: (company?.name as string) || 'Unknown Company',
        product_id: (product?.id as string) || '',
        product_name: (product?.name as string) || 'Unknown Product',
        stage_id: row.current_stage_id,
        stage_name: (stage?.name as string) || null,
        last_human_touch_at: row.last_human_touch_at,
        created_at: row.created_at,
        status: row.status,
      };
    });

    const response: LegacyDealsResponse = {
      deals,
      count: deals.length,
      meta: {
        generatedAt: now.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[LegacyDeals] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
