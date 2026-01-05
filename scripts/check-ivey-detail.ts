/**
 * Detailed check for Ivey Exterminating
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMPANY_ID = '18b71dd9-2b71-4308-adfe-5d0a94b2e087';

async function run() {
  console.log('=== Ivey Exterminating Detailed Check ===\n');

  // 1. All attention flags (including resolved)
  const { data: allFlags } = await supabase
    .from('attention_flags')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false });

  console.log('=== All Attention Flags ===');
  if (allFlags && allFlags.length > 0) {
    for (const flag of allFlags) {
      const status = flag.resolved_at ? 'RESOLVED' : 'ACTIVE';
      console.log(`  [${status}] ${flag.flag_type} (${flag.attention_level})`);
      console.log(`    Reason: ${flag.reason}`);
      console.log(`    Source: ${flag.source_type}/${flag.source_id}`);
      console.log(`    Created: ${flag.created_at}`);
      if (flag.resolved_at) console.log(`    Resolved: ${flag.resolved_at}`);
      console.log();
    }
  } else {
    console.log('  None\n');
  }

  // 2. All command center items
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false });

  console.log('=== All Command Center Items ===');
  if (ccItems && ccItems.length > 0) {
    for (const item of ccItems) {
      console.log(`  [${item.status}] ${item.category}: ${item.title}`);
      console.log(`    Source: ${item.source_type}/${item.source_id}`);
      console.log(`    Created: ${item.created_at}`);
      console.log();
    }
  } else {
    console.log('  None\n');
  }

  // 3. Recent communications
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, direction, needs_response, response_status, sender_email, created_at')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== Recent Communications ===');
  if (comms && comms.length > 0) {
    for (const comm of comms) {
      const needsReply = comm.needs_response && comm.response_status !== 'responded';
      const subject = comm.subject ? comm.subject.substring(0, 60) : '(no subject)';
      console.log(`  [${comm.direction}] ${subject}`);
      console.log(`    From: ${comm.sender_email}`);
      console.log(`    needs_response: ${comm.needs_response}, response_status: ${comm.response_status}`);
      console.log(`    Status: ${needsReply ? '⚠️ NEEDS REPLY' : '✓ OK'}`);
      console.log(`    Created: ${comm.created_at}`);
      console.log(`    ID: ${comm.id}`);
      console.log();
    }
  } else {
    console.log('  None\n');
  }

  // 4. Check company_products for any stage-based items
  const { data: products } = await supabase
    .from('company_products')
    .select('*, products(name)')
    .eq('company_id', COMPANY_ID);

  console.log('=== Company Products ===');
  if (products && products.length > 0) {
    for (const cp of products) {
      const productName = (cp.products as any)?.name || 'Unknown';
      console.log(`  ${productName}: ${cp.current_stage}`);
      console.log(`    Health: ${cp.health_score}`);
    }
  } else {
    console.log('  None\n');
  }
}

run().catch(console.error);
