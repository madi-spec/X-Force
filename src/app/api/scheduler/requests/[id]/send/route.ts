import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchedulingService } from '@/lib/scheduler/schedulingService';
import type { EmailType } from '@/lib/scheduler/emailGeneration';

/**
 * POST /api/scheduler/requests/[id]/send
 *
 * Sends the scheduling email for a request.
 * - Generates proposed meeting times based on preferences
 * - Creates AI-generated email content
 * - Sends via Microsoft Graph API
 * - Updates request state to 'awaiting_response'
 * - Logs the action to scheduling_actions table
 *
 * Body (optional):
 * - emailType: 'initial_outreach' | 'follow_up' | 'second_follow_up' | etc.
 * - customSubject: Override AI-generated subject
 * - customBody: Override AI-generated body
 * - preview: If true, returns email content without sending
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

    // Parse request body
    let body: {
      emailType?: EmailType;
      customSubject?: string;
      customBody?: string;
      preview?: boolean;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is ok
    }

    const schedulingService = new SchedulingService();

    // Preview mode - return email content without sending
    if (body.preview) {
      const result = await schedulingService.previewSchedulingEmail(
        id,
        body.emailType || 'initial_outreach'
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        preview: true,
        email: result.email,
        proposedTimes: result.proposedTimes,
      });
    }

    // Send the actual email
    const result = await schedulingService.sendSchedulingEmail(id, userData.id, {
      emailType: body.emailType,
      customSubject: body.customSubject,
      customBody: body.customBody,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          email: result.email, // Include generated email for debugging
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduling email sent successfully',
      email: result.email,
      proposedTimes: result.proposedTimes,
    });
  } catch (err) {
    console.error('Error in scheduler send endpoint:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/requests/[id]/send
 *
 * Preview the email that would be sent (convenience endpoint).
 * Query params:
 * - type: EmailType (default: 'initial_outreach')
 */
export async function GET(
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

    const searchParams = request.nextUrl.searchParams;
    const emailType = (searchParams.get('type') || 'initial_outreach') as EmailType;

    const schedulingService = new SchedulingService();
    const result = await schedulingService.previewSchedulingEmail(id, emailType);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      preview: true,
      emailType,
      email: result.email,
      proposedTimes: result.proposedTimes,
    });
  } catch (err) {
    console.error('Error in scheduler preview endpoint:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
