# Consolidation Plan: Email Sync Domain

> **Generated:** 2026-01-01
> **Priority:** HIGH
> **Status:** Analysis Complete - MIGRATION ALREADY IN PROGRESS

---

## Overview

| Metric | Value |
|--------|-------|
| **Canonical Module** | `src/lib/communicationHub/sync/directGraphSync.ts` |
| **Deprecated Module** | `src/lib/microsoft/emailSync.ts` (activities sync) |
| **Files to Modify** | 5+ (cron routes, inbox service) |
| **Estimated Effort** | 2-3 hours |
| **Risk Level** | MEDIUM |

---

## Architecture Evolution

### OLD Architecture (Deprecated)
```
Microsoft Graph → email_messages → activities → matching
```

### NEW Architecture (Canonical)
```
Microsoft Graph → communications → matching → analysis
```

The codebase has already migrated to the new architecture. The old `emailSync.ts` is marked deprecated but kept for backward compatibility.

---

## Current State Analysis

### Canonical Implementation: `src/lib/communicationHub/sync/directGraphSync.ts`

**388 lines** - Direct-to-communications sync

#### Core Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `graphMessageToCommunication()` | 111-197 | Convert Graph message to Communication format |
| `syncEmailsDirectToCommunications()` | 203-370 | Main sync - all folders to communications |
| `syncRecentEmailsDirectToCommunications()` | 375-387 | Quick sync for webhooks |
| `findExistingByExternalId()` | 71-106 | Dedup check with normalization |

#### Key Features
- Writes directly to `communications` table
- Handles noise email classification
- Sets `awaiting_our_response` state
- Triggers async matching and analysis
- Thread response tracking

---

### Deprecated: `src/lib/microsoft/emailSync.ts`

**609 lines** - Legacy sync to activities table

**Line 1-10 (Deprecation Notice):**
```typescript
/**
 * @deprecated - Email sync to activities table is deprecated.
 * Use syncEmailsDirectToCommunications from '@/lib/communicationHub' instead.
 * This file is kept for backward compatibility and sendEmail() function only.
 *
 * Migration path:
 * - syncEmails → syncEmailsDirectToCommunications
 * - syncAllFolderEmails → syncEmailsDirectToCommunications
 * - syncRecentEmails → syncRecentEmailsDirectToCommunications
 */
```

#### Functions to KEEP (Not Duplicates)

| Function | Lines | Purpose | Status |
|----------|-------|---------|--------|
| `sendEmail()` | 498-590 | Send email via Graph | KEEP - unique functionality |

#### Functions to REMOVE (Duplicated)

| Function | Lines | Canonical Replacement |
|----------|-------|----------------------|
| `syncEmails()` | 45-242 | `syncEmailsDirectToCommunications()` |
| `syncAllFolderEmails()` | 250-486 | `syncEmailsDirectToCommunications()` |
| `syncRecentEmails()` | 596-608 | `syncRecentEmailsDirectToCommunications()` |

---

## Consumer Mapping

### Consumers of Deprecated `syncEmails`

| File | Import | Current Usage |
|------|--------|---------------|
| `src/app/api/cron/sync-microsoft/route.ts` | UNKNOWN | Need to verify |
| `src/app/api/microsoft/sync/route.ts` | UNKNOWN | Need to verify |

### Consumers of `sendEmail` (KEEP)

| File | Import | Status |
|------|--------|--------|
| `src/app/api/microsoft/send/route.ts` | `sendEmail` | KEEP |
| `src/app/api/communications/send-reply/route.ts` | `sendEmail` | KEEP |
| `src/app/api/attention-flags/[id]/send-email/route.ts` | `sendEmail` | KEEP |
| `src/app/api/scheduler/requests/[id]/send/route.ts` | `sendEmail` | KEEP |

---

## Migration Plan

### Pre-Migration Checklist

- [ ] Verify all cron routes use canonical sync
- [ ] Backup/branch created
- [ ] Communications table has all expected data

---

### Step 1: Audit Cron Route Imports

**Files to Check:**
- `src/app/api/cron/sync-microsoft/route.ts`
- `src/app/api/cron/sync-inbox/route.ts`
- `src/app/api/cron/sync-communications/route.ts`

**Expected:** Should import from `@/lib/communicationHub`

---

### Step 2: Extract `sendEmail` to Dedicated Module

**New File:** `src/lib/microsoft/sendEmail.ts`

Extract the `sendEmail()` function (lines 498-590) from `emailSync.ts` to its own module.

**Why:** The `sendEmail` function is not deprecated and is used by 4+ consumers. It should not be in a deprecated file.

```typescript
// src/lib/microsoft/sendEmail.ts
import { getValidToken } from './auth';

const EMAIL_DRAFT_ONLY_MODE = true;

export async function sendEmail(
  userId: string,
  to: string[],
  subject: string,
  body: string,
  cc?: string[],
  isHtml: boolean = false
): Promise<{ success: boolean; error?: string; isDraft?: boolean; messageId?: string; conversationId?: string }> {
  // ... function body from emailSync.ts lines 506-590
}
```

**Risk:** LOW - Extract only, no behavior change
**Test:** Send an email through scheduler, verify works

---

### Step 3: Update Consumers of `sendEmail`

**Files to Update:**
```typescript
// OLD
import { sendEmail } from '@/lib/microsoft/emailSync';

// NEW
import { sendEmail } from '@/lib/microsoft/sendEmail';
```

| File | Change |
|------|--------|
| `src/app/api/microsoft/send/route.ts` | Update import |
| `src/app/api/communications/send-reply/route.ts` | Update import |
| `src/app/api/attention-flags/[id]/send-email/route.ts` | Update import |
| `src/app/api/scheduler/requests/[id]/send/route.ts` | Update import |

**Risk:** LOW - Import path change only

---

### Step 4: Remove Deprecated Sync Functions

**File:** `src/lib/microsoft/emailSync.ts`

After verifying no consumers remain:
1. Remove `syncEmails()` (lines 45-242)
2. Remove `syncAllFolderEmails()` (lines 250-486)
3. Remove `syncRecentEmails()` (lines 596-608)
4. Remove related helper functions

**Alternative:** Keep file as-is but ensure no new code uses deprecated functions

**Risk:** MEDIUM - Must verify no remaining consumers

---

### Step 5: Update Re-exports

**File:** `src/lib/microsoft/index.ts`

```typescript
// Add
export { sendEmail } from './sendEmail';

// Remove (or keep for backward compat with warning)
// export { syncEmails, syncAllFolderEmails, syncRecentEmails } from './emailSync';
```

---

## Post-Migration Checklist

- [ ] All cron jobs use canonical sync from communicationHub
- [ ] `sendEmail` works from new location
- [ ] No TypeScript import errors
- [ ] Email sync cron runs successfully
- [ ] Email sending from scheduler works

---

## Summary

The migration to the canonical sync is already well underway. The main remaining work is:

1. **Extract `sendEmail`** to its own module (since it's not deprecated)
2. **Update 4 import paths** for consumers of `sendEmail`
3. **Verify cron routes** use canonical sync

**Recommendation:** HIGH priority for clean separation, but LOW risk since architecture migration is complete.

