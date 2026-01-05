import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/action-items/:id
 *
 * Get a single action item by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('action_items')
      .select(`
        *,
        assignee:users!action_items_assignee_id_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
      }
      console.error('[Action Items API] Get error:', error);
      return NextResponse.json({ error: 'Failed to fetch action item' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Action Items API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch action item' }, { status: 500 });
  }
}

/**
 * PATCH /api/action-items/:id
 *
 * Update an action item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile for completed_by
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.text !== undefined) {
      updates.text = body.text;
    }

    if (body.assignee_id !== undefined) {
      updates.assignee_id = body.assignee_id;
    }

    if (body.due_date !== undefined) {
      updates.due_date = body.due_date;
    }

    if (body.status !== undefined) {
      updates.status = body.status;

      // Handle completion timestamp
      if (body.status === 'done') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = profile?.id || null;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }
    }

    const { data, error } = await supabase
      .from('action_items')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        assignee:users!action_items_assignee_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
      }
      console.error('[Action Items API] Update error:', error);
      return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Action Items API] Error:', error);
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 });
  }
}

/**
 * DELETE /api/action-items/:id
 *
 * Delete an action item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('action_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Action Items API] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete action item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Action Items API] Error:', error);
    return NextResponse.json({ error: 'Failed to delete action item' }, { status: 500 });
  }
}
