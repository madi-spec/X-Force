# Communication Hub: Phase 1 Implementation

## Overview

Build the foundation for the unified Communication Hub. This phase creates the database schema and basic adapters.

**Spec:** Read `/docs/specs/X-FORCE-Communication-Hub-Specification-v2.md` for full context.

**Core Principle:**
```
Communications = FACTS (immutable events)
Analysis = OPINIONS (versioned, replaceable)
Prioritization = JUDGMENT (CC engine decides tier)
```

---

## Phase 1 Tasks

### Task 1: Create Database Migration

Create `supabase/migrations/20251224_communication_hub.sql`:

```sql
-- 1. COMMUNICATIONS TABLE (Facts - immutable events)
CREATE TABLE communications (
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
CREATE TABLE communication_analysis (
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
CREATE TABLE promises (
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
CREATE INDEX idx_comm_company_time ON communications(company_id, occurred_at DESC);
CREATE INDEX idx_comm_contact_time ON communications(contact_id, occurred_at DESC);
CREATE INDEX idx_comm_deal_time ON communications(deal_id, occurred_at DESC);
CREATE INDEX idx_comm_user_time ON communications(user_id, occurred_at DESC);
CREATE INDEX idx_comm_channel ON communications(channel);
CREATE INDEX idx_comm_direction ON communications(direction);
CREATE INDEX idx_comm_ai_generated ON communications(is_ai_generated) WHERE is_ai_generated = true;
CREATE INDEX idx_comm_awaiting_us ON communications(awaiting_our_response, response_due_by) WHERE awaiting_our_response = true;
CREATE INDEX idx_comm_source ON communications(source_table, source_id);
CREATE INDEX idx_comm_thread ON communications(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_comm_analysis_pending ON communications(analysis_status) WHERE analysis_status = 'pending';

-- Analysis indexes
CREATE UNIQUE INDEX idx_analysis_current ON communication_analysis(communication_id) WHERE is_current = TRUE;
CREATE INDEX idx_analysis_communication ON communication_analysis(communication_id, version DESC);

-- Promises indexes
CREATE INDEX idx_promises_owner ON promises(owner_user_id, status, due_by);
CREATE INDEX idx_promises_company ON promises(company_id, status, due_by);
CREATE INDEX idx_promises_overdue ON promises(status, due_by) WHERE status = 'pending';
CREATE INDEX idx_promises_source ON promises(source_communication_id);

-- 5. TRIGGERS

CREATE OR REPLACE FUNCTION update_communications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER communications_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_communications_timestamp();

CREATE TRIGGER promises_updated_at
  BEFORE UPDATE ON promises
  FOR EACH ROW
  EXECUTE FUNCTION update_communications_timestamp();
```

### Task 2: Create TypeScript Types

Create `src/types/communicationHub.ts`:

```typescript
export interface Communication {
  id: string;
  
  // Relationships
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;
  
  // Channel
  channel: 'email' | 'call' | 'meeting' | 'sms' | 'chat' | 'note';
  direction: 'inbound' | 'outbound' | 'internal';
  
  // Participants
  our_participants: Participant[];
  their_participants: Participant[];
  
  // AI Provenance
  is_ai_generated: boolean;
  ai_action_type: string | null;
  ai_initiated_by: string | null;
  ai_approved_by: string | null;
  ai_model_used: string | null;
  
  // Timing
  occurred_at: string;
  duration_seconds: number | null;
  
  // Content
  subject: string | null;
  content_preview: string | null;
  full_content: string | null;
  content_html: string | null;
  attachments: Attachment[];
  recording_url: string | null;
  
  // Source
  source_table: string | null;
  source_id: string | null;
  external_id: string | null;
  thread_id: string | null;
  in_reply_to: string | null;
  
  // Response State
  awaiting_our_response: boolean;
  awaiting_their_response: boolean;
  response_due_by: string | null;
  response_sla_minutes: number | null;
  responded_at: string | null;
  response_communication_id: string | null;
  
  // Email Engagement
  email_opened_at: string | null;
  email_clicked_at: string | null;
  email_bounced: boolean;
  
  // User Tags
  tags: string[];
  is_starred: boolean;
  is_archived: boolean;
  
  // Analysis
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  current_analysis_id: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface Participant {
  user_id?: string;
  contact_id?: string;
  name: string;
  email?: string;
  title?: string;
  role?: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface CommunicationAnalysis {
  id: string;
  communication_id: string;
  
  // Version
  version: number;
  is_current: boolean;
  model_used: string | null;
  prompt_version: string | null;
  
  // Summary
  summary: string | null;
  communication_type: string | null;
  products_discussed: string[];
  
  // Sentiment
  sentiment: 'positive' | 'neutral' | 'negative' | 'concerned' | 'excited' | null;
  sentiment_score: number | null;
  sentiment_confidence: number | null;
  
  // Extracted Intelligence
  extracted_facts: ExtractedFact[];
  extracted_signals: ExtractedSignal[];
  extracted_objections: ExtractedObjection[];
  extracted_commitments_us: ExtractedCommitment[];
  extracted_commitments_them: ExtractedCommitment[];
  extracted_competitors: ExtractedCompetitor[];
  extracted_next_steps: ExtractedNextStep[];
  
  // Triggers
  potential_triggers: string[];
  
  // Timestamps
  analyzed_at: string;
  created_at: string;
}

export interface ExtractedFact {
  fact: string;
  confidence: number;
  quote?: string;
}

export interface ExtractedSignal {
  signal: string;
  detail: string;
  confidence: number;
  quote?: string;
}

export interface ExtractedObjection {
  objection: string;
  detail: string;
  confidence: number;
  addressed: boolean;
}

export interface ExtractedCommitment {
  commitment: string;
  confidence: number;
  due_by?: string;
  owner?: string;  // For us
  who?: string;    // For them
  status: 'pending' | 'completed' | 'overdue';
}

export interface ExtractedCompetitor {
  competitor: string;
  context: string;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface ExtractedNextStep {
  step: string;
  owner: 'us' | 'them';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

export interface Promise {
  id: string;
  direction: 'we_promised' | 'they_promised';
  promise_text: string;
  
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  
  owner_user_id: string | null;
  owner_name: string | null;
  promiser_contact_id: string | null;
  promiser_name: string | null;
  
  promised_at: string;
  due_by: string | null;
  
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  completed_at: string | null;
  completed_communication_id: string | null;
  
  source_communication_id: string | null;
  source_analysis_id: string | null;
  confidence: number | null;
  
  is_hidden: boolean;
  
  created_at: string;
  updated_at: string;
}

// Confidence thresholds for display
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,      // Show prominently, can trigger CC
  MEDIUM: 0.70,    // Show with "Possible" prefix
  LOW: 0.70,       // Hide by default
} as const;

// Filter helper
export function filterByConfidence<T extends { confidence: number }>(
  items: T[],
  threshold: number = CONFIDENCE_THRESHOLDS.MEDIUM
): T[] {
  return items.filter(item => item.confidence >= threshold);
}
```

### Task 3: Create Email Adapter

Create `src/lib/communicationHub/adapters/emailAdapter.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { Communication } from '@/types/communicationHub';

interface EmailMessage {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  to_name: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_sent_by_user: boolean;
  conversation_id: string | null;
  message_id: string | null;
  attachments: any[];
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;
}

export function emailToCommunication(email: EmailMessage): Partial<Communication> {
  const isOutbound = email.is_sent_by_user;
  
  return {
    // Channel
    channel: 'email',
    direction: isOutbound ? 'outbound' : 'inbound',
    
    // Timing
    occurred_at: email.received_at || email.sent_at || new Date().toISOString(),
    
    // Content
    subject: email.subject,
    content_preview: email.body_text?.substring(0, 500) || null,
    full_content: email.body_text,
    content_html: email.body_html,
    attachments: email.attachments || [],
    
    // Participants
    our_participants: isOutbound
      ? [{ email: email.from_email || '', name: email.from_name || '', role: 'sender' }]
      : [{ email: email.to_email || '', name: email.to_name || '', role: 'recipient' }],
    their_participants: isOutbound
      ? [{ email: email.to_email || '', name: email.to_name || '' }]
      : [{ email: email.from_email || '', name: email.from_name || '' }],
    
    // Source
    source_table: 'email_messages',
    source_id: email.id,
    external_id: email.message_id,
    thread_id: email.conversation_id,
    
    // Response state (inbound = awaiting our response)
    awaiting_our_response: !isOutbound,
    awaiting_their_response: isOutbound,
    response_sla_minutes: !isOutbound ? 240 : null,  // 4 hour default SLA for inbound
    response_due_by: !isOutbound 
      ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() 
      : null,
    
    // Relationships
    company_id: email.company_id,
    contact_id: email.contact_id,
    deal_id: email.deal_id,
    user_id: email.user_id,
    
    // AI
    is_ai_generated: false,
    
    // Analysis pending
    analysis_status: 'pending',
  };
}

export async function syncEmailToCommunications(emailId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // Fetch email
  const { data: email, error: emailError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();
  
  if (emailError || !email) {
    console.error(`[EmailAdapter] Email not found: ${emailId}`, emailError);
    return null;
  }
  
  // Check if already synced
  const { data: existing } = await supabase
    .from('communications')
    .select('id')
    .eq('source_table', 'email_messages')
    .eq('source_id', emailId)
    .single();
  
  if (existing) {
    return existing.id;
  }
  
  // Convert and insert
  const communication = emailToCommunication(email);
  
  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();
  
  if (insertError) {
    console.error(`[EmailAdapter] Failed to insert communication:`, insertError);
    return null;
  }
  
  console.log(`[EmailAdapter] Synced email ${emailId} → communication ${inserted.id}`);
  return inserted.id;
}

export async function syncAllEmailsToCommunications(
  options?: { limit?: number; since?: string }
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();
  
  let query = supabase
    .from('email_messages')
    .select('id')
    .order('received_at', { ascending: true });
  
  if (options?.since) {
    query = query.gte('received_at', options.since);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  const { data: emails, error } = await query;
  
  if (error || !emails) {
    console.error('[EmailAdapter] Failed to fetch emails:', error);
    return { synced: 0, errors: 1 };
  }
  
  let synced = 0;
  let errors = 0;
  
  for (const email of emails) {
    const result = await syncEmailToCommunications(email.id);
    if (result) {
      synced++;
    } else {
      errors++;
    }
  }
  
  console.log(`[EmailAdapter] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}
```

### Task 4: Create Transcript Adapter

Create `src/lib/communicationHub/adapters/transcriptAdapter.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { Communication } from '@/types/communicationHub';

interface MeetingTranscription {
  id: string;
  title: string | null;
  meeting_date: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript_text: string | null;
  video_url: string | null;
  audio_url: string | null;
  fireflies_id: string | null;
  attendees: any[];
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;
}

export function transcriptToCommunication(transcript: MeetingTranscription): Partial<Communication> {
  // Parse attendees into our/their
  const attendees = transcript.attendees || [];
  const ourParticipants = attendees
    .filter((a: any) => a.is_internal)
    .map((a: any) => ({ name: a.name, email: a.email, role: a.role || 'attendee' }));
  const theirParticipants = attendees
    .filter((a: any) => !a.is_internal)
    .map((a: any) => ({ name: a.name, email: a.email, title: a.title }));
  
  return {
    // Channel
    channel: 'meeting',
    direction: 'internal',  // Meetings are bidirectional
    
    // Timing
    occurred_at: transcript.meeting_date || new Date().toISOString(),
    duration_seconds: transcript.duration_seconds,
    
    // Content
    subject: transcript.title,
    content_preview: transcript.summary?.substring(0, 500) || null,
    full_content: transcript.transcript_text,
    recording_url: transcript.video_url || transcript.audio_url,
    
    // Participants
    our_participants: ourParticipants,
    their_participants: theirParticipants,
    
    // Source
    source_table: 'meeting_transcriptions',
    source_id: transcript.id,
    external_id: transcript.fireflies_id,
    
    // Response state (meetings don't wait for response)
    awaiting_our_response: false,
    awaiting_their_response: false,
    
    // Relationships
    company_id: transcript.company_id,
    contact_id: transcript.contact_id,
    deal_id: transcript.deal_id,
    user_id: transcript.user_id,
    
    // AI
    is_ai_generated: false,
    
    // Analysis pending
    analysis_status: 'pending',
  };
}

export async function syncTranscriptToCommunications(transcriptId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // Fetch transcript
  const { data: transcript, error: transcriptError } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('id', transcriptId)
    .single();
  
  if (transcriptError || !transcript) {
    console.error(`[TranscriptAdapter] Transcript not found: ${transcriptId}`, transcriptError);
    return null;
  }
  
  // Check if already synced
  const { data: existing } = await supabase
    .from('communications')
    .select('id')
    .eq('source_table', 'meeting_transcriptions')
    .eq('source_id', transcriptId)
    .single();
  
  if (existing) {
    return existing.id;
  }
  
  // Convert and insert
  const communication = transcriptToCommunication(transcript);
  
  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();
  
  if (insertError) {
    console.error(`[TranscriptAdapter] Failed to insert communication:`, insertError);
    return null;
  }
  
  console.log(`[TranscriptAdapter] Synced transcript ${transcriptId} → communication ${inserted.id}`);
  return inserted.id;
}

export async function syncAllTranscriptsToCommunications(
  options?: { limit?: number; since?: string }
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();
  
  let query = supabase
    .from('meeting_transcriptions')
    .select('id')
    .order('meeting_date', { ascending: true });
  
  if (options?.since) {
    query = query.gte('meeting_date', options.since);
  }
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  const { data: transcripts, error } = await query;
  
  if (error || !transcripts) {
    console.error('[TranscriptAdapter] Failed to fetch transcripts:', error);
    return { synced: 0, errors: 1 };
  }
  
  let synced = 0;
  let errors = 0;
  
  for (const transcript of transcripts) {
    const result = await syncTranscriptToCommunications(transcript.id);
    if (result) {
      synced++;
    } else {
      errors++;
    }
  }
  
  console.log(`[TranscriptAdapter] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}
```

### Task 5: Create Basic API Endpoint

Create `src/app/api/communications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  // Filters
  const companyId = searchParams.get('company_id');
  const contactId = searchParams.get('contact_id');
  const dealId = searchParams.get('deal_id');
  const channel = searchParams.get('channel');
  const direction = searchParams.get('direction');
  const awaitingResponse = searchParams.get('awaiting_response') === 'true';
  const aiOnly = searchParams.get('ai_only') === 'true';
  
  // Pagination
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  let query = supabase
    .from('communications')
    .select(`
      *,
      company:companies(id, name, domain),
      contact:contacts(id, first_name, last_name, email),
      deal:deals(id, name, stage, value),
      current_analysis:communication_analysis!current_analysis_id(*)
    `, { count: 'exact' })
    .order('occurred_at', { ascending: false });
  
  // Apply filters
  if (companyId) query = query.eq('company_id', companyId);
  if (contactId) query = query.eq('contact_id', contactId);
  if (dealId) query = query.eq('deal_id', dealId);
  if (channel) query = query.eq('channel', channel);
  if (direction) query = query.eq('direction', direction);
  if (awaitingResponse) query = query.eq('awaiting_our_response', true);
  if (aiOnly) query = query.eq('is_ai_generated', true);
  
  // Pagination
  query = query.range(offset, offset + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    console.error('[Communications API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({
    communications: data,
    total: count,
    limit,
    offset,
  });
}
```

### Task 6: Create Response Queue Endpoint

Create `src/app/api/communications/response-queue/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const userId = searchParams.get('user_id');
  
  // Get all communications awaiting our response
  let query = supabase
    .from('communications')
    .select(`
      *,
      company:companies(id, name, domain),
      contact:contacts(id, first_name, last_name, email)
    `)
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('response_due_by', { ascending: true, nullsFirst: false });
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[Response Queue API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Categorize by urgency
  const now = new Date();
  const categorized = {
    overdue: [] as any[],
    due_soon: [] as any[],    // Within 2 hours
    upcoming: [] as any[],     // More than 2 hours
  };
  
  for (const comm of data || []) {
    if (!comm.response_due_by) {
      categorized.upcoming.push(comm);
      continue;
    }
    
    const dueBy = new Date(comm.response_due_by);
    const hoursUntilDue = (dueBy.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDue < 0) {
      categorized.overdue.push({ ...comm, hours_overdue: Math.abs(hoursUntilDue) });
    } else if (hoursUntilDue <= 2) {
      categorized.due_soon.push({ ...comm, hours_remaining: hoursUntilDue });
    } else {
      categorized.upcoming.push({ ...comm, hours_remaining: hoursUntilDue });
    }
  }
  
  return NextResponse.json({
    response_queue: categorized,
    total: data?.length || 0,
  });
}
```

### Task 7: Create Backfill Script

Create `scripts/backfill-communications.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { syncAllEmailsToCommunications } from '../src/lib/communicationHub/adapters/emailAdapter';
import { syncAllTranscriptsToCommunications } from '../src/lib/communicationHub/adapters/transcriptAdapter';

async function main() {
  console.log('Starting Communication Hub backfill...\n');
  
  // Backfill emails
  console.log('=== Backfilling Emails ===');
  const emailResult = await syncAllEmailsToCommunications();
  console.log(`Emails: ${emailResult.synced} synced, ${emailResult.errors} errors\n`);
  
  // Backfill transcripts
  console.log('=== Backfilling Transcripts ===');
  const transcriptResult = await syncAllTranscriptsToCommunications();
  console.log(`Transcripts: ${transcriptResult.synced} synced, ${transcriptResult.errors} errors\n`);
  
  console.log('=== Backfill Complete ===');
  console.log(`Total synced: ${emailResult.synced + transcriptResult.synced}`);
  console.log(`Total errors: ${emailResult.errors + transcriptResult.errors}`);
}

main().catch(console.error);
```

---

## Verification

After implementation:

1. **Run migration:**
   ```bash
   supabase db push
   # OR apply migration manually
   ```

2. **Verify tables exist:**
   ```sql
   SELECT COUNT(*) FROM communications;
   SELECT COUNT(*) FROM communication_analysis;
   SELECT COUNT(*) FROM promises;
   ```

3. **Run backfill:**
   ```bash
   npx ts-node scripts/backfill-communications.ts
   ```

4. **Test API:**
   ```bash
   curl http://localhost:3000/api/communications?limit=10
   curl http://localhost:3000/api/communications/response-queue
   ```

5. **Verify data:**
   ```sql
   -- Check communications by channel
   SELECT channel, COUNT(*) FROM communications GROUP BY channel;
   
   -- Check response queue
   SELECT COUNT(*) FROM communications WHERE awaiting_our_response = true;
   ```

---

## Success Criteria

- [ ] Migration runs without errors
- [ ] Types compile clean
- [ ] Email adapter syncs emails to communications
- [ ] Transcript adapter syncs transcripts to communications
- [ ] API returns communications with filters
- [ ] Response queue endpoint returns categorized items
- [ ] Backfill script completes successfully
- [ ] TypeScript compiles clean
