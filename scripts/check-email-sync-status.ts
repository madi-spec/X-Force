import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check total emails
  const { count: totalEmails } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });

  // Check recent emails
  const { data: recentEmails } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, received_at, is_sent_by_user')
    .order('received_at', { ascending: false })
    .limit(10);

  // Check activities for folder info
  const { data: activities } = await supabase
    .from('activities')
    .select('id, subject, metadata, occurred_at')
    .not('metadata', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(20);

  console.log('Total emails in email_messages:', totalEmails);
  console.log('\nRecent emails:');
  recentEmails?.forEach(e => {
    const dir = e.is_sent_by_user ? 'SENT' : 'RECV';
    console.log(`  ${dir}: ${(e.subject || '').substring(0, 50)} - ${e.from_email}`);
  });

  // Group activities by folder
  const folderCounts: Record<string, number> = {};
  activities?.forEach(a => {
    const folder = (a.metadata as Record<string, unknown>)?.folder as string || 'no-folder-info';
    folderCounts[folder] = (folderCounts[folder] || 0) + 1;
  });

  console.log('\nRecent activities by folder (from activities table):');
  Object.entries(folderCounts).forEach(([folder, count]) => {
    console.log(`  ${folder}: ${count}`);
  });

  // Show sample with folder info
  console.log('\nSample activities with folder info:');
  activities?.slice(0, 5).forEach(a => {
    const folder = (a.metadata as Record<string, unknown>)?.folder || 'unknown';
    console.log(`  [${folder}] ${(a.subject || '').substring(0, 50)}`);
  });
}

check().catch(console.error);
