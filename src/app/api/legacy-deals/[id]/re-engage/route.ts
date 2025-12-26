/**
 * POST /api/legacy-deals/[id]/re-engage
 *
 * Re-engages a legacy deal by setting it up for active sales:
 * - Sets current_stage_id to first stage of the product
 * - Sets last_stage_moved_at = now()
 * - Sets last_human_touch_at = now()
 * - Sets next_step_due_at = now() + 3 days
 *
 * After this, the deal is no longer legacy and enters normal Daily Driver flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get the company_product with its product
    const { data: companyProduct, error: fetchError } = await supabase
      .from('company_products')
      .select(`
        id,
        product_id,
        status
      `)
      .eq('id', id)
      .single();

    if (fetchError || !companyProduct) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (companyProduct.status !== 'in_sales') {
      return NextResponse.json(
        { error: 'Deal is not in active sales status' },
        { status: 400 }
      );
    }

    // Get the first stage for this product
    const { data: firstStage } = await supabase
      .from('product_sales_stages')
      .select('id, name')
      .eq('product_id', companyProduct.product_id)
      .order('stage_order', { ascending: true })
      .limit(1)
      .single();

    if (!firstStage) {
      return NextResponse.json(
        { error: 'No sales stages defined for this product' },
        { status: 400 }
      );
    }

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Update the company_product to re-engage
    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        current_stage_id: firstStage.id,
        last_stage_moved_at: now.toISOString(),
        last_human_touch_at: now.toISOString(),
        next_step_due_at: threeDaysFromNow.toISOString(),
        snoozed_until: null, // Clear any snooze
      })
      .eq('id', id);

    if (updateError) {
      console.error('[ReEngage] Update error:', updateError);
      throw updateError;
    }

    console.log(`[ReEngage] Deal ${id} re-engaged, set to stage: ${firstStage.name}`);

    return NextResponse.json({
      success: true,
      stage_id: firstStage.id,
      stage_name: firstStage.name,
      next_step_due_at: threeDaysFromNow.toISOString(),
    });
  } catch (error) {
    console.error('[ReEngage] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
