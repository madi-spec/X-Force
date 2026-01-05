import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { updateRelationshipIntelligence } from '../src/lib/intelligence/contextFirstPipeline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reprocess() {
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';

  console.log('=== REPROCESSING HAPPINEST TRANSCRIPTS ===\n');

  // Get Happinest contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('company_id', happinestId);

  console.log('Contacts:', contacts?.map(c => `${c.name} (${c.id})`).join(', '));

  // Get primary contact (use first one if available)
  const primaryContactId = contacts?.[0]?.id;
  console.log('Primary contact for RI:', primaryContactId || 'NONE');

  // Get all Happinest transcripts with analysis
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis, created_at')
    .eq('company_id', happinestId)
    .not('analysis', 'is', null)
    .order('created_at', { ascending: true });

  if (!transcripts || transcripts.length === 0) {
    console.log('No transcripts found for Happinest');
    return;
  }

  console.log(`\nFound ${transcripts.length} transcripts to process\n`);

  for (const t of transcripts) {
    const analysis = t.analysis as any;
    if (!analysis) continue;

    console.log(`Processing: ${t.title}`);
    console.log(`  ID: ${t.id}`);

    // Filter out Lawn Doctor references from the analysis
    const keyFacts = (analysis.keyPoints || [])
      .map((p: any) => typeof p === 'string' ? p : p?.point || String(p))
      .filter((f: string) => !f.toLowerCase().includes('lawn doctor'));

    const buyingSignals = (analysis.buyingSignals || [])
      .filter((s: any) => !(s.signal || '').toLowerCase().includes('lawn doctor'));

    const objections = (analysis.objections || [])
      .filter((o: any) => !(o.objection || '').toLowerCase().includes('lawn doctor'));

    const ourCommitments = (analysis.ourCommitments || [])
      .filter((c: any) => !(c.commitment || '').toLowerCase().includes('lawn doctor'));

    const theirCommitments = (analysis.theirCommitments || [])
      .filter((c: any) => !(c.commitment || '').toLowerCase().includes('lawn doctor'));

    console.log(`  Key facts: ${keyFacts.length}`);
    console.log(`  Buying signals: ${buyingSignals.length}`);
    console.log(`  Our commitments: ${ourCommitments.length}`);
    console.log(`  Their commitments: ${theirCommitments.length}`);

    if (!primaryContactId) {
      console.log('  SKIPPING RI update - no contact linked');
      continue;
    }

    try {
      await updateRelationshipIntelligence({
        companyId: happinestId,
        contactId: primaryContactId,
        communicationId: t.id,
        communicationType: 'transcript',
        analysis: {
          key_facts_learned: keyFacts.map((f: string) => ({
            fact: f,
            confidence: 0.8,
          })),
          buying_signals: buyingSignals.map((s: any) => ({
            signal: s.signal || (typeof s === 'string' ? s : String(s)),
            strength: s.strength || 'moderate',
          })),
          concerns_raised: objections.map((o: any) => ({
            concern: o.objection || (typeof o === 'string' ? o : String(o)),
            severity: (o.resolved ? 'low' : 'medium') as 'high' | 'medium' | 'low',
          })),
          commitment_updates: {
            new_ours: ourCommitments.map((c: any) => ({
              commitment: c.commitment,
              due_by: c.when,
            })),
            new_theirs: theirCommitments.map((c: any) => ({
              commitment: c.commitment,
              expected_by: c.when,
            })),
            completed: [],
          },
          relationship_summary_update: analysis.summary || `Meeting: ${t.title}`,
          should_create_deal: false,
          communication_type: 'general',
          suggested_actions: [],
        },
      });
      console.log('  ✅ RI updated');
    } catch (error) {
      console.error('  ❌ Error:', error);
    }
  }

  // Verify the results
  console.log('\n=== VERIFICATION ===\n');

  // Get the RI record for the primary contact
  if (primaryContactId) {
    const { data: contactRI } = await supabase
      .from('relationship_intelligence')
      .select('*')
      .eq('company_id', happinestId)
      .eq('contact_id', primaryContactId)
      .single();

    if (contactRI) {
      console.log('Contact-level RI (Ramzey Prentiss):');
      console.log('  Summary:', contactRI.relationship_summary?.substring(0, 150) + '...');
      console.log('  Key Facts:', (contactRI.context as any)?.key_facts?.length || 0);
      console.log('  Interactions:', contactRI.interactions?.length || 0);
      console.log('  Our Commitments:', (contactRI.open_commitments as any)?.ours?.length || 0);
      console.log('  Their Commitments:', (contactRI.open_commitments as any)?.theirs?.length || 0);
      console.log('  Buying Signals:', (contactRI.signals as any)?.buying_signals?.length || 0);

      // Check for Lawn Doctor pollution
      const riJson = JSON.stringify(contactRI).toLowerCase();
      console.log('  Contains "Lawn Doctor":', riJson.includes('lawn doctor') ? '❌ YES' : '✅ NO');
    } else {
      console.log('No contact-level RI found - checking company-level...');
    }
  }

  // Also check company-level RI
  const { data: companyRI } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', happinestId)
    .is('contact_id', null)
    .single();

  if (companyRI) {
    console.log('\nCompany-level RI:');
    console.log('  Summary:', companyRI.relationship_summary?.substring(0, 150) + '...');
    console.log('  Key Facts:', (companyRI.context as any)?.key_facts?.length || 0);
    console.log('  Interactions:', companyRI.interactions?.length || 0);
  }
}

reprocess().catch(console.error);
