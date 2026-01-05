import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  const ccItemId = '55e1b59b-0094-4afc-86e2-2f3cd4cac4a8';
  const emailId = '6847ca70-c173-4127-b0ce-8a31d650b0f9';

  console.log('=== FIXING CC ITEM ===\n');

  // Get email info
  const { data: email } = await supabase
    .from('email_messages')
    .select('id, received_at')
    .eq('id', emailId)
    .single();

  console.log('Email:', email?.id, 'received:', email?.received_at);

  // Update CC item with email context
  const { data: updated, error } = await supabase
    .from('command_center_items')
    .update({
      email_id: emailId,
      source_id: emailId,
      tier: 5,
      tier_trigger: 'new_introduction',
      sla_minutes: 1440,
      sla_status: 'on_track',
      received_at: email?.received_at,
      source: 'email_inbound',
    })
    .eq('id', ccItemId)
    .select('id, title, tier, tier_trigger, email_id, source_id, company_name')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('\n=== UPDATED CC ITEM ===');
    console.log('Title:', updated?.title);
    console.log('Tier:', updated?.tier, '- Trigger:', updated?.tier_trigger);
    console.log('Company:', updated?.company_name);
    console.log('Email ID:', updated?.email_id);
    console.log('Source ID:', updated?.source_id);
  }

  // Also mark the email analysis as complete
  await supabase
    .from('email_messages')
    .update({ analysis_complete: true })
    .eq('id', emailId);

  console.log('\nMarked email analysis_complete = true');
}
fix().catch(console.error);
