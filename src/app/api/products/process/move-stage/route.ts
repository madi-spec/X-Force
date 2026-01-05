import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { item_id, to_stage_id, note } = await request.json();

    if (!item_id || !to_stage_id || !note || note.trim().length < 10) {
      return NextResponse.json(
        { error: 'item_id, to_stage_id, and note (min 10 chars) are required' },
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
      .select('id, current_stage_id, company_id')
      .eq('id', item_id)
      .single();

    if (fetchError || !currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Update the stage
    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        current_stage_id: to_stage_id,
        last_stage_moved_at: new Date().toISOString(),
        stage_entered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);

    if (updateError) {
      console.error('Stage update error:', updateError);
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 });
    }

    // Log the activity
    const { error: activityError } = await supabase.from('activities').insert({
      company_id: currentItem.company_id,
      user_id: user.id,
      type: 'stage_change',
      description: note,
      metadata: {
        company_product_id: item_id,
        from_stage_id: currentItem.current_stage_id,
        to_stage_id
      },
    });

    if (activityError) {
      console.error('Activity log error:', activityError);
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Move stage error:', error);
    return NextResponse.json({ error: 'Failed to move stage' }, { status: 500 });
  }
}
