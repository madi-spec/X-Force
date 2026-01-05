/**
 * Test script for relationship context builder
 * Run: npx tsx scripts/test-context-builder.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { buildRelationshipContext, buildContextFromEmail } = await import(
    '../src/lib/intelligence/buildRelationshipContext'
  );

  const supabase = createAdminClient();

  console.log('='.repeat(70));
  console.log('RELATIONSHIP CONTEXT BUILDER TEST');
  console.log('='.repeat(70));

  // Find contacts with different levels of history
  // 1. Contact with relationship_intelligence record (rich history)
  const { data: richContacts } = await supabase
    .from('relationship_intelligence')
    .select('contact_id')
    .not('contact_id', 'is', null)
    .limit(1);

  // 2. Contact with some emails but no relationship record
  const { data: minimalContacts } = await supabase
    .from('contacts')
    .select('id, name, email')
    .not('id', 'in', `(${richContacts?.map((r) => `"${r.contact_id}"`).join(',') || "''"})`)
    .limit(1);

  // 3. Try to find a contact with no history at all, or use an email that doesn't exist
  const newEmail = 'brand-new-contact@example.com';

  // Test Case 1: Rich History
  if (richContacts && richContacts.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 1: CONTACT WITH RICH HISTORY');
    console.log('─'.repeat(70));

    const contactId = richContacts[0].contact_id;
    console.log(`\nBuilding context for contact: ${contactId}`);

    try {
      const context = await buildRelationshipContext({ contactId });

      console.log('\n📊 STRUCTURED DATA SUMMARY:');
      console.log(`   Contact: ${context.structured.contact?.name || 'None'}`);
      console.log(`   Company: ${context.structured.company?.name || 'None'}`);
      console.log(`   Deal: ${context.structured.deal?.name || 'None'}`);
      console.log(`   Interactions: ${context.structured.interactions.length}`);
      console.log(`   Our Commitments: ${context.structured.openCommitments.ours.length}`);
      console.log(`   Their Commitments: ${context.structured.openCommitments.theirs.length}`);
      console.log(`   Buying Signals: ${context.structured.buyingSignals.length}`);
      console.log(`   Concerns: ${context.structured.concerns.length}`);
      console.log(`   Notes: ${context.structured.notes.length}`);
      console.log(`   Recent Meetings: ${context.structured.recentMeetings.length}`);

      console.log('\n📝 PROMPT CONTEXT OUTPUT:');
      console.log('─'.repeat(70));
      console.log(context.promptContext);
      console.log('─'.repeat(70));
    } catch (err) {
      console.log(`   Error: ${err}`);
    }
  } else {
    console.log('\n⚠️  No contacts with rich history found');
  }

  // Test Case 2: Minimal History
  if (minimalContacts && minimalContacts.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 2: CONTACT WITH MINIMAL HISTORY');
    console.log('─'.repeat(70));

    const contact = minimalContacts[0];
    console.log(`\nBuilding context for contact: ${contact.name} (${contact.email})`);

    try {
      const context = await buildRelationshipContext({ contactId: contact.id });

      console.log('\n📊 STRUCTURED DATA SUMMARY:');
      console.log(`   Contact: ${context.structured.contact?.name || 'None'}`);
      console.log(`   Company: ${context.structured.company?.name || 'None'}`);
      console.log(`   Deal: ${context.structured.deal?.name || 'None'}`);
      console.log(`   Interactions: ${context.structured.interactions.length}`);
      console.log(`   Our Commitments: ${context.structured.openCommitments.ours.length}`);
      console.log(`   Buying Signals: ${context.structured.buyingSignals.length}`);

      console.log('\n📝 PROMPT CONTEXT OUTPUT:');
      console.log('─'.repeat(70));
      console.log(context.promptContext);
      console.log('─'.repeat(70));
    } catch (err) {
      console.log(`   Error: ${err}`);
    }
  } else {
    console.log('\n⚠️  No contacts with minimal history found');
  }

  // Test Case 3: Brand New (no existing record)
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 3: BRAND NEW CONTACT (NO HISTORY)');
  console.log('─'.repeat(70));

  // Try to find ANY contact without relationship intelligence
  const { data: anyContact } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .limit(10);

  let newContact = null;
  for (const c of anyContact || []) {
    const { data: hasRI } = await supabase
      .from('relationship_intelligence')
      .select('id')
      .eq('contact_id', c.id)
      .single();

    if (!hasRI) {
      newContact = c;
      break;
    }
  }

  if (newContact) {
    console.log(`\nBuilding context for contact with no relationship record: ${newContact.name}`);

    try {
      const context = await buildRelationshipContext({ contactId: newContact.id });

      console.log('\n📊 STRUCTURED DATA SUMMARY:');
      console.log(`   Contact: ${context.structured.contact?.name || 'None'}`);
      console.log(`   Company: ${context.structured.company?.name || 'None'}`);
      console.log(`   Deal: ${context.structured.deal?.name || 'None'}`);
      console.log(`   Interactions: ${context.structured.interactions.length}`);
      console.log(`   Relationship Summary: ${context.structured.relationshipSummary ? 'Yes' : 'None'}`);

      console.log('\n📝 PROMPT CONTEXT OUTPUT:');
      console.log('─'.repeat(70));
      console.log(context.promptContext);
      console.log('─'.repeat(70));
    } catch (err) {
      console.log(`   Error: ${err}`);
    }
  } else {
    // Try with an email that doesn't exist
    console.log(`\nTrying with non-existent email: ${newEmail}`);
    try {
      const context = await buildContextFromEmail(newEmail);
      console.log('\n📊 STRUCTURED DATA SUMMARY:');
      console.log(`   Contact: ${context.structured.contact?.name || 'None'}`);
      console.log(`   Company: ${context.structured.company?.name || 'None'}`);
    } catch (err) {
      console.log(`   Expected behavior - no data found for unknown email`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
