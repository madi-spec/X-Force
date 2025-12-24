/**
 * Match Emails to Companies
 *
 * Finds all unlinked email communications and tries to match them
 * to companies based on sender email.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MatchResult {
  company_id: string | null;
  contact_id: string | null;
  matched_by: string | null;
}

async function matchEmailToCompany(email: string): Promise<MatchResult> {
  if (!email) return { company_id: null, contact_id: null, matched_by: null };

  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];

  // Strategy 1: Direct contact email match
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id, email')
    .ilike('email', emailLower)
    .single();

  if (contact?.company_id) {
    return { company_id: contact.company_id, contact_id: contact.id, matched_by: 'contact_email' };
  }

  // Strategy 2: Match company domain
  if (domain) {
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
      .single();

    if (company) {
      return { company_id: company.id, contact_id: contact?.id || null, matched_by: 'company_domain' };
    }
  }

  // Strategy 3: Match contact with same domain
  if (domain) {
    const { data: domainContact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .ilike('email', `%@${domain}`)
      .not('company_id', 'is', null)
      .limit(1)
      .single();

    if (domainContact?.company_id) {
      return { company_id: domainContact.company_id, contact_id: null, matched_by: 'contact_domain' };
    }
  }

  return { company_id: null, contact_id: null, matched_by: null };
}

async function main() {
  console.log('Finding unlinked communications...\n');

  // Get all communications without company_id
  const { data: unlinked, error } = await supabase
    .from('communications')
    .select('id, their_participants, subject')
    .is('company_id', null)
    .eq('channel', 'email');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${unlinked?.length || 0} unlinked email communications\n`);

  let matched = 0;
  let notMatched = 0;
  const notMatchedEmails: string[] = [];
  const matchStats: Record<string, number> = {};

  for (const comm of unlinked || []) {
    const participants = (comm.their_participants as Array<{ email?: string }>) || [];
    const email = participants[0]?.email;

    if (!email) {
      console.log(`  [${comm.id.substring(0, 8)}] No email in participants`);
      notMatched++;
      continue;
    }

    const match = await matchEmailToCompany(email);

    if (match.company_id) {
      // Update the communication
      const updates: Record<string, string> = { company_id: match.company_id };
      if (match.contact_id) updates.contact_id = match.contact_id;

      await supabase.from('communications').update(updates).eq('id', comm.id);

      console.log(`  ✓ ${email} → company (${match.matched_by})`);
      matched++;
      matchStats[match.matched_by || 'unknown'] = (matchStats[match.matched_by || 'unknown'] || 0) + 1;
    } else {
      console.log(`  ✗ ${email} → no match found`);
      notMatched++;
      if (!notMatchedEmails.includes(email)) {
        notMatchedEmails.push(email);
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Matched: ${matched}`);
  console.log(`Not matched: ${notMatched}`);

  if (Object.keys(matchStats).length > 0) {
    console.log('\nMatch methods:');
    for (const [method, count] of Object.entries(matchStats)) {
      console.log(`  ${method}: ${count}`);
    }
  }

  if (notMatchedEmails.length > 0) {
    console.log('\nUnmatched emails (may need to create contacts/companies):');
    notMatchedEmails.forEach((e) => console.log(`  - ${e}`));
  }

  // Verify counts
  const { count: linkedCount } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'email')
    .not('company_id', 'is', null);

  const { count: unlinkedCount } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'email')
    .is('company_id', null);

  console.log('\n=== Final Counts ===');
  console.log(`Linked emails: ${linkedCount}`);
  console.log(`Unlinked emails: ${unlinkedCount}`);
}

main().catch(console.error);
