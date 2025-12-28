-- =============================================
-- Phase 8: Scheduler Admin Settings & Configuration
-- =============================================

-- Scheduler Settings Table
-- Stores global and per-user configuration for scheduling behavior
CREATE TABLE IF NOT EXISTS scheduler_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Scope: NULL = global defaults, user_id = per-user overrides
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Channel Strategy Settings
  channel_settings JSONB DEFAULT '{
    "default_start_channel": "email",
    "escalation_enabled": true,
    "escalation_after_attempts": 2,
    "escalation_after_days": 3,
    "sms_enabled": true,
    "phone_enabled": true,
    "max_attempts_per_channel": 3
  }'::jsonb,

  -- Reputation Guardrails
  guardrail_settings JSONB DEFAULT '{
    "default_daily_limit": 2,
    "default_weekly_limit": 5,
    "default_monthly_limit": 12,
    "cool_off_days_after_meeting": 14,
    "cool_off_days_after_rejection": 30,
    "respect_opt_outs": true
  }'::jsonb,

  -- Meeting Type Defaults
  meeting_defaults JSONB DEFAULT '{
    "discovery": { "duration": 30, "buffer_before": 5, "buffer_after": 5 },
    "demo": { "duration": 45, "buffer_before": 10, "buffer_after": 5 },
    "follow_up": { "duration": 30, "buffer_before": 5, "buffer_after": 5 },
    "technical": { "duration": 60, "buffer_before": 10, "buffer_after": 10 },
    "executive": { "duration": 45, "buffer_before": 15, "buffer_after": 10 }
  }'::jsonb,

  -- Email Settings
  email_settings JSONB DEFAULT '{
    "from_name_format": "{{rep_first_name}} from {{company_name}}",
    "include_social_proof": true,
    "max_time_slots_to_offer": 3,
    "include_calendar_link": true,
    "signature_style": "professional"
  }'::jsonb,

  -- Availability Settings
  availability_settings JSONB DEFAULT '{
    "working_hours_start": "09:00",
    "working_hours_end": "17:00",
    "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "timezone": "America/New_York",
    "slot_duration_minutes": 30,
    "min_notice_hours": 24,
    "max_advance_days": 14
  }'::jsonb,

  -- Automation Settings
  automation_settings JSONB DEFAULT '{
    "auto_send_reminders": true,
    "reminder_hours_before": [24, 1],
    "auto_detect_responses": true,
    "auto_confirm_meetings": false,
    "no_show_follow_up_enabled": true,
    "no_show_wait_minutes": 15
  }'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure only one global settings row and one per user
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Email Templates Table
CREATE TABLE IF NOT EXISTS scheduler_email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template identification
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Template type
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
    'initial_outreach',
    'follow_up',
    'confirmation',
    'reminder',
    'reschedule',
    'cancellation',
    'no_show_recovery',
    'custom'
  )),

  -- Meeting type this template is for (NULL = all types)
  meeting_type VARCHAR(50),

  -- Template content
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  -- Variables available in this template
  available_variables JSONB DEFAULT '[]'::jsonb,

  -- Tone/style
  tone VARCHAR(50) DEFAULT 'professional',

  -- A/B testing
  is_variant BOOLEAN DEFAULT FALSE,
  parent_template_id UUID REFERENCES scheduler_email_templates(id) ON DELETE CASCADE,
  variant_name VARCHAR(50),
  variant_weight INTEGER DEFAULT 50, -- percentage weight for A/B testing

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,

  -- Ownership
  created_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasonality Overrides Table
-- Allows admins to mark specific dates/periods
CREATE TABLE IF NOT EXISTS scheduler_seasonality_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Date range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Override type
  override_type VARCHAR(50) NOT NULL CHECK (override_type IN (
    'holiday',
    'slow_period',
    'busy_period',
    'blackout',
    'conference',
    'custom'
  )),

  -- Settings
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Behavior adjustments
  adjustments JSONB DEFAULT '{
    "patience_multiplier": 1.0,
    "reduce_frequency": false,
    "pause_outreach": false,
    "custom_message": null
  }'::jsonb,

  -- Scope
  applies_to_industries TEXT[], -- NULL = all industries

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Ownership
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Social Proof Library Table
CREATE TABLE IF NOT EXISTS scheduler_social_proof_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Proof type
  proof_type VARCHAR(50) NOT NULL CHECK (proof_type IN (
    'testimonial',
    'case_study',
    'statistic',
    'award',
    'certification',
    'client_logo',
    'roi_metric'
  )),

  -- Content
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  short_version TEXT, -- For email snippets

  -- Attribution
  source_company VARCHAR(200),
  source_person VARCHAR(200),
  source_title VARCHAR(200),

  -- Targeting
  target_industries TEXT[],
  target_company_sizes TEXT[], -- smb, mid_market, enterprise
  target_personas TEXT[],

  -- Metrics (for ROI/statistics)
  metric_value VARCHAR(50),
  metric_label VARCHAR(100),

  -- Media
  logo_url TEXT,
  image_url TEXT,

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Ownership
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_settings_user ON scheduler_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON scheduler_email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_meeting ON scheduler_email_templates(meeting_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON scheduler_email_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_seasonality_dates ON scheduler_seasonality_overrides(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_seasonality_active ON scheduler_seasonality_overrides(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_social_proof_type ON scheduler_social_proof_library(proof_type);
CREATE INDEX IF NOT EXISTS idx_social_proof_active ON scheduler_social_proof_library(is_active) WHERE is_active = TRUE;

-- Insert global default settings
INSERT INTO scheduler_settings (user_id)
VALUES (NULL)
ON CONFLICT DO NOTHING;

-- Insert default email templates
INSERT INTO scheduler_email_templates (name, slug, template_type, subject_template, body_template, available_variables, is_default) VALUES
(
  'Initial Outreach',
  'initial-outreach-default',
  'initial_outreach',
  'Quick call about {{company_name}}''s growth?',
  E'Hi {{contact_first_name}},\n\nI noticed {{company_name}} has been {{personalization_hook}}. I work with similar companies to help them {{value_proposition}}.\n\nWould you have 15-20 minutes this week to explore if there''s a fit?\n\nHere are a few times that work on my end:\n{{time_slots}}\n\nBest,\n{{rep_first_name}}',
  '["contact_first_name", "contact_last_name", "company_name", "personalization_hook", "value_proposition", "time_slots", "rep_first_name", "rep_last_name", "rep_title"]',
  TRUE
),
(
  'Follow Up',
  'follow-up-default',
  'follow_up',
  'Re: {{previous_subject}}',
  E'Hi {{contact_first_name}},\n\nJust wanted to follow up on my previous note. I know you''re busy, so I''ll keep this brief.\n\n{{follow_up_hook}}\n\nDo any of these times work for a quick chat?\n{{time_slots}}\n\nBest,\n{{rep_first_name}}',
  '["contact_first_name", "previous_subject", "follow_up_hook", "time_slots", "rep_first_name"]',
  TRUE
),
(
  'Meeting Confirmation',
  'confirmation-default',
  'confirmation',
  'Confirmed: {{meeting_title}} on {{meeting_date}}',
  E'Hi {{contact_first_name}},\n\nGreat! Our meeting is confirmed:\n\n📅 {{meeting_date}} at {{meeting_time}}\n⏱️ {{meeting_duration}} minutes\n📍 {{meeting_location}}\n\n{{meeting_prep_notes}}\n\nLooking forward to speaking with you!\n\nBest,\n{{rep_first_name}}',
  '["contact_first_name", "meeting_title", "meeting_date", "meeting_time", "meeting_duration", "meeting_location", "meeting_prep_notes", "rep_first_name"]',
  TRUE
),
(
  'Meeting Reminder',
  'reminder-default',
  'reminder',
  'Reminder: Our call {{reminder_timeframe}}',
  E'Hi {{contact_first_name}},\n\nJust a friendly reminder about our call {{reminder_timeframe}}:\n\n📅 {{meeting_date}} at {{meeting_time}}\n📍 {{meeting_location}}\n\n{{meeting_agenda}}\n\nSee you soon!\n\n{{rep_first_name}}',
  '["contact_first_name", "reminder_timeframe", "meeting_date", "meeting_time", "meeting_location", "meeting_agenda", "rep_first_name"]',
  TRUE
),
(
  'No-Show Recovery',
  'no-show-recovery-default',
  'no_show_recovery',
  'Missed you today - let''s reschedule',
  E'Hi {{contact_first_name}},\n\nI was looking forward to our call today but it looks like we missed each other. No worries - I know things come up!\n\nWould any of these times work to reconnect?\n{{time_slots}}\n\nBest,\n{{rep_first_name}}',
  '["contact_first_name", "time_slots", "rep_first_name"]',
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- Insert common seasonality entries
INSERT INTO scheduler_seasonality_overrides (start_date, end_date, override_type, name, description, adjustments) VALUES
('2024-12-23', '2025-01-02', 'holiday', 'Winter Holidays', 'Christmas through New Year', '{"patience_multiplier": 2.0, "reduce_frequency": true, "pause_outreach": false}'),
('2024-11-28', '2024-11-29', 'holiday', 'Thanksgiving', 'Thanksgiving holiday', '{"patience_multiplier": 1.5, "reduce_frequency": true, "pause_outreach": false}'),
('2024-07-04', '2024-07-04', 'holiday', 'Independence Day', 'July 4th holiday', '{"patience_multiplier": 1.2, "reduce_frequency": false, "pause_outreach": false}'),
('2024-08-01', '2024-08-31', 'slow_period', 'Summer Slowdown', 'August vacation season', '{"patience_multiplier": 1.5, "reduce_frequency": true, "pause_outreach": false}')
ON CONFLICT DO NOTHING;

-- Function to get effective settings for a user
CREATE OR REPLACE FUNCTION get_scheduler_settings(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_global_settings JSONB;
  v_user_settings JSONB;
  v_result JSONB;
BEGIN
  -- Get global defaults
  SELECT jsonb_build_object(
    'channel_settings', channel_settings,
    'guardrail_settings', guardrail_settings,
    'meeting_defaults', meeting_defaults,
    'email_settings', email_settings,
    'availability_settings', availability_settings,
    'automation_settings', automation_settings
  ) INTO v_global_settings
  FROM scheduler_settings
  WHERE user_id IS NULL;

  -- If no user specified, return global
  IF p_user_id IS NULL THEN
    RETURN COALESCE(v_global_settings, '{}'::jsonb);
  END IF;

  -- Get user overrides
  SELECT jsonb_build_object(
    'channel_settings', channel_settings,
    'guardrail_settings', guardrail_settings,
    'meeting_defaults', meeting_defaults,
    'email_settings', email_settings,
    'availability_settings', availability_settings,
    'automation_settings', automation_settings
  ) INTO v_user_settings
  FROM scheduler_settings
  WHERE user_id = p_user_id;

  -- Merge: user settings override global
  IF v_user_settings IS NOT NULL THEN
    v_result := v_global_settings || v_user_settings;
  ELSE
    v_result := v_global_settings;
  END IF;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to get active seasonality for a date
CREATE OR REPLACE FUNCTION get_active_seasonality(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id UUID,
  override_type VARCHAR,
  name VARCHAR,
  adjustments JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    so.id,
    so.override_type,
    so.name,
    so.adjustments
  FROM scheduler_seasonality_overrides so
  WHERE so.is_active = TRUE
    AND p_date BETWEEN so.start_date AND so.end_date
  ORDER BY
    CASE so.override_type
      WHEN 'blackout' THEN 1
      WHEN 'holiday' THEN 2
      WHEN 'slow_period' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_scheduler_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_scheduler_settings_updated
  BEFORE UPDATE ON scheduler_settings
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_settings_timestamp();

CREATE TRIGGER trigger_email_templates_updated
  BEFORE UPDATE ON scheduler_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_settings_timestamp();

CREATE TRIGGER trigger_seasonality_updated
  BEFORE UPDATE ON scheduler_seasonality_overrides
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_settings_timestamp();

CREATE TRIGGER trigger_social_proof_updated
  BEFORE UPDATE ON scheduler_social_proof_library
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_settings_timestamp();
