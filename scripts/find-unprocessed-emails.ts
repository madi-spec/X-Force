/**
 * Find unprocessed inbound emails for testing
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nezewucpbkuzoukomnlv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findUnprocessedEmail() {
  // Get inbound emails that haven't been analyzed
  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, received_at, analysis_complete, processed_for_cc')
    .eq('is_sent_by_user', false)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .order('received_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Unprocessed inbound emails:');
  for (const e of emails || []) {
    console.log(`\n  ID: ${e.id}`);
    console.log(`  From: ${e.from_name} <${e.from_email}>`);
    console.log(`  Subject: ${e.subject}`);
    console.log(`  Received: ${e.received_at}`);
    console.log(`  Analysis Complete: ${e.analysis_complete}`);
  }
}

findUnprocessedEmail().catch(console.error);
