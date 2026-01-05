/**
 * Fix existing scheduling requests - find source data and add attendees
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function fixRequests() {
  const supabase = createAdminClient();

  console.log('=== Finding Source Data for Scheduling Requests ===\n');

  // Get the user (Brent Allen)
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'xraisales@affiliatedtech.com')
    .single();

  console.log('Internal User:', user);

  // 1. Find Lawn Doctor of Warren communication
  console.log('\n--- Lawn Doctor of Warren ---');
  const { data: lawndoctorComms } = await supabase
    .from('communications')
    .select('id, subject, sender_email, sender_name, company_id, occurred_at')
    .eq('company_id', '8f03aa68-4b00-42ed-be86-8d81fc1e9b9f')
    .eq('direction', 'inbound')
    .order('occurred_at', { ascending: false })
    .limit(5);

  console.log('Recent inbound communications:');
  for (const comm of lawndoctorComms || []) {
    console.log(`  - ${comm.subject}`);
    console.log(`    From: ${comm.sender_name} <${comm.sender_email}>`);
    console.log(`    Date: ${comm.occurred_at}`);
    console.log(`    ID: ${comm.id}`);
    console.log('');
  }

  // 2. Find Nutrigreen - need to find company first
  console.log('\n--- Nutrigreen ---');
  const { data: nutriCompany } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', '%nutri%')
    .limit(5);

  console.log('Companies matching "nutri":');
  for (const c of nutriCompany || []) {
    console.log(`  - ${c.name} (${c.id}) - domain: ${c.domain}`);
  }

  // If we found Nutrigreen, get its communications
  if (nutriCompany?.length) {
    for (const company of nutriCompany) {
      const { data: nutriComms } = await supabase
        .from('communications')
        .select('id, subject, sender_email, sender_name, company_id, occurred_at')
        .eq('company_id', company.id)
        .eq('direction', 'inbound')
        .order('occurred_at', { ascending: false })
        .limit(3);

      if (nutriComms?.length) {
        console.log(`\nCommunications for ${company.name}:`);
        for (const comm of nutriComms) {
          console.log(`  - ${comm.subject}`);
          console.log(`    From: ${comm.sender_name} <${comm.sender_email}>`);
          console.log(`    Date: ${comm.occurred_at}`);
          console.log(`    ID: ${comm.id}`);
        }
      }
    }
  }

  // Also search by email domain
  const { data: nutriByEmail } = await supabase
    .from('communications')
    .select('id, subject, sender_email, sender_name, company_id, occurred_at, companies(id, name)')
    .ilike('sender_email', '%nutri%')
    .eq('direction', 'inbound')
    .order('occurred_at', { ascending: false })
    .limit(5);

  if (nutriByEmail?.length) {
    console.log('\nCommunications with "nutri" in email:');
    for (const comm of nutriByEmail) {
      console.log(`  - ${comm.subject}`);
      console.log(`    From: ${comm.sender_name} <${comm.sender_email}>`);
      console.log(`    Company: ${(comm as any).companies?.name || 'None'} (${comm.company_id})`);
      console.log(`    ID: ${comm.id}`);
    }
  }
}

fixRequests().catch(console.error);
