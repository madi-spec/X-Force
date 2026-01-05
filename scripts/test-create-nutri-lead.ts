/**
 * Test creating a lead from the NutriGreen email
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { extractEmailsFromBody, getExternalEmails, matchEmailToCompany } from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log('=== Test Create Lead for NutriGreen ===\n');

  // Find the NutriGreen email
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, company_id, full_content, their_participants')
    .ilike('full_content', '%nutrigreen%')
    .is('company_id', null)
    .limit(1);

  if (!comms || comms.length === 0) {
    console.log('No unlinked NutriGreen emails found');
    return;
  }

  const comm = comms[0];
  console.log('Found communication:');
  console.log('  ID:', comm.id);
  console.log('  Subject:', comm.subject);

  // Extract emails
  const bodyEmails = extractEmailsFromBody(comm.full_content || '');
  console.log('\nExtracted emails from body:', bodyEmails);

  if (bodyEmails.length === 0) {
    console.log('No emails found in body');
    return;
  }

  const email = bodyEmails[0]; // lizm@nutrigreentulsa.com
  const domain = email.split('@')[1];

  console.log('\nWould create lead:');
  console.log('  Email:', email);
  console.log('  Domain:', domain);
  console.log('  Company Name:', formatCompanyName(domain));

  // Check if company already exists
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id, name')
    .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`)
    .single();

  if (existingCompany) {
    console.log('\n  Already exists:', existingCompany.name);
  } else {
    console.log('\n  Would create new company');
  }

  console.log('\n--- API Endpoint ---');
  console.log(`GET /api/communications/${comm.id}/create-lead`);
  console.log(`POST /api/communications/${comm.id}/create-lead`);
  console.log('Body: { "email": "' + email + '", "companyName": "NutriGreen Tulsa" }');
}

function formatCompanyName(domain: string): string {
  const name = domain
    .replace(/\.(com|net|org|io|co|us|biz|info)$/i, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return name;
}

test().catch(console.error);
