import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, email')
    .limit(1)
    .single();

  if (!contact) {
    console.log('No contact found');
    return;
  }

  // Get a user
  const { data: user } = await supabase.from('users').select('id').limit(1).single();

  // Add a note
  const { data: note, error } = await supabase
    .from('relationship_notes')
    .insert({
      contact_id: contact.id,
      note: 'TEST NOTE: CEO is ready to sign. Decision expected by Friday.',
      context_type: 'insight',
      added_by: user?.id
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding note:', error.message);
    return;
  }

  console.log('Note added:', note.id);

  // Build context
  const { buildRelationshipContext } = await import(
    '../src/lib/intelligence/buildRelationshipContext'
  );
  const context = await buildRelationshipContext({ email: contact.email });

  // Check for salesperson notes in prompt
  const hasNotes = context.promptContext.includes('Salesperson Notes');
  const hasCEO = context.promptContext.includes('CEO is ready to sign');

  console.log('Has Salesperson Notes section:', hasNotes);
  console.log('Contains our note:', hasCEO);

  // Show the notes section if it exists
  const lines = context.promptContext.split('\n');
  const notesStart = lines.findIndex(l => l.includes('Salesperson Notes'));
  if (notesStart > -1) {
    console.log('\n--- SALESPERSON NOTES SECTION ---');
    console.log(lines.slice(notesStart, notesStart + 10).join('\n'));
    console.log('---');
  }

  // Cleanup
  await supabase.from('relationship_notes').delete().eq('id', note.id);
  console.log('\nCleaned up test note');
}

main().catch(console.error);
