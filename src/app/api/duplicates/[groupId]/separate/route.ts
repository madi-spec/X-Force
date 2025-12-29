/**
 * POST /api/duplicates/[groupId]/separate
 * Mark records as intentionally separate (not duplicates)
 *
 * Body: { notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SeparateResponse {
  success: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
): Promise<NextResponse<SeparateResponse>> {
  try {
    const { groupId } = await params;

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    // Verify group exists and is pending
    const { data: group, error: groupError } = await supabase
      .from('duplicate_groups')
      .select('id, status')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'Duplicate group not found' },
        { status: 404 }
      );
    }

    if (group.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Group has already been resolved' },
        { status: 400 }
      );
    }

    // Update group status to marked_separate
    const { error: updateError } = await supabase
      .from('duplicate_groups')
      .update({
        status: 'marked_separate',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: notes || 'User confirmed records are intentionally separate',
      })
      .eq('id', groupId);

    if (updateError) {
      console.error('[duplicates/separate] Error updating group:', updateError.message);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    console.log(`[duplicates/separate] Marked group ${groupId} as separate`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[duplicates/separate] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    );
  }
}
