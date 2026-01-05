# X-FORCE Bug Investigation Skill

> **Version:** 1.0.0  
> **Purpose:** Systematically trace and diagnose bugs using documentation and code analysis  
> **Prerequisite:** Documentation audit should be complete for best results  
> **Mode:** READ-ONLY investigation, suggests fixes but does NOT auto-apply

---

## CRITICAL CONSTRAINTS

### 🚫 ABSOLUTE PROHIBITIONS

1. **NEVER modify source code during investigation**
2. **NEVER guess at causes without evidence**
3. **NEVER skip the data flow trace**
4. **NEVER assume the bug is where the error appears**

### ✅ REQUIRED BEHAVIORS

1. **ALWAYS start by understanding the symptom clearly**
2. **ALWAYS trace the full data flow**
3. **ALWAYS cite file:line for every finding**
4. **ALWAYS check for related issues in the same flow**
5. **ALWAYS provide reproducibility steps when possible**

---

## INVESTIGATION PHASES

### Phase 1: Symptom Capture

**Goal:** Fully understand what's happening before investigating

**Gather from user:**
```markdown
## Bug Report

### What's happening?
[User description of the bug]

### What should happen?
[Expected behavior]

### Error message (if any):
[Exact error text, stack trace]

### Where does it happen?
- [ ] UI - which page/component?
- [ ] API - which endpoint?
- [ ] Background job - which cron/webhook?
- [ ] Database - which operation?

### Reproducibility:
- [ ] Always happens
- [ ] Sometimes happens (when? pattern?)
- [ ] Happened once

### Recent changes:
[Any deployments, data changes, or config changes?]
```

**Output:** Structured bug report to reference during investigation

---

### Phase 2: Entry Point Identification

**Goal:** Find where in the code this bug would originate

**Steps:**

1. **If UI bug:**
   - Check COMPONENTS.md for the component
   - Find which API endpoints it calls
   - Identify state management involved

2. **If API bug:**
   - Check API.md for the endpoint
   - Find the route handler file
   - Identify which lib modules it uses

3. **If background job bug:**
   - Check SCRIPTS.md or cron documentation
   - Find the job entry point
   - Identify triggered workflows

4. **If data bug:**
   - Check DATABASE.md for table schema
   - Find which modules write to this table
   - Check for triggers/RLS policies

**Output:**
```markdown
## Entry Point

**Type:** [UI / API / Background / Data]
**File:** [path/to/file.ts]
**Function:** [functionName] (line X)

**This is where the flow starts for this bug.**
```

---

### Phase 3: Data Flow Trace

**Goal:** Follow the data from entry to where the bug manifests

**Using documentation:**
1. Read WORKFLOWS.md for relevant flow diagrams
2. Read MODULES.md for function dependencies
3. Read API.md for request/response shapes

**Trace format:**
```markdown
## Data Flow Trace

### Step 1: Entry
**File:** src/app/api/scheduler/requests/route.ts
**Function:** POST handler (line 25)
**Input:** { attendees, proposedTimes, meetingType }
**Calls:** createSchedulingRequest() from @/lib/scheduler

### Step 2: Request Creation  
**File:** src/lib/scheduler/createRequest.ts
**Function:** createSchedulingRequest (line 45)
**Input:** SchedulingRequestParams
**Does:** 
  - Validates input (line 50-65)
  - Creates DB record (line 70-85)
  - Triggers email send (line 90)
**Calls:** sendSchedulerEmail() from @/lib/scheduler

### Step 3: Email Send
**File:** src/lib/scheduler/emailSender.ts
**Function:** sendSchedulerEmail (line 30)
**Input:** SchedulingRequest
**Does:**
  - Builds email template (line 40-60)
  - Calls Microsoft Graph API (line 65)
  - Records activity (line 80)
**⚠️ BUG LIKELY HERE:** [if identified]

[Continue until end of flow or bug location found]
```

---

### Phase 4: Hypothesis Formation

**Goal:** Form specific, testable hypotheses about the bug cause

**For each hypothesis:**
```markdown
## Hypothesis 1: [Brief description]

**Theory:** [What you think is happening]

**Evidence for:**
- [Code observation with file:line]
- [Behavior that supports this]

**Evidence against:**
- [Anything that contradicts this]

**Test:** [How to confirm or rule out]

**Confidence:** [HIGH / MEDIUM / LOW]
```

**Common bug patterns to check:**

1. **Race condition** - Async operations completing out of order
2. **Missing null check** - Assuming data exists when it might not
3. **Stale data** - Using cached/old data instead of fresh
4. **Wrong scope** - Variable shadowing or closure issues
5. **Type mismatch** - Runtime type different from TypeScript type
6. **Missing error handling** - Unhandled promise rejection or try/catch gap
7. **Database constraint** - RLS policy blocking, FK violation
8. **External API failure** - Microsoft Graph, Claude API, etc.

---

### Phase 5: Code Inspection

**Goal:** Examine the specific code sections identified

**For each suspect location:**
```markdown
## Inspection: [file:function]

**File:** src/lib/scheduler/emailSender.ts
**Lines:** 65-80

**Code:**
```typescript
// Line 65-80
const response = await graphClient
  .api('/me/sendMail')
  .post({ message: emailPayload });

// No error handling here!
await supabase
  .from('activities')
  .insert({ type: 'email_sent', ... });
```

**Issues Found:**
1. **Line 65-70:** No try/catch around Graph API call
   - If Graph fails, activity still tries to insert
   - Error propagates up without context

2. **Line 75-80:** No check on response status
   - Assumes success without verification
   - Could record "sent" when it wasn't

**Related Code:**
- Error handling pattern at src/lib/microsoft/calendar.ts:45 (correct)
- Similar issue at src/lib/email/sender.ts:30 (same bug!)
```

---

### Phase 6: Root Cause Determination

**Goal:** Identify the definitive root cause

```markdown
## Root Cause

**Location:** src/lib/scheduler/emailSender.ts:65-80

**Problem:** Missing error handling around Microsoft Graph API call

**Why this causes the symptom:**
1. User requests meeting scheduling
2. Request created successfully in DB
3. Email send attempted but Graph API returns 429 (rate limited)
4. Error not caught, promise rejects
5. Activity insert never runs
6. Error bubbles up to API route
7. API returns 500 to frontend
8. User sees "scheduling failed" but request exists in DB
9. Retry creates duplicate request

**Why it wasn't caught before:**
- Happy path tests don't mock Graph failures
- Error only happens under load
- Rate limiting is intermittent

**Confidence:** HIGH (reproduced locally with mock failure)
```

---

### Phase 7: Fix Recommendation

**Goal:** Provide specific, actionable fix

```markdown
## Recommended Fix

### Primary Fix

**File:** src/lib/scheduler/emailSender.ts
**Lines:** 65-80

**Current code:**
```typescript
const response = await graphClient
  .api('/me/sendMail')
  .post({ message: emailPayload });

await supabase
  .from('activities')
  .insert({ type: 'email_sent', ... });
```

**Fixed code:**
```typescript
try {
  const response = await graphClient
    .api('/me/sendMail')
    .post({ message: emailPayload });
  
  if (!response.ok) {
    throw new Error(`Graph API error: ${response.status}`);
  }
  
  await supabase
    .from('activities')
    .insert({ type: 'email_sent', status: 'success', ... });
    
} catch (error) {
  // Record failed attempt
  await supabase
    .from('activities')
    .insert({ type: 'email_sent', status: 'failed', error: error.message, ... });
  
  // Re-throw with context
  throw new SchedulerEmailError('Failed to send scheduling email', { cause: error });
}
```

### Secondary Fixes (same pattern elsewhere)

| File | Lines | Same Issue |
|------|-------|------------|
| src/lib/email/sender.ts | 30-45 | Missing Graph error handling |
| src/lib/microsoft/calendar.ts | 90-100 | Missing error handling |

### Test to Add

**File:** scripts/test-scheduler-email.ts (new)
```typescript
it('handles Graph API failure gracefully', async () => {
  // Mock Graph to return 429
  mockGraph.post.mockRejectedValue(new Error('Rate limited'));
  
  await expect(sendSchedulerEmail(request))
    .rejects.toThrow(SchedulerEmailError);
  
  // Verify failure was recorded
  const activity = await getLatestActivity(request.id);
  expect(activity.status).toBe('failed');
});
```

### Verification Steps

After applying fix:
1. [ ] Run existing tests - should still pass
2. [ ] Run new failure test - should pass
3. [ ] Manual test: Send scheduling email (happy path)
4. [ ] Manual test: Disable network, attempt send, verify graceful failure
5. [ ] Deploy to staging
6. [ ] Monitor for 24 hours
```

---

### Phase 8: Related Issues Check

**Goal:** Find other places with the same bug pattern

```markdown
## Related Issues Scan

**Pattern:** Missing error handling around external API calls

**Search:** Looked for all `graphClient.api` and `fetch` calls without try/catch

**Found:**

| File | Line | Risk | Same Pattern? |
|------|------|------|---------------|
| src/lib/microsoft/calendar.ts | 90 | HIGH | ✓ Yes |
| src/lib/email/sender.ts | 30 | HIGH | ✓ Yes |
| src/lib/fireflies/sync.ts | 45 | MEDIUM | ✓ Yes |
| src/lib/intelligence/research.ts | 120 | LOW | ✓ Yes |

**Recommendation:** Fix all 4 in same PR to prevent similar bugs
```

---

## OUTPUT FORMAT

After investigation, provide:

```markdown
# Bug Investigation Report

**Bug:** [One-line description]
**Reported:** [Date]
**Severity:** [CRITICAL / HIGH / MEDIUM / LOW]
**Status:** Root cause identified

## Summary

[2-3 sentence summary of the bug and fix]

## Root Cause

**File:** [path]
**Line:** [number]
**Issue:** [description]

## Data Flow

[Mermaid diagram of the flow with bug location marked]

## Fix

[Code changes required with before/after]

## Testing

[How to verify the fix]

## Related Issues

[Other places with same pattern]

## Prevention

[How to prevent similar bugs in future]
```

---

## INVOCATION

### Standard Investigation

```
User: Investigate bug: [description]

Claude: [Executes all 8 phases]
        [Produces investigation report]
```

### Quick Trace

```
User: Trace the data flow for [feature/endpoint]

Claude: [Executes Phases 2-3 only]
        [Produces flow diagram]
```

### Error Analysis

```
User: What could cause this error: [error message/stack trace]

Claude: [Focuses on error interpretation]
        [Identifies likely locations]
        [Suggests inspection points]
```

### Pattern Search

```
User: Find all places with [bug pattern]

Claude: [Searches codebase for pattern]
        [Lists all occurrences with risk level]
```

---

## USING DOCUMENTATION

The investigation uses your generated docs:

| Doc | Used For |
|-----|----------|
| MANIFEST.md | Finding files, understanding structure |
| MODULES.md | Understanding function signatures, dependencies |
| API.md | Tracing API request/response flows |
| COMPONENTS.md | Understanding UI data flow |
| WORKFLOWS.md | Following end-to-end processes |
| DATABASE.md | Understanding data relationships |
| DEPENDENCY-MAP.md | Tracing module relationships |

**If documentation is missing or outdated:**
1. Note the gap
2. Read source code directly
3. Recommend updating docs after fix

---

## COMMON INVESTIGATION PATTERNS

### Pattern: "It works sometimes"

**Check:**
1. Race conditions in async code
2. Caching with stale data
3. External API rate limits
4. Database connection pooling issues
5. Time-based logic (timezones, DST)

### Pattern: "It broke after deploy"

**Check:**
1. Environment variable changes
2. Database migration issues
3. New dependency versions
4. Changed external API behavior
5. Feature flag states

### Pattern: "Works locally, fails in production"

**Check:**
1. Environment differences (env vars, URLs)
2. Database differences (data volume, indexes)
3. Network differences (timeouts, firewalls)
4. Authentication differences (tokens, permissions)

### Pattern: "User reports X but I can't reproduce"

**Check:**
1. User's specific data state
2. User's permissions/role
3. Browser/client differences
4. Timing-specific conditions
5. Multi-user interaction effects

---

## ANTI-PATTERNS TO AVOID

### ❌ DON'T: Jump to conclusions

```
# Bad
User: Emails sending twice
Claude: The problem is in emailSender.ts, here's the fix...

# Good
User: Emails sending twice
Claude: Let me trace the email flow to find where duplication occurs...
[Traces through scheduler → emailSender → Graph API → webhook → ...]
The duplication happens because the webhook also triggers an email...
```

### ❌ DON'T: Fix without understanding

```
# Bad
"Add a check for null here and it should work"

# Good
"The null occurs because X doesn't return contact data when Y. 
Adding a null check here would mask the symptom but the real fix 
is ensuring X always returns complete data at [file:line]"
```

### ❌ DON'T: Ignore related issues

```
# Bad
"Fixed the bug in emailSender.ts"

# Good
"Fixed in emailSender.ts. Found same pattern in 3 other files - 
recommend fixing all to prevent similar bugs"
```

---

## CHECKPOINTS

1. **After Phase 1:** Confirm understanding of symptom with user
2. **After Phase 3:** Review data flow trace - is it complete?
3. **After Phase 4:** Validate hypotheses before deep inspection
4. **After Phase 6:** Confirm root cause with user before suggesting fix
5. **After Phase 7:** Review fix for completeness and side effects

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
