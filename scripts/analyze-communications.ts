import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0] || '10');

  console.log(`Analyzing up to ${limit} communications...\n`);

  // Get pending
  const { data: pending, error } = await supabase
    .from('communications')
    .select('id, channel, subject')
    .eq('analysis_status', 'pending')
    .limit(limit);

  if (error) {
    console.error('Error fetching pending:', error);
    return;
  }

  console.log(`Found ${pending?.length || 0} pending communications\n`);

  // Trigger analysis via API
  const response = await fetch('http://localhost:3000/api/communications/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch: true, limit }),
  });

  const result = await response.json();
  console.log('Analysis result:', result);

  // Show results
  console.log('\n=== Analysis Complete ===');

  const { data: analyses } = await supabase
    .from('communication_analysis')
    .select('communication_id, summary, communication_type, potential_triggers, extracted_commitments_us, extracted_commitments_them')
    .eq('is_current', true)
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  for (const a of analyses || []) {
    console.log(`\n--- ${a.communication_id} ---`);
    console.log(`Type: ${a.communication_type}`);
    console.log(`Summary: ${a.summary}`);
    console.log(`Triggers: ${(a.potential_triggers as string[])?.join(', ') || 'none'}`);
    console.log(`Our commitments: ${(a.extracted_commitments_us as unknown[])?.length || 0}`);
    console.log(`Their commitments: ${(a.extracted_commitments_them as unknown[])?.length || 0}`);
  }

  // Show promises
  const { data: promises } = await supabase
    .from('promises')
    .select('direction, promise_text, due_by, confidence')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== Recent Promises ===');
  for (const p of promises || []) {
    console.log(`[${p.direction}] ${p.promise_text} (conf: ${p.confidence}, due: ${p.due_by || 'no date'})`);
  }
}

main().catch(console.error);
