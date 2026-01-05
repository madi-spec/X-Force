# X-FORCE Documentation Audit - Claude Code Instructions

> Add this section to your project's CLAUDE.md file

---

## Documentation Audit Commands

### Full Audit (All 7 Phases)

When user says: "Run documentation audit" or "Document the codebase"

**Behavior:**
1. Read `/docs/skills/documentation-audit/SKILL.md` completely
2. Read `/docs/skills/documentation-audit/TEMPLATES.md` for output formats
3. Read `/docs/skills/documentation-audit/VERIFICATION.md` for checklists
4. Execute Phase 1, then STOP and show results
5. Ask user: "Phase 1 complete. Ready to proceed to Phase 2?"
6. Continue only after explicit confirmation
7. Repeat for all 7 phases

**Critical Constraints:**
- NEVER modify files outside `/docs/generated/`
- NEVER "fix" code discovered during audit
- NEVER skip files or summarize without reading
- ALWAYS cite file:line for every claim
- ALWAYS complete verification checklist

---

### Single Phase Audit

When user says: "Run Phase X of documentation audit"

**Behavior:**
1. Read the skill files
2. Execute only the specified phase
3. Generate output to `/docs/generated/`
4. Complete phase verification checklist
5. Report results

**Example:**
```
User: Run Phase 2 of documentation audit
Claude: [Reads skill files, executes Phase 2: Database Schema, generates DATABASE.md]
```

---

### Incremental Update

When user says: "Update documentation for [specific module/area]"

**Behavior:**
1. Read existing `/docs/generated/MANIFEST.md` to understand current state
2. Read only the specified files/modules
3. Update only the relevant sections of documentation
4. Note what changed in the changelog section

**Example:**
```
User: Update documentation for src/lib/intelligence/
Claude: [Reads current MODULES.md, reads all files in intelligence/, updates only that section]
```

---

### Documentation Diff

When user says: "What changed since last documentation?" or "Doc diff"

**Behavior:**
1. Read `/docs/generated/MANIFEST.md` to get last documented state
2. Compare against current file system
3. Report:
   - New files not documented
   - Deleted files still documented
   - Modified files (if timestamps available)
4. Ask if user wants to update documentation

---

## Checkpoints

The documentation audit has built-in checkpoints. At each checkpoint:

1. **STOP** execution
2. **SHOW** the user what was generated
3. **ASK** for confirmation before proceeding
4. **WAIT** for explicit approval

**Checkpoint Locations:**
- After Phase 1 (Structure Discovery)
- After Phase 2 (Database Schema)  
- After Phase 3 (API Routes)
- After each `src/lib/` subdirectory in Phase 4
- After Phase 5 (Components)
- After each workflow in Phase 6
- After Phase 7 (Environment & Scripts)

---

## Error Recovery

If documentation fails mid-phase:

1. Report exactly where it failed and why
2. Show what was completed before failure
3. Save partial output with `[INCOMPLETE]` marker
4. Ask user how to proceed:
   - Retry the failed step
   - Skip and continue
   - Abort audit

---

## Output Locations

All documentation outputs go to `/docs/generated/`:

```
docs/generated/
├── MANIFEST.md          # Phase 1: File structure
├── DATABASE.md          # Phase 2: Schema documentation
├── API.md               # Phase 3: API reference
├── MODULES.md           # Phase 4: Library documentation
├── COMPONENTS.md        # Phase 5: Component documentation
├── WORKFLOWS.md         # Phase 6: Flow diagrams
├── ENVIRONMENT.md       # Phase 7: Env vars
├── SCRIPTS.md           # Phase 7: Script reference
└── AUDIT-LOG.md         # Metadata about the audit
```

---

## Anti-Pattern Detection

If Claude Code attempts any of these, it should immediately stop and report:

- ❌ Opening a file for editing outside /docs/generated/
- ❌ Suggesting code changes during documentation
- ❌ Skipping files without explicit user approval
- ❌ Making claims without file:line citations
- ❌ Using phrases like "probably", "likely", "seems like" without `[UNCERTAIN]` tag
- ❌ Generating documentation for files it hasn't actually read

---

## Example Session

```
User: Run documentation audit

Claude: I'll run the full documentation audit. First, let me read the skill files...

[Reads SKILL.md, TEMPLATES.md, VERIFICATION.md]

Starting Phase 1: Structure Discovery

[Lists all directories and files]

Phase 1 Complete. Generated /docs/generated/MANIFEST.md

Summary:
- 12 directories under src/
- 87 source files
- 24 API routes
- 15 migration files
- 8 scripts

Would you like to review MANIFEST.md before I proceed to Phase 2 (Database Schema)?

User: Looks good, proceed

Claude: Starting Phase 2: Database Schema

[Reads each migration file, documents tables]

Phase 2 Complete. Generated /docs/generated/DATABASE.md

Summary:
- 18 tables documented
- 45 indexes documented
- 12 RLS policies documented
- ERD diagram generated

Found 2 uncertainties:
- [UNCERTAIN] Table `legacy_imports` has no RLS policy - intentional?
- [UNCERTAIN] Column `metadata` in `activities` has no type definition in migration

Would you like to review DATABASE.md before I proceed to Phase 3?

[...continues with explicit checkpoints...]
```

---

## Verification at End

After all phases complete, Claude MUST:

1. Run the Post-Audit Verification checklist
2. Report any gaps or issues found
3. Get explicit sign-off from user
4. Generate AUDIT-LOG.md with metadata

Only after user approval should documentation be considered complete.
