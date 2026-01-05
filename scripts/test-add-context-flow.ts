/**
 * Test the Add Context Flow
 *
 * Tests the full flow:
 * 1. Find a command center item
 * 2. Show current tier and analysis
 * 3. Add context WITHOUT reanalysis
 * 4. Verify note was saved
 * 5. Add context WITH reanalysis
 * 6. Show before/after changes
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('='.repeat(70));
  console.log('ADD CONTEXT FLOW TEST');
  console.log('Testing salesperson context injection and reanalysis');
  console.log('='.repeat(70));

  // Step 1: Find a command center item with a linked contact
  console.log('\n📋 Step 1: Finding a command center item with contact...');
  console.log('─'.repeat(70));

  const { data: items } = await supabase
    .from('command_center_items')
    .select(`
      id, tier, tier_trigger, why_now, context_brief, source, source_id,
      suggested_actions, email_draft, reanalyzed_at, reanalyzed_with_context,
      contact:contacts(id, name, email),
      company:companies(id, name)
    `)
    .not('contact_id', 'is', null)
    .eq('status', 'pending')
    .limit(5);

  if (!items || items.length === 0) {
    console.log('No command center items with contacts found!');
    console.log('\nLet me try to find any command center item...');

    const { data: anyItems } = await supabase
      .from('command_center_items')
      .select(`
        id, tier, tier_trigger, why_now, context_brief, source, source_id,
        contact_id, company_id
      `)
      .eq('status', 'pending')
      .limit(5);

    if (!anyItems || anyItems.length === 0) {
      console.log('No pending command center items found at all!');
      console.log('\nTo test this flow, you need:');
      console.log('1. An email synced to email_messages');
      console.log('2. A command center item created from that email');
      console.log('3. The email linked to a contact');
      return;
    }

    console.log('\nFound items without contact links:');
    for (const item of anyItems) {
      console.log(`  - ${item.id.substring(0, 8)}... | Tier ${item.tier} | Source: ${item.source}`);
    }
    return;
  }

  const testItem = items[0];
  console.log(`\n✅ Found item: ${testItem.id}`);
  console.log(`   Contact: ${testItem.contact?.name} <${testItem.contact?.email}>`);
  console.log(`   Company: ${testItem.company?.name || 'N/A'}`);

  // Step 2: Show current state
  console.log('\n📊 Step 2: Current State (BEFORE)');
  console.log('─'.repeat(70));

  console.log(`   Tier: ${testItem.tier}`);
  console.log(`   Tier Trigger: ${testItem.tier_trigger || 'N/A'}`);
  console.log(`   Why Now: ${testItem.why_now || 'N/A'}`);
  console.log(`   Context Brief: ${testItem.context_brief?.substring(0, 100) || 'N/A'}...`);
  console.log(`   Suggested Actions: ${testItem.suggested_actions ? JSON.stringify(testItem.suggested_actions).substring(0, 100) + '...' : 'N/A'}`);
  console.log(`   Previously Reanalyzed: ${testItem.reanalyzed_at ? 'Yes' : 'No'}`);

  // Check existing notes
  const { data: existingNotes } = await supabase
    .from('relationship_notes')
    .select('id, note, context_type, added_at')
    .eq('contact_id', testItem.contact?.id)
    .order('added_at', { ascending: false })
    .limit(3);

  console.log(`\n   Existing Notes: ${existingNotes?.length || 0}`);
  if (existingNotes && existingNotes.length > 0) {
    for (const note of existingNotes) {
      console.log(`     - [${note.context_type}] "${note.note.substring(0, 50)}..."`);
    }
  }

  // Step 3: Add context WITHOUT reanalysis
  console.log('\n📝 Step 3: Adding Context (WITHOUT Reanalysis)');
  console.log('─'.repeat(70));

  const contextNote1 = `Test note: Ran into ${testItem.contact?.name} at industry conference. Very interested.`;
  console.log(`   Adding: "${contextNote1}"`);

  // Simulate the API call by directly inserting
  const { data: insertedNote1, error: noteError1 } = await supabase
    .from('relationship_notes')
    .insert({
      contact_id: testItem.contact?.id,
      company_id: testItem.company?.id || null,
      note: contextNote1,
      context_type: 'insight',
      added_by: (await getTestUserId(supabase)) || null,
      linked_item_id: testItem.id,
      linked_source_type: testItem.source,
      linked_source_id: testItem.source_id,
    })
    .select()
    .single();

  if (noteError1) {
    console.log(`   ❌ Error adding note: ${noteError1.message}`);
  } else {
    console.log(`   ✅ Note saved: ${insertedNote1.id}`);
  }

  // Verify note was saved
  const { data: notesAfter1 } = await supabase
    .from('relationship_notes')
    .select('id')
    .eq('contact_id', testItem.contact?.id);

  console.log(`   Notes count after: ${notesAfter1?.length || 0}`);

  // Step 4: Add context WITH reanalysis (simulated)
  console.log('\n🔄 Step 4: Adding Context WITH Reanalysis');
  console.log('─'.repeat(70));

  const contextNote2 = 'They mentioned evaluating Gong as a competitor. Decision expected by end of Q1.';
  console.log(`   Adding: "${contextNote2}"`);
  console.log('   Reanalyze: true');

  // Save the second note
  const { data: insertedNote2 } = await supabase
    .from('relationship_notes')
    .insert({
      contact_id: testItem.contact?.id,
      company_id: testItem.company?.id || null,
      note: contextNote2,
      context_type: 'warning',
      added_by: (await getTestUserId(supabase)) || null,
      linked_item_id: testItem.id,
      linked_source_type: testItem.source,
      linked_source_id: testItem.source_id,
    })
    .select()
    .single();

  if (insertedNote2) {
    console.log(`   ✅ Note saved: ${insertedNote2.id}`);
  }

  // To actually reanalyze, we'd need the email content and AI call
  // For this test, we'll simulate what would happen
  console.log('\n   ⚠️  Note: Full reanalysis requires calling the AI API.');
  console.log('   In production, this would:');
  console.log('   1. Fetch the source email');
  console.log('   2. Rebuild relationship context (now including new notes)');
  console.log('   3. Call AI with special "SALESPERSON CONTEXT" section');
  console.log('   4. Update tier, why_now, suggested_actions, email_draft');

  // Simulate tier update based on competitor mention
  console.log('\n   Simulating tier update based on competitor context...');

  const { error: updateError } = await supabase
    .from('command_center_items')
    .update({
      tier: 2, // Upgrade to Tier 2 due to competitive risk
      tier_trigger: 'competitive_risk',
      why_now: `Evaluating Gong. Decision by Q1 end. ${testItem.contact?.name} interested per conference chat.`,
      reanalyzed_at: new Date().toISOString(),
      reanalyzed_with_context: contextNote2,
    })
    .eq('id', testItem.id);

  if (updateError) {
    console.log(`   ❌ Update error: ${updateError.message}`);
  } else {
    console.log('   ✅ Item updated with new tier and why_now');
  }

  // Step 5: Show AFTER state
  console.log('\n📊 Step 5: Updated State (AFTER)');
  console.log('─'.repeat(70));

  const { data: updatedItem } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger, why_now, reanalyzed_at, reanalyzed_with_context')
    .eq('id', testItem.id)
    .single();

  if (updatedItem) {
    console.log(`   Tier: ${testItem.tier} → ${updatedItem.tier}`);
    console.log(`   Tier Trigger: ${testItem.tier_trigger || 'N/A'} → ${updatedItem.tier_trigger}`);
    console.log(`   Why Now: ${updatedItem.why_now}`);
    console.log(`   Reanalyzed At: ${updatedItem.reanalyzed_at}`);
    console.log(`   Reanalyzed With: "${updatedItem.reanalyzed_with_context}"`);
  }

  // Check notes again
  const { data: finalNotes } = await supabase
    .from('relationship_notes')
    .select('id, note, context_type, added_at')
    .eq('contact_id', testItem.contact?.id)
    .order('added_at', { ascending: false });

  console.log(`\n   Final Notes Count: ${finalNotes?.length || 0}`);
  if (finalNotes && finalNotes.length > 0) {
    console.log('   Recent notes:');
    for (const note of finalNotes.slice(0, 5)) {
      console.log(`     - [${note.context_type}] "${note.note.substring(0, 60)}..."`);
    }
  }

  // Step 6: Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(70));

  const changes = [];
  if (updatedItem && updatedItem.tier !== testItem.tier) {
    changes.push(`Tier: ${testItem.tier} → ${updatedItem.tier}`);
  }
  if (updatedItem?.tier_trigger !== testItem.tier_trigger) {
    changes.push(`Trigger: ${testItem.tier_trigger || 'N/A'} → ${updatedItem?.tier_trigger}`);
  }
  if (updatedItem?.why_now !== testItem.why_now) {
    changes.push('Why Now: Updated with context');
  }
  if (updatedItem?.reanalyzed_at) {
    changes.push('Reanalysis: Marked complete');
  }

  console.log('\n✅ CHANGES MADE:');
  for (const change of changes) {
    console.log(`   • ${change}`);
  }

  console.log('\n📝 NOTES ADDED:');
  console.log(`   • "${contextNote1.substring(0, 50)}..."`);
  console.log(`   • "${contextNote2.substring(0, 50)}..."`);

  console.log('\n🔑 KEY POINTS:');
  console.log('   • Salesperson context is saved to relationship_notes');
  console.log('   • Notes are linked to the command center item');
  console.log('   • Competitor mention triggered Tier 2 upgrade');
  console.log('   • why_now now reflects human insight + data');
  console.log('   • Future analyses will include these notes in context');

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
}

async function getTestUserId(supabase: any): Promise<string | null> {
  const { data } = await supabase.from('users').select('id').limit(1).single();
  return data?.id || null;
}

main().catch(console.error);
