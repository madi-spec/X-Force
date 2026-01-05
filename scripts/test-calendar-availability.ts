import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  // Get a user to test with
  const { data: users } = await supabase
    .from('users')
    .select('id, auth_id, email')
    .limit(1);

  if (!users || users.length === 0) {
    console.log('No users found');
    return;
  }

  const user = users[0];
  console.log('Testing with user:', user.email);
  console.log('Auth ID:', user.auth_id);

  // Try to import and call the function
  try {
    const { getRealAvailableSlots, formatSlotsForPrompt } = await import('../src/lib/scheduler/calendarIntegration');
    
    console.log('\nFetching real available slots...');
    const result = await getRealAvailableSlots(user.auth_id, {
      daysAhead: 5,
      slotDuration: 30,
      maxSlots: 4,
      timezone: 'America/New_York',
    });

    console.log('\nResult:', JSON.stringify(result, null, 2));

    if (result.slots.length > 0) {
      console.log('\nFormatted for prompt:');
      console.log(formatSlotsForPrompt(result.slots));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test().catch(console.error);
