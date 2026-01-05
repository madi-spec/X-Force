-- Unified Work Queues Migration
-- Merges command_center_items with work page queues
-- All action items now flow through command_center_items

-- ============================================
-- ADD QUEUE COLUMNS TO COMMAND CENTER ITEMS
-- ============================================

-- Add queue_id to categorize items into work queues
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS queue_id VARCHAR(50);

-- Add lens to associate items with a lens view
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS lens VARCHAR(30);

-- Add days_stale for tracking staleness
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS days_stale INTEGER DEFAULT 0;

-- Add last_activity_at for tracking recent activity
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- ============================================
-- BACKFILL QUEUE_ID BASED ON ACTION_TYPE
-- ============================================

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

-- ============================================
-- CREATE INDEXES FOR QUEUE QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cc_items_queue_id
ON command_center_items(queue_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cc_items_lens
ON command_center_items(lens)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cc_items_queue_lens
ON command_center_items(queue_id, lens, momentum_score DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cc_items_company_queue
ON command_center_items(company_id, queue_id)
WHERE status = 'pending';

-- ============================================
-- CREATE VIEW FOR QUEUE STATS
-- ============================================

CREATE OR REPLACE VIEW work_queue_stats AS
SELECT
  queue_id,
  lens,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE momentum_score >= 90) as critical_count,
  COUNT(*) FILTER (WHERE momentum_score >= 70 AND momentum_score < 90) as high_count,
  COUNT(*) FILTER (WHERE momentum_score >= 40 AND momentum_score < 70) as medium_count,
  COUNT(*) FILTER (WHERE momentum_score < 40) as low_count,
  AVG(momentum_score) as avg_score
FROM command_center_items
WHERE status = 'pending'
GROUP BY queue_id, lens;

-- ============================================
-- ADD COMMENT FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN command_center_items.queue_id IS 'Work queue this item belongs to: action_now, needs_response, meeting_prep, follow_ups, new_leads, scheduling, at_risk, stalled_deals, etc.';
COMMENT ON COLUMN command_center_items.lens IS 'Lens view this item belongs to: sales, customer_success, onboarding, support';
