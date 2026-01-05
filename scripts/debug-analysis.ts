import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get the communication and its analysis
  const { data: comm } = await supabase
    .from('communications')
    .select('*')
    .eq('id', 'eeba9402-69e5-470b-875f-eb5214d816ac')
    .single();

  if (!comm) {
    console.log('Communication not found');
    return;
  }

  console.log('=== COMMUNICATION RECORD ===');
  console.log('id:', comm.id);
  console.log('subject:', comm.subject);
  console.log('channel:', comm.channel);
  console.log('direction:', comm.direction);
  console.log('occurred_at:', comm.occurred_at);
  console.log('source_table:', comm.source_table);
  console.log('source_id:', comm.source_id);
  console.log('');
  console.log('content_preview:', comm.content_preview ? `"${comm.content_preview.substring(0, 150)}..."` : 'NULL');
  console.log('full_content:', comm.full_content ? `"${comm.full_content.substring(0, 150)}..."` : 'NULL');
  console.log('');
  console.log('analysis_status:', comm.analysis_status);
  console.log('current_analysis_id:', comm.current_analysis_id);

  // Get the analysis record
  if (comm.current_analysis_id) {
    const { data: analysis } = await supabase
      .from('communication_analysis')
      .select('*')
      .eq('id', comm.current_analysis_id)
      .single();

    console.log('\n=== ANALYSIS RECORD ===');
    console.log('id:', analysis?.id);
    console.log('created_at:', analysis?.created_at);
    console.log('analysis_version:', analysis?.analysis_version);
    console.log('');
    console.log('summary:', analysis?.summary);
    console.log('');
    console.log('sentiment:', analysis?.sentiment);
    console.log('sentiment_score:', analysis?.sentiment_score);
    console.log('extracted_signals:', JSON.stringify(analysis?.extracted_signals, null, 2));
    console.log('products_discussed:', analysis?.products_discussed);
  }

  // Get the source email to see what data was available
  if (comm.source_id) {
    const { data: email } = await supabase
      .from('email_messages')
      .select('*')
      .eq('id', comm.source_id)
      .single();

    console.log('\n=== SOURCE EMAIL ===');
    console.log('id:', email?.id);
    console.log('subject:', email?.subject);
    console.log('from_email:', email?.from_email);
    console.log('to_emails:', email?.to_emails);
    console.log('');
    console.log('body_preview:', email?.body_preview ? `"${email.body_preview.substring(0, 150)}..."` : 'NULL');
    console.log('body_text:', email?.body_text ? `"${email.body_text.substring(0, 150)}..."` : 'NULL');
    console.log('body_html:', email?.body_html ? `(${email.body_html.length} chars)` : 'NULL');
  }
}

main().catch(console.error);
