import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';

  console.log('=== FINAL HAPPINEST RI STATE ===\n');

  // Get all RI records
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', happinestId);

  console.log(`Total RI records: ${riRecords?.length || 0}\n`);

  for (const ri of riRecords || []) {
    const context = ri.context as any || {};
    const commitments = ri.open_commitments as any || { ours: [], theirs: [] };
    const signals = ri.signals as any || {};

    // Get contact name if linked
    let contactName = 'Company-level (no contact)';
    if (ri.contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name')
        .eq('id', ri.contact_id)
        .single();
      contactName = contact?.name || ri.contact_id;
    }

    console.log(`--- ${contactName} ---`);
    console.log(`Summary: ${ri.relationship_summary?.substring(0, 120)}...`);
    console.log(`Key Facts: ${context.key_facts?.length || 0}`);
    console.log(`Interactions: ${ri.interactions?.length || 0}`);
    console.log(`Our Commitments: ${commitments.ours?.length || 0}`);
    console.log(`Their Commitments: ${commitments.theirs?.length || 0}`);
    console.log(`Buying Signals: ${signals.buying_signals?.length || 0}`);
    console.log(`Concerns: ${signals.concerns?.length || 0}`);

    // Check for pollution
    const riJson = JSON.stringify(ri).toLowerCase();
    console.log(`Contains "Lawn Doctor": ${riJson.includes('lawn doctor') ? '❌' : '✅'}`);
    console.log('');
  }

  // Show sample commitments and signals
  const { data: primaryRI } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', happinestId)
    .eq('contact_id', '1840e081-6344-40e2-ac0d-b4d732f2a659')
    .single();

  if (primaryRI) {
    const commitments = primaryRI.open_commitments as any;
    const signals = primaryRI.signals as any;

    console.log('=== SAMPLE COMMITMENTS ===');
    console.log('\nOUR Commitments:');
    (commitments?.ours || []).slice(0, 5).forEach((c: any, i: number) => {
      console.log(`  ${i + 1}. ${c.commitment}${c.due_by ? ` (due: ${c.due_by})` : ''}`);
    });

    console.log('\nTHEIR Commitments:');
    (commitments?.theirs || []).slice(0, 5).forEach((c: any, i: number) => {
      console.log(`  ${i + 1}. ${c.commitment}${c.expected_by ? ` (by: ${c.expected_by})` : ''}`);
    });

    console.log('\n=== BUYING SIGNALS ===');
    (signals?.buying_signals || []).slice(0, 5).forEach((s: any, i: number) => {
      console.log(`  ${i + 1}. [${s.strength || 'moderate'}] ${s.signal}`);
    });
  }
}

verify().catch(console.error);
