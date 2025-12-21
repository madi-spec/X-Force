import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const supabase = createAdminClient();

  // Find emails with more content
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, body_preview, is_sent_by_user, analysis_complete')
    .eq('is_sent_by_user', true)
    .eq('analysis_complete', false)
    .order('sent_at', { ascending: false })
    .limit(20);

  console.log('Emails with content:');
  let count = 0;
  emails?.forEach((e, i) => {
    const preview = (e.body_preview || '').substring(0, 100);
    if (preview.length > 10) {
      count++;
      console.log(`${count}. ${e.subject}`);
      console.log(`   Preview: ${preview}...`);
      console.log(`   ID: ${e.id}`);
      console.log('');
    }
  });
}
main().catch(console.error);
