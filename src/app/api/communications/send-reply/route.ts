/**
 * POST /api/communications/send-reply
 *
 * Send an email reply for a communication and mark it as responded.
 * Uses Microsoft Graph to reply in the same thread when possible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/microsoft/sendEmail';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';
import { addCommunicationNote, getActionDescription } from '@/lib/communications/addNote';

interface SendReplyRequest {
  communicationId: string;
  to: string;
  subject: string;
  body: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SendReplyRequest = await request.json();
    const { communicationId, to, subject, body: emailBody } = body;

    if (!communicationId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!to.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get user for notes
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    // Get the communication with external_id for thread reply
    const { data: comm, error: commError } = await supabase
      .from('communications')
      .select('id, company_id, external_id')
      .eq('id', communicationId)
      .single();

    if (commError || !comm) {
      return NextResponse.json(
        { success: false, error: 'Communication not found' },
        { status: 404 }
      );
    }

    // Get the active Microsoft connection (user_id may differ from auth user)
    const { data: msConnection } = await supabase
      .from('microsoft_connections')
      .select('user_id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!msConnection) {
      return NextResponse.json(
        { success: false, error: 'No active Microsoft connection found' },
        { status: 400 }
      );
    }

    // Try to reply in the same thread if we have the original message ID
    let sendSuccess = false;
    let sendError: string | undefined;

    if (comm.external_id) {
      // Reply to the original message (keeps it in the same thread)
      try {
        const token = await getValidToken(msConnection.user_id);
        if (token) {
          const graphClient = new MicrosoftGraphClient(token);
          await graphClient.replyToMessage(comm.external_id, emailBody);
          sendSuccess = true;
          console.log('[SendReply] Replied to message in thread:', comm.external_id);
        } else {
          sendError = 'No valid token available';
        }
      } catch (err) {
        console.error('[SendReply] Reply failed, falling back to new email:', err);
        // Fall through to send as new email
      }
    }

    // Fallback: send as a new email if reply failed or no external_id
    if (!sendSuccess) {
      const sendResult = await sendEmail(msConnection.user_id, [to], subject, emailBody);
      sendSuccess = sendResult.success;
      sendError = sendResult.error;
    }

    if (!sendSuccess) {
      return NextResponse.json(
        { success: false, error: sendError || 'Failed to send email' },
        { status: 500 }
      );
    }

    // Mark the communication as responded
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        awaiting_our_response: false,
        responded_at: new Date().toISOString(),
      })
      .eq('id', communicationId);

    if (updateError) {
      console.error('[SendReply] Error updating communication:', updateError);
    }

    // Add "X-FORCE" category to the original email in Outlook
    if (comm.external_id) {
      try {
        const token = await getValidToken(msConnection.user_id);
        if (token) {
          const graphClient = new MicrosoftGraphClient(token);
          await graphClient.addCategoryToMessage(comm.external_id, 'X-FORCE');
          console.log('[SendReply] Added X-FORCE category to message');
        }
      } catch (catErr) {
        console.warn('[SendReply] Could not add category:', catErr);
        // Non-fatal - continue
      }
    }

    // Add note to track this action
    if (dbUser) {
      await addCommunicationNote({
        communicationId,
        userId: dbUser.id,
        content: getActionDescription('sent_reply', { subject }),
        noteType: 'action',
        actionType: 'sent_reply',
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[SendReply] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
