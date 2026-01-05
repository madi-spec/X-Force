import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import the processing function
import { processInboundEmail } from '../src/lib/email/processInboundEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reprocessEmail() {
  const emailId = '6847ca70-c173-4127-b0ce-8a31d650b0f9'; // Raymond Kidwell email

  console.log('=== REPROCESSING EMAIL ===\n');

  // 1. Get the email details
  const { data: email } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, user_id')
    .eq('id', emailId)
    .single();

  console.log('Email:', email?.from_name, '<' + email?.from_email + '>');
  console.log('Subject:', email?.subject);

  // 2. Reset the processing flags so it can be reprocessed
  console.log('\nResetting processing flags...');
  await supabase
    .from('email_messages')
    .update({
      processed_for_cc: false,
      analysis_complete: false,
    })
    .eq('id', emailId);

  // 3. Delete the existing triage CC item
  console.log('Deleting existing triage item...');
  const { data: deleted } = await supabase
    .from('command_center_items')
    .delete()
    .eq('id', '03d628e1-e6cc-4931-9df1-987100a8b845')
    .select('id, title');

  console.log('Deleted:', deleted);

  // 4. Reprocess the email
  console.log('\nReprocessing email through pipeline...');
  try {
    const result = await processInboundEmail(emailId);
    console.log('\n=== RESULT ===');
    console.log('Success:', result.success);
    console.log('CC Item ID:', result.commandCenterItemId || 'none');
    console.log('Already Replied:', result.alreadyReplied);
    if (result.error) {
      console.log('Error:', result.error);
    }
    if (result.analysis) {
      console.log('\nAnalysis:');
      console.log('- Request type:', result.analysis.email_analysis?.request_type);
      console.log('- Urgency:', result.analysis.email_analysis?.urgency);
      console.log('- CC Classification:', JSON.stringify(result.analysis.command_center_classification, null, 2));
    }
  } catch (error) {
    console.error('Processing error:', error);
  }

  // 5. Check what CC items exist now
  console.log('\n=== CC ITEMS FOR THIS EMAIL ===');
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, tier_trigger, company_id, company_name, status')
    .or(`email_id.eq.${emailId},source_id.eq.${emailId}`)
    .order('created_at', { ascending: false });

  ccItems?.forEach(item => {
    console.log(`[T${item.tier}] ${item.title}`);
    console.log(`  Trigger: ${item.tier_trigger}`);
    console.log(`  Company: ${item.company_name || 'NONE'} (${item.company_id || 'no id'})`);
    console.log(`  Status: ${item.status}`);
  });
}

reprocessEmail().catch(console.error);
