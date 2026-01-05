/**
 * Check all communications with group682@lawndoctor.com
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // First find the company
  console.log('=== Searching for Lawn Doctor company ===');
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%lawn doctor%');

  console.log('Companies found:', companies);

  if (!companies || companies.length === 0) {
    console.log('No Lawn Doctor company found');
  }

  // Search for communications with lawn doctor in subject
  console.log('\n=== Communications with Lawn Doctor in subject ===');
  const { data: comms } = await supabase
    .from('communications')
    .select('*')
    .ilike('subject', '%lawn doctor%')
    .order('occurred_at', { ascending: false })
    .limit(30);

  console.log('Found:', comms?.length || 0);

  if (comms && comms.length > 0) {
    console.log('\nSchema columns:', Object.keys(comms[0]).join(', '));

    for (const c of comms) {
      console.log('\n--------------------------------------------------------------------------------');
      console.log('ID:', c.id);
      console.log('Date:', c.occurred_at);
      console.log('Direction:', c.direction);
      console.log('Channel:', c.channel);
      console.log('Subject:', c.subject);
      console.log('Company ID:', c.company_id);
      console.log('Thread ID:', c.thread_id);
      console.log('Source:', c.source_table);
      console.log('Awaiting Response:', c.awaiting_our_response);
    }
  }

  // If we found companies, get their communications
  for (const company of (companies || [])) {
    console.log('\n\n=== Communications for', company.name, '===');
    const { data: companyComms, count } = await supabase
      .from('communications')
      .select('*', { count: 'exact' })
      .eq('company_id', company.id)
      .order('occurred_at', { ascending: false })
      .limit(20);

    console.log('Total count:', count);

    if (companyComms) {
      for (const c of companyComms) {
        console.log('\n--------------------------------------------------------------------------------');
        console.log('ID:', c.id);
        console.log('Date:', c.occurred_at);
        console.log('Direction:', c.direction);
        console.log('Channel:', c.channel);
        console.log('Subject:', c.subject);
        console.log('External ID:', c.external_id);
        console.log('Source:', c.source_table);
        console.log('Awaiting Response:', c.awaiting_our_response);
      }
    }
  }

  // Check scheduling_requests with lawn doctor
  console.log('\n\n=== Scheduling Requests ===');
  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (requests) {
    for (const r of requests) {
      const history = r.conversation_history || [];
      const hasLawnDoctor = JSON.stringify(history).toLowerCase().includes('lawndoctor') ||
        JSON.stringify(r).toLowerCase().includes('lawndoctor');

      if (hasLawnDoctor) {
        console.log('\n--------------------------------------------------------------------------------');
        console.log('Request ID:', r.id);
        console.log('Status:', r.status);
        console.log('Attempts:', r.attempt_count);
        console.log('Company ID:', r.company_id);
        console.log('Created:', r.created_at);
        console.log('Conversation History:');
        for (const msg of history) {
          console.log('  [' + msg.direction + '] ' + msg.timestamp);
          console.log('    Subject:', msg.subject);
          console.log('    Body preview:', msg.body?.substring(0, 200));
        }
      }
    }
  }

  // Check sent_email_items
  console.log('\n\n=== Sent Email Items ===');
  const { data: sentEmails } = await supabase
    .from('sent_email_items')
    .select('*')
    .or('subject.ilike.%lawn doctor%,to_recipients.cs.{group682@lawndoctor.com}')
    .order('sent_at', { ascending: false })
    .limit(20);

  console.log('Sent emails found:', sentEmails?.length || 0);
  if (sentEmails) {
    for (const e of sentEmails) {
      console.log('\n--------------------------------------------------------------------------------');
      console.log('ID:', e.id);
      console.log('Sent:', e.sent_at);
      console.log('Subject:', e.subject);
      console.log('To:', e.to_recipients);
      console.log('Body preview:', e.body_preview || e.body?.substring(0, 200));
    }
  }

  // Check inbox_items
  console.log('\n\n=== Inbox Items ===');
  const { data: inboxItems } = await supabase
    .from('inbox_items')
    .select('*')
    .or('subject.ilike.%lawn doctor%,sender_email.ilike.%lawndoctor%')
    .order('received_at', { ascending: false })
    .limit(20);

  console.log('Inbox items found:', inboxItems?.length || 0);
  if (inboxItems) {
    for (const e of inboxItems) {
      console.log('\n--------------------------------------------------------------------------------');
      console.log('ID:', e.id);
      console.log('Received:', e.received_at);
      console.log('Subject:', e.subject);
      console.log('From:', e.sender_email);
      console.log('Body preview:', e.body_preview);
    }
  }
}

run().catch(console.error);
