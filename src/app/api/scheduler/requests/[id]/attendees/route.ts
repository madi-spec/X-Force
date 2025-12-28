import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ATTENDEE_SIDE, INVITE_STATUS } from '@/lib/scheduler/types';

/**
 * GET /api/scheduler/requests/[id]/attendees
 * Get all attendees for a scheduling request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: attendees, error } = await adminClient
      .from('scheduling_attendees')
      .select(`
        id,
        side,
        user_id,
        contact_id,
        name,
        email,
        title,
        is_required,
        is_organizer,
        is_primary_contact,
        invite_status,
        user:users(id, name, email),
        contact:contacts(id, name, email, title)
      `)
      .eq('scheduling_request_id', id)
      .order('is_organizer', { ascending: false })
      .order('is_primary_contact', { ascending: false });

    if (error) {
      console.error('Error fetching attendees:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendees });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/scheduler/requests/[id]/attendees
 * Add a new attendee to a scheduling request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      side,
      user_id,
      contact_id,
      name,
      email,
      title,
      is_organizer,
      is_primary_contact,
    } = body;

    if (!side || !['internal', 'external'].includes(side)) {
      return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
    }

    if (side === 'internal' && !user_id) {
      return NextResponse.json({ error: 'user_id required for internal attendee' }, { status: 400 });
    }

    if (side === 'external' && !email) {
      return NextResponse.json({ error: 'email required for external attendee' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Check for duplicate
    let existingQuery = adminClient
      .from('scheduling_attendees')
      .select('id')
      .eq('scheduling_request_id', id);

    if (side === 'internal' && user_id) {
      existingQuery = existingQuery.eq('user_id', user_id);
    } else if (side === 'external' && email) {
      existingQuery = existingQuery.eq('email', email);
    }

    const { data: existing } = await existingQuery.limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Attendee already exists' }, { status: 409 });
    }

    // Get user/contact info if needed
    let attendeeName = name;
    let attendeeEmail = email;
    let attendeeTitle = title;

    if (side === 'internal' && user_id) {
      const { data: userData } = await adminClient
        .from('users')
        .select('name, email')
        .eq('id', user_id)
        .single();
      if (userData) {
        attendeeName = userData.name || name;
        attendeeEmail = userData.email || email;
      }
    }

    if (side === 'external' && contact_id) {
      const { data: contactData } = await adminClient
        .from('contacts')
        .select('name, email, title')
        .eq('id', contact_id)
        .single();
      if (contactData) {
        attendeeName = contactData.name || name;
        attendeeEmail = contactData.email || email;
        attendeeTitle = contactData.title || title;
      }
    }

    const { data: attendee, error } = await adminClient
      .from('scheduling_attendees')
      .insert({
        scheduling_request_id: id,
        side,
        user_id: side === 'internal' ? user_id : null,
        contact_id: side === 'external' ? contact_id : null,
        name: attendeeName,
        email: attendeeEmail,
        title: attendeeTitle || null,
        is_organizer: is_organizer || false,
        is_primary_contact: is_primary_contact || false,
        is_required: true,
        invite_status: INVITE_STATUS.PENDING,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding attendee:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendee });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/scheduler/requests/[id]/attendees
 * Remove an attendee from a scheduling request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attendeeId = searchParams.get('attendee_id');

    if (!attendeeId) {
      return NextResponse.json({ error: 'attendee_id required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify the attendee belongs to this request
    const { data: attendee } = await adminClient
      .from('scheduling_attendees')
      .select('id, is_organizer')
      .eq('id', attendeeId)
      .eq('scheduling_request_id', id)
      .single();

    if (!attendee) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }

    // Don't allow removing the organizer
    if (attendee.is_organizer) {
      return NextResponse.json({ error: 'Cannot remove the organizer' }, { status: 400 });
    }

    const { error } = await adminClient
      .from('scheduling_attendees')
      .delete()
      .eq('id', attendeeId);

    if (error) {
      console.error('Error removing attendee:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
