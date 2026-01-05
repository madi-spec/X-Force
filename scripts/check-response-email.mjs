import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

// Check recent emails from the prospect
const { data: emails, error } = await supabase
  .from('email_messages')
  .select('id, subject, from_email, received_at, body_preview')
  .ilike('from_email', '%theangryocto%')
  .order('received_at', { ascending: false })
  .limit(5);

if (error) {
  console.log('Error:', error);
  process.exit(1);
}

if (!emails || emails.length === 0) {
  console.log('No emails found from theangryocto - the reply may not have synced yet');
  console.log('\nMost recent emails:');

  const { data: recent } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, received_at')
    .order('received_at', { ascending: false })
    .limit(10);

  if (recent) {
    for (const e of recent) {
      console.log('- ' + e.subject);
      console.log('  From: ' + e.from_email + ' at ' + e.received_at);
    }
  }
} else {
  console.log('Emails from theangryocto:');
  for (const e of emails) {
    console.log('- ' + e.subject);
    console.log('  ID: ' + e.id);
    console.log('  From: ' + e.from_email);
    console.log('  At: ' + e.received_at);
    const preview = e.body_preview ? e.body_preview.substring(0, 100) : '';
    console.log('  Preview: ' + preview);
    console.log();
  }
}
