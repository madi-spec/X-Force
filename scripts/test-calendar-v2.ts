import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  // Get users with auth_id
  const { data: users } = await supabase
    .from('users')
    .select('id, auth_id, email')
    .not('auth_id', 'is', null)
    .limit(5);

  console.log('Users with auth_id:');
  for (const u of users || []) {
    console.log(`  ${u.email} -> auth_id: ${u.auth_id}`);
  }

  // Check Microsoft tokens
  const { data: tokens } = await supabase
    .from('microsoft_tokens')
    .select('user_id, expires_at')
    .limit(5);

  console.log('\nMicrosoft tokens:');
  for (const t of tokens || []) {
    console.log(`  user_id: ${t.user_id}, expires: ${t.expires_at}`);
  }

  // Find a user with both auth_id and a token
  if (users && users.length > 0 && tokens && tokens.length > 0) {
    const tokenUserIds = tokens.map(t => t.user_id);
    const userWithToken = users.find(u => tokenUserIds.includes(u.auth_id));
    
    if (userWithToken) {
      console.log('\nTesting with user who has token:', userWithToken.email);
      
      try {
        const { getRealAvailableSlots, formatSlotsForPrompt } = await import('../src/lib/scheduler/calendarIntegration');
        
        console.log('\nFetching real available slots...');
        const result = await getRealAvailableSlots(userWithToken.auth_id, {
          daysAhead: 5,
          slotDuration: 30,
          maxSlots: 4,
          timezone: 'America/New_York',
        });

        if (result.error) {
          console.log('\nError:', result.error);
        } else {
          console.log('\nFound slots:', result.slots.length);
          if (result.slots.length > 0) {
            console.log('\nFormatted for prompt:');
            console.log(formatSlotsForPrompt(result.slots));
          }
        }
      } catch (err) {
        console.error('Error:', err);
      }
    } else {
      console.log('\nNo user found with both auth_id and Microsoft token');
    }
  }
}

test().catch(console.error);
