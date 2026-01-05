# X-FORCE: AI Scheduler — Persistent Meeting Coordination Agent

## The Problem

Scheduling meetings with prospects is one of the biggest friction points in sales:

1. **Scheduling links shift burden to prospects** — They have to find time, navigate a tool, pick a slot
2. **Multi-party coordination is a nightmare** — Getting 3 people from your team + 2 from theirs aligned
3. **No-shows fall through the cracks** — Someone misses, you forget to follow up, deal stalls
4. **Manual follow-up is tedious** — Checking who scheduled, who didn't, sending reminders
5. **Prospects ghost scheduling links** — They mean to schedule but never do

## The Solution: AI Scheduler

An AI agent that handles scheduling **conversationally through email** — the old-school way, but tireless:

- Checks all attendees' calendars
- Proposes specific times via email
- Negotiates back-and-forth until confirmed
- Sends calendar invites
- Confirms acceptance
- Sends day-of reminders
- If no-show → immediately re-engages to reschedule
- **Never quits until the meeting happens**

---

## User Experience

### Creating a Scheduling Request

From a deal or contact page:

```
┌─────────────────────────────────────────────────────────────────┐
│ Schedule Meeting                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Meeting Type                                                   │
│  ○ Discovery Call (30 min)                                      │
│  ● Demo (60 min)                                                │
│  ○ Follow-up (30 min)                                           │
│  ○ Custom: [____] minutes                                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Our Team                              Their Team               │
│  ┌─────────────────────────┐          ┌─────────────────────┐  │
│  │ ☑ You (Brent)          │          │ ☑ John Smith        │  │
│  │ ☐ Sarah (Sales Eng)    │          │   john@acmepest.com │  │
│  │ ☐ Mike (VP Sales)      │          │                     │  │
│  │ + Add team member      │          │ ☐ Mary Johnson      │  │
│  └─────────────────────────┘          │   mary@acmepest.com │  │
│                                       │                     │  │
│                                       │ + Add attendee      │  │
│                                       └─────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Scheduling Preferences                                         │
│  Time Range: [Next 2 weeks ▼]                                   │
│  Preferred Times: [Mornings ▼] [Afternoons ▼]                   │
│  Avoid: [Mondays ▼] [Fridays after 2pm ▼]                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Meeting Context (AI uses this to personalize emails)           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Demo of AI receptionist for after-hours call handling.  │   │
│  │ John mentioned 15% call abandonment in discovery call.  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Video Platform: [Microsoft Teams ▼]                            │
│                                                                 │
│           [Preview Email]        [Start Scheduling]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Scheduling Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ AI Scheduler                                         [+ New]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PENDING CONFIRMATION (3)                                       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  🔄 Demo with Acme Pest                          2 days active  │
│     John Smith • Awaiting response to time options              │
│     Last: "Sent 3 time options yesterday at 2:15 PM"            │
│     Next: Auto follow-up tomorrow if no response                │
│     [View Thread] [Pause] [Cancel]                              │
│                                                                 │
│  🔄 Discovery with Gulf Coast                    4 hours active │
│     Mary Johnson • She proposed alternatives, reviewing         │
│     Last: "She can't do mornings, checking PM availability"     │
│     Next: Sending PM options in ~5 minutes                      │
│     [View Thread] [Pause] [Cancel]                              │
│                                                                 │
│  ⏳ Follow-up with Sunshine Pest                  Just started  │
│     Bob Wilson • Initial outreach sent                          │
│     Last: "Sent scheduling email 10 minutes ago"                │
│     Next: Follow up in 24 hours if no response                  │
│     [View Thread] [Pause] [Cancel]                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  CONFIRMED & UPCOMING (5)                                       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ✅ Demo with ABC Exterminators         Tomorrow 2:00 PM        │
│     John Doe • Invite accepted                                  │
│     Reminder: Scheduled for 9:00 AM tomorrow                    │
│     [View Details] [Reschedule] [Cancel]                        │
│                                                                 │
│  ✅ Discovery with Premier Pest         Thursday 10:30 AM       │
│     Sarah Miller • Invite accepted                              │
│     [View Details] [Reschedule] [Cancel]                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  NEEDS ATTENTION (1)                                            │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ⚠️ No-Show: Demo with Delta Pest       Was today 11:00 AM     │
│     Tom Brown • Didn't join, no response to "running late?"     │
│     AI Action: Rescheduling email drafted, ready to send        │
│     [Review & Send] [Call Instead] [Mark Complete]              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  COMPLETED THIS WEEK (8)                                        │
│     ✓ 6 meetings held                                           │
│     ✓ 2 cancelled by prospect (logged reason)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scheduling Flow State Machine

```
                                    ┌─────────────────┐
                                    │   INITIATED     │
                                    │                 │
                                    │ User creates    │
                                    │ scheduling req  │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                              ┌─────│  PROPOSING      │◄────────┐
                              │     │                 │         │
                              │     │ AI sends time   │         │
                              │     │ options email   │         │
                              │     └────────┬────────┘         │
                              │              │                  │
                              │              ▼                  │
                              │     ┌─────────────────┐         │
                              │     │  AWAITING       │         │
                              │     │  RESPONSE       │─────────┤
                              │     │                 │ Timeout │
                              │     │ Waiting for     │ (24-48h)│
                              │     │ prospect reply  │         │
                              │     └────────┬────────┘         │
                              │              │                  │
                              │    Response  │                  │
                              │    received  │                  │
                              │              ▼                  │
                              │     ┌─────────────────┐         │
                              │     │  NEGOTIATING    │─────────┘
                              │     │                 │ None work
                              │     │ Back-and-forth  │
                              │     │ on times        │
                              │     └────────┬────────┘
                              │              │
                              │    Time      │
                              │    agreed    │
                              │              ▼
                              │     ┌─────────────────┐
                              │     │  CONFIRMING     │
                              │     │                 │
                              │     │ Sending invite  │
                              │     │ Awaiting accept │
                              │     └────────┬────────┘
                              │              │
                              │    Invite    │
         Prospect             │    accepted  │
         declines/            │              ▼
         cancels              │     ┌─────────────────┐
                              │     │  CONFIRMED      │
                              │     │                 │
                              │     │ Meeting on      │
                              │     │ calendar        │
                              │     └────────┬────────┘
                              │              │
                              │    Day of    │
                              │    meeting   │
                              │              ▼
                              │     ┌─────────────────┐
                              │     │  REMINDER_SENT  │
                              │     │                 │
                              │     │ Morning-of      │
                              │     │ reminder sent   │
                              │     └────────┬────────┘
                              │              │
                              │              ├───────────────┐
                              │              │               │
                              │         Meeting          No-show
                              │         happens          detected
                              │              │               │
                              │              ▼               ▼
                              │     ┌─────────────┐  ┌─────────────┐
                              │     │  COMPLETED  │  │  NO_SHOW    │
                              │     │             │  │             │
                              │     │ Success!    │  │ Reschedule  │──┐
                              │     └─────────────┘  │ initiated   │  │
                              │                      └─────────────┘  │
                              │                                       │
                              └───────────────────────────────────────┘
                                          Back to PROPOSING
```

---

## Database Schema

```sql
-- Scheduling requests
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
  
  -- Scheduling preferences
  date_range_start DATE,
  date_range_end DATE,
  preferred_times JSONB, -- { "morning": true, "afternoon": true, "evening": false }
  avoid_days JSONB, -- ["monday", "friday_afternoon"]
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
  
  -- Outcome
  scheduled_time TIMESTAMP WITH TIME ZONE, -- Confirmed meeting time
  calendar_event_id TEXT, -- Microsoft/Google calendar event ID
  invite_accepted BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  outcome VARCHAR(30), -- 'held', 'cancelled_by_us', 'cancelled_by_them', 'no_show', 'rescheduled'
  outcome_notes TEXT,
  
  -- AI tracking
  email_thread_id TEXT, -- Thread ID in email system
  conversation_history JSONB, -- Full back-and-forth for context
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendees for each scheduling request
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
  
  -- Role in meeting
  is_required BOOLEAN DEFAULT TRUE,
  is_organizer BOOLEAN DEFAULT FALSE, -- Who sends the invite
  
  -- Response tracking
  invite_status VARCHAR(20), -- 'pending', 'accepted', 'declined', 'tentative'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log of all scheduling actions
CREATE TABLE scheduling_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  
  -- Action details
  action_type VARCHAR(50) NOT NULL,
  -- 'email_sent', 'email_received', 'times_proposed', 'time_selected',
  -- 'invite_sent', 'invite_accepted', 'invite_declined', 'reminder_sent',
  -- 'no_show_detected', 'rescheduling_started', 'cancelled', 'completed',
  -- 'follow_up_sent', 'paused', 'resumed'
  
  -- Content
  email_id TEXT, -- Reference to email if applicable
  times_proposed JSONB, -- Array of proposed times
  time_selected TIMESTAMP WITH TIME ZONE,
  message_content TEXT, -- Email content sent/received
  
  -- AI reasoning
  ai_reasoning TEXT, -- Why AI took this action
  
  -- Who did it
  actor VARCHAR(20) NOT NULL, -- 'ai', 'user', 'prospect'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduling templates
CREATE TABLE scheduling_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(50), -- 'discovery', 'demo', etc.
  
  -- Default settings
  duration_minutes INTEGER DEFAULT 30,
  default_platform VARCHAR(50) DEFAULT 'teams',
  
  -- Email templates
  initial_email_template TEXT,
  follow_up_template TEXT,
  confirmation_template TEXT,
  reminder_template TEXT,
  no_show_template TEXT,
  reschedule_template TEXT,
  
  -- Timing rules
  follow_up_after_hours INTEGER DEFAULT 24,
  reminder_hours_before INTEGER DEFAULT 3,
  max_attempts INTEGER DEFAULT 5,
  
  -- Org level
  organization_id UUID,
  created_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduling_requests_status ON scheduling_requests(status);
CREATE INDEX idx_scheduling_requests_next_action ON scheduling_requests(next_action_at) 
  WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_scheduling_requests_deal ON scheduling_requests(deal_id);
CREATE INDEX idx_scheduling_attendees_request ON scheduling_attendees(scheduling_request_id);
CREATE INDEX idx_scheduling_actions_request ON scheduling_actions(scheduling_request_id);

-- Meeting prep briefs (auto-generated before meetings)
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
  --   scheduling_insight: string
  -- }
  
  -- Tracking
  viewed_at TIMESTAMP WITH TIME ZONE,
  feedback_rating INTEGER, -- 1-5 stars
  feedback_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social proof content library
CREATE TABLE social_proof_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  type VARCHAR(50) NOT NULL, -- 'case_study', 'stat', 'testimonial', 'resource'
  title VARCHAR(500),
  content TEXT NOT NULL,
  source VARCHAR(255),
  link TEXT,
  
  -- Relevance targeting
  relevant_for JSONB NOT NULL,
  -- {
  --   ownership_types: ['family', 'pe_backed'],
  --   company_size: { min: 10, max: 100 },
  --   pain_points: ['missed_calls', 'after_hours'],
  --   products: ['ai_receptionist'],
  --   industries: ['pest_control']
  -- }
  
  -- Tracking
  times_used INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,4), -- How often it leads to scheduled meeting
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track social proof usage in scheduling
CREATE TABLE scheduling_social_proof_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  social_proof_id UUID REFERENCES social_proof_library(id),
  
  attempt_number INTEGER NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Outcome tracking
  led_to_response BOOLEAN,
  led_to_scheduling BOOLEAN,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact persona overrides (when auto-detection is wrong)
CREATE TABLE contact_persona_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  
  persona VARCHAR(50) NOT NULL, -- 'owner', 'executive', 'operations_manager', etc.
  override_reason TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduling conflict history (for learning)
CREATE TABLE scheduling_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  
  conflict_type VARCHAR(50) NOT NULL,
  -- 'person_unavailable', 'timing_constraint', 'decision_pending', etc.
  
  description TEXT,
  resolution_action VARCHAR(50), -- 'pause_and_resume', 'work_around', 'escalate'
  pause_until TIMESTAMP WITH TIME ZONE,
  
  -- Outcome
  resolution_successful BOOLEAN,
  days_to_resolve INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Seasonality patterns (learned over time)
CREATE TABLE seasonality_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  state VARCHAR(2) NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  
  pattern_type VARCHAR(50) NOT NULL, -- 'termite_swarm', 'summer_peak', etc.
  
  -- Learned adjustments
  avg_days_to_schedule DECIMAL(5,2),
  avg_attempts_needed DECIMAL(5,2),
  recommended_interval_multiplier DECIMAL(3,2) DEFAULT 1.0,
  
  sample_size INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(state, month)
);

-- Scheduling postmortems (for continuous improvement)
CREATE TABLE scheduling_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  
  outcome VARCHAR(30) NOT NULL, -- 'held', 'cancelled_by_them', 'gave_up', etc.
  
  -- Metrics
  total_attempts INTEGER,
  days_to_schedule INTEGER,
  no_shows INTEGER,
  channels_used TEXT[],
  de_escalated BOOLEAN,
  social_proof_used BOOLEAN,
  champion_involved BOOLEAN,
  
  -- Learnings (AI-generated)
  what_worked TEXT[],
  what_failed TEXT[],
  learnings_for_account TEXT[],
  learnings_for_meeting_type TEXT[],
  learnings_for_season TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Additional indexes for new tables
CREATE INDEX idx_meeting_prep_briefs_request ON meeting_prep_briefs(scheduling_request_id);
CREATE INDEX idx_meeting_prep_briefs_time ON meeting_prep_briefs(meeting_time);
CREATE INDEX idx_social_proof_active ON social_proof_library(is_active) WHERE is_active = true;
CREATE INDEX idx_scheduling_conflicts_request ON scheduling_conflicts(scheduling_request_id);
CREATE INDEX idx_seasonality_state_month ON seasonality_patterns(state, month);
CREATE INDEX idx_postmortems_outcome ON scheduling_postmortems(outcome);
```

---

## AI Email Generation

### Initial Scheduling Email

```typescript
// lib/scheduler/emails/initialEmail.ts

interface SchedulingContext {
  meetingType: string;
  duration: number;
  context: string;
  proposedTimes: Date[];
  ourAttendees: { name: string; title?: string }[];
  theirAttendees: { name: string; title?: string }[];
  companyName: string;
  dealContext?: {
    stage: string;
    lastMeeting?: string;
    keyPoints?: string[];
  };
}

async function generateInitialSchedulingEmail(
  ctx: SchedulingContext,
  recipientContact: Contact,
  senderUser: User
): Promise<{ subject: string; body: string }> {
  
  const prompt = `Generate a scheduling email for a sales meeting.

## Context
- Meeting Type: ${ctx.meetingType} (${ctx.duration} minutes)
- Purpose: ${ctx.context}
- Company: ${ctx.companyName}
${ctx.dealContext ? `- Deal Stage: ${ctx.dealContext.stage}` : ''}
${ctx.dealContext?.lastMeeting ? `- Last Meeting: ${ctx.dealContext.lastMeeting}` : ''}
${ctx.dealContext?.keyPoints ? `- Key Points from Last Call: ${ctx.dealContext.keyPoints.join(', ')}` : ''}

## Attendees
Our side: ${ctx.ourAttendees.map(a => a.name + (a.title ? ` (${a.title})` : '')).join(', ')}
Their side: ${ctx.theirAttendees.map(a => a.name + (a.title ? ` (${a.title})` : '')).join(', ')}

## Proposed Times (in recipient's timezone)
${ctx.proposedTimes.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n')}

## Sender
${senderUser.name}
${senderUser.title || ''}
${senderUser.email}

## Recipient  
${recipientContact.name}
${recipientContact.title || ''}

---

Write a professional but warm scheduling email. Requirements:

1. Subject line should be clear and specific (not generic "Meeting Request")
2. Open with brief, relevant context (reference last conversation if applicable)
3. Clearly state the purpose of the meeting
4. List the proposed times in an easy-to-read format
5. Make it easy to respond (just reply with preferred time or suggest alternatives)
6. Keep it concise - no more than 150 words in body
7. Sign off professionally

DO NOT:
- Use scheduling links
- Be overly formal or stiff
- Include unnecessary pleasantries
- Make it sound automated

Return JSON:
{
  "subject": "...",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

### Follow-Up Email (No Response)

```typescript
async function generateFollowUpEmail(
  schedulingRequest: SchedulingRequest,
  attemptNumber: number
): Promise<{ subject: string; body: string }> {
  
  const conversationHistory = schedulingRequest.conversation_history;
  const daysSinceLastEmail = daysBetween(schedulingRequest.last_action_at, new Date());
  
  const prompt = `Generate a follow-up scheduling email.

## Situation
- Original meeting request sent ${daysSinceLastEmail} days ago
- This is follow-up attempt #${attemptNumber}
- No response received yet

## Original Request
${JSON.stringify(conversationHistory[0], null, 2)}

## Proposed Times (updated for current availability)
${schedulingRequest.proposed_times.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n')}

---

Write a brief, friendly follow-up. Requirements:

1. Reference the original email naturally ("circling back", "following up")
2. Acknowledge they're busy (not passive-aggressive)
3. Offer updated time options OR ask if the times don't work
4. Keep it SHORT - max 75 words
5. Make it easy to respond

Tone adjustments by attempt number:
- Attempt 1-2: Light, casual follow-up
- Attempt 3: Slightly more direct, ask if timing is bad
- Attempt 4+: Direct ask if still interested, offer to reschedule for later

Return JSON:
{
  "subject": "...",  // Use "Re: [original subject]" format
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

### Confirmation Email

```typescript
async function generateConfirmationEmail(
  schedulingRequest: SchedulingRequest,
  confirmedTime: Date
): Promise<{ subject: string; body: string }> {
  
  const prompt = `Generate a meeting confirmation email.

## Meeting Details
- Type: ${schedulingRequest.meeting_type}
- Duration: ${schedulingRequest.duration_minutes} minutes
- Confirmed Time: ${formatDateTime(confirmedTime)}
- Platform: ${schedulingRequest.meeting_platform}

## Context
${schedulingRequest.context}

## Attendees
${schedulingRequest.attendees.map(a => `- ${a.name} (${a.side})`).join('\n')}

---

Write a brief confirmation email. Requirements:

1. Confirm the time clearly
2. Mention a calendar invite is attached/coming
3. Brief reminder of what you'll cover
4. Keep it to 50 words max
5. Express genuine anticipation (not generic)

Return JSON:
{
  "subject": "Confirmed: [Meeting Type] - [Date/Time]",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

### Day-Of Reminder

```typescript
async function generateReminderEmail(
  schedulingRequest: SchedulingRequest
): Promise<{ subject: string; body: string }> {
  
  const meetingTime = schedulingRequest.scheduled_time;
  const hoursUntil = hoursBetween(new Date(), meetingTime);
  
  const prompt = `Generate a meeting reminder email.

## Meeting
- Type: ${schedulingRequest.meeting_type}
- Time: ${formatDateTime(meetingTime)} (${hoursUntil} hours from now)
- Duration: ${schedulingRequest.duration_minutes} minutes
- Platform: ${schedulingRequest.meeting_platform}

## Context
${schedulingRequest.context}

---

Write a brief, helpful reminder. Requirements:

1. Friendly tone - not robotic
2. Confirm time and include meeting link
3. Optional: Brief agenda reminder (1-2 bullet points)
4. Keep it to 40 words max
5. Easy CTA: "See you at [time]!" or similar

Return JSON:
{
  "subject": "Reminder: [Meeting] Today at [Time]",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

### No-Show Recovery Email

```typescript
async function generateNoShowEmail(
  schedulingRequest: SchedulingRequest,
  noShowCount: number
): Promise<{ subject: string; body: string }> {
  
  const prompt = `Generate a no-show recovery email.

## Situation
- Meeting was scheduled for: ${formatDateTime(schedulingRequest.scheduled_time)}
- Attendee did not join
- This is no-show #${noShowCount} for this scheduling request

## Original Context
${schedulingRequest.context}

## New Proposed Times
${schedulingRequest.proposed_times.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n')}

---

Write a recovery email. Requirements:

1. NO guilt-tripping or passive aggression
2. Assume something came up (benefit of doubt)
3. Express understanding
4. Offer to reschedule with new times
5. Keep it brief (60 words max)

Tone by no-show count:
- 1st no-show: "Things come up! Let's reschedule..."
- 2nd no-show: "I know schedules are crazy. Still want to connect when you have time..."
- 3rd+: "Totally understand if now isn't the right time. Happy to reconnect when things calm down..."

Return JSON:
{
  "subject": "Missed you today - let's reschedule",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

---

## Core Scheduling Logic

### Finding Available Times

```typescript
// lib/scheduler/availability.ts

interface TimeSlot {
  start: Date;
  end: Date;
}

interface AvailabilityOptions {
  attendees: { email: string; calendarId?: string }[];
  duration: number; // minutes
  dateRange: { start: Date; end: Date };
  preferences: {
    preferredTimes?: ('morning' | 'afternoon' | 'evening')[];
    avoidDays?: string[];
    timezone: string;
  };
}

async function findAvailableTimes(
  options: AvailabilityOptions
): Promise<TimeSlot[]> {
  
  const { attendees, duration, dateRange, preferences } = options;
  
  // Get busy times from all attendees' calendars
  const busyTimes: TimeSlot[] = [];
  
  for (const attendee of attendees) {
    // Only check internal calendars (we have access)
    if (attendee.calendarId) {
      const busy = await microsoftGraph.getFreeBusy(
        attendee.calendarId,
        dateRange.start,
        dateRange.end
      );
      busyTimes.push(...busy);
    }
  }
  
  // Generate candidate slots
  const candidates = generateCandidateSlots(
    dateRange,
    duration,
    preferences.timezone
  );
  
  // Filter out busy times
  let available = candidates.filter(slot => 
    !busyTimes.some(busy => overlaps(slot, busy))
  );
  
  // Apply preferences
  if (preferences.preferredTimes?.length) {
    available = available.filter(slot => {
      const hour = getHour(slot.start, preferences.timezone);
      if (preferences.preferredTimes.includes('morning') && hour >= 8 && hour < 12) return true;
      if (preferences.preferredTimes.includes('afternoon') && hour >= 12 && hour < 17) return true;
      if (preferences.preferredTimes.includes('evening') && hour >= 17 && hour < 20) return true;
      return false;
    });
  }
  
  // Filter out avoided days
  if (preferences.avoidDays?.length) {
    available = available.filter(slot => {
      const day = getDayOfWeek(slot.start, preferences.timezone);
      return !preferences.avoidDays.includes(day);
    });
  }
  
  // Sort by preference (morning first, then spread across days)
  available = sortByPreference(available, preferences);
  
  // Return top options (diverse across days)
  return selectDiverseOptions(available, 5);
}

function selectDiverseOptions(slots: TimeSlot[], count: number): TimeSlot[] {
  // Select slots spread across different days
  const byDay = groupBy(slots, s => formatDate(s.start));
  const selected: TimeSlot[] = [];
  
  // Round-robin across days
  const days = Object.keys(byDay);
  let dayIndex = 0;
  
  while (selected.length < count && slots.length > 0) {
    const day = days[dayIndex % days.length];
    const daySlots = byDay[day];
    
    if (daySlots.length > 0) {
      selected.push(daySlots.shift()!);
    }
    
    dayIndex++;
    
    // Remove empty days
    if (daySlots.length === 0) {
      days.splice(days.indexOf(day), 1);
    }
  }
  
  return selected;
}
```

### Processing Incoming Responses

```typescript
// lib/scheduler/responseProcessor.ts

interface ResponseAnalysis {
  intent: 'accept_time' | 'propose_alternative' | 'decline' | 'reschedule_later' | 'question' | 'unclear';
  selectedTime?: Date;
  proposedTimes?: string[]; // Raw text of proposed times
  reason?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  requiresHuman: boolean;
  humanReason?: string;
}

async function analyzeSchedulingResponse(
  email: IncomingEmail,
  schedulingRequest: SchedulingRequest
): Promise<ResponseAnalysis> {
  
  const prompt = `Analyze this email response to a meeting scheduling request.

## Original Scheduling Request
Meeting: ${schedulingRequest.meeting_type} (${schedulingRequest.duration_minutes} min)
Times Proposed:
${schedulingRequest.proposed_times.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n')}

## Response Email
From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}

---

Analyze the response and determine:

1. INTENT - What are they trying to do?
   - accept_time: Explicitly choosing one of the proposed times
   - propose_alternative: Suggesting different times
   - decline: Declining the meeting entirely
   - reschedule_later: Want to meet but not now (e.g., "let's connect next month")
   - question: Asking a question before committing
   - unclear: Can't determine intent

2. If accept_time: Which time did they select? (exact datetime)

3. If propose_alternative: What times did they suggest? (extract exact text)

4. SENTIMENT: Is their tone positive, neutral, or negative?

5. REQUIRES_HUMAN: Should a human review this? (true if: declining deal, negative sentiment, complex question, or request for different attendees)

Return JSON:
{
  "intent": "...",
  "selectedTime": "ISO datetime if accepting",
  "proposedTimes": ["raw text of proposed times"],
  "reason": "their stated reason if declining/rescheduling",
  "sentiment": "positive|neutral|negative",
  "requiresHuman": true/false,
  "humanReason": "why human needed"
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}

async function processSchedulingResponse(
  email: IncomingEmail,
  schedulingRequest: SchedulingRequest
): Promise<void> {
  
  const analysis = await analyzeSchedulingResponse(email, schedulingRequest);
  
  // Log the action
  await db.insert(schedulingActions).values({
    scheduling_request_id: schedulingRequest.id,
    action_type: 'email_received',
    email_id: email.id,
    message_content: email.body,
    ai_reasoning: JSON.stringify(analysis),
    actor: 'prospect'
  });
  
  // Route based on intent
  switch (analysis.intent) {
    case 'accept_time':
      await handleTimeAccepted(schedulingRequest, analysis.selectedTime!);
      break;
      
    case 'propose_alternative':
      await handleAlternativeProposed(schedulingRequest, analysis.proposedTimes!);
      break;
      
    case 'decline':
      await handleDecline(schedulingRequest, analysis.reason);
      break;
      
    case 'reschedule_later':
      await handleRescheduleLater(schedulingRequest, analysis.reason);
      break;
      
    case 'question':
      // Questions require human response
      await escalateToHuman(schedulingRequest, 'Prospect asked a question', email);
      break;
      
    case 'unclear':
      // Try to clarify or escalate
      if (analysis.requiresHuman) {
        await escalateToHuman(schedulingRequest, analysis.humanReason, email);
      } else {
        await sendClarificationEmail(schedulingRequest);
      }
      break;
  }
}

async function handleTimeAccepted(
  request: SchedulingRequest,
  selectedTime: Date
): Promise<void> {
  
  // Update request
  await db.update(schedulingRequests)
    .set({
      status: 'confirming',
      scheduled_time: selectedTime,
      last_action_at: new Date()
    })
    .where(eq(schedulingRequests.id, request.id));
  
  // Create calendar event
  const event = await microsoftGraph.createEvent({
    subject: request.title,
    start: selectedTime,
    end: addMinutes(selectedTime, request.duration_minutes),
    attendees: request.attendees.map(a => a.email),
    isOnlineMeeting: request.meeting_platform === 'teams',
    body: request.context
  });
  
  // Update with calendar event ID
  await db.update(schedulingRequests)
    .set({ calendar_event_id: event.id })
    .where(eq(schedulingRequests.id, request.id));
  
  // Send confirmation email
  const confirmEmail = await generateConfirmationEmail(request, selectedTime);
  await sendEmail({
    to: request.attendees.filter(a => a.side === 'external').map(a => a.email),
    subject: confirmEmail.subject,
    body: confirmEmail.body,
    threadId: request.email_thread_id
  });
  
  // Log action
  await db.insert(schedulingActions).values({
    scheduling_request_id: request.id,
    action_type: 'invite_sent',
    time_selected: selectedTime,
    actor: 'ai'
  });
  
  // Schedule reminder
  await scheduleReminder(request.id, selectedTime);
}

async function handleAlternativeProposed(
  request: SchedulingRequest,
  proposedTimes: string[]
): Promise<void> {
  
  // Parse the proposed times
  const parsedTimes = await parseProposedTimes(proposedTimes, request.timezone);
  
  // Check our availability for their proposed times
  const ourAttendees = request.attendees.filter(a => a.side === 'internal');
  const available = await checkAvailability(ourAttendees, parsedTimes);
  
  if (available.length > 0) {
    // We can do at least one of their times - confirm it
    const bestTime = available[0];
    await handleTimeAccepted(request, bestTime);
  } else {
    // None work - propose new times
    const newTimes = await findAvailableTimes({
      attendees: ourAttendees,
      duration: request.duration_minutes,
      dateRange: { start: new Date(), end: addDays(new Date(), 14) },
      preferences: request.preferences
    });
    
    // Send counter-proposal
    const email = await generateCounterProposalEmail(request, newTimes, proposedTimes);
    await sendEmail({
      to: request.attendees.filter(a => a.side === 'external').map(a => a.email),
      subject: email.subject,
      body: email.body,
      threadId: request.email_thread_id
    });
    
    // Update request
    await db.update(schedulingRequests)
      .set({
        status: 'negotiating',
        last_action_at: new Date(),
        attempt_count: request.attempt_count + 1
      })
      .where(eq(schedulingRequests.id, request.id));
  }
}
```

### Scheduler Job (Runs Every 5 Minutes)

```typescript
// lib/scheduler/schedulerJob.ts

async function runSchedulerJob(): Promise<void> {
  
  // Find requests that need action
  const pendingRequests = await db.select()
    .from(schedulingRequests)
    .where(
      and(
        not(inArray(schedulingRequests.status, ['completed', 'cancelled', 'paused'])),
        lte(schedulingRequests.next_action_at, new Date())
      )
    );
  
  for (const request of pendingRequests) {
    try {
      await processSchedulingRequest(request);
    } catch (error) {
      console.error(`Scheduler error for request ${request.id}:`, error);
      // Log error but continue with other requests
    }
  }
}

async function processSchedulingRequest(request: SchedulingRequest): Promise<void> {
  
  switch (request.next_action_type) {
    case 'send_initial':
      await sendInitialSchedulingEmail(request);
      break;
      
    case 'follow_up':
      await sendFollowUpEmail(request);
      break;
      
    case 'send_reminder':
      await sendReminderEmail(request);
      break;
      
    case 'check_no_show':
      await checkForNoShow(request);
      break;
      
    case 'check_invite_status':
      await checkInviteAcceptance(request);
      break;
  }
}

async function checkForNoShow(request: SchedulingRequest): Promise<void> {
  
  const meetingEnd = addMinutes(request.scheduled_time, request.duration_minutes);
  const gracePeriod = addMinutes(meetingEnd, 10);
  
  if (new Date() < gracePeriod) {
    // Still within grace period, check again later
    await scheduleNextAction(request.id, gracePeriod, 'check_no_show');
    return;
  }
  
  // Check if meeting actually happened (could check Teams call log, etc.)
  const meetingHeld = await checkMeetingOccurred(request);
  
  if (meetingHeld) {
    // Meeting happened - complete!
    await db.update(schedulingRequests)
      .set({
        status: 'completed',
        completed_at: new Date(),
        outcome: 'held'
      })
      .where(eq(schedulingRequests.id, request.id));
    
    await db.insert(schedulingActions).values({
      scheduling_request_id: request.id,
      action_type: 'completed',
      ai_reasoning: 'Meeting detected as held',
      actor: 'ai'
    });
    
  } else {
    // No-show detected
    await db.update(schedulingRequests)
      .set({
        status: 'no_show',
        no_show_count: request.no_show_count + 1
      })
      .where(eq(schedulingRequests.id, request.id));
    
    await db.insert(schedulingActions).values({
      scheduling_request_id: request.id,
      action_type: 'no_show_detected',
      actor: 'ai'
    });
    
    // Immediately start rescheduling
    await initiateReschedule(request);
  }
}

async function initiateReschedule(request: SchedulingRequest): Promise<void> {
  
  // Find new available times
  const ourAttendees = request.attendees.filter(a => a.side === 'internal');
  const newTimes = await findAvailableTimes({
    attendees: ourAttendees,
    duration: request.duration_minutes,
    dateRange: { start: addDays(new Date(), 1), end: addDays(new Date(), 14) },
    preferences: request.preferences
  });
  
  // Generate no-show recovery email
  const email = await generateNoShowEmail(request, request.no_show_count + 1);
  
  // Send it
  await sendEmail({
    to: request.attendees.filter(a => a.side === 'external').map(a => a.email),
    subject: email.subject,
    body: email.body,
    threadId: request.email_thread_id
  });
  
  // Update request back to proposing state
  await db.update(schedulingRequests)
    .set({
      status: 'proposing',
      scheduled_time: null,
      calendar_event_id: null,
      invite_accepted: false,
      last_action_at: new Date(),
      next_action_at: addHours(new Date(), 24),
      next_action_type: 'follow_up',
      conversation_history: [...request.conversation_history, { 
        type: 'no_show_reschedule',
        times: newTimes,
        sent_at: new Date()
      }]
    })
    .where(eq(schedulingRequests.id, request.id));
  
  await db.insert(schedulingActions).values({
    scheduling_request_id: request.id,
    action_type: 'rescheduling_started',
    times_proposed: newTimes,
    message_content: email.body,
    actor: 'ai'
  });
}
```

---

## API Routes

### Create Scheduling Request

```typescript
// app/api/scheduler/route.ts

export async function POST(req: Request) {
  const session = await getSession();
  const body = await req.json();
  
  const {
    dealId,
    companyId,
    meetingType,
    duration,
    context,
    platform,
    internalAttendees,  // Array of user IDs
    externalAttendees,  // Array of { contactId, email, name }
    preferences
  } = body;
  
  // Create scheduling request
  const [request] = await db.insert(schedulingRequests)
    .values({
      created_by: session.userId,
      deal_id: dealId,
      company_id: companyId,
      meeting_type: meetingType,
      duration_minutes: duration,
      context,
      meeting_platform: platform,
      date_range_start: preferences.dateRange?.start || new Date(),
      date_range_end: preferences.dateRange?.end || addDays(new Date(), 14),
      preferred_times: preferences.preferredTimes,
      avoid_days: preferences.avoidDays,
      timezone: preferences.timezone || 'America/New_York',
      status: 'initiated',
      next_action_at: new Date(), // Start immediately
      next_action_type: 'send_initial'
    })
    .returning();
  
  // Add attendees
  const attendeeRecords = [
    ...internalAttendees.map(userId => ({
      scheduling_request_id: request.id,
      side: 'internal',
      user_id: userId,
      email: getUserEmail(userId),
      is_organizer: userId === session.userId
    })),
    ...externalAttendees.map(ext => ({
      scheduling_request_id: request.id,
      side: 'external',
      contact_id: ext.contactId,
      email: ext.email,
      name: ext.name
    }))
  ];
  
  await db.insert(schedulingAttendees).values(attendeeRecords);
  
  return Response.json({ 
    success: true, 
    schedulingRequestId: request.id 
  });
}
```

### Get Scheduling Dashboard

```typescript
// app/api/scheduler/dashboard/route.ts

export async function GET(req: Request) {
  const session = await getSession();
  
  const requests = await db.select()
    .from(schedulingRequests)
    .where(eq(schedulingRequests.created_by, session.userId))
    .orderBy(desc(schedulingRequests.updated_at));
  
  // Group by status
  const dashboard = {
    pending: requests.filter(r => 
      ['proposing', 'awaiting_response', 'negotiating', 'confirming'].includes(r.status)
    ),
    confirmed: requests.filter(r => 
      ['confirmed', 'reminder_sent'].includes(r.status)
    ),
    needsAttention: requests.filter(r => 
      ['no_show'].includes(r.status) || r.requires_human_review
    ),
    completedThisWeek: requests.filter(r => 
      r.status === 'completed' && 
      r.completed_at > startOfWeek(new Date())
    )
  };
  
  return Response.json(dashboard);
}
```

### Pause/Resume/Cancel

```typescript
// app/api/scheduler/[id]/route.ts

export async function PATCH(req: Request, { params }) {
  const { action } = await req.json();
  const { id } = params;
  
  switch (action) {
    case 'pause':
      await db.update(schedulingRequests)
        .set({ 
          status: 'paused',
          next_action_at: null 
        })
        .where(eq(schedulingRequests.id, id));
      break;
      
    case 'resume':
      await db.update(schedulingRequests)
        .set({ 
          status: 'proposing',
          next_action_at: new Date(),
          next_action_type: 'follow_up'
        })
        .where(eq(schedulingRequests.id, id));
      break;
      
    case 'cancel':
      await db.update(schedulingRequests)
        .set({ 
          status: 'cancelled',
          outcome: 'cancelled_by_us'
        })
        .where(eq(schedulingRequests.id, id));
      
      // Cancel calendar event if exists
      const request = await db.select()
        .from(schedulingRequests)
        .where(eq(schedulingRequests.id, id))
        .limit(1);
      
      if (request[0]?.calendar_event_id) {
        await microsoftGraph.deleteEvent(request[0].calendar_event_id);
      }
      break;
  }
  
  return Response.json({ success: true });
}
```

---

## Stop Rules for Scheduler

```typescript
// lib/scheduler/stopRules.ts

interface SchedulingStopRules {
  maxAttempts: number;
  maxNoShows: number;
  maxDaysActive: number;
  minDaysBetweenFollowUps: number;
  pauseOnNegativeSentiment: boolean;
}

const DEFAULT_STOP_RULES: SchedulingStopRules = {
  maxAttempts: 5,           // Stop after 5 follow-ups
  maxNoShows: 3,            // Stop after 3 no-shows
  maxDaysActive: 21,        // Stop after 3 weeks of trying
  minDaysBetweenFollowUps: 1,
  pauseOnNegativeSentiment: true
};

async function shouldStopScheduling(
  request: SchedulingRequest
): Promise<{ stop: boolean; reason?: string }> {
  
  const rules = DEFAULT_STOP_RULES;
  
  // Check attempt count
  if (request.attempt_count >= rules.maxAttempts) {
    return { 
      stop: true, 
      reason: `Reached maximum attempts (${rules.maxAttempts})` 
    };
  }
  
  // Check no-show count
  if (request.no_show_count >= rules.maxNoShows) {
    return { 
      stop: true, 
      reason: `Too many no-shows (${rules.maxNoShows})` 
    };
  }
  
  // Check age
  const daysActive = daysBetween(request.created_at, new Date());
  if (daysActive >= rules.maxDaysActive) {
    return { 
      stop: true, 
      reason: `Request expired after ${rules.maxDaysActive} days` 
    };
  }
  
  return { stop: false };
}

async function handleSchedulingStop(
  request: SchedulingRequest,
  reason: string
): Promise<void> {
  
  // Update request
  await db.update(schedulingRequests)
    .set({
      status: 'cancelled',
      outcome: 'gave_up',
      outcome_notes: reason
    })
    .where(eq(schedulingRequests.id, request.id));
  
  // Notify the user
  await createNotification({
    userId: request.created_by,
    type: 'scheduling_stopped',
    title: 'Scheduling attempt ended',
    message: `Stopped trying to schedule with ${request.company_name}: ${reason}`,
    link: `/scheduler/${request.id}`
  });
  
  // Log for learning
  await db.insert(schedulingActions).values({
    scheduling_request_id: request.id,
    action_type: 'stopped',
    ai_reasoning: reason,
    actor: 'ai'
  });
}
```

---

## Integration with Deal Intelligence

The scheduler integrates with the broader X-FORCE intelligence system:

```typescript
// When scheduling request completes or fails, update deal intelligence

async function updateDealFromScheduling(
  request: SchedulingRequest
): Promise<void> {
  
  if (!request.deal_id) return;
  
  if (request.outcome === 'held') {
    // Meeting happened - positive signal
    await addDealSignal(request.deal_id, {
      type: 'meeting_held',
      description: `${request.meeting_type} meeting completed`,
      impact: 'positive',
      weight: 0.3
    });
  }
  
  if (request.no_show_count > 0) {
    // No-shows are concerning
    await addDealSignal(request.deal_id, {
      type: 'no_show',
      description: `Prospect no-showed ${request.no_show_count} time(s)`,
      impact: 'negative',
      weight: 0.2 * request.no_show_count
    });
  }
  
  if (request.outcome === 'gave_up') {
    // Couldn't schedule - serious concern
    await addDealSignal(request.deal_id, {
      type: 'scheduling_failed',
      description: `Unable to schedule meeting after ${request.attempt_count} attempts`,
      impact: 'negative',
      weight: 0.5
    });
    
    // This might trigger a Human Leverage Moment
    await checkForLeverageMoment(request.deal_id, 'relationship_repair');
  }
}
```

---

---

## Enhanced Intelligence Layer

Based on cross-model analysis, these upgrades transform the scheduler from "excellent" to "category-defining."

### Scheduling Intent Intelligence

**Scheduling behavior is qualification data.** Every response (or non-response) signals intent.

```typescript
// lib/scheduler/intentIntelligence.ts

interface SchedulingIntent {
  level: 'high' | 'medium' | 'low' | 'dead';
  confidence: number;
  signals: IntentSignal[];
  dealImpact: {
    confidenceAdjustment: number; // -20 to +20
    recommendation: string;
  };
}

interface IntentSignal {
  type: string;
  weight: number;
  evidence: string;
}

async function analyzeSchedulingIntent(
  request: SchedulingRequest
): Promise<SchedulingIntent> {
  
  const signals: IntentSignal[] = [];
  
  // Response speed signals
  const avgResponseTime = calculateAvgResponseTime(request.conversation_history);
  if (avgResponseTime < 4) { // hours
    signals.push({ type: 'fast_responder', weight: 0.3, evidence: `Avg response: ${avgResponseTime}h` });
  } else if (avgResponseTime > 48) {
    signals.push({ type: 'slow_responder', weight: -0.2, evidence: `Avg response: ${avgResponseTime}h` });
  }
  
  // Proposal behavior
  const proposedAlternatives = request.conversation_history
    .filter(h => h.type === 'prospect_proposed_times').length;
  if (proposedAlternatives > 0) {
    signals.push({ type: 'active_participant', weight: 0.4, evidence: 'Proposed alternative times' });
  }
  
  // Delay patterns
  const delays = request.conversation_history
    .filter(h => h.type === 'prospect_delayed').length;
  if (delays >= 2) {
    signals.push({ type: 'serial_delayer', weight: -0.3, evidence: `Delayed ${delays} times` });
  }
  
  // Language analysis
  const lastResponse = getLastProspectResponse(request);
  if (lastResponse) {
    const languageSignals = analyzeLanguage(lastResponse);
    
    if (languageSignals.includes('next_quarter')) {
      signals.push({ type: 'pushing_out', weight: -0.5, evidence: '"Next quarter" language' });
    }
    if (languageSignals.includes('eager')) {
      signals.push({ type: 'eager', weight: 0.3, evidence: 'Positive/eager language' });
    }
    if (languageSignals.includes('loop_in_others')) {
      signals.push({ type: 'expanding_stakeholders', weight: 0.2, evidence: 'Wants to include others' });
    }
  }
  
  // No-show history
  if (request.no_show_count > 0) {
    signals.push({ 
      type: 'no_show_history', 
      weight: -0.3 * request.no_show_count, 
      evidence: `${request.no_show_count} no-shows` 
    });
  }
  
  // Calculate overall intent
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const level = totalWeight > 0.3 ? 'high' 
              : totalWeight > 0 ? 'medium'
              : totalWeight > -0.3 ? 'low'
              : 'dead';
  
  // Determine deal impact
  const dealImpact = {
    confidenceAdjustment: Math.round(totalWeight * 30), // -20 to +20 range
    recommendation: generateIntentRecommendation(level, signals)
  };
  
  return {
    level,
    confidence: Math.min(0.9, 0.5 + (signals.length * 0.1)),
    signals,
    dealImpact
  };
}

function generateIntentRecommendation(
  level: string, 
  signals: IntentSignal[]
): string {
  switch (level) {
    case 'high':
      return 'Strong buying signal. Prioritize this scheduling request.';
    case 'medium':
      return 'Normal engagement. Continue standard follow-up.';
    case 'low':
      return 'Weak engagement. Consider de-escalating ask or human outreach.';
    case 'dead':
      return 'Very low intent. Recommend pausing and re-engaging next quarter.';
  }
}
```

**Feed this into Deal Intelligence:**

```typescript
// After each scheduling interaction
async function updateDealFromSchedulingIntent(
  request: SchedulingRequest
): Promise<void> {
  
  const intent = await analyzeSchedulingIntent(request);
  
  if (request.deal_id) {
    await addDealSignal(request.deal_id, {
      type: 'scheduling_intent',
      description: `Scheduling intent: ${intent.level}`,
      impact: intent.level === 'high' ? 'positive' : 
              intent.level === 'dead' ? 'negative' : 'neutral',
      weight: Math.abs(intent.dealImpact.confidenceAdjustment) / 100,
      details: intent.signals
    });
  }
}
```

---

### Meeting-Type Strategy Engine

Different meetings deserve different approaches:

```typescript
// lib/scheduler/meetingStrategy.ts

interface MeetingStrategy {
  maxAttempts: number;
  followUpIntervalHours: number;
  tone: 'light' | 'professional' | 'direct' | 'executive';
  deEscalationEnabled: boolean;
  deEscalationOptions: DeEscalationOption[];
  escalateToHumanAfter: number;
  channelProgression: ('email' | 'sms' | 'phone')[];
}

interface DeEscalationOption {
  fromDuration: number;
  toDuration: number;
  newTitle: string;
  triggerAfterAttempts: number;
}

const MEETING_STRATEGIES: Record<string, MeetingStrategy> = {
  
  discovery: {
    maxAttempts: 4,
    followUpIntervalHours: 24,
    tone: 'light',
    deEscalationEnabled: true,
    deEscalationOptions: [
      { fromDuration: 30, toDuration: 15, newTitle: 'Quick Intro', triggerAfterAttempts: 2 }
    ],
    escalateToHumanAfter: 3,
    channelProgression: ['email', 'email', 'sms', 'phone']
  },
  
  demo: {
    maxAttempts: 5,
    followUpIntervalHours: 24,
    tone: 'professional',
    deEscalationEnabled: true,
    deEscalationOptions: [
      { fromDuration: 60, toDuration: 30, newTitle: 'Focused Demo', triggerAfterAttempts: 2 },
      { fromDuration: 30, toDuration: 15, newTitle: 'Executive Summary', triggerAfterAttempts: 4 }
    ],
    escalateToHumanAfter: 4,
    channelProgression: ['email', 'email', 'sms', 'email', 'phone']
  },
  
  exec_review: {
    maxAttempts: 2,
    followUpIntervalHours: 48,
    tone: 'executive',
    deEscalationEnabled: false,
    deEscalationOptions: [],
    escalateToHumanAfter: 1, // Fast escalation for exec meetings
    channelProgression: ['email', 'phone'] // No SMS for execs
  },
  
  follow_up: {
    maxAttempts: 3,
    followUpIntervalHours: 48,
    tone: 'light',
    deEscalationEnabled: true,
    deEscalationOptions: [
      { fromDuration: 30, toDuration: 15, newTitle: 'Quick Sync', triggerAfterAttempts: 2 }
    ],
    escalateToHumanAfter: 2,
    channelProgression: ['email', 'sms', 'phone']
  },
  
  negotiation: {
    maxAttempts: 3,
    followUpIntervalHours: 24,
    tone: 'direct',
    deEscalationEnabled: false,
    deEscalationOptions: [],
    escalateToHumanAfter: 1, // Human should handle negotiation scheduling
    channelProgression: ['email', 'phone']
  }
};

async function shouldDeEscalate(
  request: SchedulingRequest
): Promise<{ should: boolean; option?: DeEscalationOption }> {
  
  const strategy = MEETING_STRATEGIES[request.meeting_type] || MEETING_STRATEGIES.discovery;
  
  if (!strategy.deEscalationEnabled) return { should: false };
  
  for (const option of strategy.deEscalationOptions) {
    if (request.duration_minutes === option.fromDuration && 
        request.attempt_count >= option.triggerAfterAttempts) {
      return { should: true, option };
    }
  }
  
  return { should: false };
}
```

**De-escalation Email Example:**

```typescript
async function generateDeEscalationEmail(
  request: SchedulingRequest,
  option: DeEscalationOption
): Promise<{ subject: string; body: string }> {
  
  const prompt = `Generate a scheduling email that de-escalates the meeting ask.

## Context
- Original meeting: ${request.meeting_type} (${request.duration_minutes} min)
- New proposal: ${option.newTitle} (${option.toDuration} min)
- We've tried ${request.attempt_count} times to schedule the longer meeting

## Goal
Make it easy to say yes by reducing the ask. Don't sound desperate.
Frame it as "I know time is tight" not "since you're not responding."

Write a brief email (50 words max) that:
1. Acknowledges their busy schedule
2. Proposes the shorter format
3. Maintains value proposition
4. Makes it easy to respond

Return JSON:
{
  "subject": "...",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

---

### Multi-Channel Progression

**Critical for pest control** — owners are in the field, email gets ignored.

```typescript
// lib/scheduler/channels.ts

interface ChannelConfig {
  email: {
    enabled: boolean;
    fromAddress: string;
  };
  sms: {
    enabled: boolean;
    fromNumber: string;
    provider: 'twilio' | 'bandwidth';
  };
  phone: {
    enabled: boolean;
    triggerHumanCall: boolean;
  };
}

async function getNextChannel(
  request: SchedulingRequest
): Promise<'email' | 'sms' | 'phone'> {
  
  const strategy = MEETING_STRATEGIES[request.meeting_type];
  const attemptIndex = Math.min(
    request.attempt_count, 
    strategy.channelProgression.length - 1
  );
  
  return strategy.channelProgression[attemptIndex];
}

async function sendSchedulingMessage(
  request: SchedulingRequest,
  content: { subject?: string; body: string },
  channel: 'email' | 'sms' | 'phone'
): Promise<void> {
  
  const recipient = request.attendees.find(a => a.side === 'external');
  
  switch (channel) {
    case 'email':
      await sendEmail({
        to: recipient.email,
        subject: content.subject,
        body: content.body,
        threadId: request.email_thread_id
      });
      break;
      
    case 'sms':
      // SMS should be shorter and more casual
      const smsContent = await generateSMSVersion(content.body);
      await sendSMS({
        to: recipient.phone,
        body: smsContent,
        from: config.sms.fromNumber
      });
      break;
      
    case 'phone':
      // Don't auto-call — trigger human leverage moment
      await createSchedulingLeverageMoment(request, 'phone_call_needed');
      break;
  }
  
  // Log the action
  await db.insert(schedulingActions).values({
    scheduling_request_id: request.id,
    action_type: `${channel}_sent`,
    message_content: content.body,
    actor: 'ai'
  });
}

async function generateSMSVersion(emailBody: string): Promise<string> {
  const prompt = `Convert this scheduling email to a brief SMS (under 160 chars).
Keep it casual and friendly. Include one specific time option.

Email:
${emailBody}

Return just the SMS text, no JSON.`;

  const response = await callAI({ prompt, maxTokens: 100 });
  return response.content.trim();
}
```

**SMS Templates:**

```typescript
const SMS_TEMPLATES = {
  initial: "Hey {{name}}, it's {{sender}}'s assistant. Trying to grab 30 min for that {{meeting_type}}. Would {{time}} work?",
  
  follow_up: "Hi {{name}} - circling back on scheduling that {{meeting_type}}. {{time}} still open if that's easier?",
  
  no_show: "Hey {{name}} - missed you earlier! No worries. Want to try {{time}} instead?",
  
  final: "{{name}} - last try from me! Would a quick 15-min call work better? Just reply with a time."
};
```

---

### Dynamic Attendee Optimization

**Surface when internal attendees are blocking scheduling:**

```typescript
// lib/scheduler/attendeeOptimization.ts

interface AttendeeAnalysis {
  blockingAttendees: {
    attendee: SchedulingAttendee;
    blockingSlots: number;
    removalImpact: number; // % increase in available slots
  }[];
  recommendation: {
    action: 'proceed' | 'remove_optional' | 'escalate';
    attendeesToRemove?: string[];
    reason: string;
    newAvailabilityPct: number;
  };
}

async function analyzeAttendeeImpact(
  request: SchedulingRequest
): Promise<AttendeeAnalysis> {
  
  const internalAttendees = request.attendees.filter(a => a.side === 'internal');
  
  // Get each person's busy times
  const busyByPerson: Map<string, TimeSlot[]> = new Map();
  for (const attendee of internalAttendees) {
    const busy = await getCalendarBusy(attendee.user_id, request.date_range_start, request.date_range_end);
    busyByPerson.set(attendee.user_id, busy);
  }
  
  // Calculate total available slots with everyone
  const allAvailable = await findAvailableTimes({
    attendees: internalAttendees,
    duration: request.duration_minutes,
    dateRange: { start: request.date_range_start, end: request.date_range_end },
    preferences: request.preferences
  });
  
  // Calculate impact of removing each person
  const blockingAnalysis = [];
  for (const attendee of internalAttendees) {
    if (attendee.is_organizer) continue; // Never remove organizer
    
    const withoutThisPerson = internalAttendees.filter(a => a.user_id !== attendee.user_id);
    const slotsWithout = await findAvailableTimes({
      attendees: withoutThisPerson,
      duration: request.duration_minutes,
      dateRange: { start: request.date_range_start, end: request.date_range_end },
      preferences: request.preferences
    });
    
    const impact = ((slotsWithout.length - allAvailable.length) / Math.max(allAvailable.length, 1)) * 100;
    
    if (impact > 20) { // Significant blocker
      blockingAnalysis.push({
        attendee,
        blockingSlots: slotsWithout.length - allAvailable.length,
        removalImpact: Math.round(impact)
      });
    }
  }
  
  // Generate recommendation
  let recommendation;
  if (allAvailable.length >= 3) {
    recommendation = {
      action: 'proceed',
      reason: 'Sufficient availability with all attendees',
      newAvailabilityPct: 100
    };
  } else if (blockingAnalysis.length > 0) {
    const topBlocker = blockingAnalysis.sort((a, b) => b.removalImpact - a.removalImpact)[0];
    if (!topBlocker.attendee.is_required) {
      recommendation = {
        action: 'remove_optional',
        attendeesToRemove: [topBlocker.attendee.name],
        reason: `Removing ${topBlocker.attendee.name} increases availability by ${topBlocker.removalImpact}%`,
        newAvailabilityPct: topBlocker.removalImpact
      };
    } else {
      recommendation = {
        action: 'escalate',
        reason: `Required attendee ${topBlocker.attendee.name} blocking ${topBlocker.removalImpact}% of slots`,
        newAvailabilityPct: 0
      };
    }
  } else {
    recommendation = {
      action: 'escalate',
      reason: 'No available slots found',
      newAvailabilityPct: 0
    };
  }
  
  return { blockingAttendees: blockingAnalysis, recommendation };
}
```

**Surface in Dashboard:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Scheduling Insight                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Demo with Acme Pest is blocked by internal availability.       │
│                                                                 │
│  Blocker: Sarah (Sales Engineer)                                │
│  Impact: Removing her increases available slots by 78%          │
│                                                                 │
│  Recommendation: Proceed with AE-only discovery, loop Sarah     │
│  into the technical deep-dive later.                            │
│                                                                 │
│         [Remove Sarah & Continue]    [Keep & Escalate]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Reputation Guardrails

**Prevent the "over-eager bot" problem:**

```typescript
// lib/scheduler/reputationGuard.ts

interface ReputationRisk {
  score: number; // 0-100, higher = more risk
  level: 'low' | 'medium' | 'high' | 'critical';
  drivers: string[];
  recommendation: 'continue' | 'soften' | 'pause' | 'human_takeover';
  adjustments: {
    toneShift?: 'softer' | 'more_direct';
    intervalMultiplier?: number; // 1.5 = 50% longer between follow-ups
    channelRestriction?: ('email' | 'sms' | 'phone')[];
  };
}

async function assessReputationRisk(
  request: SchedulingRequest
): Promise<ReputationRisk> {
  
  const drivers: string[] = [];
  let riskScore = 0;
  
  // Factor 1: Follow-up volume
  if (request.attempt_count >= 4) {
    riskScore += 20;
    drivers.push(`${request.attempt_count} follow-up attempts`);
  }
  
  // Factor 2: No-show history
  if (request.no_show_count >= 2) {
    riskScore += 25;
    drivers.push(`${request.no_show_count} no-shows`);
  }
  
  // Factor 3: Response sentiment
  const lastResponse = getLastProspectResponse(request);
  if (lastResponse) {
    const sentiment = await analyzeSentiment(lastResponse);
    if (sentiment === 'negative') {
      riskScore += 30;
      drivers.push('Negative sentiment in last response');
    } else if (sentiment === 'frustrated') {
      riskScore += 40;
      drivers.push('Frustrated tone detected');
    }
  }
  
  // Factor 4: Response rate declining
  const responseRate = calculateResponseRate(request.conversation_history);
  if (responseRate < 0.3) {
    riskScore += 15;
    drivers.push('Low response rate (<30%)');
  }
  
  // Factor 5: Deal value vs. persistence
  const deal = await getDeal(request.deal_id);
  if (deal && deal.estimated_value < 5000 && request.attempt_count > 3) {
    riskScore += 10;
    drivers.push('High persistence for low-value deal');
  }
  
  // Factor 6: Account relationship history
  const accountHistory = await getAccountSchedulingHistory(request.company_id);
  if (accountHistory.previousFailedRequests > 2) {
    riskScore += 20;
    drivers.push('Multiple failed scheduling attempts with this account');
  }
  
  // Determine level and recommendation
  const level = riskScore >= 70 ? 'critical'
              : riskScore >= 50 ? 'high'
              : riskScore >= 30 ? 'medium'
              : 'low';
  
  const recommendation = level === 'critical' ? 'human_takeover'
                       : level === 'high' ? 'pause'
                       : level === 'medium' ? 'soften'
                       : 'continue';
  
  const adjustments: ReputationRisk['adjustments'] = {};
  if (level === 'medium') {
    adjustments.toneShift = 'softer';
    adjustments.intervalMultiplier = 1.5;
  } else if (level === 'high') {
    adjustments.intervalMultiplier = 2;
    adjustments.channelRestriction = ['email']; // No SMS when risk is high
  }
  
  return { score: riskScore, level, drivers, recommendation, adjustments };
}
```

---

### Scheduling Leverage Moments

**Scheduling problems deserve their own Human Leverage triggers:**

```typescript
// lib/scheduler/leverageMoments.ts

const SCHEDULING_LEVERAGE_TRIGGERS = {
  
  persistent_non_response: {
    condition: (req) => req.attempt_count >= 3 && !hasRecentResponse(req, 72),
    type: 'relationship_repair',
    urgency: 'high',
    briefTemplate: {
      situation: "{{contact_name}} has opened {{open_count}} scheduling emails but hasn't responded.",
      whyItMatters: "They're interested (opening emails) but something is blocking commitment. Human touch needed.",
      whatAIDid: "Sent {{attempt_count}} scheduling emails with varied times and approaches.",
      whatYouShouldDo: "Call directly. The AI has warmed them up — now close the loop personally.",
      talkingPoints: [
        "Hey {{contact_name}}, I saw my assistant was trying to grab time for that {{meeting_type}}.",
        "I figured it's easier if I just gave you a quick ring.",
        "Is now an OK time, or should I try back later today?"
      ],
      whatToAvoid: [
        "Don't mention they haven't responded — they know",
        "Don't be apologetic about calling",
        "Don't offer the scheduling link"
      ]
    }
  },
  
  exec_scheduling_stall: {
    condition: (req) => req.meeting_type === 'exec_review' && req.attempt_count >= 2,
    type: 'exec_introduction',
    urgency: 'high',
    briefTemplate: {
      situation: "Executive meeting with {{contact_name}} isn't getting scheduled.",
      whyItMatters: "Exec meetings require peer-level outreach. AI can't substitute for human gravitas here.",
      whatAIDid: "Sent {{attempt_count}} scheduling requests.",
      whatYouShouldDo: "Have your exec reach out directly, or ask the champion to facilitate.",
      talkingPoints: [
        "Ask champion: 'Could you help me get 15 minutes with {{contact_name}}?'",
        "Exec-to-exec: 'I wanted to connect directly about how we might help {{company_name}}.'"
      ]
    }
  },
  
  multiple_no_shows: {
    condition: (req) => req.no_show_count >= 2,
    type: 'relationship_repair',
    urgency: 'medium',
    briefTemplate: {
      situation: "{{contact_name}} has missed {{no_show_count}} scheduled meetings.",
      whyItMatters: "Pattern of no-shows suggests either low priority or organizational chaos. Need to understand which.",
      whatAIDid: "Rescheduled {{no_show_count}} times with understanding tone.",
      whatYouShouldDo: "Call to understand what's happening. Offer flexibility.",
      talkingPoints: [
        "I know things are crazy on your end — is now still a good time to be looking at this?",
        "Would it help if we pushed this out a few weeks?",
        "Is there someone else I should be coordinating with?"
      ],
      whatToAvoid: [
        "Don't express frustration about missed meetings",
        "Don't assume they're not interested — emergencies happen"
      ]
    }
  },
  
  intent_collapse: {
    condition: (req) => getSchedulingIntent(req).level === 'dead',
    type: 'deal_rescue',
    urgency: 'high',
    briefTemplate: {
      situation: "Scheduling intent has dropped to critical. {{contact_name}} appears disengaged.",
      whyItMatters: "Deal at risk. Without a meeting, this opportunity will stall.",
      whatAIDid: "Detected declining engagement through {{signals}}.",
      whatYouShouldDo: "Direct outreach to understand if timing is wrong or interest has faded.",
      talkingPoints: [
        "Totally understand if now isn't the right time.",
        "Should we reconnect next quarter instead?",
        "Is there something I should know about what's happening on your end?"
      ]
    }
  }
};

async function checkSchedulingLeverageMoments(
  request: SchedulingRequest
): Promise<void> {
  
  for (const [key, trigger] of Object.entries(SCHEDULING_LEVERAGE_TRIGGERS)) {
    if (trigger.condition(request)) {
      await createLeverageMoment({
        deal_id: request.deal_id,
        company_id: request.company_id,
        type: trigger.type,
        urgency: trigger.urgency,
        source: 'scheduler',
        source_id: request.id,
        brief: generateBrief(trigger.briefTemplate, request)
      });
      
      // Only trigger one moment per check
      break;
    }
  }
}
```

---

### Seasonality Awareness (Pest Control Specific)

```typescript
// lib/scheduler/seasonality.ts

interface SeasonalContext {
  isBusySeason: boolean;
  seasonType: string;
  adjustments: {
    followUpIntervalMultiplier: number;
    toneAdjustment: string;
    contextNote: string;
  };
}

function getPestControlSeasonality(
  state: string,
  date: Date = new Date()
): SeasonalContext {
  
  const month = date.getMonth();
  
  // Termite swarm season (Southeast: March-May)
  if (['FL', 'GA', 'SC', 'NC', 'AL', 'MS', 'LA', 'TX'].includes(state)) {
    if (month >= 2 && month <= 4) {
      return {
        isBusySeason: true,
        seasonType: 'termite_swarm',
        adjustments: {
          followUpIntervalMultiplier: 2, // Double the wait time
          toneAdjustment: 'acknowledge_busy',
          contextNote: "I know swarm season is hitting hard right now."
        }
      };
    }
  }
  
  // Mosquito/outdoor pest season (Summer everywhere)
  if (month >= 5 && month <= 8) {
    return {
      isBusySeason: true,
      seasonType: 'summer_peak',
      adjustments: {
        followUpIntervalMultiplier: 1.5,
        toneAdjustment: 'acknowledge_busy',
        contextNote: "I know summer is your busiest time."
      }
    };
  }
  
  // Slower season (Winter)
  if (month >= 11 || month <= 1) {
    return {
      isBusySeason: false,
      seasonType: 'winter_slow',
      adjustments: {
        followUpIntervalMultiplier: 0.75, // Can follow up faster
        toneAdjustment: 'planning_ahead',
        contextNote: "Perfect time to get set up before spring hits."
      }
    };
  }
  
  // Normal season
  return {
    isBusySeason: false,
    seasonType: 'normal',
    adjustments: {
      followUpIntervalMultiplier: 1,
      toneAdjustment: 'standard',
      contextNote: ''
    }
  };
}
```

---

### Champion Leverage

**Strategically involve champions in scheduling:**

```typescript
// lib/scheduler/championLeverage.ts

async function shouldInvolveChampion(
  request: SchedulingRequest
): Promise<{ should: boolean; strategy?: string }> {
  
  // Find champion at this company
  const champion = await db.select()
    .from(contacts)
    .where(
      and(
        eq(contacts.company_id, request.company_id),
        eq(contacts.is_champion, true)
      )
    )
    .limit(1);
  
  if (!champion.length) return { should: false };
  
  const targetContact = request.attendees.find(a => a.side === 'external');
  
  // Don't CC champion on their own scheduling
  if (champion[0].id === targetContact?.contact_id) return { should: false };
  
  // Involve champion after 2 failed attempts
  if (request.attempt_count >= 2 && request.status === 'awaiting_response') {
    return {
      should: true,
      strategy: 'cc_on_followup' // CC them on next email
    };
  }
  
  // Involve champion for exec meetings immediately
  if (request.meeting_type === 'exec_review') {
    return {
      should: true,
      strategy: 'ask_for_intro' // Ask champion to facilitate
    };
  }
  
  return { should: false };
}

async function generateChampionAssistedEmail(
  request: SchedulingRequest,
  champion: Contact,
  strategy: string
): Promise<{ subject: string; body: string; cc?: string }> {
  
  if (strategy === 'cc_on_followup') {
    // CC champion, subtly applying social pressure
    return {
      subject: `Re: ${request.title}`,
      body: `Hi {{target_name}},\n\nCircling back on finding time for our {{meeting_type}}. Copying {{champion_name}} in case it's easier to coordinate.\n\nWould any of these work?\n{{times}}\n\nBest,\n{{sender}}`,
      cc: champion.email
    };
  }
  
  if (strategy === 'ask_for_intro') {
    // Direct ask to champion
    return {
      subject: `Quick favor - connecting with {{target_name}}`,
      body: `Hi {{champion_name}},\n\nI'm trying to schedule a {{meeting_type}} with {{target_name}} but having trouble finding a time. Would you be able to help connect us?\n\nAppreciate any help!\n\n{{sender}}`,
      cc: undefined // Send directly to champion
    };
  }
}
```

---

### Conflict Resolution Brain

**Intelligently handle complex scheduling constraints:**

```typescript
// lib/scheduler/conflictResolution.ts

interface SchedulingConflict {
  type: 'person_unavailable' | 'timing_constraint' | 'decision_pending' | 
        'need_approval' | 'external_dependency' | 'competing_priority';
  description: string;
  resolution: ConflictResolution;
}

interface ConflictResolution {
  action: 'pause_and_resume' | 'work_around' | 'escalate' | 'acknowledge_and_continue';
  pauseUntil?: Date;
  adjustedApproach?: string;
  followUpMessage?: string;
}

async function analyzeSchedulingConflict(
  email: IncomingEmail,
  request: SchedulingRequest
): Promise<SchedulingConflict | null> {
  
  const prompt = `Analyze this scheduling response for conflicts or constraints.

## Email
From: ${email.from}
Body: ${email.body}

## Context
We're trying to schedule a ${request.meeting_type} (${request.duration_minutes} min)

---

Identify if there's a scheduling conflict. Types:

1. person_unavailable: "My GM is out until Thursday", "I'm on vacation next week"
2. timing_constraint: "Mornings don't work", "Only available after 3pm"
3. decision_pending: "Need to check with my partner first", "Waiting on board approval"
4. need_approval: "Let me run this by my boss", "Need to get buy-in"
5. external_dependency: "Waiting on another vendor", "Need to finish current project"
6. competing_priority: "Slammed with emergencies", "In the middle of busy season"

If a conflict exists, return JSON:
{
  "hasConflict": true,
  "type": "...",
  "description": "What the constraint is",
  "specificDate": "ISO date if they mention when constraint ends, null otherwise",
  "personMentioned": "Name of person involved if applicable",
  "canWorkAround": true/false
}

If no conflict (just picking a time or declining), return:
{
  "hasConflict": false
}`;

  const response = await callAI({ prompt });
  const analysis = JSON.parse(response.content);
  
  if (!analysis.hasConflict) return null;
  
  // Determine resolution strategy
  const resolution = determineResolution(analysis, request);
  
  return {
    type: analysis.type,
    description: analysis.description,
    resolution
  };
}

function determineResolution(
  analysis: any, 
  request: SchedulingRequest
): ConflictResolution {
  
  switch (analysis.type) {
    case 'person_unavailable':
      if (analysis.specificDate) {
        // They told us when the person is back - pause until then
        const resumeDate = new Date(analysis.specificDate);
        return {
          action: 'pause_and_resume',
          pauseUntil: resumeDate,
          followUpMessage: `Got it! I'll reach back out on ${formatDate(resumeDate)} when ${analysis.personMentioned || 'they'} are back. Talk soon!`
        };
      } else {
        // Vague - ask for clarification
        return {
          action: 'acknowledge_and_continue',
          followUpMessage: `No problem! When would be a good time to circle back? Happy to pause until things settle down.`
        };
      }
      
    case 'timing_constraint':
      // Adjust our approach to match their constraints
      return {
        action: 'work_around',
        adjustedApproach: analysis.description, // e.g., "Only afternoons"
        followUpMessage: `Got it - I'll focus on ${analysis.description}. Here are some options that should work better...`
      };
      
    case 'decision_pending':
    case 'need_approval':
      // They need internal alignment - give them space
      const pauseDays = analysis.type === 'need_approval' ? 3 : 5;
      return {
        action: 'pause_and_resume',
        pauseUntil: addDays(new Date(), pauseDays),
        followUpMessage: `Totally understand - take the time you need. I'll check back in ${pauseDays === 3 ? 'a few days' : 'about a week'} to see where things land.`
      };
      
    case 'external_dependency':
      return {
        action: 'pause_and_resume',
        pauseUntil: addDays(new Date(), 7),
        followUpMessage: `Makes sense to wait until that's wrapped up. I'll circle back next week - just let me know if anything changes!`
      };
      
    case 'competing_priority':
      // Acknowledge their situation, offer flexibility
      const season = getPestControlSeasonality(request.company_state);
      if (season.isBusySeason) {
        return {
          action: 'pause_and_resume',
          pauseUntil: addDays(new Date(), 10),
          followUpMessage: `I know ${season.seasonType.replace('_', ' ')} is hitting hard right now. I'll reach back out in a week or two when things calm down. Hang in there!`
        };
      }
      return {
        action: 'acknowledge_and_continue',
        followUpMessage: `I hear you - things are crazy! Would a quick 15-minute call be easier to squeeze in? Or I'm happy to wait a couple weeks if that's better.`
      };
      
    default:
      return {
        action: 'escalate',
        followUpMessage: null
      };
  }
}

async function handleConflict(
  request: SchedulingRequest,
  conflict: SchedulingConflict
): Promise<void> {
  
  const { resolution } = conflict;
  
  // Log the conflict
  await db.insert(schedulingActions).values({
    scheduling_request_id: request.id,
    action_type: 'conflict_detected',
    ai_reasoning: JSON.stringify(conflict),
    actor: 'ai'
  });
  
  switch (resolution.action) {
    case 'pause_and_resume':
      // Update request to paused state with resume date
      await db.update(schedulingRequests)
        .set({
          status: 'paused',
          next_action_at: resolution.pauseUntil,
          next_action_type: 'resume_after_conflict',
          conflict_context: conflict
        })
        .where(eq(schedulingRequests.id, request.id));
      
      // Send acknowledgment
      if (resolution.followUpMessage) {
        await sendSchedulingMessage(request, {
          subject: `Re: ${request.title}`,
          body: resolution.followUpMessage
        }, 'email');
      }
      break;
      
    case 'work_around':
      // Update preferences based on their constraints
      const updatedPreferences = {
        ...request.preferences,
        constraint: resolution.adjustedApproach
      };
      
      await db.update(schedulingRequests)
        .set({ preferences: updatedPreferences })
        .where(eq(schedulingRequests.id, request.id));
      
      // Find new times matching their constraints
      const newTimes = await findAvailableTimesWithConstraint(
        request,
        resolution.adjustedApproach
      );
      
      // Send new options
      const email = await generateConstraintAwareEmail(request, newTimes, resolution);
      await sendSchedulingMessage(request, email, 'email');
      break;
      
    case 'escalate':
      await createSchedulingLeverageMoment(request, 'complex_conflict');
      break;
  }
}
```

**Conflict-Aware Email Generation:**

```typescript
async function generateConstraintAwareEmail(
  request: SchedulingRequest,
  newTimes: Date[],
  resolution: ConflictResolution
): Promise<{ subject: string; body: string }> {
  
  const prompt = `Generate a scheduling email that acknowledges their constraint.

## Their Constraint
${resolution.adjustedApproach}

## New Times (matching their constraint)
${newTimes.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n')}

## Context
Meeting: ${request.meeting_type} (${request.duration_minutes} min)

---

Write an email that:
1. Shows you heard their constraint
2. Offers times that match what they said works
3. Keeps it brief (50 words max)
4. Sounds helpful, not robotic

Return JSON:
{
  "subject": "Re: ...",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

---

### Social Proof Injection

**Follow-ups that add value, not just ask for time:**

```typescript
// lib/scheduler/socialProof.ts

interface SocialProofContent {
  type: 'case_study' | 'stat' | 'testimonial' | 'resource' | 'industry_insight';
  content: string;
  relevance: string; // Why this is relevant to them
  link?: string;
}

async function getSocialProofForFollowUp(
  request: SchedulingRequest,
  attemptNumber: number
): Promise<SocialProofContent | null> {
  
  // Only add social proof on attempts 2-4
  if (attemptNumber < 2 || attemptNumber > 4) return null;
  
  // Get company context
  const company = await getCompany(request.company_id);
  const deal = request.deal_id ? await getDeal(request.deal_id) : null;
  
  // Find relevant proof based on their profile
  const proofOptions = await findRelevantProof({
    industry: company.industry,
    companySize: company.employee_count,
    ownershipType: company.ownership_type,
    painPoints: deal?.identified_pain_points || [],
    products: deal?.products || []
  });
  
  if (!proofOptions.length) return null;
  
  // Select the best one we haven't used yet
  const usedProof = request.conversation_history
    .filter(h => h.social_proof_id)
    .map(h => h.social_proof_id);
  
  const available = proofOptions.filter(p => !usedProof.includes(p.id));
  
  return available[0] || null;
}

const SOCIAL_PROOF_LIBRARY = {
  // Case studies by company profile
  case_studies: [
    {
      id: 'cs_family_call_abandon',
      type: 'case_study',
      title: 'How ABC Pest Cut Call Abandonment by 15%',
      summary: 'Family-owned company with 12 trucks reduced missed calls from 18% to 3%',
      link: '/resources/abc-pest-case-study',
      relevantFor: {
        ownershipType: ['family', 'independent'],
        painPoints: ['missed_calls', 'after_hours', 'call_volume']
      }
    },
    {
      id: 'cs_pe_efficiency',
      type: 'case_study',
      title: 'PE-Backed Consolidator Saves 40 Hours/Month',
      summary: 'Multi-location operator automated scheduling across 8 branches',
      link: '/resources/pe-efficiency-study',
      relevantFor: {
        ownershipType: ['pe_backed'],
        companySize: { min: 50 }
      }
    }
  ],
  
  // Quick stats
  stats: [
    {
      id: 'stat_response_time',
      type: 'stat',
      content: '78% of customers choose the first company that answers',
      source: 'PCT Magazine 2024',
      relevantFor: { painPoints: ['missed_calls', 'competition'] }
    },
    {
      id: 'stat_after_hours',
      type: 'stat',
      content: '34% of pest control calls come after business hours',
      source: 'Industry benchmark data',
      relevantFor: { painPoints: ['after_hours', 'call_volume'] }
    }
  ],
  
  // Resources
  resources: [
    {
      id: 'res_roi_calculator',
      type: 'resource',
      title: 'ROI Calculator: What Are Missed Calls Costing You?',
      description: '2-minute calculator shows your annual revenue at risk',
      link: '/tools/roi-calculator',
      relevantFor: { painPoints: ['missed_calls', 'cost_concern'] }
    }
  ]
};

async function generateFollowUpWithProof(
  request: SchedulingRequest,
  attemptNumber: number,
  proof: SocialProofContent
): Promise<{ subject: string; body: string }> {
  
  const prompt = `Generate a scheduling follow-up that includes valuable content.

## Follow-up Context
- Attempt #${attemptNumber}
- Meeting: ${request.meeting_type}
- Last email sent ${daysSince(request.last_action_at)} days ago

## Social Proof to Include
Type: ${proof.type}
Content: ${proof.content}
${proof.link ? `Link: ${proof.link}` : ''}
Relevance: ${proof.relevance}

## New Time Options
${request.proposed_times.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n')}

---

Write a follow-up email that:
1. Doesn't just ask for time again - provides value
2. Naturally incorporates the social proof
3. Connects it to why the meeting matters
4. Ends with the time options
5. Keeps it under 100 words

Structure suggestion:
- Brief check-in (1 sentence)
- Value add with social proof (2-3 sentences)
- Tie back to meeting purpose (1 sentence)
- Time options

Return JSON:
{
  "subject": "Re: ... + [brief value hook]",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

**Example Social Proof Emails:**

```typescript
// Attempt 2: Light value add
const attempt2Example = {
  subject: "Re: Demo - Quick thing I thought you'd find useful",
  body: `Hi John,

Circling back on finding time for that demo. While we look for a slot, I thought you'd appreciate this - one of your competitors (similar size, family-owned) cut their call abandonment from 18% to 3% in about 6 weeks.

Here's the quick breakdown if you're curious: [link]

Still have these times open:
• Tuesday 2pm
• Wednesday 10am  
• Thursday 3pm

Any of those work?

Brent`
};

// Attempt 3: Stat-based
const attempt3Example = {
  subject: "Re: Demo - 78% stat that surprised me",
  body: `Hey John,

Quick one - did you know 78% of customers go with the first company that answers? (PCT Magazine data)

That's actually why I'm persistent about getting this demo on your calendar - I think you'd want to see how other guys your size are capturing those calls.

How about:
• Monday 11am
• Wednesday 2pm

Let me know what works.

Brent`
};

// Attempt 4: Resource offer
const attempt4Example = {
  subject: "Re: Demo - 2-min calculator (no meeting needed)",
  body: `Hi John,

I know we've been going back and forth. Here's something that might help even if we never meet - a quick calculator that shows what missed calls might be costing you annually: [link]

Takes 2 minutes, no email required.

If the numbers are interesting, I'm still happy to show you what we're doing about it. Otherwise, no hard feelings.

• Thursday 10am or 2pm?

Brent`
};
```

---

### Persona-Based Tone Mapping

**Different voices for different roles:**

```typescript
// lib/scheduler/personaTone.ts

interface PersonaTone {
  formality: 'casual' | 'professional' | 'executive';
  directness: 'soft' | 'balanced' | 'direct';
  lengthPreference: 'brief' | 'standard' | 'detailed';
  greetingStyle: string;
  signOffStyle: string;
  avoidPhrases: string[];
  preferPhrases: string[];
  sampleTone: string;
}

const PERSONA_TONES: Record<string, PersonaTone> = {
  
  owner: {
    formality: 'casual',
    directness: 'direct',
    lengthPreference: 'brief',
    greetingStyle: 'Hey {{name}}',
    signOffStyle: 'Brent',
    avoidPhrases: [
      'I hope this email finds you well',
      'Per my previous email',
      'Please advise',
      'At your earliest convenience',
      'Synergize', 'leverage', 'circle back'
    ],
    preferPhrases: [
      'Quick question',
      'Wanted to grab 30 minutes',
      'Here are a few times',
      'Let me know what works'
    ],
    sampleTone: `Hey John,

Trying to grab 30 min to show you what we're doing with AI phone answering. Think it'd be worth your time.

How's Tuesday at 2?

Brent`
  },
  
  operations_manager: {
    formality: 'professional',
    directness: 'balanced',
    lengthPreference: 'standard',
    greetingStyle: 'Hi {{name}}',
    signOffStyle: 'Best,\nBrent',
    avoidPhrases: [
      'I know you\'re busy', // They know they're busy
      'Just following up' // Weak opener
    ],
    preferPhrases: [
      'I wanted to schedule',
      'Here are some options',
      'Let me know if these work or if you have better times'
    ],
    sampleTone: `Hi Sarah,

I wanted to schedule a demo of our AI phone system - specifically how it handles after-hours calls and routes emergencies.

Here are a few options:
• Tuesday 10am
• Wednesday 2pm
• Thursday 11am

Let me know what works, or suggest a better time.

Best,
Brent`
  },
  
  regional_manager: {
    formality: 'professional',
    directness: 'direct',
    lengthPreference: 'brief',
    greetingStyle: 'Hi {{name}}',
    signOffStyle: 'Thanks,\nBrent',
    avoidPhrases: [
      'When you get a chance',
      'No rush'
    ],
    preferPhrases: [
      'Quick call to cover',
      'Want to make sure you see',
      '30 minutes to walk through'
    ],
    sampleTone: `Hi Mike,

Quick call to walk through how our AI handles multi-location routing. Takes 30 min.

Tuesday 2pm or Thursday 10am?

Thanks,
Brent`
  },
  
  executive: {
    formality: 'executive',
    directness: 'direct',
    lengthPreference: 'brief',
    greetingStyle: '{{name}}',
    signOffStyle: 'Brent',
    avoidPhrases: [
      'I hope this finds you well',
      'Do you have time',
      'Would you be interested',
      'I wanted to reach out'
    ],
    preferPhrases: [
      'Wanted to connect briefly',
      '15 minutes on',
      'Quick conversation about'
    ],
    sampleTone: `Tom,

Wanted to connect briefly on how we're helping operators your size handle call volume without adding headcount. 15 minutes.

Thursday 3pm?

Brent`
  },
  
  technician: {
    formality: 'casual',
    directness: 'soft',
    lengthPreference: 'brief',
    greetingStyle: 'Hey {{name}}',
    signOffStyle: 'Thanks!\nBrent',
    avoidPhrases: [
      'Decision maker',
      'Strategic',
      'ROI'
    ],
    preferPhrases: [
      'Quick question',
      'Wanted to show you',
      'Think you\'d find this cool'
    ],
    sampleTone: `Hey Dave,

Your boss mentioned you'd be the one actually using this if they go with us. Wanted to grab 15 min to show you how it works and get your take.

You free Thursday afternoon?

Thanks!
Brent`
  },
  
  office_manager: {
    formality: 'professional',
    directness: 'balanced',
    lengthPreference: 'standard',
    greetingStyle: 'Hi {{name}}',
    signOffStyle: 'Thanks,\nBrent',
    avoidPhrases: [
      'Disrupt',
      'Transform',
      'Revolutionary'
    ],
    preferPhrases: [
      'Walk you through',
      'Show you how it works',
      'See if it makes sense'
    ],
    sampleTone: `Hi Linda,

I'd love to walk you through our AI phone system - specifically how it handles the call routing and scheduling you mentioned.

Would Tuesday or Wednesday work for a 30-minute call?

Thanks,
Brent`
  }
};

function detectPersona(contact: Contact): string {
  const title = (contact.title || '').toLowerCase();
  
  // Owner detection
  if (contact.is_owner || 
      title.includes('owner') || 
      title.includes('ceo') || 
      title.includes('president') ||
      title.includes('founder')) {
    return 'owner';
  }
  
  // Executive detection
  if (title.includes('chief') || 
      title.includes('vp ') || 
      title.includes('vice president') ||
      title.includes('director')) {
    return 'executive';
  }
  
  // Regional/Branch manager
  if (title.includes('regional') || 
      title.includes('district') ||
      title.includes('branch manager')) {
    return 'regional_manager';
  }
  
  // Operations
  if (title.includes('operations') || 
      title.includes('ops ')) {
    return 'operations_manager';
  }
  
  // Office/Admin
  if (title.includes('office manager') || 
      title.includes('admin') ||
      title.includes('coordinator')) {
    return 'office_manager';
  }
  
  // Technician
  if (title.includes('technician') || 
      title.includes('tech') ||
      title.includes('service')) {
    return 'technician';
  }
  
  // Default to professional
  return 'operations_manager';
}

async function generatePersonaAwareEmail(
  request: SchedulingRequest,
  emailType: 'initial' | 'follow_up' | 'confirmation' | 'reminder',
  additionalContext?: any
): Promise<{ subject: string; body: string }> {
  
  const primaryContact = request.attendees.find(a => a.side === 'external');
  const contact = await getContact(primaryContact.contact_id);
  const persona = detectPersona(contact);
  const tone = PERSONA_TONES[persona];
  
  const prompt = `Generate a scheduling email matching this persona's communication style.

## Recipient Persona: ${persona.toUpperCase()}
- Formality: ${tone.formality}
- Directness: ${tone.directness}
- Length preference: ${tone.lengthPreference}
- Greeting style: ${tone.greetingStyle}
- Sign-off: ${tone.signOffStyle}

## Phrases to AVOID
${tone.avoidPhrases.map(p => `- "${p}"`).join('\n')}

## Phrases to PREFER
${tone.preferPhrases.map(p => `- "${p}"`).join('\n')}

## Sample Tone (match this energy)
${tone.sampleTone}

## Email Type: ${emailType}

## Meeting Details
- Type: ${request.meeting_type}
- Duration: ${request.duration_minutes} min
- Context: ${request.context}

## Proposed Times
${request.proposed_times?.map((t, i) => `${i + 1}. ${formatDateTime(t)}`).join('\n') || 'TBD'}

## Recipient
- Name: ${contact.name}
- Title: ${contact.title || 'Unknown'}
- Company: ${request.company_name}

---

Generate the ${emailType} email. Match the sample tone exactly.
Keep it ${tone.lengthPreference === 'brief' ? 'under 50 words' : tone.lengthPreference === 'detailed' ? 'around 100 words' : 'around 75 words'}.

Return JSON:
{
  "subject": "...",
  "body": "..."
}`;

  const response = await callAI({ prompt });
  return JSON.parse(response.content);
}
```

---

### Meeting Prep Auto-Queue

**When a meeting is confirmed, automatically prepare everything:**

```typescript
// lib/scheduler/meetingPrepQueue.ts

interface MeetingPrepTasks {
  refreshIntelligence: boolean;
  generatePrepBrief: boolean;
  createFollowUpDraft: boolean;
  notifyAttendees: boolean;
  setReminders: boolean;
}

async function queueMeetingPrep(
  request: SchedulingRequest
): Promise<void> {
  
  const meetingTime = request.scheduled_time;
  const prepTime = subHours(meetingTime, 24); // 24 hours before
  
  // Queue intelligence refresh
  await queueJob('refresh_account_intelligence', {
    companyId: request.company_id,
    dealId: request.deal_id,
    priority: 'high',
    runAt: prepTime
  });
  
  // Queue meeting prep brief generation
  await queueJob('generate_meeting_prep', {
    schedulingRequestId: request.id,
    dealId: request.deal_id,
    companyId: request.company_id,
    meetingType: request.meeting_type,
    attendees: request.attendees,
    context: request.context,
    runAt: prepTime
  });
  
  // Queue follow-up draft template
  await queueJob('create_followup_template', {
    schedulingRequestId: request.id,
    meetingType: request.meeting_type,
    context: request.context,
    runAt: meetingTime // Generate right when meeting starts
  });
  
  // Log the prep queue
  await db.insert(schedulingActions).values({
    scheduling_request_id: request.id,
    action_type: 'prep_queued',
    ai_reasoning: `Queued: intelligence refresh, prep brief, follow-up template for ${formatDateTime(meetingTime)}`,
    actor: 'ai'
  });
}

async function generateMeetingPrepBrief(
  jobData: any
): Promise<MeetingPrepBrief> {
  
  const { schedulingRequestId, dealId, companyId, meetingType, context } = jobData;
  
  // Gather all context
  const [company, deal, contacts, recentActivities, intelligence, accountMemory] = await Promise.all([
    getCompany(companyId),
    dealId ? getDeal(dealId) : null,
    getCompanyContacts(companyId),
    getRecentActivities(companyId, 30), // Last 30 days
    getCompanyIntelligence(companyId),
    getAccountMemory(companyId)
  ]);
  
  // Get scheduling history for this meeting
  const schedulingRequest = await getSchedulingRequest(schedulingRequestId);
  const schedulingInsights = await analyzeSchedulingIntent(schedulingRequest);
  
  const prompt = `Generate a comprehensive meeting prep brief.

## Meeting Details
- Type: ${meetingType}
- Context: ${context}
- Time: ${formatDateTime(schedulingRequest.scheduled_time)}

## Company
${JSON.stringify(company, null, 2)}

## Deal (if exists)
${deal ? JSON.stringify(deal, null, 2) : 'No active deal'}

## Key Contacts Attending
${JSON.stringify(schedulingRequest.attendees.filter(a => a.side === 'external'), null, 2)}

## Scheduling Behavior Insights
- Intent Level: ${schedulingInsights.level}
- Signals: ${schedulingInsights.signals.map(s => s.type).join(', ')}
- Attempts to schedule: ${schedulingRequest.attempt_count}
- No-shows: ${schedulingRequest.no_show_count}

## Account Intelligence
${JSON.stringify(intelligence, null, 2)}

## Account Memory (What We've Learned)
${JSON.stringify(accountMemory, null, 2)}

## Recent Activity Summary
${summarizeActivities(recentActivities)}

---

Generate a meeting prep brief with:

1. EXECUTIVE SUMMARY (2-3 sentences)
   - Who they are, where we are in the process, what's at stake

2. MEETING OBJECTIVE
   - Primary goal for this meeting
   - What "success" looks like

3. KEY TALKING POINTS (3-5 bullets)
   - What to lead with
   - What they care about most

4. QUESTIONS TO ASK (3-5)
   - Discovery questions that matter
   - Things we still don't know

5. LANDMINES TO AVOID
   - Topics that haven't landed well
   - Sensitivities from account memory

6. OBJECTION PREP (if applicable)
   - Likely objections
   - How to handle each

7. NEXT STEPS TO PROPOSE
   - What should happen after this meeting
   - Specific ask to make

8. SCHEDULING INSIGHT
   - What their scheduling behavior tells us
   - How to factor this into the meeting

Return structured JSON.`;

  const response = await callAI({ prompt, maxTokens: 2000 });
  const brief = JSON.parse(response.content);
  
  // Store the brief
  await db.insert(meetingPrepBriefs).values({
    scheduling_request_id: schedulingRequestId,
    deal_id: dealId,
    company_id: companyId,
    meeting_time: schedulingRequest.scheduled_time,
    brief_content: brief,
    created_at: new Date()
  });
  
  // Notify the rep
  await createNotification({
    userId: schedulingRequest.created_by,
    type: 'meeting_prep_ready',
    title: `Prep ready: ${meetingType} with ${company.name}`,
    message: 'AI has prepared your meeting brief',
    link: `/scheduler/${schedulingRequestId}/prep`,
    priority: 'high'
  });
  
  return brief;
}

async function createFollowUpTemplate(
  jobData: any
): Promise<void> {
  
  const { schedulingRequestId, meetingType, context } = jobData;
  const request = await getSchedulingRequest(schedulingRequestId);
  const company = await getCompany(request.company_id);
  
  // Generate a template that will be customized after the meeting
  const template = {
    subject: `Great talking today - next steps for ${company.name}`,
    
    sections: {
      opening: `Hi {{contact_name}},\n\nGreat connecting today! I appreciated you taking the time to walk me through {{key_topic_discussed}}.`,
      
      summary: `To recap what we covered:\n• {{point_1}}\n• {{point_2}}\n• {{point_3}}`,
      
      next_steps: `As discussed, here are the next steps:\n• {{next_step_1}}\n• {{next_step_2}}`,
      
      closing: `Let me know if you have any questions. Looking forward to {{next_milestone}}!\n\nBest,\n{{sender_name}}`
    },
    
    placeholders_to_fill: [
      'key_topic_discussed',
      'point_1', 'point_2', 'point_3',
      'next_step_1', 'next_step_2',
      'next_milestone'
    ]
  };
  
  // Store template linked to scheduling request
  await db.update(schedulingRequests)
    .set({ followup_template: template })
    .where(eq(schedulingRequests.id, schedulingRequestId));
}
```

**Meeting Prep UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Meeting Prep: Demo with Acme Pest                               │
│ Tomorrow at 2:00 PM                                   [30 min]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ EXECUTIVE SUMMARY                                               │
│ Family-owned, 15 trucks, struggling with after-hours calls.     │
│ This is demo #1 after a strong discovery. John (owner) is       │
│ engaged but cautious about technology.                          │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 🎯 MEETING OBJECTIVE                                            │
│ Show ROI on after-hours call capture. Get verbal commitment     │
│ to pilot program.                                               │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 💬 KEY TALKING POINTS                                           │
│ • Lead with the 15% call abandonment he mentioned               │
│ • Reference the family business angle (3rd generation)          │
│ • Show the FieldRoutes integration specifically                 │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ❓ QUESTIONS TO ASK                                             │
│ • "Walk me through what happens today when a call comes in      │
│    after 5pm?"                                                  │
│ • "Who's handling emergency calls on weekends currently?"       │
│ • "What would it mean for the business if you captured          │
│    even half those missed calls?"                               │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ⚠️ LANDMINES TO AVOID                                           │
│ • Don't push "AI" terminology - he prefers "smart answering"    │
│ • Avoid comparisons to competitors (bad experience with one)    │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 📊 SCHEDULING INSIGHT                                           │
│ Took 3 attempts to schedule (medium intent). He's interested    │
│ but not urgent. Don't rush the close - focus on value.          │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ✅ NEXT STEPS TO PROPOSE                                        │
│ • 2-week pilot with after-hours calls only                      │
│ • Follow-up call to review pilot results                        │
│                                                                 │
│           [Open Full Intelligence]    [Join Meeting]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Outcome-Based Learning

**Postmortems that make the system smarter:**

```typescript
// lib/scheduler/learning.ts

interface SchedulingPostmortem {
  requestId: string;
  outcome: string;
  
  metrics: {
    totalAttempts: number;
    daysToSchedule: number | null;
    noShows: number;
    channelsUsed: string[];
    deEscalated: boolean;
  };
  
  whatWorked: string[];
  whatFailed: string[];
  
  learnings: {
    forAccount: string[];
    forMeetingType: string[];
    forTimeOfYear: string[];
  };
}

async function generateSchedulingPostmortem(
  request: SchedulingRequest
): Promise<SchedulingPostmortem> {
  
  const actions = await db.select()
    .from(schedulingActions)
    .where(eq(schedulingActions.scheduling_request_id, request.id))
    .orderBy(schedulingActions.created_at);
  
  // Analyze what happened
  const channelsUsed = [...new Set(actions
    .filter(a => a.action_type.includes('_sent'))
    .map(a => a.action_type.replace('_sent', '')))];
  
  const whatWorked: string[] = [];
  const whatFailed: string[] = [];
  
  // Success patterns
  if (request.outcome === 'held') {
    const successfulChannel = actions.find(a => a.action_type === 'time_selected');
    if (successfulChannel) {
      whatWorked.push(`Prospect responded to ${successfulChannel.channel || 'email'}`);
    }
    
    if (request.attempt_count <= 2) {
      whatWorked.push('Quick scheduling (≤2 attempts)');
    }
    
    const deEscalated = actions.some(a => a.action_type === 'de_escalated');
    if (deEscalated) {
      whatWorked.push('De-escalation to shorter meeting worked');
    }
  }
  
  // Failure patterns
  if (request.outcome === 'gave_up' || request.outcome === 'cancelled_by_them') {
    if (request.attempt_count >= 4) {
      whatFailed.push('Multiple follow-ups did not convert');
    }
    
    if (!channelsUsed.includes('sms') && !channelsUsed.includes('phone')) {
      whatFailed.push('Only used email - consider multi-channel next time');
    }
  }
  
  // Generate learnings
  const learnings = {
    forAccount: [],
    forMeetingType: [],
    forTimeOfYear: []
  };
  
  // Account-specific
  if (request.outcome === 'held' && request.attempt_count <= 2) {
    learnings.forAccount.push('This account is responsive - maintain regular contact');
  }
  if (request.no_show_count > 0) {
    learnings.forAccount.push('Send reminders earlier (day before + morning of)');
  }
  
  // Meeting type
  if (request.meeting_type === 'demo' && request.deEscalated) {
    learnings.forMeetingType.push('Consider starting with shorter format for demos');
  }
  
  // Seasonality
  const season = getPestControlSeasonality(request.company_state, request.created_at);
  if (season.isBusySeason && request.daysToSchedule > 10) {
    learnings.forTimeOfYear.push(`${season.seasonType} extends scheduling time - adjust expectations`);
  }
  
  return {
    requestId: request.id,
    outcome: request.outcome,
    metrics: {
      totalAttempts: request.attempt_count,
      daysToSchedule: request.scheduled_time 
        ? daysBetween(request.created_at, request.scheduled_time) 
        : null,
      noShows: request.no_show_count,
      channelsUsed,
      deEscalated: actions.some(a => a.action_type === 'de_escalated')
    },
    whatWorked,
    whatFailed,
    learnings
  };
}

// Store and aggregate learnings
async function storePostmortem(postmortem: SchedulingPostmortem): Promise<void> {
  
  // Store at request level
  await db.update(schedulingRequests)
    .set({ postmortem: postmortem })
    .where(eq(schedulingRequests.id, postmortem.requestId));
  
  // Aggregate to account level
  await updateAccountSchedulingProfile(postmortem);
  
  // Aggregate to rep level (quietly)
  await updateRepSchedulingMetrics(postmortem);
}
```

---

## Key Metrics

Track scheduler effectiveness:

```sql
-- Scheduler metrics view
CREATE VIEW scheduler_metrics AS
SELECT 
  DATE_TRUNC('week', created_at) as week,
  
  COUNT(*) as total_requests,
  
  COUNT(*) FILTER (WHERE outcome = 'held') as meetings_held,
  COUNT(*) FILTER (WHERE outcome = 'cancelled_by_them') as cancelled_by_prospect,
  COUNT(*) FILTER (WHERE outcome = 'gave_up') as gave_up,
  
  AVG(attempt_count) as avg_attempts_to_schedule,
  AVG(no_show_count) as avg_no_shows,
  
  AVG(EXTRACT(EPOCH FROM (scheduled_time - created_at)) / 86400) 
    FILTER (WHERE scheduled_time IS NOT NULL) as avg_days_to_schedule,
  
  -- Success rate
  COUNT(*) FILTER (WHERE outcome = 'held')::FLOAT / 
    NULLIF(COUNT(*), 0) as meeting_success_rate

FROM scheduling_requests
WHERE status IN ('completed', 'cancelled')
GROUP BY DATE_TRUNC('week', created_at);
```

---

## Testing Checklist

### Core Flow
- [ ] Create scheduling request with multiple internal attendees
- [ ] Create scheduling request with multiple external attendees
- [ ] Initial email generation includes all proposed times
- [ ] System detects when prospect accepts a time
- [ ] System detects when prospect proposes alternatives
- [ ] Counter-proposal logic works when their times don't fit
- [ ] Calendar invite created correctly
- [ ] Reminder sent morning of meeting
- [ ] No-show detection works (test with mock)
- [ ] Rescheduling flow initiates after no-show
- [ ] Follow-up emails respect timing rules
- [ ] Stop rules prevent infinite loops
- [ ] Pause/Resume functionality works
- [ ] Cancel removes calendar event
- [ ] Dashboard shows correct groupings

### Multi-Channel & De-escalation
- [ ] SMS sent after email attempts fail (per strategy)
- [ ] SMS content is appropriately brief (<160 chars)
- [ ] De-escalation offer triggers at correct attempt count
- [ ] De-escalation email offers shorter meeting format
- [ ] Meeting-type strategies apply correct settings
- [ ] Exec meetings escalate faster than demos

### Persona & Tone
- [ ] Persona detection works for common titles
- [ ] Owner persona gets casual, direct tone
- [ ] Executive persona gets brief, executive tone
- [ ] Technician persona gets friendly, simple tone
- [ ] Persona override applies when set
- [ ] Tone appropriate phrases used in generated emails

### Conflict Resolution
- [ ] "Person unavailable" conflict detected and paused
- [ ] System resumes on the specified date
- [ ] "Timing constraint" adjusts preferences and re-proposes
- [ ] "Decision pending" gives appropriate space
- [ ] Seasonality constraints acknowledged in messaging
- [ ] Conflict history logged for learning

### Intelligence & Guardrails
- [ ] Scheduling intent calculated correctly
- [ ] High intent signals positive to deal intelligence
- [ ] Dead intent triggers leverage moment
- [ ] Reputation risk increases with attempts
- [ ] System softens tone when risk is medium
- [ ] System pauses when risk is high
- [ ] Negative sentiment detected and handled

### Social Proof
- [ ] Social proof injected on attempts 2-4
- [ ] Proof selected matches company profile
- [ ] Same proof not repeated in thread
- [ ] Proof usage tracked for conversion
- [ ] Email with proof sounds natural

### Champion Leverage
- [ ] Champion identified for company
- [ ] Champion CC'd after 2 failed attempts
- [ ] "Ask for intro" email generated for exec meetings
- [ ] Champion not CC'd on their own scheduling

### Attendee Optimization
- [ ] Blocking attendees identified correctly
- [ ] Impact percentage calculated accurately
- [ ] Recommendation shown in dashboard
- [ ] Removal updates scheduling and re-proposes times

### Meeting Prep Integration
- [ ] Prep brief queued 24h before meeting
- [ ] Intelligence refresh queued automatically
- [ ] Follow-up template created at meeting time
- [ ] Prep notification sent to rep
- [ ] Prep brief contains all sections
- [ ] Scheduling insight included in prep

### Learning & Postmortems
- [ ] Postmortem generated on completion
- [ ] What worked/failed correctly identified
- [ ] Learnings stored at account level
- [ ] Learnings stored at meeting-type level
- [ ] Seasonality patterns updated
- [ ] Rep metrics updated (quietly)

### Leverage Moments
- [ ] Persistent non-response triggers leverage moment
- [ ] Exec scheduling stall triggers leverage moment
- [ ] Multiple no-shows trigger leverage moment
- [ ] Intent collapse triggers leverage moment
- [ ] Leverage brief contains all sections
- [ ] Talking points are specific and actionable

---

## Implementation Phases

### Phase 1 - Core Flow (Week 1)
- Database schema
- Basic scheduling request creation
- Initial email generation with persona detection
- Calendar integration (create events)
- Basic state machine

### Phase 2 - Response Intelligence (Week 2)
- Email response detection and parsing
- Conflict Resolution Brain (pause/resume logic)
- Time negotiation flow
- Confirmation and invite sending
- Basic follow-up automation

### Phase 3 - Multi-Channel & De-escalation (Week 3)
- SMS channel integration (Twilio)
- Channel progression logic
- De-escalation (60→30→15 min offers)
- Persona-based tone mapping
- Meeting-type strategy engine

### Phase 4 - Intelligence Layer (Week 4)
- Scheduling Intent Intelligence
- Feed scheduling signals to Deal Intelligence
- Reputation Guardrails
- Dynamic Attendee Optimization

### Phase 5 - Human Leverage & Reliability (Week 5)
- Scheduling-specific Leverage Moments
- Leverage Brief generation
- No-show detection and recovery
- Stop rules with relationship awareness
- Dashboard UI

### Phase 6 - Value-Add & Learning (Week 6)
- Social Proof Injection system
- Content library by company profile
- Seasonality awareness
- Champion involvement logic
- Outcome-based postmortems

### Phase 7 - Meeting Prep Integration (Week 7)
- Meeting Prep Auto-Queue
- Prep Brief generation
- Follow-up template creation
- Pre-meeting notifications
- Intelligence refresh automation

### Phase 8 - Polish & Optimization (Week 8)
- Performance optimization
- Error handling and edge cases
- Mobile responsive UI
- Metrics dashboard
- User testing and refinement

