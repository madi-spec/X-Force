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
- [ ] Deal intelligence updated on outcomes

---

## Implementation Priority

1. **Phase 1 - Core Flow** (Week 1)
   - Database schema
   - Basic scheduling request creation
   - Initial email generation
   - Calendar integration (create events)

2. **Phase 2 - Response Processing** (Week 2)
   - Email response detection
   - Time parsing from emails
   - Confirmation flow
   - Follow-up automation

3. **Phase 3 - Reliability** (Week 3)
   - No-show detection
   - Rescheduling automation
   - Stop rules
   - Dashboard UI

4. **Phase 4 - Polish** (Week 4)
   - Multi-attendee coordination
   - Templates
   - Metrics
   - Deal intelligence integration
