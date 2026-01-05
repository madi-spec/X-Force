import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Find companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .or('name.ilike.%ivey%,name.ilike.%lawn doctor%tx%')
    .limit(5);

  console.log('Companies found:');
  companies?.forEach(c => console.log(`  ${c.name} (${c.id})`));

  for (const company of companies || []) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ${company.name} ===`);
    console.log(`${'='.repeat(60)}\n`);

    const { data: comms } = await supabase
      .from('communications')
      .select('id, subject, direction, awaiting_our_response, responded_at, occurred_at, thread_id')
      .eq('company_id', company.id)
      .order('occurred_at', { ascending: false })
      .limit(10);

    comms?.forEach(c => {
      const status = c.awaiting_our_response ? '⚠️ NEEDS RESPONSE' : '✓';
      console.log(`${c.direction.toUpperCase()} ${status}: ${(c.subject || '').substring(0, 50)}`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Responded: ${c.responded_at || 'NULL'}`);
      console.log(`  Occurred: ${c.occurred_at}`);
      console.log(`  Thread: ${c.thread_id || 'NULL'}`);
      console.log('');
    });

    // Check for duplicates in same thread
    const threadCounts = new Map<string, number>();
    comms?.forEach(c => {
      if (c.thread_id && c.awaiting_our_response) {
        threadCounts.set(c.thread_id, (threadCounts.get(c.thread_id) || 0) + 1);
      }
    });

    const duplicateThreads = Array.from(threadCounts.entries()).filter(([, count]) => count > 1);
    if (duplicateThreads.length > 0) {
      console.log('⚠️ DUPLICATE AWAITING RESPONSE IN SAME THREAD:');
      duplicateThreads.forEach(([threadId, count]) => {
        console.log(`  Thread ${threadId}: ${count} items awaiting response`);
      });
    }
  }

  // Also check what's currently in Action Now
  console.log(`\n${'='.repeat(60)}`);
  console.log('=== ALL ITEMS CURRENTLY AWAITING RESPONSE ===');
  console.log(`${'='.repeat(60)}\n`);

  const { data: allAwaiting } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      direction,
      occurred_at,
      thread_id,
      company:companies(name)
    `)
    .eq('awaiting_our_response', true)
    .order('occurred_at', { ascending: false })
    .limit(20);

  allAwaiting?.forEach(c => {
    const companyName = (c.company as any)?.name || 'Unknown';
    console.log(`${companyName}: ${(c.subject || '').substring(0, 40)}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Occurred: ${c.occurred_at}`);
    console.log(`  Thread: ${c.thread_id || 'NULL'}`);
    console.log('');
  });
}

run().catch(console.error);
