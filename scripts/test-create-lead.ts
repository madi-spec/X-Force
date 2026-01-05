/**
 * Test the create-lead API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  extractEmailsFromBody,
  getExternalEmails
} from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCreateLead() {
  console.log('=== Test Create Lead from Communication ===\n');

  // Find an unlinked communication with external emails
  const { data: unlinkedComms } = await supabase
    .from('communications')
    .select('id, subject, their_participants, our_participants, full_content, content_preview')
    .eq('channel', 'email')
    .is('company_id', null)
    .limit(10);

  if (!unlinkedComms || unlinkedComms.length === 0) {
    console.log('No unlinked communications found.');
    return;
  }

  console.log(`Found ${unlinkedComms.length} unlinked communications\n`);

  // Process each to find external emails
  for (const comm of unlinkedComms) {
    const theirParticipants = (comm.their_participants as Array<{ email?: string; name?: string }>) || [];
    const ourParticipants = (comm.our_participants as Array<{ email?: string; name?: string }>) || [];

    const theirEmails = theirParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
    const ourEmails = ourParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];

    const externalParticipantEmails = getExternalEmails([...theirEmails, ...ourEmails]);

    const content = comm.full_content || comm.content_preview || '';
    const bodyEmails = extractEmailsFromBody(content);

    const allExternalEmails = [...new Set([...externalParticipantEmails, ...bodyEmails])];

    console.log(`Communication: ${(comm.subject || '(no subject)').substring(0, 50)}`);
    console.log(`  ID: ${comm.id}`);
    console.log(`  Participant emails: ${externalParticipantEmails.join(', ') || 'none'}`);
    console.log(`  Body emails: ${bodyEmails.join(', ') || 'none'}`);
    console.log(`  All external emails: ${allExternalEmails.join(', ') || 'none'}`);

    if (allExternalEmails.length > 0) {
      console.log(`\n  ** This communication can create leads for:`);
      allExternalEmails.forEach(email => {
        const domain = email.split('@')[1];
        const companyName = domain
          .replace(/\.(com|net|org|io|co|us|biz|info)$/i, '')
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        console.log(`     - ${email} → Company: "${companyName}"`);
      });
    }

    console.log('');
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log('To create a lead from a communication, POST to:');
  console.log('  /api/communications/{id}/create-lead');
  console.log('With body: { email: "...", companyName: "..." }');
  console.log('\nOr GET the same endpoint to see available email options.');
}

testCreateLead().catch(console.error);
