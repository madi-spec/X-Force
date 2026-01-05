# X-FORCE Deal → Product Migration: Master Orchestration

## Quick Start for Claude Code

**READ THIS FIRST. This is your mission control document.**

You are autonomously executing a 6-phase migration of X-FORCE CRM from a deal-centric to product-centric architecture. You will work through all phases without human intervention, using MCP servers to verify your work.

### Your First Actions

1. Read this entire document
2. Read `docs/migration/MIGRATION_CHECKLIST.md` to see current progress
3. Start (or resume) at the first incomplete phase
4. After completing each phase, update the checklist file
5. Continue until all phases are complete

---

## Project Overview

### Current State (Legacy)
- `deals` table is the primary sales entity
- `deal_id` foreign keys exist in: activities, tasks, meeting_transcriptions, scheduling_requests, command_center_items
- UI routes like `/deals` and `/deals/[id]` are deal-centric

### Target State (Modern)
- `company_products` table is the primary sales entity
- `company_product_id` foreign keys in all relevant tables
- UI is product-centric with `/products` as the main pipeline
- Legacy deals accessible but deprecated

### Migration Phases

| Phase | Name | Purpose | Est. Time |
|-------|------|---------|-----------|
| 1 | Database Schema | Add company_product_id columns | 30-45 min |
| 2 | Scheduler System | Update scheduler to use products | 45-60 min |
| 3 | Command Center | Update work queue for products | 45-60 min |
| 4 | Activities/Tasks | Update all record creation | 30-45 min |
| 5 | UI Navigation | Update routes and navigation | 30-45 min |
| 6 | Final Cleanup | Deprecation and documentation | 30-45 min |

---

## Critical Rules

### Rule 1: Use MCP Servers for All Verification

You have access to these MCP servers - USE THEM for every verification step:

**Postgres MCP** - Query the database directly
```
Use for: Schema verification, data migration verification, relationship checks
```

**Playwright MCP** - Test UI visually
```
Use for: Screenshot capture, form testing, navigation verification
```

**GitHub MCP** - Commit changes
```
Use for: Committing at phase completion checkpoints
```

### Rule 2: Never Skip Verification

Each phase has explicit success criteria. You MUST:
1. Complete all implementation steps
2. Run ALL verification queries (Postgres MCP)
3. Capture verification screenshots (Playwright MCP)
4. Ensure `npm run build` passes
5. Only then mark the phase complete

### Rule 3: Fix Issues Immediately

If something breaks:
1. Stop and diagnose using MCP tools
2. Fix the issue before continuing
3. Re-run verification after fixing
4. Document what went wrong in the checklist

### Rule 4: Maintain Backwards Compatibility

During migration, both systems must work:
- Keep `deal_id` columns and support
- Add `company_product_id` alongside, not replacing
- Only deprecate (not remove) in Phase 6

### Rule 5: Update Checklist After Each Phase

After completing each phase:
1. Update `docs/migration/MIGRATION_CHECKLIST.md`
2. Mark the phase as complete with timestamp
3. Note any issues encountered
4. Commit the checklist update

---

## Phase Execution Protocol

### Before Starting Any Phase

```bash
# 1. Verify build is clean
npm run build

# 2. Check current progress
cat docs/migration/MIGRATION_CHECKLIST.md

# 3. Read the phase document
cat docs/migration/PHASE_[N]_[NAME].md
```

### During Each Phase

1. Follow steps in order - don't skip ahead
2. After each major step, verify with appropriate MCP tool
3. If `npm run build` fails, fix before continuing
4. Take screenshots at key UI checkpoints

### After Completing Each Phase

```bash
# 1. Final build verification
npm run build

# 2. Update checklist
# Edit docs/migration/MIGRATION_CHECKLIST.md

# 3. Commit with descriptive message
git add -A
git commit -m "Phase [N]: [Description from phase doc]"

# 4. Proceed to next phase
cat docs/migration/PHASE_[N+1]_[NAME].md
```

---

## File Locations

### Migration Documentation
```
docs/migration/
├── MIGRATION_MASTER.md          # This file - orchestration
├── MIGRATION_CHECKLIST.md       # Progress tracking (update this!)
├── PHASE_1_DATABASE.md          # Database schema migration
├── PHASE_2_SCHEDULER.md         # Scheduler system migration
├── PHASE_3_COMMAND_CENTER.md    # Command center migration
├── PHASE_4_ACTIVITIES.md        # Activities, tasks, transcriptions
├── PHASE_5_UI_NAVIGATION.md     # UI and navigation cleanup
└── PHASE_6_CLEANUP.md           # Final cleanup and deprecation
```

### Key Source Directories
```
src/
├── app/api/scheduler/           # Phase 2
├── app/api/command-center/      # Phase 3
├── app/api/activities/          # Phase 4
├── app/api/tasks/               # Phase 4
├── app/(dashboard)/deals/       # Phase 5
├── app/(dashboard)/products/    # Phase 5
├── components/shared/Sidebar.tsx    # Phase 5
├── components/scheduler/        # Phase 2
├── components/commandCenter/    # Phase 3
├── lib/scheduler/               # Phase 2
├── lib/commandCenter/           # Phase 3
└── types/                       # All phases
```

### Database Tables Affected
```
- activities              (add company_product_id)
- tasks                   (add company_product_id)
- meeting_transcriptions  (add company_product_id)
- scheduling_requests     (add company_product_id)
- command_center_items    (add company_product_id)
- ai_email_drafts         (add company_product_id if exists)
- ai_signals              (add company_product_id if exists)
```

---

## Troubleshooting

### Build Fails After Changes

```bash
# Check TypeScript errors
npm run build 2>&1 | head -50

# Common fixes:
# 1. Missing type definitions - add to src/types/
# 2. Import errors - check file paths
# 3. Null safety - add optional chaining (?.)
```

### Database Migration Fails

```sql
-- Postgres MCP: Check if column already exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = '[TABLE]' AND column_name = 'company_product_id';

-- If exists, skip that ALTER TABLE
```

### MCP Server Not Responding

```bash
# Check MCP server status
# If Postgres MCP fails, use direct psql or Supabase dashboard
# If Playwright fails, do manual browser testing
```

### Phase Verification Fails

1. Re-read the phase requirements
2. Check if all steps were completed
3. Use Postgres MCP to verify database state
4. Use Playwright MCP to verify UI state
5. Fix issues and re-run verification

---

## Success Criteria Summary

### Phase 1: Database
- [ ] 5+ tables have company_product_id column
- [ ] All indexes created
- [ ] Data migration script runs
- [ ] TypeScript builds

### Phase 2: Scheduler
- [ ] Types updated with company_product_id
- [ ] API accepts company_product_id
- [ ] QuickBookModal shows product dropdown
- [ ] TypeScript builds

### Phase 3: Command Center
- [ ] Types updated with company_product_id
- [ ] findCompanyProductForCompany() works
- [ ] Momentum scoring uses product MRR
- [ ] ActionCard shows product badges
- [ ] TypeScript builds

### Phase 4: Activities/Tasks
- [ ] Activity API accepts company_product_id
- [ ] Task API accepts company_product_id
- [ ] Transcription creation includes company_product_id
- [ ] Fireflies sync matches products
- [ ] TypeScript builds

### Phase 5: UI Navigation
- [ ] Sidebar shows Products prominently
- [ ] /deals redirects appropriately
- [ ] Legacy Deals accessible
- [ ] No broken navigation links
- [ ] TypeScript builds

### Phase 6: Cleanup
- [ ] Deprecation comments added
- [ ] Documentation updated
- [ ] CLAUDE.md updated
- [ ] Final verification complete
- [ ] TypeScript builds

---

## Begin Migration

**Start now by reading the checklist to determine your current phase:**

```bash
cat docs/migration/MIGRATION_CHECKLIST.md
```

Then read and execute the appropriate phase document.

If starting fresh, begin with:
```bash
cat docs/migration/PHASE_1_DATABASE.md
```
