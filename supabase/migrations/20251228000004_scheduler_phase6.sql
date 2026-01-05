-- ============================================
-- AI SCHEDULER PHASE 6: VALUE-ADD & LEARNING
-- ============================================

-- ============================================
-- SOCIAL PROOF LIBRARY
-- ============================================

CREATE TABLE IF NOT EXISTS social_proof_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  type VARCHAR(50) NOT NULL, -- 'case_study', 'stat', 'testimonial', 'resource', 'industry_insight'
  title VARCHAR(500),
  content TEXT NOT NULL,
  source VARCHAR(255),
  link TEXT,

  -- Relevance targeting
  relevant_for JSONB NOT NULL DEFAULT '{}',
  -- {
  --   ownership_types: ['family', 'pe_backed'],
  --   company_size: { min: 10, max: 100 },
  --   pain_points: ['missed_calls', 'after_hours'],
  --   products: ['ai_receptionist'],
  --   industries: ['pest_control']
  -- }

  -- Tracking
  times_used INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  scheduling_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4), -- response_count / times_used

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track social proof usage in scheduling
CREATE TABLE IF NOT EXISTS scheduling_social_proof_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  social_proof_id UUID REFERENCES social_proof_library(id),

  attempt_number INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Outcome tracking
  led_to_response BOOLEAN,
  led_to_scheduling BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEASONALITY PATTERNS
-- ============================================

CREATE TABLE IF NOT EXISTS seasonality_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Geographic scope
  state VARCHAR(2),  -- NULL for national
  region VARCHAR(50), -- 'northeast', 'southwest', etc.

  -- Time scope
  month INTEGER CHECK (month >= 1 AND month <= 12),
  week_of_month INTEGER CHECK (week_of_month >= 1 AND week_of_month <= 5),

  -- Pattern data
  business_level VARCHAR(20), -- 'peak', 'high', 'normal', 'low', 'slow'
  scheduling_difficulty DECIMAL(3,2), -- 0.00 to 1.00, higher = harder
  recommended_approach TEXT,
  avoid_days TEXT[], -- e.g., ['monday', 'friday']
  best_times TEXT[], -- e.g., ['early_morning', 'late_afternoon']

  -- Learning
  based_on_samples INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHAMPION TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS champion_involvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  champion_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  involvement_type VARCHAR(50) NOT NULL, -- 'cc_on_email', 'intro_request', 'direct_outreach', 'internal_nudge'
  attempt_number INTEGER,
  requested_at TIMESTAMPTZ DEFAULT NOW(),

  -- Outcome
  champion_responded BOOLEAN,
  champion_helped BOOLEAN,
  outcome_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEDULING POSTMORTEMS
-- ============================================

CREATE TABLE IF NOT EXISTS scheduling_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE UNIQUE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Outcome
  outcome VARCHAR(20) NOT NULL, -- 'meeting_held', 'no_show', 'cancelled', 'never_scheduled'
  meeting_held_at TIMESTAMPTZ,
  total_days_to_schedule INTEGER,
  total_attempts INTEGER,

  -- What happened
  channels_used TEXT[],
  de_escalated BOOLEAN DEFAULT FALSE,
  social_proof_used BOOLEAN DEFAULT FALSE,
  champion_involved BOOLEAN DEFAULT FALSE,
  persona_detected VARCHAR(50),

  -- Context at time of scheduling
  meeting_type VARCHAR(50),
  duration_minutes INTEGER,
  company_size INTEGER,
  ownership_type VARCHAR(50),

  -- AI-generated learnings
  what_worked JSONB DEFAULT '[]',
  what_failed JSONB DEFAULT '[]',
  learnings_for_account JSONB DEFAULT '[]',
  learnings_for_meeting_type JSONB DEFAULT '[]',
  learnings_for_season JSONB DEFAULT '[]',
  key_insight TEXT,

  -- Scoring
  scheduling_efficiency_score DECIMAL(5,2), -- 0-100
  relationship_health_score DECIMAL(5,2), -- 0-100

  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_social_proof_active
  ON social_proof_library(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_social_proof_type
  ON social_proof_library(type);

CREATE INDEX IF NOT EXISTS idx_social_proof_usage_request
  ON scheduling_social_proof_usage(scheduling_request_id);

CREATE INDEX IF NOT EXISTS idx_social_proof_usage_proof
  ON scheduling_social_proof_usage(social_proof_id);

CREATE INDEX IF NOT EXISTS idx_seasonality_state_month
  ON seasonality_patterns(state, month);

CREATE INDEX IF NOT EXISTS idx_champion_involvement_request
  ON champion_involvements(scheduling_request_id);

CREATE INDEX IF NOT EXISTS idx_postmortems_outcome
  ON scheduling_postmortems(outcome);

CREATE INDEX IF NOT EXISTS idx_postmortems_meeting_type
  ON scheduling_postmortems(meeting_type);

CREATE INDEX IF NOT EXISTS idx_postmortems_created
  ON scheduling_postmortems(created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE social_proof_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_social_proof_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonality_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE champion_involvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_postmortems ENABLE ROW LEVEL SECURITY;

-- Everyone can read social proof
CREATE POLICY "Authenticated users can read social proof"
  ON social_proof_library FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read social proof usage"
  ON scheduling_social_proof_usage FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read seasonality"
  ON seasonality_patterns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read champion involvements"
  ON champion_involvements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read postmortems"
  ON scheduling_postmortems FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role full access
CREATE POLICY "Service role full access to social_proof_library"
  ON social_proof_library FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to scheduling_social_proof_usage"
  ON scheduling_social_proof_usage FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to seasonality_patterns"
  ON seasonality_patterns FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to champion_involvements"
  ON champion_involvements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to scheduling_postmortems"
  ON scheduling_postmortems FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- SEED DATA: SOCIAL PROOF
-- ============================================

INSERT INTO social_proof_library (type, title, content, source, relevant_for) VALUES
-- Case studies
('case_study', 'Family-Owned Pest Company Cuts Call Abandonment by 15%',
 'ABC Pest, a family-owned company with 12 trucks, reduced missed calls from 18% to 3% in just 6 weeks after implementing AI-powered call handling.',
 'X-RAI Customer Success',
 '{"ownership_types": ["family", "independent"], "pain_points": ["missed_calls", "after_hours", "call_volume"], "company_size": {"min": 5, "max": 50}}'::jsonb),

('case_study', 'PE-Backed Consolidator Saves 40 Hours Per Month',
 'A multi-location pest control operator with 8 branches automated their scheduling workflow, freeing up 40+ admin hours monthly and reducing booking errors by 92%.',
 'X-RAI Customer Success',
 '{"ownership_types": ["pe_backed", "corporate"], "company_size": {"min": 50}}'::jsonb),

('case_study', 'Single-Office Company Doubles After-Hours Bookings',
 'A 3-technician operation started capturing 2x more after-hours service requests using AI call handling, adding $4,200/month in new revenue.',
 'X-RAI Customer Success',
 '{"ownership_types": ["independent", "family"], "company_size": {"min": 1, "max": 10}, "pain_points": ["after_hours", "missed_calls"]}'::jsonb),

-- Stats
('stat', '78% of Customers Choose the First Company That Answers',
 'Research shows 78% of customers hire the first service company that picks up their call. Every missed call is likely a lost customer.',
 'PCT Magazine Industry Report',
 '{"pain_points": ["missed_calls", "call_volume"]}'::jsonb),

('stat', 'Average Pest Control Company Misses 23% of Calls',
 'Industry data shows the average pest control company misses nearly 1 in 4 calls, with most occurring during peak service hours and after 5pm.',
 'ServiceTitan Industry Benchmark',
 '{"pain_points": ["missed_calls", "after_hours"]}'::jsonb),

('stat', '67% of Service Calls Come During Business Hours',
 'While most calls come during business hours, your technicians are in the field. AI handling ensures every call gets answered professionally.',
 'Industry Analysis',
 '{"pain_points": ["call_volume", "busy_season"]}'::jsonb),

-- Testimonials
('testimonial', 'Owner Testimonial: Finally Taking Vacations',
 '"For the first time in 15 years, I took a real vacation. The AI handled everything - scheduling, emergencies, the works. Came back to a full calendar." - Mike R., Owner',
 'Customer Interview',
 '{"ownership_types": ["family", "independent"], "company_size": {"min": 1, "max": 20}}'::jsonb),

('testimonial', 'Operations Manager: Cut Training Time in Half',
 '"New office staff used to take 3 months to learn our booking system. Now they focus on customer relationships while AI handles the calls." - Sarah T., Ops Manager',
 'Customer Interview',
 '{"company_size": {"min": 20}}'::jsonb),

-- Industry insights
('industry_insight', 'Spring Rush Preparation Guide',
 'Top-performing pest companies start their spring outreach in February. Early scheduling means full calendars when the rush hits.',
 'X-RAI Seasonal Guide',
 '{"seasons": ["q1", "spring"]}'::jsonb),

('industry_insight', 'Termite Season Booking Patterns',
 'Termite inspection requests spike 340% between March and May. Companies with AI scheduling capture 2x more bookings during peak.',
 'Industry Analysis',
 '{"products": ["termite_inspection", "termite_treatment"], "seasons": ["spring"]}'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================
-- SEED DATA: SEASONALITY
-- ============================================

INSERT INTO seasonality_patterns (state, month, business_level, scheduling_difficulty, recommended_approach, best_times) VALUES
-- National patterns
(NULL, 1, 'slow', 0.30, 'Focus on prevention contracts and annual renewals', ARRAY['mid_morning', 'early_afternoon']),
(NULL, 2, 'low', 0.35, 'Start spring preparation outreach', ARRAY['mid_morning', 'early_afternoon']),
(NULL, 3, 'normal', 0.50, 'Ramp up - termite and ant season beginning', ARRAY['early_morning', 'late_afternoon']),
(NULL, 4, 'high', 0.70, 'Peak scheduling difficulty - be flexible on times', ARRAY['early_morning', 'lunch']),
(NULL, 5, 'peak', 0.85, 'Expect delays - offer multiple week options', ARRAY['early_morning']),
(NULL, 6, 'peak', 0.85, 'Peak season continues - persistence needed', ARRAY['early_morning', 'after_hours']),
(NULL, 7, 'high', 0.75, 'Still busy - mosquito and wasp calls', ARRAY['early_morning', 'late_afternoon']),
(NULL, 8, 'high', 0.70, 'Back to school rush ending', ARRAY['mid_morning', 'early_afternoon']),
(NULL, 9, 'normal', 0.50, 'Fall prep - good time for demos', ARRAY['mid_morning', 'early_afternoon']),
(NULL, 10, 'normal', 0.45, 'Rodent season pickup - good responsiveness', ARRAY['any']),
(NULL, 11, 'low', 0.35, 'Slowdown beginning - holiday schedules', ARRAY['mid_morning']),
(NULL, 12, 'slow', 0.25, 'Holiday season - expect delays around holidays', ARRAY['mid_morning'])

ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE social_proof_library IS 'Library of case studies, stats, testimonials for value-add follow-ups';
COMMENT ON TABLE scheduling_social_proof_usage IS 'Tracks which social proof was used in scheduling attempts';
COMMENT ON TABLE seasonality_patterns IS 'Seasonal business patterns for scheduling optimization';
COMMENT ON TABLE champion_involvements IS 'Tracks when champions are involved in scheduling';
COMMENT ON TABLE scheduling_postmortems IS 'Post-scheduling analysis and learnings';

-- ============================================
-- RPC FUNCTIONS FOR SOCIAL PROOF TRACKING
-- ============================================

-- Increment times_used counter
CREATE OR REPLACE FUNCTION increment_social_proof_usage(proof_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE social_proof_library
  SET times_used = COALESCE(times_used, 0) + 1,
      updated_at = NOW()
  WHERE id = proof_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment response_count and update conversion rate
CREATE OR REPLACE FUNCTION increment_social_proof_response(proof_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE social_proof_library
  SET response_count = COALESCE(response_count, 0) + 1,
      conversion_rate = CASE
        WHEN COALESCE(times_used, 0) > 0
        THEN (COALESCE(response_count, 0) + 1)::DECIMAL / times_used
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = proof_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment scheduling_count
CREATE OR REPLACE FUNCTION increment_social_proof_scheduling(proof_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE social_proof_library
  SET scheduling_count = COALESCE(scheduling_count, 0) + 1,
      updated_at = NOW()
  WHERE id = proof_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
