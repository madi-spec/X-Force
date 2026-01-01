# Consolidation Plan: Entity Matching Domain

> **Generated:** 2026-01-01
> **Priority:** HIGH
> **Status:** Analysis Complete

---

## Overview

| Metric | Value |
|--------|-------|
| **Canonical Module** | `src/lib/intelligence/entityMatcher.ts` |
| **Duplicates to Remove** | 1 (partial logic in transcriptUtils.ts) |
| **Files to Modify** | 3 |
| **Estimated Effort** | 1-2 hours |
| **Risk Level** | LOW |

---

## Current State Analysis

### Canonical Implementation: `src/lib/intelligence/entityMatcher.ts`

**933 lines** - Full-featured AI-powered entity matching

#### Core Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `extractRawIdentifiers()` | 121-202 | Extract emails, phones, names, companies from text |
| `extractCompaniesFromContent()` | 212-270 | AI extraction of company names from email body |
| `matchExtractedCompanies()` | 276-350 | Match extracted names to database companies |
| `findCandidateCompanies()` | 359-429 | Query database for company candidates |
| `findCandidateContacts()` | 434-523 | Query database for contact candidates |
| `callAIForMatching()` | 532-701 | Claude AI disambiguation |
| `intelligentEntityMatch()` | 717-932 | Main entry point - orchestrates full matching |

#### Key Features
- AI-powered disambiguation using Claude
- Multi-strategy candidate lookup (domain, name, email)
- Confidence thresholds (AUTO_MATCH: 0.85, LIKELY_MATCH: 0.70)
- Auto-creation of companies/contacts when no match
- Common email domain filtering (gmail, yahoo, etc.)

---

### Duplicate #1: `src/lib/fireflies/transcriptUtils.ts`

**Lines 377-412** - `findSimilarCompanies()` function

#### Evidence of Duplication

```typescript
// transcriptUtils.ts:377-412
async function findSimilarCompanies(
  companyName: string,
  limit: number = 5
): Promise<Array<{ id: string; name: string; status: string; similarity: string }>> {
  // Simple word-matching similarity
  const searchTerms = companyName.toLowerCase().split(/\s+/);
  const matches = companies.map((c) => {
    const nameLower = c.name.toLowerCase();
    const matchedTerms = searchTerms.filter(
      (term) => nameLower.includes(term) || term.includes(nameLower.split(/\s+/)[0])
    );
    const similarity = matchedTerms.length / searchTerms.length;
    return { ...c, similarity, matchedTerms: matchedTerms.length };
  })
```

**Similar to:** `entityMatcher.ts:findCandidateCompanies()` (lines 359-429)

**Differences:**
- `transcriptUtils.ts` uses simple word-matching
- `entityMatcher.ts` uses domain + name + email multi-strategy + AI

---

### Files Already Using Canonical

| File | Import | Status |
|------|--------|--------|
| `src/lib/intelligence/contextFirstPipeline.ts` | `intelligentEntityMatch` | CORRECT |
| `src/lib/email/processInboundEmail.ts` | Uses `contextFirstPipeline` | CORRECT (via pipeline) |
| `src/lib/fireflies/sync.ts` | Should use `intelligentEntityMatch` | NEEDS REVIEW |

---

## Migration Plan

### Pre-Migration Checklist

- [ ] All tests passing on current code
- [ ] `entityMatcher.ts` exports all needed functions
- [ ] Backup/branch created

---

### Step 1: Verify `findSimilarCompanies` Consumers

**Action:** Search for calls to `findSimilarCompanies` in transcriptUtils

```bash
grep -rn "findSimilarCompanies" src/
```

**Expected:** Only called internally within `transcriptUtils.ts` for review task creation
**Risk:** NONE (internal function)

---

### Step 2: Update `transcriptUtils.ts` to Delegate

**File:** `src/lib/fireflies/transcriptUtils.ts`

**Current (line 7-9):**
```typescript
// Migrated from transcriptEntityMatcher.ts - entity matching now uses
// intelligentEntityMatch from @/lib/intelligence/entityMatcher
```

**This is already documented as deprecated!**

**Option A (Quick):** Add import and delegate
```typescript
import { findCandidateCompanies } from '@/lib/intelligence/entityMatcher';

// Replace findSimilarCompanies with wrapper
async function findSimilarCompanies(companyName: string, limit: number = 5) {
  const candidates = await findCandidateCompanies({
    domains: [],
    nameFragments: companyName.split(' ').slice(0, 3),
    emailDomains: [],
  });
  return candidates.slice(0, limit).map(c => ({
    id: c.id,
    name: c.name,
    status: 'unknown', // Not needed for review tasks
    similarity: 'matched',
  }));
}
```

**Option B (Full):** Remove `findSimilarCompanies` entirely since it's only used for review task descriptions (not critical path)

**Risk:** LOW - Only affects review task descriptions
**Test:** Create a transcript review task, verify similar companies still appear

---

### Step 3: Verify Fireflies Sync Uses Canonical

**File:** `src/lib/fireflies/sync.ts`

**Check:** Verify it delegates to `intelligentEntityMatch` for matching

```typescript
// Expected pattern:
import { intelligentEntityMatch } from '@/lib/intelligence/entityMatcher';
```

---

## Post-Migration Checklist

- [ ] All tests passing
- [ ] Transcript sync still matches transcripts to companies
- [ ] Review tasks still show similar companies
- [ ] No direct imports of deleted/modified functions remain

---

## Summary

This domain is already well-consolidated. The canonical `entityMatcher.ts` is used by the main pipelines. Only minor cleanup needed in `transcriptUtils.ts` to remove the redundant `findSimilarCompanies` or delegate to canonical.

**Recommendation:** LOW priority - the duplicate is isolated and non-critical.

