# Meetings Page Redesign - Complete Specification

## Overview

Redesign the Meetings page to create a unified hub that combines upcoming meetings with AI-powered prep, past meetings with transcript analysis, inline action item management, customer assignment, and transcript processing queue.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React 18+, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **State Management**: React hooks + Server Actions

## Design System

### Colors (Light Mode)
```
Background: slate-50 (#f8fafc)
Cards: white (#ffffff)
Borders: slate-200 (#e2e8f0)
Text Primary: slate-900 (#0f172a)
Text Secondary: slate-500 (#64748b)
Text Muted: slate-400 (#94a3b8)

Accent Blue: blue-600 (#2563eb)
Accent Emerald: emerald-600 (#059669)
Accent Amber: amber-600 (#d97706)
Accent Purple: purple-600 (#9333ea)

Status Colors:
- Very Positive: emerald-100/700
- Positive: green-100/700
- Neutral: slate-100/600
- Negative: orange-100/700
```

### Typography
```
Headings: font-semibold or font-bold
Body: text-sm (14px) for most content
Labels: text-xs (12px) for metadata
```

### Spacing
```
Card padding: p-4 (16px)
Section gap: space-y-8 (32px)
Card gap: space-y-3 (12px)
```

---

## Database Schema

### Tables

#### meetings
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meeting_type TEXT DEFAULT 'video', -- video, phone, in_person
  meeting_url TEXT,
  customer_id UUID REFERENCES customers(id),
  excluded BOOLEAN DEFAULT FALSE,
  excluded_at TIMESTAMPTZ,
  excluded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### meeting_attendees
```sql
CREATE TABLE meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  email TEXT,
  name TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  response_status TEXT DEFAULT 'pending', -- pending, accepted, declined, tentative
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### meeting_prep
```sql
CREATE TABLE meeting_prep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT,
  key_points JSONB DEFAULT '[]',
  suggested_questions JSONB DEFAULT '[]',
  deal_id UUID REFERENCES deals(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### transcripts
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- fireflies, manual, zoom, teams
  raw_content TEXT,
  word_count INTEGER,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'pending', -- pending, processing, analyzed, failed
  processing_progress INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### transcript_analysis
```sql
CREATE TABLE transcript_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  summary TEXT,
  key_insights JSONB DEFAULT '[]',
  sentiment TEXT, -- very_positive, positive, neutral, negative
  sentiment_score DECIMAL(3,2),
  signals_count INTEGER DEFAULT 0,
  signals JSONB DEFAULT '[]',
  full_analysis JSONB, -- Complete AI analysis output
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT, -- AI model used
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### action_items
```sql
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  transcript_id UUID REFERENCES transcripts(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  assignee_id UUID REFERENCES users(id),
  due_date DATE,
  status TEXT DEFAULT 'pending', -- pending, in_progress, done
  completed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual', -- ai_generated, manual
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
```sql
CREATE INDEX idx_meetings_org_start ON meetings(organization_id, start_time DESC);
CREATE INDEX idx_meetings_customer ON meetings(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_meetings_excluded ON meetings(organization_id, excluded);
CREATE INDEX idx_transcripts_meeting ON transcripts(meeting_id);
CREATE INDEX idx_transcripts_status ON transcripts(status);
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_assignee ON action_items(assignee_id, status);
```

---

## API Routes / Server Actions

### Meetings

#### GET /api/meetings
```typescript
interface GetMeetingsParams {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  includeExcluded?: boolean;
  customerId?: string;
  limit?: number;
  offset?: number;
}

interface MeetingWithDetails {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingType: string;
  meetingUrl?: string;
  excluded: boolean;
  customer?: {
    id: string;
    name: string;
  };
  attendees: {
    id: string;
    name: string;
    email: string;
    isOrganizer: boolean;
  }[];
  prep?: {
    summary: string;
    keyPoints: string[];
    suggestedQuestions: string[];
    deal?: {
      id: string;
      stage: string;
      value: number;
    };
  };
  transcript?: {
    id: string;
    status: string;
    wordCount: number;
    analysis?: {
      summary: string;
      keyInsights: string[];
      sentiment: string;
      signalsCount: number;
      actionsCount: number;
    };
  };
  actionItems: ActionItem[];
}
```

#### PATCH /api/meetings/:id
```typescript
interface UpdateMeetingParams {
  customerId?: string | null;
  excluded?: boolean;
}
```

#### PATCH /api/meetings/:id/exclude
```typescript
// Marks meeting as excluded
// Sets excluded = true, excluded_at = now(), excluded_by = current user
```

### Action Items

#### GET /api/meetings/:meetingId/action-items
```typescript
interface ActionItem {
  id: string;
  text: string;
  assigneeId: string;
  assignee: {
    id: string;
    name: string;
    avatar?: string;
  };
  dueDate: string;
  status: 'pending' | 'in_progress' | 'done';
  source: 'ai_generated' | 'manual';
}
```

#### POST /api/meetings/:meetingId/action-items
```typescript
interface CreateActionItemParams {
  text: string;
  assigneeId: string;
  dueDate: string;
}
```

#### PATCH /api/action-items/:id
```typescript
interface UpdateActionItemParams {
  text?: string;
  assigneeId?: string;
  dueDate?: string;
  status?: 'pending' | 'in_progress' | 'done';
}
```

#### DELETE /api/action-items/:id

### Transcripts

#### GET /api/transcripts/processing
```typescript
// Returns transcripts with status = 'pending' or 'processing'
interface ProcessingTranscript {
  id: string;
  meetingId: string;
  title: string;
  status: string;
  progress: number;
  wordCount: number;
}
```

#### POST /api/transcripts/:id/reprocess
```typescript
// Triggers reprocessing of a transcript
```

### Analysis

#### GET /api/transcripts/:id/analysis
```typescript
// Returns full AI analysis for a transcript
interface FullAnalysis {
  id: string;
  summary: string;
  keyInsights: string[];
  sentiment: string;
  sentimentScore: number;
  signals: Signal[];
  actionItems: ActionItem[];
  topics: Topic[];
  speakerBreakdown: SpeakerStats[];
  fullAnalysis: object; // Complete raw analysis
}
```

---

## Component Architecture

```
app/
├── (dashboard)/
│   └── meetings/
│       ├── page.tsx                    # Main meetings page
│       ├── loading.tsx                 # Loading skeleton
│       └── components/
│           ├── MeetingsHeader.tsx      # Title, stats, actions
│           ├── StatsBar.tsx            # Quick stats cards
│           ├── UpcomingMeetings.tsx    # Upcoming section
│           ├── PastMeetings.tsx        # Past meetings section
│           ├── ProcessingQueue.tsx     # Transcript queue
│           ├── MeetingPrepCard.tsx     # Upcoming meeting card
│           ├── PastMeetingCard.tsx     # Past meeting card
│           ├── ActionItemRow.tsx       # Inline editable action
│           ├── ActionItemsList.tsx     # List with add functionality
│           ├── CustomerDropdown.tsx    # Customer assignment
│           ├── AssigneeDropdown.tsx    # Team member assignment
│           ├── DateDropdown.tsx        # Due date picker
│           ├── EditableText.tsx        # Inline text editing
│           ├── SentimentBadge.tsx      # Sentiment indicator
│           └── FullAnalysisModal.tsx   # Full AI analysis view
```

---

## Component Specifications

### MeetingsHeader
- Page title "Meetings"
- Subtitle "Prepare, review, and analyze your meetings"
- Excluded count toggle (shows/hides excluded meetings)
- Schedule button
- Upload Recording button

### StatsBar
Four stat cards in a grid:
1. Today - meetings count (blue)
2. This Week - scheduled count (emerald)
3. Analyzed - transcript count (purple)
4. Action Items - pending count (amber)

### MeetingPrepCard (Upcoming)
**Collapsed State:**
- Video icon with blue background
- Meeting title (truncated)
- Customer dropdown (amber if unassigned)
- Time, duration, attendee count
- Deal stage & value (if linked)
- Join button (blue)
- Exclude button (eye-off icon)
- Expand chevron

**Expanded State:**
Three tabs:
1. Overview - AI summary
2. Questions - Suggested discovery questions
3. Key Points - Bullet points about company/contact

### PastMeetingCard
**Collapsed State:**
- Status icon (checkmark if analyzed, clock if pending)
- Meeting title
- Customer dropdown
- Date, duration
- Sentiment badge
- Signals/Actions count
- Exclude button
- Expand chevron

**Expanded State:**
Three tabs + Full AI Analysis link:
1. Summary - Meeting summary, word count, participant count
2. Insights - Key insights from the meeting
3. Actions - Inline editable action items list

### ActionItemRow
- Checkbox (cycles: pending → in_progress → done)
- Editable text (click to edit inline)
- Assignee dropdown
- Due date dropdown
- Delete button (visible on hover)

### CustomerDropdown
- Shows current customer or "Assign Customer"
- Searchable list of customers
- Option to remove assignment
- Amber highlight when unassigned

### FullAnalysisModal
- Modal or slide-over panel
- Complete AI analysis from transcript
- Sections: Summary, Key Insights, Sentiment Analysis, Signals, Action Items, Topics, Speaker Breakdown
- Export/Share options

### ProcessingQueue
List of transcripts being processed:
- Spinner or clock icon based on status
- Title
- Word count
- Progress bar (if analyzing)
- Status badge
- More options menu (reprocess, assign, etc.)

---

## State Management

### Page-level State
```typescript
interface MeetingsPageState {
  // Data
  upcomingMeetings: MeetingWithDetails[];
  pastMeetings: MeetingWithDetails[];
  processingQueue: ProcessingTranscript[];
  
  // UI State
  expandedUpcoming: Set<string>;
  expandedPast: Set<string>;
  showAllUpcoming: boolean;
  showAllPast: boolean;
  showExcluded: boolean;
  pastFilter: 'all' | 'analyzed' | 'pending';
  searchQuery: string;
  
  // Modal State
  selectedAnalysisId: string | null;
}
```

### Optimistic Updates
- Action item changes update UI immediately
- Customer assignment updates immediately
- Exclude updates immediately
- Roll back on server error

---

## User Interactions

### Exclude Meeting
1. User clicks eye-off icon
2. Confirmation toast appears briefly
3. Meeting fades to 50% opacity (if showing excluded)
4. Meeting disappears (if hiding excluded)
5. Excluded count in header updates
6. Server updates meeting.excluded = true

### Assign Customer
1. User clicks customer dropdown
2. Search input auto-focuses
3. User types to filter
4. User clicks customer
5. Dropdown closes
6. Customer name appears on card
7. Server updates meeting.customer_id

### Edit Action Item
1. User clicks action text
2. Text becomes input field
3. User types new text
4. User presses Enter or clicks away
5. Text updates
6. Server updates action_item.text

### Change Action Status
1. User clicks checkbox
2. Status cycles: pending → in_progress → done
3. Visual indicator updates
4. If done, text gets strikethrough
5. Server updates action_item.status

### Add Action Item
1. User clicks in "Add new action item" input
2. User types action text
3. User presses Enter or clicks Add
4. New action appears in list
5. Server creates action_item

### View Full AI Analysis
1. User clicks "Full AI Analysis" button
2. Modal/slide-over opens
3. Complete analysis displayed
4. User can close or export

---

## Error Handling

### Network Errors
- Show toast notification
- Roll back optimistic updates
- Provide retry option

### Empty States
- No upcoming meetings: "No meetings scheduled"
- No past meetings: "No past meetings found"
- No action items: Show add action input only
- No analysis: "Analysis pending..."

### Loading States
- Skeleton cards while loading
- Spinner in processing queue
- Disabled buttons during mutations

---

## Accessibility

- All interactive elements keyboard accessible
- Focus management in dropdowns
- ARIA labels for icons
- Color contrast meets WCAG AA
- Screen reader announcements for status changes

---

## File Structure for Implementation

```
phases/
├── phase-1-database.md       # Schema, migrations, RLS policies
├── phase-2-api.md            # Server actions and API routes
├── phase-3-components.md     # Base UI components
├── phase-4-meeting-cards.md  # Meeting card components
├── phase-5-action-items.md   # Inline editing components
├── phase-6-customer.md       # Customer assignment
├── phase-7-exclude.md        # Exclude functionality
├── phase-8-queue.md          # Processing queue
├── phase-9-integration.md    # Final integration and testing
└── starter-prompt.md         # Initial Claude Code prompt
```
