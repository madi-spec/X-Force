-- Migration: Communication Notes
-- Adds a notes table for communications to track actions and notes

-- ============================================
-- Communication Notes Table
-- ============================================
CREATE TABLE IF NOT EXISTS communication_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Note content
  note_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'action', 'system'
  action_type TEXT, -- 'marked_done', 'resolved_flag', 'snoozed', 'sent_email', 'scheduled_meeting', etc.
  content TEXT NOT NULL,

  -- Optional references
  attention_flag_id UUID REFERENCES attention_flags(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communication_notes_communication_id ON communication_notes(communication_id);
CREATE INDEX IF NOT EXISTS idx_communication_notes_user_id ON communication_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_notes_created_at ON communication_notes(created_at DESC);

-- RLS
ALTER TABLE communication_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view communication notes" ON communication_notes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert communication notes" ON communication_notes
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Add has_open_tasks computed column helper
-- ============================================
-- This will be computed via a join, not a stored column

COMMENT ON TABLE communication_notes IS 'Notes and action logs for communications';
COMMENT ON COLUMN communication_notes.note_type IS 'Type of note: manual (user added), action (Daily Driver action), system (automated)';
COMMENT ON COLUMN communication_notes.action_type IS 'For action notes: marked_done, resolved_flag, snoozed, sent_email, scheduled_meeting, etc.';
