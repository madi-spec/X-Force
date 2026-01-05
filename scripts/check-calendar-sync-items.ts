import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check CC items created around the same time as transcript processing
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, title, source, transcription_id, created_at')
    .eq('source', 'calendar_sync')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('CC items with source=calendar_sync:');
  for (const i of (items || [])) {
    console.log('- ' + i.created_at);
    console.log('  transcription_id: ' + (i.transcription_id || 'null'));
    console.log('  title: ' + i.title?.substring(0, 60));
  }

  // Also check for any errors in processing
  const { data: unprocessed } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, cc_items_created, analysis')
    .eq('cc_items_created', false)
    .not('analysis', 'is', null)
    .limit(3);

  console.log('\n\nUnprocessed transcripts with analysis:');
  for (const t of (unprocessed || [])) {
    const a = t.analysis as any;
    console.log('- ' + t.title);
    console.log('  Commitments: ' + (a?.ourCommitments?.length || 0));
    console.log('  Buying signals: ' + (a?.buyingSignals?.length || 0));
  }
}

main().catch(console.error);
