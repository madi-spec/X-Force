import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== 1. Recent CC items with transcript/follow-up source ===');
  const { data: ccItems, error: ccError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, source_type, source_id')
    .or('source_type.eq.transcript,source_type.eq.meeting_followup,title.ilike.%follow%')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (ccError) console.error('CC Error:', ccError);
  console.log(ccItems);

  console.log('\n=== 2. Recent transcripts with company/deal ===');
  const { data: transcripts, error: tError } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, deal_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (tError) console.error('Transcript Error:', tError);
  console.log(transcripts);

  console.log('\n=== 3. CC items with NULL company_id that have transcript source ===');
  const { data: nullItems, error: nullError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, source_type, source_id')
    .is('company_id', null)
    .in('source_type', ['transcript', 'meeting_followup', 'meeting_prep'])
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (nullError) console.error('Null items error:', nullError);
  console.log(nullItems);
}

main().catch(console.error);
