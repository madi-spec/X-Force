/**
 * Apply unified work queues migration
 *
 * This adds queue_id and lens columns to command_center_items
 * to enable the merged work queue system.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

const MIGRATION_SQL = `
-- Unified Work Queues Migration
-- Adds queue_id and lens columns to command_center_items

-- Add queue_id column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS queue_id VARCHAR(50);

-- Add lens column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS lens VARCHAR(30);

-- Add days_stale column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS days_stale INTEGER DEFAULT 0;

-- Add last_activity_at column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Create indexes for queue queries
CREATE INDEX IF NOT EXISTS idx_cc_items_queue_id
ON command_center_items(queue_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cc_items_lens
ON command_center_items(lens)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cc_items_queue_lens
ON command_center_items(queue_id, lens, momentum_score DESC)
WHERE status = 'pending';

-- Backfill existing items with queue_id based on action_type

-- Action Now: Critical urgency items
UPDATE command_center_items
SET queue_id = 'action_now', lens = 'sales'
WHERE momentum_score >= 90
  AND status = 'pending'
  AND queue_id IS NULL;

-- Needs Response: Email responses needed
UPDATE command_center_items
SET queue_id = 'needs_response', lens = 'sales'
WHERE action_type IN ('email_respond', 'respond')
  AND status = 'pending'
  AND queue_id IS NULL;

-- Meeting Prep: Prepare for meetings
UPDATE command_center_items
SET queue_id = 'meeting_prep', lens = 'sales'
WHERE action_type IN ('prepare', 'meeting_prep', 'call_with_prep')
  AND status = 'pending'
  AND queue_id IS NULL;

-- Follow-ups: Follow up actions
UPDATE command_center_items
SET queue_id = 'follow_ups', lens = 'sales'
WHERE action_type IN ('follow_up', 'meeting_follow_up', 'call')
  AND status = 'pending'
  AND queue_id IS NULL;

-- New Leads: Research and new account work
UPDATE command_center_items
SET queue_id = 'new_leads', lens = 'sales'
WHERE action_type IN ('research_account')
  AND status = 'pending'
  AND queue_id IS NULL;

-- Scheduling: Scheduling tasks
UPDATE command_center_items
SET queue_id = 'scheduling', lens = 'sales'
WHERE action_type IN ('schedule')
  AND status = 'pending'
  AND queue_id IS NULL;

-- Escalations: Issues needing attention (CS lens)
UPDATE command_center_items
SET queue_id = 'at_risk', lens = 'customer_success'
WHERE action_type IN ('escalate')
  AND status = 'pending'
  AND queue_id IS NULL;

-- Default: Remaining items go to follow_ups
UPDATE command_center_items
SET queue_id = 'follow_ups', lens = 'sales'
WHERE queue_id IS NULL
  AND status = 'pending';
`;

async function checkMigrationStatus() {
  const supabase = createAdminClient();

  console.log('Checking unified work queues migration status...\n');

  // Test if queue_id column exists
  const { data, error } = await supabase
    .from('command_center_items')
    .select('id, queue_id, lens, days_stale, last_activity_at')
    .limit(1);

  if (error && error.message.includes('queue_id')) {
    console.log('❌ Migration NOT applied - queue_id column does not exist\n');
    console.log('Please run the following SQL in the Supabase SQL Editor:\n');
    console.log('=' .repeat(60));
    console.log(MIGRATION_SQL);
    console.log('=' .repeat(60));
    return false;
  }

  if (error) {
    console.error('Error checking migration:', error.message);
    return false;
  }

  console.log('✅ Columns exist!');

  // Check backfill status
  const { data: pendingItems, error: countError } = await supabase
    .from('command_center_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('queue_id', null);

  if (!countError) {
    const count = pendingItems?.length || 0;
    if (count > 0) {
      console.log(`⚠️  ${count} pending items still need queue_id backfilled`);
      console.log('   Running backfill queries...');

      // Try to run backfill
      await backfillQueueIds(supabase);
    } else {
      console.log('✅ All pending items have queue_id assigned');
    }
  }

  // Show current distribution
  const { data: distribution } = await supabase
    .from('command_center_items')
    .select('queue_id')
    .eq('status', 'pending');

  if (distribution) {
    const counts: Record<string, number> = {};
    for (const item of distribution) {
      const qid = item.queue_id || 'null';
      counts[qid] = (counts[qid] || 0) + 1;
    }

    console.log('\nQueue distribution:');
    for (const [queue, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${queue}: ${count}`);
    }
  }

  return true;
}

async function backfillQueueIds(supabase: ReturnType<typeof createAdminClient>) {
  // Since we can't run raw SQL, we'll update items individually

  // Action Now - high momentum
  const { error: err1 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'action_now', lens: 'sales' })
    .gte('momentum_score', 90)
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err1) console.log('  action_now backfill error:', err1.message);

  // Needs Response
  const { error: err2 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'needs_response', lens: 'sales' })
    .in('action_type', ['email_respond', 'respond'])
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err2) console.log('  needs_response backfill error:', err2.message);

  // Meeting Prep
  const { error: err3 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'meeting_prep', lens: 'sales' })
    .in('action_type', ['prepare', 'meeting_prep', 'call_with_prep'])
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err3) console.log('  meeting_prep backfill error:', err3.message);

  // Follow-ups
  const { error: err4 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'follow_ups', lens: 'sales' })
    .in('action_type', ['follow_up', 'meeting_follow_up', 'call'])
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err4) console.log('  follow_ups backfill error:', err4.message);

  // New Leads
  const { error: err5 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'new_leads', lens: 'sales' })
    .in('action_type', ['research_account'])
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err5) console.log('  new_leads backfill error:', err5.message);

  // Scheduling
  const { error: err6 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'scheduling', lens: 'sales' })
    .in('action_type', ['schedule'])
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err6) console.log('  scheduling backfill error:', err6.message);

  // At Risk (escalations)
  const { error: err7 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'at_risk', lens: 'customer_success' })
    .in('action_type', ['escalate'])
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err7) console.log('  at_risk backfill error:', err7.message);

  // Default to follow_ups
  const { error: err8 } = await supabase
    .from('command_center_items')
    .update({ queue_id: 'follow_ups', lens: 'sales' })
    .eq('status', 'pending')
    .is('queue_id', null);
  if (err8) console.log('  default backfill error:', err8.message);

  console.log('   Backfill complete');
}

checkMigrationStatus().catch(console.error);
