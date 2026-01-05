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

  console.log('Testing with user_id:', conn.user_id);

  // Test token refresh
  const { getValidToken } = await import('../src/lib/microsoft/auth');
  const token = await getValidToken(conn.user_id);

  if (token) {
    console.log('Got valid token! Length:', token.length);
    console.log('First 50 chars:', token.substring(0, 50) + '...');

    // Now test getRealAvailableSlots
    console.log('\nTesting getRealAvailableSlots...');
    const { getRealAvailableSlots, formatSlotsForPrompt } = await import('../src/lib/scheduler/calendarIntegration');

    const result = await getRealAvailableSlots(conn.user_id, {
      daysAhead: 15,  // 3 weeks of business days
      slotDuration: 30,
      maxSlots: 4,
      timezone: 'America/New_York',
    });

    if (result.error) {
      console.log('Error:', result.error);
    } else {
      console.log('Found', result.slots.length, 'available slots:');
      for (const slot of result.slots) {
        console.log('  -', slot.formatted);
      }
      console.log('\nFormatted for prompt:');
      console.log(formatSlotsForPrompt(result.slots));
    }
  } else {
    console.log('Failed to get token - may need to reconnect Microsoft');
  }
}

test().catch(console.error);
