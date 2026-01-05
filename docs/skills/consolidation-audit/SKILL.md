# X-FORCE Consolidation Audit Skill

> **Version:** 1.0.0  
> **Purpose:** Identify duplicate logic across the codebase and create consolidation plans  
> **Prerequisite:** Documentation audit must be complete (all 7 phases)  
> **Mode:** READ-ONLY — This skill analyzes but NEVER modifies source code

---

## CRITICAL CONSTRAINTS

### 🚫 ABSOLUTE PROHIBITIONS

1. **NEVER modify any source files**
2. **NEVER consolidate code during the audit** — only plan
3. **NEVER assume code is duplicate without evidence**
4. **NEVER recommend deleting without tracing all consumers**

### ✅ REQUIRED BEHAVIORS

1. **ALWAYS read the documentation first** (MANIFEST.md, MODULES.md, API.md)
2. **ALWAYS trace imports before marking something as duplicate**
3. **ALWAYS identify the canonical version before planning migration**
4. **ALWAYS provide a safe migration order**
5. **ALWAYS cite file:line for every duplicate identified**

---

## PREREQUISITE CHECK

Before running this skill, verify:

```
Required files exist:
- /docs/generated/MANIFEST.md ✓
- /docs/generated/DATABASE.md ✓
- /docs/generated/API.md ✓
- /docs/generated/MODULES.md ✓
- /docs/generated/COMPONENTS.md ✓
- /docs/generated/WORKFLOWS.md ✓
```

If any are missing, complete the documentation audit first.

---

## EXECUTION PHASES

### Phase 1: Domain Identification

**Goal:** Identify the major domains/concerns in the codebase

**Steps:**
1. Read MANIFEST.md to get directory structure
2. Read MODULES.md to understand module purposes
3. Identify distinct domains based on:
   - Directory names (scheduler, intelligence, email, etc.)
   - Repeated prefixes in file names
   - Import patterns

**Output:** List of domains to analyze

```markdown
## Identified Domains

| Domain | Primary Location | Suspected Duplicates |
|--------|------------------|---------------------|
| Scheduler | src/lib/scheduler/ | src/lib/ai/, api/meetings/, components/scheduler/ |
| Entity Matching | src/lib/intelligence/entityMatcher.ts | src/lib/ai/, api/tasks/ |
| Email Sending | src/lib/email/ | src/lib/microsoft/, api/communications/ |
| Context Building | src/lib/intelligence/contextFirstPipeline.ts | src/lib/commandCenter/ |
```

**Checkpoint:** Confirm domains with user before proceeding.

---

### Phase 2: Domain Deep Dive (Per Domain)

**Goal:** For each domain, find ALL code that implements that domain's logic

**Steps for each domain:**

1. **Keyword Search**
   - Search for domain-specific function names
   - Search for domain-specific type names
   - Search for domain-specific table names

2. **Import Tracing**
   - Find the primary module for this domain
   - Find everything that imports from it
   - Find files that SHOULD import but implement their own logic

3. **Pattern Matching**
   - Look for similar function signatures
   - Look for similar database queries
   - Look for similar API calls

**Evidence Format:**
```markdown
### Scheduler Domain Analysis

#### Primary Module: src/lib/scheduler/

**Core Functions:**
| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| createSchedulingRequest | createRequest.ts | 45-120 | Creates new scheduling requests |
| processResponse | responseProcessor.ts | 30-150 | Handles attendee responses |
| checkAvailability | availability.ts | 20-80 | Queries calendar availability |
| sendSchedulerEmail | emailSender.ts | 25-100 | Sends scheduling emails |

#### Duplicate Implementations Found:

**Duplicate #1: src/lib/ai/meetingScheduler.ts**
```
Lines 45-120: createMeetingRequest()
- Similar to: scheduler/createRequest.ts:createSchedulingRequest()
- Difference: Uses older API format, missing timezone handling
- Evidence: Both query scheduler_requests table, both call Microsoft Graph
```

**Duplicate #2: src/app/api/meetings/direct-book/route.ts**
```
Lines 25-80: Inline scheduling logic
- Similar to: scheduler/createRequest.ts + scheduler/emailSender.ts
- Difference: Hardcoded email template, no audit logging
- Evidence: Same database inserts, same Graph API calls
```

**Duplicate #3: src/components/scheduler/SchedulerModal.tsx**
```
Lines 50-150: Client-side scheduling logic
- Similar to: scheduler/availability.ts
- Difference: Makes direct API calls instead of using lib
- Evidence: Duplicates availability checking logic
```
```

**Checkpoint:** Review findings for each domain before proceeding to next.

---

### Phase 3: Canonical Version Selection

**Goal:** For each domain, identify which implementation should be the "source of truth"

**Selection Criteria:**
1. **Most Complete** — Handles the most edge cases
2. **Most Recent** — Has latest bug fixes and features
3. **Most Imported** — Already used by most consumers
4. **Best Tested** — Has associated test files
5. **Best Located** — In the logical place (src/lib/{domain}/)

**Output Format:**
```markdown
### Scheduler: Canonical Version Selection

#### Candidates:

| Location | Completeness | Recency | Imports | Tests | Score |
|----------|--------------|---------|---------|-------|-------|
| src/lib/scheduler/ | 95% | Dec 2024 | 12 files | Yes | ⭐ CANONICAL |
| src/lib/ai/meetingScheduler.ts | 60% | Oct 2024 | 3 files | No | Migrate away |
| api/meetings/direct-book | 40% | Nov 2024 | 0 (inline) | No | Migrate away |
| components/scheduler/ | 30% | Sep 2024 | 0 (client) | No | Migrate away |

#### Decision: src/lib/scheduler/ is canonical

**Reasoning:**
- Most complete implementation (95% of functionality)
- Most recently updated with bug fixes
- Already imported by 12 other files
- Has test coverage in scripts/test-scheduler.ts
- Located in the expected place for a core lib module

#### Functions to Expose:
| Function | Current Location | Should Be |
|----------|------------------|-----------|
| createSchedulingRequest | scheduler/createRequest.ts:45 | ✓ Already exported |
| processResponse | scheduler/responseProcessor.ts:30 | ✓ Already exported |
| checkAvailability | scheduler/availability.ts:20 | ✓ Already exported |
| sendSchedulerEmail | scheduler/emailSender.ts:25 | ⚠️ Not exported - add to index.ts |

#### Missing from Canonical (found in duplicates):
| Feature | Found In | Should Add |
|---------|----------|------------|
| Direct booking shortcut | api/meetings/direct-book:40 | Yes - useful feature |
| Client-side validation | components/scheduler:80 | No - keep server-side |
```

---

### Phase 4: Consumer Mapping

**Goal:** For each duplicate, identify everything that depends on it

**Steps:**
1. Search for imports of the duplicate file
2. Search for calls to the duplicate functions
3. Identify transitive dependencies

**Output Format:**
```markdown
### Consumers of src/lib/ai/meetingScheduler.ts

#### Direct Imports (3 files):
| File | Import | Lines Using |
|------|--------|-------------|
| src/app/api/ai/schedule/route.ts | { createMeetingRequest } | 25, 45, 67 |
| src/lib/commandCenter/scheduleAction.ts | { createMeetingRequest } | 30-50 |
| src/components/ai/AIScheduler.tsx | { createMeetingRequest } | 80-120 |

#### Migration Impact:
- 3 files need import changes
- ~15 lines of code reference this function
- Risk: LOW (straightforward import swap)

### Consumers of Inline Logic in api/meetings/direct-book/route.ts

#### Direct Consumers:
| Consumer | How Used |
|----------|----------|
| Frontend: /meetings/book page | Calls POST /api/meetings/direct-book |
| Component: QuickBookButton.tsx | Calls POST /api/meetings/direct-book |

#### Migration Impact:
- API contract must stay the same (POST /api/meetings/direct-book)
- Internal implementation changes to use canonical scheduler
- Risk: LOW (external interface unchanged)
```

---

### Phase 5: Migration Plan Generation

**Goal:** Create a safe, ordered plan for consolidating to canonical versions

**Ordering Principles:**
1. **Leaf nodes first** — Migrate files with no dependents first
2. **Test coverage** — Migrate tested code before untested
3. **Risk isolation** — One domain at a time
4. **Rollback points** — Natural breaks where you can stop

**Output Format:**
```markdown
# Scheduler Consolidation Plan

## Overview
- Canonical Module: src/lib/scheduler/
- Duplicates to Remove: 4
- Files to Modify: 7
- Estimated Effort: 2-3 hours
- Risk Level: MEDIUM

---

## Pre-Migration Checklist
- [ ] All tests passing on current code
- [ ] Canonical module exports all needed functions
- [ ] Backup/branch created

---

## Migration Steps

### Step 1: Export missing functions from canonical
**File:** src/lib/scheduler/index.ts
**Action:** Add export for sendSchedulerEmail
**Risk:** NONE (additive change)
**Test:** Verify import works from another file

### Step 2: Migrate src/lib/commandCenter/scheduleAction.ts
**Current:**
```typescript
import { createMeetingRequest } from '@/lib/ai/meetingScheduler';
```
**Change to:**
```typescript
import { createSchedulingRequest } from '@/lib/scheduler';
```
**Lines to update:** 30, 35, 42
**Risk:** LOW
**Test:** Run command center scheduling flow

### Step 3: Migrate src/app/api/ai/schedule/route.ts
**Current:**
```typescript
import { createMeetingRequest } from '@/lib/ai/meetingScheduler';
```
**Change to:**
```typescript
import { createSchedulingRequest } from '@/lib/scheduler';
```
**Lines to update:** 25, 45, 67
**Risk:** LOW
**Test:** POST /api/ai/schedule with test payload

### Step 4: Migrate src/components/ai/AIScheduler.tsx
**Current:**
```typescript
import { createMeetingRequest } from '@/lib/ai/meetingScheduler';
```
**Change to:**
```typescript
import { createSchedulingRequest } from '@/lib/scheduler';
```
**Lines to update:** 80, 95, 110
**Risk:** LOW
**Test:** UI flow for AI scheduling

### Step 5: Refactor api/meetings/direct-book/route.ts
**Current:** 55 lines of inline scheduling logic
**Change to:**
```typescript
import { createSchedulingRequest, sendSchedulerEmail } from '@/lib/scheduler';

export async function POST(req: Request) {
  const params = await req.json();
  const request = await createSchedulingRequest(params);
  await sendSchedulerEmail(request);
  return NextResponse.json({ success: true, requestId: request.id });
}
```
**Risk:** MEDIUM (logic replacement, not just import)
**Test:** Full direct-book flow end-to-end

### Step 6: Delete src/lib/ai/meetingScheduler.ts
**Pre-condition:** Steps 2-4 complete and tested
**Action:** Delete file
**Verify:** `grep -r "meetingScheduler" src/` returns nothing
**Risk:** LOW (if preconditions met)

### Step 7: Refactor components/scheduler/SchedulerModal.tsx
**Current:** Client-side availability logic
**Change to:** Call /api/scheduler/availability endpoint
**Risk:** MEDIUM (changes data flow)
**Test:** UI availability checking

---

## Post-Migration Checklist
- [ ] All tests passing
- [ ] No imports of deleted files remain
- [ ] Canonical module is single source of truth
- [ ] Documentation updated (MODULES.md)

---

## Rollback Plan
If issues arise:
1. Revert to pre-migration branch
2. Specific step failed? Revert only that file
3. Keep deleted files in git history for 30 days
```

---

### Phase 6: Generate Migration Scripts (Optional)

**Goal:** Create executable scripts to assist with migration

**Scripts to Generate:**

```bash
# scripts/consolidation/find-duplicate-imports.sh
# Finds all imports of duplicate modules

grep -rn "from.*meetingScheduler" src/
grep -rn "from.*ai/schedule" src/

# scripts/consolidation/verify-no-duplicates.sh  
# Verifies duplicates are fully removed

DUPLICATES=(
  "meetingScheduler"
  "scheduleHelper"
  "oldScheduler"
)

for dup in "${DUPLICATES[@]}"; do
  result=$(grep -rn "$dup" src/)
  if [ -n "$result" ]; then
    echo "❌ Found remaining reference to $dup:"
    echo "$result"
  else
    echo "✓ $dup fully removed"
  fi
done
```

---

## OUTPUT FILES

After running this skill, you'll have:

```
/docs/generated/consolidation/
├── DOMAIN-ANALYSIS.md       # All domains identified with duplicates
├── SCHEDULER-PLAN.md        # Detailed plan for scheduler consolidation
├── ENTITY-MATCHING-PLAN.md  # Detailed plan for entity matching consolidation
├── EMAIL-PLAN.md            # Detailed plan for email consolidation
├── [DOMAIN]-PLAN.md         # One file per domain
├── MIGRATION-ORDER.md       # Which domains to consolidate first
└── DEPENDENCY-MAP.md        # Full dependency graph

/scripts/consolidation/
├── find-duplicate-imports.sh
├── verify-no-duplicates.sh
└── update-imports.sh        # Helper for bulk import updates
```

---

## INVOCATION

### Full Consolidation Audit
```
Run consolidation audit.
Prerequisites: Documentation audit complete.
Analyze all domains and generate migration plans.
```

### Single Domain Analysis
```
Run consolidation audit for scheduler domain only.
Find all scheduler-related code and create consolidation plan.
```

### Quick Duplicate Scan
```
Scan for duplicate logic across the codebase.
Don't generate full migration plans, just identify duplicates.
```

---

## CHECKPOINTS

1. **After Phase 1:** Confirm identified domains are correct
2. **After Phase 2 (each domain):** Review duplicate findings
3. **After Phase 3:** Confirm canonical version selection
4. **After Phase 4:** Review consumer mapping for accuracy
5. **After Phase 5:** Approve migration plan before any execution

---

## ANTI-PATTERNS TO AVOID

### ❌ DON'T: Assume similarity from names
```
# Bad
meetingScheduler.ts and scheduler/ are duplicates because names are similar

# Good
meetingScheduler.ts:createMeetingRequest (lines 45-80) duplicates
scheduler/createRequest.ts:createSchedulingRequest (lines 30-65)
Evidence: Both insert into scheduler_requests table (line 52 vs line 40)
Evidence: Both call Graph API /calendar/events (line 70 vs line 58)
```

### ❌ DON'T: Recommend deletion without consumer check
```
# Bad
Delete src/lib/ai/meetingScheduler.ts - it's a duplicate

# Good  
Delete src/lib/ai/meetingScheduler.ts AFTER:
- Migrating src/app/api/ai/schedule/route.ts (imports this)
- Migrating src/lib/commandCenter/scheduleAction.ts (imports this)
- Migrating src/components/ai/AIScheduler.tsx (imports this)
- Verifying: grep -r "meetingScheduler" src/ returns nothing
```

### ❌ DON'T: Consolidate during audit
```
# Bad
I've updated the imports in these 5 files to use the canonical scheduler...

# Good
Migration Plan Step 3: Update imports in these 5 files
[Details of what to change]
Execute this step manually after reviewing the plan.
```

---

## INTEGRATION WITH DOCUMENTATION AUDIT

This skill reads from documentation audit outputs:

| This Skill Needs | From Documentation Audit |
|------------------|-------------------------|
| File list | MANIFEST.md |
| Module exports | MODULES.md |
| Import dependencies | MODULES.md |
| API route structure | API.md |
| Component dependencies | COMPONENTS.md |
| Data flow | WORKFLOWS.md |

If documentation is outdated, re-run relevant documentation phases first.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
