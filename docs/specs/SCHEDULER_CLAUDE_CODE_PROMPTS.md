# Scheduler Transformation: Claude Code Prompts

**Created:** January 2, 2026  
**Purpose:** Six prompts to transform the scheduler into a production-ready system  
**Order:** Execute prompts 1-6 in sequence. Each builds on the previous.

---

## Prompt 1: Critical Bug Fixes & Foundation

```
I need you to fix critical bugs in our scheduler system and lay the foundation for larger improvements.

## Context
Our scheduler manages meeting scheduling via email. It has these critical bugs:
1. Cron only processes `process_response` action type - follow-ups never trigger
2. `email_thread_id` isn't being captured when emails are sent, breaking response matching
3. `parseSchedulingResponse()` doesn't normalize timezones, causing errors like "10:30 AM" being interpreted as "3:30 PM"

## Files to Examine First
- src/lib/scheduler/types.ts - See all action types and statuses
- src/lib/scheduler/timezone.ts - See existing timezone utilities (normalizeAITimestamp, getAITimestampInstructions)
- src/lib/scheduler/emailGeneration.ts - Find parseSchedulingResponse() around line 493
- src/lib/scheduler/responseProcessor.ts - See how responses are processed
- src/lib/scheduler/automationProcessor.ts - See processSchedulingAutomation()
- src/app/api/cron/scheduler/route.ts OR src/app/api/cron/sync-microsoft/route.ts - Find the cron that processes scheduling

## Tasks

### 1. Fix Cron Job Query
Find the cron job that processes scheduling requests. It currently has:
```typescript
.eq('next_action_type', 'process_response')
```

Change it to process ALL action types:
```typescript
.in('next_action_type', [
  'process_response',
  'follow_up',
  'second_follow_up',
  'send_initial',
  'send_options',
  'send_reminder',
  'check_no_show',
  'human_review_decline',
  'human_review_max_attempts',
  'answer_question',
  'offer_future_scheduling'
])
```

### 2. Ensure email_thread_id is Captured
Search for all places where emails are sent for scheduling (sendEmail calls in scheduler code).
After EVERY sendEmail() call, ensure we capture the conversationId:

```typescript
if (sendResult.success && sendResult.conversationId) {
  await supabase
    .from('scheduling_requests')
    .update({ email_thread_id: sendResult.conversationId })
    .eq('id', requestId);
  
  console.log(`[Scheduler] Captured email_thread_id: ${sendResult.conversationId} for request ${requestId}`);
}
```

Check these files specifically:
- src/lib/scheduler/automationProcessor.ts (sendInitialProposal, sendFollowUp)
- src/lib/scheduler/responseProcessor.ts (any email sends)
- src/app/api/scheduler/requests/[id]/send/route.ts (already has this - verify it works)

### 3. Fix Timezone in parseSchedulingResponse
Update src/lib/scheduler/emailGeneration.ts:

a) Change the function signature to accept timezone:
```typescript
export async function parseSchedulingResponse(
  emailBody: string,
  proposedTimes: string[],
  userTimezone: string = 'America/New_York'  // ADD THIS PARAMETER
): Promise<{...}>
```

b) Import timezone utilities at the top:
```typescript
import { normalizeAITimestamp, getAITimestampInstructions, normalizeTimezone } from './timezone';
```

c) Add timezone instructions to the AI prompt (inside the function):
```typescript
const tz = normalizeTimezone(userTimezone);
const timestampInstructions = getAITimestampInstructions(tz);

// Add to the prompt:
// ${timestampInstructions}
```

d) Normalize returned timestamps before returning:
```typescript
// Before returning response.data:
if (response.data.counterProposedTimes) {
  response.data.counterProposedTimes = response.data.counterProposedTimes.map(time => {
    const normalized = normalizeAITimestamp(time, tz);
    return normalized.utc?.toISOString() || time;
  });
}

if (response.data.selectedTime) {
  const normalized = normalizeAITimestamp(response.data.selectedTime, tz);
  response.data.selectedTime = normalized.utc?.toISOString() || response.data.selectedTime;
}
```

### 4. Update All Callers of parseSchedulingResponse
Find every place that calls parseSchedulingResponse() and pass the timezone:

```typescript
// Find the scheduling request's timezone and pass it:
const analysis = await parseSchedulingResponse(
  email.body,
  request.proposed_times || [],
  request.timezone || 'America/New_York'  // ADD THIS
);
```

### 5. Add Correlation ID Logging
Add a correlation ID to all scheduler logging for traceability:

```typescript
// At the start of any processing function:
const correlationId = `sched_${requestId}_${Date.now()}`;
console.log(`[Scheduler:${correlationId}] Starting processing`);

// Use correlationId in all subsequent logs in that function
```

## Verification
After making changes:
1. Search for any remaining `.eq('next_action_type', 'process_response')` - should be none
2. Search for `parseSchedulingResponse(` - all calls should have 3 arguments
3. Search for `sendEmail(` in scheduler files - all should capture conversationId after

## Do NOT
- Change state machine logic
- Modify the email templates
- Touch calendar integration
- Add new dependencies

This is a surgical fix of existing bugs only.
```

---

## Prompt 2: TimeParser - Single Source of Truth

```
I need you to create a centralized TimeParser module that becomes the SINGLE source of truth for all time parsing in the scheduler. This eliminates scattered parsing logic and ensures consistent timezone handling.

## Context
Currently, time parsing happens in multiple places:
- parseSchedulingResponse() - Initial response analysis
- parseProposedDateTime() - Counter-proposal parsing  
- matchSelectedTime() - Fallback regex matching
- Various inline regex patterns

This causes inconsistencies and timezone bugs. We need ONE module that ALL paths use.

## Files to Reference
- src/lib/scheduler/timezone.ts - Use these utilities (normalizeTimezone, normalizeAITimestamp, buildDateContextForAI, getAITimestampInstructions, formatForDisplay)
- src/lib/scheduler/responseProcessor.ts - See parseProposedDateTime() for reference
- src/lib/ai/core/aiClient.ts - See callAIJson for AI calls

## Task 1: Create TimeParser Module

Create `src/lib/scheduler/core/TimeParser.ts`:

```typescript
/**
 * TimeParser - Single Source of Truth for Time Parsing
 * 
 * ALL time parsing in the scheduler flows through this module.
 * No exceptions. Ever.
 */

import { callAIJson } from '@/lib/ai/core/aiClient';
import {
  normalizeTimezone,
  normalizeAITimestamp,
  buildDateContextForAI,
  getAITimestampInstructions,
  formatForDisplay,
  DEFAULT_TIMEZONE,
} from '../timezone';

// ============================================
// TYPES
// ============================================

export interface ParsedTime {
  /** Original input string */
  raw: string;
  /** Parsed UTC timestamp */
  utc: Date | null;
  /** Human-readable display string in user's timezone */
  display: string;
  /** Timezone used for interpretation */
  timezone: string;
  /** Parsing confidence */
  confidence: 'high' | 'medium' | 'low';
  /** AI's reasoning for this interpretation */
  reasoning: string;
  /** Was this converted from a bare timestamp? */
  wasConverted: boolean;
}

export interface TimeParseContext {
  /** User's timezone (e.g., "America/New_York") */
  timezone: string;
  /** Additional context from email body */
  emailBody?: string;
  /** Reference date for relative terms like "next Monday" */
  referenceDate?: Date;
  /** Previously proposed times (for matching "the first one", etc.) */
  proposedTimes?: Array<{ utc: string; display: string }>;
}

export interface TimeParseResult {
  success: boolean;
  time: ParsedTime | null;
  error?: string;
}

export interface MultiTimeParseResult {
  success: boolean;
  times: ParsedTime[];
  errors: string[];
}

// ============================================
// MAIN PARSING FUNCTION
// ============================================

/**
 * Parse a single time expression from human input
 * 
 * This is THE function for parsing times. All paths use this.
 */
export async function parseTime(
  input: string,
  context: TimeParseContext
): Promise<TimeParseResult> {
  // Implementation: 
  // 1. Build AI prompt with timezone context using buildDateContextForAI()
  // 2. Call AI with getAITimestampInstructions() included
  // 3. Normalize result with normalizeAITimestamp()
  // 4. Validate date is in future (add year if needed)
  // 5. Format display string with formatForDisplay()
  // 6. Return ParsedTime with all metadata
}

/**
 * Parse multiple time expressions
 */
export async function parseTimes(
  inputs: string[],
  context: TimeParseContext
): Promise<MultiTimeParseResult> {
  // Call parseTime for each input, collect results
}

/**
 * Extract time expressions from free-form text (like an email body)
 */
export async function extractTimesFromText(
  text: string,
  context: TimeParseContext
): Promise<MultiTimeParseResult> {
  // 1. Use AI to identify time expressions in text
  // 2. Pass each to parseTime()
  // 3. Return all parsed times
}

/**
 * Match a response against previously proposed times
 * Used when someone says "the first one works" or "Tuesday works"
 */
export function matchToProposedTime(
  response: string,
  proposedTimes: Array<{ utc: string; display: string }>,
  context: TimeParseContext
): ParsedTime | null {
  // Check for ordinal references (first, second, option 1, etc.)
  // Check for day name matches
  // Return matched ParsedTime or null
}

/**
 * Validate a parsed time is usable for scheduling
 */
export function validateParsedTime(time: ParsedTime): {
  valid: boolean;
  issues: string[];
} {
  // Check: is in future, is during business hours, is not a holiday, etc.
}
```

## Task 2: Implement the Functions

Implement each function with proper:
- Logging with context: `console.log(`[TimeParser] Parsing: "${input}" in timezone ${tz}`)`
- Error handling with meaningful messages
- AI prompts that include year guidance (we're in January 2026, so "Monday the 5th" should be January 5, 2026)

Key AI prompt elements to include:
- TODAY'S DATE with full context
- User's timezone and what it means
- Rules for date number priority ("Monday the 5th" = find month where 5th is near Monday)
- Year determination rules (dates must be in future)
- Instruction to ALWAYS include timezone offset in returned timestamps

## Task 3: Create Constants File

Create `src/lib/scheduler/core/constants.ts`:

```typescript
/**
 * Scheduler Constants - Single source for all constant values
 */

// Action types that the cron should process
export const PROCESSABLE_ACTION_TYPES = [
  'process_response',
  'follow_up',
  'second_follow_up',
  'send_initial',
  'send_options',
  'send_reminder',
  'check_no_show',
  'human_review_decline',
  'human_review_max_attempts',
  'answer_question',
  'offer_future_scheduling',
] as const;

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  AUTO_EXECUTE: 'high',      // Can auto-execute without human review
  NEEDS_REVIEW: 'medium',    // Create draft for human review
  ESCALATE: 'low',           // Escalate to human immediately
} as const;

// Timing constants
export const TIMING = {
  FOLLOW_UP_DELAY_HOURS: 24,
  SECOND_FOLLOW_UP_DELAY_HOURS: 48,
  FINAL_FOLLOW_UP_DELAY_HOURS: 72,
  MAX_FOLLOW_UP_ATTEMPTS: 5,
  REMINDER_HOURS_BEFORE: 24,
  RESPONSE_PROCESSING_DELAY_MS: 3 * 60 * 1000, // 3 minutes
} as const;

// Business hours (default)
export const DEFAULT_BUSINESS_HOURS = {
  start: 9,  // 9 AM
  end: 17,   // 5 PM
  timezone: 'America/New_York',
} as const;
```

## Task 4: Update Exports

Update `src/lib/scheduler/index.ts` to export the new modules:

```typescript
// Core modules
export * from './core/TimeParser';
export * from './core/constants';
```

## Task 5: Create Tests

Create `src/lib/scheduler/core/__tests__/TimeParser.test.ts` with tests for:
- Parsing "2pm on Monday" in different timezones
- Parsing "Monday the 5th" when we're in late December (should be next year)
- Parsing "10:30 AM" vs "10:30" (assume AM for business hours)
- Matching "the first option" to proposed times
- Handling invalid/unparseable input gracefully
- Edge case: DST transition dates

## Verification
After implementation:
1. All exports should work: `import { parseTime, parseTimes } from '@/lib/scheduler'`
2. parseTime should always return UTC dates with proper timezone info logged
3. Test manually: parseTime("2pm Monday", { timezone: "America/Los_Angeles" }) should return correct UTC

## Do NOT
- Modify existing response processing yet (that's Prompt 3)
- Touch email generation
- Change database schema
- Add external dependencies
```

---

## Prompt 3: Intent Detection & Response Processing Refactor

```
I need you to refactor the response processing to use a two-step approach: first detect INTENT, then extract TIMES. This separation improves accuracy for both tasks.

## Context
Currently, parseSchedulingResponse() asks AI to do two things at once:
1. Determine what the person wants (accept, decline, counter-propose, etc.)
2. Extract specific times they mentioned

This leads to errors. We'll separate these into:
1. IntentDetector - ONLY determines what they want
2. TimeParser (from Prompt 2) - Extracts specific times when needed

## Files to Reference
- src/lib/scheduler/core/TimeParser.ts - Created in Prompt 2
- src/lib/scheduler/emailGeneration.ts - See parseSchedulingResponse() 
- src/lib/scheduler/responseProcessor.ts - Main processing logic
- src/lib/scheduler/types.ts - Type definitions

## Task 1: Create IntentDetector Module

Create `src/lib/scheduler/processors/IntentDetector.ts`:

```typescript
/**
 * IntentDetector - Step 1 of Response Analysis
 * 
 * Determines WHAT the person wants to do, WITHOUT extracting specific times.
 * Time extraction is a separate step handled by TimeParser.
 */

import { callAIJson } from '@/lib/ai/core/aiClient';

export type SchedulingIntent = 
  | 'accept'           // Accepting a proposed time
  | 'counter_propose'  // Suggesting different times
  | 'decline'          // Don't want to meet
  | 'question'         // Has a question
  | 'reschedule'       // Changing existing meeting
  | 'delegate'         // Forwarding to someone else
  | 'confused'         // Confused or correcting us
  | 'unclear';         // Can't determine

export interface IntentAnalysis {
  intent: SchedulingIntent;
  confidence: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative';
  reasoning: string;
  
  // Flags for special handling
  isConfused: boolean;
  confusionReason?: string;
  isDelegating: boolean;
  delegateTo?: string;
  hasQuestion: boolean;
  question?: string;
}

/**
 * Detect the intent of a scheduling response
 * This ONLY determines intent - does NOT extract times
 */
export async function detectIntent(
  emailBody: string,
  proposedTimes: string[],
  correlationId?: string
): Promise<IntentAnalysis> {
  const logPrefix = correlationId ? `[IntentDetector:${correlationId}]` : '[IntentDetector]';
  console.log(`${logPrefix} Analyzing intent for email (${emailBody.length} chars)`);
  
  // Implementation:
  // 1. Build prompt focused ONLY on understanding intent
  // 2. Include confusion detection patterns
  // 3. Do NOT ask AI to extract times
  // 4. Return IntentAnalysis
  
  // Key prompt elements:
  // - List the proposed times we sent (for context)
  // - Ask ONLY about intent classification
  // - Emphasize confusion detection (look for corrections, frustration)
  // - Include sentiment analysis
}
```

## Task 2: Create Escalation Utilities

Create `src/lib/scheduler/processors/Escalation.ts`:

```typescript
/**
 * Escalation - Handle cases requiring human review
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingRequest, SCHEDULING_STATUS } from '../types';

export interface EscalationReason {
  reason: string;
  details?: Record<string, unknown>;
  suggestedAction?: string;
}

/**
 * Escalate a scheduling request to human review
 * Creates a work item and pauses the request
 */
export async function escalateToHumanReview(
  request: SchedulingRequest,
  escalation: EscalationReason,
  correlationId?: string
): Promise<{ success: boolean; workItemId?: string }> {
  const logPrefix = correlationId ? `[Escalation:${correlationId}]` : '[Escalation]';
  console.log(`${logPrefix} Escalating request ${request.id}: ${escalation.reason}`);
  
  const supabase = createAdminClient();
  
  // 1. Update request status to PAUSED with reason
  await supabase
    .from('scheduling_requests')
    .update({
      status: SCHEDULING_STATUS.PAUSED,
      pause_reason: escalation.reason,
      pause_details: escalation.details,
    })
    .eq('id', request.id);
  
  // 2. Create command center work item for review
  const { data: workItem } = await supabase
    .from('command_center_items')
    .insert({
      user_id: request.created_by,
      type: 'scheduling_review',
      title: `Scheduling needs review: ${request.title || 'Meeting request'}`,
      description: escalation.reason,
      priority: 'high',
      status: 'pending',
      context: {
        scheduling_request_id: request.id,
        escalation_reason: escalation.reason,
        details: escalation.details,
        suggested_action: escalation.suggestedAction,
      },
      source_type: 'scheduler',
      source_id: request.id,
    })
    .select('id')
    .single();
  
  // 3. Log the escalation
  await supabase
    .from('scheduling_actions')
    .insert({
      scheduling_request_id: request.id,
      action_type: 'escalated_to_human',
      ai_reasoning: escalation.reason,
      metadata: escalation.details,
    });
  
  return { 
    success: true, 
    workItemId: workItem?.id 
  };
}
```

## Task 3: Refactor ResponseProcessor

Update `src/lib/scheduler/responseProcessor.ts` to use two-step analysis:

```typescript
import { detectIntent, IntentAnalysis } from './processors/IntentDetector';
import { parseTime, extractTimesFromText, matchToProposedTime, TimeParseContext, ParsedTime } from './core/TimeParser';
import { escalateToHumanReview } from './processors/Escalation';

/**
 * Process a scheduling response email
 * 
 * Two-step approach:
 * 1. Detect intent (what do they want?)
 * 2. Extract times if needed (for accept/counter-propose)
 */
export async function processSchedulingResponse(
  email: IncomingEmail,
  request: SchedulingRequest
): Promise<ProcessingResult> {
  const correlationId = `resp_${request.id}_${Date.now()}`;
  console.log(`[ResponseProcessor:${correlationId}] Starting processing`);
  
  // STEP 1: Detect intent (no time extraction)
  const intent = await detectIntent(
    email.body,
    request.proposed_times || [],
    correlationId
  );
  
  console.log(`[ResponseProcessor:${correlationId}] Intent: ${intent.intent} (${intent.confidence})`);
  
  // Handle confusion immediately
  if (intent.isConfused) {
    return await escalateToHumanReview(request, {
      reason: 'Prospect appears confused or is correcting us',
      details: { confusionReason: intent.confusionReason, emailBody: email.body },
      suggestedAction: 'Review email and respond manually',
    }, correlationId);
  }
  
  // Handle low confidence
  if (intent.confidence === 'low') {
    return await escalateToHumanReview(request, {
      reason: 'Could not confidently determine intent',
      details: { detectedIntent: intent, emailBody: email.body },
    }, correlationId);
  }
  
  // Build time parsing context
  const timeContext: TimeParseContext = {
    timezone: request.timezone || 'America/New_York',
    emailBody: email.body,
    proposedTimes: (request.proposed_times || []).map(t => ({
      utc: t,
      display: t, // TODO: format properly
    })),
  };
  
  // STEP 2: Route based on intent
  switch (intent.intent) {
    case 'accept':
      return await handleAcceptance(request, email, intent, timeContext, correlationId);
    case 'counter_propose':
      return await handleCounterProposal(request, email, intent, timeContext, correlationId);
    case 'decline':
      return await handleDecline(request, intent, correlationId);
    case 'question':
      return await handleQuestion(request, intent, correlationId);
    case 'delegate':
      return await handleDelegation(request, intent, email, correlationId);
    case 'reschedule':
      return await handleReschedule(request, email, timeContext, correlationId);
    default:
      return await escalateToHumanReview(request, {
        reason: `Unhandled intent: ${intent.intent}`,
        details: { intent },
      }, correlationId);
  }
}

/**
 * Handle acceptance - they're agreeing to a proposed time
 */
async function handleAcceptance(
  request: SchedulingRequest,
  email: IncomingEmail,
  intent: IntentAnalysis,
  context: TimeParseContext,
  correlationId: string
): Promise<ProcessingResult> {
  console.log(`[ResponseProcessor:${correlationId}] Handling acceptance`);
  
  // Try to match to proposed times first
  const matched = matchToProposedTime(email.body, context.proposedTimes || [], context);
  
  if (matched && matched.confidence !== 'low') {
    // Great - we know which time they selected
    return await confirmTimeSelection(request, matched, correlationId);
  }
  
  // Try parsing times from their response
  const extracted = await extractTimesFromText(email.body, context);
  
  if (extracted.times.length > 0 && extracted.times[0].confidence !== 'low') {
    return await confirmTimeSelection(request, extracted.times[0], correlationId);
  }
  
  // Couldn't determine which time - escalate
  return await escalateToHumanReview(request, {
    reason: 'Accepted but could not determine which time',
    details: { emailBody: email.body, proposedTimes: context.proposedTimes },
    suggestedAction: 'Manually confirm which time was selected',
  }, correlationId);
}

/**
 * Handle counter-proposal - they're suggesting different times
 */
async function handleCounterProposal(
  request: SchedulingRequest,
  email: IncomingEmail,
  intent: IntentAnalysis,
  context: TimeParseContext,
  correlationId: string
): Promise<ProcessingResult> {
  console.log(`[ResponseProcessor:${correlationId}] Handling counter-proposal`);
  
  // Extract times from their email
  const extracted = await extractTimesFromText(email.body, context);
  
  if (extracted.times.length === 0) {
    return await escalateToHumanReview(request, {
      reason: 'Counter-proposal but no times could be extracted',
      details: { emailBody: email.body, errors: extracted.errors },
      suggestedAction: 'Manually extract proposed times and respond',
    }, correlationId);
  }
  
  // Check confidence
  const lowConfidenceTimes = extracted.times.filter(t => t.confidence === 'low');
  if (lowConfidenceTimes.length > 0) {
    return await escalateToHumanReview(request, {
      reason: 'Low confidence in parsing proposed times',
      details: { 
        parsedTimes: extracted.times,
        emailBody: email.body,
      },
      suggestedAction: 'Verify parsed times are correct',
    }, correlationId);
  }
  
  // Check availability for first proposed time
  const proposedTime = extracted.times[0];
  // ... continue with availability check and response
}

// Implement other handlers: handleDecline, handleQuestion, handleDelegation, handleReschedule
```

## Task 4: Update Exports

Update `src/lib/scheduler/index.ts`:

```typescript
// Processors
export * from './processors/IntentDetector';
export * from './processors/Escalation';
```

## Task 5: Remove Old parseSchedulingResponse Usage

The old parseSchedulingResponse() in emailGeneration.ts can remain for now (other code may use it), but update responseProcessor.ts to use the new two-step approach exclusively.

Search for calls to parseSchedulingResponse in responseProcessor.ts and replace with detectIntent + TimeParser.

## Verification
1. Intent detection should NOT return any timestamps
2. Time extraction should ONLY happen after intent is determined
3. Low confidence or confusion should ALWAYS escalate
4. All processing should have correlation IDs in logs

## Do NOT
- Change email generation logic
- Modify calendar integration
- Touch the state machine transitions
- Add new database tables yet (that's Prompt 4)
```

---

## Prompt 4: Draft/Approval System

```
I need you to implement a draft/approval system so that scheduler actions go through human review before execution. This is the "human-in-the-loop" pattern.

## Context
Currently, the scheduler can auto-send emails and auto-book meetings. We want ALL actions to:
1. Create a draft first
2. Wait for user approval (or auto-approval for high-confidence)
3. Execute only after approval

This prevents embarrassing mistakes like the "10:30 AM → 3:30 PM" timezone error from going out automatically.

## Files to Reference
- src/lib/scheduler/types.ts - Existing types
- src/lib/scheduler/responseProcessor.ts - Where actions are triggered
- src/lib/scheduler/automationProcessor.ts - Where automated actions happen
- src/lib/microsoft/emailSync.ts - Email sending function

## Task 1: Create Database Migration

Create `supabase/migrations/[timestamp]_scheduler_drafts.sql`:

```sql
-- Scheduler drafts table for human-in-the-loop approval
CREATE TABLE scheduler_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID NOT NULL REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- What type of action
  type TEXT NOT NULL CHECK (type IN (
    'email_initial',      -- Initial scheduling email
    'email_follow_up',    -- Follow-up email
    'email_confirmation', -- Confirmation email
    'email_reminder',     -- Reminder email
    'email_response',     -- Response to prospect
    'calendar_book',      -- Book calendar event
    'calendar_update',    -- Update calendar event
    'calendar_cancel'     -- Cancel calendar event
  )),
  
  -- Current status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Awaiting user action
    'approved',   -- User approved, ready to execute
    'executing',  -- Currently being executed
    'executed',   -- Successfully executed
    'rejected',   -- User rejected
    'expired',    -- Timed out
    'failed'      -- Execution failed
  )),
  
  -- The action details (varies by type)
  action_data JSONB NOT NULL DEFAULT '{}',
  
  -- AI metadata
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  ai_reasoning TEXT NOT NULL,
  
  -- User modifications
  user_edited BOOLEAN NOT NULL DEFAULT false,
  edited_data JSONB,
  rejection_reason TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  
  -- Execution tracking
  execution_error TEXT,
  execution_result JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- For idempotency
  idempotency_key TEXT UNIQUE,
  
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for common queries
CREATE INDEX idx_scheduler_drafts_user_pending 
  ON scheduler_drafts(user_id, status) 
  WHERE status = 'pending';
  
CREATE INDEX idx_scheduler_drafts_request 
  ON scheduler_drafts(scheduling_request_id);
  
CREATE INDEX idx_scheduler_drafts_approved 
  ON scheduler_drafts(status, created_at) 
  WHERE status = 'approved';
  
CREATE INDEX idx_scheduler_drafts_expires 
  ON scheduler_drafts(expires_at) 
  WHERE status = 'pending';

-- Function to auto-expire old drafts (call via cron)
CREATE OR REPLACE FUNCTION expire_old_scheduler_drafts()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE scheduler_drafts
  SET status = 'expired',
      execution_error = 'Draft expired without approval'
  WHERE status = 'pending'
  AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE scheduler_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON scheduler_drafts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own drafts"
  ON scheduler_drafts FOR UPDATE
  USING (user_id = auth.uid());
```

## Task 2: Create DraftManager Module

Create `src/lib/scheduler/actions/DraftManager.ts`:

```typescript
/**
 * DraftManager - Pending Action Queue
 * 
 * All scheduler actions go through drafts by default.
 * Provides: create, approve, reject, execute, query
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';

// Types
export type DraftType = 
  | 'email_initial'
  | 'email_follow_up'
  | 'email_confirmation'
  | 'email_reminder'
  | 'email_response'
  | 'calendar_book'
  | 'calendar_update'
  | 'calendar_cancel';

export type DraftStatus = 
  | 'pending'
  | 'approved'
  | 'executing'
  | 'executed'
  | 'rejected'
  | 'expired'
  | 'failed';

export interface SchedulerDraft {
  id: string;
  scheduling_request_id: string;
  user_id: string;
  type: DraftType;
  status: DraftStatus;
  action_data: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  ai_reasoning: string;
  user_edited: boolean;
  edited_data?: Record<string, unknown>;
  rejection_reason?: string;
  created_at: string;
  expires_at: string;
  approved_at?: string;
  executed_at?: string;
  execution_error?: string;
  execution_result?: Record<string, unknown>;
  retry_count: number;
  idempotency_key?: string;
}

// ============================================
// CREATE DRAFTS
// ============================================

export interface CreateDraftParams {
  requestId: string;
  userId: string;
  type: DraftType;
  actionData: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  expiresInHours?: number;
  idempotencyKey?: string;
}

export async function createDraft(params: CreateDraftParams): Promise<SchedulerDraft> {
  const supabase = createAdminClient();
  
  // Check for existing draft with same idempotency key
  if (params.idempotencyKey) {
    const { data: existing } = await supabase
      .from('scheduler_drafts')
      .select('*')
      .eq('idempotency_key', params.idempotencyKey)
      .single();
      
    if (existing) {
      console.log(`[DraftManager] Returning existing draft for key: ${params.idempotencyKey}`);
      return existing as SchedulerDraft;
    }
  }
  
  const draft = {
    scheduling_request_id: params.requestId,
    user_id: params.userId,
    type: params.type,
    status: 'pending' as DraftStatus,
    action_data: params.actionData,
    confidence: params.confidence,
    ai_reasoning: params.reasoning,
    user_edited: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (params.expiresInHours || 24) * 60 * 60 * 1000).toISOString(),
    retry_count: 0,
    idempotency_key: params.idempotencyKey,
  };
  
  const { data, error } = await supabase
    .from('scheduler_drafts')
    .insert(draft)
    .select()
    .single();
    
  if (error) throw error;
  
  console.log(`[DraftManager] Created ${params.type} draft: ${data.id}`);
  
  return data as SchedulerDraft;
}

// Convenience functions for specific draft types
export async function createEmailDraft(params: {
  requestId: string;
  userId: string;
  type: 'email_initial' | 'email_follow_up' | 'email_confirmation' | 'email_reminder' | 'email_response';
  to: string[];
  subject: string;
  body: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  replyToMessageId?: string;
}): Promise<SchedulerDraft> {
  return createDraft({
    requestId: params.requestId,
    userId: params.userId,
    type: params.type,
    actionData: {
      to: params.to,
      subject: params.subject,
      body: params.body,
      replyToMessageId: params.replyToMessageId,
    },
    confidence: params.confidence,
    reasoning: params.reasoning,
    idempotencyKey: `${params.type}:${params.requestId}:${Date.now()}`,
  });
}

export async function createBookingDraft(params: {
  requestId: string;
  userId: string;
  time: Date;
  duration: number;
  attendees: string[];
  title: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}): Promise<SchedulerDraft> {
  return createDraft({
    requestId: params.requestId,
    userId: params.userId,
    type: 'calendar_book',
    actionData: {
      time: params.time.toISOString(),
      duration: params.duration,
      attendees: params.attendees,
      title: params.title,
    },
    confidence: params.confidence,
    reasoning: params.reasoning,
    idempotencyKey: `book:${params.requestId}:${params.time.toISOString()}`,
  });
}

// ============================================
// APPROVE / REJECT
// ============================================

export async function approveDraft(
  draftId: string,
  userId: string,
  edits?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('scheduler_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      user_edited: !!edits,
      edited_data: edits,
    })
    .eq('id', draftId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select()
    .single();
    
  if (error || !data) {
    return { success: false, error: error?.message || 'Draft not found or not pending' };
  }
  
  console.log(`[DraftManager] Draft ${draftId} approved`);
  return { success: true };
}

export async function rejectDraft(
  draftId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('scheduler_drafts')
    .update({
      status: 'rejected',
      rejection_reason: reason || 'Rejected by user',
    })
    .eq('id', draftId)
    .eq('user_id', userId)
    .eq('status', 'pending');
    
  if (error) {
    return { success: false, error: error.message };
  }
  
  console.log(`[DraftManager] Draft ${draftId} rejected`);
  return { success: true };
}

// ============================================
// EXECUTE
// ============================================

export async function executeDraft(draftId: string): Promise<{
  success: boolean;
  error?: string;
  result?: Record<string, unknown>;
}> {
  const supabase = createAdminClient();
  
  // Get and lock the draft
  const { data: draft, error: fetchError } = await supabase
    .from('scheduler_drafts')
    .update({ status: 'executing' })
    .eq('id', draftId)
    .eq('status', 'approved')
    .select()
    .single();
    
  if (fetchError || !draft) {
    return { success: false, error: 'Draft not found or not approved' };
  }
  
  try {
    const actionData = draft.user_edited 
      ? { ...draft.action_data, ...draft.edited_data }
      : draft.action_data;
    
    let result: Record<string, unknown>;
    
    switch (draft.type) {
      case 'email_initial':
      case 'email_follow_up':
      case 'email_confirmation':
      case 'email_reminder':
      case 'email_response':
        result = await executeEmailDraft(draft.user_id, actionData);
        break;
        
      case 'calendar_book':
        result = await executeBookingDraft(draft.scheduling_request_id, draft.user_id, actionData);
        break;
        
      default:
        throw new Error(`Unknown draft type: ${draft.type}`);
    }
    
    // Mark as executed
    await supabase
      .from('scheduler_drafts')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        execution_result: result,
      })
      .eq('id', draftId);
    
    console.log(`[DraftManager] Draft ${draftId} executed successfully`);
    return { success: true, result };
    
  } catch (err) {
    // Mark as failed
    await supabase
      .from('scheduler_drafts')
      .update({
        status: 'failed',
        execution_error: String(err),
        retry_count: draft.retry_count + 1,
      })
      .eq('id', draftId);
    
    console.error(`[DraftManager] Draft ${draftId} failed:`, err);
    return { success: false, error: String(err) };
  }
}

async function executeEmailDraft(
  userId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { sendEmail } = await import('@/lib/microsoft/emailSync');
  
  const result = await sendEmail(
    userId,
    data.to as string[],
    data.subject as string,
    data.body as string,
    data.replyToMessageId as string | undefined
  );
  
  return { messageId: result.messageId, conversationId: result.conversationId };
}

async function executeBookingDraft(
  requestId: string,
  userId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { createMeetingCalendarEvent } = await import('../calendarIntegration');
  
  const result = await createMeetingCalendarEvent({
    requestId,
    userId,
    scheduledTime: new Date(data.time as string),
    durationMinutes: data.duration as number,
    title: data.title as string,
  });
  
  return { eventId: result.eventId, meetingLink: result.meetingLink };
}

// ============================================
// QUERIES
// ============================================

export async function getPendingDrafts(userId: string): Promise<SchedulerDraft[]> {
  const supabase = createAdminClient();
  
  const { data } = await supabase
    .from('scheduler_drafts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
    
  return (data || []) as SchedulerDraft[];
}

export async function getApprovedDrafts(limit = 50): Promise<SchedulerDraft[]> {
  const supabase = createAdminClient();
  
  const { data } = await supabase
    .from('scheduler_drafts')
    .select('*')
    .eq('status', 'approved')
    .order('approved_at', { ascending: true })
    .limit(limit);
    
  return (data || []) as SchedulerDraft[];
}

export async function getDraftsByRequest(requestId: string): Promise<SchedulerDraft[]> {
  const supabase = createAdminClient();
  
  const { data } = await supabase
    .from('scheduler_drafts')
    .select('*')
    .eq('scheduling_request_id', requestId)
    .order('created_at', { ascending: false });
    
  return (data || []) as SchedulerDraft[];
}
```

## Task 3: Create Draft Execution Cron

Create `src/app/api/cron/scheduler/execute-drafts/route.ts`:

```typescript
/**
 * Execute Approved Drafts Cron
 * 
 * Schedule: Every 1 minute
 * Purpose: Execute drafts that have been approved
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApprovedDrafts, executeDraft } from '@/lib/scheduler/actions/DraftManager';

export async function GET(request: NextRequest) {
  // Verify cron secret...
  
  const drafts = await getApprovedDrafts(20); // Process up to 20 per run
  
  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  for (const draft of drafts) {
    results.processed++;
    const result = await executeDraft(draft.id);
    
    if (result.success) {
      results.succeeded++;
    } else {
      results.failed++;
      results.errors.push(`${draft.id}: ${result.error}`);
    }
  }
  
  return NextResponse.json({ success: true, ...results });
}
```

## Task 4: Create Drafts API Endpoints

Create `src/app/api/scheduler/drafts/route.ts`:

```typescript
// GET - List pending drafts for current user
// POST - Not used (drafts created internally)
```

Create `src/app/api/scheduler/drafts/[id]/route.ts`:

```typescript
// GET - Get specific draft
// PATCH - Approve or reject draft
// DELETE - Not allowed
```

Create `src/app/api/scheduler/drafts/[id]/approve/route.ts`:

```typescript
// POST - Approve draft with optional edits
```

Create `src/app/api/scheduler/drafts/[id]/reject/route.ts`:

```typescript
// POST - Reject draft with reason
```

## Task 5: Update Response Processor to Create Drafts

Update the handlers in responseProcessor.ts to create drafts instead of executing directly:

```typescript
// Instead of:
await sendEmail(...)

// Do:
await createEmailDraft({
  requestId: request.id,
  userId: request.created_by,
  type: 'email_response',
  to: [recipient],
  subject: email.subject,
  body: generatedBody,
  confidence: 'high',
  reasoning: 'Auto-generated response to counter-proposal',
});
```

## Task 6: Update Automation Processor to Create Drafts

Similarly update automationProcessor.ts for follow-ups, reminders, etc.

## Verification
1. Run migration: `supabase db push`
2. Create a test draft manually
3. Approve it via API
4. Verify cron executes it
5. Check execution_result is populated

## Do NOT
- Auto-execute anything yet (that's a later enhancement)
- Change the UI (that's separate)
- Modify calendar integration directly
```

---

## Prompt 5: Focused Cron Jobs & Reliability

```
I need you to replace the monolithic scheduler cron with focused, single-purpose cron jobs. Each job does ONE thing reliably.

## Context
Currently, scheduling automation is handled by a single cron that tries to do everything. This leads to:
- Missed actions when query filters are wrong
- Hard to debug which part failed
- No visibility into job health

We'll create separate crons for:
1. Process email responses
2. Send follow-ups
3. Send reminders  
4. Check no-shows
5. Execute approved drafts (from Prompt 4)
6. Expire old drafts

## Files to Reference
- src/lib/scheduler/automationProcessor.ts - Current processing logic
- src/lib/scheduler/responseProcessor.ts - Response processing
- src/lib/scheduler/actions/DraftManager.ts - From Prompt 4
- src/app/api/cron/ - Existing cron patterns

## Task 1: Create Job Registry

Create `src/lib/scheduler/jobs/registry.ts`:

```typescript
/**
 * Scheduler Job Registry
 * 
 * Central registry of all scheduler background jobs.
 * Each job has metadata for monitoring and alerting.
 */

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;  // Cron expression
  timeout: number;   // Max runtime in seconds
  retryable: boolean;
  alertOnFailure: boolean;
}

export const SCHEDULER_JOBS: Record<string, JobDefinition> = {
  PROCESS_RESPONSES: {
    id: 'scheduler:process-responses',
    name: 'Process Scheduling Responses',
    description: 'Detect and process incoming email responses to scheduling requests',
    schedule: '* * * * *',  // Every minute
    timeout: 55,
    retryable: true,
    alertOnFailure: true,
  },
  SEND_FOLLOW_UPS: {
    id: 'scheduler:send-follow-ups',
    name: 'Send Follow-Up Emails',
    description: 'Create drafts for follow-up emails on requests without response',
    schedule: '*/15 * * * *',  // Every 15 minutes
    timeout: 120,
    retryable: true,
    alertOnFailure: true,
  },
  SEND_REMINDERS: {
    id: 'scheduler:send-reminders',
    name: 'Send Meeting Reminders',
    description: 'Create drafts for meeting reminder emails (24h before)',
    schedule: '0 * * * *',  // Every hour
    timeout: 60,
    retryable: true,
    alertOnFailure: false,
  },
  CHECK_NO_SHOWS: {
    id: 'scheduler:check-no-shows',
    name: 'Check for No-Shows',
    description: 'Detect meetings that occurred without completion and trigger recovery',
    schedule: '*/30 * * * *',  // Every 30 minutes
    timeout: 60,
    retryable: true,
    alertOnFailure: true,
  },
  EXECUTE_DRAFTS: {
    id: 'scheduler:execute-drafts',
    name: 'Execute Approved Drafts',
    description: 'Execute scheduler drafts that have been approved',
    schedule: '* * * * *',  // Every minute
    timeout: 55,
    retryable: false,  // Drafts have their own retry logic
    alertOnFailure: true,
  },
  EXPIRE_DRAFTS: {
    id: 'scheduler:expire-drafts',
    name: 'Expire Old Drafts',
    description: 'Mark expired drafts as expired',
    schedule: '0 * * * *',  // Every hour
    timeout: 30,
    retryable: false,
    alertOnFailure: false,
  },
};
```

## Task 2: Create Base Job Runner

Create `src/lib/scheduler/jobs/JobRunner.ts`:

```typescript
/**
 * JobRunner - Base class for scheduler jobs
 * 
 * Provides:
 * - Consistent logging with job ID
 * - Timing and metrics
 * - Error handling
 * - Result formatting
 */

import { JobDefinition } from './registry';

export interface JobResult {
  success: boolean;
  jobId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  metrics: Record<string, number>;
  errors: string[];
}

export abstract class SchedulerJob {
  protected jobDef: JobDefinition;
  protected startTime: number = 0;
  protected metrics: Record<string, number> = {};
  protected errors: string[] = [];
  
  constructor(jobDef: JobDefinition) {
    this.jobDef = jobDef;
  }
  
  async run(): Promise<JobResult> {
    this.startTime = Date.now();
    this.metrics = {};
    this.errors = [];
    
    console.log(`[${this.jobDef.id}] Starting job: ${this.jobDef.name}`);
    
    try {
      await this.execute();
    } catch (err) {
      this.errors.push(`Fatal error: ${err}`);
      console.error(`[${this.jobDef.id}] Fatal error:`, err);
    }
    
    const result: JobResult = {
      success: this.errors.length === 0,
      jobId: this.jobDef.id,
      startedAt: new Date(this.startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - this.startTime,
      metrics: this.metrics,
      errors: this.errors,
    };
    
    console.log(`[${this.jobDef.id}] Completed in ${result.durationMs}ms:`, result.metrics);
    
    return result;
  }
  
  protected abstract execute(): Promise<void>;
  
  protected log(message: string): void {
    console.log(`[${this.jobDef.id}] ${message}`);
  }
  
  protected incrementMetric(name: string, amount = 1): void {
    this.metrics[name] = (this.metrics[name] || 0) + amount;
  }
  
  protected addError(error: string): void {
    this.errors.push(error);
    console.error(`[${this.jobDef.id}] Error: ${error}`);
  }
}
```

## Task 3: Implement Each Job

### Process Responses Job

Create `src/lib/scheduler/jobs/ProcessResponsesJob.ts`:

```typescript
import { SchedulerJob } from './JobRunner';
import { SCHEDULER_JOBS } from './registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { processSchedulingEmails } from '../responseProcessor';

export class ProcessResponsesJob extends SchedulerJob {
  constructor() {
    super(SCHEDULER_JOBS.PROCESS_RESPONSES);
  }
  
  protected async execute(): Promise<void> {
    const supabase = createAdminClient();
    
    // Get users with active scheduling requests
    const { data: users } = await supabase
      .from('scheduling_requests')
      .select('created_by')
      .in('status', ['awaiting_response', 'negotiating'])
      .not('created_by', 'is', null);
    
    const uniqueUserIds = [...new Set((users || []).map(u => u.created_by))];
    this.log(`Found ${uniqueUserIds.length} users with active requests`);
    this.incrementMetric('users_checked', uniqueUserIds.length);
    
    for (const userId of uniqueUserIds) {
      try {
        const result = await processSchedulingEmails(userId);
        this.incrementMetric('emails_processed', result.processed);
        this.incrementMetric('responses_matched', result.matched);
        
        if (result.errors.length > 0) {
          result.errors.forEach(e => this.addError(`User ${userId}: ${e}`));
        }
      } catch (err) {
        this.addError(`User ${userId}: ${err}`);
      }
    }
  }
}
```

### Send Follow-Ups Job

Create `src/lib/scheduler/jobs/SendFollowUpsJob.ts`:

```typescript
import { SchedulerJob } from './JobRunner';
import { SCHEDULER_JOBS } from './registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { createEmailDraft } from '../actions/DraftManager';
import { generateSchedulingEmail } from '../emailGeneration';
import { TIMING } from '../core/constants';

export class SendFollowUpsJob extends SchedulerJob {
  constructor() {
    super(SCHEDULER_JOBS.SEND_FOLLOW_UPS);
  }
  
  protected async execute(): Promise<void> {
    const supabase = createAdminClient();
    
    // Get requests due for follow-up
    const { data: requests } = await supabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*),
        company:companies(name)
      `)
      .in('next_action_type', ['follow_up', 'second_follow_up'])
      .lte('next_action_at', new Date().toISOString())
      .in('status', ['awaiting_response', 'negotiating'])
      .lt('attempt_count', TIMING.MAX_FOLLOW_UP_ATTEMPTS);
    
    this.log(`Found ${requests?.length || 0} requests due for follow-up`);
    this.incrementMetric('requests_found', requests?.length || 0);
    
    for (const request of requests || []) {
      try {
        await this.processFollowUp(request);
        this.incrementMetric('drafts_created');
      } catch (err) {
        this.addError(`Request ${request.id}: ${err}`);
        this.incrementMetric('failures');
      }
    }
  }
  
  private async processFollowUp(request: any): Promise<void> {
    // Find primary contact
    const primaryContact = request.attendees?.find((a: any) => a.is_primary_contact);
    if (!primaryContact?.email) {
      this.log(`Request ${request.id}: No primary contact, skipping`);
      this.incrementMetric('skipped_no_contact');
      return;
    }
    
    // Determine follow-up type
    const isSecondFollowUp = request.next_action_type === 'second_follow_up';
    const emailType = isSecondFollowUp ? 'second_follow_up' : 'follow_up';
    
    // Generate email
    const { email } = await generateSchedulingEmail({
      emailType,
      request,
      attendees: request.attendees || [],
      senderName: 'Sales Team',
      companyContext: request.company ? { name: request.company.name } : undefined,
    });
    
    // Create draft
    await createEmailDraft({
      requestId: request.id,
      userId: request.created_by,
      type: 'email_follow_up',
      to: [primaryContact.email],
      subject: email.subject,
      body: email.body,
      confidence: 'high',
      reasoning: `Auto-generated ${emailType} (attempt ${request.attempt_count + 1}/${TIMING.MAX_FOLLOW_UP_ATTEMPTS})`,
    });
    
    // Update next action
    const supabase = createAdminClient();
    const nextDelay = isSecondFollowUp 
      ? TIMING.FINAL_FOLLOW_UP_DELAY_HOURS 
      : TIMING.SECOND_FOLLOW_UP_DELAY_HOURS;
    
    await supabase
      .from('scheduling_requests')
      .update({
        next_action_type: isSecondFollowUp ? 'human_review_max_attempts' : 'second_follow_up',
        next_action_at: new Date(Date.now() + nextDelay * 60 * 60 * 1000).toISOString(),
        attempt_count: request.attempt_count + 1,
      })
      .eq('id', request.id);
  }
}
```

### Similarly implement:
- `SendRemindersJob.ts` - Find confirmed meetings 24h away, create reminder drafts
- `CheckNoShowsJob.ts` - Find confirmed meetings past their time without completion
- `ExecuteDraftsJob.ts` - Get approved drafts, execute them
- `ExpireDraftsJob.ts` - Call expire_old_scheduler_drafts() function

## Task 4: Create Cron Route for Each Job

Create `src/app/api/cron/scheduler/process-responses/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ProcessResponsesJob } from '@/lib/scheduler/jobs/ProcessResponsesJob';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const job = new ProcessResponsesJob();
  const result = await job.run();
  
  return NextResponse.json(result, { 
    status: result.success ? 200 : 500 
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
```

Create similar routes for each job:
- `/api/cron/scheduler/send-follow-ups`
- `/api/cron/scheduler/send-reminders`
- `/api/cron/scheduler/check-no-shows`
- `/api/cron/scheduler/execute-drafts`
- `/api/cron/scheduler/expire-drafts`

## Task 5: Update vercel.json

Add cron schedules:

```json
{
  "crons": [
    {
      "path": "/api/cron/scheduler/process-responses",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/scheduler/send-follow-ups",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/scheduler/send-reminders",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/scheduler/check-no-shows",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/scheduler/execute-drafts",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/scheduler/expire-drafts",
      "schedule": "0 * * * *"
    }
  ]
}
```

## Task 6: Disable Old Combined Cron

Find and disable or remove the old monolithic scheduler cron that was trying to do everything.

## Verification
1. Each job can run independently: `curl /api/cron/scheduler/process-responses`
2. Jobs return structured JobResult
3. Metrics are populated correctly
4. Errors are captured and logged
5. vercel.json has all schedules

## Do NOT
- Process anything automatically that should create drafts
- Skip error handling
- Run jobs in parallel (they should be sequential within each job)
```

---

## Prompt 6: Health Monitoring & Dashboard

```
I need you to implement health monitoring for the scheduler so we have visibility into system state. This includes a health check endpoint and dashboard data.

## Context
Currently, there's no way to see:
- How many requests are stuck
- How many are missing thread IDs
- Whether crons are running
- What drafts are pending

We need a health system that surfaces issues proactively.

## Files to Reference
- src/lib/scheduler/types.ts - Status types
- src/lib/scheduler/actions/DraftManager.ts - Draft queries
- src/app/api/scheduler/ - Existing scheduler endpoints

## Task 1: Create Health Checker Module

Create `src/lib/scheduler/monitoring/HealthChecker.ts`:

```typescript
/**
 * HealthChecker - Scheduler System Health Monitoring
 * 
 * Checks for:
 * - Stuck requests (no action in 48+ hours)
 * - Missing thread IDs
 * - Pending drafts
 * - Failed drafts
 * - Job execution status
 * - Processing delays
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SCHEDULING_STATUS } from '../types';

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  count?: number;
  affectedIds?: string[];
  recommendation?: string;
}

export interface SchedulerMetrics {
  // Request counts
  total_active: number;
  by_status: Record<string, number>;
  
  // Problem indicators
  stuck_requests: number;        // No action in 48+ hours
  missing_thread_id: number;     // Awaiting response but no thread ID
  high_attempt_count: number;    // 4+ attempts without success
  
  // Draft status
  pending_drafts: number;
  approved_drafts: number;
  failed_drafts_24h: number;
  
  // Performance
  avg_time_to_response_hours: number | null;
  avg_time_to_booking_hours: number | null;
  
  // Job health
  last_job_runs: Record<string, string>;  // job_id -> last_run timestamp
}

export interface SchedulerHealth {
  status: HealthStatus;
  checked_at: string;
  metrics: SchedulerMetrics;
  issues: HealthIssue[];
  recommendations: string[];
}

export async function checkSchedulerHealth(): Promise<SchedulerHealth> {
  const supabase = createAdminClient();
  const now = new Date();
  const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const issues: HealthIssue[] = [];
  const recommendations: string[] = [];
  
  // ========================================
  // GATHER METRICS
  // ========================================
  
  // Get all active requests
  const { data: activeRequests } = await supabase
    .from('scheduling_requests')
    .select('id, status, email_thread_id, last_action_at, attempt_count, created_at')
    .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED})`);
  
  const requests = activeRequests || [];
  
  // Count by status
  const byStatus: Record<string, number> = {};
  for (const r of requests) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
  
  // Find stuck requests
  const stuckRequests = requests.filter(r => {
    if (!r.last_action_at) return true;
    return new Date(r.last_action_at) < hours48Ago;
  });
  
  // Find missing thread IDs
  const missingThreadId = requests.filter(r => 
    r.status === SCHEDULING_STATUS.AWAITING_RESPONSE && !r.email_thread_id
  );
  
  // Find high attempt count
  const highAttempts = requests.filter(r => r.attempt_count >= 4);
  
  // Get draft counts
  const { data: pendingDrafts } = await supabase
    .from('scheduler_drafts')
    .select('id')
    .eq('status', 'pending');
  
  const { data: approvedDrafts } = await supabase
    .from('scheduler_drafts')
    .select('id')
    .eq('status', 'approved');
  
  const { data: failedDrafts } = await supabase
    .from('scheduler_drafts')
    .select('id')
    .eq('status', 'failed')
    .gte('created_at', hours24Ago.toISOString());
  
  // Calculate performance metrics
  const { data: completedRecent } = await supabase
    .from('scheduling_requests')
    .select('created_at, first_response_at, scheduled_time')
    .eq('status', SCHEDULING_STATUS.COMPLETED)
    .gte('completed_at', hours24Ago.toISOString());
  
  let avgResponseTime: number | null = null;
  let avgBookingTime: number | null = null;
  
  if (completedRecent && completedRecent.length > 0) {
    // Calculate averages...
  }
  
  // ========================================
  // IDENTIFY ISSUES
  // ========================================
  
  // Critical: Many stuck requests
  if (stuckRequests.length > 5) {
    issues.push({
      severity: 'critical',
      code: 'STUCK_REQUESTS_HIGH',
      message: `${stuckRequests.length} requests stuck with no action in 48+ hours`,
      count: stuckRequests.length,
      affectedIds: stuckRequests.slice(0, 10).map(r => r.id),
      recommendation: 'Review stuck requests immediately - may indicate cron failure',
    });
  } else if (stuckRequests.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'STUCK_REQUESTS',
      message: `${stuckRequests.length} requests stuck with no action in 48+ hours`,
      count: stuckRequests.length,
      affectedIds: stuckRequests.map(r => r.id),
    });
  }
  
  // Warning: Missing thread IDs
  if (missingThreadId.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_THREAD_ID',
      message: `${missingThreadId.length} awaiting requests missing email_thread_id`,
      count: missingThreadId.length,
      affectedIds: missingThreadId.map(r => r.id),
      recommendation: 'Check email sending to ensure thread IDs are captured',
    });
  }
  
  // Warning: High attempts
  if (highAttempts.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'HIGH_ATTEMPT_COUNT',
      message: `${highAttempts.length} requests with 4+ follow-up attempts`,
      count: highAttempts.length,
      affectedIds: highAttempts.map(r => r.id),
      recommendation: 'Review these prospects - may need different approach or removal',
    });
  }
  
  // Info: Pending drafts
  if ((pendingDrafts?.length || 0) > 10) {
    issues.push({
      severity: 'info',
      code: 'PENDING_DRAFTS',
      message: `${pendingDrafts?.length} drafts awaiting approval`,
      count: pendingDrafts?.length,
    });
    recommendations.push('Review and approve/reject pending drafts');
  }
  
  // Critical: Failed drafts
  if ((failedDrafts?.length || 0) > 5) {
    issues.push({
      severity: 'critical',
      code: 'FAILED_DRAFTS_HIGH',
      message: `${failedDrafts?.length} draft executions failed in the last 24 hours`,
      count: failedDrafts?.length,
      recommendation: 'Investigate failed drafts - may indicate integration issue',
    });
  } else if ((failedDrafts?.length || 0) > 0) {
    issues.push({
      severity: 'warning',
      code: 'FAILED_DRAFTS',
      message: `${failedDrafts?.length} draft executions failed in the last 24 hours`,
      count: failedDrafts?.length,
    });
  }
  
  // ========================================
  // DETERMINE STATUS
  // ========================================
  
  let status: HealthStatus = 'healthy';
  if (issues.some(i => i.severity === 'critical')) {
    status = 'critical';
  } else if (issues.some(i => i.severity === 'warning')) {
    status = 'degraded';
  }
  
  // ========================================
  // BUILD RESPONSE
  // ========================================
  
  const metrics: SchedulerMetrics = {
    total_active: requests.length,
    by_status: byStatus,
    stuck_requests: stuckRequests.length,
    missing_thread_id: missingThreadId.length,
    high_attempt_count: highAttempts.length,
    pending_drafts: pendingDrafts?.length || 0,
    approved_drafts: approvedDrafts?.length || 0,
    failed_drafts_24h: failedDrafts?.length || 0,
    avg_time_to_response_hours: avgResponseTime,
    avg_time_to_booking_hours: avgBookingTime,
    last_job_runs: {}, // TODO: Track job runs
  };
  
  return {
    status,
    checked_at: now.toISOString(),
    metrics,
    issues,
    recommendations,
  };
}

/**
 * Get summary for dashboard widget
 */
export async function getHealthSummary(): Promise<{
  status: HealthStatus;
  activeRequests: number;
  pendingDrafts: number;
  issueCount: number;
  topIssue?: string;
}> {
  const health = await checkSchedulerHealth();
  
  return {
    status: health.status,
    activeRequests: health.metrics.total_active,
    pendingDrafts: health.metrics.pending_drafts,
    issueCount: health.issues.length,
    topIssue: health.issues[0]?.message,
  };
}
```

## Task 2: Create Health API Endpoint

Create `src/app/api/scheduler/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { checkSchedulerHealth, getHealthSummary } from '@/lib/scheduler/monitoring/HealthChecker';

/**
 * GET /api/scheduler/health
 * 
 * Query params:
 * - summary=true: Return summary only (for dashboard)
 * - full=true: Return full health check (default)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summaryOnly = searchParams.get('summary') === 'true';
  
  try {
    if (summaryOnly) {
      const summary = await getHealthSummary();
      return NextResponse.json(summary);
    }
    
    const health = await checkSchedulerHealth();
    
    // Return 503 if critical
    const statusCode = health.status === 'critical' ? 503 : 200;
    
    return NextResponse.json(health, { status: statusCode });
    
  } catch (err) {
    return NextResponse.json({
      status: 'critical',
      error: String(err),
      checked_at: new Date().toISOString(),
    }, { status: 500 });
  }
}
```

## Task 3: Create Dashboard Data Endpoint

Create `src/app/api/scheduler/dashboard/route.ts` (or update existing):

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHealthSummary } from '@/lib/scheduler/monitoring/HealthChecker';
import { getPendingDrafts } from '@/lib/scheduler/actions/DraftManager';
import { SCHEDULING_STATUS } from '@/lib/scheduler/types';

/**
 * GET /api/scheduler/dashboard
 * 
 * Returns data for the scheduler dashboard widget
 */
export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Get internal user
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();
  
  if (!userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  
  // Get health summary
  const health = await getHealthSummary();
  
  // Get user's pending drafts
  const pendingDrafts = await getPendingDrafts(userData.id);
  
  // Get user's active requests with recent activity
  const { data: activeRequests } = await supabase
    .from('scheduling_requests')
    .select(`
      id,
      title,
      status,
      company:companies(name),
      attendees:scheduling_attendees(name, email, is_primary_contact),
      last_action_at,
      next_action_at,
      next_action_type
    `)
    .eq('created_by', userData.id)
    .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED})`)
    .order('last_action_at', { ascending: false })
    .limit(10);
  
  // Get recent completions
  const { data: recentCompletions } = await supabase
    .from('scheduling_requests')
    .select(`
      id,
      title,
      company:companies(name),
      scheduled_time,
      completed_at
    `)
    .eq('created_by', userData.id)
    .eq('status', SCHEDULING_STATUS.COMPLETED)
    .order('completed_at', { ascending: false })
    .limit(5);
  
  return NextResponse.json({
    health,
    drafts: {
      pending: pendingDrafts.length,
      items: pendingDrafts.slice(0, 5).map(d => ({
        id: d.id,
        type: d.type,
        confidence: d.confidence,
        created_at: d.created_at,
        expires_at: d.expires_at,
        preview: d.action_data.subject || d.action_data.title || 'Action pending',
      })),
    },
    activeRequests: activeRequests?.map(r => ({
      id: r.id,
      title: r.title,
      company: r.company?.name,
      contact: r.attendees?.find((a: any) => a.is_primary_contact)?.name,
      status: r.status,
      lastAction: r.last_action_at,
      nextAction: r.next_action_type,
      nextActionAt: r.next_action_at,
    })) || [],
    recentCompletions: recentCompletions?.map(r => ({
      id: r.id,
      title: r.title,
      company: r.company?.name,
      scheduledTime: r.scheduled_time,
    })) || [],
  });
}
```

## Task 4: Create Metrics Collector

Create `src/lib/scheduler/monitoring/MetricsCollector.ts`:

```typescript
/**
 * MetricsCollector - Track scheduler performance over time
 */

import { createAdminClient } from '@/lib/supabase/admin';

interface SchedulerMetricPoint {
  timestamp: string;
  metric: string;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Record a metric point
 */
export async function recordMetric(
  metric: string,
  value: number,
  tags?: Record<string, string>
): Promise<void> {
  const supabase = createAdminClient();
  
  await supabase
    .from('scheduler_metrics')
    .insert({
      timestamp: new Date().toISOString(),
      metric,
      value,
      tags,
    });
}

/**
 * Record job completion metrics
 */
export async function recordJobRun(
  jobId: string,
  result: {
    success: boolean;
    durationMs: number;
    processedCount: number;
    errorCount: number;
  }
): Promise<void> {
  await recordMetric(`job.${jobId}.duration_ms`, result.durationMs);
  await recordMetric(`job.${jobId}.processed`, result.processedCount);
  await recordMetric(`job.${jobId}.errors`, result.errorCount);
  await recordMetric(`job.${jobId}.success`, result.success ? 1 : 0);
}

/**
 * Get metrics for a time range
 */
export async function getMetrics(
  metric: string,
  startTime: Date,
  endTime: Date
): Promise<SchedulerMetricPoint[]> {
  const supabase = createAdminClient();
  
  const { data } = await supabase
    .from('scheduler_metrics')
    .select('*')
    .eq('metric', metric)
    .gte('timestamp', startTime.toISOString())
    .lte('timestamp', endTime.toISOString())
    .order('timestamp', { ascending: true });
  
  return data || [];
}
```

## Task 5: Create Metrics Table Migration

Create migration for metrics storage:

```sql
-- Scheduler metrics for time-series tracking
CREATE TABLE scheduler_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  tags JSONB,
  
  -- Partition by time for efficient queries
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for metric queries
CREATE INDEX idx_scheduler_metrics_lookup 
  ON scheduler_metrics(metric, timestamp DESC);

-- Auto-cleanup old metrics (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_scheduler_metrics()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM scheduler_metrics
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

## Task 6: Update Job Runner to Record Metrics

Update `src/lib/scheduler/jobs/JobRunner.ts`:

```typescript
import { recordJobRun } from '../monitoring/MetricsCollector';

// In the run() method, after execution:
await recordJobRun(this.jobDef.id, {
  success: this.errors.length === 0,
  durationMs: Date.now() - this.startTime,
  processedCount: this.metrics.processed || 0,
  errorCount: this.errors.length,
});
```

## Task 7: Update Exports

Update `src/lib/scheduler/index.ts`:

```typescript
// Monitoring
export * from './monitoring/HealthChecker';
export * from './monitoring/MetricsCollector';
```

## Verification
1. `/api/scheduler/health` returns full health check
2. `/api/scheduler/health?summary=true` returns summary
3. `/api/scheduler/dashboard` returns dashboard data
4. Metrics are recorded when jobs run
5. Health status reflects actual issues

## Do NOT
- Create UI components (that's separate frontend work)
- Send alerts automatically (just surface issues)
- Modify existing scheduler logic
```

---

## Execution Order & Dependencies

```
Prompt 1 (Bug Fixes)
    ↓
Prompt 2 (TimeParser) ─────────────────┐
    ↓                                  │
Prompt 3 (Intent Detection) ←──────────┘
    ↓
Prompt 4 (Draft System)
    ↓
Prompt 5 (Cron Jobs) ← depends on DraftManager
    ↓
Prompt 6 (Health Monitoring) ← depends on all above
```

## Testing Between Prompts

After each prompt, verify:

1. **After Prompt 1:** Manually trigger cron, check logs for all action types being queried
2. **After Prompt 2:** `import { parseTime } from '@/lib/scheduler'` works, test with sample times
3. **After Prompt 3:** Process a test email, verify two-step analysis in logs
4. **After Prompt 4:** Create a draft via API, approve it, verify execution
5. **After Prompt 5:** Trigger each cron endpoint individually, verify results
6. **After Prompt 6:** Call `/api/scheduler/health`, verify it surfaces real issues

## Estimated Time

| Prompt | Estimated Time | Complexity |
|--------|---------------|------------|
| 1 | 1-2 hours | Low - surgical fixes |
| 2 | 2-3 hours | Medium - new module |
| 3 | 2-3 hours | Medium - refactoring |
| 4 | 3-4 hours | High - new system |
| 5 | 2-3 hours | Medium - multiple files |
| 6 | 2-3 hours | Medium - new module |
| **Total** | **12-18 hours** | |
