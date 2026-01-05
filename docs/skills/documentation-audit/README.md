# X-FORCE Documentation Audit Skill

> A Claude Code skill for generating comprehensive, accurate, evidence-based documentation with explicit guardrails against hallucination, laziness, and scope creep.

---

## Why This Exists

When using AI for documentation, three problems commonly occur:

1. **Laziness** - AI summarizes instead of documenting, skips "obvious" things
2. **Hallucination** - AI makes up function names, parameters, or behaviors
3. **Scope Creep** - AI decides to "fix" code during documentation

This skill explicitly prevents all three through:
- **Phased execution** with human checkpoints
- **Citation requirements** for every claim
- **Read-only constraints** that prevent source modification
- **Verification checklists** that must pass before completion
- **Templates** that enforce consistent output

---

## Files in This Skill

| File | Purpose |
|------|---------|
| `SKILL.md` | Main skill definition with 7 execution phases |
| `TEMPLATES.md` | Exact output formats for each document type |
| `VERIFICATION.md` | Checklists that must pass before completion |
| `GUARDRAILS.md` | Explicit rules preventing bad AI behaviors |
| `CLAUDE-MD-INSTRUCTIONS.md` | What to add to your CLAUDE.md |

---

## Installation

### Step 1: Create the skill directory in your project

```bash
mkdir -p docs/skills/documentation-audit
```

### Step 2: Copy all skill files

Copy these files to `docs/skills/documentation-audit/`:
- SKILL.md
- TEMPLATES.md
- VERIFICATION.md
- GUARDRAILS.md

### Step 3: Update your CLAUDE.md

Add the content from `CLAUDE-MD-INSTRUCTIONS.md` to your project's root `CLAUDE.md` file.

### Step 4: Create the output directory

```bash
mkdir -p docs/generated
```

### Step 5: Add to .gitignore (optional)

If you don't want to commit generated docs:
```bash
echo "docs/generated/" >> .gitignore
```

Or if you DO want to commit them (recommended):
```bash
# Don't add to gitignore - track your documentation!
```

---

## Usage

### Full Documentation Audit

In Claude Code:

```
Run documentation audit
```

This will:
1. Execute all 7 phases
2. Stop after each phase for your review
3. Generate documentation to `/docs/generated/`
4. Complete verification checklists

### Single Phase

```
Run Phase 4 of documentation audit
```

Useful for updating just module documentation after changes.

### Quick Diff

```
What changed since last documentation?
```

Compares current codebase to last documented state.

---

## Expected Output

After a full audit, you'll have:

```
docs/generated/
├── MANIFEST.md      # Complete file structure
├── DATABASE.md      # All tables, columns, relationships
├── API.md           # All endpoints with request/response schemas
├── MODULES.md       # All lib modules with exports and dependencies
├── COMPONENTS.md    # All React components with props and state
├── WORKFLOWS.md     # End-to-end flow diagrams
├── ENVIRONMENT.md   # All environment variables
├── SCRIPTS.md       # All utility scripts
└── AUDIT-LOG.md     # Metadata about the audit
```

---

## Checkpoint Behavior

The audit stops after each phase:

```
Claude: Phase 1 complete. Generated MANIFEST.md

Summary:
- 12 directories
- 87 source files
- 24 API routes

Would you like to review before proceeding to Phase 2?

You: [Review MANIFEST.md]
You: Looks good, proceed

Claude: Starting Phase 2: Database Schema...
```

This gives you control and prevents runaway documentation that might go off-track.

---

## Handling Issues

### If Claude Starts "Fixing" Code

Immediately say:
```
STOP. You are in documentation mode. Do not modify source files.
Roll back any changes and continue documenting.
```

### If Documentation Seems Incomplete

Say:
```
You documented 15 files but MANIFEST.md shows 17 in that directory.
Document the missing files: [list them]
```

### If Citations Seem Wrong

Say:
```
Verify citation for [function] at [file:line].
Read that line and confirm it matches your documentation.
```

---

## Customization

### Adding Project-Specific Sections

Edit `SKILL.md` to add phases specific to your project. For example:

```markdown
### Phase 8: Integration Points (X-FORCE Specific)

Document all external integrations:
- Microsoft Graph API endpoints used
- Fireflies webhook handlers
- Claude API usage patterns
```

### Changing Output Format

Edit `TEMPLATES.md` to modify the exact structure of generated documents.

### Adding Stricter Guardrails

Edit `GUARDRAILS.md` to add project-specific constraints.

---

## Verification

Every audit must complete the verification checklist in `VERIFICATION.md`.

Key verifications:
- [ ] File counts match between MANIFEST and actual docs
- [ ] Random spot-checks of citations
- [ ] Confirmation no source files modified
- [ ] All uncertainty tags reviewed

---

## Recommended Workflow

1. **Initial Audit** - Run full 7-phase audit when starting
2. **After Major Changes** - Run relevant phases (e.g., Phase 4 after refactoring lib/)
3. **Before New Features** - Run quick diff to ensure docs are current
4. **Monthly Maintenance** - Run full audit to catch drift

---

## Troubleshooting

### "Documentation seems superficial"

The skill may need reminding. Say:
```
Remember: Every file needs complete documentation including all exports,
parameters, return types, dependencies, and database operations.
No summarizing. Document the file at [path] completely.
```

### "Claude is taking too long"

Break into smaller chunks:
```
Run Phase 4 for only src/lib/intelligence/
```

### "Output format is inconsistent"

Point to templates:
```
The documentation for [file] doesn't match the template in TEMPLATES.md.
Reformat to match the template exactly.
```

---

## Contributing

If you improve this skill:
1. Test changes on your codebase
2. Update version number in SKILL.md
3. Document changes in version history

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
