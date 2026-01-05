/**
 * Run inbox sync for testing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { performInitialSync } from '../src/lib/inbox/inboxService';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sync() {
  console.log('=== Running Inbox Sync ===\n');

  // Find user with Microsoft integration
  const { data: users } = await supabase
    .from('user_integrations')
    .select('user_id')
    .eq('provider', 'microsoft')
    .not('access_token', 'is', null)
    .limit(1);

  if (!users || users.length === 0) {
    console.log('No users with Microsoft integration found');
    return;
  }

  const userId = users[0].user_id;
  console.log('Syncing for user:', userId);

  try {
    const result = await performInitialSync(userId, { maxMessagesPerFolder: 30 });
    console.log('\nSync Result:');
    console.log('  Messages:', result.messages);
    console.log('  Conversations:', result.conversations);
    console.log('  Linked:', result.linked);
    console.log('  Folders:', result.folders);
    if (result.errors.length > 0) {
      console.log('  Errors:', result.errors.slice(0, 5));
    }
  } catch (err) {
    console.error('Sync error:', err);
  }
}

sync().catch(console.error);
