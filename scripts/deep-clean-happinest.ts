import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function containsLawnDoctor(text: string): boolean {
  const lower = text?.toLowerCase() || '';
  return lower.includes('lawn doctor') || lower.includes('lawndoctor');
}

function filterLawnDoctor(arr: any[], textField: string): any[] {
  return arr.filter(item => !containsLawnDoctor(item[textField] || ''));
}

async function deepClean() {
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';

  console.log('=== DEEP CLEAN: REMOVING ALL LAWN DOCTOR REFERENCES ===\n');

  // Get the RI record
  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', happinestId)
    .is('contact_id', null)
    .single();

  if (!ri) {
    console.log('No RI found');
    return;
  }

  // Find the Lawn Doctor references
  const riJson = JSON.stringify(ri).toLowerCase();
  const ldIndex = riJson.indexOf('lawn doctor');
  if (ldIndex > -1) {
    console.log('Found "Lawn Doctor" at index:', ldIndex);
    console.log('Context:', riJson.substring(Math.max(0, ldIndex - 50), ldIndex + 100));
  }

  // Clean each field
  const context = ri.context as any || {};
  const keyFacts = filterLawnDoctor(context.key_facts || [], 'fact');

  const interactions = (ri.interactions || []).map((i: any) => ({
    ...i,
    summary: containsLawnDoctor(i.summary) ? 'Meeting with Happinest team' : i.summary,
    key_points: (i.key_points || []).filter((p: string) => !containsLawnDoctor(p)),
  }));

  const openCommitments = ri.open_commitments as any || { ours: [], theirs: [] };
  const oursClean = filterLawnDoctor(openCommitments.ours || [], 'commitment');
  const theirsClean = filterLawnDoctor(openCommitments.theirs || [], 'commitment');

  const signals = ri.signals as any || { buying_signals: [], concerns: [], objections: [] };
  const buyingSignalsClean = filterLawnDoctor(signals.buying_signals || [], 'signal');
  const concernsClean = filterLawnDoctor(signals.concerns || [], 'concern');

  // Check summary
  let summary = ri.relationship_summary || '';
  if (containsLawnDoctor(summary)) {
    summary = 'Active discovery relationship with Happinest (pest control). Multiple meetings on record. Discussing AI integration and pricing.';
  }

  console.log('\nCleaned data:');
  console.log('  Key Facts:', keyFacts.length);
  console.log('  Interactions:', interactions.length);
  console.log('  Our Commitments:', oursClean.length);
  console.log('  Their Commitments:', theirsClean.length);
  console.log('  Buying Signals:', buyingSignalsClean.length);
  console.log('  Concerns:', concernsClean.length);

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

  console.log('\n✅ Deep clean complete');

  // Verify
  const { data: verify } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('id', ri.id)
    .single();

  const verifyJson = JSON.stringify(verify).toLowerCase();
  console.log('\nContains "Lawn Doctor":', verifyJson.includes('lawn doctor') ? '❌ STILL THERE' : '✅ CLEAN');

  if (verifyJson.includes('lawn doctor')) {
    const idx = verifyJson.indexOf('lawn doctor');
    console.log('Remaining context:', verifyJson.substring(Math.max(0, idx - 100), idx + 100));
  }

  console.log('\n=== FINAL STATE ===');
  console.log('Summary:', verify?.relationship_summary);
}

deepClean().catch(console.error);
