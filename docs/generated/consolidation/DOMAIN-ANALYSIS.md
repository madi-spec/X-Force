# X-FORCE Consolidation Audit: Domain Analysis

> **Generated:** 2026-01-01
> **Status:** Phase 1 Complete - Domains Identified
> **Mode:** READ-ONLY Analysis (no code modifications)

---

## Executive Summary

Analysis of the X-FORCE codebase (796 source files, 239 lib modules) has identified **8 major domains** with suspected duplicate logic requiring consolidation. This document maps each domain's implementations across the codebase.

---

## Identified Domains

| # | Domain | Primary Location | Suspected Duplicates | Priority |
|---|--------|------------------|---------------------|----------|
| 1 | Email Sync | `src/lib/microsoft/` | communicationHub/sync/, inbox/, cron routes | HIGH |
| 2 | Health Score | `src/lib/lifecycle/` | ai/health-score.ts, ai/scoring/ | MEDIUM |
| 3 | Context Building | `src/lib/commandCenter/` | ai/core/contextBuilder, intelligence/ | MEDIUM |
| 4 | Entity Matching | `src/lib/intelligence/` | fireflies/transcriptUtils, email/ | HIGH |
| 5 | Email Sending | `src/lib/scheduler/` | microsoft/send, autopilot/, communications/ | HIGH |
| 6 | Transcript Analysis | `src/lib/pipelines/` | ai/transcript-analyzer, autopilot/ | MEDIUM |
| 7 | Meeting Prep | `src/lib/commandCenter/` | scheduler/emailGeneration | LOW |
| 8 | Draft Generation | `src/lib/scheduler/` | inbox/aiAnalysis, commandCenter/ | MEDIUM |

---

## Domain 1: Email Sync

**Problem:** Multiple implementations of email synchronization from Microsoft Graph API

### Implementations Found

| Location | Purpose | Lines | Last Updated |
|----------|---------|-------|--------------|
| `src/lib/microsoft/emailSync.ts` | Core Graph API sync | ~200 | Active |
| `src/lib/communicationHub/sync/directGraphSync.ts` | Direct-to-communications sync | ~150 | Active |
| `src/lib/communicationHub/sync/syncEmail.ts` | Email adapter sync | ~100 | Active |
| `src/lib/inbox/inboxService.ts` | Inbox-specific sync | ~180 | Active |
| `src/app/api/cron/sync-microsoft/route.ts` | Cron job orchestrator | ~80 | Active |
| `src/app/api/cron/sync-inbox/route.ts` | Inbox cron job | ~60 | Active |
| `src/app/api/cron/sync-communications/route.ts` | Communications cron | ~100 | Active |

### Evidence of Duplication

1. **Graph API Calls**: Both `microsoft/emailSync.ts` and `communicationHub/sync/directGraphSync.ts` make similar Microsoft Graph API calls to fetch emails
2. **Email Processing**: `processEmail()` logic exists in multiple places
3. **Sync State Tracking**: Multiple implementations of `last_sync_at` updates

### Suspected Root Cause

Evolution over time: Original `microsoft/emailSync` was supplemented by `communicationHub/sync` for the FACTS/OPINIONS architecture, then `inbox/` was added for dedicated inbox features.

---

## Domain 2: Health Score Calculation

**Problem:** Multiple health/engagement score implementations

### Implementations Found

| Location | Purpose | Approach |
|----------|---------|----------|
| `src/lib/ai/health-score.ts` | Original AI health score | LLM-based analysis |
| `src/lib/ai/scoring/index.ts` | Scoring utilities | Mixed approach |
| `src/lib/lifecycle/engagementHealthEvaluator.ts` | Event-sourced health | Deterministic rules |
| `src/lib/lifecycle/commands.ts` | Health status commands | Event emission |

### Evidence of Duplication

1. **Health Score Calculation**: `ai/health-score.ts` calculates health scores using AI, while `lifecycle/engagementHealthEvaluator.ts` uses deterministic rules
2. **Multiple Score Types**: Deal health, engagement health, relationship health computed differently

### Suspected Root Cause

Architecture evolution: Original AI-based scoring was supplemented by deterministic event-sourced calculations for reliability and debuggability.

---

## Domain 3: Context Building

**Problem:** Multiple implementations of context gathering for AI prompts

### Implementations Found

| Location | Purpose | Context Type |
|----------|---------|--------------|
| `src/lib/ai/core/contextBuilder.ts` | Core context building | Deal, Company, Activities |
| `src/lib/commandCenter/contextEnrichment.ts` | Command Center enrichment | Items, Companies |
| `src/lib/intelligence/contextFirstPipeline.ts` | Full relationship context | Communications, History |
| `src/lib/email/enrichEmailContext.ts` | Email-specific context | Sender, Thread |

### Evidence of Duplication

1. **Company Context**: Built in `contextBuilder.ts:buildCompanyContext()` AND `contextEnrichment.ts:gatherContext()`
2. **Activity Context**: Built in `contextBuilder.ts:buildActivitiesContext()` AND `contextFirstPipeline.ts:buildFullRelationshipContext()`
3. **Similar Queries**: Multiple modules query same tables (companies, contacts, activities) to build context

### Suspected Root Cause

Different modules evolved independently, each building their own context gathering.

---

## Domain 4: Entity Matching

**Problem:** Multiple implementations of matching communications to companies/contacts

### Implementations Found

| Location | Purpose | Matching Approach |
|----------|---------|-------------------|
| `src/lib/intelligence/entityMatcher.ts` | AI-powered entity matching | LLM disambiguation |
| `src/lib/intelligence/index.ts` | Intelligence exports | Delegates to entityMatcher |
| `src/lib/fireflies/transcriptUtils.ts` | Transcript participant matching | Email/name lookup |
| `src/lib/fireflies/sync.ts` | Transcript sync with matching | Domain extraction |
| `src/lib/email/processInboundEmail.ts` | Email sender matching | Email domain lookup |

### Evidence of Duplication

1. **Email → Company Matching**: Done in `entityMatcher.ts`, `fireflies/sync.ts`, AND `email/processInboundEmail.ts`
2. **Domain Extraction**: Extracting domain from email repeated in multiple places
3. **Candidate Lookup**: `findCandidateCompanies()` logic duplicated

### Suspected Root Cause

Different data sources (emails, transcripts) each implemented their own matching without a shared service.

---

## Domain 5: Email Sending

**Problem:** Multiple code paths for sending emails via Microsoft Graph

### Implementations Found

| Location | Purpose | Entry Point |
|----------|---------|-------------|
| `src/app/api/microsoft/send/route.ts` | Direct API endpoint | API route |
| `src/lib/scheduler/confirmationWorkflow.ts` | Scheduling email send | Scheduler flow |
| `src/lib/scheduler/responseProcessor.ts` | Response email send | Scheduler flow |
| `src/lib/autopilot/needsReplyAutopilot.ts` | Auto-reply send | Autopilot |
| `src/lib/autopilot/transcriptAutopilot.ts` | Follow-up send | Autopilot |
| `src/app/api/communications/send-reply/route.ts` | Manual reply send | API route |
| `src/app/api/attention-flags/[id]/send-email/route.ts` | Flag action send | API route |

### Evidence of Duplication

1. **Graph API sendMail Call**: Made directly in multiple places instead of through single service
2. **Email Formatting**: HTML email construction repeated
3. **Tracking Integration**: Email tracking pixel insertion in multiple places

### Suspected Root Cause

Multiple features (scheduler, autopilot, manual compose) each implemented email sending rather than using shared service.

---

## Domain 6: Transcript Analysis

**Problem:** Multiple implementations of meeting transcript analysis

### Implementations Found

| Location | Purpose | Analysis Type |
|----------|---------|---------------|
| `src/lib/ai/transcript-analyzer.ts` | Full transcript analysis | LLM-based |
| `src/lib/pipelines/processTranscriptAnalysis.ts` | Pipeline processor | Delegates to analyzer |
| `src/lib/autopilot/transcriptAutopilot.ts` | Auto follow-up generation | Focused on action items |
| `src/lib/sync/initialHistoricalSync.ts` | Historical transcript processing | Batch analysis |

### Evidence of Duplication

1. **Analysis Prompts**: Similar AI prompts for transcript analysis in multiple files
2. **Action Item Extraction**: Done in transcript-analyzer AND transcriptAutopilot
3. **Insight Storage**: Multiple patterns for storing analysis results

### Suspected Root Cause

Transcript analysis started in `ai/transcript-analyzer.ts`, then specialized versions emerged for autopilot and pipelines.

---

## Domain 7: Meeting Prep

**Problem:** Meeting preparation logic in multiple places

### Implementations Found

| Location | Purpose |
|----------|---------|
| `src/lib/commandCenter/meetingPrep.ts` | Command Center meeting prep |
| `src/lib/scheduler/emailGeneration.ts` | Scheduler meeting prep brief |
| `src/lib/scheduler/index.ts` | `generateMeetingPrepBrief()` export |
| `src/app/api/calendar/[meetingId]/prep/route.ts` | API endpoint |

### Evidence of Duplication

1. **Brief Generation**: `meetingPrep.ts` and `emailGeneration.ts` both generate meeting preparation content
2. **Context Gathering**: Both query attendee info, company history, recent communications

### Suspected Root Cause

Command Center and Scheduler evolved meeting prep features independently.

---

## Domain 8: Draft Generation

**Problem:** Email draft generation in multiple places

### Implementations Found

| Location | Purpose | Draft Type |
|----------|---------|------------|
| `src/lib/scheduler/draftService.ts` | Scheduler email drafts | Scheduling emails |
| `src/lib/inbox/aiAnalysis.ts` | Inbox draft generation | Reply drafts |
| `src/lib/commandCenter/` (contextEnrichment) | CC draft generation | Action emails |
| `src/app/api/inbox/drafts/route.ts` | Draft API | Draft management |

### Evidence of Duplication

1. **Draft Structure**: Similar draft metadata (subject, body, to, cc)
2. **AI Generation**: Multiple places call AI for draft content
3. **Draft Storage**: Multiple patterns for storing/retrieving drafts

### Suspected Root Cause

Different features (scheduler, inbox, command center) each implemented draft generation.

---

## Dependency Summary

```
Email Sync ─────────────┬──> Entity Matching ──> Context Building
                        │
Transcript Analysis ────┼──> Entity Matching
                        │
Email Sending <─────────┼──── Draft Generation
                        │
Health Score ───────────┴──> (Lifecycle Events)
```

---

## Recommendations by Priority

### HIGH Priority (Address First)

1. **Entity Matching** - Create single `matchEntity()` service used by all data sources
2. **Email Sync** - Consolidate to single sync pipeline with clear layers
3. **Email Sending** - Create single `sendEmail()` service with consistent tracking

### MEDIUM Priority

4. **Context Building** - Create shared `buildContext()` with composable parts
5. **Draft Generation** - Consolidate around `scheduler/draftService.ts`
6. **Transcript Analysis** - Consolidate around `ai/transcript-analyzer.ts`
7. **Health Score** - Determine canonical approach (AI vs deterministic)

### LOW Priority

8. **Meeting Prep** - Consolidate into `commandCenter/meetingPrep.ts`

---

## Next Steps

1. **Phase 2**: Deep dive into each domain to map exact duplicate functions
2. **Phase 3**: Select canonical version for each domain
3. **Phase 4**: Map all consumers of duplicates
4. **Phase 5**: Generate migration plans with safe ordering
5. **Phase 6**: Create migration scripts (optional)

---

## Verification Checklist

- [x] All domains identified from lib/ structure
- [x] Cross-referenced with API routes
- [x] Evidence gathered from grep searches
- [x] Priority assigned based on impact
- [ ] User confirmation of domains before Phase 2

