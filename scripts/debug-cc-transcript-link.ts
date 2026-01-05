import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== CC Items with transcription_id but null company_id ===');
  const { data: orphanedItems, error: orphanedError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, transcription_id, source, action_type')
    .not('transcription_id', 'is', null)
    .is('company_id', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (orphanedError) console.error('Orphaned Error:', orphanedError);
  console.log('Orphaned items:', orphanedItems);

  console.log('\n=== CC Items with source containing meeting/transcript ===');
  const { data: meetingItems, error: meetingError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, transcription_id, source, action_type')
    .or('source.ilike.%meeting%,source.ilike.%transcript%,action_type.ilike.%follow%')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (meetingError) console.error('Meeting Error:', meetingError);
  console.log('Meeting items:', meetingItems);

  console.log('\n=== Check if transcripts have company/deal that CC items dont ===');
  const { data: mismatch } = await supabase
    .from('command_center_items')
    .select(`
      id, 
      title, 
      company_id, 
      deal_id, 
      transcription_id
    `)
    .not('transcription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (mismatch) {
    for (const item of mismatch) {
      const { data: transcript } = await supabase
        .from('meeting_transcriptions')
        .select('id, title, company_id, deal_id')
        .eq('id', item.transcription_id)
        .single();
      
      console.log({
        cc_item_id: item.id,
        cc_company_id: item.company_id,
        cc_deal_id: item.deal_id,
        transcript_company_id: transcript?.company_id,
        transcript_deal_id: transcript?.deal_id,
        mismatch: item.company_id !== transcript?.company_id || item.deal_id !== transcript?.deal_id
      });
    }
  }
}

main().catch(console.error);
