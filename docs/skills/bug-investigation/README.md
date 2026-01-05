# X-FORCE Bug Investigation Skill

> Systematically trace and diagnose bugs using documentation and code analysis.

---

## The Problem This Solves

When bugs happen, the instinct is to jump to where the error appears and start guessing. This leads to:
- Fixing symptoms instead of root causes
- Missing related issues with the same pattern
- Incomplete fixes that break again later
- Wasted time going in circles

This skill enforces a systematic investigation process that:
- Traces the full data flow
- Forms and tests hypotheses
- Identifies the actual root cause
- Finds related issues
- Recommends complete fixes

---

## Prerequisites

Works best with completed documentation audit:
- MODULES.md - Function signatures and dependencies
- API.md - Endpoint request/response flows
- WORKFLOWS.md - End-to-end data flows
- DATABASE.md - Table relationships

Can still investigate without docs, but will be slower.

---

## Installation

### Step 1: Create skill directory

```bash
mkdir -p docs/skills/bug-investigation
```

### Step 2: Copy skill files

Copy to `docs/skills/bug-investigation/`:
- SKILL.md
- TEMPLATES.md
- CLAUDE-MD-INSTRUCTIONS.md

### Step 3: Update CLAUDE.md

Add content from CLAUDE-MD-INSTRUCTIONS.md to your CLAUDE.md.

### Step 4: Create investigations directory

```bash
mkdir -p docs/investigations
```

---

## Usage

### Full Investigation

```
Investigate bug: [description]
```

Runs all 8 phases, produces complete investigation report.

### Quick Trace

```
Trace the [feature] flow
```

Maps data flow without investigating bugs. Useful for understanding code.

### Error Analysis

```
What causes this error:
[paste error message or stack trace]
```

Parses error, traces backwards to root cause.

### Pattern Search

```
Find all places with [pattern]
```

Searches for bug patterns across codebase.

---

## The 8 Phases

| Phase | Goal | Output |
|-------|------|--------|
| 1. Symptom Capture | Understand what's happening | Structured bug report |
| 2. Entry Point | Find where flow starts | File/function identified |
| 3. Data Flow Trace | Follow the data | Mermaid diagram + steps |
| 4. Hypothesis Formation | Form testable theories | Ranked hypotheses |
| 5. Code Inspection | Examine suspect code | Findings with citations |
| 6. Root Cause | Determine definitive cause | Root cause statement |
| 7. Fix Recommendation | Suggest specific fix | Before/after code |
| 8. Related Issues | Find same pattern | List of related locations |

---

## Output

Investigation reports are saved to `/docs/investigations/`:

```
docs/investigations/
├── BUG-2025-01-15-001-scheduler-duplicate-emails.md
├── BUG-2025-01-16-002-entity-matching-null.md
└── ...
```

Each report includes:
- Executive summary
- Data flow diagram
- Root cause with evidence
- Recommended fix with code
- Related issues list
- Prevention recommendations

---

## Common Bug Patterns

The skill knows to check for these common patterns:

| Symptom | Check For |
|---------|-----------|
| Works sometimes | Race conditions, caching, rate limits |
| Broke after deploy | Env vars, migrations, dependencies |
| Works locally only | Env differences, data volume, auth |
| Can't reproduce | User data state, permissions, timing |
| Duplicate actions | Webhook + polling, missing idempotency |
| Missing data | RLS policies, FK constraints, null handling |
| Wrong data | Type coercion, timezone issues, stale cache |

---

## Integration

### With Documentation Audit

If investigation reveals outdated docs:
```
Update documentation for src/lib/scheduler/
```

### With Consolidation Audit

If investigation finds duplicate code causing bugs:
```
Analyze scheduler for duplicates
```

### With Testing

After fix, ensure coverage:
```
Generate tests for src/lib/scheduler/emailSender.ts
```

---

## Example

```
User: Investigate bug: Users getting "scheduling failed" but meetings appear

Claude: [Phase 1] Let me understand the symptom...
        - Error shows but meeting is created
        - Suggests success path completes but error handling is wrong

        [Phase 2-3] Entry point is POST /api/scheduler/requests
        [Traces through createRequest → sendEmail → Graph API]
        
        [Phase 4] Hypotheses:
        1. Error thrown after successful creation (HIGH)
        2. Retry creates duplicate then fails (MEDIUM)
        
        [Phase 5] Inspecting emailSender.ts:65-80...
        Found: No try/catch around Graph API call
        
        [Phase 6] Root Cause:
        Graph API succeeds but response parsing fails
        Error bubbles up after DB commit
        User sees error, but meeting exists
        
        [Phase 7] Fix: Add try/catch, check response before throwing
        [Shows before/after code]
        
        [Phase 8] Same pattern in 3 other files
        [Lists locations]
        
        Report saved to: docs/investigations/BUG-2025-01-15-001.md
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
