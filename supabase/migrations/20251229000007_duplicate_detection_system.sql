-- Duplicate Detection System
-- Enables detection and merging of duplicate companies, contacts, and customers

-- Status enum for duplicate groups
DO $$ BEGIN
  CREATE TYPE duplicate_group_status AS ENUM (
    'pending',         -- Detected, awaiting review
    'merged',          -- Records merged
    'marked_separate', -- User confirmed as separate entities
    'auto_dismissed'   -- Auto-dismissed (low confidence)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Entity type enum
DO $$ BEGIN
  CREATE TYPE duplicate_entity_type AS ENUM (
    'company',
    'contact',
    'customer'  -- Note: customers are companies with customer_type set
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Duplicate detection confidence level
DO $$ BEGIN
  CREATE TYPE duplicate_confidence AS ENUM (
    'exact',      -- Exact match (domain, email, external ID)
    'high',       -- High confidence (normalized name + other signals)
    'medium',     -- Medium confidence (fuzzy name match)
    'low'         -- Low confidence (partial matches only)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main table for duplicate groups
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type duplicate_entity_type NOT NULL,
  confidence duplicate_confidence NOT NULL,
  status duplicate_group_status NOT NULL DEFAULT 'pending',

  -- Match metadata
  match_reason TEXT NOT NULL,           -- e.g., "Exact domain match", "Normalized name match"
  match_fields JSONB NOT NULL,          -- e.g., {"domain": "acme.com"} or {"normalized_name": "acmepest"}
  match_score NUMERIC(5,2),             -- 0-100 score

  -- Primary record (auto-selected or user-selected)
  primary_record_id UUID,               -- The "winner" record

  -- Resolution metadata
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,

  -- Audit
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_by TEXT DEFAULT 'background_scan',  -- 'background_scan' | 'manual_scan' | user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Members of each duplicate group
CREATE TABLE IF NOT EXISTS duplicate_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  record_id UUID NOT NULL,               -- ID of the company/contact

  -- Completeness scoring for auto-selection
  field_count INTEGER NOT NULL DEFAULT 0,  -- Number of non-null fields
  completeness_score NUMERIC(5,2),         -- 0-100 weighted score

  -- Flags
  is_primary BOOLEAN NOT NULL DEFAULT false,

  -- Record snapshot at detection time (for audit/history)
  record_snapshot JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(group_id, record_id)
);

-- Merge audit log
CREATE TABLE IF NOT EXISTS duplicate_merge_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES duplicate_groups(id),

  -- What was merged
  primary_record_id UUID NOT NULL,
  merged_record_ids UUID[] NOT NULL,

  -- Merge details
  merged_data JSONB NOT NULL,           -- Fields that were merged
  deleted_data JSONB NOT NULL,          -- Data from deleted records (for undo)

  -- Related record relocation counts
  relocation_counts JSONB,              -- {"contacts": 5, "deals": 2, ...}

  -- Audit
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  merged_by UUID REFERENCES users(id),

  -- Undo capability
  can_undo BOOLEAN NOT NULL DEFAULT true,
  undo_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_entity_type ON duplicate_groups(entity_type);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_confidence ON duplicate_groups(confidence);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_detected_at ON duplicate_groups(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_group ON duplicate_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_group_members_record ON duplicate_group_members(record_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_merge_log_group ON duplicate_merge_log(group_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_duplicate_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS duplicate_groups_updated_at ON duplicate_groups;
CREATE TRIGGER duplicate_groups_updated_at
  BEFORE UPDATE ON duplicate_groups
  FOR EACH ROW EXECUTE FUNCTION update_duplicate_groups_updated_at();

-- RLS Policies
ALTER TABLE duplicate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_merge_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write duplicate data
DROP POLICY IF EXISTS duplicate_groups_select ON duplicate_groups;
CREATE POLICY duplicate_groups_select ON duplicate_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_groups_insert ON duplicate_groups;
CREATE POLICY duplicate_groups_insert ON duplicate_groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_groups_update ON duplicate_groups;
CREATE POLICY duplicate_groups_update ON duplicate_groups
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_groups_delete ON duplicate_groups;
CREATE POLICY duplicate_groups_delete ON duplicate_groups
  FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_group_members_select ON duplicate_group_members;
CREATE POLICY duplicate_group_members_select ON duplicate_group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_group_members_insert ON duplicate_group_members;
CREATE POLICY duplicate_group_members_insert ON duplicate_group_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_group_members_update ON duplicate_group_members;
CREATE POLICY duplicate_group_members_update ON duplicate_group_members
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_merge_log_select ON duplicate_merge_log;
CREATE POLICY duplicate_merge_log_select ON duplicate_merge_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS duplicate_merge_log_insert ON duplicate_merge_log;
CREATE POLICY duplicate_merge_log_insert ON duplicate_merge_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add helpful comments
COMMENT ON TABLE duplicate_groups IS 'Stores detected duplicate groups for companies, contacts, and customers';
COMMENT ON TABLE duplicate_group_members IS 'Members of each duplicate group with completeness scores';
COMMENT ON TABLE duplicate_merge_log IS 'Audit log of merge operations for potential undo';
COMMENT ON COLUMN duplicate_groups.match_fields IS 'Fields that caused the match, e.g., {"domain": "acme.com"}';
COMMENT ON COLUMN duplicate_group_members.record_snapshot IS 'Snapshot of record at detection time for history';
