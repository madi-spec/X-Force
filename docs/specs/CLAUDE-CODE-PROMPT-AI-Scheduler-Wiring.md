# AI Scheduler: Production Wiring — ✅ COMPLETE

## Overview

The AI Scheduler is now **fully wired to production**. All 3 weeks of implementation complete:
- Week 1: Email sending via Microsoft Graph ✅
- Week 2: Response parsing with AI ✅
- Week 3: Calendar booking + no-show recovery ✅

---

## Complete Flow

```
1. Create Request → status: initiated
2. POST /send → AI generates email → Microsoft Graph sends → status: awaiting_response
3. Prospect replies → sync-microsoft cron → processSchedulingEmails() → AI parses response
4. Accept detected → select time → createMeetingCalendarEvent() → status: confirmed
5. Meeting time passes → detect-no-shows cron → graduated recovery
```

---

## Current State (What Exists)

### Service Files (src/lib/scheduler/)
```
schedulingService.ts       # Core service - orchestrates everything
schedulingIntelligence.ts  # AI decision making
emailGeneration.ts         # Email template generation
responseProcessor.ts       # Process responses (needs wiring)
confirmationWorkflow.ts    # Confirmation flow
noShowRecovery.ts          # No-show handling (needs wiring)
calendarIntegration.ts     # Calendar sync (needs wiring)
personaEngine.ts           # Persona-based email tone
attendeeOptimization.ts    # Optimize who to include
championInvolvement.ts     # Champion detection
channelStrategy.ts         # Email vs other channels
meetingStrategy.ts         # Meeting type selection
schedulingStopRules.ts     # When to stop trying
postmortem.ts              # Post-meeting analysis
types.ts                   # Type definitions
```

### Database Tables
```sql
scheduling_requests      # Main request record
scheduling_attendees     # People to schedule with
scheduling_actions       # Action log (emails sent, responses)
scheduling_templates     # Email templates
meeting_prep_briefs      # Generated prep briefs
```

### API Endpoints
```
/api/scheduler/requests/           # CRUD for requests
/api/scheduler/requests/[id]/confirm  # Confirm meeting
/api/scheduler/analytics           # Analytics
/api/scheduler/dashboard           # Dashboard data
/api/scheduler/templates/          # Email templates
/api/scheduler/no-shows            # No-show handling
```

---

## What Needs Wiring

### 1. Email Sending Integration

**Goal:** When scheduler decides to send an email, actually send it via Microsoft Graph.

**Current state:** `emailGeneration.ts` generates email content but doesn't send.

**Wire to:** `src/lib/microsoft/graphClient.ts` or similar

```typescript
// In schedulingService.ts or new file:

import { sendEmail } from '@/lib/microsoft/email';

async function sendSchedulingEmail(request: SchedulingRequest, email: GeneratedEmail) {
  // Get user's Microsoft connection
  const connection = await getMicrosoftConnection(request.user_id);
  
  // Send via Graph API
  const result = await sendEmail({
    to: email.to,
    subject: email.subject,
    body: email.body,
    connection
  });
  
  // Log the action
  await supabase.from('scheduling_actions').insert({
    request_id: request.id,
    action_type: 'email_sent',
    details: { messageId: result.id, to: email.to }
  });
  
  // Update request state
  await updateRequestState(request.id, 'awaiting_response');
}
```

### 2. Response Parsing

**Goal:** When prospect replies, detect and parse their response.

**Option A: Webhook from Microsoft Graph**
- Subscribe to mail notifications
- When new mail arrives, check if it's a reply to scheduling email
- Parse response (accept/decline/propose time)

**Option B: Polling during email sync**
- During regular email sync, detect replies to scheduling emails
- Match by thread ID or In-Reply-To header

```typescript
// In responseProcessor.ts or email sync:

async function detectSchedulingResponse(email: InboundEmail) {
  // Check if this is a reply to a scheduling email
  const schedulingAction = await supabase
    .from('scheduling_actions')
    .select('*, scheduling_requests(*)')
    .eq('details->messageId', email.in_reply_to)
    .single();
  
  if (!schedulingAction) return null;
  
  // Use AI to parse the response
  const parsed = await parseSchedulingResponse(email.body);
  // Returns: { type: 'accept' | 'decline' | 'propose_time', proposed_times?: Date[] }
  
  // Log the response
  await supabase.from('scheduling_actions').insert({
    request_id: schedulingAction.request_id,
    action_type: 'response_received',
    details: { parsed, emailId: email.id }
  });
  
  // Handle based on response type
  if (parsed.type === 'accept') {
    await handleAcceptance(schedulingAction.scheduling_requests, parsed);
  } else if (parsed.type === 'propose_time') {
    await handleCounterProposal(schedulingAction.scheduling_requests, parsed);
  } else if (parsed.type === 'decline') {
    await handleDecline(schedulingAction.scheduling_requests, parsed);
  }
}
```

### 3. Calendar Booking

**Goal:** When meeting is confirmed, create calendar event.

```typescript
// In calendarIntegration.ts:

import { createCalendarEvent } from '@/lib/microsoft/calendar';

async function bookMeeting(request: SchedulingRequest, confirmedTime: Date) {
  const connection = await getMicrosoftConnection(request.user_id);
  
  // Get attendees
  const attendees = await supabase
    .from('scheduling_attendees')
    .select('email, name')
    .eq('request_id', request.id);
  
  // Create calendar event
  const event = await createCalendarEvent({
    subject: request.meeting_title,
    start: confirmedTime,
    duration: request.duration_minutes,
    attendees: attendees.map(a => ({ email: a.email, name: a.name })),
    body: request.meeting_description,
    connection
  });
  
  // Update request as complete
  await supabase
    .from('scheduling_requests')
    .update({ 
      status: 'confirmed',
      confirmed_time: confirmedTime,
      calendar_event_id: event.id
    })
    .eq('id', request.id);
  
  // Log action
  await supabase.from('scheduling_actions').insert({
    request_id: request.id,
    action_type: 'meeting_booked',
    details: { eventId: event.id, time: confirmedTime }
  });
}
```

### 4. No-Show Detection & Recovery

**Goal:** Detect when a meeting didn't happen and re-engage.

```typescript
// In noShowRecovery.ts:

async function detectNoShows() {
  // Find confirmed meetings that are past their time
  const { data: pastMeetings } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('status', 'confirmed')
    .lt('confirmed_time', new Date().toISOString())
    .is('meeting_occurred', null);
  
  for (const meeting of pastMeetings) {
    // Check if meeting actually occurred (via calendar or transcript)
    const occurred = await checkMeetingOccurred(meeting);
    
    if (!occurred) {
      // Generate recovery email
      const recoveryEmail = await generateNoShowRecoveryEmail(meeting);
      await sendSchedulingEmail(meeting, recoveryEmail);
      
      // Update status
      await supabase
        .from('scheduling_requests')
        .update({ status: 'no_show_recovery' })
        .eq('id', meeting.id);
    }
  }
}
```

### 5. State Machine Implementation

**Goal:** Proper state transitions with business rules.

```typescript
// States:
type SchedulingState = 
  | 'draft'           // Just created
  | 'sending'         // Sending initial email
  | 'awaiting_response' // Waiting for reply
  | 'negotiating'     // Back and forth on times
  | 'confirmed'       // Meeting booked
  | 'completed'       // Meeting happened
  | 'no_show'         // Meeting didn't happen
  | 'no_show_recovery' // Trying to reschedule
  | 'cancelled'       // Cancelled by user
  | 'abandoned';      // Too many attempts, gave up

// Transitions:
const VALID_TRANSITIONS = {
  draft: ['sending', 'cancelled'],
  sending: ['awaiting_response', 'cancelled'],
  awaiting_response: ['negotiating', 'confirmed', 'abandoned', 'cancelled'],
  negotiating: ['awaiting_response', 'confirmed', 'abandoned', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  no_show: ['no_show_recovery', 'abandoned'],
  no_show_recovery: ['awaiting_response', 'abandoned'],
};

async function transitionState(requestId: string, newState: SchedulingState) {
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('status')
    .eq('id', requestId)
    .single();
  
  if (!VALID_TRANSITIONS[request.status]?.includes(newState)) {
    throw new Error(`Invalid transition: ${request.status} → ${newState}`);
  }
  
  await supabase
    .from('scheduling_requests')
    .update({ status: newState, updated_at: new Date() })
    .eq('id', requestId);
}
```

---

## Implementation Order

### Week 1: Email Sending ✅ COMPLETE
1. ✅ Wire `schedulingService.ts` to Microsoft email sending
2. ✅ Create scheduling email generation with AI
3. ✅ Implement `POST /api/scheduler/requests/[id]/send` endpoint
4. ✅ Log all sent emails to `scheduling_actions`
5. ✅ Update request state to 'awaiting_response'
6. ✅ Schedule follow-up for 24 hours

**New methods added to schedulingService.ts:**
- `sendSchedulingEmail(requestId, userId, options)`
- `sendFollowUpEmail(requestId, userId)`
- `previewSchedulingEmail(requestId, emailType)`

### Week 2: Response Parsing — ✅ COMPLETE
1. ✅ Response detection added to email sync cron
2. ✅ Match incoming emails by thread ID or attendee email
3. ✅ AI-based response parsing (accept/decline/counter_propose/question/unclear)
4. ✅ State transitions handled for each response type
5. ✅ Thread ID stored after first response for future matching
6. ✅ Manual testing endpoint: POST /api/scheduler/process-responses

**Files modified:**
- `src/app/api/cron/sync-microsoft/route.ts` — Added processSchedulingEmails()
- `src/app/api/scheduler/process-responses/route.ts` — Manual testing endpoint
- `src/lib/scheduler/responseProcessor.ts` — Already had comprehensive logic

### Week 3: Calendar Booking & No-Show Recovery — ✅ COMPLETE
1. ✅ Calendar event creation in responseProcessor.ts on accept
2. ✅ Manual booking endpoint: POST /api/scheduler/requests/[id]/book
3. ✅ No-show detection cron: /api/cron/detect-no-shows
4. ✅ Graduated recovery strategy (email → escalate → pause → cancel)
5. ✅ Added to vercel.json cron schedule

**Files created/modified:**
- `src/lib/scheduler/responseProcessor.ts` — Auto-book on accept
- `src/app/api/scheduler/requests/[id]/book/route.ts` — Manual booking
- `src/app/api/cron/detect-no-shows/route.ts` — No-show cron
- `vercel.json` — Cron schedule added

---

## 🎉 AI SCHEDULER FULLY WIRED!

The complete flow now works:

```
1. Create Request → status: initiated
2. Send Email → status: awaiting_response
3. Receive Accept → parse → select time → book calendar → status: confirmed
4. Meeting passes → cron detects no-show → recovery email
```

All endpoints:
- POST /api/scheduler/requests/[id]/send — Send scheduling email
- POST /api/scheduler/process-responses — Manual response processing
- POST /api/scheduler/requests/[id]/book — Manual calendar booking
- GET /api/cron/detect-no-shows — No-show detection cron

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/lib/scheduler/schedulingService.ts` | Wire to Microsoft email sending |
| `src/lib/scheduler/responseProcessor.ts` | Add AI parsing, integrate with sync |
| `src/lib/scheduler/calendarIntegration.ts` | Wire to Microsoft Calendar |
| `src/lib/scheduler/noShowRecovery.ts` | Wire detection cron |
| `src/lib/email/processInboundEmail.ts` | Add scheduling response detection |
| `src/app/api/cron/scheduler-tasks/route.ts` | Create cron for follow-ups, no-shows |
| `src/app/api/webhooks/microsoft/route.ts` | Add mail notification handling (optional) |

---

## Testing Checklist — ALL COMPLETE ✅

### Week 1 ✅
- [x] Can create scheduling request from UI
- [x] Email actually sends via Microsoft Graph
- [x] Sent email logged in scheduling_actions
- [x] Request state updates to 'awaiting_response'
- [x] Follow-up scheduled for 24 hours

### Week 2 ✅
- [x] Reply detected when prospect responds
- [x] AI correctly parses accept/decline/counter_propose/question
- [x] State updates based on response type
- [x] Thread ID stored for future matching
- [x] Manual testing endpoint available

### Week 3 ✅
- [x] Calendar event created on confirmation
- [x] Event includes all attendees
- [x] No-show cron added to vercel.json
- [x] Graduated recovery strategy implemented
- [x] Manual booking endpoint available

---

## Prompt History

### Week 1 ✅ COMPLETE
Email sending wired. New methods:
- `sendSchedulingEmail(requestId, userId, options)`
- `sendFollowUpEmail(requestId, userId)` 
- `previewSchedulingEmail(requestId, emailType)`

New endpoint: `POST /api/scheduler/requests/[id]/send`
