import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check contacts
  const { count: contactCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  console.log('Contacts:', contactCount);

  // Check relationship_notes table
  const { count: notesCount, error } = await supabase.from('relationship_notes').select('*', { count: 'exact', head: true });
  if (error) {
    console.log('relationship_notes error:', error.message);
  } else {
    console.log('Notes:', notesCount);
  }

  // Get a contact with email
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .not('email', 'is', null)
    .limit(1)
    .single();

  if (contact) {
    console.log('\nTest contact:', contact.name, '<' + contact.email + '>');
    console.log('Contact ID:', contact.id);
  }
}

main().catch(console.error);
