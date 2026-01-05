import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  console.log('=== Debug Action Now Issue ===\n');

  // 1. Check awaiting response communications
  const { data: awaitingItems, error: e1 } = await supabase
    .from('communications')
    .select('id, subject, company_id, response_due_by, created_at, direction, channel')
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('1. AWAITING RESPONSE COMMUNICATIONS:');
  console.log('Count:', awaitingItems?.length || 0);

  const now = new Date();
  let nowCount = 0;
  let soonCount = 0;
  let monitorCount = 0;

  awaitingItems?.forEach(item => {
    let attentionLevel = 'soon'; // default when no response_due_by

    if (item.response_due_by) {
      const dueDate = new Date(item.response_due_by);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue < 0) {
        attentionLevel = 'now';
      } else if (hoursUntilDue <= 4) {
        attentionLevel = 'now';
      } else if (hoursUntilDue <= 24) {
        attentionLevel = 'soon';
      } else {
        attentionLevel = 'monitor';
      }
    }

    if (attentionLevel === 'now') nowCount++;
    else if (attentionLevel === 'soon') soonCount++;
    else monitorCount++;

    console.log(`\n  [${item.channel}] ${item.subject?.substring(0, 50)}`);
    console.log(`    response_due_by: ${item.response_due_by || 'NULL'}`);
    console.log(`    → attention_level: ${attentionLevel}`);
  });

  console.log('\n\n2. ATTENTION LEVEL SUMMARY:');
  console.log(`  NOW (should appear in Action Now): ${nowCount}`);
  console.log(`  SOON (won't appear in Action Now): ${soonCount}`);
  console.log(`  MONITOR: ${monitorCount}`);

  // 3. Check AI-handled exclusions
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: aiHandled } = await supabase
    .from('ai_action_log')
    .select('communication_id, action_type, status, created_at')
    .eq('source', 'communications')
    .eq('status', 'success')
    .in('action_type', ['EMAIL_SENT', 'FLAG_CREATED'])
    .gte('created_at', twentyFourHoursAgo)
    .not('communication_id', 'is', null);

  console.log('\n\n3. AI-HANDLED COMMUNICATIONS (excluded from Daily Driver):');
  console.log('Count in last 24h:', aiHandled?.length || 0);
  if (aiHandled && aiHandled.length > 0) {
    aiHandled.forEach(h => {
      console.log(`  ${h.communication_id}: ${h.action_type} at ${h.created_at}`);
    });
  }

  // 4. Check most recent emails (synced)
  const { data: recentEmails } = await supabase
    .from('communications')
    .select('id, subject, created_at, direction, channel')
    .eq('channel', 'email')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n\n4. MOST RECENT EMAILS (to see if today\'s emails synced):');
  recentEmails?.forEach(e => {
    console.log(`  [${e.created_at}] ${e.direction} - ${e.subject?.substring(0, 50)}`);
  });

  // 5. Check sync logs
  const { data: syncLogs } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n\n5. RECENT SYNC LOGS:');
  syncLogs?.forEach(s => {
    console.log(`  [${s.created_at}] ${s.sync_type} - ${s.status} (${s.items_processed || 0} items)`);
  });

  console.log('\n\n=== DIAGNOSIS ===');
  if (nowCount === 0 && soonCount > 0) {
    console.log('ISSUE: All awaiting items have attention_level="soon" because response_due_by is NULL.');
    console.log('FIX: Items need response_due_by set to appear in Action Now queue.');
    console.log('     The email analysis pipeline should set response_due_by based on urgency.');
  }
}

debug().catch(console.error);
