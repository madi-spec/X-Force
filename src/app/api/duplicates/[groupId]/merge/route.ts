/**
 * POST /api/duplicates/[groupId]/merge
 * Merge duplicates in a group
 *
 * Body: { primaryRecordId?: string }
 * - primaryRecordId: Optional override of auto-selected primary
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mergeDuplicates } from '@/lib/duplicates/merge';
import type { MergeResult, DuplicateGroupMember, DuplicateEntityType } from '@/types/duplicates';

export const dynamic = 'force-dynamic';

interface MergeResponse {
  success: boolean;
  result?: MergeResult;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
): Promise<NextResponse<MergeResponse>> {
  try {
    const { groupId } = await params;

    // Authenticate user
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { primaryRecordId } = body;

    // Use admin client for the merge
    const supabase = createAdminClient();

    // Get the group with members
    const { data: group, error: groupError } = await supabase
      .from('duplicate_groups')
      .select(
        `
        *,
        members:duplicate_group_members(*)
      `
      )
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

    const members = group.members as DuplicateGroupMember[];

    // Determine primary record
    const primary = primaryRecordId || group.primary_record_id;
    if (!primary) {
      return NextResponse.json(
        { success: false, error: 'No primary record specified' },
        { status: 400 }
      );
    }

    // Get duplicate IDs (all members except primary)
    const duplicateIds = members
      .filter((m) => m.record_id !== primary)
      .map((m) => m.record_id);

    if (duplicateIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No duplicates to merge' },
        { status: 400 }
      );
    }

    // Perform the merge
    console.log(`[duplicates/merge] Merging ${duplicateIds.length} records into ${primary}`);
    const result = await mergeDuplicates(
      supabase,
      group.entity_type as DuplicateEntityType,
      primary,
      duplicateIds,
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // Update group status
    // Note: resolved_by has FK to users table which doesn't match auth.users IDs,
    // so we omit it to avoid constraint violations
    const { error: updateError } = await supabase
      .from('duplicate_groups')
      .update({
        status: 'merged',
        primary_record_id: primary,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (updateError) {
      console.error('[duplicates/merge] Error updating group status:', updateError.message);
    }

    // Log the merge for potential undo
    // Note: merged_by has FK to users table which doesn't match auth.users IDs,
    // so we omit it to avoid constraint violations
    const deletedSnapshots = members
      .filter((m) => m.record_id !== primary)
      .map((m) => m.record_snapshot);

    const { error: logError } = await supabase.from('duplicate_merge_log').insert({
      group_id: groupId,
      primary_record_id: primary,
      merged_record_ids: duplicateIds,
      merged_data: result.mergedFields,
      deleted_data: deletedSnapshots,
      relocation_counts: result.relocationCounts,
    });

    if (logError) {
      console.error('[duplicates/merge] Error creating merge log:', logError.message);
    }

    console.log(`[duplicates/merge] Successfully merged group ${groupId}`);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[duplicates/merge] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}
