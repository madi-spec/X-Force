# Consolidation Audit - Claude Code Instructions

> Add this section to your project's CLAUDE.md file

---

## Consolidation Audit Commands

### Prerequisites Check

Before running consolidation audit, verify documentation exists:

```
Check if documentation audit is complete.
Required files:
- /docs/generated/MANIFEST.md
- /docs/generated/DATABASE.md
- /docs/generated/API.md
- /docs/generated/MODULES.md
- /docs/generated/COMPONENTS.md
- /docs/generated/WORKFLOWS.md

If any are missing, run documentation audit first.
```

---

### Full Consolidation Audit

When user says: "Run consolidation audit" or "Find duplicate code"

**Behavior:**
1. Read `/docs/skills/consolidation-audit/SKILL.md` completely
2. Read `/docs/skills/consolidation-audit/TEMPLATES.md` for output formats
3. Verify documentation audit files exist
4. Execute Phase 1 (Domain Identification), then STOP
5. Ask user: "I've identified X domains with potential duplicates. Review and confirm before I analyze each."
6. For each domain, execute Phase 2-5, then STOP
7. Ask user: "Domain analysis complete. Ready for next domain?"
8. After all domains, generate MIGRATION-ORDER.md

**Critical Constraints:**
- NEVER modify source files
- NEVER consolidate code during the audit
- ALWAYS provide evidence for duplicate claims
- ALWAYS trace consumers before recommending deletion
- ALWAYS generate migration plans, not execute them

---

### Single Domain Analysis

When user says: "Analyze [domain] for duplicates" or "Consolidation audit for scheduler"

**Behavior:**
1. Read the skill files
2. Focus only on the specified domain
3. Generate [DOMAIN]-PLAN.md
4. Do NOT analyze other domains

**Example:**
```
User: Analyze scheduler for duplicates
Claude: [Searches for all scheduler-related code]
        [Identifies canonical version]
        [Maps all duplicates with evidence]
        [Generates SCHEDULER-PLAN.md]
```

---

### Quick Duplicate Scan

When user says: "Quick scan for duplicates" or "How much duplicate code do I have?"

**Behavior:**
1. Read MANIFEST.md and MODULES.md
2. Identify obvious duplicates by name patterns
3. Provide summary without full analysis
4. Offer to run full audit for details

**Output:**
```
Quick Scan Results:
- Scheduler: 4 potential duplicate locations
- Entity Matching: 3 potential duplicate locations  
- Email: 2 potential duplicate locations

Run full consolidation audit for detailed analysis and migration plans.
```

---

### Generate Migration Plan Only

When user says: "Create migration plan for [domain]" (after analysis exists)

**Behavior:**
1. Read existing [DOMAIN]-ANALYSIS.md
2. Generate detailed migration steps
3. Include verification checkpoints
4. Output [DOMAIN]-PLAN.md

---

## Output Locations

All consolidation outputs go to `/docs/generated/consolidation/`:

```
docs/generated/consolidation/
├── DOMAIN-ANALYSIS.md       # Summary of all domains
├── SCHEDULER-PLAN.md        # Scheduler consolidation plan
├── ENTITY-MATCHING-PLAN.md  # Entity matching plan
├── [DOMAIN]-PLAN.md         # One per domain
├── MIGRATION-ORDER.md       # Recommended order
└── DEPENDENCY-MAP.md        # Full dependency graph
```

---

## Checkpoints

The consolidation audit has built-in checkpoints:

1. **After Phase 1:** Confirm domain list is complete
2. **After each domain analysis:** Review duplicates found
3. **After canonical selection:** Confirm the right version is chosen
4. **After consumer mapping:** Verify all consumers identified
5. **After migration plan:** Approve before any execution

**NEVER proceed past a checkpoint without explicit user confirmation.**

---

## Key Differences from Documentation Audit

| Aspect | Documentation Audit | Consolidation Audit |
|--------|--------------------|--------------------|
| Input | Source code | Documentation + Source code |
| Output | What exists | What to change |
| Action | Describe | Plan (not execute) |
| Scope | Everything | Duplicates only |

---

## Integration with Documentation

The consolidation audit READS from documentation:

```
MODULES.md → Module exports and dependencies
API.md → Route handlers and their imports  
COMPONENTS.md → Component dependencies
WORKFLOWS.md → Data flow patterns
```

If documentation is outdated:
1. Note which parts are stale
2. Recommend re-running specific documentation phases
3. Proceed with caution, flagging uncertainty

---

## Executing Migration Plans

**The consolidation audit generates plans. It does NOT execute them.**

To execute a migration plan:

```
User: Execute the scheduler consolidation plan

Claude: I'll execute the SCHEDULER-PLAN.md step by step.

Step 1 of 7: Update canonical exports
[Shows exact changes to make]
Should I make this change? (yes/no)

User: yes

Claude: [Makes change]
Step 1 complete. Verify by running: [test command]
Ready for Step 2? (yes/no)
```

Each step requires explicit approval. No batch execution.

---

## Error Recovery

If consolidation causes issues:

1. **Identify which step failed**
2. **Rollback that specific change:** `git checkout -- [file]`
3. **Re-analyze:** The duplicate might have hidden consumers
4. **Update plan:** Add the missing consumer to migration steps
5. **Retry:** With updated plan

---

## Example Session

```
User: Run consolidation audit

Claude: I'll analyze the codebase for duplicate logic.
        First, let me verify documentation is current...

        ✓ MANIFEST.md exists (generated today)
        ✓ MODULES.md exists (generated today)
        ✓ API.md exists (generated today)

        Starting Phase 1: Domain Identification...

        [Analyzes file names, imports, patterns]

        Phase 1 Complete. Identified 5 domains with potential duplicates:

        | Domain | Primary Location | Suspected Duplicates |
        |--------|------------------|---------------------|
        | Scheduler | src/lib/scheduler/ | 4 locations |
        | Entity Matching | src/lib/intelligence/ | 3 locations |
        | Email | src/lib/email/ | 2 locations |
        | Context Building | src/lib/intelligence/ | 2 locations |
        | Command Center Items | src/lib/commandCenter/ | 2 locations |

        Should I proceed with detailed analysis of each domain?
        Which domain would you like me to analyze first?

User: Start with scheduler

Claude: Analyzing Scheduler domain...

        [Deep analysis with evidence]

        Scheduler Analysis Complete.

        Canonical: src/lib/scheduler/ (30 files)
        
        Duplicates found:
        1. src/lib/ai/meetingScheduler.ts (80% overlap)
           - Evidence: Same DB queries at lines 45-60
           - Consumers: 3 files
        
        2. api/meetings/direct-book/route.ts (40% overlap)
           - Evidence: Inline logic duplicates createRequest
           - Consumers: 2 UI components
        
        [etc.]

        Generated: /docs/generated/consolidation/SCHEDULER-PLAN.md

        Review the plan. When ready, I'll analyze the next domain
        or we can discuss the scheduler plan in detail.
```
