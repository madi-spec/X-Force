import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/action-items
 *
 * Query params:
 * - activity_id: Filter by meeting activity
 * - transcription_id: Filter by transcription
 * - status: Filter by status (pending, in_progress, done)
 * - assignee_id: Filter by assignee
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('action_items')
      .select(`
        *,
        assignee:users!action_items_assignee_id_fkey(id, name, email)
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    // Apply filters
    const activityId = searchParams.get('activity_id');
    if (activityId) {
      query = query.eq('activity_id', activityId);
    }

    const transcriptionId = searchParams.get('transcription_id');
    if (transcriptionId) {
      query = query.eq('transcription_id', transcriptionId);
    }

    const status = searchParams.get('status');
    if (status) {
      query = query.eq('status', status);
    }

    const assigneeId = searchParams.get('assignee_id');
    if (assigneeId) {
      query = query.eq('assignee_id', assigneeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Action Items API] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Action Items API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch action items' }, { status: 500 });
  }
}

/**
 * POST /api/action-items
 *
 * Create a new action item
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Validate required fields
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // Create action item
    const { data, error } = await supabase
      .from('action_items')
      .insert({
        user_id: profile.id,
        text: body.text,
        activity_id: body.activity_id || null,
        transcription_id: body.transcription_id || null,
        assignee_id: body.assignee_id || null,
        due_date: body.due_date || null,
        status: 'pending',
        source: body.source || 'manual',
        created_by: profile.id,
      })
      .select(`
        *,
        assignee:users!action_items_assignee_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      console.error('[Action Items API] Create error:', error);
      return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[Action Items API] Error:', error);
    return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 });
  }
}
