/**
 * POST /api/communications/[id]/respond
 *
 * Marks a communication as responded to.
 * Removes it from the response queue (awaiting_our_response = false).
 * Also adds X-FORCE category to the email in Outlook.
 *
 * Used by Daily Driver when user clicks "Mark Done" on a needsReply item.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';
import { addCommunicationNote, getActionDescription } from '@/lib/communications/addNote';

interface RespondRequestBody {
  responded_at?: string;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseClient = await createClient();

    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get user
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    let body: RespondRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const respondedAt = body.responded_at || new Date().toISOString();

    // Verify the communication exists
    const { data: comm, error: fetchError } = await supabase
      .from('communications')
      .select('id, awaiting_our_response, external_id')
      .eq('id', id)
      .single();

    if (fetchError || !comm) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 });
    }

    // Update the communication
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        awaiting_our_response: false,
        responded_at: respondedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[CommunicationRespond] Update error:', updateError);
      throw updateError;
    }

    console.log(`[CommunicationRespond] Marked communication ${id} as responded`);

    // Add note to track this action
    await addCommunicationNote({
      communicationId: id,
      userId: dbUser.id,
      content: body.notes || getActionDescription('marked_done'),
      noteType: 'action',
      actionType: 'marked_done',
    });

    // Add X-FORCE category to the email in Outlook
    if (comm.external_id) {
      try {
        const { data: msConnection } = await supabase
          .from('microsoft_connections')
          .select('user_id')
          .eq('is_active', true)
          .limit(1)
          .single();

        if (msConnection) {
          const token = await getValidToken(msConnection.user_id);
          if (token) {
            const graphClient = new MicrosoftGraphClient(token);
            await graphClient.addCategoryToMessage(comm.external_id, 'X-FORCE');
            console.log(`[CommunicationRespond] Added X-FORCE category to email`);
          }
        }
      } catch (tagError) {
        // Non-critical, just log
        console.warn('[CommunicationRespond] Could not tag email:', tagError);
      }
    }

    return NextResponse.json({
      success: true,
      responded_at: respondedAt,
    });
  } catch (error) {
    console.error('[CommunicationRespond] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
