import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('=== Checking Very Recent Activity ===\n');
  console.log('Current time:', new Date().toISOString());

  // Get items updated in the last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  console.log('Looking for items updated after:', fiveMinAgo);

  const { data: recentItems } = await supabase
    .from('command_center_items')
    .select('id, title, status, source, source_id, email_id, updated_at')
    .gte('updated_at', fiveMinAgo)
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('\nItems updated in last 5 minutes:', recentItems?.length || 0);
  recentItems?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 60)}`);
    console.log('   Status:', i.status);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   updated_at:', i.updated_at);
  });

  // Also check activities table for recent entries
  console.log('\n\n=== Recent Activities ===\n');
  const { data: activities } = await supabase
    .from('activities')
    .select('id, activity_type, subject_type, created_at')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Activities in last 5 minutes:', activities?.length || 0);
  activities?.forEach((a, idx) => {
    console.log(`${idx + 1}. ${a.activity_type} - ${a.subject_type} (${a.created_at})`);
  });

  // Check server logs would show the API call
  console.log('\n\nIf you just marked something as done, check the server console logs for:');
  console.log('- [CommandCenter/Item] No external_id found for email tagging');
  console.log('- Or any errors from the PATCH endpoint');
}

check().catch(console.error);
