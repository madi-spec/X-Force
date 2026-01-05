-- ============================================
-- MEETINGS PAGE REDESIGN - ACTION ITEMS TABLE
-- ============================================
-- This migration adds a proper action_items table for inline editing
-- and enhances the existing meetings infrastructure

-- 1. ACTION ITEMS TABLE
-- Tasks extracted from meetings or created manually
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('ai_generated', 'manual')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Action items indexes
CREATE INDEX IF NOT EXISTS idx_action_items_user ON action_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_items_activity ON action_items(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_transcription ON action_items(transcription_id) WHERE transcription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_action_items_due ON action_items(due_date, status) WHERE due_date IS NOT NULL AND status != 'done';

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_action_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS update_action_items_updated_at ON action_items;
CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION update_action_items_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view action items they created or are assigned to
CREATE POLICY "Users can view action items they own or are assigned"
  ON action_items FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = action_items.user_id
    )
    OR
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = action_items.assignee_id
    )
  );

-- Policy: Users can insert their own action items
CREATE POLICY "Users can insert their own action items"
  ON action_items FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = user_id
    )
  );

-- Policy: Users can update action items they own or are assigned to
CREATE POLICY "Users can update action items they own or are assigned"
  ON action_items FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = action_items.user_id
    )
    OR
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = action_items.assignee_id
    )
  );

-- Policy: Users can delete their own action items
CREATE POLICY "Users can delete their own action items"
  ON action_items FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = action_items.user_id
    )
  );

-- ============================================
-- ENHANCE MEETING_TRANSCRIPTIONS TABLE
-- ============================================

-- Add processing status columns if they don't exist
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'analyzed' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed'));
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 100 CHECK (processing_progress >= 0 AND processing_progress <= 100);
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add sentiment columns if they don't exist
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative'));
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS signals_count INTEGER DEFAULT 0;
ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS key_insights JSONB DEFAULT '[]'::jsonb;

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_transcriptions_status ON meeting_transcriptions(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_status ON meeting_transcriptions(user_id, status);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE action_items IS 'Stores action items extracted from meetings or created manually';
COMMENT ON COLUMN action_items.activity_id IS 'Reference to the meeting activity this action item came from';
COMMENT ON COLUMN action_items.transcription_id IS 'Reference to the transcript this action item was extracted from';
COMMENT ON COLUMN action_items.source IS 'Whether the action item was AI-generated or manually created';
COMMENT ON COLUMN action_items.status IS 'Current status: pending, in_progress, or done';
