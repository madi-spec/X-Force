import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Fetching RI samples...\n');

  const { data, error } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .not('signals', 'is', null)
    .limit(3);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No RI data found');
    return;
  }

  for (let i = 0; i < data.length; i++) {
    const ri = data[i];
    const interactions = ri.interactions || [];
    const signals = ri.signals || {};
    const commitments = ri.open_commitments || {};

    console.log(`\n=== RI Record ${i + 1} ===`);
    console.log(`Strength: ${ri.relationship_strength}`);
    console.log(`Interactions: ${interactions.length}`);

    // Buying signals
    const buyingSignals = signals.buying_signals || [];
    console.log(`\nBuying Signals (${buyingSignals.length}):`);
    buyingSignals.slice(0, 3).forEach((s: any) => {
      console.log(`  - ${s.signal} (${s.strength})`);
    });

    // Concerns
    const concerns = signals.concerns || [];
    console.log(`\nConcerns (${concerns.length}):`);
    concerns.slice(0, 2).forEach((c: any) => {
      console.log(`  - ${c.concern}`);
    });

    // Our commitments
    const ourCommits = commitments.ours || [];
    console.log(`\nOur Commitments (${ourCommits.length}):`);
    ourCommits.slice(0, 2).forEach((c: any) => {
      console.log(`  - ${c.commitment}`);
      console.log(`    Status: ${c.status}, Due: ${c.due_by || 'N/A'}`);
    });
  }
}

main().catch(console.error);
