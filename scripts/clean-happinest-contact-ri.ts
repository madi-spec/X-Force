import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function containsLawnDoctor(text: string): boolean {
  const lower = text?.toLowerCase() || '';
  return lower.includes('lawn doctor') || lower.includes('lawndoctor');
}

async function clean() {
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';
  const contactId = '1840e081-6344-40e2-ac0d-b4d732f2a659'; // Ramzey Prentiss

  console.log('=== CLEANING CONTACT-LEVEL RI ===\n');

  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', happinestId)
    .eq('contact_id', contactId)
    .single();

  if (!ri) {
    console.log('No RI found');
    return;
  }

  console.log('Current state:');
  console.log('  Summary:', ri.relationship_summary?.substring(0, 100) + '...');

  // Clean each field
  const context = ri.context as any || {};
  const keyFacts = (context.key_facts || []).filter((f: any) => !containsLawnDoctor(f.fact || ''));

  const interactions = (ri.interactions || []).map((i: any) => ({
    ...i,
    summary: containsLawnDoctor(i.summary) ? `Meeting with Happinest team - ${i.date}` : i.summary,
    key_points: (i.key_points || []).filter((p: string) => !containsLawnDoctor(p)),
  }));

  const openCommitments = ri.open_commitments as any || { ours: [], theirs: [] };
  const oursClean = (openCommitments.ours || []).filter((c: any) => !containsLawnDoctor(c.commitment || ''));
  const theirsClean = (openCommitments.theirs || []).filter((c: any) => !containsLawnDoctor(c.commitment || ''));

  const signals = ri.signals as any || { buying_signals: [], concerns: [], objections: [] };
  const buyingSignalsClean = (signals.buying_signals || []).filter((s: any) => !containsLawnDoctor(s.signal || ''));
  const concernsClean = (signals.concerns || []).filter((c: any) => !containsLawnDoctor(c.concern || ''));

  // Build clean summary
  const summary = `Active sales engagement with Ramzey Prentiss at Happinest. ${interactions.length} meetings on record. Discussing AI call handling solution and integration approach. Key topics include pricing structure, pilot program, and implementation timeline.`;

  console.log('\nCleaned data:');
  console.log('  Key Facts:', keyFacts.length);
  console.log('  Interactions:', interactions.length);
  console.log('  Our Commitments:', oursClean.length);
  console.log('  Their Commitments:', theirsClean.length);
  console.log('  Buying Signals:', buyingSignalsClean.length);

  // Update
  const { error } = await supabase
    .from('relationship_intelligence')
    .update({
      context: { key_facts: keyFacts },
      interactions,
      open_commitments: { ours: oursClean, theirs: theirsClean },
      signals: { buying_signals: buyingSignalsClean, concerns: concernsClean, objections: [] },
      relationship_summary: summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ri.id);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n✅ Cleaned contact-level RI');

  // Verify
  const { data: verify } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('id', ri.id)
    .single();

  const verifyJson = JSON.stringify(verify).toLowerCase();
  console.log('\nContains "Lawn Doctor":', verifyJson.includes('lawn doctor') ? '❌ STILL THERE' : '✅ CLEAN');
  console.log('\nFinal Summary:', verify?.relationship_summary);

  // Show some sample data
  console.log('\n=== SAMPLE DATA ===');
  console.log('Key Facts (first 3):');
  ((verify?.context as any)?.key_facts || []).slice(0, 3).forEach((f: any) => {
    console.log(`  - ${f.fact}`);
  });

  console.log('\nOur Commitments (first 3):');
  ((verify?.open_commitments as any)?.ours || []).slice(0, 3).forEach((c: any) => {
    console.log(`  - ${c.commitment}`);
  });

  console.log('\nBuying Signals (first 3):');
  ((verify?.signals as any)?.buying_signals || []).slice(0, 3).forEach((s: any) => {
    console.log(`  - ${s.signal}`);
  });
}

clean().catch(console.error);
