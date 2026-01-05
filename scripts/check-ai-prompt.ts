import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Find Atlantic Pest Control company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%Atlantic%Pest%')
    .single();

  if (companyError || !company) {
    console.log('Company not found:', companyError?.message);
    return;
  }

  console.log('Company:', company.name, '(', company.id, ')');

  // Find the needs-reply communication
  const { data: comm, error: commError } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      direction,
      their_participants,
      our_participants,
      contact_id,
      contact:contacts(id, name, email)
    `)
    .eq('company_id', company.id)
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .single();

  if (commError || !comm) {
    console.log('No needs-reply communication found:', commError?.message);
    return;
  }

  console.log('\n=== Communication ===');
  console.log('ID:', comm.id);
  console.log('Subject:', comm.subject);
  console.log('Direction:', comm.direction);
  console.log('Contact ID:', comm.contact_id);
  console.log('Contact record:', JSON.stringify(comm.contact, null, 2));
  console.log('Their participants:', JSON.stringify(comm.their_participants, null, 2));
  console.log('Our participants:', JSON.stringify(comm.our_participants, null, 2));

  // Replicate the logic from draft-reply route
  const contact = Array.isArray(comm.contact) ? comm.contact[0] : comm.contact;
  let contactEmail = contact?.email;
  let contactName = contact?.name;

  console.log('\n=== Name Resolution ===');
  console.log('From contact record: name =', contactName, ', email =', contactEmail);

  if (!contactEmail && comm.their_participants) {
    const participants = comm.their_participants as Array<{ name?: string; email?: string }>;
    if (participants.length > 0) {
      contactEmail = participants[0].email || null;
      contactName = contactName || participants[0].name || null;
      console.log('From their_participants: name =', contactName, ', email =', contactEmail);
    }
  }

  const contactFirstName = contactName?.split(' ')[0] || 'there';
  console.log('\nFinal contact_first_name:', contactFirstName);
}

check().catch(console.error);
