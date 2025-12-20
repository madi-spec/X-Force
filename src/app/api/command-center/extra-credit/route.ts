import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/command-center/extra-credit
 *
 * Returns high-momentum overflow items that fit within the specified time.
 * Used by the "Extra Credit" panel when user has extra time.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const availableMinutes = body.available_minutes || 30;

    const adminClient = createAdminClient();

    // Get all pending items sorted by momentum score
    const { data: items, error: itemsError } = await adminClient
      .from('command_center_items')
      .select(`
        id,
        title,
        action_type,
        target_name,
        company_name,
        deal_value,
        deal_probability,
        deal_stage,
        estimated_minutes,
        momentum_score,
        why_now,
        source,
        deal:deals(id, name, stage)
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('momentum_score', { ascending: false });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // Filter items that fit within available time using greedy algorithm
    const fittingItems: typeof items = [];
    let usedMinutes = 0;

    for (const item of items || []) {
      const duration = item.estimated_minutes || 15;
      if (usedMinutes + duration <= availableMinutes) {
        fittingItems.push(item);
        usedMinutes += duration;
      }
    }

    // Calculate total potential value
    const totalValue = fittingItems.reduce((sum, item) => {
      const value = item.deal_value || 0;
      const probability = item.deal_probability || 0.5;
      return sum + value * probability;
    }, 0);

    return NextResponse.json({
      items: fittingItems,
      total_minutes: usedMinutes,
      total_value: totalValue,
      available_minutes: availableMinutes,
      overflow_count: (items?.length || 0) - fittingItems.length,
    });
  } catch (error) {
    console.error('Extra credit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/command-center/extra-credit
 *
 * Add selected items to today's plan.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const itemIds: string[] = body.item_ids || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ error: 'No items specified' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const today = new Date().toISOString().split('T')[0];

    // Update items to be planned for today
    const { error: updateError } = await adminClient
      .from('command_center_items')
      .update({
        planned_for_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('id', itemIds);

    if (updateError) {
      console.error('Error updating items:', updateError);
      return NextResponse.json({ error: 'Failed to add items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      added_count: itemIds.length,
    });
  } catch (error) {
    console.error('Extra credit add error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
