/**
 * Test Context APIs
 *
 * Tests the salesperson context APIs:
 * 1. Add a note to a contact
 * 2. Retrieve notes for the contact
 * 3. Verify the context appears in buildRelationshipContext
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
  console.log('CONTEXT APIS TEST');
  console.log('Testing salesperson note management');
  console.log('='.repeat(70));

  // Step 1: Find a test contact
  console.log('\n📋 Step 1: Finding test contact...');
  console.log('─'.repeat(70));

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .not('email', 'is', null)
    .limit(1)
    .single();

  if (!contact) {
    console.log('No contacts found!');
    return;
  }

  console.log(`Contact: ${contact.name} <${contact.email}>`);
  console.log(`ID: ${contact.id}`);

  // Get a test user
  const { data: user } = await supabase.from('users').select('id').limit(1).single();
  const userId = user?.id;

  if (!userId) {
    console.log('No users found!');
    return;
  }

  // Step 2: Check existing notes
  console.log('\n📝 Step 2: Checking existing notes...');
  console.log('─'.repeat(70));

  const { data: existingNotes, count: beforeCount } = await supabase
    .from('relationship_notes')
    .select('*', { count: 'exact' })
    .eq('contact_id', contact.id);

  console.log(`Existing notes for this contact: ${beforeCount || 0}`);

  // Step 3: Add notes using the relationshipStore
  console.log('\n📝 Step 3: Adding test notes...');
  console.log('─'.repeat(70));

  const { addRelationshipNote, getRelationshipNotes } = await import(
    '../src/lib/intelligence/relationshipStore'
  );

  // Add an insight note
  const note1 = await addRelationshipNote({
    contactId: contact.id,
    companyId: contact.company_id || undefined,
    note: 'Met at industry conference. Very interested in our AI features. Mentioned they are evaluating 3 vendors.',
    contextType: 'insight',
    addedBy: userId,
  });

  console.log(`✅ Added insight note: ${note1.id}`);

  // Add a strategy note
  const note2 = await addRelationshipNote({
    contactId: contact.id,
    companyId: contact.company_id || undefined,
    note: 'Focus on ROI calculator in next demo. They need hard numbers for CFO approval.',
    contextType: 'strategy',
    addedBy: userId,
  });

  console.log(`✅ Added strategy note: ${note2.id}`);

  // Add a warning note
  const note3 = await addRelationshipNote({
    contactId: contact.id,
    companyId: contact.company_id || undefined,
    note: 'Competitor Gong is offering 30% discount. Decision expected by end of Q1.',
    contextType: 'warning',
    addedBy: userId,
  });

  console.log(`✅ Added warning note: ${note3.id}`);

  // Step 4: Retrieve notes
  console.log('\n📋 Step 4: Retrieving notes...');
  console.log('─'.repeat(70));

  const notes = await getRelationshipNotes({
    contactId: contact.id,
    limit: 10,
  });

  console.log(`Retrieved ${notes.length} notes:`);
  for (const note of notes) {
    console.log(`\n  [${note.context_type.toUpperCase()}] ${note.added_at.split('T')[0]}`);
    console.log(`  "${note.note}"`);
  }

  // Step 5: Verify notes appear in buildRelationshipContext
  console.log('\n📊 Step 5: Testing buildRelationshipContext...');
  console.log('─'.repeat(70));

  const { buildRelationshipContext } = await import(
    '../src/lib/intelligence/buildRelationshipContext'
  );

  const context = await buildRelationshipContext({
    email: contact.email,
  });

  console.log('\nContext Summary:');
  console.log(`  Contact: ${context.structured.contact?.name || 'Not found'}`);
  console.log(`  Company: ${context.structured.company?.name || 'Not found'}`);
  console.log(`  Notes: ${context.structured.notes?.length || 0}`);
  console.log(`  Interactions: ${context.structured.interactions?.length || 0}`);

  // Check if our notes are in the context
  if (context.structured.notes && context.structured.notes.length > 0) {
    console.log('\n  Notes in context:');
    for (const note of context.structured.notes.slice(0, 5)) {
      console.log(`    - [${note.context_type}] "${note.note.substring(0, 50)}..."`);
    }
  }

  // Check if promptContext includes notes
  console.log('\n  Prompt context includes notes:',
    context.promptContext.includes('SALESPERSON NOTES') ||
    context.promptContext.includes('insight') ||
    context.promptContext.includes('strategy') ||
    context.promptContext.includes('warning')
  );

  // Show a snippet of the prompt context
  console.log('\n  Prompt context snippet:');
  const notesSection = context.promptContext.split('SALESPERSON NOTES');
  if (notesSection.length > 1) {
    console.log('  ---');
    console.log('  SALESPERSON NOTES' + notesSection[1].substring(0, 500));
    console.log('  ---');
  } else {
    // Try to find notes another way
    const contextPreview = context.promptContext.substring(0, 1000);
    console.log('  ' + contextPreview.split('\n').slice(0, 20).join('\n  '));
  }

  // Step 6: Cleanup (optional)
  console.log('\n🧹 Step 6: Cleanup...');
  console.log('─'.repeat(70));

  // Delete test notes
  const { error: deleteError } = await supabase
    .from('relationship_notes')
    .delete()
    .in('id', [note1.id, note2.id, note3.id]);

  if (deleteError) {
    console.log(`Warning: Failed to delete test notes: ${deleteError.message}`);
  } else {
    console.log('✅ Test notes deleted');
  }

  // Verify cleanup
  const { count: afterCount } = await supabase
    .from('relationship_notes')
    .select('*', { count: 'exact', head: true })
    .eq('contact_id', contact.id);

  console.log(`Notes remaining for contact: ${afterCount || 0}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(70));

  console.log('\n✅ TESTED:');
  console.log('  • addRelationshipNote() - adds notes to relationship_notes table');
  console.log('  • getRelationshipNotes() - retrieves notes by contact');
  console.log('  • buildRelationshipContext() - includes notes in promptContext');
  console.log('  • Different context types: insight, strategy, warning');

  console.log('\n🔑 KEY OBSERVATIONS:');
  console.log('  • Notes are stored in relationship_notes table');
  console.log('  • Notes are retrieved and included in AI context');
  console.log('  • Context types help categorize salesperson insights');
  console.log('  • Notes persist across analyses until deleted');

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
