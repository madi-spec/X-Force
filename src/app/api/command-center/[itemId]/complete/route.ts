/**
 * POST /api/command-center/[itemId]/complete
 *
 * Marks a command center item as completed.
 * Used by Work Queue when user clicks Resolve.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface CompleteRequestBody {
  resolution_notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Parse request body
    let body: CompleteRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    // Verify user exists
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update the command center item
    const { data: updatedItem, error } = await supabase
      .from('command_center_items')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select('id, status, company_name, company_id, company_product_id, title')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      console.error('[CC Complete] Error completing item:', error);
      throw error;
    }

    console.log('[CC Complete] Marked item as completed:', itemId, updatedItem?.company_name);

    // Log activity for the company if we have a company_id and resolution notes
    if (updatedItem?.company_id && body.resolution_notes) {
      try {
        await supabase.from('activities').insert({
          company_id: updatedItem.company_id,
          company_product_id: updatedItem.company_product_id || null,
          user_id: dbUser.id,
          type: 'work_item_resolved',
          title: `Work item resolved: ${updatedItem.title || 'Untitled'}`,
          description: body.resolution_notes,
          metadata: {
            command_center_item_id: itemId,
          },
        });
        console.log('[CC Complete] Activity logged for company:', updatedItem.company_id);
      } catch (activityError) {
        console.error('[CC Complete] Failed to log activity:', activityError);
        // Don't fail the completion if activity logging fails
      }
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error('[CC Complete] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
