import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  // Get the user_id from microsoft_connections
  const { data: conn } = await supabase
    .from('microsoft_connections')
    .select('user_id')
    .eq('is_active', true)
    .single();

  if (!conn) {
    console.log('No active connection');
    return;
  }

  const { getValidToken } = await import('../src/lib/microsoft/auth');
  const { MicrosoftGraphClient } = await import('../src/lib/microsoft/graph');

  const token = await getValidToken(conn.user_id);
  if (!token) {
    console.log('No token');
    return;
  }

  const graphClient = new MicrosoftGraphClient(token);

  // Calculate date range
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  console.log('Fetching calendar from', startDate.toISOString(), 'to', endDate.toISOString());

  const eventsResult = await graphClient.getCalendarEvents({
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    top: 100,
    timezone: 'America/New_York',
  });

  console.log('\nCalendar events found:', eventsResult.value?.length || 0);

  if (eventsResult.value) {
    for (const event of eventsResult.value) {
      console.log(`\n  Subject: ${event.subject}`);
      console.log(`  Start: ${event.start.dateTime}`);
      console.log(`  End: ${event.end.dateTime}`);
      console.log(`  ShowAs: ${event.showAs}`);
      console.log(`  Cancelled: ${event.isCancelled}`);
    }
  }

  // Now let's manually check available slots for Monday (Dec 30)
  console.log('\n--- Manual slot check for Dec 30 (Mon) ---');
  const testDate = new Date('2025-12-30T09:00:00');
  const busyBlocks: Array<{ start: Date; end: Date }> = [];

  for (const event of eventsResult.value || []) {
    if (event.isCancelled) continue;
    if (event.showAs === 'free' || event.showAs === 'workingElsewhere') continue;

    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    busyBlocks.push({ start: eventStart, end: eventEnd });
  }

  console.log('\nBusy blocks:', busyBlocks.length);
  for (const b of busyBlocks) {
    console.log(`  ${b.start.toLocaleString()} - ${b.end.toLocaleString()}`);
  }

  // Check 9am slot
  const slotStart = new Date('2025-12-30T09:00:00');
  const slotEnd = new Date('2025-12-30T09:30:00');

  const hasConflict = busyBlocks.some((busy) => {
    const conflict = slotStart < busy.end && slotEnd > busy.start;
    if (conflict) {
      console.log(`  CONFLICT with: ${busy.start.toLocaleString()} - ${busy.end.toLocaleString()}`);
    }
    return conflict;
  });

  console.log(`\n9:00 AM slot on Dec 30: ${hasConflict ? 'BUSY' : 'AVAILABLE'}`);
}

test().catch(console.error);
