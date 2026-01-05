# Phase 1: Database Schema and Migrations

## Objective
Set up all database tables, indexes, and RLS policies needed for the Meetings page.

## Prerequisites
- Supabase project configured
- Database connection working
- Existing tables: organizations, users, customers, deals

---

## Step 1.1: Create Migration File

Create file: `supabase/migrations/[timestamp]_meetings_redesign.sql`

Use current timestamp format: `20250104120000_meetings_redesign.sql`

```sql
-- ============================================
-- MEETINGS PAGE REDESIGN - DATABASE MIGRATION
-- ============================================

-- 1. MEETINGS TABLE
-- Stores calendar meetings synced from external sources or created manually
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meeting_type TEXT DEFAULT 'video' CHECK (meeting_type IN ('video', 'phone', 'in_person')),
  meeting_url TEXT,
  external_id TEXT, -- ID from external calendar (Google, Outlook, etc.)
  external_source TEXT, -- google, outlook, etc.
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  excluded BOOLEAN DEFAULT FALSE,
  excluded_at TIMESTAMPTZ,
  excluded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MEETING ATTENDEES TABLE
-- Tracks who is attending each meeting
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  response_status TEXT DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined', 'tentative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEETING PREP TABLE
-- AI-generated preparation materials for upcoming meetings
CREATE TABLE IF NOT EXISTS meeting_prep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  suggested_questions JSONB DEFAULT '[]'::jsonb,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id)
);

-- 4. TRANSCRIPTS TABLE
-- Stores meeting transcripts from various sources
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  title TEXT,
  source TEXT NOT NULL CHECK (source IN ('fireflies', 'manual', 'zoom', 'teams', 'google_meet')),
  external_id TEXT, -- ID from source system
  raw_content TEXT,
  word_count INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed')),
  processing_progress INTEGER DEFAULT 0 CHECK (processing_progress >= 0 AND processing_progress <= 100),
  error_message TEXT,
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRANSCRIPT ANALYSIS TABLE
-- AI-generated analysis of transcripts
CREATE TABLE IF NOT EXISTS transcript_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  summary TEXT,
  key_insights JSONB DEFAULT '[]'::jsonb,
  sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  sentiment_score DECIMAL(3,2),
  signals_count INTEGER DEFAULT 0,
  signals JSONB DEFAULT '[]'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,
  speaker_breakdown JSONB DEFAULT '[]'::jsonb,
  full_analysis JSONB, -- Complete AI analysis output
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT, -- AI model identifier
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transcript_id)
);

-- 6. ACTION ITEMS TABLE
-- Tasks extracted from meetings or created manually
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  transcript_id UUID REFERENCES transcripts(id) ON DELETE SET NULL,
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

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_org_start ON meetings(organization_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_org_excluded ON meetings(organization_id, excluded, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_customer ON meetings(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_external ON meetings(external_source, external_id) WHERE external_id IS NOT NULL;

-- Meeting attendees indexes
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user ON meeting_attendees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_email ON meeting_attendees(email);

-- Transcripts indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_org ON transcripts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_transcripts_external ON transcripts(source, external_id) WHERE external_id IS NOT NULL;

-- Action items indexes
CREATE INDEX IF NOT EXISTS idx_action_items_org ON action_items(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_transcript ON action_items(transcript_id) WHERE transcript_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(organization_id, status);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_prep_updated_at ON meeting_prep;
CREATE TRIGGER update_meeting_prep_updated_at
  BEFORE UPDATE ON meeting_prep
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transcripts_updated_at ON transcripts;
CREATE TRIGGER update_transcripts_updated_at
  BEFORE UPDATE ON transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transcript_analysis_updated_at ON transcript_analysis;
CREATE TRIGGER update_transcript_analysis_updated_at
  BEFORE UPDATE ON transcript_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_action_items_updated_at ON action_items;
CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- Meetings policies
CREATE POLICY "Users can view meetings in their organization"
  ON meetings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert meetings in their organization"
  ON meetings FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update meetings in their organization"
  ON meetings FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete meetings in their organization"
  ON meetings FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Meeting attendees policies
CREATE POLICY "Users can view meeting attendees for accessible meetings"
  ON meeting_attendees FOR SELECT
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage meeting attendees for accessible meetings"
  ON meeting_attendees FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

-- Meeting prep policies
CREATE POLICY "Users can view meeting prep for accessible meetings"
  ON meeting_prep FOR SELECT
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage meeting prep for accessible meetings"
  ON meeting_prep FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

-- Transcripts policies
CREATE POLICY "Users can view transcripts in their organization"
  ON transcripts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage transcripts in their organization"
  ON transcripts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Transcript analysis policies
CREATE POLICY "Users can view analysis for accessible transcripts"
  ON transcript_analysis FOR SELECT
  USING (transcript_id IN (
    SELECT id FROM transcripts WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage analysis for accessible transcripts"
  ON transcript_analysis FOR ALL
  USING (transcript_id IN (
    SELECT id FROM transcripts WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

-- Action items policies
CREATE POLICY "Users can view action items in their organization"
  ON action_items FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage action items in their organization"
  ON action_items FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));
```

---

## Step 1.2: Create TypeScript Types

Create file: `types/meetings.ts`

```typescript
// ============================================
// MEETINGS PAGE - TYPE DEFINITIONS
// ============================================

export type MeetingType = 'video' | 'phone' | 'in_person';
export type ResponseStatus = 'pending' | 'accepted' | 'declined' | 'tentative';
export type TranscriptSource = 'fireflies' | 'manual' | 'zoom' | 'teams' | 'google_meet';
export type TranscriptStatus = 'pending' | 'processing' | 'analyzed' | 'failed';
export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
export type ActionItemStatus = 'pending' | 'in_progress' | 'done';
export type ActionItemSource = 'ai_generated' | 'manual';

// Database row types
export interface Meeting {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  meeting_type: MeetingType;
  meeting_url: string | null;
  external_id: string | null;
  external_source: string | null;
  customer_id: string | null;
  excluded: boolean;
  excluded_at: string | null;
  excluded_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  is_organizer: boolean;
  response_status: ResponseStatus;
  created_at: string;
}

export interface MeetingPrep {
  id: string;
  meeting_id: string;
  summary: string | null;
  key_points: string[];
  suggested_questions: string[];
  deal_id: string | null;
  generated_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  organization_id: string;
  meeting_id: string | null;
  title: string | null;
  source: TranscriptSource;
  external_id: string | null;
  raw_content: string | null;
  word_count: number;
  duration_seconds: number | null;
  status: TranscriptStatus;
  processing_progress: number;
  error_message: string | null;
  recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptAnalysis {
  id: string;
  transcript_id: string;
  summary: string | null;
  key_insights: string[];
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  signals_count: number;
  signals: Signal[];
  topics: Topic[];
  speaker_breakdown: SpeakerStats[];
  full_analysis: Record<string, unknown> | null;
  analyzed_at: string;
  analyzed_by: string | null;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  organization_id: string;
  meeting_id: string | null;
  transcript_id: string | null;
  text: string;
  assignee_id: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  completed_at: string | null;
  completed_by: string | null;
  source: ActionItemSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Nested/joined types
export interface Signal {
  type: string;
  text: string;
  timestamp?: string;
  confidence?: number;
}

export interface Topic {
  name: string;
  relevance: number;
  mentions: number;
}

export interface SpeakerStats {
  name: string;
  email?: string;
  talk_time_seconds: number;
  talk_time_percentage: number;
  word_count: number;
}

// API/UI types with relations
export interface MeetingWithDetails extends Meeting {
  customer?: {
    id: string;
    name: string;
  } | null;
  attendees: MeetingAttendee[];
  prep: MeetingPrep | null;
  transcript: TranscriptWithAnalysis | null;
  action_items: ActionItemWithAssignee[];
}

export interface TranscriptWithAnalysis extends Transcript {
  analysis: TranscriptAnalysis | null;
}

export interface ActionItemWithAssignee extends ActionItem {
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  } | null;
}

export interface ProcessingTranscript {
  id: string;
  meeting_id: string | null;
  title: string;
  status: TranscriptStatus;
  progress: number;
  word_count: number;
  source: TranscriptSource;
}

// Form/input types
export interface CreateMeetingInput {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  meeting_type?: MeetingType;
  meeting_url?: string;
  customer_id?: string;
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  meeting_type?: MeetingType;
  meeting_url?: string;
  customer_id?: string | null;
  excluded?: boolean;
}

export interface CreateActionItemInput {
  text: string;
  assignee_id?: string;
  due_date?: string;
  meeting_id?: string;
  transcript_id?: string;
}

export interface UpdateActionItemInput {
  text?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  status?: ActionItemStatus;
}

// Stats types
export interface MeetingsStats {
  today_count: number;
  this_week_count: number;
  analyzed_count: number;
  pending_actions_count: number;
}
```

---

## Step 1.3: Run Migration

Execute the migration:

```bash
# If using Supabase CLI locally
supabase db push

# Or if using direct connection
psql $DATABASE_URL -f supabase/migrations/20250104120000_meetings_redesign.sql
```

---

## Step 1.4: Seed Test Data (Optional)

Create file: `supabase/seed-meetings.sql`

```sql
-- Seed test data for development
-- Run this after migration if needed

-- Insert test meetings (adjust organization_id and user_id to match your data)
-- This is optional and can be skipped if you have real data
```

---

## Verification Checklist

Run these checks before proceeding to Phase 2:

### 1. Verify tables exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('meetings', 'meeting_attendees', 'meeting_prep', 'transcripts', 'transcript_analysis', 'action_items');
```
Expected: 6 rows

### 2. Verify indexes exist
```sql
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';
```
Expected: Multiple index rows

### 3. Verify RLS is enabled
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('meetings', 'meeting_attendees', 'meeting_prep', 'transcripts', 'transcript_analysis', 'action_items');
```
Expected: All rows show `rowsecurity = true`

### 4. Verify TypeScript types compile
```bash
npx tsc types/meetings.ts --noEmit
```
Expected: No errors

---

## Phase 1 Complete

Once all verification checks pass, proceed to `phase-2-api.md`.
