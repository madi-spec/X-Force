/**
 * Sync inbox using inboxService
 * Run: npx tsx scripts/sync-inbox.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import { performInitialSync } from '../src/lib/inbox/inboxService';

const userId = '11111111-1111-1111-1111-111111111009';

async function sync() {
  console.log('Syncing inbox for user:', userId);
  console.log('');

  try {
    const result = await performInitialSync(userId);

    console.log('Sync complete!');
    console.log('  Conversations:', result.conversations);
    console.log('  Messages:', result.messages);
    console.log('  Linked:', result.linked);
    if (result.errors.length > 0) {
      console.log('  Errors:', result.errors.slice(0, 5));
    }

    // Check what we got
    const supabase = createAdminClient();
    const { data: stats } = await supabase
      .from('email_messages')
      .select('is_sent_by_user')
      .eq('user_id', userId);

    const sent = stats?.filter(e => e.is_sent_by_user).length || 0;
    const received = stats?.filter(e => !e.is_sent_by_user).length || 0;

    console.log('');
    console.log('Email counts:');
    console.log('  Sent by user:', sent);
    console.log('  Received:', received);

  } catch (err) {
    console.error('Error:', err);
  }
}

sync();
