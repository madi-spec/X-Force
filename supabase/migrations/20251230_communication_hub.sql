-- Communication Hub Phase 1: Foundation
-- Core principle: Communications = FACTS (immutable), Analysis = OPINIONS (versioned)

-- 1. COMMUNICATIONS TABLE (Facts - immutable events)
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  user_id UUID REFERENCES users(id),

  -- Channel & Direction
  channel TEXT NOT NULL,  -- 'email', 'call', 'meeting', 'sms', 'chat', 'note'
  direction TEXT NOT NULL,  -- 'inbound', 'outbound', 'internal'

  -- Participants
  our_participants JSONB DEFAULT '[]',
  their_participants JSONB DEFAULT '[]',

  -- AI Provenance
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_action_type TEXT,
  ai_initiated_by UUID REFERENCES users(id),
  ai_approved_by UUID REFERENCES users(id),
  ai_model_used TEXT,

  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,

  -- Content
  subject TEXT,
  content_preview TEXT,
  full_content TEXT,
  content_html TEXT,
  attachments JSONB DEFAULT '[]',
  recording_url TEXT,

  -- Source Reference
  source_table TEXT,
  source_id UUID,
  external_id TEXT,
  thread_id TEXT,
  in_reply_to UUID REFERENCES communications(id),

  -- Response State (critical for "who's waiting on me")
  awaiting_our_response BOOLEAN DEFAULT FALSE,
  awaiting_their_response BOOLEAN DEFAULT FALSE,
  response_due_by TIMESTAMPTZ,
  response_sla_minutes INTEGER,
  responded_at TIMESTAMPTZ,
  response_communication_id UUID REFERENCES communications(id),

  -- Email Engagement
  email_opened_at TIMESTAMPTZ,
  email_clicked_at TIMESTAMPTZ,
  email_bounced BOOLEAN DEFAULT FALSE,

  -- User Tags
  tags TEXT[] DEFAULT '{}',
  is_starred BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Analysis State
  analysis_status TEXT DEFAULT 'pending',
  current_analysis_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COMMUNICATION_ANALYSIS TABLE (Opinions - versioned AI interpretations)
CREATE TABLE IF NOT EXISTS communication_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,

  -- Version Tracking
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  model_used TEXT,
  prompt_version TEXT,

  -- Summary & Classification
  summary TEXT,
  communication_type TEXT,
  products_discussed TEXT[] DEFAULT '{}',

  -- Sentiment
  sentiment TEXT,
  sentiment_score DECIMAL(3,2),
  sentiment_confidence DECIMAL(3,2),

  -- Extracted Intelligence (all with confidence)
  extracted_facts JSONB DEFAULT '[]',
  extracted_signals JSONB DEFAULT '[]',
  extracted_objections JSONB DEFAULT '[]',
  extracted_commitments_us JSONB DEFAULT '[]',
  extracted_commitments_them JSONB DEFAULT '[]',
  extracted_competitors JSONB DEFAULT '[]',
  extracted_next_steps JSONB DEFAULT '[]',

  -- Potential Triggers (CC engine decides what to do)
  potential_triggers TEXT[] DEFAULT '{}',

  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROMISES TABLE (Denormalized for Promises Tracker)
CREATE TABLE IF NOT EXISTS promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who promised what
  direction TEXT NOT NULL,  -- 'we_promised' or 'they_promised'
  promise_text TEXT NOT NULL,

  -- Context
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),

  -- Owner (for we_promised)
  owner_user_id UUID REFERENCES users(id),
  owner_name TEXT,

  -- Promiser (for they_promised)
  promiser_contact_id UUID REFERENCES contacts(id),
  promiser_name TEXT,

  -- Timing
  promised_at TIMESTAMPTZ NOT NULL,
  due_by TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'overdue', 'cancelled'
  completed_at TIMESTAMPTZ,
  completed_communication_id UUID REFERENCES communications(id),

  -- Source
  source_communication_id UUID REFERENCES communications(id),
  source_analysis_id UUID REFERENCES communication_analysis(id),
  confidence DECIMAL(3,2),

  -- Visibility
  is_hidden BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXES

-- Communications indexes
CREATE INDEX IF NOT EXISTS idx_comm_company_time ON communications(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_contact_time ON communications(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_deal_time ON communications(deal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_user_time ON communications(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_channel ON communications(channel);
CREATE INDEX IF NOT EXISTS idx_comm_direction ON communications(direction);
CREATE INDEX IF NOT EXISTS idx_comm_ai_generated ON communications(is_ai_generated) WHERE is_ai_generated = true;
CREATE INDEX IF NOT EXISTS idx_comm_awaiting_us ON communications(awaiting_our_response, response_due_by) WHERE awaiting_our_response = true;
CREATE INDEX IF NOT EXISTS idx_comm_source ON communications(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_comm_thread ON communications(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comm_analysis_pending ON communications(analysis_status) WHERE analysis_status = 'pending';

-- Analysis indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_current ON communication_analysis(communication_id) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_analysis_communication ON communication_analysis(communication_id, version DESC);

-- Promises indexes
CREATE INDEX IF NOT EXISTS idx_promises_owner ON promises(owner_user_id, status, due_by);
CREATE INDEX IF NOT EXISTS idx_promises_company ON promises(company_id, status, due_by);
CREATE INDEX IF NOT EXISTS idx_promises_overdue ON promises(status, due_by) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_promises_source ON promises(source_communication_id);

-- 5. TRIGGERS

CREATE OR REPLACE FUNCTION update_communications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS communications_updated_at ON communications;
CREATE TRIGGER communications_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_communications_timestamp();

DROP TRIGGER IF EXISTS promises_updated_at ON promises;
CREATE TRIGGER promises_updated_at
  BEFORE UPDATE ON promises
  FOR EACH ROW
  EXECUTE FUNCTION update_communications_timestamp();

-- Add foreign key for current_analysis_id after communication_analysis table exists
ALTER TABLE communications
  DROP CONSTRAINT IF EXISTS communications_current_analysis_id_fkey;
ALTER TABLE communications
  ADD CONSTRAINT communications_current_analysis_id_fkey
  FOREIGN KEY (current_analysis_id) REFERENCES communication_analysis(id);
