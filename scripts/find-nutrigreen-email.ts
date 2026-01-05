/**
 * Find and reset the NutriGreen email
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function findNutrigreen() {
  const supabase = createAdminClient();

  console.log('=== Finding NutriGreen Email ===\n');

  // Find by company name in the join
  const nutriCompanyIds = [
    '90e37ae8-0939-40b5-8e6e-fbdc6a6641ba', // Nutri-Green Tulsa
    '4326351a-2a5c-4b86-8b5d-212d8098351e', // NutriGreen Tulsa
  ];

  // Check both company IDs
  for (const companyId of nutriCompanyIds) {
    const { data: comms } = await supabase
      .from('communications')
      .select('id, subject, awaiting_our_response, responded_at, company_id')
      .eq('company_id', companyId);

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    console.log(`\n${company?.name || companyId}: ${comms?.length || 0} communications`);
    for (const c of comms || []) {
      console.log(`  - ${c.subject}`);
      console.log(`    awaiting: ${c.awaiting_our_response}, responded: ${c.responded_at}`);
      console.log(`    ID: ${c.id}`);
    }
  }

  // Also search for "Additional Features" in subject (from the earlier output)
  console.log('\n=== Searching for "Additional Features" email ===\n');

  const { data: additionalFeatures } = await supabase
    .from('communications')
    .select('id, subject, awaiting_our_response, responded_at, company_id, company:companies(name)')
    .ilike('subject', '%Additional Features%');

  for (const c of additionalFeatures || []) {
    console.log(`${c.subject}`);
    console.log(`  Company: ${(c as any).company?.name} (${c.company_id})`);
    console.log(`  awaiting: ${c.awaiting_our_response}, responded: ${c.responded_at}`);
    console.log(`  ID: ${c.id}`);
  }

  // If found, reset it
  const nutriEmail = additionalFeatures?.find(c =>
    (c as any).company?.name?.toLowerCase().includes('nutri')
  );

  if (nutriEmail) {
    console.log('\n=== Resetting NutriGreen Email ===\n');

    const { error } = await supabase
      .from('communications')
      .update({
        awaiting_our_response: true,
        responded_at: null,
      })
      .eq('id', nutriEmail.id);

    if (error) {
      console.log(`❌ Failed: ${error.message}`);
    } else {
      console.log(`✅ Reset "${nutriEmail.subject}" - now in Daily Driver`);
    }
  }
}

findNutrigreen().catch(console.error);
