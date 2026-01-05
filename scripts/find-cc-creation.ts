import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get items with title starting with "Meeting Follow-ups"
  const { data, error } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, transcription_id, source, action_type, created_at')
    .ilike('title', '%Meeting Follow-ups%')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Items with "Meeting Follow-ups" title:\n');
  for (const item of data || []) {
    console.log('---');
    console.log('ID:', item.id);
    console.log('Title:', item.title);
    console.log('Source:', item.source);
    console.log('action_type:', item.action_type);
    console.log('company_id:', item.company_id);
    console.log('deal_id:', item.deal_id);
    console.log('transcription_id:', item.transcription_id);
    console.log('created_at:', item.created_at);
  }
}

main().catch(console.error);
