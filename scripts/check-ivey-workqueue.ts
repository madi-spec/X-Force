/**
 * Check why Ivey Exterminating is still in work queue
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('=== Investigating Ivey Exterminating in Work Queue ===\n');

  // 1. Find the company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%ivey%')
    .single();

  if (!company) {
    console.log('Company not found');
    return;
  }

  console.log('Company:', company.name, `(${company.id})\n`);

  // 2. Check attention flags
  const { data: flags } = await supabase
    .from('attention_flags')
    .select('*')
    .eq('company_id', company.id)
    .is('resolved_at', null);

  console.log('=== Active Attention Flags ===');
  if (flags && flags.length > 0) {
    for (const flag of flags) {
      console.log(`  - ${flag.flag_type}: ${flag.reason}`);
      console.log(`    Source: ${flag.source_type}/${flag.source_id}`);
      console.log(`    Created: ${flag.created_at}`);
    }
  } else {
    console.log('  None');
  }

  // 3. Check command center items
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('company_id', company.id)
    .neq('status', 'completed');

  console.log('\n=== Active Command Center Items ===');
  if (ccItems && ccItems.length > 0) {
    for (const item of ccItems) {
      console.log(`  - [${item.status}] ${item.category}: ${item.title}`);
      console.log(`    Source: ${item.source_type}/${item.source_id}`);
      console.log(`    Created: ${item.created_at}`);
    }
  } else {
    console.log('  None');
  }

  // 4. Check recent communications needing response
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, direction, needs_response, response_status, external_id, created_at')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== Recent Communications ===');
  if (comms && comms.length > 0) {
    for (const comm of comms) {
      const needsReply = comm.needs_response && comm.response_status !== 'responded';
      const subject = comm.subject ? comm.subject.substring(0, 50) : '(no subject)';
      console.log(`  - [${comm.direction}] ${subject}`);
      console.log(`    needs_response: ${comm.needs_response}, response_status: ${comm.response_status}`);
      console.log(`    ${needsReply ? '⚠️ NEEDS REPLY' : '✓ OK'}`);
      console.log(`    Created: ${comm.created_at}`);
    }
  } else {
    console.log('  None');
  }

  // 5. Check Daily Driver API response for this company
  console.log('\n=== Checking Daily Driver for Ivey ===');

  // Check for any unresolved items in the daily driver sources
  const { data: dailyDriverFlags } = await supabase
    .from('attention_flags')
    .select('*')
    .eq('company_id', company.id)
    .in('attention_level', ['now', 'today'])
    .is('resolved_at', null);

  if (dailyDriverFlags && dailyDriverFlags.length > 0) {
    console.log('  Found flags that would appear in Daily Driver:');
    for (const flag of dailyDriverFlags) {
      console.log(`    - ${flag.flag_type} (${flag.attention_level}): ${flag.reason}`);
    }
  } else {
    console.log('  No active Daily Driver flags');
  }
}

run().catch(console.error);
