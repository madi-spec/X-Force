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
    .select('id, email, company_id')
    .limit(1)
    .single();

  if (!contact) {
    console.log('No contact found');
    return;
  }

  console.log('Contact:', contact.email);
  console.log('ContactId:', contact.id);
  console.log('CompanyId:', contact.company_id);

  // Get a user
  const { data: user } = await supabase.from('users').select('id').limit(1).single();

  // Add a note
  const { data: note } = await supabase
    .from('relationship_notes')
    .insert({
      contact_id: contact.id,
      note: 'DEBUG: CEO is ready to sign',
      context_type: 'insight',
      added_by: user?.id
    })
    .select()
    .single();

  console.log('Note added:', note?.id);

  // Query exactly as buildRelationshipContext does
  const admin = createAdminClient();

  // Simulate getRelationshipNotes with just contactId
  let query1 = admin
    .from('relationship_notes')
    .select('*')
    .order('added_at', { ascending: false })
    .limit(20);

  // If contactId exists, add the filter
  query1 = query1.eq('contact_id', contact.id);

  // If companyId exists, add OR clause
  if (contact.company_id) {
    query1 = query1.or(`company_id.eq.${contact.company_id}`);
  }

  const { data: notes1, error: err1 } = await query1;
  console.log('\nQuery with eq + or:', notes1?.length, 'notes');
  if (err1) console.log('Error:', err1.message);

  // Try alternate query approach
  const { data: notes2 } = await admin
    .from('relationship_notes')
    .select('*')
    .eq('contact_id', contact.id)
    .order('added_at', { ascending: false })
    .limit(20);

  console.log('Query with just eq:', notes2?.length, 'notes');

  // Cleanup
  if (note) {
    await supabase.from('relationship_notes').delete().eq('id', note.id);
    console.log('Cleaned up');
  }
}

main().catch(console.error);
