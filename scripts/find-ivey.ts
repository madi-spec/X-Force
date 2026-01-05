/**
 * Find Ivey Exterminating in database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Search for Ivey in companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .or('name.ilike.%ivey%,name.ilike.%ivy%');

  console.log('Companies matching ivey/ivy:', companies);

  // Also search in communications for sender
  const { data: comms } = await supabase
    .from('communications')
    .select('id, company_id, subject, sender_email, sender_name')
    .or('sender_email.ilike.%ivey%,sender_name.ilike.%ivey%')
    .limit(5);

  console.log('\nCommunications from ivey:', comms);

  // Check all items in daily driver (attention_flags with now/today level)
  const { data: flags } = await supabase
    .from('attention_flags')
    .select(`
      id,
      flag_type,
      attention_level,
      reason,
      company_id,
      companies (name)
    `)
    .in('attention_level', ['now', 'today'])
    .is('resolved_at', null)
    .limit(20);

  console.log('\n=== Current Daily Driver Items ===');
  if (flags) {
    for (const flag of flags) {
      const companyName = (flag.companies as any)?.name || 'Unknown';
      console.log(`- ${companyName}: ${flag.flag_type} (${flag.attention_level})`);
      console.log(`  ${flag.reason}`);
    }
  }
}

run().catch(console.error);
