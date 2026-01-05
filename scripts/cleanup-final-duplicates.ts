/**
 * Final Cleanup - Handle the 12 remaining duplicates with complex analysis relationships
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The remaining 12 duplicate pairs
const duplicatePairs = [
  { keep: '8792cc90-6c3c-4003-ab34-7557262496bc', delete: '954af6d6-a443-45a0-b69b-f91db96a3222' },
  { keep: '8ef894b6-bcca-4b26-b742-5071f64bf54a', delete: '4757cf0c-4901-4cff-bf71-94f2a05495d1' },
  { keep: 'a706d10a-c75c-4bb9-902c-1ef6624a943b', delete: '709848c3-47d1-4cb3-bb9b-e0dbda536cd4' },
  { keep: '7ca9fa12-5114-4dd5-ac02-9cc948719f12', delete: '172014a1-04fe-4b1c-a1e5-94894606fc4a' },
  { keep: '3667a321-727b-45c5-8d3e-d508bf152614', delete: 'ba57945e-1550-4f14-8b05-634af975d363' },
  { keep: 'd49363dc-4ff6-421d-af78-c4b4f0ab2168', delete: 'd1533d8a-bb3b-4902-96f4-b5b212214e90' },
  { keep: 'f23289fb-7084-481f-a8b2-434e13630829', delete: '0a4db654-dd88-44ea-a4c2-61481eb8fd1f' },
  { keep: '0f43f864-7978-4dbe-86a9-029f7c9a5d15', delete: '57dc6da8-4647-4457-90c6-ad5502429e57' },
  { keep: 'e21ac6fc-a1ae-4ccf-a1dd-fb47135031bb', delete: 'fea804d1-5838-44e1-8b62-8ce235f9a246' },
  { keep: 'eeba9402-69e5-470b-875f-eb5214d816ac', delete: '7c131dd4-9ea4-400c-9a7e-c9f3592f6586' },
  { keep: '0eee5465-1c75-4085-8cfa-da6010e8cd2c', delete: '25ac720f-d63d-4350-b9e5-431ee1bbb9dc' },
  { keep: '1989227f-d90f-4479-82fa-06198718a02b', delete: 'd8d3aebc-25ef-48f6-b259-34069865b04d' },
];

async function run() {
  console.log('=== Final Cleanup of 12 Remaining Duplicates ===\n');

  let deleted = 0;
  let errors = 0;

  for (const pair of duplicatePairs) {
    console.log(`\nProcessing: keep ${pair.keep.substring(0, 8)}..., delete ${pair.delete.substring(0, 8)}...`);

    // 1. Get ALL analyses for the communication to delete
    const { data: deleteAnalyses } = await supabase
      .from('communication_analysis')
      .select('id')
      .eq('communication_id', pair.delete);

    // 2. Get ALL analyses for the communication to keep
    const { data: keepAnalyses } = await supabase
      .from('communication_analysis')
      .select('id')
      .eq('communication_id', pair.keep)
      .order('created_at', { ascending: false })
      .limit(1);

    const targetAnalysisId = keepAnalyses?.[0]?.id;

    if (deleteAnalyses && deleteAnalyses.length > 0) {
      console.log(`  Found ${deleteAnalyses.length} analysis to clean up`);

      for (const analysis of deleteAnalyses) {
        // Re-link promises from delete analysis to keep analysis
        if (targetAnalysisId) {
          console.log(`  Re-linking promises from ${analysis.id} to ${targetAnalysisId}`);
          const { error: promiseError } = await supabase
            .from('promises')
            .update({ source_analysis_id: targetAnalysisId })
            .eq('source_analysis_id', analysis.id);

          if (promiseError) {
            console.log(`  Promise re-link error: ${promiseError.message}`);
          }
        } else {
          // No target analysis - just nullify the source_analysis_id
          console.log(`  No target analysis - nullifying promises source_analysis_id`);
          const { error: promiseError } = await supabase
            .from('promises')
            .update({ source_analysis_id: null })
            .eq('source_analysis_id', analysis.id);

          if (promiseError) {
            console.log(`  Promise nullify error: ${promiseError.message}`);
          }
        }

        // Now clear current_analysis_id from the communication being deleted
        await supabase
          .from('communications')
          .update({ current_analysis_id: null })
          .eq('id', pair.delete);

        // Delete the analysis
        const { error: analysisDeleteError } = await supabase
          .from('communication_analysis')
          .delete()
          .eq('id', analysis.id);

        if (analysisDeleteError) {
          console.log(`  Analysis delete error: ${analysisDeleteError.message}`);
        } else {
          console.log(`  Deleted analysis ${analysis.id}`);
        }
      }
    }

    // 3. Re-link promises by communication_id
    if (targetAnalysisId) {
      // First update promises that reference the deleted communication directly
      await supabase
        .from('promises')
        .update({ source_communication_id: pair.keep })
        .eq('source_communication_id', pair.delete);
    }

    // 4. Now delete the communication
    const { error: deleteError } = await supabase
      .from('communications')
      .delete()
      .eq('id', pair.delete);

    if (deleteError) {
      console.log(`  Delete communication error: ${deleteError.message}`);
      errors++;
    } else {
      console.log(`  Successfully deleted communication ${pair.delete}`);
      deleted++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Deleted: ${deleted}`);
  console.log(`Errors: ${errors}`);
}

run().catch(console.error);
