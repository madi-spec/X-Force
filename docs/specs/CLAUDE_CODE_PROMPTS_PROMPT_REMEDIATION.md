# Prompt Management Remediation - Claude Code Prompts

Execute these prompts in order. Each builds on the previous.

---

## PROMPT 1: Fix Autopilot Key Mismatches (5 minutes)

```
Fix the autopilot prompt key mismatches. The code is using wrong keys that don't exist in the database, causing silent failures where generic fallback messages are sent instead of AI-generated content.

## Files to Change

### 1. src/lib/autopilot/needsReplyAutopilot.ts

Find this line (around line 296):
```typescript
const promptData = await getPromptWithVariables('email_auto_reply', {
```

Change to:
```typescript
const promptData = await getPromptWithVariables('email_followup_needs_reply', {
```

### 2. src/lib/autopilot/transcriptAutopilot.ts

Find this line (around line 322):
```typescript
const promptData = await getPromptWithVariables('email_meeting_followup', {
```

Change to:
```typescript
const promptData = await getPromptWithVariables('email_followup_stalled', {
```

## Verification

After changes, search to confirm no old keys remain:
```bash
grep -r "email_auto_reply\|email_meeting_followup" src/
```

Should return no results (except maybe comments).
```

---

## PROMPT 2: Fix Scheduler Response Parsing (45 minutes)

```
Fix the scheduler response parsing to use the managed prompt from the database instead of hardcoded prompts in IntentDetector.ts and TimeParser.ts.

## Background

The database has a prompt with key `scheduler_response_parsing` that intelligently analyzes email responses. But the code currently calls:
1. `detectIntent()` from IntentDetector.ts (hardcoded prompt)
2. `extractTimesFromText()` from TimeParser.ts (hardcoded prompt)

These hardcoded prompts don't understand email structure and extract times from quoted reply chains, causing wrong date parsing.

## Files to Change

### 1. src/lib/scheduler/responseProcessor.ts

#### Step 1: Add import

Add at the top with other imports:
```typescript
import { getPromptWithVariables } from '@/lib/ai/promptManager';
```

#### Step 2: Create new unified analysis function

Add this function before `processSchedulingResponse()` (around line 100):

```typescript
/**
 * Analyze a scheduling email response using the managed prompt from the database.
 * This replaces the fragmented detectIntent() + extractTimesFromText() approach.
 * 
 * The prompt is editable at /settings/ai-prompts (key: scheduler_response_parsing)
 */
async function analyzeSchedulingResponse(
  emailBody: string,
  proposedTimes: Array<{ utc: string; display: string }> | string[] | null,
  timezone: string,
  correlationId?: string
): Promise<{
  intent: 'accept' | 'counter_propose' | 'decline' | 'question' | 'reschedule' | 'delegate' | 'confused' | 'unclear';
  selectedTime?: string;
  counterProposedTimes?: Array<{ description: string; isoTimestamp: string; displayText: string }>;
  question?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}> {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;

  // Format today's date for context
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });

  // Year guidance for December/January edge cases
  let yearGuidance = '';
  if (currentMonth === 12) {
    yearGuidance = `CRITICAL: We are in December ${currentYear}. Any mention of January, February, or March means ${nextYear}. All dates must be in the FUTURE.`;
  } else if (currentMonth === 1) {
    yearGuidance = `We are in January ${currentYear}. All dates must be in the FUTURE from today.`;
  } else if (currentMonth >= 10) {
    yearGuidance = `Note: Today is in late ${currentYear}. If they mention January/February/March, use ${nextYear}.`;
  }

  // Format proposed times for the prompt
  let proposedTimesFormatted = 'None provided';
  if (proposedTimes && proposedTimes.length > 0) {
    proposedTimesFormatted = proposedTimes
      .map((t, i) => {
        const display = typeof t === 'string' ? t : t.display;
        return `${i + 1}. ${display}`;
      })
      .join('\n');
  }

  console.log(`[analyzeSchedulingResponse] Correlation: ${correlationId}`);
  console.log(`[analyzeSchedulingResponse] Timezone: ${timezone}`);
  console.log(`[analyzeSchedulingResponse] Email body length: ${emailBody.length}`);

  try {
    // Load the managed prompt from database
    const promptResult = await getPromptWithVariables('scheduler_response_parsing', {
      todayFormatted,
      yearGuidance,
      proposedTimes: proposedTimesFormatted,
      emailBody,
    });

    if (!promptResult || !promptResult.prompt) {
      console.error('[analyzeSchedulingResponse] Failed to load scheduler_response_parsing prompt from database');
      throw new Error('Failed to load scheduler_response_parsing prompt');
    }

    console.log(`[analyzeSchedulingResponse] Loaded prompt, calling AI...`);

    // Call AI with the managed prompt
    const { data: response } = await callAIJson<{
      intent: 'accept' | 'counter_propose' | 'decline' | 'question' | 'reschedule' | 'delegate' | 'confused' | 'unclear';
      selectedTime?: string;
      counterProposedTimes?: Array<{ description: string; isoTimestamp: string; displayText: string }>;
      question?: string;
      sentiment: 'positive' | 'neutral' | 'negative';
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    }>({
      prompt: promptResult.prompt,
      schema: promptResult.schema || undefined,
      model: (promptResult.model as any) || 'claude-sonnet-4-20250514',
      maxTokens: promptResult.maxTokens || 1000,
    });

    console.log(`[analyzeSchedulingResponse] AI response:`, {
      intent: response.intent,
      confidence: response.confidence,
      sentiment: response.sentiment,
      counterProposedCount: response.counterProposedTimes?.length || 0,
    });

    return response;
  } catch (err) {
    console.error('[analyzeSchedulingResponse] Error:', err);
    // Return unclear intent on error so it falls back to human review
    return {
      intent: 'unclear',
      sentiment: 'neutral',
      confidence: 'low',
      reasoning: `Analysis failed: ${err}`,
    };
  }
}
```

#### Step 3: Update processSchedulingResponse() to use the new function

Find the section in `processSchedulingResponse()` where `detectIntent()` is called (around lines 400-450). Look for code like:

```typescript
const intent = await detectIntent(
```

Replace that entire section with:

```typescript
// Use the managed prompt for unified intent + time analysis
const analysis = await analyzeSchedulingResponse(
  email.body || email.bodyPreview || '',
  schedulingRequest.proposed_times,
  schedulingRequest.timezone || 'America/New_York',
  correlationId
);

// Check if we should escalate to human review
if (analysis.confidence === 'low' || analysis.intent === 'unclear' || analysis.intent === 'confused') {
  console.log('[processSchedulingResponse] Low confidence or unclear intent, escalating to human review');
  return await escalateToHumanReview(schedulingRequest, {
    reason: analysis.intent === 'confused' ? 'Prospect appears confused' : 'Low confidence in response analysis',
    details: { 
      intent: analysis.intent,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      emailPreview: (email.body || '').substring(0, 300) 
    },
  }, correlationId);
}

// Build the response analysis object for handlers
const responseAnalysis: ResponseAnalysis = {
  intent: analysis.intent,
  selectedTime: analysis.selectedTime,
  counterProposedTimes: analysis.counterProposedTimes?.map(t => t.isoTimestamp),
  sentiment: analysis.sentiment,
  confidence: analysis.confidence,
  reasoning: analysis.reasoning,
};
```

#### Step 4: Update handleCounterProposal() to use pre-parsed times

Find `handleCounterProposal()` function. Look for where it calls `extractTimesFromText()` (around lines 484-493).

The counter-proposed times are now already parsed by `analyzeSchedulingResponse()`. Update the function to use them directly instead of calling `extractTimesFromText()`.

Find code like:
```typescript
const extractResult = await extractTimesFromText(email.body || email.bodyPreview, timeContext);
```

Replace with:
```typescript
// Times are already extracted by analyzeSchedulingResponse()
// They come in as analysis.counterProposedTimes from the caller
const counterProposedTimes = analysis.counterProposedTimes || [];

if (counterProposedTimes.length === 0) {
  console.log('[handleCounterProposal] No counter-proposed times found in analysis');
  return await fallbackToHumanReview(request, analysis, 'Could not parse proposed time from response');
}

// Use the first proposed time (already parsed with correct timezone)
const firstProposal = counterProposedTimes[0];
const proposedTimeISO = firstProposal.isoTimestamp || firstProposal;
const proposedDate = new Date(proposedTimeISO);

console.log('[handleCounterProposal] Using parsed time:', {
  description: firstProposal.description,
  iso: proposedTimeISO,
  display: firstProposal.displayText,
});
```

Note: You may need to pass `analysis` to `handleCounterProposal()` if it's not already available. Check the function signature and update accordingly.

#### Step 5: Remove unused imports

Remove or comment out these imports if they're no longer used:
```typescript
// import { detectIntent } from './processors/IntentDetector';
// import { extractTimesFromText } from './core/TimeParser';
```

Keep `parseTime` and `matchToProposedTime` imports if they're used elsewhere.

## Verification

1. Build should pass: `npm run build`
2. Test with this email body:
   - Input: "would Monday at noon work for you?" (with quoted reply chain containing other times)
   - Expected: intent=counter_propose, counterProposedTimes contains Monday at 12:00 PM

3. Check logs show: `[analyzeSchedulingResponse] Loaded prompt, calling AI...`
```

---

## PROMPT 3: Fix Persona Detection (15 minutes)

```
Fix persona detection to use the managed prompt from the database instead of the hardcoded prompt.

## File to Change: src/lib/scheduler/personaEngine.ts

### Step 1: Add import

Add at the top:
```typescript
import { getPromptWithVariables } from '@/lib/ai/promptManager';
```

### Step 2: Update detectPersonaWithAI()

Find the `detectPersonaWithAI()` function (around line 167 where `callAIJson` is called).

Replace the hardcoded prompt with a call to the managed prompt:

```typescript
export async function detectPersonaWithAI(
  contactInfo: {
    name?: string;
    email?: string;
    title?: string;
    company?: string;
    industry?: string;
  },
  communicationHistory?: string
): Promise<{ persona: string; confidence: number; reasoning: string }> {
  try {
    // Load the managed prompt from database
    const promptResult = await getPromptWithVariables('persona_detection', {
      contactName: contactInfo.name || 'Unknown',
      contactEmail: contactInfo.email || '',
      contactTitle: contactInfo.title || 'Unknown',
      companyName: contactInfo.company || 'Unknown',
      industry: contactInfo.industry || 'Unknown',
      communicationHistory: communicationHistory || 'No prior communication history available',
    });

    if (!promptResult || !promptResult.prompt) {
      console.warn('[detectPersonaWithAI] Failed to load persona_detection prompt, using fallback');
      return { persona: 'professional', confidence: 0.5, reasoning: 'Prompt not available, using default' };
    }

    const { data: response } = await callAIJson<{
      persona: string;
      confidence: number;
      reasoning: string;
    }>({
      prompt: promptResult.prompt,
      schema: promptResult.schema || undefined,
      model: (promptResult.model as any) || 'claude-sonnet-4-20250514',
      maxTokens: promptResult.maxTokens || 500,
    });

    return response;
  } catch (err) {
    console.error('[detectPersonaWithAI] Error:', err);
    return { persona: 'professional', confidence: 0.5, reasoning: `Detection failed: ${err}` };
  }
}
```

### Step 3: Remove old hardcoded prompt

Delete the old hardcoded prompt string that was being passed to `callAIJson`.

## Verification

1. Build passes: `npm run build`
2. Check that persona detection still works
3. Logs show prompt being loaded from database
```

---

## PROMPT 4: Fix Meeting Prep Functions (20 minutes)

```
Fix meeting prep functions to use managed prompts from the database.

## Files to Change

### 1. src/lib/commandCenter/meetingPrep.ts

Find `generateMeetingPrep()` function (around line 143 where `callAIJson` is called).

Add import:
```typescript
import { getPromptWithVariables } from '@/lib/ai/promptManager';
```

Update the function to use the managed prompt:

```typescript
// Instead of hardcoded prompt, use:
const promptResult = await getPromptWithVariables('meeting_prep_brief', {
  meetingTitle: meeting.title || 'Meeting',
  meetingTime: meeting.scheduledTime || 'TBD',
  attendees: attendeesList,
  companyName: companyContext?.name || 'Unknown',
  companyIndustry: companyContext?.industry || 'Unknown',
  recentCommunications: recentCommsText,
  dealContext: dealContextText,
});

if (!promptResult || !promptResult.prompt) {
  console.warn('[generateMeetingPrep] Failed to load meeting_prep_brief prompt');
  // Return basic fallback
  return { /* basic meeting prep */ };
}

const { data: response } = await callAIJson<MeetingPrepContent>({
  prompt: promptResult.prompt,
  schema: promptResult.schema || undefined,
  model: (promptResult.model as any) || 'claude-sonnet-4-20250514',
  maxTokens: promptResult.maxTokens || 1500,
});
```

### 2. src/lib/commandCenter/generateMeetingPrep.ts

Find `generateContextAwareMeetingPrep()` function (around line 290).

Add import and update similarly:

```typescript
import { getPromptWithVariables } from '@/lib/ai/promptManager';

// Use the managed prompt
const promptResult = await getPromptWithVariables('command_center_meeting_prep', {
  // ... variables based on what the prompt expects
});
```

### 3. src/lib/scheduler/emailGeneration.ts

Find `generateMeetingPrepBrief()` function (around line 841).

Update to use the managed prompt:

```typescript
const promptResult = await getPromptWithVariables('meeting_prep_brief', {
  // ... appropriate variables
});
```

## Verification

1. Build passes
2. Meeting prep generation still works
3. Logs show prompts being loaded from database
```

---

## PROMPT 5: Fix Entity Matching (15 minutes)

```
Fix entity matching to use the managed prompt from the database.

## File to Change: src/lib/sync/entityMatcher.ts

Find `callAIForMatching()` function (around line 532).

### Step 1: Add import

```typescript
import { getPromptWithVariables } from '@/lib/ai/promptManager';
```

### Step 2: Update the function

Replace the hardcoded prompt with:

```typescript
export async function callAIForMatching(
  entityType: 'company' | 'contact',
  searchTerm: string,
  candidates: Array<{ id: string; name: string; [key: string]: any }>,
  context?: string
): Promise<{ matchedId: string | null; confidence: number; reasoning: string }> {
  try {
    const promptKey = entityType === 'company' ? 'entity_matching' : 'entity_matching';
    
    const promptResult = await getPromptWithVariables(promptKey, {
      entityType,
      searchTerm,
      candidates: JSON.stringify(candidates.slice(0, 10), null, 2), // Limit to top 10
      context: context || 'No additional context',
    });

    if (!promptResult || !promptResult.prompt) {
      console.warn('[callAIForMatching] Failed to load entity_matching prompt');
      return { matchedId: null, confidence: 0, reasoning: 'Prompt not available' };
    }

    const { data: response } = await callAIJson<{
      matchedId: string | null;
      confidence: number;
      reasoning: string;
    }>({
      prompt: promptResult.prompt,
      schema: promptResult.schema || undefined,
      model: (promptResult.model as any) || 'claude-sonnet-4-20250514',
      maxTokens: promptResult.maxTokens || 500,
    });

    return response;
  } catch (err) {
    console.error('[callAIForMatching] Error:', err);
    return { matchedId: null, confidence: 0, reasoning: `Matching failed: ${err}` };
  }
}
```

## Verification

1. Build passes
2. Entity matching still works (test with transcript sync or similar)
```

---

## PROMPT 6: Fix Communication Analysis (15 minutes)

```
Fix communication analysis to use the managed prompt from the database.

## File to Change: src/lib/commandCenter/analyzeCommunication.ts

Find where `callAIJson` is called (around line 123).

### Step 1: Add import

```typescript
import { getPromptWithVariables } from '@/lib/ai/promptManager';
```

### Step 2: Update the analysis function

Replace the hardcoded prompt:

```typescript
const promptResult = await getPromptWithVariables('communication_hub_analysis', {
  communicationType: comm.type || 'email',
  subject: comm.subject || '',
  content: comm.content || comm.content_preview || '',
  sender: comm.from || 'Unknown',
  recipient: comm.to || 'Unknown',
  timestamp: comm.occurred_at || new Date().toISOString(),
});

if (!promptResult || !promptResult.prompt) {
  console.warn('[analyzeCommunication] Failed to load communication_hub_analysis prompt');
  return { /* fallback analysis */ };
}

const { data: result } = await callAIJson<AnalysisResult>({
  prompt: promptResult.prompt,
  schema: promptResult.schema || undefined,
  model: (promptResult.model as any) || 'claude-sonnet-4-20250514',
  maxTokens: promptResult.maxTokens || 1000,
});
```

## Verification

1. Build passes
2. Communication analysis still works
```

---

## PROMPT 7: Cleanup and Verify (15 minutes)

```
Final cleanup and verification of the prompt management remediation.

## Tasks

### 1. Check for remaining hardcoded prompts

Run this command and review results:
```bash
grep -r "callAIJson" src/ --include="*.ts" | grep -v "getPrompt" | grep -v "node_modules"
```

Any results that don't also have a `getPrompt` or `getPromptWithVariables` nearby may still be using hardcoded prompts.

### 2. Verify all key prompt files use the system

Check these files have been updated:
- [ ] src/lib/scheduler/responseProcessor.ts - uses `scheduler_response_parsing`
- [ ] src/lib/scheduler/personaEngine.ts - uses `persona_detection`
- [ ] src/lib/scheduler/emailGeneration.ts - uses `meeting_prep_brief`
- [ ] src/lib/autopilot/needsReplyAutopilot.ts - uses `email_followup_needs_reply`
- [ ] src/lib/autopilot/transcriptAutopilot.ts - uses `email_followup_stalled`
- [ ] src/lib/commandCenter/meetingPrep.ts - uses `meeting_prep_brief`
- [ ] src/lib/commandCenter/generateMeetingPrep.ts - uses `command_center_meeting_prep`
- [ ] src/lib/commandCenter/analyzeCommunication.ts - uses `communication_hub_analysis`
- [ ] src/lib/sync/entityMatcher.ts - uses `entity_matching`

### 3. Build and test

```bash
npm run build
npm run lint
```

Fix any TypeScript or lint errors.

### 4. Add deprecation comments to unused files

In these files, add a comment at the top:

**src/lib/scheduler/processors/IntentDetector.ts:**
```typescript
/**
 * @deprecated Use analyzeSchedulingResponse() in responseProcessor.ts instead.
 * This module used hardcoded prompts. The new approach uses the managed prompt
 * from the database (key: scheduler_response_parsing).
 */
```

**src/lib/scheduler/core/TimeParser.ts:**
```typescript
/**
 * TimeParser utilities for time manipulation.
 * 
 * NOTE: extractTimesFromText() is deprecated for response parsing.
 * Use analyzeSchedulingResponse() in responseProcessor.ts instead,
 * which uses the managed prompt (key: scheduler_response_parsing).
 * 
 * parseTime() and matchToProposedTime() are still used for other purposes.
 */
```

### 5. Document the architecture

Create or update a comment in src/lib/ai/promptManager.ts:

```typescript
/**
 * AI Prompt Manager
 * 
 * ARCHITECTURE: All AI prompts should be stored in the database (ai_prompts table)
 * and loaded via getPrompt() or getPromptWithVariables().
 * 
 * DO NOT add hardcoded prompts directly in callAIJson() calls.
 * Instead:
 * 1. Create the prompt in the UI at /settings/ai-prompts
 * 2. Use getPromptWithVariables('prompt_key', { variables }) to load it
 * 3. Pass the loaded prompt to callAIJson()
 * 
 * This allows prompts to be edited without code deployments.
 */
```

## Final Verification

After all changes:

1. All builds pass
2. Test scheduler response parsing with a counter-proposal email
3. Test autopilot email generation (should not see generic "Thank you" fallback)
4. Check logs show prompts being loaded: "[PromptManager] Loaded prompt..."
```

---

## Execution Order

1. **PROMPT 1** - Autopilot key fixes (quick win, 5 min)
2. **PROMPT 2** - Scheduler response parsing (main bug fix, 45 min)
3. **PROMPT 3** - Persona detection (15 min)
4. **PROMPT 4** - Meeting prep functions (20 min)
5. **PROMPT 5** - Entity matching (15 min)
6. **PROMPT 6** - Communication analysis (15 min)
7. **PROMPT 7** - Cleanup and verify (15 min)

**Total estimated time: ~2-2.5 hours**

## After Each Prompt

Run `npm run build` to verify no TypeScript errors before proceeding to the next prompt.

## Rollback Plan

If something breaks badly, the key files to revert are:
- src/lib/scheduler/responseProcessor.ts
- src/lib/autopilot/needsReplyAutopilot.ts
- src/lib/autopilot/transcriptAutopilot.ts

The other changes are lower risk since they have fallback behavior.
