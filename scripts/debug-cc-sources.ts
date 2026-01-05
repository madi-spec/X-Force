/**
 * Debug script to investigate:
 * 1. Why no email-based CC items are created
 * 2. Why relationship intelligence is empty
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== COMMAND CENTER & RELATIONSHIP INTELLIGENCE DEBUG ===\n');

  // 1. Check CC items by source
  console.log('1. Command Center Items by Source:');
  const { data: sourceDistribution, error: srcError } = await supabase
    .from('command_center_items')
    .select('source')
    .limit(1000);

  if (srcError) {
    console.error('Error fetching sources:', srcError);
  } else {
    const sourceCounts: Record<string, number> = {};
    for (const item of sourceDistribution || []) {
      sourceCounts[item.source || 'null'] = (sourceCounts[item.source || 'null'] || 0) + 1;
    }
    console.log(sourceCounts);
  }

  // 2. Check email_messages table
  console.log('\n2. Email Messages Summary:');
  const { data: emailStats } = await supabase
    .from('email_messages')
    .select('id, direction, company_id, contact_id, received_at')
    .order('received_at', { ascending: false })
    .limit(5);

  console.log('Recent emails:', emailStats?.length || 0, 'found');
  if (emailStats && emailStats.length > 0) {
    console.log('Sample:', emailStats.slice(0, 3).map(e => ({
      direction: e.direction,
      has_company: !!e.company_id,
      has_contact: !!e.contact_id,
      received_at: e.received_at
    })));
  }

  // 3. Check email_conversations table (if exists)
  console.log('\n3. Email Conversations:');
  const { data: conversations, error: convError } = await supabase
    .from('email_conversations')
    .select('id, status, company_id, contact_id, last_inbound_at')
    .order('last_inbound_at', { ascending: false })
    .limit(5);

  if (convError) {
    console.log('email_conversations error:', convError.message);
  } else {
    console.log('Recent conversations:', conversations?.length || 0, 'found');
    if (conversations && conversations.length > 0) {
      console.log('Sample:', conversations.slice(0, 3).map(c => ({
        status: c.status,
        has_company: !!c.company_id,
        has_contact: !!c.contact_id
      })));
    }
  }

  // 4. Check relationship_intelligence table
  console.log('\n4. Relationship Intelligence:');
  const { data: riStats, error: riError } = await supabase
    .from('relationship_intelligence')
    .select('id, company_id, contact_id, updated_at')
    .limit(10);

  if (riError) {
    console.log('relationship_intelligence error:', riError.message);
    console.log('Table might not exist - checking...');
  } else {
    console.log('Total RI records found:', riStats?.length || 0);
    if (riStats && riStats.length > 0) {
      console.log('Sample:', riStats.slice(0, 3));
    }
  }

  // 5. Check account_intelligence table
  console.log('\n5. Account Intelligence:');
  const { data: aiStats, error: aiError } = await supabase
    .from('account_intelligence')
    .select('id, company_id, updated_at')
    .limit(5);

  if (aiError) {
    console.log('account_intelligence error:', aiError.message);
  } else {
    console.log('Total account intelligence records:', aiStats?.length || 0);
  }

  // 6. Check relationship_notes table
  console.log('\n6. Relationship Notes:');
  const { data: notesStats, error: notesError } = await supabase
    .from('relationship_notes')
    .select('id, company_id, contact_id')
    .limit(5);

  if (notesError) {
    console.log('relationship_notes error:', notesError.message);
  } else {
    console.log('Total notes records:', notesStats?.length || 0);
  }

  // 7. Check companies table
  console.log('\n7. Companies (to verify table access):');
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .limit(3);

  if (compError) {
    console.log('companies error:', compError.message);
  } else {
    console.log('Sample companies:', companies);
  }

  // 8. Check if CC items with source 'email_sync' or 'email_ai_analysis' exist
  console.log('\n8. Email-specific CC items:');
  const { data: emailCCItems, error: emailCCError } = await supabase
    .from('command_center_items')
    .select('id, title, source, action_type, company_id, contact_id, created_at')
    .in('source', ['email_sync', 'email_ai_analysis', 'email'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (emailCCError) {
    console.log('Error:', emailCCError.message);
  } else if (!emailCCItems || emailCCItems.length === 0) {
    console.log('NO email-based CC items found!');
  } else {
    console.log('Found', emailCCItems.length, 'email-based CC items');
    console.log(emailCCItems);
  }

  // 9. Check Tier 1 items specifically
  console.log('\n9. Tier 1 (RESPOND NOW) items:');
  const { data: tier1Items } = await supabase
    .from('command_center_items')
    .select('id, title, source, tier, tier_trigger, status')
    .eq('tier', 1)
    .eq('status', 'pending')
    .limit(10);

  if (!tier1Items || tier1Items.length === 0) {
    console.log('NO Tier 1 items found!');
  } else {
    console.log('Found', tier1Items.length, 'Tier 1 items');
    console.log(tier1Items);
  }

  // 10. Check where email analysis pipeline creates items
  console.log('\n10. CC items from recent email analysis:');
  const { data: recentItems } = await supabase
    .from('command_center_items')
    .select('id, title, source, action_type, tier, tier_trigger, conversation_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('Most recent 20 CC items by source:');
  const sourceSummary: Record<string, number> = {};
  for (const item of recentItems || []) {
    sourceSummary[item.source] = (sourceSummary[item.source] || 0) + 1;
  }
  console.log(sourceSummary);

  console.log('\n=== END DEBUG ===');
}

main().catch(console.error);
