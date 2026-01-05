import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Find Atlantic Pest Control
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%atlantic%pest%');

  if (!companies || companies.length === 0) {
    console.log('No company found');
    return;
  }

  const companyId = companies[0].id;
  console.log('Company:', companies[0].name, '- ID:', companyId);

  // Get communication details
  const { data: comms } = await supabase
    .from('communications')
    .select(`
      id, subject, content_preview, awaiting_our_response,
      contact_id,
      their_participants,
      contact:contacts(id, name, email)
    `)
    .eq('company_id', companyId)
    .eq('awaiting_our_response', true)
    .is('responded_at', null);

  console.log('\nCommunications awaiting response:', comms?.length || 0);

  for (const comm of comms || []) {
    console.log('\n--- Communication ---');
    console.log('ID:', comm.id);
    console.log('Subject:', comm.subject);
    console.log('Contact:', JSON.stringify(comm.contact));
    console.log('Their Participants:', JSON.stringify(comm.their_participants));
    console.log('Preview:', (comm.content_preview as string)?.slice(0, 300));
  }

  // Check company_products for risk level
  const { data: cp } = await supabase
    .from('company_products')
    .select('id, risk_level, open_objections')
    .eq('company_id', companyId);

  console.log('\nCompany Products:', JSON.stringify(cp, null, 2));

  // Check AI action log
  const { data: actions } = await supabase
    .from('ai_action_log')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nAI Action Log:', JSON.stringify(actions, null, 2));

  // Check attention flags
  const { data: flags } = await supabase
    .from('attention_flags')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'open')
    .limit(3);

  console.log('\nOpen Flags:', JSON.stringify(flags, null, 2));
}

check().catch(console.error);
