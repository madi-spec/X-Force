/**
 * POST /api/legacy-deals/[id]/snooze
 *
 * Snoozes a legacy deal for 14 days.
 * The deal will not appear in Legacy Deals during this time.
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

    // Verify the deal exists
    const { data: companyProduct, error: fetchError } = await supabase
      .from('company_products')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !companyProduct) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Update snoozed_until
    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        snoozed_until: fourteenDaysFromNow.toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[SnoozeLegacy] Update error:', updateError);
      throw updateError;
    }

    console.log(`[SnoozeLegacy] Deal ${id} snoozed until ${fourteenDaysFromNow.toISOString()}`);

    return NextResponse.json({
      success: true,
      snoozed_until: fourteenDaysFromNow.toISOString(),
    });
  } catch (error) {
    console.error('[SnoozeLegacy] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
