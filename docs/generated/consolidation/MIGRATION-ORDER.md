# Consolidation Migration Order

> **Generated:** 2026-01-01
> **Status:** Ready for Execution

---

## Executive Summary

After deep analysis of 8 identified domains, the consolidation effort is **smaller than expected**. The codebase has already evolved toward canonical patterns, with clear deprecation markers and migration paths.

---

## Migration Priority Matrix

| Priority | Domain | Effort | Risk | Status |
|----------|--------|--------|------|--------|
| 1 | Email Sync | 2h | LOW | Deprecated functions, migration in progress |
| 2 | Entity Matching | 1h | LOW | Well-consolidated, minor cleanup |
| 3 | Context Building | 2h | MEDIUM | Multiple approaches, need to unify |
| 4 | Health Score | 1h | LOW | Two valid approaches (AI vs deterministic) |
| 5 | Draft Generation | 1h | LOW | Multiple entry points, same backend |
| 6 | Transcript Analysis | 1h | LOW | Consolidated around pipelines |
| 7 | Meeting Prep | 30m | LOW | Already consolidated |
| 8 | Email Sending | 0h | DONE | Already uses single `sendEmail()` |

---

## Recommended Execution Order

### Wave 1: Quick Wins (Same Day)

#### 1.1 Email Sync - Extract `sendEmail`
- Extract `sendEmail()` from `emailSync.ts` to `sendEmail.ts`
- Update 4 import paths
- Verify cron routes use canonical sync

#### 1.2 Entity Matching - Document as Complete
- Verify `intelligentEntityMatch` is used everywhere
- Mark `transcriptUtils.findSimilarCompanies` as internal-only

---

### Wave 2: Medium Complexity (1-2 Days)

#### 2.1 Context Building - Create Unified Interface
- Audit all context building functions
- Create facade pattern if needed
- Don't force single implementation

#### 2.2 Draft Generation - Document Patterns
- All draft generation already uses consistent patterns
- Document the patterns rather than consolidate

---

### Wave 3: Architectural Decisions (Deferred)

#### 3.1 Health Score - Choose Approach
**Decision Required:** Which approach is canonical?
- AI-based (src/lib/ai/health-score.ts)
- Deterministic (src/lib/lifecycle/engagementHealthEvaluator.ts)

**Recommendation:** Keep both - they serve different purposes
- AI-based: Rich analysis, slower, for summaries
- Deterministic: Fast, reliable, for real-time UI

---

## No Action Required

These domains were initially flagged but are already consolidated:

| Domain | Finding |
|--------|---------|
| Email Sending | All consumers use `sendEmail` from `emailSync.ts` |
| Meeting Prep | Single implementation in `commandCenter/meetingPrep.ts` |
| Transcript Analysis | Consolidated around `pipelines/processTranscriptAnalysis.ts` |

---

## Detailed Plans

| Domain | Plan Document |
|--------|---------------|
| Entity Matching | [ENTITY-MATCHING-PLAN.md](./ENTITY-MATCHING-PLAN.md) |
| Email Sync | [EMAIL-SYNC-PLAN.md](./EMAIL-SYNC-PLAN.md) |

---

## Verification Commands

### Check for deprecated imports
```bash
# Should return 0 results after migration
grep -rn "from.*emailSync.*syncEmails" src/
grep -rn "from.*emailSync.*syncAllFolderEmails" src/
```

### Verify canonical imports
```bash
# Should show all sync uses canonical
grep -rn "syncEmailsDirectToCommunications" src/

# Should show all entity matching uses canonical
grep -rn "intelligentEntityMatch" src/
```

---

## Success Metrics

After consolidation:

| Metric | Before | After |
|--------|--------|-------|
| Email sync implementations | 2 | 1 (communicationHub) |
| Entity matching implementations | 2 | 1 (entityMatcher) |
| Context building patterns | 4 | 2 (documented patterns) |
| Deprecated function calls | Unknown | 0 |

---

## Risk Mitigation

1. **Run tests after each change** - Don't batch changes
2. **Keep deprecated files** - Mark as deprecated, don't delete
3. **Monitor production** - Check for errors after deploy
4. **Rollback plan** - Git revert is sufficient

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Analysis | Complete | This document |
| Wave 1 | 2-3 hours | Email sync + Entity matching cleanup |
| Wave 2 | 1-2 days | Context building + Draft generation docs |
| Wave 3 | Deferred | Health score decision |

