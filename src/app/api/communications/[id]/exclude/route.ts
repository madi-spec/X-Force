/**
 * Exclude/Hide Communication API
 *
 * POST - Exclude a communication from view
 * DELETE - Restore a previously excluded communication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || null;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Exclude the communication
    const { error } = await adminClient
      .from('communications')
      .update({
        excluded_at: new Date().toISOString(),
        excluded_by: user.id,
        exclusion_reason: reason,
      })
      .eq('id', id);

    if (error) {
      console.error('[Exclude] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, excluded: true });
  } catch (error) {
    console.error('[Exclude] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Restore the communication
    const { error } = await adminClient
      .from('communications')
      .update({
        excluded_at: null,
        excluded_by: null,
        exclusion_reason: null,
      })
      .eq('id', id);

    if (error) {
      console.error('[Exclude] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, excluded: false });
  } catch (error) {
    console.error('[Exclude] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
