/**
 * Fix existing scheduling requests - broader search
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function findData() {
  const supabase = createAdminClient();

  console.log('=== Broader Search ===\n');

  // Get internal user
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'xraisales@affiliatedtech.com')
    .single();

  console.log('Internal User:', user?.id);

  // 1. Get the two scheduling requests with full data
  console.log('\n========== SCHEDULING REQUESTS ==========');
  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('*')
    .order('created_at', { ascending: false });

  for (const req of requests || []) {
    console.log(`\nRequest: ${req.title}`);
    console.log(`  ID: ${req.id}`);
    console.log(`  Company ID: ${req.company_id}`);
    console.log(`  Context: ${req.context}`);
    console.log(`  Meeting Type: ${req.meeting_type}`);
    console.log(`  Duration: ${req.duration_minutes}`);
    console.log(`  Conversation History:`, JSON.stringify(req.conversation_history, null, 2));
  }

  // 2. Search all recent command center items
  console.log('\n========== ALL RECENT CC ITEMS ==========');
  const { data: allCCItems } = await supabase
    .from('command_center_items')
    .select(`
      id,
      item_type,
      status,
      company_id,
      communication_id,
      ai_recommendation,
      created_at,
      updated_at,
      companies(id, name)
    `)
    .order('updated_at', { ascending: false })
    .limit(20);

  for (const item of allCCItems || []) {
    console.log(`\n[${item.status}] ${item.item_type}`);
    console.log(`  Company: ${(item as any).companies?.name || 'None'}`);
    console.log(`  CC ID: ${item.id}`);
    console.log(`  Comm ID: ${item.communication_id}`);
    console.log(`  Updated: ${item.updated_at}`);
    const rec = item.ai_recommendation as any;
    if (rec) {
      console.log(`  Rec Action: ${rec.action}`);
    }
  }

  // 3. Search for communications with "lawn doctor" or "nutri" in subject
  console.log('\n========== SEARCH COMMUNICATIONS ==========');

  const { data: searchComms } = await supabase
    .from('communications')
    .select('id, subject, sender_email, sender_name, company_id, direction, occurred_at, companies(name)')
    .or('subject.ilike.%lawn%,subject.ilike.%nutri%,sender_email.ilike.%lawn%,sender_email.ilike.%nutri%')
    .order('occurred_at', { ascending: false })
    .limit(10);

  console.log('\nCommunications with lawn/nutri:');
  for (const comm of searchComms || []) {
    console.log(`  [${comm.direction}] ${comm.subject}`);
    console.log(`    From: ${comm.sender_name} <${comm.sender_email}>`);
    console.log(`    Company: ${(comm as any).companies?.name || 'None'} (${comm.company_id})`);
    console.log(`    ID: ${comm.id}`);
    console.log('');
  }

  // 4. Search company names containing lawn doctor or nutrigreen
  console.log('\n========== COMPANY SEARCH ==========');

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .or('name.ilike.%lawn%,name.ilike.%nutri%');

  for (const c of companies || []) {
    console.log(`  - ${c.name} (${c.id})`);
    console.log(`    Domain: ${c.domain}`);
  }

  // 5. Get contacts for these companies
  if (companies?.length) {
    console.log('\n========== CONTACTS FOR THESE COMPANIES ==========');
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, title, company_id, companies(name)')
      .in('company_id', companies.map(c => c.id));

    for (const c of contacts || []) {
      console.log(`  - ${c.name} <${c.email}>`);
      console.log(`    Company: ${(c as any).companies?.name}`);
      console.log(`    Contact ID: ${c.id}`);
    }
  }
}

findData().catch(console.error);
