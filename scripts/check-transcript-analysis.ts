import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis')
    .not('analysis', 'is', null)
    .limit(3);

  transcripts?.forEach((t, i) => {
    console.log(`\n=== Transcript ${i + 1}: ${t.title} ===\n`);
    const analysis = t.analysis as any;

    console.log('Top-level keys:', Object.keys(analysis || {}));

    if (analysis.actionItems) {
      console.log('\nactionItems:', JSON.stringify(analysis.actionItems, null, 2));
    }

    if (analysis.ourCommitments) {
      console.log('\nourCommitments:', JSON.stringify(analysis.ourCommitments, null, 2));
    }

    if (analysis.action_items) {
      console.log('\naction_items:', JSON.stringify(analysis.action_items, null, 2));
    }
  });
}

main().catch(console.error);
