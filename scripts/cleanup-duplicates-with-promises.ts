/**
 * Cleanup Duplicate Communications with Promises
 *
 * Finds duplicate communications, re-links any promises to the surviving one,
 * then deletes the duplicates.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeExternalId(externalId: string | null): string | null {
  if (!externalId) return null;
  return externalId
    .replace(/^ms_email_/, '')
    .replace(/^graph_/, '');
}

async function run() {
  console.log('=== Cleanup Duplicate Communications (with Promise Re-linking) ===\n');

  // Get all communications with external_ids
  const { data: allComms, error } = await supabase
    .from('communications')
    .select('id, external_id, source_table, subject, occurred_at, created_at')
    .not('external_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching communications:', error);
    return;
  }

  console.log(`Found ${allComms?.length || 0} communications with external_ids\n`);

  // Group by normalized external_id
  const byNormalizedId = new Map<string, typeof allComms>();

  for (const comm of allComms || []) {
    const normalizedId = normalizeExternalId(comm.external_id);
    if (!normalizedId) continue;

    if (!byNormalizedId.has(normalizedId)) {
      byNormalizedId.set(normalizedId, []);
    }
    byNormalizedId.get(normalizedId)!.push(comm);
  }

  // Find duplicates
  const duplicates: Array<{ normalizedId: string; comms: typeof allComms }> = [];

  for (const [normalizedId, comms] of byNormalizedId.entries()) {
    if (comms && comms.length > 1) {
      duplicates.push({ normalizedId, comms });
    }
  }

  console.log(`Found ${duplicates.length} sets of duplicates\n`);

  if (duplicates.length === 0) {
    console.log('No duplicates to clean up!');
    return;
  }

  let deleted = 0;
  let promisesRelinked = 0;
  let otherRefsRelinked = 0;
  let errors = 0;

  for (const { normalizedId, comms } of duplicates) {
    if (!comms) continue;

    // Sort by created_at - keep the oldest one
    const sorted = comms.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const toKeep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`\nProcessing duplicate set:`);
    console.log(`  KEEP: ${toKeep.source_table} - ${toKeep.subject?.substring(0, 40)} (${toKeep.id})`);

    for (const comm of toDelete) {
      console.log(`  DELETE: ${comm.source_table} - ${comm.subject?.substring(0, 40)} (${comm.id})`);

      // 0. First, handle communication_analysis - this is the key one!
      // The chain is: communication -> communication_analysis -> promises (via source_analysis_id)
      const { data: analyses } = await supabase
        .from('communication_analysis')
        .select('id')
        .eq('communication_id', comm.id);

      if (analyses && analyses.length > 0) {
        // Check if the target communication already has an analysis
        const { data: targetAnalysis } = await supabase
          .from('communication_analysis')
          .select('id')
          .eq('communication_id', toKeep.id)
          .single();

        for (const analysis of analyses) {
          if (targetAnalysis) {
            // Target already has analysis - re-link promises from old analysis to target analysis
            console.log(`    Re-linking promises from analysis ${analysis.id} to ${targetAnalysis.id}...`);
            const { error: promiseAnalysisError } = await supabase
              .from('promises')
              .update({ source_analysis_id: targetAnalysis.id })
              .eq('source_analysis_id', analysis.id);

            if (promiseAnalysisError) {
              console.log(`    Error re-linking promises by analysis: ${promiseAnalysisError.message}`);
            }

            // Clear current_analysis_id on the communication being deleted first
            await supabase
              .from('communications')
              .update({ current_analysis_id: null })
              .eq('id', comm.id);

            // Now delete the old analysis
            const { error: deleteAnalysisError } = await supabase
              .from('communication_analysis')
              .delete()
              .eq('id', analysis.id);

            if (deleteAnalysisError) {
              console.log(`    Error deleting old analysis: ${deleteAnalysisError.message}`);
            }
          } else {
            // Target doesn't have analysis - re-link promises then move the analysis
            console.log(`    Moving analysis ${analysis.id} to target communication...`);

            // First clear current_analysis_id on source comm
            await supabase
              .from('communications')
              .update({ current_analysis_id: null })
              .eq('id', comm.id);

            // Update analysis to point to target
            const { error: analysisUpdateError } = await supabase
              .from('communication_analysis')
              .update({ communication_id: toKeep.id })
              .eq('id', analysis.id);

            if (analysisUpdateError) {
              console.log(`    Error re-linking analysis: ${analysisUpdateError.message}`);

              // If it's a unique constraint, the target must already have an analysis - re-link promises and delete
              if (analysisUpdateError.message.includes('unique constraint') || analysisUpdateError.message.includes('duplicate key')) {
                // Get the target analysis (re-query since it might have been created between our check and now)
                const { data: existingTargetAnalysis } = await supabase
                  .from('communication_analysis')
                  .select('id')
                  .eq('communication_id', toKeep.id)
                  .single();

                if (existingTargetAnalysis) {
                  console.log(`    Re-linking promises from ${analysis.id} to existing target ${existingTargetAnalysis.id}...`);
                  const { error: relinkError } = await supabase
                    .from('promises')
                    .update({ source_analysis_id: existingTargetAnalysis.id })
                    .eq('source_analysis_id', analysis.id);

                  if (relinkError) {
                    console.log(`    Error re-linking promises: ${relinkError.message}`);
                  } else {
                    // Now delete the old analysis
                    const { error: delError } = await supabase
                      .from('communication_analysis')
                      .delete()
                      .eq('id', analysis.id);

                    if (delError) {
                      console.log(`    Error deleting old analysis after re-link: ${delError.message}`);
                    } else {
                      console.log(`    Successfully deleted old analysis ${analysis.id}`);
                    }
                  }
                } else {
                  console.log(`    Could not find target analysis to re-link to`);
                }
              }
            } else {
              // Update target communication to use this analysis
              await supabase
                .from('communications')
                .update({ current_analysis_id: analysis.id })
                .eq('id', toKeep.id);
            }
          }
        }
        otherRefsRelinked += analyses.length;
      }

      // 1. Re-link promises by source_communication_id
      const { data: promises, error: promiseQueryError } = await supabase
        .from('promises')
        .select('id')
        .eq('source_communication_id', comm.id);

      if (promiseQueryError) {
        console.log(`    Error querying promises: ${promiseQueryError.message}`);
        errors++;
        continue;
      }

      if (promises && promises.length > 0) {
        console.log(`    Re-linking ${promises.length} promise(s) by communication_id...`);
        const { error: promiseUpdateError } = await supabase
          .from('promises')
          .update({ source_communication_id: toKeep.id })
          .eq('source_communication_id', comm.id);

        if (promiseUpdateError) {
          console.log(`    Error re-linking promises: ${promiseUpdateError.message}`);
          errors++;
          continue;
        }
        promisesRelinked += promises.length;
      }

      // 2. Re-link communication_notes
      const { data: notes } = await supabase
        .from('communication_notes')
        .select('id')
        .eq('communication_id', comm.id);

      if (notes && notes.length > 0) {
        console.log(`    Re-linking ${notes.length} note(s)...`);
        const { error: notesUpdateError } = await supabase
          .from('communication_notes')
          .update({ communication_id: toKeep.id })
          .eq('communication_id', comm.id);

        if (notesUpdateError) {
          console.log(`    Error re-linking notes: ${notesUpdateError.message}`);
          errors++;
          continue;
        }
        otherRefsRelinked += notes.length;
      }

      // 3. Re-link command_center_items
      const { data: ccItems } = await supabase
        .from('command_center_items')
        .select('id')
        .eq('source_id', comm.id)
        .eq('source_type', 'communication');

      if (ccItems && ccItems.length > 0) {
        console.log(`    Re-linking ${ccItems.length} command center item(s)...`);
        const { error: ccUpdateError } = await supabase
          .from('command_center_items')
          .update({ source_id: toKeep.id })
          .eq('source_id', comm.id)
          .eq('source_type', 'communication');

        if (ccUpdateError) {
          console.log(`    Error re-linking CC items: ${ccUpdateError.message}`);
          errors++;
          continue;
        }
        otherRefsRelinked += ccItems.length;
      }

      // 4. Re-link attention_flags
      const { data: flags } = await supabase
        .from('attention_flags')
        .select('id')
        .eq('source_id', comm.id)
        .eq('source_type', 'communication');

      if (flags && flags.length > 0) {
        console.log(`    Re-linking ${flags.length} attention flag(s)...`);
        const { error: flagsUpdateError } = await supabase
          .from('attention_flags')
          .update({ source_id: toKeep.id })
          .eq('source_id', comm.id)
          .eq('source_type', 'communication');

        if (flagsUpdateError) {
          console.log(`    Error re-linking flags: ${flagsUpdateError.message}`);
          errors++;
          continue;
        }
        otherRefsRelinked += flags.length;
      }

      // 5. Now delete the duplicate
      const { error: deleteError } = await supabase
        .from('communications')
        .delete()
        .eq('id', comm.id);

      if (deleteError) {
        console.log(`    Error deleting: ${deleteError.message}`);
        errors++;
      } else {
        console.log(`    Deleted successfully`);
        deleted++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('=== Summary ===');
  console.log('='.repeat(50));
  console.log(`Duplicate sets processed: ${duplicates.length}`);
  console.log(`Communications deleted: ${deleted}`);
  console.log(`Promises re-linked: ${promisesRelinked}`);
  console.log(`Other references re-linked: ${otherRefsRelinked}`);
  console.log(`Errors: ${errors}`);
}

run().catch(console.error);
