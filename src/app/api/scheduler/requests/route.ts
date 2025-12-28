import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchedulingService } from '@/lib/scheduler/schedulingService';
import { CreateSchedulingRequestInput } from '@/lib/scheduler/types';

/**
 * POST /api/scheduler/requests
 * Create a new scheduling request
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Extract initial email options (not part of CreateSchedulingRequestInput)
    const { initial_email, send_immediately, ...requestBody } = body as CreateSchedulingRequestInput & {
      initial_email?: { subject: string; body: string };
      send_immediately?: boolean;
    };

    // Validate required fields
    if (!requestBody.meeting_type) {
      return NextResponse.json(
        { error: 'Meeting type is required' },
        { status: 400 }
      );
    }
    if (!requestBody.external_attendees || requestBody.external_attendees.length === 0) {
      return NextResponse.json(
        { error: 'At least one external attendee is required' },
        { status: 400 }
      );
    }
    if (!requestBody.internal_attendees || requestBody.internal_attendees.length === 0) {
      return NextResponse.json(
        { error: 'At least one internal attendee is required' },
        { status: 400 }
      );
    }

    // Create the scheduling request (use admin client to bypass RLS for user lookup)
    const schedulingService = new SchedulingService({ useAdmin: true });
    const { data, error } = await schedulingService.createSchedulingRequest(
      requestBody,
      userData.id
    );

    if (error) {
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    // If send_immediately is true and we have an initial email, send it now
    if (send_immediately && initial_email && data) {
      try {
        console.log('[Scheduler] Attempting to send email for request:', data.id);
        const sendResult = await schedulingService.sendSchedulingEmail(
          data.id,
          userData.id,
          {
            emailType: 'initial_outreach',
            customSubject: initial_email.subject,
            customBody: initial_email.body,
          }
        );

        if (!sendResult.success) {
          console.error('[Scheduler] Failed to send email:', sendResult.error);
          // Return the error to the client so they know the email failed
          return NextResponse.json(
            {
              data,
              emailError: sendResult.error,
              warning: 'Scheduling request created but email failed to send',
            },
            { status: 201 }
          );
        }

        console.log('[Scheduler] Email sent successfully');
      } catch (emailError) {
        console.error('[Scheduler] Exception sending initial email:', emailError);
        return NextResponse.json(
          {
            data,
            emailError: String(emailError),
            warning: 'Scheduling request created but email failed to send',
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json({ data }, { status: 201 });

  } catch (err) {
    console.error('Error creating scheduling request:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/requests
 * List scheduling requests with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.split(',');
    const dealId = searchParams.get('deal_id') || undefined;
    const companyId = searchParams.get('company_id') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const schedulingService = new SchedulingService();
    const { data, error } = await schedulingService.getSchedulingRequests({
      status: status as any,
      deal_id: dealId,
      company_id: companyId,
      limit,
    });

    if (error) {
      return NextResponse.json(
        { error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });

  } catch (err) {
    console.error('Error fetching scheduling requests:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
