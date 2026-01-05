import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '../src/lib/supabase/admin';

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

  console.log('Contact:', contact.email, 'ID:', contact.id);

  // Get a user
  const { data: user } = await supabase.from('users').select('id').limit(1).single();

  // Add a note
  const { data: note, error } = await supabase
    .from('relationship_notes')
    .insert({
      contact_id: contact.id,
      note: 'DEBUG: CEO is ready to sign',
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

  // Query notes directly
  const admin = createAdminClient();
  const { data: directNotes, error: queryError } = await admin
    .from('relationship_notes')
    .select('*')
    .eq('contact_id', contact.id);

  console.log('\nDirect query result:');
  console.log('Notes found:', directNotes?.length);
  if (directNotes && directNotes.length > 0) {
    console.log('First note:', directNotes[0].note);
  }
  if (queryError) {
    console.log('Query error:', queryError.message);
  }

  // Now test the buildRelationshipContext
  const { buildRelationshipContext } = await import(
    '../src/lib/intelligence/buildRelationshipContext'
  );

  const context = await buildRelationshipContext({ email: contact.email });

  console.log('\nbuildRelationshipContext result:');
  console.log('structured.notes.length:', context.structured.notes.length);
  if (context.structured.notes.length > 0) {
    console.log('First note in structured:', context.structured.notes[0].note);
  }

  console.log('\nSearching promptContext...');
  const hasNotes = context.promptContext.includes('Salesperson Notes');
  const hasCEO = context.promptContext.includes('CEO is ready to sign');
  console.log('Has Salesperson Notes:', hasNotes);
  console.log('Has our note:', hasCEO);

  // Cleanup
  await supabase.from('relationship_notes').delete().eq('id', note.id);
  console.log('\nCleaned up');
}

main().catch(console.error);
