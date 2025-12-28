import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  processSchedulingEmails,
  findMatchingSchedulingRequest,
  processSchedulingResponse,
  type IncomingEmail,
} from '@/lib/scheduler/responseProcessor';

/**
 * POST /api/scheduler/process-responses
 *
 * Manually trigger processing of scheduling email responses.
 * This is useful for testing and for immediate processing after sync.
 *
 * Body (optional):
 * - user_id: Process responses for specific user (optional, defaults to authenticated user)
 * - email_id: Process a specific email (for testing)
 * - force: Re-process even if already handled
 */
export async function POST(request: NextRequest) {
  try {
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
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: {
      user_id?: string;
      email_id?: string;
      force?: boolean;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is ok
    }

    const targetUserId = body.user_id || userData.id;

    // If specific email_id provided, process just that one
    if (body.email_id) {
      return await processSpecificEmail(body.email_id, body.force);
    }

    // Process all scheduling responses for user
    const result = await processSchedulingEmails(targetUserId);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      matched: result.matched,
      errors: result.errors,
    });
  } catch (err) {
    console.error('Error processing scheduling responses:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Process a specific email for scheduling response detection
 */
async function processSpecificEmail(emailId: string, force?: boolean) {
  const supabase = createAdminClient();

  // Get the email from email_messages table
  const { data: emailMessage, error: emailError } = await supabase
    .from('email_messages')
    .select(`
      id,
      subject,
      body_text,
      body_preview,
      from_email,
      from_name,
      received_at,
      conversation_ref,
      direction
    `)
    .eq('id', emailId)
    .single();

  if (emailError || !emailMessage) {
    return NextResponse.json(
      { error: 'Email not found', details: emailError?.message },
      { status: 404 }
    );
  }

  if (emailMessage.direction !== 'inbound') {
    return NextResponse.json(
      { error: 'Can only process inbound emails' },
      { status: 400 }
    );
  }

  const incomingEmail: IncomingEmail = {
    id: emailMessage.id,
    subject: emailMessage.subject || '',
    body: emailMessage.body_text || emailMessage.body_preview || '',
    bodyPreview: emailMessage.body_preview || '',
    from: {
      address: emailMessage.from_email,
      name: emailMessage.from_name,
    },
    receivedDateTime: emailMessage.received_at,
    conversationId: emailMessage.conversation_ref,
  };

  // Check if already processed (unless force=true)
  if (!force) {
    const { data: existingAction } = await supabase
      .from('scheduling_actions')
      .select('id')
      .eq('email_id', emailId)
      .single();

    if (existingAction) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: 'Email already processed for scheduling',
      });
    }
  }

  // Find matching scheduling request
  const matchingRequest = await findMatchingSchedulingRequest(incomingEmail);

  if (!matchingRequest) {
    return NextResponse.json({
      success: true,
      matched: false,
      message: 'No matching scheduling request found for this email',
    });
  }

  // Process the response
  const result = await processSchedulingResponse(incomingEmail, matchingRequest);

  return NextResponse.json({
    success: result.processed,
    matched: true,
    schedulingRequestId: result.schedulingRequestId,
    action: result.action,
    newStatus: result.newStatus,
    error: result.error,
  });
}

/**
 * GET /api/scheduler/process-responses
 *
 * Get statistics about pending scheduling responses
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adminSupabase = createAdminClient();

    // Get active scheduling requests awaiting response
    const { data: awaitingResponse } = await adminSupabase
      .from('scheduling_requests')
      .select(`
        id,
        title,
        status,
        last_action_at,
        attendees:scheduling_attendees(name, email, side)
      `)
      .eq('created_by', userData.id)
      .eq('status', 'awaiting_response');

    // Get recent inbound emails that might be responses
    const { data: recentInbound } = await adminSupabase
      .from('activities')
      .select('id, subject, occurred_at, metadata')
      .eq('type', 'email_received')
      .eq('user_id', userData.id)
      .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      awaitingResponse: awaitingResponse?.length || 0,
      awaitingResponseDetails: awaitingResponse || [],
      recentInboundEmails: recentInbound?.length || 0,
    });
  } catch (err) {
    console.error('Error getting scheduling response stats:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
