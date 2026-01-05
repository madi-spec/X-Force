import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('=== Fixing Ivey Exterminating Duplicates ===\n');

  const companyId = '18b71dd9-2b71-4308-adfe-5d0a94b2e087';

  // Get all communications for Ivey
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, direction, occurred_at, awaiting_our_response, source_id, external_id')
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false });

  console.log('All Ivey communications:');
  comms?.forEach(c => {
    console.log(`${c.direction}: ${c.subject?.substring(0, 40)}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Source ID: ${c.source_id}`);
    console.log(`  External ID: ${c.external_id?.substring(0, 50)}`);
    console.log(`  Awaiting: ${c.awaiting_our_response}`);
    console.log('');
  });

  // The duplicate FW emails - check their source_ids
  const duplicateIds = [
    'c1d4eea9-2ed5-4de3-b1b0-c9fee5b3cd73',
    'd18380f1-9c7d-4887-be72-a6c58c22ebac',
  ];

  console.log('\n=== Checking duplicates ===\n');

  const { data: dupes } = await supabase
    .from('communications')
    .select('*')
    .in('id', duplicateIds);

  dupes?.forEach(d => {
    console.log(`ID: ${d.id}`);
    console.log(`  Subject: ${d.subject}`);
    console.log(`  Source Table: ${d.source_table}`);
    console.log(`  Source ID: ${d.source_id}`);
    console.log(`  External ID: ${d.external_id}`);
    console.log(`  Thread ID: ${d.thread_id}`);
    console.log('');
  });

  // Check if they have the same source_id (true duplicate) or different
  const sourceIds = dupes?.map(d => d.source_id) || [];
  const uniqueSourceIds = [...new Set(sourceIds)];

  if (uniqueSourceIds.length === 1) {
    console.log('These are TRUE DUPLICATES with the same source_id!');
    console.log('Deleting one of them...');

    // Delete the second one
    const { error } = await supabase
      .from('communications')
      .delete()
      .eq('id', duplicateIds[1]);

    if (error) {
      console.log('Error deleting:', error.message);
    } else {
      console.log(`Deleted duplicate: ${duplicateIds[1]}`);
    }
  } else {
    console.log('These have DIFFERENT source_ids - might be different emails forwarded twice');
    console.log('Source IDs:', uniqueSourceIds);

    // Since you responded on Dec 30 with "Your xrai data is ready", mark these as responded
    console.log('\nMarking both as responded since you sent a reply on Dec 30...');

    const respondedAt = '2025-12-30T00:24:21+00:00';

    const { error } = await supabase
      .from('communications')
      .update({
        awaiting_our_response: false,
        responded_at: respondedAt,
      })
      .in('id', duplicateIds);

    if (error) {
      console.log('Error updating:', error.message);
    } else {
      console.log('Marked both as responded');
    }
  }

  // Verify final state
  console.log('\n=== Final State ===\n');

  const { data: final } = await supabase
    .from('communications')
    .select('id, subject, direction, awaiting_our_response, responded_at')
    .eq('company_id', companyId)
    .eq('awaiting_our_response', true);

  if (final?.length) {
    console.log('Still awaiting response:');
    final.forEach(f => console.log(`  - ${f.subject}`));
  } else {
    console.log('No items awaiting response for Ivey Exterminating');
  }
}

run().catch(console.error);
