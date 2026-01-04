import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/collateral/[id]/track
 *
 * Track collateral usage
 * Body:
 * {
 *   action: 'viewed' | 'downloaded' | 'shared' | 'copied_link',
 *   meeting_id?: string,
 *   deal_id?: string,
 *   company_id?: string
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: collateralId } = await params;

  const authSupabase = await createClient();

  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  const { action, meeting_id, deal_id, company_id } = body;

  // Validate action
  const validActions = ['viewed', 'downloaded', 'shared', 'copied_link'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Check if collateral exists
  const { data: collateral } = await supabase
    .from('collateral')
    .select('id, view_count, share_count')
    .eq('id', collateralId)
    .single();

  if (!collateral) {
    return NextResponse.json({ error: 'Collateral not found' }, { status: 404 });
  }

  // Insert usage record
  const { error: usageError } = await supabase
    .from('collateral_usage')
    .insert({
      collateral_id: collateralId,
      user_id: user.id,
      action,
      meeting_id: meeting_id || null,
      deal_id: deal_id || null,
      company_id: company_id || null,
    });

  if (usageError) {
    console.error('Error tracking usage:', usageError);
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
  }

  // Update counters and last_used_at
  const updates: Record<string, unknown> = {
    last_used_at: new Date().toISOString(),
  };

  if (action === 'viewed') {
    updates.view_count = (collateral.view_count || 0) + 1;
  } else if (action === 'shared') {
    updates.share_count = (collateral.share_count || 0) + 1;
  }

  await supabase
    .from('collateral')
    .update(updates)
    .eq('id', collateralId);

  return NextResponse.json({ success: true });
}
