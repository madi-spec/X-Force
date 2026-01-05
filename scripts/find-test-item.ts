import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  // Find command center items with email sources that have linked communications
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, conversation_id, status')
    .in('source', ['email_inbound', 'email_sync', 'email_ai_analysis', 'needs_reply'])
    .eq('status', 'pending')
    .limit(5);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Email-based pending items:', items?.length || 0);

  for (const item of items || []) {
    console.log('\n----------------------------------------');
    console.log('Item ID:', item.id);
    console.log('Title:', item.title?.substring(0, 60));
    console.log('Source:', item.source);
    console.log('source_id:', item.source_id);
    console.log('conversation_id:', item.conversation_id);

    // Check if we can find external_id
    if (item.source_id) {
      const { data: comm } = await supabase
        .from('communications')
        .select('external_id')
        .eq('id', item.source_id)
        .single();
      console.log('Has external_id via source_id:', comm?.external_id ? 'YES ✓' : 'NO');
    }
    if (item.conversation_id) {
      const { data: comm } = await supabase
        .from('communications')
        .select('external_id')
        .eq('id', item.conversation_id)
        .single();
      console.log('Has external_id via conversation_id:', comm?.external_id ? 'YES ✓' : 'NO');
    }
  }

  // Also check if any items have source_id at all
  const { data: anyWithSource } = await supabase
    .from('command_center_items')
    .select('id, source, source_id')
    .not('source_id', 'is', null)
    .limit(3);

  console.log('\n\n========================================');
  console.log('Items with non-null source_id:', anyWithSource?.length || 0);
  anyWithSource?.forEach(i => console.log('  -', i.source, i.source_id));
}

find().catch(console.error);
