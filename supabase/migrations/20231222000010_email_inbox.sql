-- =============================================
-- Bidirectional Email Inbox System
-- =============================================

-- ============================================================
-- CONVERSATIONS (Primary Entity - Reps think in threads)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Microsoft identifiers (IMMUTABLE)
  conversation_id VARCHAR(255) NOT NULL,      -- Graph conversationId

  -- Thread status (X-FORCE's source of truth)
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- 'pending'            = needs action from rep
  -- 'awaiting_response'  = we sent, waiting for reply
  -- 'snoozed'            = temporarily hidden
  -- 'processed'          = handled/archived
  -- 'ignored'            = not relevant

  -- Linking with confidence scoring
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  link_confidence INTEGER,                    -- 0-100
  link_method VARCHAR(30),                    -- 'auto_high', 'auto_suggested', 'manual', 'thread_inherited'
  link_reasoning TEXT,                        -- Human-readable explanation

  -- Thread metadata
  subject VARCHAR(1000),
  participant_emails TEXT[],                  -- All emails in thread
  participant_names TEXT[],
  message_count INTEGER DEFAULT 1,
  has_attachments BOOLEAN DEFAULT FALSE,

  -- Timeline tracking
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,               -- When THEY last sent
  last_outbound_at TIMESTAMPTZ,              -- When WE last sent

  -- SLA tracking
  response_due_at TIMESTAMPTZ,
  sla_hours INTEGER,                          -- Expected response time
  sla_status VARCHAR(20) DEFAULT 'ok',        -- 'ok', 'warning', 'overdue'

  -- AI analysis (thread-level)
  ai_priority VARCHAR(20),                    -- 'high', 'medium', 'low'
  ai_category VARCHAR(50),                    -- 'pricing', 'scheduling', 'objection', etc.
  ai_sentiment VARCHAR(20),                   -- 'positive', 'neutral', 'negative', 'urgent'
  ai_sentiment_trend VARCHAR(30),             -- 'improving', 'stable', 'declining'
  ai_thread_summary TEXT,
  ai_suggested_action TEXT,
  ai_evidence_quotes TEXT[],                  -- Quotes supporting analysis

  -- Signal detection
  signals JSONB DEFAULT '{}',
  -- {
  --   cc_escalation: boolean,
  --   legal_procurement: boolean,
  --   competitor_mentions: string[],
  --   budget_discussed: boolean,
  --   timeline_mentioned: string,
  --   buying_signals: string[],
  --   objections: string[],
  --   scheduling_proposed: string[],
  --   out_of_office: { until: string, delegate?: string }
  -- }

  -- Snooze handling
  snoozed_until TIMESTAMPTZ,
  snooze_reason VARCHAR(255),

  -- Draft handling
  has_pending_draft BOOLEAN DEFAULT FALSE,
  draft_confidence INTEGER,

  -- User management flag (don't fight user's filing)
  user_managed BOOLEAN DEFAULT FALSE,         -- User moved it manually, stop auto-organizing

  -- Sync state
  last_synced_at TIMESTAMPTZ,
  sync_conflict BOOLEAN DEFAULT FALSE,
  sync_conflict_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, conversation_id)
);

-- Indexes for conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_status ON email_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_user_priority ON email_conversations(user_id, ai_priority, status);
CREATE INDEX IF NOT EXISTS idx_conversations_sla ON email_conversations(user_id, sla_status, response_due_at)
  WHERE status = 'awaiting_response';
CREATE INDEX IF NOT EXISTS idx_conversations_snoozed ON email_conversations(user_id, snoozed_until)
  WHERE status = 'snoozed';
CREATE INDEX IF NOT EXISTS idx_conversations_deal ON email_conversations(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_company ON email_conversations(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON email_conversations(user_id, last_message_at DESC);


-- ============================================================
-- MESSAGES (Children of Conversations)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_ref UUID REFERENCES email_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Microsoft identifiers (IMMUTABLE - use Prefer: IdType="ImmutableId")
  message_id VARCHAR(255) NOT NULL,           -- Graph immutable ID
  internet_message_id VARCHAR(500),           -- RFC 2822 Message-ID (backup identifier)

  -- Location in Outlook
  outlook_folder_id VARCHAR(255),
  outlook_folder_name VARCHAR(100),

  -- Message metadata
  subject VARCHAR(1000),
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails TEXT[],
  to_names TEXT[],
  cc_emails TEXT[],
  cc_names TEXT[],

  -- Content
  body_preview TEXT,                          -- First ~200 chars
  body_text TEXT,                             -- Full plain text (for search)
  body_html TEXT,                             -- Full HTML (for display)

  -- State
  is_read BOOLEAN DEFAULT FALSE,
  is_sent_by_user BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  importance VARCHAR(20),                     -- 'low', 'normal', 'high'

  -- Timestamps
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- AI analysis (message-level)
  ai_analysis JSONB,
  -- {
  --   intent: string,
  --   key_points: string[],
  --   evidence_quotes: string[],
  --   risk_flags: string[]
  -- }

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON email_messages(conversation_ref);
CREATE INDEX IF NOT EXISTS idx_messages_user_received ON email_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_internet_id ON email_messages(internet_message_id);


-- ============================================================
-- OUTLOOK FOLDER MAPPING
-- ============================================================
CREATE TABLE IF NOT EXISTS outlook_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Folder IDs (using immutable IDs)
  inbox_id VARCHAR(255),
  sent_items_id VARCHAR(255),
  processed_folder_id VARCHAR(255),           -- "X-FORCE Processed"

  -- User preferences
  folder_mode VARCHAR(30) DEFAULT 'move',     -- 'move' or 'label_only'
  -- 'move' = physically move emails to X-FORCE folders
  -- 'label_only' = use categories, don't move (for conservative teams)

  folders_created BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);


-- ============================================================
-- AI DRAFTS (Ghost Writing)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES email_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Draft content
  subject VARCHAR(1000),
  body_html TEXT,
  body_text TEXT,

  -- AI metadata
  confidence INTEGER,                         -- 0-100
  generation_trigger VARCHAR(50),             -- 'high_priority', 'pricing_question', etc.
  generation_context JSONB,                   -- What context was used
  needs_human_review TEXT[],                  -- ["Verify pricing", "Confirm date"]
  placeholders TEXT[],                        -- ["[SPECIFIC_DATE]", "[CONFIRM_PRICE]"]

  -- Status
  status VARCHAR(30) DEFAULT 'pending_review',
  -- 'pending_review', 'edited', 'sent', 'discarded'

  -- If sent
  sent_message_id VARCHAR(255),
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_conversation ON email_drafts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_drafts_user_pending ON email_drafts(user_id, status)
  WHERE status = 'pending_review';


-- ============================================================
-- CONTACT EMAIL PATTERNS (Velocity Intelligence)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_email_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Response patterns
  total_threads INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5,4),                 -- 0.0000 to 1.0000

  -- Timing patterns
  avg_response_time_hours DECIMAL(8,2),
  median_response_time_hours DECIMAL(8,2),
  fastest_response_hours DECIMAL(8,2),
  slowest_response_hours DECIMAL(8,2),

  -- Time-of-day patterns
  typical_response_hours INT[],               -- e.g., [9, 10, 11, 14, 15] for business hours
  typical_response_days INT[],                -- e.g., [1, 2, 3, 4, 5] for weekdays

  -- Current state
  last_response_time_hours DECIMAL(8,2),
  current_thread_wait_hours DECIMAL(8,2),
  deviation_status VARCHAR(30),               -- 'normal', 'slower', 'much_slower', 'faster'

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(contact_id, user_id)
);


-- ============================================================
-- EMAIL TEMPLATES WITH EFFECTIVENESS TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),          -- NULL = org-wide

  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),                       -- 'follow_up', 'intro', 'pricing', etc.
  subject VARCHAR(1000),
  body_html TEXT,
  body_text TEXT,

  -- Variables
  variables TEXT[],                           -- ["{{contact_name}}", "{{company_name}}"]

  -- Effectiveness tracking
  times_used INTEGER DEFAULT 0,
  times_got_response INTEGER DEFAULT 0,
  response_rate DECIMAL(5,4),
  avg_response_time_hours DECIMAL(8,2),
  positive_response_rate DECIMAL(5,4),
  leads_to_meeting_rate DECIMAL(5,4),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ACTION AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS email_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES email_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES email_messages(id),
  user_id UUID REFERENCES users(id),

  action VARCHAR(50) NOT NULL,
  -- 'viewed', 'replied', 'forwarded', 'archived', 'snoozed', 'unsnoozed',
  -- 'linked_to_deal', 'unlinked', 'priority_changed', 'ignored',
  -- 'draft_created', 'draft_sent', 'draft_discarded',
  -- 'conflict_resolved', 'sla_breached'

  -- State changes
  from_status VARCHAR(30),
  to_status VARCHAR(30),

  -- Details
  deal_id UUID,
  snooze_until TIMESTAMPTZ,
  template_id UUID,
  notes TEXT,

  -- Source
  source VARCHAR(30),                         -- 'xforce_ui', 'outlook_sync', 'ai_auto', 'api'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_actions_conversation ON email_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_email_actions_user ON email_actions(user_id, created_at DESC);


-- ============================================================
-- SYNC STATE
-- ============================================================
CREATE TABLE IF NOT EXISTS email_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Delta tokens (for incremental sync)
  inbox_delta_token TEXT,
  sent_delta_token TEXT,

  -- Webhook subscription
  subscription_id VARCHAR(255),
  subscription_expires_at TIMESTAMPTZ,

  -- Sync timestamps
  last_full_sync_at TIMESTAMPTZ,
  last_delta_sync_at TIMESTAMPTZ,
  last_webhook_at TIMESTAMPTZ,

  -- Health tracking
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- Stats
  total_conversations_synced INTEGER DEFAULT 0,
  total_messages_synced INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);


-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update conversation timestamp
CREATE OR REPLACE FUNCTION update_email_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_email_conversations_updated
  BEFORE UPDATE ON email_conversations
  FOR EACH ROW EXECUTE FUNCTION update_email_conversation_timestamp();

CREATE TRIGGER trigger_email_drafts_updated
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW EXECUTE FUNCTION update_email_conversation_timestamp();

CREATE TRIGGER trigger_outlook_folders_updated
  BEFORE UPDATE ON outlook_folders
  FOR EACH ROW EXECUTE FUNCTION update_email_conversation_timestamp();

CREATE TRIGGER trigger_email_sync_state_updated
  BEFORE UPDATE ON email_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_email_conversation_timestamp();


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get daily action queue counts
CREATE OR REPLACE FUNCTION get_email_action_queue_counts(p_user_id UUID)
RETURNS TABLE (
  overdue_count BIGINT,
  high_priority_count BIGINT,
  scheduling_count BIGINT,
  snoozed_expiring_count BIGINT,
  drafts_ready_count BIGINT,
  needs_linking_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM email_conversations
     WHERE user_id = p_user_id AND status = 'awaiting_response' AND sla_status = 'overdue'),
    (SELECT COUNT(*) FROM email_conversations
     WHERE user_id = p_user_id AND status = 'pending' AND ai_priority = 'high'),
    (SELECT COUNT(*) FROM email_conversations
     WHERE user_id = p_user_id AND status = 'pending' AND ai_category = 'scheduling'),
    (SELECT COUNT(*) FROM email_conversations
     WHERE user_id = p_user_id AND status = 'snoozed' AND snoozed_until <= NOW() + INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM email_drafts
     WHERE user_id = p_user_id AND status = 'pending_review'),
    (SELECT COUNT(*) FROM email_conversations
     WHERE user_id = p_user_id AND status = 'pending' AND link_method = 'auto_suggested' AND deal_id IS NULL);
END;
$$ LANGUAGE plpgsql;


-- Update SLA status for all awaiting conversations
CREATE OR REPLACE FUNCTION update_sla_statuses()
RETURNS TABLE (warnings INTEGER, overdue INTEGER) AS $$
DECLARE
  v_warnings INTEGER := 0;
  v_overdue INTEGER := 0;
  conv RECORD;
  total_window INTERVAL;
  elapsed INTERVAL;
  percent_elapsed DECIMAL;
  new_status VARCHAR(20);
BEGIN
  FOR conv IN
    SELECT id, status, sla_status, response_due_at, last_outbound_at
    FROM email_conversations
    WHERE status = 'awaiting_response' AND response_due_at IS NOT NULL
  LOOP
    total_window := conv.response_due_at - conv.last_outbound_at;
    elapsed := NOW() - conv.last_outbound_at;
    percent_elapsed := EXTRACT(EPOCH FROM elapsed) / NULLIF(EXTRACT(EPOCH FROM total_window), 0) * 100;

    IF NOW() > conv.response_due_at THEN
      new_status := 'overdue';
      v_overdue := v_overdue + 1;
    ELSIF percent_elapsed >= 75 THEN
      new_status := 'warning';
      v_warnings := v_warnings + 1;
    ELSE
      new_status := 'ok';
    END IF;

    IF new_status != conv.sla_status THEN
      UPDATE email_conversations SET sla_status = new_status WHERE id = conv.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_warnings, v_overdue;
END;
$$ LANGUAGE plpgsql;


-- Wake up snoozed conversations
CREATE OR REPLACE FUNCTION wake_snoozed_conversations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE email_conversations
  SET
    status = 'pending',
    snoozed_until = NULL,
    snooze_reason = NULL,
    updated_at = NOW()
  WHERE status = 'snoozed' AND snoozed_until <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
