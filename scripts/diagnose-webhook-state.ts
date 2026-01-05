import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  const requestId = 'e27a5c4d-bfa5-408b-b5db-25c69c2759ea';

  console.log('===========================================');
  console.log('WEBHOOK STATE DIAGNOSIS');
  console.log('===========================================\n');

  // 1. Check scheduling request state
  console.log('1. SCHEDULING REQUEST STATE');
  console.log('---');
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('id, title, status, email_thread_id, created_by, last_action_at, next_action_type')
    .eq('id', requestId)
    .single();

  if (request) {
    console.log('   ID:', request.id);
    console.log('   Title:', request.title);
    console.log('   Status:', request.status);
    console.log('   email_thread_id:', request.email_thread_id || 'NULL');
    console.log('   Created by:', request.created_by);
    console.log('   Last action:', request.last_action_at);
  } else {
    console.log('   Request not found!');
  }
  console.log('');

  // 2. Check Microsoft webhook subscription
  console.log('2. MICROSOFT WEBHOOK SUBSCRIPTIONS');
  console.log('---');
  const { data: subscriptions } = await supabase
    .from('microsoft_subscriptions')
    .select('id, user_id, resource, is_active, expiration_date, created_at')
    .eq('is_active', true);

  if (subscriptions && subscriptions.length > 0) {
    for (const sub of subscriptions) {
      const expiry = new Date(sub.expiration_date);
      const isExpired = expiry < new Date();
      console.log(`   User: ${sub.user_id}`);
      console.log(`   Resource: ${sub.resource}`);
      console.log(`   Expires: ${sub.expiration_date} ${isExpired ? '⚠️ EXPIRED!' : '✓'}`);
      console.log('');
    }
  } else {
    console.log('   ⚠️ NO ACTIVE SUBSCRIPTIONS FOUND!');
  }
  console.log('');

  // 3. Check last webhook notification
  console.log('3. LAST WEBHOOK NOTIFICATION');
  console.log('---');
  const { data: lastNotif } = await supabase
    .from('system_metrics')
    .select('value, updated_at')
    .eq('key', 'last_ms_webhook_notification')
    .single();

  if (lastNotif) {
    console.log('   Last notification:', lastNotif.value);
    console.log('   Updated at:', lastNotif.updated_at);
  } else {
    console.log('   No webhook notifications recorded');
  }
  console.log('');

  // 4. Check scheduling actions for this request
  console.log('4. SCHEDULING ACTIONS FOR THIS REQUEST');
  console.log('---');
  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('id, action_type, actor, email_id, message_subject, created_at')
    .eq('scheduling_request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (actions && actions.length > 0) {
    for (const action of actions) {
      console.log(`   ${action.created_at}`);
      console.log(`     Type: ${action.action_type}, Actor: ${action.actor}`);
      if (action.email_id) console.log(`     Email ID: ${action.email_id?.substring(0, 50)}...`);
      if (action.message_subject) console.log(`     Subject: ${action.message_subject}`);
      console.log('');
    }
  } else {
    console.log('   No actions found');
  }

  // 5. Check for recent inbound emails from this prospect
  console.log('5. RECENT INBOUND EMAILS FROM brentallen12@gmail.com');
  console.log('---');
  const { data: emails } = await supabase
    .from('communications')
    .select('id, subject, direction, occurred_at, external_id, thread_id')
    .eq('direction', 'inbound')
    .eq('channel', 'email')
    .gte('occurred_at', '2026-01-01T00:00:00Z')
    .order('occurred_at', { ascending: false })
    .limit(10);

  const prospectEmails = emails?.filter(e => {
    // Check if any participant matches
    return true; // We'll show all recent inbound
  });

  if (prospectEmails && prospectEmails.length > 0) {
    for (const email of prospectEmails) {
      console.log(`   ${email.occurred_at}`);
      console.log(`     Subject: ${email.subject}`);
      console.log(`     Thread ID: ${email.thread_id || 'NULL'}`);
      console.log(`     External ID: ${email.external_id?.substring(0, 50)}...`);
      console.log('');
    }
  } else {
    console.log('   No recent inbound emails found');
  }

  console.log('===========================================');
  console.log('DIAGNOSIS COMPLETE');
  console.log('===========================================');
}

diagnose().catch(console.error);
