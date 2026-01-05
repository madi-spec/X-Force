import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check the most recent emails in the database
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, from_address, received_at')
    .order('received_at', { ascending: false })
    .limit(5);

  console.log('Most recent emails in database:');
  emails?.forEach(e => {
    console.log('  -', e.received_at, '|', e.subject?.substring(0, 50));
  });

  // Check today's date
  const today = new Date().toISOString().split('T')[0];
  console.log('\nToday:', today);

  // Count emails from today
  const { count } = await supabase
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .gte('received_at', today);

  console.log('Emails from today:', count);
}
check().catch(console.error);
