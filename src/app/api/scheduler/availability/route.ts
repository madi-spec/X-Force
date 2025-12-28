import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMultiAttendeeAvailability } from '@/lib/scheduler/calendarIntegration';

/**
 * POST /api/scheduler/availability
 *
 * Returns available time slots based on calendar availability
 * Used by Quick Book for real-time availability checking
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's internal ID
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      duration_minutes = 30,
      internal_emails = [],
      days_ahead = 10,
      max_slots = 12,
      random_seed,
    } = body;

    // Get available slots
    const result = await getMultiAttendeeAvailability(
      profile.id,
      internal_emails,
      {
        daysAhead: days_ahead,
        slotDuration: duration_minutes,
        maxSlots: max_slots,
        randomSeed: random_seed,
        avoidOverbooked: true,
      }
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      slots: result.slots,
      warnings: result.warnings,
    });

  } catch (err) {
    console.error('[Availability API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
