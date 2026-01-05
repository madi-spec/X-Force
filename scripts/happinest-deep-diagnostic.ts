import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  const companyId = '01e64697-251a-4eca-aa63-9a78e810362e'; // Happinest

  console.log('=== DEEP DIAGNOSIS: HAPPINEST RI RECORDS ===\n');

  // Get all RI records with full data
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', companyId);

  console.log(`Found ${riRecords?.length || 0} RI records\n`);

  riRecords?.forEach((ri, i) => {
    console.log(`--- RI RECORD ${i + 1} ---`);
    console.log(`ID: ${ri.id}`);
    console.log(`Contact ID: ${ri.contact_id || 'NULL'}`);
    console.log(`Created: ${ri.created_at}`);
    console.log(`Updated: ${ri.updated_at}`);
    console.log(`\nFull Summary:\n${ri.relationship_summary || 'EMPTY'}\n`);
    console.log(`Key Facts: ${JSON.stringify(ri.context?.key_facts || [], null, 2)}`);
    console.log(`\nInteractions (${ri.interactions?.length || 0}):`);
    ri.interactions?.forEach((int: any) => {
      console.log(`  - ${int.date}: ${int.type} - ${int.summary?.substring(0, 80)}...`);
    });
    console.log(`\nOur Commitments: ${JSON.stringify(ri.open_commitments?.ours || [], null, 2)}`);
    console.log(`Their Commitments: ${JSON.stringify(ri.open_commitments?.theirs || [], null, 2)}`);
    console.log(`\nBuying Signals: ${JSON.stringify(ri.signals?.buying_signals || [], null, 2)}`);
    console.log(`Concerns: ${JSON.stringify(ri.signals?.concerns || [], null, 2)}`);
    console.log('\n' + '='.repeat(60) + '\n');
  });

  // Check transcripts and their analysis
  console.log('=== TRANSCRIPT ANALYSIS ===\n');

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, contact_id, analysis, created_at')
    .eq('company_id', companyId);

  transcripts?.forEach(t => {
    const analysis = t.analysis as any;
    console.log(`Transcript: ${t.title}`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Contact ID: ${t.contact_id || 'NULL'}`);
    console.log(`  Created: ${t.created_at}`);
    if (analysis) {
      console.log(`  Key Points: ${analysis.keyPoints?.length || 0}`);
      console.log(`  Our Commitments: ${analysis.ourCommitments?.length || 0}`);
      analysis.ourCommitments?.forEach((c: any) => {
        console.log(`    - ${c.commitment}`);
      });
      console.log(`  Their Commitments: ${analysis.theirCommitments?.length || 0}`);
      analysis.theirCommitments?.forEach((c: any) => {
        console.log(`    - ${c.commitment}`);
      });
    }
    console.log('');
  });

  // Check what the UI would see
  console.log('=== UI PERSPECTIVE ===\n');

  // The UI typically loads RI for a specific contact
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('company_id', companyId);

  for (const contact of contacts || []) {
    const { data: contactRI } = await supabase
      .from('relationship_intelligence')
      .select('*')
      .eq('company_id', companyId)
      .eq('contact_id', contact.id)
      .single();

    console.log(`Contact: ${contact.name} (${contact.id})`);
    if (contactRI) {
      console.log(`  RI Record: ${contactRI.id}`);
      console.log(`  Summary: ${contactRI.relationship_summary?.substring(0, 100) || 'EMPTY'}...`);
      console.log(`  Interactions: ${contactRI.interactions?.length || 0}`);
    } else {
      console.log(`  RI Record: NONE - will fallback to company-level`);
    }
    console.log('');
  }

  // Company-level RI (no contact)
  const { data: companyRI } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .is('contact_id', null)
    .single();

  console.log('Company-level RI (contact_id = null):');
  if (companyRI) {
    console.log(`  ID: ${companyRI.id}`);
    console.log(`  Summary: ${companyRI.relationship_summary?.substring(0, 200)}...`);
    console.log(`  Interactions: ${companyRI.interactions?.length || 0}`);
    console.log(`\n  KEY FACTS:`);
    (companyRI.context?.key_facts || []).forEach((f: any) => {
      console.log(`    - ${f.fact}`);
    });
  } else {
    console.log('  NONE');
  }
}

diagnose().catch(console.error);
