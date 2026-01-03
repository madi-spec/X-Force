/**
 * GET/PATCH /api/me
 *
 * Get or update current user's profile and preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, team, default_lens')
      .eq('auth_id', authUser.id)
      .single();

    if (error) {
      console.error('[API /me] Error fetching user:', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[API /me] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { default_lens } = body;

    // Validate lens value
    const validLenses = ['focus', 'customer_success', 'sales', 'onboarding', 'support'];
    if (default_lens && !validLenses.includes(default_lens)) {
      return NextResponse.json({ error: 'Invalid lens value' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (default_lens !== undefined) {
      updates.default_lens = default_lens;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('auth_id', authUser.id)
      .select('id, email, name, role, team, default_lens')
      .single();

    if (error) {
      console.error('[API /me] Error updating user:', error);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[API /me] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
