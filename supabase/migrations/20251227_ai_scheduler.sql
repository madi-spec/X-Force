-- ============================================
-- AI SCHEDULER TABLES
-- Phase 1: Core Scheduling Flow
-- ============================================

-- Clean up existing tables if any
DROP TABLE IF EXISTS scheduling_social_proof_usage CASCADE;
DROP TABLE IF EXISTS scheduling_postmortems CASCADE;
DROP TABLE IF EXISTS scheduling_conflicts CASCADE;
DROP TABLE IF EXISTS meeting_prep_briefs CASCADE;
DROP TABLE IF EXISTS scheduling_actions CASCADE;
DROP TABLE IF EXISTS scheduling_attendees CASCADE;
DROP TABLE IF EXISTS scheduling_templates CASCADE;
DROP TABLE IF EXISTS scheduling_requests CASCADE;

-- ============================================
-- SCHEDULING REQUESTS
-- Main table for scheduling requests
-- ============================================

CREATE TABLE scheduling_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  created_by UUID REFERENCES users(id),
  deal_id UUID REFERENCES deals(id),
  company_id UUID REFERENCES companies(id),

  -- Meeting details
  meeting_type VARCHAR(50) NOT NULL, -- 'discovery', 'demo', 'follow_up', 'custom'
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  title VARCHAR(500),
  context TEXT, -- User-provided context for AI emails

  -- Video/location
  meeting_platform VARCHAR(50) DEFAULT 'teams', -- 'teams', 'zoom', 'google_meet', 'phone', 'in_person'
  meeting_location TEXT, -- For in-person or custom
  meeting_link TEXT, -- Generated meeting link

  -- Scheduling preferences
  date_range_start DATE,
  date_range_end DATE,
  preferred_times JSONB DEFAULT '{"morning": true, "afternoon": true, "evening": false}',
  avoid_days JSONB DEFAULT '[]', -- ["monday", "friday_afternoon"]
  timezone VARCHAR(50) DEFAULT 'America/New_York',

  -- State machine
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  -- 'initiated', 'proposing', 'awaiting_response', 'negotiating',
  -- 'confirming', 'confirmed', 'reminder_sent', 'completed',
  -- 'no_show', 'cancelled', 'paused'

  -- Tracking
  attempt_count INTEGER DEFAULT 0, -- Total scheduling attempts
  no_show_count INTEGER DEFAULT 0, -- How many times they've no-showed
  last_action_at TIMESTAMP WITH TIME ZONE,
  next_action_at TIMESTAMP WITH TIME ZONE, -- When AI should act next
  next_action_type VARCHAR(50), -- 'send_options', 'follow_up', 'send_reminder', etc.

  -- Proposed times (current set being offered)
  proposed_times JSONB DEFAULT '[]', -- Array of ISO timestamps

  -- Outcome
  scheduled_time TIMESTAMP WITH TIME ZONE, -- Confirmed meeting time
  calendar_event_id TEXT, -- Microsoft/Google calendar event ID
  invite_accepted BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  outcome VARCHAR(30), -- 'held', 'cancelled_by_us', 'cancelled_by_them', 'no_show', 'rescheduled'
  outcome_notes TEXT,

  -- AI tracking
  email_thread_id TEXT, -- Thread ID in email system
  conversation_history JSONB DEFAULT '[]', -- Full back-and-forth for context

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduling_requests_status ON scheduling_requests(status);
CREATE INDEX idx_scheduling_requests_next_action ON scheduling_requests(next_action_at)
  WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_scheduling_requests_deal ON scheduling_requests(deal_id);
CREATE INDEX idx_scheduling_requests_company ON scheduling_requests(company_id);
CREATE INDEX idx_scheduling_requests_created_by ON scheduling_requests(created_by);
CREATE INDEX idx_scheduling_requests_scheduled ON scheduling_requests(scheduled_time)
  WHERE scheduled_time IS NOT NULL;

-- ============================================
-- SCHEDULING ATTENDEES
-- Who needs to be in the meeting
-- ============================================

CREATE TABLE scheduling_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,

  -- Attendee info
  side VARCHAR(10) NOT NULL, -- 'internal' or 'external'
  user_id UUID REFERENCES users(id), -- For internal attendees
  contact_id UUID REFERENCES contacts(id), -- For external attendees

  -- Contact info (denormalized for external)
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  title VARCHAR(255),

  -- Role in meeting
  is_required BOOLEAN DEFAULT TRUE,
  is_organizer BOOLEAN DEFAULT FALSE, -- Who sends the invite
  is_primary_contact BOOLEAN DEFAULT FALSE, -- Main person we're scheduling with

  -- Response tracking
  invite_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'tentative'
  responded_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduling_attendees_request ON scheduling_attendees(scheduling_request_id);
CREATE INDEX idx_scheduling_attendees_user ON scheduling_attendees(user_id);
CREATE INDEX idx_scheduling_attendees_contact ON scheduling_attendees(contact_id);

-- ============================================
-- SCHEDULING ACTIONS
-- Log of all actions taken
-- ============================================

CREATE TABLE scheduling_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,

  -- Action details
  action_type VARCHAR(50) NOT NULL,
  -- 'email_sent', 'email_received', 'times_proposed', 'time_selected',
  -- 'invite_sent', 'invite_accepted', 'invite_declined', 'reminder_sent',
  -- 'no_show_detected', 'rescheduling_started', 'cancelled', 'completed',
  -- 'follow_up_sent', 'paused', 'resumed', 'status_changed'

  -- Content
  email_id TEXT, -- Reference to email/activity if applicable
  times_proposed JSONB, -- Array of proposed times
  time_selected TIMESTAMP WITH TIME ZONE,
  message_subject TEXT,
  message_content TEXT, -- Email content sent/received

  -- State tracking
  previous_status VARCHAR(30),
  new_status VARCHAR(30),

  -- AI reasoning
  ai_reasoning TEXT, -- Why AI took this action

  -- Who did it
  actor VARCHAR(20) NOT NULL, -- 'ai', 'user', 'prospect'
  actor_id UUID, -- user_id or contact_id

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduling_actions_request ON scheduling_actions(scheduling_request_id);
CREATE INDEX idx_scheduling_actions_type ON scheduling_actions(action_type);
CREATE INDEX idx_scheduling_actions_created ON scheduling_actions(created_at DESC);

-- ============================================
-- SCHEDULING TEMPLATES
-- Reusable templates for meeting types
-- ============================================

CREATE TABLE scheduling_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(50), -- 'discovery', 'demo', etc.
  description TEXT,

  -- Default settings
  duration_minutes INTEGER DEFAULT 30,
  default_platform VARCHAR(50) DEFAULT 'teams',

  -- Email templates (placeholders: {{name}}, {{company}}, {{times}}, etc.)
  initial_email_template TEXT,
  follow_up_template TEXT,
  confirmation_template TEXT,
  reminder_template TEXT,
  no_show_template TEXT,
  reschedule_template TEXT,

  -- Timing rules
  follow_up_after_hours INTEGER DEFAULT 24,
  second_follow_up_hours INTEGER DEFAULT 48,
  reminder_hours_before INTEGER DEFAULT 3,
  max_attempts INTEGER DEFAULT 5,

  -- Default preferences
  default_preferred_times JSONB DEFAULT '{"morning": true, "afternoon": true, "evening": false}',
  default_avoid_days JSONB DEFAULT '[]',

  -- Ownership
  is_system BOOLEAN DEFAULT FALSE, -- System templates vs user-created
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduling_templates_type ON scheduling_templates(meeting_type);

-- ============================================
-- MEETING PREP BRIEFS
-- Auto-generated before meetings
-- ============================================

CREATE TABLE meeting_prep_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id),
  company_id UUID REFERENCES companies(id),

  meeting_time TIMESTAMP WITH TIME ZONE NOT NULL,

  -- The prep content
  brief_content JSONB NOT NULL,
  -- {
  --   executive_summary: string,
  --   meeting_objective: string,
  --   key_talking_points: string[],
  --   questions_to_ask: string[],
  --   landmines_to_avoid: string[],
  --   objection_prep: [{ objection, response }],
  --   next_steps_to_propose: string[],
  --   attendee_insights: [{ name, title, notes }]
  -- }

  -- Tracking
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  viewed_at TIMESTAMP WITH TIME ZONE,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meeting_prep_briefs_request ON meeting_prep_briefs(scheduling_request_id);
CREATE INDEX idx_meeting_prep_briefs_time ON meeting_prep_briefs(meeting_time);
CREATE INDEX idx_meeting_prep_briefs_deal ON meeting_prep_briefs(deal_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE scheduling_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep_briefs ENABLE ROW LEVEL SECURITY;

-- Scheduling Requests policies
CREATE POLICY "Users can view own scheduling requests" ON scheduling_requests
  FOR SELECT USING (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can create scheduling requests" ON scheduling_requests
  FOR INSERT WITH CHECK (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can update own scheduling requests" ON scheduling_requests
  FOR UPDATE USING (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service role can manage all scheduling requests" ON scheduling_requests
  FOR ALL USING (auth.role() = 'service_role');

-- Scheduling Attendees policies
CREATE POLICY "Users can view attendees for own requests" ON scheduling_attendees
  FOR SELECT USING (
    scheduling_request_id IN (
      SELECT id FROM scheduling_requests
      WHERE created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage attendees for own requests" ON scheduling_attendees
  FOR ALL USING (
    scheduling_request_id IN (
      SELECT id FROM scheduling_requests
      WHERE created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Service role can manage all attendees" ON scheduling_attendees
  FOR ALL USING (auth.role() = 'service_role');

-- Scheduling Actions policies
CREATE POLICY "Users can view actions for own requests" ON scheduling_actions
  FOR SELECT USING (
    scheduling_request_id IN (
      SELECT id FROM scheduling_requests
      WHERE created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Service role can manage all actions" ON scheduling_actions
  FOR ALL USING (auth.role() = 'service_role');

-- Templates policies
CREATE POLICY "Users can view templates" ON scheduling_templates
  FOR SELECT USING (
    is_system = TRUE OR created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can create own templates" ON scheduling_templates
  FOR INSERT WITH CHECK (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can update own templates" ON scheduling_templates
  FOR UPDATE USING (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid()) AND is_system = FALSE
  );

CREATE POLICY "Service role can manage all templates" ON scheduling_templates
  FOR ALL USING (auth.role() = 'service_role');

-- Meeting Prep Briefs policies
CREATE POLICY "Users can view own prep briefs" ON meeting_prep_briefs
  FOR SELECT USING (
    scheduling_request_id IN (
      SELECT id FROM scheduling_requests
      WHERE created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Service role can manage all prep briefs" ON meeting_prep_briefs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_scheduling_requests_updated_at
  BEFORE UPDATE ON scheduling_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduling_templates_updated_at
  BEFORE UPDATE ON scheduling_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT SYSTEM TEMPLATES
-- ============================================

INSERT INTO scheduling_templates (
  name, meeting_type, description, duration_minutes, default_platform, is_system,
  follow_up_after_hours, reminder_hours_before, max_attempts
) VALUES
(
  'Discovery Call',
  'discovery',
  'Initial discovery call to understand pain points and qualify the opportunity',
  30,
  'teams',
  TRUE,
  24,
  3,
  5
),
(
  'Product Demo',
  'demo',
  'Full product demonstration showing relevant features',
  60,
  'teams',
  TRUE,
  24,
  3,
  5
),
(
  'Follow-up Call',
  'follow_up',
  'Follow-up discussion after demo or to address questions',
  30,
  'teams',
  TRUE,
  24,
  3,
  4
),
(
  'Technical Deep Dive',
  'technical',
  'Technical discussion with IT or operations team',
  45,
  'teams',
  TRUE,
  24,
  3,
  4
),
(
  'Executive Briefing',
  'executive',
  'High-level presentation for executive stakeholders',
  30,
  'teams',
  TRUE,
  48,
  24,
  3
);
