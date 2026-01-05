import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { MicrosoftGraphClient } from '../src/lib/microsoft/graph';
import { getValidToken } from '../src/lib/microsoft/auth';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('=== Raw Inbox Check ===\n');

  const { data: connections } = await supabase
    .from('microsoft_connections')
    .select('user_id, email')
    .eq('is_active', true);

  if (!connections?.length) {
    console.log('No active connections');
    return;
  }

  const conn = connections[0];
  const token = await getValidToken(conn.user_id);
  if (!token) {
    console.log('No valid token');
    return;
  }

  const client = new MicrosoftGraphClient(token);

  // Get recent inbox messages
  const messages = await client.getMessages('inbox', {
    top: 20,
    select: ['id', 'subject', 'from', 'receivedDateTime'],
    orderby: 'receivedDateTime desc',
  });

  console.log(`Found ${messages.value.length} inbox messages:\n`);

  messages.value.forEach((msg, i) => {
    const from = msg.from?.emailAddress?.address || 'unknown';
    const date = new Date(msg.receivedDateTime).toLocaleString();
    console.log(`${i + 1}. [${date}] From: ${from}`);
    console.log(`   Subject: ${msg.subject}`);
    console.log('');
  });

  // Check what contacts exist
  const { data: contacts } = await supabase
    .from('contacts')
    .select('email')
    .not('email', 'is', null);

  console.log(`\n=== ${contacts?.length || 0} contacts with emails in system ===`);
  console.log('Sample contacts:', contacts?.slice(0, 10).map(c => c.email).join(', '));
}

check().catch(console.error);
