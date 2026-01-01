import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDraftForSending, markDraftSent } from '@/lib/scheduler/draftService';
import { sendEmail } from '@/lib/microsoft/sendEmail';
import { SCHEDULING_STATUS, ACTION_TYPES, type SchedulingAttendee } from '@/lib/scheduler/types';

/**
 * POST /api/scheduler/requests/[id]/send
 *
 * Sends the scheduling email for a request.
 *
 * IMPORTANT: This endpoint uses the STORED DRAFT from the database.
 * It NEVER regenerates the email content.
 *
 * The flow is:
 * 1. User generates preview → draft saved to DB
 * 2. User edits preview → edits saved to DB
 * 3. User clicks send → THIS endpoint reads from DB and sends
 *
 * This ensures what the user previewed is exactly what gets sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Get draft from database - NEVER regenerate
    const draft = await getDraftForSending(id);

    if (!draft) {
      return NextResponse.json(
        {
          error: 'No pending draft found. Please preview the email first.',
          hint: 'Use GET /api/scheduler/requests/[id]/preview to generate a draft',
        },
        { status: 400 }
      );
    }

    console.log('[Send] Using stored draft:', {
      subject: draft.subject,
      bodyLength: draft.body.length,
      proposedTimesCount: draft.proposedTimes.length,
    });

    // Get the scheduling request to find recipients
    const adminSupabase = createAdminClient();
    const { data: schedulingRequest, error: requestError } = await adminSupabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*)
      `)
      .eq('id', id)
      .single();

    if (requestError || !schedulingRequest) {
      return NextResponse.json(
        { error: 'Scheduling request not found' },
        { status: 404 }
      );
    }

    // Get external attendees (recipients)
    const externalAttendees = (schedulingRequest.attendees || []).filter(
      (a: SchedulingAttendee) => a.side === 'external'
    );

    if (externalAttendees.length === 0) {
      return NextResponse.json(
        { error: 'No external attendees to send email to' },
        { status: 400 }
      );
    }

    const recipientEmails = externalAttendees.map((a: SchedulingAttendee) => a.email);

    console.log('[Send] Sending to:', recipientEmails);

    // Send email using the stored draft content - exactly as previewed
    const sendResult = await sendEmail(
      userData.id,
      recipientEmails,
      draft.subject,
      draft.body,
      undefined, // cc
      false // isHtml
    );

    if (!sendResult.success) {
      console.error('[Send] Email send failed:', sendResult.error);
      return NextResponse.json(
        {
          error: `Failed to send email: ${sendResult.error}`,
          email: { subject: draft.subject, body: draft.body },
        },
        { status: 500 }
      );
    }

    console.log('[Send] Email sent successfully, isDraft:', sendResult.isDraft);
    console.log('[Send] ConversationId (for thread matching):', sendResult.conversationId);

    // Mark draft as sent
    await markDraftSent(id);

    // Extract proposed time strings for storage
    const proposedTimeStrings = draft.proposedTimes.map((t) => t.display);
    const proposedTimeUtc = draft.proposedTimes.map((t) => t.utc);

    // Build update object with email_thread_id if available
    const updateData: Record<string, unknown> = {
      status: SCHEDULING_STATUS.AWAITING_RESPONSE,
      proposed_times: proposedTimeStrings,
      last_action_at: new Date().toISOString(),
      next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      next_action_type: 'follow_up',
      attempt_count: (schedulingRequest.attempt_count || 0) + 1,
    };

    // CRITICAL: Capture email_thread_id for response matching
    // This enables Strategy 1 (thread-based) matching in findMatchingSchedulingRequest
    if (sendResult.conversationId) {
      updateData.email_thread_id = sendResult.conversationId;
      console.log('[Send] Setting email_thread_id:', sendResult.conversationId);
    }

    // Update scheduling request status
    const { error: updateError } = await adminSupabase
      .from('scheduling_requests')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('[Send] Failed to update request status:', updateError);
      // Don't fail - email was already sent
    }

    // Log the action
    const { error: logError } = await adminSupabase
      .from('scheduling_actions')
      .insert({
        scheduling_request_id: id,
        action_type: ACTION_TYPES.EMAIL_SENT,
        message_subject: draft.subject,
        message_content: draft.body,
        times_proposed: proposedTimeStrings,
        actor: 'user',
        actor_id: userData.id,
        ai_reasoning: `Sent initial outreach email with ${proposedTimeStrings.length} proposed times`,
      });

    if (logError) {
      console.error('[Send] Failed to log action:', logError);
      // Don't fail - email was already sent
    }

    return NextResponse.json({
      success: true,
      message: sendResult.isDraft
        ? 'Email saved as draft in Outlook (draft mode enabled)'
        : 'Scheduling email sent successfully',
      isDraft: sendResult.isDraft,
      email: { subject: draft.subject, body: draft.body },
      proposedTimes: proposedTimeStrings,
    });
  } catch (err) {
    console.error('Error in scheduler send endpoint:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/requests/[id]/send
 *
 * DEPRECATED: Use GET /api/scheduler/requests/[id]/preview instead.
 * This endpoint is kept for backwards compatibility.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Redirect to the new preview endpoint
  const url = new URL(request.url);
  const newUrl = url.href.replace('/send', '/preview');

  return NextResponse.redirect(newUrl);
}
