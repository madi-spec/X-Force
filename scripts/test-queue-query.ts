import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function testFollowUps() {
  const supabase = createAdminClient();

  // Test follow_ups query
  const { data, error } = await supabase
    .from('command_center_items')
    .select('id, company_name, title, action_type, status, momentum_score')
    .eq('status', 'pending')
    .in('action_type', ['follow_up', 'meeting_follow_up', 'call'])
    .order('momentum_score', { ascending: false })
    .limit(10);

  console.log('Follow-ups query result:');
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Found', data.length, 'items');
    for (const item of data.slice(0, 5)) {
      console.log('- [' + item.action_type + '] ' + (item.company_name || 'Unknown') + ': ' + (item.title || '').substring(0, 50));
    }
  }
  
  // Check all action_types
  console.log('\nAll action_types for pending items:');
  const { data: types } = await supabase
    .from('command_center_items')
    .select('action_type')
    .eq('status', 'pending');
  
  const counts: Record<string, number> = {};
  for (const t of types || []) {
    counts[t.action_type] = (counts[t.action_type] || 0) + 1;
  }
  
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  for (const [type, count] of sorted) {
    console.log('  ' + type + ': ' + count);
  }
}

testFollowUps().catch(console.error);
