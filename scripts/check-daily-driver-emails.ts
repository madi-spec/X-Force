/**
 * Check Daily Driver for Lawn Doctor and Nutrigreen emails
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function checkDailyDriver() {
  const supabase = createAdminClient();

  console.log('=== Checking Daily Driver Status ===\n');

  // Search for any communications related to lawn doctor or nutrigreen
  const { data: comms } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      sender_email,
      sender_name,
      direction,
      channel,
      awaiting_our_response,
      responded_at,
      company_id,
      occurred_at,
      companies(name)
    `)
    .or('sender_email.ilike.%lawn%,sender_email.ilike.%nutri%,subject.ilike.%lawn%,subject.ilike.%nutri%')
    .order('occurred_at', { ascending: false })
    .limit(20);

  console.log('Communications matching lawn/nutri:');
  for (const c of comms || []) {
    console.log(`\n[${c.direction}] ${c.subject}`);
    console.log(`  From: ${c.sender_name} <${c.sender_email}>`);
    console.log(`  Company: ${(c as any).companies?.name || 'None'}`);
    console.log(`  awaiting_our_response: ${c.awaiting_our_response}`);
    console.log(`  responded_at: ${c.responded_at}`);
    console.log(`  ID: ${c.id}`);
  }

  // Also check recent inbound emails that might need response
  console.log('\n\n=== Recent Inbound Emails Awaiting Response ===\n');

  const { data: awaiting } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      sender_email,
      sender_name,
      awaiting_our_response,
      responded_at,
      company_id,
      occurred_at,
      companies(name)
    `)
    .eq('direction', 'inbound')
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('occurred_at', { ascending: false })
    .limit(20);

  console.log(`Found ${awaiting?.length || 0} emails awaiting response:`);
  for (const c of awaiting || []) {
    console.log(`\n${c.subject}`);
    console.log(`  From: ${c.sender_name} <${c.sender_email}>`);
    console.log(`  Company: ${(c as any).companies?.name || 'None'}`);
    console.log(`  ID: ${c.id}`);
  }

  // Check if there are any with responded_at set (already handled)
  console.log('\n\n=== Recent Responded-To Emails (might need reset) ===\n');

  const { data: responded } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      sender_email,
      sender_name,
      awaiting_our_response,
      responded_at,
      company_id,
      occurred_at,
      companies(name)
    `)
    .eq('direction', 'inbound')
    .not('responded_at', 'is', null)
    .order('responded_at', { ascending: false })
    .limit(20);

  console.log(`Found ${responded?.length || 0} emails marked as responded:`);
  for (const c of responded || []) {
    console.log(`\n${c.subject}`);
    console.log(`  From: ${c.sender_name} <${c.sender_email}>`);
    console.log(`  Company: ${(c as any).companies?.name || 'None'}`);
    console.log(`  responded_at: ${c.responded_at}`);
    console.log(`  ID: ${c.id}`);
  }
}

checkDailyDriver().catch(console.error);
