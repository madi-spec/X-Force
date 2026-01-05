import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check all RI records with their company_id
  console.log('=== All Relationship Intelligence Records ===');
  const { data: allRI, error: riErr } = await supabase
    .from('relationship_intelligence')
    .select('id, company_id, contact_id, relationship_summary')
    .limit(20);

  if (riErr) {
    console.log('RI Error:', riErr.message);
  } else {
    console.log('Total RI records:', allRI?.length);
    for (const r of allRI || []) {
      console.log(`  - company: ${r.company_id}, contact: ${r.contact_id}, summary: ${r.relationship_summary ? 'Yes' : 'No'}`);
    }
  }

  // Check if dc2f company has RI
  const testId = 'dc2f1f46-9c29-49c6-a9e0-3dc740edbae3';
  const { data: testRI } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', testId);

  console.log('\n=== RI for Debug Pest Control ===');
  console.log('Records found:', testRI?.length || 0);

  // Check if companies in RI actually exist
  console.log('\n=== Validating RI company_ids ===');
  const companyIds = [...new Set((allRI || []).map(r => r.company_id).filter(Boolean))];
  for (const cid of companyIds.slice(0, 5)) {
    const { data: comp } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', cid)
      .single();
    console.log(`  ${cid}: ${comp?.name || 'NOT FOUND'}`);
  }

  // Now check the API-requested companies
  console.log('\n=== Companies from 404 logs ===');
  const failedIds = [
    'dc2f1f46-9c29-49c6-a9e0-3dc740edbae3',
    '01e64697-251a-4eca-aa63-9a78e810362e',
    '91229231-67d4-4d0a-9679-8552cc7fd1ed'
  ];
  for (const fid of failedIds) {
    const { data: c, error: e } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', fid)
      .single();

    const { data: ri } = await supabase
      .from('relationship_intelligence')
      .select('id')
      .eq('company_id', fid);

    console.log(`  ${fid.slice(0, 8)}: company=${c?.name || 'NOT FOUND'}, RI records=${ri?.length || 0}`);
  }
}

main().catch(console.error);
