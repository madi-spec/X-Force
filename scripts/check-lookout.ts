import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function check() {
  const supabase = createAdminClient();
  const companyId = 'cf829e83-ecd6-4f11-ba36-a3bdb876c6be'; // Lookout Pest

  console.log('Checking transcript data for Lookout Pest...\n');

  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, summary, analysis')
    .eq('company_id', companyId);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Transcripts found:', data?.length);

  if (data && data[0]) {
    const t = data[0];
    console.log('\nTranscript Details:');
    console.log('  ID:', t.id);
    console.log('  Title:', t.title);
    console.log('  Date:', t.meeting_date);
    console.log('  Has summary:', !!t.summary);
    console.log('  Summary preview:', t.summary?.substring(0, 150) || '(none)');
    console.log('  Has analysis:', !!t.analysis);

    if (t.analysis) {
      const a = t.analysis as any;
      console.log('\nAnalysis contents:');
      console.log('  summary:', a.summary?.substring(0, 100) || '(none)');
      console.log('  key_points:', a.key_points?.length || 0);
      console.log('  action_items:', a.action_items?.length || 0);
      if (a.action_items?.length > 0) {
        console.log('  First action item:', a.action_items[0]);
      }
    }
  }
}

check().catch(console.error);
