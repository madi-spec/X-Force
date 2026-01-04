/**
 * Triage API - Unassigned Communications
 *
 * Returns communications that don't have a company_id assigned,
 * allowing users to triage and assign them to companies.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { classifyEmailNoise } from '@/lib/email/noiseDetection';

export interface TriageItem {
  id: string;
  sender_email: string;
  sender_name: string | null;
  subject: string;
  body_preview: string | null;
  received_at: string;
  message_type: 'email' | 'meeting' | 'other';
  source: string | null;
}

interface Participant {
  email?: string;
  name?: string;
}

interface CommunicationRow {
  id: string;
  subject: string | null;
  content_preview: string | null;
  occurred_at: string;
  channel: string | null;
  their_participants: Participant[] | null;
}

export async function GET() {
  try {
    // Verify authentication
    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID from auth_id
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser.id;

    // Get communications without company_id (filtered to current user)
    const { data, error } = await supabase
      .from('communications')
      .select(`
        id,
        subject,
        content_preview,
        occurred_at,
        channel,
        their_participants
      `)
      .eq('user_id', userId)  // Filter to current user's communications only
      .is('company_id', null)
      .is('excluded_at', null)
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Triage API] Error fetching items:', error);
      return NextResponse.json({ error: 'Failed to fetch triage items' }, { status: 500 });
    }

    const items: TriageItem[] = ((data || []) as CommunicationRow[])
      .map((item) => {
        // Extract first participant's email and name
        const firstParticipant = item.their_participants?.[0];
        const senderEmail = firstParticipant?.email || 'Unknown';
        const senderName = firstParticipant?.name || null;

        // Map channel to message_type
        let messageType: 'email' | 'meeting' | 'other' = 'email';
        if (item.channel === 'meeting') messageType = 'meeting';
        else if (item.channel && item.channel !== 'email') messageType = 'other';

        return {
          id: item.id,
          sender_email: senderEmail,
          sender_name: senderName,
          subject: item.subject || '(No Subject)',
          body_preview: item.content_preview?.substring(0, 150) || null,
          received_at: item.occurred_at,
          message_type: messageType,
          source: null,
        };
      })
      // Filter out noise emails (calendar notifications, AI notetakers, etc.)
      .filter((item) => {
        const noiseCheck = classifyEmailNoise(item.sender_email, item.subject);
        return !noiseCheck.isNoise;
      });

    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    console.error('[Triage API] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Assign a communication to a company
 */
export async function POST(request: Request) {
  try {
    // Verify authentication
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { communicationId, companyId, action } = await request.json();

    if (!communicationId) {
      return NextResponse.json({ error: 'communicationId is required' }, { status: 400 });
    }

    if (action === 'ignore') {
      // Mark as excluded (won't show in triage again)
      const { error } = await supabase
        .from('communications')
        .update({ excluded_at: new Date().toISOString() })
        .eq('id', communicationId);

      if (error) {
        console.error('[Triage API] Error ignoring item:', error);
        return NextResponse.json({ error: 'Failed to ignore item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'ignored' });
    }

    if (action === 'assign') {
      if (!companyId) {
        return NextResponse.json({ error: 'companyId is required for assign action' }, { status: 400 });
      }

      // Assign to company
      const { error } = await supabase
        .from('communications')
        .update({ company_id: companyId })
        .eq('id', communicationId);

      if (error) {
        console.error('[Triage API] Error assigning item:', error);
        return NextResponse.json({ error: 'Failed to assign item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'assigned', companyId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[Triage API] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
