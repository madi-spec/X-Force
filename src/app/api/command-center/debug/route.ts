/**
 * Debug endpoint to check calendar sync
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getValidToken } from '@/lib/microsoft/auth';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getRepTimeProfile } from '@/lib/commandCenter';

export async function GET(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser.id;
    const now = new Date();

    // Get user's timezone from profile
    const profile = await getRepTimeProfile(userId);
    const timezone = profile.timezone || 'America/New_York';

    // Get current date in user's timezone (not UTC!)
    const userLocalDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const year = userLocalDate.getFullYear();
    const month = String(userLocalDate.getMonth() + 1).padStart(2, '0');
    const day = String(userLocalDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Check if it's a work day
    const dayName = userLocalDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
    const isWorkDay = profile.work_days?.includes(dayName) ?? true;

    const startDateTime = `${dateStr}T00:00:00`;
    const endDateTime = `${dateStr}T23:59:59`;

    // Get token and fetch calendar
    const token = await getValidToken(userId);

    if (!token) {
      return NextResponse.json({
        error: 'No valid Microsoft token',
        debug: {
          userId: userId.substring(0, 8) + '...',
          serverTime: now.toISOString(),
          dateStr,
          dayName,
          isWorkDay,
          timezone,
        }
      }, { status: 400 });
    }

    const client = new MicrosoftGraphClient(token);

    const events = await client.getCalendarEvents({
      startDateTime,
      endDateTime,
      top: 50,
      timezone,
    });

    return NextResponse.json({
      success: true,
      debug: {
        userId: userId.substring(0, 8) + '...',
        serverTimeUTC: now.toISOString(),
        userLocalDate: userLocalDate.toISOString(),
        dateStr,
        dayName,
        isWorkDay,
        workDays: profile.work_days,
        startDateTime,
        endDateTime,
        timezone,
        workHours: `${profile.work_start_time} - ${profile.work_end_time}`,
      },
      calendar: {
        eventsCount: events.value?.length || 0,
        events: events.value?.map(e => ({
          subject: e.subject,
          start: e.start,
          end: e.end,
          showAs: e.showAs,
          isCancelled: e.isCancelled,
          attendeesCount: e.attendees?.length || 0,
        })) || [],
      }
    });
  } catch (error) {
    console.error('[CalendarDebug] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch calendar',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
