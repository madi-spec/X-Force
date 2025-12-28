import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { executeConfirmationWorkflow } from '@/lib/scheduler';

/**
 * POST /api/scheduler/requests/[id]/confirm
 * Confirm a meeting time and execute the full confirmation workflow:
 * - Create calendar event with Teams meeting
 * - Send confirmation email
 * - Schedule reminder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    const body = await request.json();
    const {
      scheduledTime,
      sendConfirmationEmail = true,
      customMessage,
    } = body;

    if (!scheduledTime) {
      return NextResponse.json(
        { error: 'Scheduled time is required' },
        { status: 400 }
      );
    }

    // Execute the full confirmation workflow
    const result = await executeConfirmationWorkflow({
      schedulingRequestId: id,
      userId: userData.id,
      confirmedTime: new Date(scheduledTime),
      sendConfirmationEmail,
      customMessage,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Confirmation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        calendarEventId: result.calendarEventId,
        meetingLink: result.meetingLink,
        confirmationEmailSent: result.confirmationEmailSent,
        reminderScheduled: result.reminderScheduled,
      },
    });

  } catch (err) {
    console.error('Error confirming meeting:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}
