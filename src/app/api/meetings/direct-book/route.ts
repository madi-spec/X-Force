/**
 * Direct Meeting Booking API
 *
 * POST /api/meetings/direct-book
 * Creates a calendar event directly via Microsoft Graph
 * Used by the unified scheduler modal in direct mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getValidToken } from '@/lib/microsoft/auth';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';

interface DirectBookRequest {
  title: string;
  start: string;
  end: string;
  attendees: Array<{
    email: string;
    name?: string;
  }>;
  isOnlineMeeting?: boolean;
  // Optional associations
  companyId?: string;
  dealId?: string;
  contactId?: string;
  // Work item context for resolution
  workItemId?: string;
  attentionFlagId?: string;
  communicationId?: string;
}

export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body: DirectBookRequest = await request.json();

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

    // Log activity if deal/company is linked
    if (body.dealId || body.companyId) {
      await supabase.from('activities').insert({
        type: 'meeting',
        subject: body.title,
        description: `Scheduled meeting with ${body.attendees.map(a => a.name || a.email).join(', ')}`,
        deal_id: body.dealId || null,
        company_id: body.companyId || null,
        contact_id: body.contactId || null,
        created_by: dbUser.id,
        start_at: body.start,
        end_at: body.end,
        metadata: {
          event_id: event.id,
          is_online: body.isOnlineMeeting,
          source: 'direct_book',
          work_item_id: body.workItemId,
        },
      });
    }

    // Resolve attention flag if provided
    if (body.attentionFlagId) {
      try {
        await supabase
          .from('attention_flags')
          .update({
            status: 'resolved',
            resolution_notes: 'Meeting booked directly',
            resolved_at: new Date().toISOString(),
          })
          .eq('id', body.attentionFlagId);
      } catch (err) {
        console.error('[DirectBook] Failed to resolve attention flag:', err);
      }
    }

    // Mark communication as responded if provided
    if (body.communicationId) {
      try {
        await supabase
          .from('communications')
          .update({
            needs_response: false,
            response_sent_at: new Date().toISOString(),
          })
          .eq('id', body.communicationId);
      } catch (err) {
        console.error('[DirectBook] Failed to update communication:', err);
      }
    }

    return NextResponse.json({
      success: true,
      event_id: event.id,
      web_link: event.webLink,
    });
  } catch (error) {
    console.error('[DirectBook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to book meeting' },
      { status: 500 }
    );
  }
}
