import { config } from 'dotenv';
config({ path: '.env.local' });
import { createAdminClient } from '../src/lib/supabase/admin';

async function check() {
  const supabase = createAdminClient();

  // Count emails by sent status
  const { data: stats, error } = await supabase
    .from('email_messages')
    .select('is_sent_by_user, outlook_folder_name')
    .limit(1000);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const sent = stats?.filter(e => e.is_sent_by_user).length || 0;
  const received = stats?.filter(e => !e.is_sent_by_user).length || 0;

  console.log('Email counts:');
  console.log('  Sent by user:', sent);
  console.log('  Received:', received);
  console.log('  Total:', stats?.length || 0);

  // Check which folders emails are from
  const folderCounts: Record<string, number> = {};
  stats?.forEach(e => {
    const key = e.outlook_folder_name || 'unknown';
    folderCounts[key] = (folderCounts[key] || 0) + 1;
  });
  console.log('Folders:', folderCounts);

  // Sample a few emails
  const { data: samples } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, to_emails, is_sent_by_user, outlook_folder_name')
    .limit(5);

  console.log('\nSample emails:');
  samples?.forEach((e, i) => {
    console.log(`  ${i+1}. ${e.subject?.substring(0, 50)}...`);
    console.log(`     From: ${e.from_email}, Sent by user: ${e.is_sent_by_user}`);
    console.log(`     Folder: ${e.outlook_folder_name}`);
  });
}

check().catch(console.error);
