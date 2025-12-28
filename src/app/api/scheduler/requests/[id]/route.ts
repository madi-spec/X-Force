import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchedulingService } from '@/lib/scheduler/schedulingService';
import { UpdateSchedulingRequestInput } from '@/lib/scheduler/types';

/**
 * GET /api/scheduler/requests/[id]
 * Get a specific scheduling request with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schedulingService = new SchedulingService();
    const { data, error } = await schedulingService.getSchedulingRequest(id);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data });

  } catch (err) {
    console.error('Error fetching scheduling request:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/scheduler/requests/[id]
 * Update a scheduling request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    const body: UpdateSchedulingRequestInput = await request.json();

    const schedulingService = new SchedulingService();
    const { data, error } = await schedulingService.updateSchedulingRequest(
      id,
      body,
      userData?.id
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });

  } catch (err) {
    console.error('Error updating scheduling request:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/scheduler/requests/[id]
 * Cancel a scheduling request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    const schedulingService = new SchedulingService();
    const { success, error } = await schedulingService.transitionState(
      id,
      'cancelled',
      { actor: 'user', actorId: userData?.id, reasoning: 'Cancelled by user' }
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success });

  } catch (err) {
    console.error('Error cancelling scheduling request:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
