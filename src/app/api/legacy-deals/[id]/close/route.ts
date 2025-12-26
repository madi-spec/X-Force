/**
 * POST /api/legacy-deals/[id]/close
 *
 * Closes a legacy deal as lost.
 * Permanently removes it from Legacy Deals.
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

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    // Verify the deal exists
    const { data: companyProduct, error: fetchError } = await supabase
      .from('company_products')
      .select('id, status, company_id')
      .eq('id', id)
      .single();

    if (fetchError || !companyProduct) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const now = new Date();

    // Update status to closed_lost
    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        status: 'closed_lost',
        closed_at: now.toISOString(),
        closed_reason: 'Legacy deal closed',
        snoozed_until: null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[CloseLegacy] Update error:', updateError);
      throw updateError;
    }

    // Resolve any open attention flags for this deal
    await supabase
      .from('attention_flags')
      .update({
        status: 'resolved',
        resolved_at: now.toISOString(),
        resolution_notes: 'Deal closed from Legacy Deals',
      })
      .eq('company_product_id', id)
      .eq('status', 'open');

    console.log(`[CloseLegacy] Deal ${id} closed as lost`);

    return NextResponse.json({
      success: true,
      status: 'closed_lost',
      closed_at: now.toISOString(),
    });
  } catch (error) {
    console.error('[CloseLegacy] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
