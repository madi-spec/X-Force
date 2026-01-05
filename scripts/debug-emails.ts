import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  // Check what we're querying
  console.log('Query 1: analysis_complete = true');
  const { data: q1, error: e1 } = await supabase
    .from('email_messages')
    .select('id, subject, analysis_complete')
    .eq('analysis_complete', true)
    .limit(5);
  console.log(`  Result: ${q1?.length} rows`, e1 || '');
  console.log('  Sample:', q1?.[0]);

  console.log('\nQuery 2: analysis_complete = true AND ai_analysis not null');
  const { data: q2, error: e2 } = await supabase
    .from('email_messages')
    .select('id, subject, ai_analysis')
    .eq('analysis_complete', true)
    .not('ai_analysis', 'is', null)
    .limit(5);
  console.log(`  Result: ${q2?.length} rows`, e2 || '');
  console.log('  Sample:', q2?.[0]);

  console.log('\nQuery 3: just check ai_analysis not null');
  const { data: q3, error: e3 } = await supabase
    .from('email_messages')
    .select('id, subject')
    .not('ai_analysis', 'is', null)
    .limit(5);
  console.log(`  Result: ${q3?.length} rows`, e3 || '');
  console.log('  Sample:', q3?.[0]);

  console.log('\nQuery 4: all emails with ai_analysis');
  const { count } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .not('ai_analysis', 'is', null);
  console.log(`  Total with ai_analysis: ${count}`);
}

main().catch(console.error);
