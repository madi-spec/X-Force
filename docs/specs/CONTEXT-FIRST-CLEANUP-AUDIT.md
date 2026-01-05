# Context-First Architecture Cleanup Audit

**Generated:** 2025-12-21
**Phase Status:** Phase 1 (Context-First Pipeline) COMPLETE

---

## Executive Summary

The context-first architecture introduces a new paradigm where **company/deal is the SOURCE OF TRUTH** and AI does all entity matching (no keyword fallbacks). This creates significant overlap with legacy systems that need cleanup.

**Key Findings:**
- 3 competing entity matching systems (2 should be deprecated)
- 2 competing context builders (1 should be deprecated)
- 6+ API endpoints using legacy systems
- Database schema is ready (relationship_intelligence table exists)

---

## 1. Intelligence Files Audit

### Status Legend
- 🟢 **ACTIVE** - Core to new architecture, actively maintained
- 🟡 **TRANSITION** - Currently used, should migrate to new pipeline
- 🔴 **DEPRECATED** - Should be removed or consolidated
- ⚪ **UNRELATED** - Different purpose, no conflict

### `src/lib/intelligence/` Files

| File | Status | Purpose | Notes |
|------|--------|---------|-------|
| **entityMatcher.ts** | 🟢 ACTIVE | AI-powered entity matching (Phase 1A) | NEW - Uses Claude for all matching |
| **contextFirstPipeline.ts** | 🟢 ACTIVE | Full processing pipeline (Phase 1B) | NEW - Main entry point |
| **autoLinkEntities.ts** | 🔴 DEPRECATED | Fuzzy string matching, no AI | Replace with entityMatcher |
| **buildRelationshipContext.ts** | 🔴 DEPRECATED | Old context loading | Duplicates contextFirstPipeline.buildFullRelationshipContext |
| **analyzeInboundEmail.ts** | 🟡 TRANSITION | Email analysis with old linking | Migrate to use contextFirstPipeline |
| **analyzeOutboundEmail.ts** | 🟡 TRANSITION | Outbound email analysis | Migrate to use contextFirstPipeline |
| **updateRelationshipFromAnalysis.ts** | 🟡 TRANSITION | Update relationship from analysis | Similar to contextFirstPipeline.updateRelationshipIntelligence |
| **reconcileActions.ts** | 🟢 ACTIVE | Action reconciliation logic | Keep - used by pipeline |
| **relationshipStore.ts** | 🟢 ACTIVE | Relationship data storage | Keep - storage layer |
| **salesPlaybook.ts** | 🟢 ACTIVE | Sales playbook definitions | Keep - reference data |
| **generateMeetingPrep.ts** | 🟢 ACTIVE | Meeting prep generation | Keep - different purpose |
| **orchestrator.ts** | ⚪ UNRELATED | Company research orchestration | Keep - different purpose |
| **types.ts** | 🟢 ACTIVE | Type definitions | Keep |
| **dataLayerTypes.ts** | 🟢 ACTIVE | Data layer types | Keep |
| **index.ts** | 🟡 TRANSITION | Exports | Update to export new functions |

### `src/lib/ai/` Entity Matchers

| File | Status | Purpose | Notes |
|------|--------|---------|-------|
| **transcriptEntityMatcher.ts** | 🔴 DEPRECATED | Transcript matching (loads all entities) | Replace with entityMatcher |
| **activityEntityMatcher.ts** | 🔴 DEPRECATED | Activity matching (loads all entities) | Replace with entityMatcher |
| **contactDetectionService.ts** | 🟡 TRANSITION | Contact detection from transcripts | May need migration |

---

## 2. API Endpoints Using Legacy Systems

### Endpoints to Migrate

| Endpoint | Current System | Action Required |
|----------|---------------|-----------------|
| `api/command-center/[itemId]/context` | buildRelationshipContext | Migrate to contextFirstPipeline |
| `api/command-center/[itemId]/add-context` | analyzeInboundEmail, buildRelationshipContext | Migrate to contextFirstPipeline |
| `api/calendar/[meetingId]/prep` | generateMeetingPrep (uses buildRelationshipContext) | Migrate |
| `api/tasks/resolve-transcript-review` | transcriptEntityMatcher | Migrate to entityMatcher |

### Endpoints Already Good

| Endpoint | System Used | Status |
|----------|-------------|--------|
| `api/intelligence/[companyId]/*` | Research orchestrator | ✅ Unrelated to entity matching |
| `api/intelligence-v61/*` | Research agent v61 | ✅ Unrelated to entity matching |
| `api/deals/[id]/intelligence` | Deal intelligence engine | ✅ Unrelated |
| `api/leverage-moments/*` | Leverage detection | ✅ Unrelated |

### Integration Points to Add

| Integration Point | Current State | Required Change |
|-------------------|---------------|-----------------|
| Email sync (Microsoft Graph) | Uses analyzeInboundEmail | Call processIncomingCommunication |
| Fireflies transcript sync | Uses transcriptEntityMatcher | Call processIncomingCommunication |
| Calendar event processing | Direct DB writes | Call processIncomingCommunication |
| Form submissions | Manual linking | Call processIncomingCommunication |

---

## 3. Database Schema Status

### Existing Tables (Ready)

| Table | Status | Notes |
|-------|--------|-------|
| `relationship_intelligence` | ✅ READY | Full schema with context, interactions, commitments, signals |
| `relationship_notes` | ✅ READY | Salesperson notes |
| `command_center_items` | ✅ READY | Uses momentum_score (not tier) |
| `contact_meeting_mentions` | ✅ READY | Contact provenance tracking |

### Schema Changes Needed

| Change | Priority | Migration File |
|--------|----------|----------------|
| Add `tier` column to command_center_items | Medium | (Optional - using momentum_score works) |
| Add `source` enum values for new pipeline | Low | Add 'context_first_pipeline' |

### Schema for Phases 2-5

| Phase | Schema Status | Missing Tables |
|-------|---------------|----------------|
| Phase 2 (Forms/Submissions) | ⚠️ PARTIAL | Need form_submissions table |
| Phase 3 (Transcript Processing) | ✅ READY | meeting_transcriptions exists |
| Phase 4 (Command Center View) | ✅ READY | command_center_items exists |
| Phase 5 (Cron/Batch) | ✅ READY | Can use existing tables |

---

## 4. Duplicate/Conflicting Functions

### Entity Matching (3 Competing Systems)

```
┌──────────────────────────────────────────────────────────────┐
│                    ENTITY MATCHING                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🟢 NEW (Use This)                                           │
│  ├── entityMatcher.ts                                        │
│  │   └── intelligentEntityMatch() - AI-powered               │
│  │       └── findCandidateCompanies()                        │
│  │       └── findCandidateContacts()                         │
│  │       └── callAIForMatching()                             │
│  │                                                           │
│  🔴 DEPRECATED (Remove)                                      │
│  ├── autoLinkEntities.ts                                     │
│  │   └── autoLinkEntities() - Fuzzy string matching          │
│  │       └── findCompanyByExactName()                        │
│  │       └── findCompanyByDomain()                           │
│  │       └── findCompanyFuzzy()                              │
│  │                                                           │
│  🔴 DEPRECATED (Remove)                                      │
│  ├── transcriptEntityMatcher.ts                              │
│  │   └── aiMatchTranscriptToEntities() - Loads ALL entities  │
│  ├── activityEntityMatcher.ts                                │
│  │   └── aiMatchActivityToEntities() - Loads ALL entities    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Context Building (2 Competing Systems)

```
┌──────────────────────────────────────────────────────────────┐
│                    CONTEXT BUILDING                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🟢 NEW (Use This)                                           │
│  ├── contextFirstPipeline.ts                                 │
│  │   └── buildFullRelationshipContext()                      │
│  │   └── analyzeWithFullContext()                            │
│  │   └── updateRelationshipIntelligence()                    │
│  │   └── determineActionsWithContext()                       │
│  │                                                           │
│  🔴 DEPRECATED (Remove)                                      │
│  ├── buildRelationshipContext.ts                             │
│  │   └── buildRelationshipContext()                          │
│  ├── updateRelationshipFromAnalysis.ts                       │
│  │   └── updateRelationshipFromAnalysis()                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Function Comparison

| Function | Old Location | New Location | Differences |
|----------|--------------|--------------|-------------|
| Entity matching | autoLinkEntities.autoLinkEntities | entityMatcher.intelligentEntityMatch | AI vs fuzzy string |
| Context loading | buildRelationshipContext.buildRelationshipContext | contextFirstPipeline.buildFullRelationshipContext | Similar structure, new has formattedForAI |
| Relationship update | updateRelationshipFromAnalysis.updateRelationshipFromAnalysis | contextFirstPipeline.updateRelationshipIntelligence | Similar logic |
| Action creation | analyzeInboundEmail (inline) | contextFirstPipeline.determineActionsWithContext | Consolidated |

---

## 5. Prioritized Cleanup Recommendations

### Phase 1: Immediate (Week 1)

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P0 | Export new functions from intelligence/index.ts | Enables migration | Low |
| P0 | Add deprecation comments to autoLinkEntities.ts | Prevents new usage | Low |
| P0 | Add deprecation comments to buildRelationshipContext.ts | Prevents new usage | Low |
| P1 | Migrate api/command-center/[itemId]/context to use contextFirstPipeline | Direct benefit | Medium |
| P1 | Migrate api/command-center/[itemId]/add-context to use contextFirstPipeline | Direct benefit | Medium |

### Phase 2: Short-term (Week 2-3)

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P1 | Migrate analyzeInboundEmail.ts to use entityMatcher | Unified matching | Medium |
| P1 | Migrate analyzeOutboundEmail.ts to use entityMatcher | Unified matching | Medium |
| P2 | Update Fireflies sync to use processIncomingCommunication | End-to-end pipeline | High |
| P2 | Update email sync to use processIncomingCommunication | End-to-end pipeline | High |

### Phase 3: Medium-term (Week 3-4)

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P2 | Remove transcriptEntityMatcher.ts | Code cleanup | Low |
| P2 | Remove activityEntityMatcher.ts | Code cleanup | Low |
| P3 | Consolidate buildRelationshipContext.ts into contextFirstPipeline | Code cleanup | Medium |
| P3 | Consolidate updateRelationshipFromAnalysis.ts | Code cleanup | Medium |

### Phase 4: Cleanup (Week 4+)

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| P3 | Remove deprecated functions from autoLinkEntities.ts | Final cleanup | Low |
| P3 | Remove deprecated files | Final cleanup | Low |
| P3 | Update all tests to use new pipeline | Test coverage | Medium |
| P4 | Performance optimization of new pipeline | Speed improvement | Medium |

---

## 6. Migration Checklist

### For Each Legacy Caller

- [ ] Identify current function being called
- [ ] Map to equivalent new function
- [ ] Update imports
- [ ] Adjust parameter structure (CommunicationInput)
- [ ] Handle ProcessingResult response
- [ ] Test with real data
- [ ] Remove old code path

### New Pipeline Usage Pattern

```typescript
// OLD WAY (multiple files, multiple calls)
import { autoLinkEntities } from './autoLinkEntities';
import { buildRelationshipContext } from './buildRelationshipContext';
import { analyzeInboundEmail } from './analyzeInboundEmail';

const linked = await autoLinkEntities({ email, name, ... });
const context = await buildRelationshipContext({ contactId: linked.contact_id });
const analysis = await analyzeInboundEmail({ email, context });

// NEW WAY (single call)
import { processIncomingCommunication } from './contextFirstPipeline';

const result = await processIncomingCommunication({
  type: 'email_inbound',
  from_email: email.from,
  from_name: email.fromName,
  subject: email.subject,
  body: email.body,
}, userId);

// result contains: company, contact, deal, contextBefore, contextAfter,
// analysisWithContext, actionsCreated, actionsUpdated, actionsCompleted
```

---

## 7. Files to Delete After Migration

```
src/lib/intelligence/autoLinkEntities.ts          # After all callers migrated
src/lib/intelligence/buildRelationshipContext.ts  # After all callers migrated
src/lib/intelligence/updateRelationshipFromAnalysis.ts  # After consolidation
src/lib/ai/transcriptEntityMatcher.ts             # After Fireflies sync migrated
src/lib/ai/activityEntityMatcher.ts               # After activity processing migrated
```

---

## 8. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Entity matching calls | 3 systems | 1 system | Grep for imports |
| Context building calls | 2 systems | 1 system | Grep for imports |
| AI matching confidence | N/A | ≥85% average | Log and track |
| Processing time | ~25-30s | <20s | Measure in tests |
| Code duplication | High | Low | Lines of code count |

---

## Appendix: File Locations

### New Architecture Files
```
src/lib/intelligence/entityMatcher.ts           # AI entity matching
src/lib/intelligence/contextFirstPipeline.ts    # Full pipeline
```

### Test Scripts
```
scripts/test-entity-matcher.ts                  # Entity matcher tests
scripts/test-context-pipeline.ts                # Pipeline tests
scripts/integration-test-pipeline.ts            # Integration tests
scripts/integration-test-known-contact.ts       # Known contact test
```

### Key Migrations
```
supabase/migrations/20251231_relationship_intelligence_full.sql  # Main schema
supabase/migrations/20251219_command_center_v31.sql              # Command center
```
