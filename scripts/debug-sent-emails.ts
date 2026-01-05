import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== DEBUG SENT EMAILS ===\n');

  const userId = '11111111-1111-1111-1111-111111111009';

  // Check how many sent emails we have
  const { count: sentCount, error: e1 } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_sent_by_user', true);

  console.log('Sent emails in email_messages:', sentCount, e1?.message || '');

  // Check a sample with external_id format
  const { data: samples, error: e2 } = await supabase
    .from('email_messages')
    .select('id, external_id, subject, is_sent_by_user, analysis_complete')
    .eq('user_id', userId)
    .eq('is_sent_by_user', true)
    .limit(5);

  console.log('\nSample sent emails:');
  samples?.forEach((s, i) => {
    console.log(`${i + 1}. ${s.subject?.substring(0, 50)}`);
    console.log(`   external_id: ${s.external_id}`);
    console.log(`   analysis_complete: ${s.analysis_complete}`);
  });

  // Check how many need processing
  const { count: unprocessedCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_sent_by_user', true)
    .or('analysis_complete.is.null,analysis_complete.eq.false');

  console.log('\nUnprocessed sent emails:', unprocessedCount);

  // Check activities table for sent emails
  const { count: activitySentCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'email_sent');

  console.log('\nSent emails in activities table:', activitySentCount);

  // Sample activities
  const { data: actSamples } = await supabase
    .from('activities')
    .select('id, external_id, subject')
    .eq('user_id', userId)
    .eq('type', 'email_sent')
    .limit(3);

  console.log('\nSample activity sent emails:');
  actSamples?.forEach((s, i) => {
    console.log(`${i + 1}. ${s.subject?.substring(0, 50)}`);
    console.log(`   external_id: ${s.external_id}`);
  });
}

main().catch(console.error);
