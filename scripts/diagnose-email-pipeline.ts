import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('=== Email Pipeline Diagnosis ===\n');

  // 1. Check inbox_items (raw emails)
  const { data: inboxItems, count: inboxCount } = await supabase
    .from('inbox_items')
    .select('id, subject, from_email, received_at, is_analyzed, company_id', { count: 'exact' })
    .order('received_at', { ascending: false })
    .limit(5);

  console.log(`1. INBOX_ITEMS: ${inboxCount} total`);
  console.log('   Recent:', inboxItems?.map(i => ({
    subject: i.subject?.substring(0, 40),
    from: i.from_email,
    analyzed: i.is_analyzed,
    hasCompany: !!i.company_id
  })));

  // 2. Check communications
  const { count: commCount } = await supabase
    .from('communications')
    .select('id', { count: 'exact' });

  const { data: recentComms } = await supabase
    .from('communications')
    .select('id, type, direction, subject, company_id, contact_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n2. COMMUNICATIONS: ${commCount} total`);
  console.log('   Recent:', recentComms?.map(c => ({
    type: c.type,
    direction: c.direction,
    subject: c.subject?.substring(0, 40),
    hasCompany: !!c.company_id
  })));

  // 3. Check command_center_items
  const { count: ccCount } = await supabase
    .from('command_center_items')
    .select('id', { count: 'exact' })
    .eq('status', 'pending');

  const { data: recentCC } = await supabase
    .from('command_center_items')
    .select('id, title, source_type, tier, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n3. COMMAND_CENTER_ITEMS (pending): ${ccCount} total`);
  console.log('   Recent:', recentCC?.map(c => ({
    title: c.title?.substring(0, 40),
    source: c.source_type,
    tier: c.tier
  })));

  // 4. Check unanalyzed emails
  const { count: unanalyzedCount } = await supabase
    .from('inbox_items')
    .select('id', { count: 'exact' })
    .eq('is_analyzed', false);

  console.log(`\n4. UNANALYZED EMAILS: ${unanalyzedCount}`);

  // 5. Check emails without company match
  const { count: unmatchedCount } = await supabase
    .from('inbox_items')
    .select('id', { count: 'exact' })
    .is('company_id', null);

  console.log(`5. EMAILS WITHOUT COMPANY: ${unmatchedCount}`);
}

diagnose().catch(console.error);
