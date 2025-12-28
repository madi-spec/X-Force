import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { capturePostmortemLearnings } from '@/lib/ai/memory';

/**
 * GET /api/deals/[id]/postmortem
 *
 * Get existing postmortem for a deal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get postmortem if exists
  const { data: postmortem } = await supabase
    .from('deal_postmortems')
    .select('*')
    .eq('deal_id', dealId)
    .single();

  // Get deal info
  const { data: deal } = await supabase
    .from('deals')
    .select('id, name, stage, company_id, closed_at, lost_reason')
    .eq('id', dealId)
    .single();

  return NextResponse.json({
    postmortem,
    deal,
  });
}

/**
 * POST /api/deals/[id]/postmortem
 *
 * Create or update a deal postmortem
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;

  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const {
    outcome, // 'won' | 'lost'
    primaryReason,
    whatWorked,
    whatDidntWork,
    competitorInfo,
    keyLearnings,
    recommendedChanges,
  } = body;

  if (!outcome || !['won', 'lost'].includes(outcome)) {
    return NextResponse.json(
      { error: 'outcome must be won or lost' },
      { status: 400 }
    );
  }

  if (!primaryReason) {
    return NextResponse.json(
      { error: 'primaryReason is required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get deal to verify it exists and get company_id
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, company_id, stage')
    .eq('id', dealId)
    .single();

  if (dealError || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Verify deal is closed
  if (!['closed_won', 'closed_lost'].includes(deal.stage)) {
    return NextResponse.json(
      { error: 'Can only create postmortem for closed deals' },
      { status: 400 }
    );
  }

  // Upsert postmortem
  const { data: postmortem, error: upsertError } = await supabase
    .from('deal_postmortems')
    .upsert({
      deal_id: dealId,
      outcome,
      primary_reason: primaryReason,
      what_worked: whatWorked || [],
      what_didnt_work: whatDidntWork || [],
      competitor_info: competitorInfo || null,
      key_learnings: keyLearnings || [],
      recommended_changes: recommendedChanges || [],
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'deal_id' })
    .select()
    .single();

  if (upsertError) {
    console.error('[Postmortem] Error saving:', upsertError);
    return NextResponse.json({ error: 'Failed to save postmortem' }, { status: 500 });
  }

  // Capture learnings to account memory
  let memoryCapture = null;
  if (deal.company_id) {
    try {
      memoryCapture = await capturePostmortemLearnings(
        deal.company_id,
        dealId,
        outcome,
        {
          primaryReason,
          whatWorked,
          whatDidntWork,
          keyLearnings,
        }
      );
      console.log('[Postmortem] Memory captured:', memoryCapture);
    } catch (memoryError) {
      console.error('[Postmortem] Memory capture error:', memoryError);
    }
  }

  // Update deal's lost_reason if this is a loss
  if (outcome === 'lost') {
    await supabase
      .from('deals')
      .update({ lost_reason: primaryReason })
      .eq('id', dealId);
  }

  return NextResponse.json({
    postmortem,
    memoryCapture,
    message: 'Postmortem saved successfully',
  });
}
