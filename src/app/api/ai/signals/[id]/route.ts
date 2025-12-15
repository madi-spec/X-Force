import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/ai/signals/[id]
 * Dismiss (deactivate) a signal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mark signal as dismissed
    const { error } = await supabase
      .from('ai_signals')
      .update({
        is_active: false,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error dismissing signal:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss signal' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/signals/[id]/action
 * Mark a signal as actioned
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actionTaken } = body;

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mark signal as actioned
    const { error } = await supabase
      .from('ai_signals')
      .update({
        is_active: false,
        actioned_at: new Date().toISOString(),
        action_taken: actionTaken || null,
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking signal as actioned:', error);
    return NextResponse.json(
      { error: 'Failed to update signal' },
      { status: 500 }
    );
  }
}
