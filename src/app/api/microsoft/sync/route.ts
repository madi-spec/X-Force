import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncEmails } from '@/lib/microsoft/emailSync';
import { syncCalendarEvents } from '@/lib/microsoft/calendarSync';
import { hasActiveConnection } from '@/lib/microsoft/auth';

/**
 * Trigger manual sync of Microsoft 365 data
 * POST /api/microsoft/sync
 */
export async function POST() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Check if user has active Microsoft connection
  const isConnected = await hasActiveConnection(profile.id);
  if (!isConnected) {
    return NextResponse.json(
      { error: 'No active Microsoft connection' },
      { status: 400 }
    );
  }

  // Run sync operations in parallel
  const [emailResult, calendarResult] = await Promise.all([
    syncEmails(profile.id),
    syncCalendarEvents(profile.id),
  ]);

  const hasErrors = emailResult.errors.length > 0 || calendarResult.errors.length > 0;

  return NextResponse.json({
    success: !hasErrors,
    emailsImported: emailResult.imported,
    emailsSkipped: emailResult.skipped,
    eventsImported: calendarResult.imported,
    eventsSkipped: calendarResult.skipped,
    errors: [...emailResult.errors, ...calendarResult.errors],
  });
}
