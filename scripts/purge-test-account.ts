/**
 * Purge test account data
 * Run: npx tsx scripts/purge-test-account.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nezewucpbkuzoukomnlv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function purgeTestAccount() {
  console.log('Looking for test account data...\n');

  // Find user by checking microsoft connections
  const { data: connections } = await supabase
    .from('microsoft_connections')
    .select('user_id, is_active')
    .eq('is_active', true);

  console.log('Active Microsoft connections:', connections?.length || 0);

  if (!connections || connections.length === 0) {
    console.log('No active connections found');
    return;
  }

  // For each user with a connection, show their data
  for (const conn of connections) {
    const userId = conn.user_id;
    console.log(`\nUser: ${userId}`);

    // Count emails
    const { count: emailCount } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count conversations
    const { count: convCount } = await supabase
      .from('email_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count calendar events
    const { count: calCount } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count CC items from email
    const { count: ccCount } = await supabase
      .from('command_center_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    console.log(`  Email messages: ${emailCount || 0}`);
    console.log(`  Email conversations: ${convCount || 0}`);
    console.log(`  Calendar events: ${calCount || 0}`);
    console.log(`  Command center items: ${ccCount || 0}`);

    // Delete all
    console.log('\n  Deleting...');

    // Delete CC items first (they reference emails)
    await supabase.from('command_center_items').delete().eq('user_id', userId);
    console.log('  ✓ Command center items deleted');

    // Delete email messages
    await supabase.from('email_messages').delete().eq('user_id', userId);
    console.log('  ✓ Email messages deleted');

    // Delete email conversations
    await supabase.from('email_conversations').delete().eq('user_id', userId);
    console.log('  ✓ Email conversations deleted');

    // Delete calendar events
    await supabase.from('calendar_events').delete().eq('user_id', userId);
    console.log('  ✓ Calendar events deleted');
  }

  console.log('\n🧹 Purge complete!');
}

purgeTestAccount().catch(console.error);
