import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';

  console.log('=== FIXING HAPPINEST RI DATA ===\n');

  // 1. Get the polluted company-level RI record
  const { data: companyRI } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', happinestId)
    .is('contact_id', null)
    .single();

  if (!companyRI) {
    console.log('No company-level RI found');
    return;
  }

  console.log('Found polluted RI record:', companyRI.id);
  console.log('Current summary (first 100 chars):', companyRI.relationship_summary?.substring(0, 100));

  // 2. Clear the polluted data and reset with clean Happinest data
  // The Lawn Doctor data was extracted incorrectly - we need to rebuild from actual Happinest transcripts

  const cleanRI = {
    context: { key_facts: [] },
    interactions: [],
    open_commitments: { ours: [], theirs: [] },
    signals: { buying_signals: [], concerns: [], objections: [] },
    relationship_summary: 'Relationship with Happinest is in discovery phase. AI meeting analysis pending.',
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('relationship_intelligence')
    .update(cleanRI)
    .eq('id', companyRI.id);

  if (updateError) {
    console.error('Error cleaning RI:', updateError);
    return;
  }

  console.log('\n✅ Cleaned company-level RI (removed Lawn Doctor pollution)\n');

  // 3. Get the actual Happinest transcripts and their REAL analysis
  console.log('=== REBUILDING FROM ACTUAL TRANSCRIPTS ===\n');

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis, company_id, created_at')
    .eq('company_id', happinestId)
    .order('created_at', { ascending: true });

  if (!transcripts || transcripts.length === 0) {
    console.log('No transcripts found for Happinest');
    return;
  }

  console.log(`Found ${transcripts.length} transcripts\n`);

  // Build proper RI from actual analysis (but filter out any Lawn Doctor references)
  const keyFacts: any[] = [];
  const interactions: any[] = [];
  const ourCommitments: any[] = [];
  const theirCommitments: any[] = [];
  const buyingSignals: any[] = [];

  for (const t of transcripts) {
    const analysis = t.analysis as any;
    if (!analysis) continue;

    console.log(`Processing: ${t.title}`);

    // Add interaction record
    const keyPointsArray = (analysis.keyPoints || []).map((p: any) =>
      typeof p === 'string' ? p : p?.point || p?.text || String(p)
    ).filter((p: string) =>
      p && !p.toLowerCase().includes('lawn doctor') &&
      !p.toLowerCase().includes('franchisee')
    );

    interactions.push({
      id: t.id,
      type: 'transcript',
      date: t.created_at,
      summary: analysis.summary || 'Meeting with Happinest team',
      key_points: keyPointsArray,
    });

    // Extract key facts (filter out Lawn Doctor references)
    keyPointsArray.forEach((point: string) => {
      if (!point.toLowerCase().includes('lawn doctor') &&
          !point.toLowerCase().includes('franchis')) {
        keyFacts.push({
          fact: point,
          source: 'transcript',
          source_id: t.id,
          date: t.created_at,
        });
      }
    });

    // Our commitments
    (analysis.ourCommitments || []).forEach((c: any) => {
      if (!c.commitment?.toLowerCase().includes('lawn doctor')) {
        ourCommitments.push({
          commitment: c.commitment,
          made_on: t.created_at,
          due_by: c.deadline,
          source_type: 'transcript',
          source_id: t.id,
          status: 'pending',
        });
      }
    });

    // Their commitments
    (analysis.theirCommitments || []).forEach((c: any) => {
      if (!c.commitment?.toLowerCase().includes('lawn doctor')) {
        theirCommitments.push({
          commitment: c.commitment,
          made_on: t.created_at,
          expected_by: c.deadline,
          source_type: 'transcript',
          source_id: t.id,
          status: 'pending',
        });
      }
    });

    // Buying signals
    (analysis.buyingSignals || []).forEach((s: any) => {
      if (!s.signal?.toLowerCase().includes('lawn doctor')) {
        buyingSignals.push({
          signal: s.signal || s,
          strength: s.strength || 'moderate',
          date: t.created_at,
          source_id: t.id,
        });
      }
    });
  }

  // Dedupe key facts
  const uniqueFacts = keyFacts.filter((f, i, arr) =>
    arr.findIndex(x => x.fact === f.fact) === i
  ).slice(0, 15);

  // Dedupe commitments
  const uniqueOurs = ourCommitments.filter((c, i, arr) =>
    arr.findIndex(x => x.commitment === c.commitment) === i
  );
  const uniqueTheirs = theirCommitments.filter((c, i, arr) =>
    arr.findIndex(x => x.commitment === c.commitment) === i
  );

  console.log(`\nExtracted (filtered, deduplicated):`);
  console.log(`  Key Facts: ${uniqueFacts.length}`);
  console.log(`  Our Commitments: ${uniqueOurs.length}`);
  console.log(`  Their Commitments: ${uniqueTheirs.length}`);
  console.log(`  Buying Signals: ${buyingSignals.length}`);
  console.log(`  Interactions: ${interactions.length}`);

  // Build summary from actual data
  const summary = `Active discovery relationship with Happinest (pest control).
${interactions.length} meetings on record.
${uniqueOurs.length > 0 ? `We committed to: ${uniqueOurs.slice(0, 2).map(c => c.commitment).join('; ')}. ` : ''}
${uniqueTheirs.length > 0 ? `They committed to: ${uniqueTheirs.slice(0, 2).map(c => c.commitment).join('; ')}. ` : ''}
Key discussion points include AI integration, pricing, and implementation approach.`;

  // Update the RI record with clean data
  const { error: rebuildError } = await supabase
    .from('relationship_intelligence')
    .update({
      context: { key_facts: uniqueFacts },
      interactions,
      open_commitments: { ours: uniqueOurs, theirs: uniqueTheirs },
      signals: { buying_signals: buyingSignals, concerns: [], objections: [] },
      relationship_summary: summary.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyRI.id);

  if (rebuildError) {
    console.error('Error rebuilding RI:', rebuildError);
    return;
  }

  console.log('\n✅ Rebuilt company-level RI with clean Happinest data\n');

  // 4. Verify the fix
  console.log('=== VERIFICATION ===\n');

  const { data: verifyRI } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('id', companyRI.id)
    .single();

  if (verifyRI) {
    console.log('Summary:', verifyRI.relationship_summary);
    console.log('\nKey Facts:', (verifyRI.context as any)?.key_facts?.length || 0);
    console.log('Interactions:', verifyRI.interactions?.length || 0);
    console.log('Our Commitments:', (verifyRI.open_commitments as any)?.ours?.length || 0);
    console.log('Their Commitments:', (verifyRI.open_commitments as any)?.theirs?.length || 0);

    // Check for any remaining Lawn Doctor references
    const riString = JSON.stringify(verifyRI).toLowerCase();
    const hasLawnDoctor = riString.includes('lawn doctor');
    console.log('\nContains "Lawn Doctor":', hasLawnDoctor ? '❌ YES (still polluted)' : '✅ NO (clean)');
  }
}

fix().catch(console.error);
