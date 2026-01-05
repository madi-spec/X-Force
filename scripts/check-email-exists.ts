import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const emailId = '6847ca70-c173-4127-b0ce-8a31d650b0f9';

  // Check email
  const { data: email, error } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, processed_for_cc, analysis_complete')
    .eq('id', emailId)
    .single();

  console.log('=== EMAIL CHECK ===');
  if (error) {
    console.log('Error:', error.message);
  } else if (email) {
    console.log('From:', email.from_name, '<' + email.from_email + '>');
    console.log('Subject:', email.subject);
    console.log('Processed for CC:', email.processed_for_cc);
    console.log('Analysis Complete:', email.analysis_complete);
  } else {
    console.log('Email not found');
  }

  // Search for emails from Raymond
  console.log('\n=== SEARCH FOR RAYMOND EMAILS ===');
  const { data: raymondEmails } = await supabase
    .from('email_messages')
    .select('id, from_email, from_name, subject, created_at')
    .ilike('from_email', '%kidwell%')
    .order('created_at', { ascending: false })
    .limit(5);

  raymondEmails?.forEach(e => {
    console.log(`${e.id}: ${e.from_name} - ${e.subject}`);
  });
}
check().catch(console.error);
