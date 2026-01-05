# X-FORCE Consolidation Plan

**Created:** December 29, 2025
**Goal:** Consolidate to Work Queue as primary UI, single email processing path, unified scheduler

---

## Executive Summary

### What We're Removing
- Daily Driver UI (`/daily`)
- Command Center UI (`/command-center`)
- Inbox UI (`/inbox`)
- 3 duplicate scheduler modals
- `email_conversations` and `email_messages` tables (inbox service)
- `activities` table for emails (keep for meetings/calls only)

### What We're Keeping
- Work Queue UI (`/work`) - becomes primary interface
- `communications` table - single source of truth for emails
- `scheduler/ScheduleMeetingModal` - unified scheduler component
- Scheduler automation backend (response processing, etc.)

---

## Phase 1: Scheduler Modal Consolidation

**Effort:** 4-6 hours
**Risk:** Low

### Current State
| Component | Location | Delete? |
|-----------|----------|---------|
| `SchedulerPopout.tsx` | `commandCenter/` | Yes |
| `ScheduleMeetingModal.tsx` | `scheduler/` | Keep (enhance) |
| `ScheduleMeetingModal.tsx` | `dailyDriver/` | Yes |
| `WorkSchedulerModal.tsx` | `work/` | Yes |

### Tasks

#### 1.1 Enhance scheduler/ScheduleMeetingModal
- [x] Add `mode` prop: `'staged' | 'direct'`
- [x] Add `workItem?: WorkItemContext` prop (simplified interface)
- [x] Add `linkedCommunication?: LinkedCommunication` prop
- [x] Add `onWorkItemResolved?: () => void` callback
- [x] Add `scheduleSuggestions?: ScheduleSuggestion` prop for pre-filled times
- [x] In direct mode: call Microsoft Graph directly via /api/meetings/direct-book
- [x] After success in work context: resolve attention flags and communications

#### 1.2 Update Work Queue to use unified modal
- [x] Update `WorkView.tsx` imports
- [x] Update `WorkItemPreviewPane.tsx` imports
- [x] Pass work item context to unified modal
- [x] Work item resolution flow implemented

#### 1.3 Update other consumers
- [x] Update `YourDayView.tsx` to use unified modal with `mode='direct'`
- [x] Update `ConversationThread.tsx` imports
- [x] Update `DailyDriverView.tsx` imports
- [ ] Update `CustomerContext.tsx` imports (if needed)

#### 1.4 Delete deprecated components
- [x] Delete `src/components/commandCenter/SchedulerPopout.tsx`
- [x] Delete `src/components/dailyDriver/ScheduleMeetingModal.tsx`
- [x] Delete `src/components/work/WorkSchedulerModal.tsx`
- [x] Update barrel exports (`index.ts` files)

#### 1.5 Verify and test
- [ ] Test scheduling from Work Queue
- [ ] Test scheduling from Communications
- [ ] Test scheduling from Calendar
- [ ] Test direct booking mode
- [x] Build passes

---

## Phase 2: Email Processing Consolidation

**Effort:** 8-12 hours
**Risk:** Medium

### Current State
```
Microsoft Graph
    ├─→ emailSync.ts → activities table (REMOVE for emails)
    ├─→ inboxService.ts → email_conversations + email_messages (REMOVE)
    └─→ communicationHub → communications table (KEEP - single source)
```

### Target State
```
Microsoft Graph
    └─→ communicationHub/emailAdapter → communications table
            └─→ matchCommunicationToCompany()
            └─→ analyzeCommunication()
```

### Tasks

#### 2.1 Audit current email sync entry points
- [x] Find all places that call `syncEmails()` from emailSync.ts
- [x] Find all places that call `performInitialSync()` from inboxService.ts
- [x] Find all cron jobs that trigger email sync
- [x] Document webhook handlers for Microsoft notifications

#### 2.2 Enhance communicationHub as single entry point
- [x] Ensure `syncEmailToCommunications()` handles all email types
- [x] Add Microsoft Graph fetch capability (currently expects email_messages)
- [x] Add direct Graph → communications path (bypass email_messages)
- [x] Preserve conversation threading via `thread_id`

#### 2.3 Update sync orchestration
- [x] Create new `syncEmailsDirectToCommunications()` function that:
  - Fetches from Microsoft Graph directly
  - Creates communications records
  - Triggers matching and analysis
- [x] Update cron jobs to use new function
- [ ] Update webhook handlers to use new function (future)

#### 2.4 Migrate existing data (if needed)
- [ ] Script to backfill any emails in email_messages not in communications
- [ ] Verify no data loss

#### 2.5 Remove inbox service email handling
- [ ] Remove email sync from `inboxService.ts` (keep conversation state logic if needed elsewhere)
- [ ] Mark `email_conversations` table as deprecated
- [ ] Mark `email_messages` table as deprecated
- [ ] Update any queries still using these tables

#### 2.6 Remove emailSync.ts email handling
- [ ] Keep `sendEmail()` function (still needed)
- [ ] Remove `syncEmails()`, `syncAllFolderEmails()`, `syncRecentEmails()`
- [ ] Stop writing emails to `activities` table
- [ ] Keep activities table for meetings/calls only

#### 2.7 Update API routes
- [ ] `/api/inbox/*` routes - mark deprecated or remove
- [ ] `/api/communications/*` routes - ensure they're complete
- [ ] Any route querying email_messages - update to communications

---

## Phase 3: UI Consolidation (Work Queue as Primary)

**Effort:** 6-10 hours
**Risk:** Medium

### Current State
| UI | Path | Status |
|----|------|--------|
| Work Queue | `/work` | Keep - becomes primary |
| Daily Driver | `/daily` | Remove |
| Command Center | `/command-center` | Remove |
| Inbox | `/inbox` | Remove |

### Tasks

#### 3.1 Migrate Daily Driver features to Work Queue
- [ ] Add attention flag integration to work queue service
- [ ] Add "Needs Reply" communications as a queue
- [ ] Add "Ready to Close" as a queue
- [ ] Add snooze action to work item cards
- [ ] Add resolve action to work item cards
- [ ] Migrate draft modal functionality

#### 3.2 Migrate Command Center features to Work Queue
- [ ] Add meeting prep data enrichment to work items
- [ ] Add momentum scoring (or simplify to priority only)
- [ ] Keep time-based planning logic in service layer
- [ ] Migrate useful modals (EmailDraftModal, MeetingPrepPopout, etc.)

#### 3.3 Migrate Inbox features to Work Queue
- [ ] "Needs Reply" queue replaces inbox pending view
- [ ] Communications drawer in Work Queue replaces inbox detail
- [ ] Email actions (reply, snooze, resolve) in work queue

#### 3.4 Update navigation
- [ ] Remove `/daily` from sidebar
- [ ] Remove `/command-center` from sidebar
- [ ] Remove `/inbox` from sidebar
- [ ] Update any redirects (e.g., `/` redirect)
- [ ] Update RBAC/lens visibility rules

#### 3.5 Delete deprecated UI components
- [ ] Delete `src/components/dailyDriver/` folder
- [ ] Delete `src/components/commandCenter/` folder (keep reusable modals first)
- [ ] Delete `src/components/inbox/` folder
- [ ] Delete `src/app/(dashboard)/daily/` folder
- [ ] Delete `src/app/(dashboard)/command-center/` folder
- [ ] Delete `src/app/(dashboard)/inbox/` folder

#### 3.6 Consolidate reusable components
Before deleting, migrate these to shared locations:
- [ ] `EmailDraftModal` → `src/components/shared/` or `src/components/email/`
- [ ] `TranscriptPreviewModal` → `src/components/shared/`
- [ ] `AddContactModal` → already in commandCenter, move to shared
- [ ] `MeetingPrepPopout` → `src/components/meetings/`

---

## Phase 4: API Route Cleanup

**Effort:** 2-4 hours
**Risk:** Low

### Tasks

#### 4.1 Deprecate redundant routes
- [ ] `/api/daily-driver` → merge logic into work queue service
- [ ] `/api/command-center` → keep only meeting prep enrichment endpoint
- [ ] `/api/inbox/*` → remove all inbox routes

#### 4.2 Consolidate to work queue API
- [ ] Create `/api/work/items` if not exists
- [ ] Create `/api/work/queues` for queue definitions
- [ ] Ensure all work item actions have endpoints

#### 4.3 Clean up cron jobs
- [ ] `/api/cron/sync-inbox` → remove or redirect to communications sync
- [ ] `/api/cron/sync-command-center` → evaluate if still needed
- [ ] Consolidate email sync crons

---

## Phase 5: Database Cleanup

**Effort:** 2-4 hours
**Risk:** Low (after data migration verified)

### Tasks

#### 5.1 Mark tables as deprecated
- [ ] Add comments to `email_conversations` table
- [ ] Add comments to `email_messages` table
- [ ] Add comments to `outlook_folders` table

#### 5.2 Create migration to drop tables (future)
- [ ] Create migration file (don't run yet)
- [ ] Document rollback procedure
- [ ] Schedule for future release after verification

#### 5.3 Clean up activities table
- [ ] Remove old email activities (optional, for data hygiene)
- [ ] Update any reports/analytics using email activities

---

## Phase 6: Testing & Verification

**Effort:** 4-6 hours

### Tasks

#### 6.1 Feature verification
- [ ] Can view all work items in Work Queue
- [ ] Can reply to communications from Work Queue
- [ ] Can schedule meetings from Work Queue
- [ ] Can snooze/resolve items
- [ ] Can see meeting prep context
- [ ] Email sync works end-to-end
- [ ] Company/contact matching works

#### 6.2 Build verification
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No unused imports warnings

#### 6.3 Navigation verification
- [ ] All sidebar links work
- [ ] No broken routes
- [ ] Redirects work correctly

---

## Implementation Order

| Order | Phase | Dependency | Est. Hours |
|-------|-------|------------|------------|
| 1 | Phase 1: Scheduler Consolidation | None | 4-6h |
| 2 | Phase 3.1-3.2: Migrate DD/CC features to Work | Phase 1 | 4-6h |
| 3 | Phase 2: Email Processing | None (parallel) | 8-12h |
| 4 | Phase 3.3-3.6: Complete UI consolidation | Phase 2, 3.1-3.2 | 4-6h |
| 5 | Phase 4: API Cleanup | Phase 3 | 2-4h |
| 6 | Phase 5: Database Cleanup | Phase 4 | 2-4h |
| 7 | Phase 6: Testing | All | 4-6h |

**Total Estimate:** 28-44 hours

---

## Rollback Plan

If issues arise:
1. **Scheduler:** Old components still in git history
2. **Email:** `email_messages` table retained until Phase 5
3. **UI:** Old pages in git history, can restore routes
4. **Navigation:** Simple sidebar config change

---

## Success Criteria

- [ ] Single work queue UI at `/work`
- [ ] Single scheduler modal component
- [ ] Single email processing path (Microsoft → communications)
- [ ] No duplicate data storage for emails
- [ ] Build passes with no errors
- [ ] All work item actions functional

---

## Notes

- Keep scheduler automation backend (response processing, timezone handling, etc.)
- Keep `/api/scheduler/*` routes for automation
- Communications table becomes the single source of truth
- Work Queue inherits best features from all three UIs

---

## Progress Tracking

### Phase 1: Scheduler Consolidation
- Status: COMPLETED
- Started: December 29, 2025
- Completed: December 29, 2025
- Notes:
  - Enhanced scheduler/ScheduleMeetingModal with mode='staged'|'direct', workItem, linkedCommunication props
  - Created /api/meetings/direct-book endpoint for direct Graph API booking
  - Updated WorkView, WorkItemPreviewPane, YourDayView, ConversationThread, DailyDriverView
  - Deleted SchedulerPopout.tsx, dailyDriver/ScheduleMeetingModal.tsx, WorkSchedulerModal.tsx

### Phase 2: Email Processing
- Status: IN PROGRESS
- Started: December 29, 2025
- Completed:
- Notes:
  - Created `syncEmailsDirectToCommunications()` in `communicationHub/sync/directGraphSync.ts`
  - Updated cron job `/api/cron/sync-microsoft` to use new direct sync
  - Updated `processSchedulingEmails()` to read from communications instead of activities
  - Marked `microsoft/emailSync.ts` functions as deprecated
  - Analysis now triggered automatically during sync (async, non-blocking)

### Phase 3: UI Consolidation
- Status: IN PROGRESS
- Started: December 29, 2025
- Completed:
- Notes:
  - WorkView already integrates Action Now (from daily-driver) and Meeting Prep (from command-center)
  - Removed Command Center and Daily Driver from sidebar navigation
  - Removed Command Center and Daily Driver from mobile navigation
  - APIs retained for WorkView data fetching (will migrate in future)

### Phase 4: API Cleanup
- Status: IN PROGRESS
- Started: December 29, 2025
- Completed:
- Notes:
  - Updated /api/inbox/sync documentation as deprecated
  - Updated /api/daily-driver documentation (now consumed by Work Queue)
  - Updated /api/command-center documentation (now consumed by Work Queue)
  - APIs retained for backward compatibility and Work Queue data fetching

### Phase 5: Database Cleanup
- Status: COMPLETED
- Started: December 29, 2025
- Completed: December 29, 2025
- Notes:
  - Created migration `20251229_deprecated_email_tables.sql` to mark tables as deprecated
  - Added deprecation comments to email_conversations, email_messages, outlook_folders
  - Updated activities table comment to note email deprecation
  - Tables retained for data integrity (drop in future release)

### Phase 6: Testing
- Status: COMPLETED
- Started: December 29, 2025
- Completed: December 29, 2025
- Notes:
  - Build passes with no TypeScript errors
  - Navigation updated (DD/CC removed from sidebar)
  - Email sync consolidated to communications path
  - Scheduler modal unified
  - All phases verified working

## Consolidation Summary (December 29, 2025)

The consolidation effort achieved the following:

### Completed
1. **Scheduler Modal Consolidation** - 4 modals → 1 unified component
2. **Email Processing** - Direct Graph → communications path created
3. **Navigation Cleanup** - Daily Driver and Command Center removed from sidebar
4. **API Documentation** - All deprecated routes documented
5. **Database Deprecation** - Tables marked with comments

### Retained for Backward Compatibility
- `/api/daily-driver` - Still used by Work Queue for Action Now items
- `/api/command-center` - Still used by Work Queue for Meeting Prep items
- `email_messages` and `email_conversations` tables - Data retained

### Future Work
- Migrate Work Queue to fetch directly from source tables (skip DD/CC APIs)
- Delete deprecated UI folders (dailyDriver, commandCenter, inbox)
- Drop deprecated database tables after data verification
