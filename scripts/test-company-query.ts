import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check account_intelligence columns
  console.log('Checking account_intelligence table...');
  const { data: ai, error: aiErr } = await supabase
    .from('account_intelligence')
    .select('*')
    .limit(1);

  if (aiErr) {
    console.log('account_intelligence error:', aiErr.message);
  } else if (ai && ai.length > 0) {
    console.log('account_intelligence columns:', Object.keys(ai[0]).sort().join(', '));
  } else {
    console.log('account_intelligence: table empty');
  }

  // Check relationship_notes columns
  console.log('\nChecking relationship_notes table...');
  const { data: notes, error: notesErr } = await supabase
    .from('relationship_notes')
    .select('*')
    .limit(1);

  if (notesErr) {
    console.log('relationship_notes error:', notesErr.message);
  } else if (notes && notes.length > 0) {
    console.log('relationship_notes columns:', Object.keys(notes[0]).sort().join(', '));
  } else {
    console.log('relationship_notes: table empty');
  }

  // Test full intelligence query
  console.log('\n=== Testing Full Intelligence Query ===');
  const companyId = 'dc2f1f46-9c29-49c6-a9e0-3dc740edbae3';

  // Company (fixed query)
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id, name, status, industry, segment, domain, address, agent_count, crm_platform')
    .eq('id', companyId)
    .single();

  console.log('Company:', company?.name, companyErr?.message || 'OK');

  // RI
  const { data: ri, error: riErr } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  console.log('RI:', ri ? 'Found' : 'Not found', riErr?.message || '');

  // Conversations
  const { data: convs, error: convErr } = await supabase
    .from('email_conversations')
    .select('id, subject')
    .eq('company_id', companyId)
    .limit(5);

  console.log('Conversations:', convs?.length || 0, convErr?.message || 'OK');
}

main().catch(console.error);
