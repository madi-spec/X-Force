/**
 * Test the create-lead API with an email_message ID
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { extractEmailsFromBody, getExternalEmails } from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log('=== Test Create Lead API ===\n');

  // Find an unlinked email_message with external emails in body
  const { data: messages } = await supabase
    .from('email_messages')
    .select(`
      id,
      subject,
      from_email,
      to_emails,
      body_text,
      body_preview,
      conversation_ref,
      email_conversations!inner(company_id)
    `)
    .is('email_conversations.company_id', null)
    .not('body_text', 'is', null)
    .limit(20);

  console.log(`Found ${messages?.length || 0} unlinked messages with body_text\n`);

  // Find one with external emails in the body
  for (const msg of messages || []) {
    const bodyEmails = extractEmailsFromBody(msg.body_text || '');

    if (bodyEmails.length > 0) {
      console.log('Found message with body emails:');
      console.log('  ID:', msg.id);
      console.log('  Subject:', msg.subject?.substring(0, 50));
      console.log('  Body emails:', bodyEmails.join(', '));
      console.log('');
      console.log('To create a lead, the UI would call:');
      console.log(`  GET /api/communications/${msg.id}/create-lead`);
      console.log(`  POST /api/communications/${msg.id}/create-lead`);
      console.log('');

      // Test the lookup logic
      console.log('Testing API lookup...');

      // Try to find as communication first
      const { data: comm } = await supabase
        .from('communications')
        .select('id')
        .eq('id', msg.id)
        .single();

      if (comm) {
        console.log('  Found as communication ID');
      } else {
        // Try as email_messages source
        const { data: commBySource } = await supabase
          .from('communications')
          .select('id')
          .eq('source_table', 'email_messages')
          .eq('source_id', msg.id)
          .single();

        if (commBySource) {
          console.log('  Found via source_id in communications');
        } else {
          console.log('  Will use email_message directly');
        }
      }

      break;
    }
  }
}

test().catch(console.error);
