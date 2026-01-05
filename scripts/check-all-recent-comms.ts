/**
 * Check all recent communications in the system
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function checkAllComms() {
  const supabase = createAdminClient();

  console.log('=== All Recent Communications (last 50) ===\n');

  const { data: comms, error } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      sender_email,
      sender_name,
      direction,
      awaiting_our_response,
      responded_at,
      occurred_at,
      company_id,
      companies(name)
    `)
    .order('occurred_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total found: ${comms?.length || 0}\n`);

  for (const c of comms || []) {
    const company = (c as any).companies?.name || 'No company';
    const status = c.awaiting_our_response ? '⏳ AWAITING' : (c.responded_at ? '✅ RESPONDED' : '');
    console.log(`[${c.direction}] ${c.subject?.substring(0, 60) || 'No subject'}`);
    console.log(`  From: ${c.sender_name || 'Unknown'} <${c.sender_email}>`);
    console.log(`  Company: ${company}`);
    console.log(`  Date: ${c.occurred_at} ${status}`);
    console.log(`  ID: ${c.id}`);
    console.log('');
  }

  // Also get total count
  const { count } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal communications in database: ${count}`);
}

checkAllComms().catch(console.error);
