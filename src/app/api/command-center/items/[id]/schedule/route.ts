/**
 * Schedule Meeting API
 *
 * POST /api/command-center/items/[id]/schedule
 * Creates a calendar event and marks the item as completed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getValidToken } from '@/lib/microsoft/auth';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';

interface ScheduleRequest {
  title: string;
  start: string;
  end: string;
  attendees: Array<{
    email: string;
    name?: string;
  }>;
  isOnlineMeeting?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the command center item
    const { data: item, error: itemError } = await supabase
      .from('command_center_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', dbUser.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Parse request body
    const body: ScheduleRequest = await request.json();

    if (!body.title || !body.start || !body.end || !body.attendees?.length) {
      return NextResponse.json(
        { error: 'title, start, end, and attendees are required' },
        { status: 400 }
      );
    }

    // Get Microsoft Graph token
    const token = await getValidToken(dbUser.id);
    if (!token) {
      return NextResponse.json(
        { error: 'No active Microsoft connection. Please connect your account in Settings.' },
        { status: 400 }
      );
    }

    // Create the calendar event
    const graph = new MicrosoftGraphClient(token);

    const event = await graph.createEvent({
      subject: body.title,
      start: {
        dateTime: body.start,
        timeZone: 'UTC',
      },
      end: {
        dateTime: body.end,
        timeZone: 'UTC',
      },
      attendees: body.attendees.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: 'required' as const,
      })),
      isOnlineMeeting: body.isOnlineMeeting ?? true,
      onlineMeetingProvider: 'teamsForBusiness',
    });

    // Mark the command center item as completed
    await supabase
      .from('command_center_items')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    // Log activity if deal/company is linked
    if (item.deal_id || item.company_id) {
      await supabase.from('activities').insert({
        type: 'meeting',
        subject: body.title,
        description: `Scheduled meeting with ${body.attendees.map(a => a.name || a.email).join(', ')}`,
        deal_id: item.deal_id,
        company_id: item.company_id,
        contact_id: item.contact_id,
        created_by: dbUser.id,
        start_at: body.start,
        end_at: body.end,
        metadata: {
          event_id: event.id,
          is_online: body.isOnlineMeeting,
          source: 'command_center',
        },
      });
    }

    return NextResponse.json({
      success: true,
      event_id: event.id,
      web_link: event.webLink,
    });
  } catch (error) {
    console.error('[Schedule] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to schedule meeting' },
      { status: 500 }
    );
  }
}
