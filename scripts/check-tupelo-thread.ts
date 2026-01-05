/**
 * Check the rapid email exchange with Lawn Doctor Tupelo
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Get the rapid exchange emails with full content
  const ids = [
    '2e87f1fb-a464-43ce-b3a4-d801d401e23f',
    '8abee5fc-9431-4a24-907e-b5520ef76e36',
    '9aaa551c-82c6-4ee6-8c1a-50c2c7925aaf',
    '30b14ca2-8a62-46db-b691-b1602387de88',
    'a028a9b7-73cb-4334-bd86-070599125cf5',
    '23f147ea-5222-4b93-bea6-147a076304fb'
  ];

  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, direction, occurred_at, subject, full_content, content_preview, their_participants, our_participants')
    .in('id', ids)
    .order('occurred_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== Email Thread Timeline ===');
  for (const c of comms || []) {
    console.log('\n' + '='.repeat(80));
    console.log('Time:', c.occurred_at);
    console.log('Direction:', c.direction.toUpperCase());
    console.log('Subject:', c.subject);
    console.log('Their Participants:', JSON.stringify(c.their_participants));
    console.log('Our Participants:', JSON.stringify(c.our_participants));
    console.log('\nContent:');
    const content = c.full_content || c.content_preview || '(no content)';
    console.log(content.substring(0, 2000));
    console.log('...');
  }

  // Also check inbox_items for the same emails
  console.log('\n\n=== Inbox Items with group682@lawndoctor.com ===');
  const { data: inboxItems } = await supabase
    .from('inbox_items')
    .select('*')
    .ilike('sender_email', '%lawndoctor%')
    .order('received_at', { ascending: false })
    .limit(10);

  for (const item of inboxItems || []) {
    console.log('\n' + '='.repeat(80));
    console.log('Received:', item.received_at);
    console.log('From:', item.sender_email);
    console.log('Subject:', item.subject);
    console.log('Body preview:', item.body_preview);
  }

  // Check sent_email_items
  console.log('\n\n=== Sent Emails to lawndoctor ===');
  const { data: sentItems } = await supabase
    .from('sent_email_items')
    .select('*')
    .contains('to_recipients', ['group682@lawndoctor.com'])
    .order('sent_at', { ascending: false })
    .limit(10);

  for (const item of sentItems || []) {
    console.log('\n' + '='.repeat(80));
    console.log('Sent:', item.sent_at);
    console.log('To:', item.to_recipients);
    console.log('Subject:', item.subject);
    console.log('Body preview:', item.body_preview);
    console.log('Full body:', item.body?.substring(0, 1500));
  }
}

run().catch(console.error);
