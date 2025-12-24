/**
 * Re-analyze communications that have content but bad "empty" summaries
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Finding communications with bad summaries...\n');

  // Find communications that have content but their analysis says "empty/no content"
  const { data: comms, error } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      content_preview,
      full_content,
      current_analysis_id,
      current_analysis:communication_analysis!current_analysis_id(summary)
    `)
    .not('content_preview', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const badSummaries = (comms || []).filter(comm => {
    const summary = (comm.current_analysis as { summary?: string } | null)?.summary || '';
    const hasContent = comm.content_preview && comm.content_preview.length > 50;
    const isBadSummary = /empty|no content|no actual content/i.test(summary);
    return hasContent && isBadSummary;
  });

  console.log(`Found ${badSummaries.length} communications with bad summaries:\n`);

  for (const comm of badSummaries) {
    const summary = (comm.current_analysis as { summary?: string } | null)?.summary || '';
    console.log(`- ${comm.subject?.substring(0, 50)}...`);
    console.log(`  Current summary: "${summary.substring(0, 80)}..."`);
    console.log(`  Content preview: "${comm.content_preview?.substring(0, 80)}..."`);
    console.log('');
  }

  if (badSummaries.length === 0) {
    console.log('No bad summaries found!');
    return;
  }

  console.log('\nRe-analyzing these communications...\n');

  // Reset analysis status to pending so they get re-analyzed
  for (const comm of badSummaries) {
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        analysis_status: 'pending',
        current_analysis_id: null
      })
      .eq('id', comm.id);

    if (updateError) {
      console.error(`  Error resetting ${comm.id}:`, updateError.message);
    } else {
      console.log(`  ✓ Reset ${comm.subject?.substring(0, 40)}... to pending`);
    }
  }

  console.log('\nDone! Run the analysis job to re-analyze these communications.');
  console.log('You can trigger analysis with: npx tsx -e "import { analyzeAllPending } from \'./src/lib/communicationHub/analysis/analyzeCommunication\'; analyzeAllPending();"');
}

main().catch(console.error);
