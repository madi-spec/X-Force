import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { item_id, outcome, reason } = await request.json();

    if (!item_id || !outcome || !['won', 'lost'].includes(outcome)) {
      return NextResponse.json(
        { error: 'item_id and outcome (won/lost) are required' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current item
    const { data: currentItem, error: fetchError } = await supabase
      .from('company_products')
      .select('id, status, company_id, product_id')
      .eq('id', item_id)
      .single();

    if (fetchError || !currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Determine new status based on outcome
    const newStatus = outcome === 'won' ? 'active' : 'declined';
    const now = new Date().toISOString();

    // Build update object
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    };

    if (outcome === 'won') {
      updateData.activated_at = now;
    } else {
      updateData.declined_at = now;
      if (reason) {
        updateData.declined_reason = reason;
      }
    }

    // Update the status
    const { error: updateError } = await supabase
      .from('company_products')
      .update(updateData)
      .eq('id', item_id);

    if (updateError) {
      console.error('Status update error:', updateError);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // Log the activity
    const { error: activityError } = await supabase.from('activities').insert({
      company_id: currentItem.company_id,
      company_product_id: item_id,
      user_id: user.id,
      type: outcome === 'won' ? 'deal_won' : 'deal_lost',
      description: outcome === 'won'
        ? 'Deal marked as won'
        : `Deal marked as lost${reason ? `: ${reason}` : ''}`,
      metadata: {
        product_id: currentItem.product_id,
        previous_status: currentItem.status,
        new_status: newStatus,
        reason: reason || null,
      },
    });

    if (activityError) {
      console.error('Activity log error:', activityError);
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Update outcome error:', error);
    return NextResponse.json({ error: 'Failed to update outcome' }, { status: 500 });
  }
}
