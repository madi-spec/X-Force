/**
 * Cleanup Duplicate Communications
 *
 * Finds and removes duplicate communications that were synced from multiple sources
 * (e.g., both microsoft_graph and email_messages with the same external_id)
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
  console.log('=== Cleanup Duplicate Communications ===\n');

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

  // Find duplicates (more than one communication with same normalized external_id)
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
  let kept = 0;

  for (const { normalizedId, comms } of duplicates) {
    if (!comms) continue;

    console.log(`\nDuplicate set (normalized: ${normalizedId.substring(0, 40)}...):`);

    // Sort by created_at - keep the oldest one
    const sorted = comms.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const toKeep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`  KEEP: ${toKeep.source_table} - ${toKeep.subject?.substring(0, 40)} (${toKeep.id})`);

    for (const comm of toDelete) {
      console.log(`  DELETE: ${comm.source_table} - ${comm.subject?.substring(0, 40)} (${comm.id})`);

      const { error: deleteError } = await supabase
        .from('communications')
        .delete()
        .eq('id', comm.id);

      if (deleteError) {
        console.log(`    Error deleting: ${deleteError.message}`);
      } else {
        deleted++;
      }
    }
    kept++;
  }

  console.log('\n=== Summary ===');
  console.log(`Duplicate sets processed: ${duplicates.length}`);
  console.log(`Communications kept: ${kept}`);
  console.log(`Communications deleted: ${deleted}`);
}

run().catch(console.error);
