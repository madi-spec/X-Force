import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';
import { processInboundEmail } from '../src/lib/email/processInboundEmail';

async function main() {
  console.log('Starting test...');
  const supabase = createAdminClient();
  const emailId = '6847ca70-c173-4127-b0ce-8a31d650b0f9'; // on the fly receptionist email

  // First check if email exists
  const { data: email, error } = await supabase
    .from('email_messages')
    .select('id, from_email, subject, is_sent_by_user, analysis_complete')
    .eq('id', emailId)
    .single();

  console.log('Email found:', email ? 'yes' : 'no');
  if (error) console.log('Query error:', error.message);
  if (email) {
    console.log('From:', email.from_email);
    console.log('Subject:', email.subject);
    console.log('is_sent_by_user:', email.is_sent_by_user);
    console.log('analysis_complete:', email.analysis_complete);

    // Now try to process it
    console.log('\nProcessing email...');
    try {
      const result = await processInboundEmail(emailId);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Processing error:', err);
    }
  }
}

main().catch(console.error);
