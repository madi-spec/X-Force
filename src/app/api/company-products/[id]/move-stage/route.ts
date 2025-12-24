import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  const { stage_id, outcome } = body;
  // outcome: 'next' | 'won' | 'declined'

  // Get current company_product
  const { data: cp, error: fetchError } = await supabase
    .from('company_products')
    .select(`
      *,
      current_stage:product_sales_stages(*),
      product:products(*)
    `)
    .eq('id', id)
    .single();

  if (fetchError || !cp) {
    return NextResponse.json({ error: 'Company product not found' }, { status: 404 });
  }

  let updateData: Record<string, unknown> = {};
  let historyEvent = '';

  if (outcome === 'won') {
    updateData = {
      status: 'in_onboarding',
      current_stage_id: null,
      stage_entered_at: null,
      onboarding_started_at: new Date().toISOString(),
    };
    historyEvent = 'status_changed';
  } else if (outcome === 'declined') {
    updateData = {
      status: 'declined',
      current_stage_id: null,
      stage_entered_at: null,
      declined_at: new Date().toISOString(),
    };
    historyEvent = 'status_changed';
  } else if (stage_id) {
    updateData = {
      current_stage_id: stage_id,
      stage_entered_at: new Date().toISOString(),
    };
    historyEvent = 'stage_changed';
  } else {
    return NextResponse.json({ error: 'stage_id or outcome required' }, { status: 400 });
  }

  // Update
  const { error: updateError } = await supabase
    .from('company_products')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log history
  const currentStage = cp.current_stage as { name?: string } | null;
  await supabase.from('company_product_history').insert({
    company_product_id: id,
    event_type: historyEvent,
    from_value: currentStage?.name || cp.status,
    to_value: outcome || stage_id,
  });

  return NextResponse.json({ success: true });
}
