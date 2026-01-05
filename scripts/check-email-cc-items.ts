import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const emailId = '6847ca70-c173-4127-b0ce-8a31d650b0f9';

  // Get all CC items related to this email
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, tier_trigger, company_id, company_name, status, source_id, email_id, created_at')
    .or(`email_id.eq.${emailId},source_id.eq.${emailId}`)
    .order('created_at', { ascending: false });

  console.log('=== CC ITEMS FOR EMAIL ===');
  console.log('Found:', ccItems?.length || 0);
  ccItems?.forEach(item => {
    console.log(`\nID: ${item.id}`);
    console.log(`Title: ${item.title}`);
    console.log(`Tier: ${item.tier} | Trigger: ${item.tier_trigger}`);
    console.log(`Company: ${item.company_name}`);
    console.log(`Email ID: ${item.email_id}`);
    console.log(`Source ID: ${item.source_id}`);
    console.log(`Created: ${item.created_at}`);
  });

  // Also check the email itself
  const { data: email } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, processed_for_cc, analysis_complete, conversation_id')
    .eq('id', emailId)
    .single();

  console.log('\n=== EMAIL STATUS ===');
  console.log('From:', email?.from_name, '<' + email?.from_email + '>');
  console.log('Subject:', email?.subject);
  console.log('Processed for CC:', email?.processed_for_cc);
  console.log('Analysis Complete:', email?.analysis_complete);
  console.log('Conversation ID:', email?.conversation_id);

  // Check the new CC item directly
  const { data: newItem } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('id', '55e1b59b-0094-4afc-86e2-2f3cd4cac4a8')
    .single();

  console.log('\n=== NEW CC ITEM (FULL) ===');
  console.log(JSON.stringify(newItem, null, 2));
}
check().catch(console.error);
