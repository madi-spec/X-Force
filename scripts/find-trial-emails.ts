/**
 * Find trial-related emails for testing
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function findEmails() {
  const supabase = createAdminClient();

  // Look for trial-related emails
  const { data, error } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, from_name, body_text, received_at')
    .or('subject.ilike.%trial%,subject.ilike.%authorization%,from_email.ilike.%lawndoctor%')
    .order('received_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Found', data?.length || 0, 'potential trial emails:');
  data?.forEach((e, i) => {
    console.log(`\n[${i+1}] ${e.id}`);
    console.log(`    Subject: ${e.subject}`);
    console.log(`    From: ${e.from_name} <${e.from_email}>`);
    console.log(`    Date: ${e.received_at}`);
    console.log(`    Preview: ${e.body_text?.substring(0, 150)}...`);
  });
}

findEmails().catch(console.error);
