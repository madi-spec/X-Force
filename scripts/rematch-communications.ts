/**
 * Re-match all communications with updated domain rules
 *
 * This script:
 * 1. Clears company links from emails assigned to "External Contacts"
 * 2. Re-runs matching for all unlinked emails
 * 3. Uses new internal/excluded domain filters
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  matchEmailToCompany,
  isInternalEmail,
  isExcludedEmail,
  getExternalEmails,
  extractForwardedSender,
  extractEmailsFromBody
} from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function rematch() {
  console.log('=== Re-matching Communications ===\n');

  // Step 1: Find "External Contacts" company
  const { data: externalCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('name', 'External Contacts')
    .single();

  if (externalCompany) {
    console.log('Found "External Contacts" company:', externalCompany.id);

    // Count emails linked to External Contacts
    const { count: externalCount } = await supabase
      .from('communications')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', externalCompany.id);

    console.log(`Emails linked to External Contacts: ${externalCount}`);

    // Clear company_id for these emails
    if (externalCount && externalCount > 0) {
      const { error } = await supabase
        .from('communications')
        .update({ company_id: null, contact_id: null })
        .eq('company_id', externalCompany.id);

      if (error) {
        console.error('Error clearing External Contacts links:', error);
      } else {
        console.log(`Cleared ${externalCount} External Contacts links`);
      }
    }
  }

  // Step 2: Get all unlinked email communications
  const { data: unlinkedEmails, error: fetchError } = await supabase
    .from('communications')
    .select('id, direction, their_participants, our_participants, full_content, content_preview, subject')
    .eq('channel', 'email')
    .is('company_id', null);

  if (fetchError) {
    console.error('Error fetching unlinked emails:', fetchError);
    return;
  }

  console.log(`\nFound ${unlinkedEmails?.length || 0} unlinked emails to re-match\n`);

  let matched = 0;
  let skippedInternal = 0;
  let skippedExcluded = 0;
  let noMatch = 0;

  for (const comm of unlinkedEmails || []) {
    // Collect all emails from participants
    const theirParticipants = (comm.their_participants as Array<{ email?: string }>) || [];
    const ourParticipants = (comm.our_participants as Array<{ email?: string }>) || [];

    const theirEmails = theirParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
    const ourEmails = ourParticipants.map(p => p.email?.toLowerCase()).filter(Boolean) as string[];
    const allEmails = [...theirEmails, ...ourEmails];

    // Check if all participants are internal/excluded
    const allInternal = allEmails.every(e => isInternalEmail(e));
    const allExcluded = allEmails.every(e => isExcludedEmail(e));

    if (allEmails.length > 0 && allInternal) {
      skippedInternal++;
      continue;
    }

    if (allEmails.length > 0 && allExcluded) {
      skippedExcluded++;
      continue;
    }

    // Get external emails only
    const externalEmails = getExternalEmails(allEmails);

    // Check for forwarded email sender
    const content = comm.full_content || comm.content_preview || '';
    const isForwarded = /(?:fwd?:|fw:|\bforwarded\b)/i.test(comm.subject || '');

    if (isForwarded || content.includes('Forwarded message') || content.includes('Original Message')) {
      const forwardedSender = extractForwardedSender(content);
      if (forwardedSender && !externalEmails.includes(forwardedSender)) {
        externalEmails.push(forwardedSender);
      }
    }

    // Extract any email addresses mentioned in the body (for internal forwards, paperwork, etc.)
    const bodyEmails = extractEmailsFromBody(content);
    for (const bodyEmail of bodyEmails) {
      if (!externalEmails.includes(bodyEmail)) {
        externalEmails.push(bodyEmail);
      }
    }

    if (externalEmails.length === 0) {
      noMatch++;
      continue;
    }

    // Try matching each email
    let foundMatch = false;
    for (const email of externalEmails) {
      const match = await matchEmailToCompany(email);
      if (match.company_id) {
        // Update the communication
        const updates: Record<string, string> = { company_id: match.company_id };
        if (match.contact_id) {
          updates.contact_id = match.contact_id;
        }

        await supabase
          .from('communications')
          .update(updates)
          .eq('id', comm.id);

        matched++;
        foundMatch = true;
        console.log(`  Matched: ${(comm.subject || '(no subject)').substring(0, 40)} → ${email}`);
        break;
      }
    }

    if (!foundMatch) {
      noMatch++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`Matched to company: ${matched}`);
  console.log(`Skipped (all internal): ${skippedInternal}`);
  console.log(`Skipped (all excluded/notifications): ${skippedExcluded}`);
  console.log(`No match found (left unlinked): ${noMatch}`);

  // Final count
  const { data: finalCounts } = await supabase
    .from('communications')
    .select('company_id')
    .eq('channel', 'email');

  const linkedCount = finalCounts?.filter(c => c.company_id).length || 0;
  const unlinkedCount = finalCounts?.filter(c => !c.company_id).length || 0;

  console.log(`\nFinal state: ${linkedCount} linked, ${unlinkedCount} unlinked`);
}

rematch().catch(console.error);
