/**
 * Snooze API - Defer Work Items
 *
 * Allows users to snooze command center items until a specified time.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

interface SnoozeRequest {
  snoozed_until: string; // ISO date string
  reason?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    // Verify authentication
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const body: SnoozeRequest = await request.json();

    if (!body.snoozed_until) {
      return NextResponse.json(
        { error: 'snoozed_until is required' },
        { status: 400 }
      );
    }

    // Validate date is in the future
    const snoozeDate = new Date(body.snoozed_until);
    if (isNaN(snoozeDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (snoozeDate <= new Date()) {
      return NextResponse.json(
        { error: 'Snooze date must be in the future' },
        { status: 400 }
      );
    }

    // Update the item
    const { data, error } = await supabase
      .from('command_center_items')
      .update({
        status: 'snoozed',
        snoozed_until: body.snoozed_until,
        last_snoozed_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select('id, status, snoozed_until')
      .single();

    if (error) {
      console.error('[Snooze API] Error updating item:', error);
      return NextResponse.json(
        { error: 'Failed to snooze item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (err) {
    console.error('[Snooze API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Unsnooze an item - mark it as pending again
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    // Verify authentication
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('command_center_items')
      .update({
        status: 'pending',
        snoozed_until: null,
      })
      .eq('id', itemId)
      .eq('status', 'snoozed')
      .select('id, status')
      .single();

    if (error) {
      console.error('[Snooze API] Error unsnoozing item:', error);
      return NextResponse.json(
        { error: 'Failed to unsnooze item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (err) {
    console.error('[Snooze API] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
