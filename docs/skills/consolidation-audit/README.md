# X-FORCE Consolidation Audit Skill

> Identify duplicate logic across your codebase and generate safe migration plans to consolidate to single sources of truth.

---

## The Problem This Solves

After rapid development and multiple iterations, codebases often have:

- **Multiple implementations of the same logic** in different files
- **Copy-pasted code** that diverged over time
- **Old and new versions** coexisting
- **Inline logic** in API routes that duplicates library functions

This leads to:
- Fixing a bug in one place while it persists in 4 others
- Inconsistent behavior depending on which code path runs
- Fear of changing anything because you don't know what depends on it
- Wasted effort maintaining multiple versions of the same thing

---

## What This Skill Does

1. **Identifies domains** with duplicate logic (scheduler, email, entity matching, etc.)
2. **Finds all implementations** of each domain across the codebase
3. **Selects the canonical version** (most complete, most recent, best located)
4. **Maps all consumers** of duplicate code
5. **Generates migration plans** with safe, ordered steps
6. **Creates dependency maps** showing what imports what

---

## Prerequisites

**This skill requires completed documentation audit.**

Before running consolidation, you need:
- `/docs/generated/MANIFEST.md`
- `/docs/generated/MODULES.md`
- `/docs/generated/API.md`
- `/docs/generated/COMPONENTS.md`
- `/docs/generated/WORKFLOWS.md`

The consolidation audit reads documentation to understand the codebase structure.

---

## Installation

### Step 1: Create the skill directory

```bash
mkdir -p docs/skills/consolidation-audit
```

### Step 2: Copy skill files

Copy these files to `docs/skills/consolidation-audit/`:
- SKILL.md
- TEMPLATES.md
- CLAUDE-MD-INSTRUCTIONS.md

### Step 3: Update CLAUDE.md

Add the content from `CLAUDE-MD-INSTRUCTIONS.md` to your project's root `CLAUDE.md` file.

### Step 4: Create output directory

```bash
mkdir -p docs/generated/consolidation
```

---

## Usage

### Full Consolidation Audit

```
Run consolidation audit
```

This will:
1. Identify all domains with duplicates
2. Analyze each domain in detail
3. Generate migration plans
4. Create dependency maps

### Single Domain

```
Analyze scheduler for duplicates
```

Focuses on one domain only.

### Quick Scan

```
Quick scan for duplicates
```

Fast overview without detailed analysis.

---

## Output Files

After running, you'll have:

```
docs/generated/consolidation/
├── DOMAIN-ANALYSIS.md       # Summary of all domains
├── SCHEDULER-PLAN.md        # Detailed scheduler migration
├── ENTITY-MATCHING-PLAN.md  # Detailed entity matching migration
├── EMAIL-PLAN.md            # Detailed email migration
├── MIGRATION-ORDER.md       # Recommended order to consolidate
└── DEPENDENCY-MAP.md        # Full dependency graph
```

---

## Migration Plan Format

Each `[DOMAIN]-PLAN.md` includes:

1. **Current State** - What exists, where duplicates are
2. **Canonical Selection** - Which version to keep and why
3. **Consumer Mapping** - Everything that imports duplicates
4. **Step-by-Step Migration** - Exact changes with line numbers
5. **Verification Steps** - How to test each change
6. **Rollback Plan** - What to do if something breaks

---

## Executing Migrations

**The audit generates plans. It does NOT automatically execute them.**

To execute, tell Claude Code:
```
Execute the scheduler consolidation plan
```

Claude will:
1. Show you each step
2. Wait for approval before making changes
3. Verify after each step
4. Provide rollback instructions

---

## Example Workflow

```
Week 1: Documentation
- Run full documentation audit (7 phases)
- Review generated docs

Week 2: Analysis
- Run consolidation audit
- Review domain analysis
- Prioritize which domains to consolidate

Week 3: Scheduler Consolidation
- Execute SCHEDULER-PLAN.md step by step
- Test after each step
- Verify no regressions

Week 4: Entity Matching Consolidation
- Execute ENTITY-MATCHING-PLAN.md
- Test after each step
- Verify no regressions

[Continue for each domain]
```

---

## Safety Features

1. **READ-ONLY Analysis** - Audit never modifies code
2. **Evidence Required** - Every duplicate claim cites file:line
3. **Consumer Tracing** - Deletion only after all consumers migrated
4. **Checkpoints** - Human approval required at each phase
5. **Rollback Plans** - Every migration plan includes recovery steps

---

## Troubleshooting

### "Documentation is outdated"

Re-run the relevant documentation phase:
```
Run Phase 4 of documentation audit
```

### "Missed a consumer"

The migration failed because something still imported the deleted file.

1. Rollback the deletion
2. Run: `grep -r "deleted-file-name" src/`
3. Add missing consumer to migration plan
4. Re-execute with updated plan

### "Canonical version missing a feature"

A duplicate has functionality the canonical doesn't.

1. Extract the feature from the duplicate
2. Add it to the canonical module
3. Re-run consumer migration
4. Then delete duplicate

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
