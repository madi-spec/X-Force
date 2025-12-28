-- ============================================
-- AI SCHEDULER PHASE 3: MULTI-CHANNEL & PERSONALIZATION
-- ============================================

-- Add new columns to scheduling_requests
ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS current_channel VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS channel_progression JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deescalation_state JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS persona JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'low';

-- Add index for channel-based queries
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_channel
  ON scheduling_requests(current_channel);

-- Add index for urgency-based queries
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_urgency
  ON scheduling_requests(urgency)
  WHERE status NOT IN ('completed', 'cancelled');

-- Add phone field to scheduling_attendees if not exists
ALTER TABLE scheduling_attendees
ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN scheduling_requests.current_channel IS 'Current communication channel: email, sms, phone';
COMMENT ON COLUMN scheduling_requests.channel_progression IS 'Channel progression state: {current_channel, attempts_on_channel, escalate_after, channels_used[]}';
COMMENT ON COLUMN scheduling_requests.deescalation_state IS 'Duration de-escalation state: {original_duration, current_duration, duration_tier, deescalated_at, reason}';
COMMENT ON COLUMN scheduling_requests.persona IS 'Detected persona: {type, detected_at, confidence, signals[]}';
COMMENT ON COLUMN scheduling_requests.urgency IS 'Request urgency: low, medium, high, critical';

-- ============================================
-- UPDATE EXISTING RECORDS WITH DEFAULTS
-- ============================================

UPDATE scheduling_requests
SET
  current_channel = 'email',
  urgency = 'low'
WHERE current_channel IS NULL;

-- Initialize channel progression for active requests
UPDATE scheduling_requests
SET channel_progression = jsonb_build_object(
  'current_channel', 'email',
  'attempts_on_channel', attempt_count,
  'escalate_after', 3,
  'channels_used', '["email"]'::jsonb
)
WHERE status NOT IN ('completed', 'cancelled', 'confirmed')
  AND channel_progression IS NULL;
