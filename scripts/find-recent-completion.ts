import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  console.log('=== Finding Most Recently Completed Items ===\n');

  // Get ALL completed items, sorted by updated_at
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, updated_at, company_name, target_name, description')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('Most recently completed items:');
  items?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 70)}`);
    console.log('   Company:', i.company_name);
    console.log('   Target:', i.target_name);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   updated_at:', i.updated_at);
    if (i.description) {
      console.log('   Description:', i.description?.substring(0, 100));
    }
  });

  // Also check for Alyssa or David in any items
  console.log('\n\n=== Items mentioning Alyssa or David ===\n');
  const { data: alyssaItems } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, target_name, company_name')
    .or('target_name.ilike.%alyssa%,target_name.ilike.%david%,title.ilike.%alyssa%,title.ilike.%david%')
    .limit(10);

  console.log('Found:', alyssaItems?.length || 0);
  alyssaItems?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 60)}`);
    console.log('   Target:', i.target_name);
    console.log('   Company:', i.company_name);
    console.log('   Status:', i.status);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
  });

  // Search for "Accel" in company names
  console.log('\n\n=== Items for Accel companies ===\n');
  const { data: accelItems } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, company_name')
    .ilike('company_name', '%accel%')
    .limit(10);

  console.log('Found:', accelItems?.length || 0);
  accelItems?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 60)}`);
    console.log('   Company:', i.company_name);
    console.log('   Status:', i.status);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
  });
}

find().catch(console.error);
