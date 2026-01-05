/**
 * Fix existing scheduling requests - find all related data
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function findAllData() {
  const supabase = createAdminClient();

  console.log('=== Comprehensive Search for Scheduling Request Data ===\n');

  // Get the user (Brent Allen)
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'xraisales@affiliatedtech.com')
    .single();

  console.log('Internal User:', user?.id, user?.name, user?.email);

  // 1. LAWN DOCTOR OF WARREN
  console.log('\n========== LAWN DOCTOR OF WARREN ==========');

  // All communications for this company
  const { data: ldComms } = await supabase
    .from('communications')
    .select('id, subject, sender_email, sender_name, direction, channel, occurred_at')
    .eq('company_id', '8f03aa68-4b00-42ed-be86-8d81fc1e9b9f')
    .order('occurred_at', { ascending: false })
    .limit(10);

  console.log('\nAll communications for Lawn Doctor:');
  for (const comm of ldComms || []) {
    console.log(`  [${comm.direction}] ${comm.subject}`);
    console.log(`    From: ${comm.sender_name} <${comm.sender_email}>`);
    console.log(`    Channel: ${comm.channel}, Date: ${comm.occurred_at}`);
    console.log(`    ID: ${comm.id}`);
    console.log('');
  }

  // Contacts for this company
  const { data: ldContacts } = await supabase
    .from('contacts')
    .select('id, name, email, title, company_id')
    .eq('company_id', '8f03aa68-4b00-42ed-be86-8d81fc1e9b9f');

  console.log('Contacts for Lawn Doctor:');
  for (const c of ldContacts || []) {
    console.log(`  - ${c.name} <${c.email}> - ${c.title || 'No title'}`);
  }

  // 2. NUTRIGREEN
  console.log('\n========== NUTRIGREEN ==========');

  // Get both Nutrigreen company IDs
  const nutriIds = [
    '90e37ae8-0939-40b5-8e6e-fbdc6a6641ba',
    '4326351a-2a5c-4b86-8b5d-212d8098351e'
  ];

  for (const companyId of nutriIds) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    console.log(`\n--- ${company?.name} (${companyId}) ---`);

    const { data: comms } = await supabase
      .from('communications')
      .select('id, subject, sender_email, sender_name, direction, channel, occurred_at')
      .eq('company_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(5);

    if (comms?.length) {
      console.log('Communications:');
      for (const comm of comms) {
        console.log(`  [${comm.direction}] ${comm.subject}`);
        console.log(`    From: ${comm.sender_name} <${comm.sender_email}>`);
        console.log(`    ID: ${comm.id}`);
      }
    } else {
      console.log('No communications found');
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, title')
      .eq('company_id', companyId);

    if (contacts?.length) {
      console.log('Contacts:');
      for (const c of contacts) {
        console.log(`  - ${c.name} <${c.email}>`);
      }
    } else {
      console.log('No contacts found');
    }
  }

  // 3. Search command_center_items for these scheduled meetings
  console.log('\n========== COMMAND CENTER ITEMS ==========');

  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, item_type, status, company_id, communication_id, companies(name)')
    .in('company_id', ['8f03aa68-4b00-42ed-be86-8d81fc1e9b9f', ...nutriIds])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nCommand Center Items:');
  for (const item of ccItems || []) {
    console.log(`  - ${item.item_type} (${item.status})`);
    console.log(`    Company: ${(item as any).companies?.name}`);
    console.log(`    Communication ID: ${item.communication_id}`);
    console.log(`    ID: ${item.id}`);
    console.log('');
  }

  // 4. Search for action taken items (scheduler)
  const { data: schedulerItems } = await supabase
    .from('command_center_items')
    .select('id, item_type, status, company_id, communication_id, ai_recommendation, companies(name), communications(id, subject, sender_email, sender_name)')
    .eq('status', 'action_taken')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('\nRecent "action_taken" CC Items (may be scheduler source):');
  for (const item of schedulerItems || []) {
    console.log(`  - ${item.item_type}: ${(item as any).companies?.name}`);
    console.log(`    Recommendation: ${(item.ai_recommendation as any)?.action || 'unknown'}`);
    console.log(`    Communication: ${(item as any).communications?.subject}`);
    console.log(`    Sender: ${(item as any).communications?.sender_name} <${(item as any).communications?.sender_email}>`);
    console.log(`    CC Item ID: ${item.id}`);
    console.log(`    Communication ID: ${item.communication_id}`);
    console.log('');
  }
}

findAllData().catch(console.error);
