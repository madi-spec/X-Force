# Meeting Prep Hub — Claude Code Master Prompt

## Quick Start

Copy this entire file to start the implementation.

---

## PROJECT OVERVIEW

You are implementing the **Meeting Prep Hub** feature for X-FORCE CRM. This adds:

1. **Collateral Library** — Upload, tag, and manage sales materials
2. **Enhanced Meeting Prep Page** — Dynamic collateral + software links + notes
3. **Settings UI** — Manage software access links

**Total Scope:** ~3 phases, each with built-in QC checks you run autonomously.

---

## CRITICAL RULES

### 1. REUSE EXISTING CODE
The CRM already has meeting prep functionality. You MUST use these existing functions:
- `generateContextAwareMeetingPrep()` from `src/lib/intelligence/generateMeetingPrep.ts`
- `generateCompleteMeetingPrep()` from `src/lib/commandCenter/meetingPrep.ts`
- `enrichAttendees()` from `src/lib/commandCenter/meetingPrep.ts`

**DO NOT** recreate AI prompt logic or duplicate existing functionality.

### 2. RUN QC CHECKS AUTONOMOUSLY
Each phase has QC checkpoints. Run them yourself:
- **Postgres MCP** — Verify database state after migrations
- **Playwright MCP** — Verify UI visually after component changes
- **Build checks** — Run `npx tsc --noEmit` and `npm run lint` before commits

### 3. FOLLOW EXISTING PATTERNS
Match the codebase style for:
- API routes (check existing routes in `src/app/api/`)
- Components (check existing components)
- Database queries (check existing lib functions)

---

## FILE LOCATIONS

**Read the spec first:**
```bash
cat /docs/specs/MEETING-PREP-HUB-INTEGRATION-SPEC.md
```

**Phase prompts (follow in order):**
```
/docs/prompts/CLAUDE-CODE-PROMPT-Phase1-Collateral-Library.md
/docs/prompts/CLAUDE-CODE-PROMPT-Phase2-Meeting-Prep-Page.md
/docs/prompts/CLAUDE-CODE-PROMPT-Phase3-Polish-Settings.md
```

---

## PHASE SUMMARY

### Phase 1: Database + Collateral Library (~4-6 hours)
- [ ] Database migration (collateral, software_links, meeting_prep_notes)
- [ ] Supabase Storage bucket
- [ ] TypeScript types
- [ ] API endpoints for collateral CRUD
- [ ] CollateralLibrary page UI
- [ ] Upload/edit/delete functionality
- [ ] Filters and search

**QC Gates:**
- All tables exist in DB
- Upload works (file and link)
- CRUD operations work
- Filters narrow results correctly

### Phase 2: Meeting Prep Page (~4-6 hours)
- [ ] Collateral matching logic
- [ ] Meeting type inference
- [ ] Enhanced prep data builder
- [ ] API endpoint for prep page
- [ ] Notes API endpoint
- [ ] MeetingPrepPage components
- [ ] Navigation from calendar/command center

**QC Gates:**
- Prep page loads without errors
- Collateral matches context
- Notes auto-save and persist
- Uses existing AI prep (not new logic)

### Phase 3: Polish + Settings (~3-4 hours)
- [ ] Software Links settings UI
- [ ] Collateral analytics
- [ ] Notes sync to activity feed
- [ ] Mobile responsiveness
- [ ] Error handling
- [ ] Loading states
- [ ] Accessibility fixes

**QC Gates:**
- Settings CRUD works
- Mobile views work
- Errors handled gracefully
- Full user journey works

---

## AUTONOMOUS EXECUTION CHECKLIST

Before marking each phase complete, verify:

```bash
# TypeScript
npx tsc --noEmit
# ✓ No errors

# Lint
npm run lint
# ✓ No errors

# Build
npm run build
# ✓ Build succeeds
```

**Postgres MCP checks** (run after each migration):
```sql
-- Tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('collateral', 'collateral_usage', 'software_links', 'meeting_prep_notes');
```

**Playwright MCP checks** (run after UI changes):
```
Navigate to the page
Take screenshot
Verify expected elements visible
Test interactions (click, type, submit)
Verify data persisted
```

---

## COMMIT MESSAGES

Use conventional commits:

```bash
# Phase 1
git commit -m "feat: Add Collateral Library (Phase 1 of Meeting Prep Hub)"

# Phase 2  
git commit -m "feat: Add Enhanced Meeting Prep Page (Phase 2 of Meeting Prep Hub)"

# Phase 3
git commit -m "feat: Complete Meeting Prep Hub (Phase 3)"
```

---

## TROUBLESHOOTING

### Migration fails
- Check Supabase connection
- Verify SQL syntax
- Check for existing table conflicts

### Collateral matching returns empty
- Verify test data exists in collateral table
- Check array containment query syntax
- Log the matching context to debug

### Prep page shows no AI content
- Verify `generateContextAwareMeetingPrep` is being called
- Check for errors in console
- Verify meeting has attendees

### Notes not saving
- Check auth token
- Verify RLS policies allow insert
- Check unique constraint on meeting_id + user_id

---

## START HERE

```bash
# 1. Read the integration spec
cat /docs/specs/MEETING-PREP-HUB-INTEGRATION-SPEC.md

# 2. Start Phase 1
cat /docs/prompts/CLAUDE-CODE-PROMPT-Phase1-Collateral-Library.md

# 3. Execute Step 1 (Database Migration)
# ... follow the prompt ...
```

**When Phase 1 QC passes → proceed to Phase 2**
**When Phase 2 QC passes → proceed to Phase 3**
**When Phase 3 QC passes → feature complete!**
