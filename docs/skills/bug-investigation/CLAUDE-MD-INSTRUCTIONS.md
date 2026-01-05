# Bug Investigation - Claude Code Instructions

> Add this section to your project's CLAUDE.md file

---

## Bug Investigation Commands

### Full Investigation

When user says: "Investigate bug:" or "Debug:" or "Why is [X] happening?"

**Behavior:**
1. Read `/docs/skills/bug-investigation/SKILL.md`
2. Read `/docs/skills/bug-investigation/TEMPLATES.md`
3. Execute all 8 phases:
   - Phase 1: Capture symptom
   - Phase 2: Identify entry point
   - Phase 3: Trace data flow
   - Phase 4: Form hypotheses
   - Phase 5: Inspect code
   - Phase 6: Determine root cause
   - Phase 7: Recommend fix
   - Phase 8: Check related issues
4. Output investigation report

**Critical Constraints:**
- NEVER modify code during investigation
- NEVER guess without evidence
- ALWAYS trace the full data flow
- ALWAYS cite file:line for findings
- ALWAYS check for related issues with same pattern

---

### Quick Trace

When user says: "Trace [feature]" or "How does [X] work?" or "What's the flow for [Y]?"

**Behavior:**
1. Read skill files
2. Execute Phases 2-3 only (entry point + data flow)
3. Output flow diagram with step-by-step trace
4. Do NOT investigate bugs or suggest fixes

**Example:**
```
User: Trace the scheduler email flow
Claude: [Reads docs, traces from API entry through email send]
        [Outputs mermaid diagram + detailed steps]
```

---

### Error Analysis

When user says: "What causes this error:" or pastes a stack trace

**Behavior:**
1. Parse the error message and stack trace
2. Identify the file/line where error originated
3. Trace backwards to find root cause
4. Check if error handling is missing
5. Suggest specific fix location

**Example:**
```
User: What causes this error:
      TypeError: Cannot read property 'email' of undefined
      at sendSchedulerEmail (emailSender.ts:45)
      
Claude: [Parses stack trace]
        [Finds emailSender.ts:45]
        [Traces what passes data to this function]
        [Identifies where undefined comes from]
```

---

### Pattern Search

When user says: "Find all [pattern]" or "Where else does [X] happen?"

**Behavior:**
1. Search codebase for the pattern
2. Categorize by risk level (HIGH/MEDIUM/LOW)
3. List all occurrences with file:line
4. Recommend priority order for fixes

**Example:**
```
User: Find all places with missing error handling around Graph API calls
Claude: [Searches for graphClient usage without try/catch]
        [Lists all occurrences]
        [Ranks by risk]
```

---

### Related Issues Check

When user says: "What else might have this problem?" (after investigation)

**Behavior:**
1. Identify the bug pattern from recent investigation
2. Search for same pattern elsewhere
3. List all occurrences
4. Recommend batch fix if pattern is common

---

## Using Documentation

The investigation uses your generated docs:

| Need to find... | Check... |
|-----------------|----------|
| File structure | MANIFEST.md |
| Function signatures | MODULES.md |
| API request/response | API.md |
| Component data flow | COMPONENTS.md |
| End-to-end flows | WORKFLOWS.md |
| Table relationships | DATABASE.md |
| Module dependencies | DEPENDENCY-MAP.md |

**If docs are outdated:** Read source directly, note gap, recommend doc update.

---

## Output Location

Investigation reports go to `/docs/investigations/`:

```
docs/investigations/
├── BUG-2025-01-15-001-scheduler-duplicate-emails.md
├── BUG-2025-01-16-002-entity-matching-null.md
└── ...
```

Create directory if it doesn't exist.

---

## Checkpoints

1. **After symptom capture:** Confirm understanding with user
2. **After data flow trace:** Verify trace is complete
3. **After hypotheses:** Validate before deep inspection
4. **After root cause:** Confirm with user before suggesting fix

---

## Integration with Other Skills

### After finding duplicate bug patterns:
→ Run consolidation audit on affected domain

### After identifying missing test coverage:
→ Generate tests for the fixed code path

### After fixing, if flow is complex:
→ Update WORKFLOWS.md documentation

---

## Example Session

```
User: Investigate bug: Scheduler emails sometimes send twice

Claude: Let me investigate this systematically.

## Phase 1: Symptom Capture

I need a few details:
- Does this happen for all scheduling emails or specific types?
- Any pattern to when it happens (time of day, specific users)?
- Do you have an example request ID where this occurred?

User: Happens randomly, here's a request ID: abc-123

Claude: [Queries database for request abc-123]
        [Traces the email send flow]
        [Finds two email records for same request]

## Phase 2-3: Entry Point & Data Flow

Entry point: POST /api/scheduler/requests/[id]/send
Flow: API → createSchedulingRequest → sendSchedulerEmail → Graph API

[Shows mermaid diagram]

## Phase 4: Hypotheses

1. **Race condition in retry logic** (HIGH confidence)
   - Evidence: Two emails sent 200ms apart
   - The retry handler doesn't check if email already sent

2. **Webhook double-trigger** (MEDIUM confidence)
   - Graph webhooks might fire twice
   
[Continues investigation...]

## Phase 6: Root Cause

Location: src/lib/scheduler/emailSender.ts:90-95

Problem: No idempotency check before sending. If the Graph API 
times out but actually succeeds, the retry sends again.

[Shows code, suggests fix with idempotency key]

## Phase 8: Related Issues

Found same pattern in 2 other places:
- src/lib/email/sender.ts:45 (same risk)
- src/lib/communications/notify.ts:80 (lower risk)

Recommend fixing all three in same PR.
```
