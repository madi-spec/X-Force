import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find the communication
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, subject, content_preview, full_content, source_table, source_id, current_analysis_id')
    .ilike('subject', '%Frame%Pest%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${comms?.length} communications matching "Frame's Pest"\n`);

  for (const comm of comms || []) {
    console.log('=== Communication ===');
    console.log('  id:', comm.id);
    console.log('  subject:', comm.subject);
    console.log('  content_preview:', comm.content_preview ? comm.content_preview.substring(0, 100) + '...' : 'NULL');
    console.log('  full_content:', comm.full_content ? comm.full_content.substring(0, 100) + '...' : 'NULL');
    console.log('  source_table:', comm.source_table);
    console.log('  source_id:', comm.source_id);
    console.log('  current_analysis_id:', comm.current_analysis_id);

    // Check if there's an analysis
    if (comm.current_analysis_id) {
      const { data: analysis } = await supabase
        .from('communication_analysis')
        .select('summary')
        .eq('id', comm.current_analysis_id)
        .single();
      console.log('  analysis.summary:', analysis?.summary ? analysis.summary.substring(0, 200) : 'NULL');
    }

    // Check the source email
    if (comm.source_id && comm.source_table === 'email_messages') {
      const { data: email } = await supabase
        .from('email_messages')
        .select('body_text, body_preview')
        .eq('id', comm.source_id)
        .single();
      console.log('  source.body_text:', email?.body_text ? email.body_text.substring(0, 100) + '...' : 'NULL');
      console.log('  source.body_preview:', email?.body_preview ? email.body_preview.substring(0, 100) + '...' : 'NULL');
    }
    console.log('');
  }
}

main().catch(console.error);
