# X-FORCE CRM: Project State Document

**Last Updated:** December 24, 2024
**Purpose:** Single source of truth for project context, progress, and next steps
**Status:** 🚀 **PRODUCT-CENTRIC REDESIGN** - Transforming from deal pipeline to product adoption platform

---

## 🚨 CRITICAL: READ FIRST EVERY SESSION

**Before making ANY code changes, read `/docs/specs/X-FORCE-ARCHITECTURAL-RULES.md`**

### The #1 Rule: NO KEYWORD MATCHING FOR INTELLIGENCE

```typescript
// ❌ NEVER DO THIS:
if (text.includes('trial')) { tier = 1; }

// ✅ ALWAYS DO THIS:
const analysis = await processIncomingCommunication(email);
const tier = SALES_PLAYBOOK.communication_types[analysis.communicationType].tier;
```

**ALL intelligence comes from: AI Analysis → communicationType → Sales Playbook**

---

### Codebase Metrics
| Metric | Value |
|--------|-------|
| TypeScript/TSX Files | 454 |
| API Endpoints | 116 |
| Database Tables | 50+ |
| UI Pages | 35 |
| Components | 116 |
| Vision Alignment | ~75% |

---

## Quick Links to Spec Documents

| Document | Location | Purpose |
|----------|----------|---------|
| **🚀 PRODUCT-CENTRIC REDESIGN** | `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md` | **NEW: Transform to product adoption platform** |
| **🚨 ARCHITECTURAL RULES** | `/docs/specs/X-FORCE-ARCHITECTURAL-RULES.md` | **READ FIRST — No keywords, AI analysis only** |
| **Communication Hub** | `/docs/specs/X-FORCE-Communication-Hub-Specification-v2.md` | Unified conversation view (Phases 1-3 complete) |
| **AI Scheduler Wiring** | `/docs/specs/CLAUDE-CODE-PROMPT-AI-Scheduler-Wiring.md` | ✅ COMPLETE |
| **Platform Vision** | `/docs/specs/X-FORCE-CRM-Platform-Vision.md` | Complete platform vision with all 10 components |
| **Codebase Map** | `/docs/CODEBASE-MAP.md` | Comprehensive mapping of 454 files, 116 endpoints |
| **Tier Detection** | `src/lib/commandCenter/tierDetection.ts` | COMMUNICATION_TYPE_TIERS mapping (source of truth for tiers) |
| **Sales Playbook** | `src/lib/intelligence/salesPlaybook.ts` | Communication types and workflow definitions |
| **Context-First Architecture** | `/docs/specs/CLAUDE-CODE-PROMPT-Context-First-Architecture.md` | Core architectural redesign (Phases 1-5) |
| **AI Scheduler Spec** | `/docs/specs/CLAUDE-CODE-PROMPT-AI-Scheduler.md` | Full scheduler specification (~3800 lines) |

---

## Current Implementation State

### ✅ COMPLETE

| Component | Files | Completeness | Notes |
|-----------|-------|--------------|-------|
| Basic CRM Structure | companies, contacts, deals tables | 100% | Working |
| Microsoft Email Sync | `src/lib/microsoft/` | 85% | Bi-directional sync working |
| Microsoft Calendar Sync | `src/lib/microsoft/` | 85% | Meeting sync working |
| Fireflies Integration | `src/lib/fireflies/` | 85% | Transcript import + matching working |
| Sales Playbook | `src/lib/intelligence/salesPlaybook.ts` | 85% | Defines communication types, actions |
| Email Analysis | `src/lib/intelligence/` | 90% | Playbook-based analysis |
| Transcript Analysis | `src/lib/pipelines/` | 90% | Extracts commitments, signals |
| Command Center 5-Tier | `src/lib/commandCenter/` | 95% | 12 endpoints, full UI, reconciliation, **tier system verified** |
| Workflow Cards | `src/components/commandCenter/` | 90% | Single card with checklist |
| Meeting Prep | `src/lib/intelligence/generateMeetingPrep.ts` | 80% | Generates briefings |
| Entity Matcher | `src/lib/intelligence/entityMatcher.ts` | 95% | AI-powered matching |
| Context-First Pipeline | `src/lib/intelligence/contextFirstPipeline.ts` | 95% | Main entry point |
| Relationship Intelligence | `src/lib/intelligence/relationshipStore.ts` | 95% | **+schema refinements** |
| Research Agent v6.1 | `src/lib/intelligence/collectors/` | 80% | Phased research working |
| **Company Page Intelligence** | `src/components/relationship/` | **95%** | **7 UI components (NEW)** |
| **Notes/Corrections API** | `src/app/api/companies/[id]/intelligence/` | **95%** | **Full CRUD + audit (NEW)** |
| **Action Reconciliation** | `src/lib/commandCenter/actionReconciliation.ts` | **95%** | **Cron job ready (NEW)** |

### ✅ FULLY IMPLEMENTED

| Component | Location | Completeness | Notes |
|-----------|----------|--------------|-------|
| Context-First Pipeline | `src/lib/intelligence/` | 100% | Entity matching, relationship building |
| Entity Matcher | `src/lib/intelligence/entityMatcher.ts` | 100% | AI-powered matching + AI body extraction fallback |
| Relationship Intelligence | `src/lib/intelligence/relationshipStore.ts` | 100% | Facts, signals, communication history |
| Sales Playbook | `src/lib/intelligence/salesPlaybook.ts` | 100% | Communication types, workflows |
| Command Center 5-Tier | `src/lib/commandCenter/` | 98% | All 5 tiers, source_id, AI type aliases, View Source working |
| Meeting Prep | `src/lib/meetingPrep/` | 90% | Stakeholder intelligence, talking points |
| Research Agent v6.1 | `src/lib/research/` | 90% | Company intelligence, news, financials |
| **AI Scheduler** | `src/lib/scheduler/` | **95%** | **Full loop: email → response → calendar → no-show** |
| Microsoft Integration | `src/lib/microsoft/` | 90% | Email, Calendar, Graph API |
| Fireflies Integration | `src/lib/fireflies/` | 85% | Transcript sync, analysis |

### ⚠️ PARTIAL IMPLEMENTATION

| Component | Completeness | What Exists | What's Missing |
|-----------|--------------|-------------|----------------|
| Marketing Intelligence | 50% | Collectors exist | Full synthesis, UI components |

### 🎁 FEATURES BEYOND VISION (Not Documented)

| Feature | Location | Purpose |
|---------|----------|---------|
| Deal Rooms | `src/components/deals/DealRoom*.tsx` | Collaborative deal workspace with asset sharing |
| Deal Postmortems | `src/lib/ai/learning/` | Win/loss analysis after deal closes |
| Rep Trust Profiles | `src/lib/ai/learning/repTrustService.ts` | Track rep behavior for AI calibration |
| Human Leverage Moments | `src/lib/ai/leverage/` | AI-triggered alerts for human action |
| SMS Integration | `src/lib/sms/twilioService.ts` | SMS sending via Twilio |
| Email Tracking | `src/lib/tracking/` | Track email opens and clicks |
| Public Deal Rooms | `src/app/room/[slug]/page.tsx` | External-facing deal rooms |
| Pattern Learning System | `src/lib/ai/learning/` | Pattern learning from outcomes |
| Bulk Import System | `src/lib/import/` | Bulk data import |

### ✅ PHASE 2-5 COMPLETE

| Phase | Status | Deliverables |
|-------|--------|--------------|
| Phase 2: Schema | ✅ Complete | Migration with 8 new columns, 5 indexes |
| Phase 3: Company Page | ✅ Complete | Intelligence API + 7 UI components |
| Phase 4: Notes/Corrections | ✅ Complete | 2 API endpoints with audit trail |
| Phase 5: Action Reconciliation | ✅ Complete | Reconciliation service + cron job |

### 🔄 IN PROGRESS

| Task | Status | Next Step |
|------|--------|-----------|
| AI Scheduler Wiring | ✅ **COMPLETE** | All 3 weeks done! |
| Command Center Gap Fixes | ✅ **COMPLETE** | Migration applied |
| Communication Hub | ✅ **PHASE 3 COMPLETE** | Unified conversation view working |
| **Product-Centric Redesign** | 📋 **SPEC COMPLETE** | Phase 1: Foundation |

---

## 🚀 PRODUCT-CENTRIC REDESIGN

**The Big Shift:** From deal-centric CRM to **product adoption platform**

### Why This Change?
- X-RAI's business is **expanding existing VFP customers**, not acquiring new logos
- Different products have different sales motions
- Need to see adoption whitespace (who has what, who needs what)
- Current deals table doesn't capture product-level status

### What Stays (Builds On Existing Work)
| Component | How It Integrates |
|-----------|-------------------|
| **Communication Hub** | Becomes conversation view on company pages |
| **Command Center** | Triggers from product stage changes |
| **Sales Playbook** | Evolves to per-product "proven processes" |
| **AI Scheduler** | Becomes product-stage-aware sequences |
| **Entity Matcher** | Still powers email→company matching |
| **Relationship Intelligence** | Still provides company context |

### What Changes
| Current | New |
|---------|-----|
| `deals` table (one pipeline) | `company_products` table (status per product) |
| Deal stages | Product-specific "proven process" stages |
| Company page shows deals | Company page shows product status grid |
| One sales process | Per-product sales processes |

### New Database Tables
```
products              - Product catalog (X-RAI 2.0, AI Agents, etc.)
product_tiers         - Tier levels (Silver, Gold, Platinum)
company_products      - Status of each product per company
product_sales_stages  - Proven process stages per product
prospecting_pipeline  - Traditional pipeline for non-VFP prospects
```

### Implementation Phases
| Phase | What | Status |
|-------|------|--------|
| 1 | Foundation (tables, products page, seed data) | 📋 Ready |
| 2 | Data Import (VFP customers, AI products, migrate deals) | 📋 Ready |
| 3 | Product UI (pipeline view, company page redesign) | 📋 Ready |
| 4 | Proven Process (stage editor, pitch points, objections) | 📋 Ready |
| 5 | AI Learning (transcript analysis for process improvement) | 📋 Ready |
| 6 | Polish (whitespace analytics, prospecting pipeline) | 📋 Ready |

**Full Spec:** `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md`

---

### 🚀 COMMUNICATION HUB STATUS

**Phase 1 Complete:** ✅ Foundation
- 3 tables: `communications`, `communication_analysis`, `promises`
- 113 communications backfilled (61 emails, 52 meetings)
- Email + Transcript adapters

**Phase 2 Complete:** ✅ Analysis Pipeline
- All 113 communications analyzed (0 errors)
- 45+ promises extracted (5 overdue, 40+ no due date)
- Intelligence: summaries, sentiment, signals, commitments, competitors
- Cron job ready (every 15 min)

**Phase 3 Complete:** ✅ Unified Conversation View
- Three-panel layout (conversation list, thread, customer context)
- `/communications` page live in sidebar
- Channel filters (All, Calls, SMS, Email, Meetings, AI Sent)
- Grouped by company with latest communication
- SWR auto-refresh every 60 seconds

**Integration with Product-Centric Redesign:**
- Communication Hub becomes embedded in Company Page
- Product context shows in right panel
- Promises link to product sales stages

**Known Issues:**
- ⚠️ Email-to-company matching needs improvement (many "Unlinked")
- Fix script ready: `/docs/specs/CLAUDE-CODE-PROMPT-Fix-Email-Company-Matching.md`

**Spec:** `/docs/specs/X-FORCE-Communication-Hub-Specification-v2.md`

### 📋 PLANNED (Product-Centric Redesign)

| Phase | Component | Description | Estimated |
|-------|-----------|-------------|-----------|
| **Phase 1** | Foundation | Products table, company_products, stages, seed data | 1 week |
| **Phase 2** | Data Import | VFP customers, AI products, migrate existing deals | 1 week |
| **Phase 3** | Product UI | Pipeline view per product, company page redesign | 1 week |
| **Phase 4** | Proven Process | Stage editor, pitch points, objection handlers | 1 week |
| **Phase 5** | AI Learning | Transcript analysis, pattern detection, suggestions | 1 week |
| **Phase 6** | Polish | Whitespace analytics, prospecting pipeline, dashboard | 1 week |

### 📋 ALSO PLANNED (Lower Priority)

| Component | Description | Estimated |
|-----------|-------------|-----------|
| Email-Company Matching Fix | Match unlinked emails to companies via domain/contact | 1 day |
| Communication Hub Live Sync | New emails auto-sync to communications table | 2 days |
| Mobile Responsive Design | Mobile-friendly layouts | 1 week |
| Marketing Intelligence UI | Full UI for marketing data | 1 week |

### 🔮 FUTURE (After Product-Centric Redesign)

| Component | Spec Ready | Estimated Effort |
|-----------|------------|------------------|
| Research Agent v3 | ✅ Yes | 2-3 weeks |
| Marketing Intelligence Full | ✅ Yes | 2 weeks |
| Proposal System | ❌ No | TBD |
| Deal Rooms Enhancement | ❌ No | TBD |
| Mobile App | ❌ No | TBD |

---

## Architecture Decisions Made

### 1. Context-First Processing (Dec 21)
**Decision:** Company/deal is source of truth. All processing follows:
```
Identify → Load Context → Analyze with Context → Update Context → Derive Actions
```
**Rationale:** Solves orphaned items, duplicate cards, stale data issues.

### 2. AI-Powered Entity Matching (Dec 21)
**Decision:** No keyword fallbacks. AI reasons about all matching.
**Rationale:** Keywords fail on name variations, franchises, personal emails.

### 3. Workflow Cards (Dec 20)
**Decision:** Single card with checklist instead of multiple cards per event.
**Rationale:** Trial form was creating 3 separate Tier 1 cards, cluttering queue.

### 4. 5-Tier Command Center (Dec 18)
**Decision:** Tiers based on urgency/importance, not just recency.
- Tier 1: Respond Now (minutes)
- Tier 2: Don't Lose This (hours)
- Tier 3: Keep Your Word (same day)
- Tier 4: Move Big Deals (this week)
- Tier 5: Build Pipeline (when you can)

### 5. Playbook-Based Analysis (Dec 17)
**Decision:** AI learns sales process from playbook, not hardcoded rules.
**Rationale:** Customizable, consistent, teaches AI the "why" not just "what."

---

## Known Issues to Fix

| Issue | Severity | Status |
|-------|----------|--------|
| Command Center only Tier 3 & 5 | HIGH | ✅ **FIXED** - 15 type aliases, AI prompt updated |
| Entity matcher doesn't parse email body | HIGH | ✅ **FIXED** - AI extraction added as fallback |
| View Source only on Tier 3 | Medium | ✅ **FIXED** - source_id now set on all CC items |
| deal_stale items wrong tier | Medium | ✅ **FIXED** - Migration to correct to Tier 4 |
| Unknown sender emails ignored | Medium | ✅ **FIXED** - Creates Tier 1 triage items |
| Email→CC pipeline gap | HIGH | ✅ **FIXED** - 100% reliability |
| Keyword-based tier detection | HIGH | ✅ **FIXED** - AI analysis + playbook |
| Empty workflow step titles | Medium | ⚠️ Need to verify |

### Pending: Run Migration
```sql
-- Apply migration to fix deal_stale items
-- File: supabase/migrations/20251223_fix_deal_stale_tier.sql
```

---

## Cleanup Audit Results (Dec 21)

### Competing Systems Found

**Entity Matching (3 systems → 1)**
| System | File | Status |
|--------|------|--------|
| AI-Powered (NEW) | `entityMatcher.ts` | ✅ KEEP |
| Fuzzy String (OLD) | `autoLinkEntities.ts` | ❌ DELETE |
| Load All Entities (OLD) | `transcriptEntityMatcher.ts` | ❌ DELETE |

**Context Building (2 systems → 1)**
| System | File | Status |
|--------|------|--------|
| Context-First (NEW) | `contextFirstPipeline.ts` | ✅ KEEP |
| Old Builder (OLD) | `buildRelationshipContext.ts` | ❌ DELETE |

### Files by Status

| Status | Count | Files |
|--------|-------|-------|
| 🟢 ACTIVE | 8 | entityMatcher, contextFirstPipeline, reconcileActions, relationshipStore, etc. |
| 🟡 TRANSITION | 4 | analyzeInboundEmail, analyzeOutboundEmail, updateRelationshipFromAnalysis, index |
| 🔴 DEPRECATED | 5 | autoLinkEntities, buildRelationshipContext, transcriptEntityMatcher, activityEntityMatcher, updateRelationshipFromAnalysis |

### API Endpoints to Migrate

| Endpoint | Currently Uses | Should Use |
|----------|---------------|------------|
| `command-center/[itemId]/context` | buildRelationshipContext | contextFirstPipeline |
| `command-center/[itemId]/add-context` | analyzeInboundEmail | processIncomingCommunication |
| `tasks/resolve-transcript-review` | transcriptEntityMatcher | entityMatcher |

### Files to Delete After Migration

1. `src/lib/intelligence/autoLinkEntities.ts`
2. `src/lib/intelligence/buildRelationshipContext.ts`
3. `src/lib/intelligence/updateRelationshipFromAnalysis.ts`
4. `src/lib/ai/transcriptEntityMatcher.ts`
5. `src/lib/ai/activityEntityMatcher.ts`

### Cleanup Schedule

| Week | Tasks | Status |
|------|-------|--------|
| Week 1 | Add deprecation comments, export new functions, migrate 2 API endpoints | ✅ COMPLETE |
| Week 2-3 | Migrate analyzeInboundEmail/Outbound, update Fireflies sync | ✅ COMPLETE |
| Week 3-4 | Wire email sync to new pipeline, remove deprecated files | ✅ COMPLETE |
| Week 4+ | Final cleanup, performance optimization | ✅ COMPLETE |

### Final Migration Results (Dec 21)

**Files Migrated:**
- `add-context/route.ts` → buildFullRelationshipContext
- `processTranscriptAnalysis.ts` → removed deprecated RI updates
- `fireflies/sync.ts` → intelligentEntityMatch
- `resolve-transcript-review/route.ts` → transcriptUtils

**New Utility Created:**
- `src/lib/fireflies/transcriptUtils.ts` — Task/entity creation utilities

**Deprecated Files Deleted (9 total):**
1. ~~src/lib/intelligence/autoLinkEntities.ts~~
2. ~~src/lib/intelligence/buildRelationshipContext.ts~~
3. ~~src/lib/intelligence/updateRelationshipFromAnalysis.ts~~
4. ~~src/lib/intelligence/analyzeInboundEmail.ts~~
5. ~~src/lib/intelligence/analyzeOutboundEmail.ts~~
6. ~~src/lib/ai/transcriptEntityMatcher.ts~~
7. ~~src/lib/ai/activityEntityMatcher.ts~~
8. ~~src/lib/ai/analyzeInboundEmail.ts~~
9. ~~src/lib/ai/analyzeOutboundEmail.ts~~

**Types Preserved:**
- `InboundEmailAnalysis` and related types → `src/lib/intelligence/types.ts`

**Compilation Status:** ✅ TypeScript passes with exit code 0

### Week 2-3 Migration Results

**Fully Migrated (uses new APIs):**
- `reconcileActions.ts` — Accepts both old and new RelationshipContext types
- `generateMeetingPrep.ts` — Uses buildFullRelationshipContext
- `processTranscriptAnalysis.ts` — Uses buildFullRelationshipContext, bugs fixed

**Marked Deprecated (working but legacy):**
- `analyzeInboundEmail.ts` — Full deprecation notice with migration guide
- `analyzeOutboundEmail.ts` — Full deprecation notice with migration guide
- `initialHistoricalSync.ts` — TODO comments for future migration
- `processInboundEmail.ts` — TODO comments for future migration

**Bug Fixes Applied:**
- `processTranscriptAnalysis.ts` — Fixed createClient → createAdminClient (4 locations)
- `processTranscriptAnalysis.ts` — Added reasoning field to RequiredAction
- `autoLinkEntities.ts` — Fixed null vs undefined type issues
- `generateMeetingPrep.ts` — Fixed Supabase join array handling

**Compilation Status:** ✅ TypeScript passes with no errors

---

## Key Files Reference

### Intelligence Layer (Clean)
```
src/lib/intelligence/
├── contextFirstPipeline.ts    # ✅ Main entry point
├── entityMatcher.ts           # ✅ AI-powered matching
├── reconcileActions.ts        # ✅ Action reconciliation
├── relationshipStore.ts       # ✅ Relationship storage
├── salesPlaybook.ts           # ✅ Playbook definitions
├── meetingPrep.ts             # ✅ Meeting prep generation (updated)
├── generateMeetingPrep.ts     # ✅ Meeting prep generation (updated)
├── types.ts                   # ✅ Shared types (InboundEmailAnalysis, etc.)
└── index.ts                   # ✅ Clean exports
```

### Fireflies Layer (Clean)
```
src/lib/fireflies/
├── sync.ts                    # ✅ Uses intelligentEntityMatch
└── transcriptUtils.ts         # ✅ NEW: Task/entity creation utilities
```

### AI Layer (Clean)
```
src/lib/ai/
└── [deprecated files removed]
```

### Test Scripts
```
scripts/
├── integration-test-pipeline.ts       # Full pipeline test
├── integration-test-known-contact.ts  # Known contact scenario
├── test-entity-matcher.ts             # Entity matcher unit tests
├── test-context-pipeline.ts           # Pipeline unit tests
└── dedupe-command-center.ts           # Duplicate cleanup
```

### Command Center
```
src/components/commandCenter/
├── CommandCenter.tsx          # Main component
├── ActionCard.tsx             # Individual action cards
├── WorkflowStepsChecklist.tsx # Checklist UI
└── TierSection.tsx            # Tier groupings
```

### API Routes
```
src/app/api/
├── command-center/            # Command center endpoints
├── intelligence/              # Analysis endpoints
├── email/                     # Email sync endpoints
└── [others TBD in audit]
```

---

## Test Data

### Raymond Kidwell / Lawn Doctor Trial Form
- **Use case:** Trial authorization form submission
- **Expected behavior:** 
  - Match to Lawn Doctor company
  - Match to contact (Raymond Kidwell or Andrew Canniff)
  - Create single workflow card with steps
  - Extract facts (16 agents, VP/GM title, franchisee)
  - Tier 1 urgency

### Validation Checklist (PASSED Dec 21)
- [x] Company identified with ≥0.70 confidence (100% on known contacts)
- [x] Contact identified with ≥0.70 confidence (100% on known contacts)
- [x] Context loaded before analysis (20 facts, 7 interactions)
- [x] Analysis uses playbook
- [x] Context grows after processing (20→26 facts, 7→8 interactions)
- [x] Actions created (4 created, 1 obsoleted)
- [x] New stakeholders detected (Maria Santos, Operations Director)
- [x] Deal stage updated automatically (→ implementation)

### Integration Test Results (Dec 21)

**Test 1: New Contact (Raymond Kidwell)**
- Company: Lawn Doctor of Hanover (75% confidence)
- Contact: Correctly identified as NEW person, not in CRM
- AI reasoned this was a forwarded email, not from Andy Canniff

**Test 2: Known Contact (Andy Canniff)**
- Company: 100% confidence match
- Contact: 100% confidence match
- Context grew: 20→26 facts, 7→8 interactions
- 5 buying signals detected
- 4 actions created, 1 obsoleted

---

## Immediate Next Steps

### ✅ Step 1: Integration Test — COMPLETE
```
Result: 7/7 checks passed
- Entity matching: 100% confidence on known contacts
- Context growth: 20→26 facts
- Actions: 4 created, 1 obsoleted
- New stakeholder detected: Maria Santos
```

### ✅ Step 2: Cleanup Audit — COMPLETE
```
Result: Full audit at docs/CONTEXT-FIRST-CLEANUP-AUDIT.md
- 8 active files, 4 transitional, 5 deprecated
- 3 competing entity matching systems found
- 3 API endpoints need migration
- 5 files to delete after migration
```

### ✅ Step 3: Execute Cleanup — Week 1 COMPLETE
```
Completed:
1. ✅ Added @deprecated comments to 5 old files
2. ✅ Updated index.ts exports for new functions
3. ✅ Migrated 2 command-center endpoints (added migration notes)
4. ✅ Fixed TypeScript type issue in contextFirstPipeline.ts
5. ✅ Compilation passes for context-first architecture files
```

### ✅ Step 3b: Execute Cleanup — Week 2-3 COMPLETE
```
Completed:
1. ✅ Migrated generateMeetingPrep.ts → buildFullRelationshipContext
2. ✅ Migrated processTranscriptAnalysis.ts → buildFullRelationshipContext
3. ✅ Updated reconcileActions.ts to accept both context types
4. ✅ Added deprecation notices to legacy email processing files
5. ✅ Fixed 6+ TypeScript bugs across multiple files
6. ✅ TypeScript compilation passes with no errors

Migration path now clear:
- New: processIncomingCommunication → intelligentEntityMatch → buildFullRelationshipContext
- Old: analyzeInboundEmail → autoLinkEntities (deprecated, but still working)
```

### 🔄 Step 3c: Execute Cleanup — Week 3-4 — COMPLETE ✅
```
Completed:
✅ processInboundEmail.ts → processIncomingCommunication
✅ initialHistoricalSync.ts → processIncomingCommunication
✅ add-context/route.ts → buildFullRelationshipContext
✅ processTranscriptAnalysis.ts → removed deprecated imports
✅ fireflies/sync.ts → intelligentEntityMatch
✅ resolve-transcript-review/route.ts → transcriptUtils
✅ Created src/lib/fireflies/transcriptUtils.ts
✅ Deleted 9 deprecated files
✅ TypeScript compilation passes
```

### Step 4: Priorities Based on Codebase Map — UPDATED
```
Previous priority order: B → A → C (all complete)

NEW PRIORITY: Product-Centric Redesign (6 phases)

Phase 1: Foundation
- Products table, company_products, stages
- Seed product catalog
- Basic Products page UI

Phase 2: Data Import
- Import VFP customer spreadsheet
- Import AI products billing data
- Migrate existing deals to company_products

Phase 3-6: See Product-Centric Redesign section above
```

### Current Task: Product-Centric Redesign
```
The big strategic shift: Transform from deal-centric to product adoption platform

Next Step: Phase 1 Foundation
- Create products table with X-RAI product catalog
- Create company_products table for per-company status
- Create product_sales_stages table for proven processes
- Seed initial products (Voice for Pest, X-RAI 2.0, AI Agents, etc.)
- Basic Products page UI

Pre-requisites before Phase 1:
- ⚠️ Fix email-company matching (many "Unlinked" in Communication Hub)
- Fix Turbopack crashes (or downgrade Next.js)
```

### AI Scheduler - ✅ COMPLETE
```
Week 1 ✅ Email Sending:
- sendSchedulingEmail() via Microsoft Graph
- POST /api/scheduler/requests/[id]/send
- Logs to scheduling_actions, schedules follow-up

Week 2 ✅ Response Parsing:
- processSchedulingEmails() in email sync cron
- AI parses: accept/decline/counter_propose/question
- POST /api/scheduler/process-responses (manual)

Week 3 ✅ Calendar Booking + No-Show Recovery:
- createMeetingCalendarEvent() on accept
- POST /api/scheduler/requests/[id]/book (manual)
- Cron: /api/cron/detect-no-shows
- Graduated recovery: email → escalate → pause → cancel
```

---

## How to Restore Context

If you start a new Claude Code session and need to restore context:

### Quick Context (Copy/Paste This)
```
We're building X-FORCE, an AI-First CRM for X-RAI Labs (pest control AI).

CURRENT DIRECTION: Product-Centric Redesign
- Transforming from deal pipeline to product adoption platform
- VFP customers (208) get per-product status tracking
- Non-VFP prospects go through traditional prospecting pipeline
- Each product has its own "proven process" (sales stages)
- AI learns from transcripts to improve sales process

KEY COMPLETED WORK:
1. Context-first architecture (entity matching, relationship intelligence)
2. AI Scheduler (full loop: email → response → calendar → no-show)
3. Communication Hub (unified conversation view, 3-panel layout)
4. Command Center (5-tier prioritization)

CURRENT TASK: [INSERT CURRENT TASK]

Read these files for context:
- /docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md (NEW DIRECTION)
- /docs/specs/X-FORCE-CRM-Project-State.md (current state)
- /docs/specs/X-FORCE-Communication-Hub-Specification-v2.md (comm hub)
```

### Full Context Restore
```
Read the project state document at /docs/specs/X-FORCE-Project-State.md
This contains current implementation state, decisions made, known issues, and next steps.

For the product-centric redesign, also read:
/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md
```

---

## Contact Points

- **Project Lead:** [Your name]
- **Spec Documents:** All in `/docs/specs/`
- **This Document:** `/docs/specs/X-FORCE-Project-State.md`

---

## Changelog

| Date | Change |
|------|--------|
| Dec 24 | 📋 **PRODUCT-CENTRIC REDESIGN SPEC** - Transform from deal pipeline to product adoption platform |
| Dec 24 | ✅ **COMMUNICATION HUB PHASE 3B** - Three-panel unified conversation view |
| Dec 23 | ✅ **COMMUNICATION HUB PHASE 3** - Daily Driver UIs live at /communications |
| Dec 23 | ✅ **COMMUNICATION HUB PHASE 2** - Analysis pipeline live, 113 analyzed, 45+ promises extracted |
| Dec 23 | ✅ **COMMUNICATION HUB PHASE 1** - 3 tables, 113 communications synced, 2 API endpoints |
| Dec 21 | 📋 **COMMUNICATION HUB SPEC v2** - Unified omni-channel system with GPT feedback incorporated |
| Dec 21 | ✅ **COMMAND CENTER GAPS FIXED** - source_id, 15 type aliases, AI company extraction |
| Dec 21 | ✅ **UNKNOWN SENDER TIER 1** - Emails from unknown domains create triage items |
| Dec 21 | ✅ **EMAIL→CC PIPELINE FIX #2** - Query now catches stuck emails (processed_for_cc=false) |
| Dec 21 | ✅ **EMAIL→CC PIPELINE FIX** - Emails now reliably create CC items (was 12%, now 100%) |
| Dec 21 | ✅ **AI SCHEDULER COMPLETE** - Week 3: Calendar booking + no-show recovery |
| Dec 21 | ✅ **AI SCHEDULER WEEK 2** - Response parsing wired, auto-detects replies |
| Dec 21 | ✅ **AI SCHEDULER WEEK 1** - Email sending wired via Microsoft Graph |
| Dec 21 | ✅ **ARCHITECTURAL GUARDRAILS** - Tests that fail on keyword patterns, detectInboundEmails deprecated |
| Dec 21 | ✅ **TIER DETECTION FIX** - Removed keywords, now uses AI analysis + COMMUNICATION_TYPE_TIERS |
| Dec 21 | ✅ **ENTITY LINKING FIX** - Backfilled 52 orphaned CC items, verified tier system |
| Dec 21 | ✅ **PHASE 2-5 COMPLETE** - Company page as source of truth, notes/corrections, reconciliation |
| Dec 21 | ✅ **CODEBASE MAPPED** - 454 files, 116 endpoints, 50+ tables, ~75% vision alignment |
| Dec 21 | ✅ **CLEANUP COMPLETE** - 9 deprecated files deleted, TypeScript clean |

---

*Keep this document updated as the project progresses.*
