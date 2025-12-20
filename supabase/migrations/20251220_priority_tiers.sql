-- Priority Tiers System Migration
-- Replaces momentum scoring with 5-tier priority hierarchy

-- ============================================
-- TIER COLUMNS FOR COMMAND CENTER ITEMS
-- ============================================

-- Add tier classification columns
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS tier_trigger VARCHAR(50),
ADD COLUMN IF NOT EXISTS sla_minutes INTEGER,
ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'on_track',
ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS value_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS promise_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS commitment_text TEXT,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Comment on tier values
COMMENT ON COLUMN command_center_items.tier IS '1=RESPOND NOW, 2=DONT LOSE THIS, 3=KEEP YOUR WORD, 4=MOVE BIG DEALS, 5=BUILD PIPELINE';
COMMENT ON COLUMN command_center_items.tier_trigger IS 'What triggered this tier: demo_request, pricing_request, deadline_critical, competitive_risk, etc.';
COMMENT ON COLUMN command_center_items.sla_minutes IS 'Response SLA in minutes for Tier 1 items';
COMMENT ON COLUMN command_center_items.sla_status IS 'on_track, warning, breached';
COMMENT ON COLUMN command_center_items.urgency_score IS 'Secondary sort score within tier (0-100)';
COMMENT ON COLUMN command_center_items.value_score IS 'Value-based score for Tier 4 items (0-100)';
COMMENT ON COLUMN command_center_items.promise_date IS 'When the commitment was due (Tier 3)';
COMMENT ON COLUMN command_center_items.commitment_text IS 'What was promised (Tier 3)';
COMMENT ON COLUMN command_center_items.received_at IS 'When inbound message was received (Tier 1)';

-- ============================================
-- DEAL ENHANCEMENTS
-- ============================================

-- Add competitor tracking
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS competitors TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS days_since_activity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS value_percentile INTEGER DEFAULT 50;

COMMENT ON COLUMN deals.competitors IS 'List of competitor names mentioned';
COMMENT ON COLUMN deals.days_since_activity IS 'Days since last activity on this deal';
COMMENT ON COLUMN deals.value_percentile IS 'This deals percentile by value (0-100)';

-- ============================================
-- CONTACT ENHANCEMENTS
-- ============================================

-- Add contact role and response tracking
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS role VARCHAR(50),
ADD COLUMN IF NOT EXISTS emails_without_reply INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS days_since_reply INTEGER DEFAULT 0;

COMMENT ON COLUMN contacts.role IS 'champion, decision_maker, influencer, blocker, end_user';
COMMENT ON COLUMN contacts.emails_without_reply IS 'Consecutive emails sent without reply';
COMMENT ON COLUMN contacts.days_since_reply IS 'Days since last reply from this contact';

-- ============================================
-- INDEXES
-- ============================================

-- Primary tier-based query index
CREATE INDEX IF NOT EXISTS idx_items_tier
ON command_center_items(user_id, tier, urgency_score DESC)
WHERE status = 'pending';

-- Secondary index for tier + status queries
CREATE INDEX IF NOT EXISTS idx_items_tier_status
ON command_center_items(user_id, status, tier);

-- Index for SLA tracking (Tier 1)
CREATE INDEX IF NOT EXISTS idx_items_sla
ON command_center_items(user_id, sla_status, received_at DESC)
WHERE tier = 1 AND status = 'pending';

-- Index for deal activity tracking
CREATE INDEX IF NOT EXISTS idx_deals_activity
ON deals(days_since_activity DESC)
WHERE status = 'active';

-- ============================================
-- FUNCTION: Update deal days_since_activity
-- ============================================

CREATE OR REPLACE FUNCTION update_deal_activity_days()
RETURNS void AS $$
BEGIN
  UPDATE deals
  SET days_since_activity = EXTRACT(DAY FROM NOW() - COALESCE(last_activity_at, created_at))::INTEGER
  WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Calculate deal value percentiles
-- ============================================

CREATE OR REPLACE FUNCTION update_deal_value_percentiles()
RETURNS void AS $$
BEGIN
  WITH ranked_deals AS (
    SELECT
      id,
      PERCENT_RANK() OVER (ORDER BY COALESCE(estimated_value, 0)) * 100 as percentile
    FROM deals
    WHERE status = 'active'
  )
  UPDATE deals d
  SET value_percentile = ROUND(r.percentile)::INTEGER
  FROM ranked_deals r
  WHERE d.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Update contact reply tracking
-- ============================================

CREATE OR REPLACE FUNCTION update_contact_reply_stats()
RETURNS void AS $$
BEGIN
  -- Update days_since_reply from email_conversations
  UPDATE contacts c
  SET days_since_reply = EXTRACT(DAY FROM NOW() - sub.last_reply)::INTEGER
  FROM (
    SELECT
      ec.contact_id,
      MAX(ec.last_inbound_at) as last_reply
    FROM email_conversations ec
    WHERE ec.contact_id IS NOT NULL
    GROUP BY ec.contact_id
  ) sub
  WHERE c.id = sub.contact_id;

  -- Update emails_without_reply
  -- Count outbound emails after last inbound
  UPDATE contacts c
  SET emails_without_reply = COALESCE(sub.unanswered_count, 0)
  FROM (
    SELECT
      ec.contact_id,
      COUNT(*) as unanswered_count
    FROM email_conversations ec
    WHERE ec.contact_id IS NOT NULL
      AND ec.status = 'awaiting_response'
      AND ec.last_outbound_at > COALESCE(ec.last_inbound_at, '1970-01-01'::timestamptz)
    GROUP BY ec.contact_id
  ) sub
  WHERE c.id = sub.contact_id;
END;
$$ LANGUAGE plpgsql;
