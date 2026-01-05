/**
 * Check Daily Driver communications state
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function checkDailyDriver() {
  const supabase = createAdminClient();

  console.log('=== Daily Driver Communications Check ===\n');

  // Query like the daily driver does
  const { data: needsReply, error } = await supabase
    .from('communications')
    .select(`
      id,
      company_id,
      subject,
      content_preview,
      awaiting_our_response,
      responded_at,
      created_at,
      company:companies(id, name)
    `)
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Emails needing reply: ${needsReply?.length || 0}\n`);

  for (const c of needsReply || []) {
    console.log(`${c.subject || 'No subject'}`);
    console.log(`  Company: ${(c as any).company?.name || 'None'}`);
    console.log(`  Preview: ${c.content_preview?.substring(0, 80) || 'No preview'}...`);
    console.log(`  ID: ${c.id}`);
    console.log('');
  }

  // Also check if there are any communications that WERE responded to recently
  console.log('\n=== Recently Responded To ===\n');

  const { data: responded } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      awaiting_our_response,
      responded_at,
      company:companies(id, name)
    `)
    .not('responded_at', 'is', null)
    .order('responded_at', { ascending: false })
    .limit(10);

  console.log(`Recently responded: ${responded?.length || 0}`);
  for (const c of responded || []) {
    console.log(`  ${c.subject} - ${(c as any).company?.name || 'No company'}`);
    console.log(`    responded_at: ${c.responded_at}`);
  }

  // Check total count
  const { count } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal communications in DB: ${count}`);

  // Search for lawn doctor and nutrigreen by company name
  console.log('\n=== Companies: Lawn Doctor of Warren & Nutrigreen ===\n');

  const ldCompanyId = '8f03aa68-4b00-42ed-be86-8d81fc1e9b9f';
  const nutriCompanyId = '90e37ae8-0939-40b5-8e6e-fbdc6a6641ba';

  const { data: ldComms } = await supabase
    .from('communications')
    .select('id, subject, awaiting_our_response, responded_at, created_at')
    .eq('company_id', ldCompanyId);

  console.log(`Lawn Doctor of Warren communications: ${ldComms?.length || 0}`);
  for (const c of ldComms || []) {
    console.log(`  - ${c.subject} (awaiting: ${c.awaiting_our_response}, responded: ${c.responded_at})`);
  }

  const { data: nutriComms } = await supabase
    .from('communications')
    .select('id, subject, awaiting_our_response, responded_at, created_at')
    .eq('company_id', nutriCompanyId);

  console.log(`\nNutri-Green Tulsa communications: ${nutriComms?.length || 0}`);
  for (const c of nutriComms || []) {
    console.log(`  - ${c.subject} (awaiting: ${c.awaiting_our_response}, responded: ${c.responded_at})`);
  }
}

checkDailyDriver().catch(console.error);
