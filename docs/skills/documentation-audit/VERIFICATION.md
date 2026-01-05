# Documentation Verification Protocol

> This checklist MUST be completed before documentation is marked as finished.
> Every item requires explicit verification with evidence.

---

## Pre-Audit Verification

Before starting the documentation audit, verify:

### Environment Check
- [ ] I am in READ-ONLY mode for all source code
- [ ] I have confirmed the output directory exists: `/docs/generated/`
- [ ] I have confirmed I will NOT modify any file outside `/docs/generated/`
- [ ] User has confirmed they want to proceed with documentation audit

### Scope Confirmation
- [ ] User has specified which phases to run (all 7, or specific phases)
- [ ] User has confirmed checkpoint behavior (stop after each phase)
- [ ] Any specific areas of focus have been noted

---

## Phase Completion Checklists

### Phase 1: Structure Discovery ✓

**Required Evidence:**
- [ ] Listed every directory under `src/` with file count
- [ ] Listed every file in `src/app/api/` routes
- [ ] Listed every file in `supabase/migrations/`
- [ ] Listed every file in `scripts/`
- [ ] Calculated totals and included in MANIFEST.md
- [ ] User confirmed manifest matches their understanding

**Output Verification:**
- [ ] `/docs/generated/MANIFEST.md` exists
- [ ] Manifest includes timestamp
- [ ] Manifest includes file counts
- [ ] No files were created outside `/docs/generated/`

---

### Phase 2: Database Schema ✓

**Required Evidence:**
For EVERY table in the database:
- [ ] Table name documented
- [ ] Every column documented with type
- [ ] Every constraint documented
- [ ] Creation migration cited with line number
- [ ] Any ALTER migrations cited with line numbers

For EVERY index:
- [ ] Index name documented
- [ ] Columns covered documented
- [ ] Migration source cited

For EVERY foreign key:
- [ ] Source and target tables documented
- [ ] ON DELETE behavior documented

For EVERY RLS policy:
- [ ] Policy name documented
- [ ] Operation type documented
- [ ] Condition documented
- [ ] Migration source cited

**Cross-Reference:**
- [ ] Number of tables in DATABASE.md matches count in MANIFEST.md
- [ ] ERD includes all tables with relationships
- [ ] Migration history is in chronological order

**Output Verification:**
- [ ] `/docs/generated/DATABASE.md` exists
- [ ] Mermaid ERD renders correctly
- [ ] User confirmed no missing tables

---

### Phase 3: API Routes ✓

**Required Evidence:**
For EVERY route.ts file:
- [ ] File path documented
- [ ] All HTTP methods documented (GET, POST, PUT, DELETE, PATCH)
- [ ] Request body schema documented with line citations
- [ ] Response schema documented with line citations
- [ ] Auth requirements documented
- [ ] Error responses documented
- [ ] Dependencies traced and listed

**Cross-Reference:**
- [ ] Number of routes in API.md matches count in MANIFEST.md
- [ ] All routes are reachable (no orphan files)
- [ ] All request/response types reference real type definitions

**Output Verification:**
- [ ] `/docs/generated/API.md` exists
- [ ] Example curl commands are valid
- [ ] User confirmed no missing routes

---

### Phase 4: Library Modules ✓

**Required Evidence:**
For EVERY directory in `src/lib/`:
- [ ] Directory purpose documented
- [ ] File count documented
- [ ] Status breakdown documented (active/transitional/deprecated)

For EVERY file in `src/lib/`:
- [ ] Status assigned and justified
- [ ] All exports listed with types
- [ ] For each exported function:
  - [ ] Parameters documented with types
  - [ ] Return type documented
  - [ ] Line numbers cited
- [ ] Internal dependencies traced (other src/lib files)
- [ ] External dependencies listed (npm packages)
- [ ] Database tables accessed documented (SELECT/INSERT/UPDATE/DELETE)
- [ ] External API calls documented

**Cross-Reference:**
- [ ] Number of files matches MANIFEST.md
- [ ] All internal imports resolve to documented files
- [ ] All database tables referenced exist in DATABASE.md

**Output Verification:**
- [ ] `/docs/generated/MODULES.md` exists
- [ ] Module status summary totals are correct
- [ ] User confirmed no missing modules

---

### Phase 5: Components ✓

**Required Evidence:**
For EVERY component directory:
- [ ] Directory purpose documented
- [ ] Component count documented

For EVERY component file:
- [ ] Props interface documented with line citation
- [ ] State variables documented (useState, useReducer)
- [ ] API calls documented with endpoints
- [ ] Child components listed
- [ ] Client vs server component noted

**Cross-Reference:**
- [ ] All API calls reference routes in API.md
- [ ] All child component references resolve to documented components

**Output Verification:**
- [ ] `/docs/generated/COMPONENTS.md` exists
- [ ] Component tree is accurate
- [ ] User confirmed no missing components

---

### Phase 6: Workflows ✓

**Required Evidence:**
For EVERY documented workflow:
- [ ] Trigger documented
- [ ] Every step documented with:
  - [ ] File path
  - [ ] Function name
  - [ ] Line numbers
  - [ ] Input/output types
  - [ ] Database operations
- [ ] Error handling documented
- [ ] Mermaid diagram created
- [ ] End state documented

**Cross-Reference:**
- [ ] All files referenced exist in MODULES.md
- [ ] All database tables referenced exist in DATABASE.md
- [ ] All API calls referenced exist in API.md

**Output Verification:**
- [ ] `/docs/generated/WORKFLOWS.md` exists
- [ ] Mermaid diagrams render correctly
- [ ] User confirmed workflows are accurate

---

### Phase 7: Environment & Scripts ✓

**Required Evidence:**
For EVERY environment variable:
- [ ] Variable name documented
- [ ] Required vs optional status documented
- [ ] All files using it listed with line numbers
- [ ] Default value documented (if any)

For EVERY script:
- [ ] Purpose documented
- [ ] Usage instructions included
- [ ] Required env vars listed
- [ ] Data modification warnings included
- [ ] What it does step-by-step documented

**Cross-Reference:**
- [ ] All scripts in MANIFEST.md are documented
- [ ] All env vars found via grep are documented

**Output Verification:**
- [ ] `/docs/generated/ENVIRONMENT.md` exists
- [ ] `/docs/generated/SCRIPTS.md` exists
- [ ] User confirmed completeness

---

## Post-Audit Verification

### Completeness Audit

Run these checks after all phases complete:

```
Files in MANIFEST vs Files Documented:
- [ ] src/lib/ files: ___ in manifest, ___ documented
- [ ] src/components/ files: ___ in manifest, ___ documented  
- [ ] src/app/api/ routes: ___ in manifest, ___ documented
- [ ] scripts/ files: ___ in manifest, ___ documented
- [ ] migrations: ___ in manifest, ___ documented
```

### Accuracy Audit

Spot-check 5 random items:
- [ ] Function 1: `[name]` - parameters match actual code? ___
- [ ] Function 2: `[name]` - return type matches actual code? ___
- [ ] Table 1: `[name]` - columns match migration? ___
- [ ] Route 1: `[path]` - request schema matches code? ___
- [ ] Component 1: `[name]` - props match actual code? ___

### Citation Audit

Verify 5 random citations:
- [ ] Citation 1: `[file:line]` - content exists at that location? ___
- [ ] Citation 2: `[file:line]` - content exists at that location? ___
- [ ] Citation 3: `[file:line]` - content exists at that location? ___
- [ ] Citation 4: `[file:line]` - content exists at that location? ___
- [ ] Citation 5: `[file:line]` - content exists at that location? ___

### No-Modification Audit

Confirm no source files were modified:
- [ ] `git status` shows no changes to src/
- [ ] `git status` shows no changes to scripts/
- [ ] `git status` shows no changes to supabase/
- [ ] Only `/docs/generated/` has new files

---

## Uncertainty Documentation

All uncertainties must be documented:

### [UNCERTAIN] Tags Used

| Location | Issue | Needs |
|----------|-------|-------|
| | | |

### [NEEDS REVIEW] Tags Used

| Location | Issue | Suggested Action |
|----------|-------|------------------|
| | | |

### [INCONSISTENCY] Tags Found

| Location | Issue | Files Involved |
|----------|-------|----------------|
| | | |

---

## Final Sign-Off

- [ ] All phases completed
- [ ] All verification checklists passed
- [ ] All uncertainty tags reviewed with user
- [ ] User has approved final documentation
- [ ] Timestamp recorded: _______________
- [ ] Git commit hash (if applicable): _______________

---

## Audit Metadata

```yaml
audit_version: 1.0.0
started_at: [TIMESTAMP]
completed_at: [TIMESTAMP]
phases_run: [1,2,3,4,5,6,7]
files_documented: X
tables_documented: Y
routes_documented: Z
functions_documented: W
uncertainty_tags: N
user_approved: true/false
```
