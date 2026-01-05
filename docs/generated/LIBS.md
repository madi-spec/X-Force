# X-FORCE Library Documentation

> Auto-generated documentation for all `src/lib` modules
> Generated: 2026-01-01

## Overview

The `src/lib` directory contains 239 TypeScript files across 57 modules, providing the core business logic, AI integrations, data sync, and platform capabilities.

---

## Table of Contents

1. [AI Core](#1-ai-core)
2. [AI Intelligence](#2-ai-intelligence)
3. [AI Learning](#3-ai-learning)
4. [AI Leverage](#4-ai-leverage)
5. [AI Memory](#5-ai-memory)
6. [AI Scoring](#6-ai-scoring)
7. [AI Signals](#7-ai-signals)
8. [AI Summaries](#8-ai-summaries)
9. [Analytics](#9-analytics)
10. [Autopilot](#10-autopilot)
11. [Command Center](#11-command-center)
12. [Communication Hub](#12-communication-hub)
13. [Communications](#13-communications)
14. [Cron](#14-cron)
15. [Duplicates](#15-duplicates)
16. [Email](#16-email)
17. [Event Sourcing](#17-event-sourcing)
18. [Features](#18-features)
19. [Fireflies](#19-fireflies)
20. [Focus](#20-focus)
21. [Import](#21-import)
22. [Inbox](#22-inbox)
23. [Intelligence](#23-intelligence)
24. [Lens](#24-lens)
25. [Lifecycle](#25-lifecycle)
26. [Microsoft](#26-microsoft)
27. [Pipelines](#27-pipelines)
28. [Process](#28-process)
29. [PST](#29-pst)
30. [RBAC](#30-rbac)
31. [Scheduler](#31-scheduler)
32. [Signals](#32-signals)
33. [SMS](#33-sms)
34. [Supabase](#34-supabase)
35. [Support Case](#35-support-case)
36. [Sync](#36-sync)
37. [Tooltips](#37-tooltips)
38. [Tracking](#38-tracking)
39. [Utils](#39-utils)
40. [Work](#40-work)
41. [Workflow](#41-workflow)

---

## 1. AI Core

**Path:** `src/lib/ai/core/`

Core AI client for Anthropic Claude integration with prompt management.

### Files

| File | Purpose |
|------|---------|
| `aiClient.ts` | Anthropic SDK wrapper with caching, streaming, JSON parsing |
| `contextBuilder.ts` | Build context strings for deal/company/contact analysis |
| `index.ts` | Re-exports all core functions |

### Exported Functions

```typescript
// aiClient.ts (lines 97-314)
callAI(request: AIRequest): Promise<AIResponse>
callAIJson<T>(request: AIJsonRequest<T>): Promise<{ data: T; usage; latencyMs }>
callAIStream(request: AIRequest, onChunk: (chunk: string) => void): Promise<AIResponse>
callAIQuick(request: Omit<AIRequest, 'model'>): Promise<AIResponse>
logAIUsage(supabase, params): Promise<void>

// contextBuilder.ts (lines 6-297)
buildDealContext(deal): string
buildActivitiesContext(activities, limit?): string
buildContactsContext(contacts): string
buildSignalsContext(signals): string
buildFullDealContext(params): string
buildCompanyContext(company): string
```

### Types

```typescript
interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514';
}

interface AIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  latencyMs: number;
}
```

---

## 2. AI Intelligence

**Path:** `src/lib/ai/intelligence/`

Deterministic deal intelligence computation (no LLM - fast, predictable, debuggable).

### Files

| File | Purpose |
|------|---------|
| `dealIntelligenceEngine.ts` | Main intelligence computation engine |
| `momentumCalculator.ts` | Calculate deal momentum signals |
| `confidenceCalculator.ts` | MEDDIC-aligned confidence factors |
| `economicsCalculator.ts` | Deal economics and investment recommendations |
| `uncertaintyChecker.ts` | Detect uncertainty requiring human review |
| `schedulingIntegration.ts` | Phase 4 scheduling integration |

### Exported Functions

```typescript
// dealIntelligenceEngine.ts (lines 129-211)
computeDealIntelligence(deal: DealData): DealIntelligence

// momentumCalculator.ts
calculateMomentum(deal, daysInStage): MomentumResult

// confidenceCalculator.ts
calculateConfidence(deal): ConfidenceResult

// economicsCalculator.ts
calculateEconomics(deal, confidence): EconomicsResult
getInvestmentRecommendations(economics): string[]

// uncertaintyChecker.ts
checkUncertainty(deal, momentum, confidence): UncertaintyResult

// schedulingIntegration.ts
getDealSchedulingContext(dealId): Promise<DealSchedulingContext>
applySchedulingAdjustments(dealIntel, context): DealIntelligence
```

### Types

```typescript
interface DealIntelligence {
  deal_id: string;
  stage: string;
  days_in_stage: number;
  total_days: number;
  momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  momentum_score: number; // -100 to +100
  momentum_signals: MomentumSignal[];
  confidence_engagement: number;
  confidence_champion: number;
  confidence_authority: number;
  confidence_need: number;
  confidence_timeline: number;
  win_probability: number;
  win_probability_low: number;
  win_probability_high: number;
  win_probability_trend: 'up' | 'down' | 'stable';
  is_uncertain: boolean;
  estimated_acv: number;
  expected_value: number;
  investment_level: 'high' | 'medium' | 'low' | 'minimal';
  risk_factors: RiskFactor[];
  next_actions: NextAction[];
  computed_at: string;
}
```

---

## 3. AI Learning

**Path:** `src/lib/ai/learning/`

Pattern learning and rep trust services.

### Files

| File | Purpose |
|------|---------|
| `patternLearning.ts` | Learn patterns from sales activities |
| `repTrustService.ts` | Track rep performance and trust levels |

---

## 4. AI Leverage

**Path:** `src/lib/ai/leverage/`

Leverage moment detection and brief generation.

### Files

| File | Purpose |
|------|---------|
| `briefGenerator.ts` | Generate AI briefs for leverage moments |
| `stopRules.ts` | Rules to stop AI engagement |
| `triggerDetection.ts` | Detect leverage trigger moments |
| `trustBasis.ts` | Trust basis for AI recommendations |

---

## 5. AI Memory

**Path:** `src/lib/ai/memory/`

AI memory capture and injection for context persistence.

### Files

| File | Purpose |
|------|---------|
| `memoryCapture.ts` | Capture key facts from conversations |
| `memoryInjection.ts` | Inject relevant memories into prompts |

---

## 6. AI Scoring

**Path:** `src/lib/ai/scoring/`

Health score calculation for deals.

### Files

| File | Purpose |
|------|---------|
| `healthScore.ts` | Calculate deal health scores |

---

## 7. AI Signals

**Path:** `src/lib/ai/signals/`

Signal detection from communications.

### Files

| File | Purpose |
|------|---------|
| `signalDetector.ts` | Detect signals from communications |

---

## 8. AI Summaries

**Path:** `src/lib/ai/summaries/`

AI-generated entity summaries.

### Exported Functions

```typescript
// index.ts exports from:
generateDealSummary(dealId): Promise<DealSummary>
getDealSummary(dealId): Promise<DealSummary | null>
isDealSummaryStale(dealId): Promise<boolean>

generateCompanySummary(companyId): Promise<CompanySummary>
getCompanySummary(companyId): Promise<CompanySummary | null>

generateContactSummary(contactId): Promise<ContactSummary>
getContactSummary(contactId): Promise<ContactSummary | null>

// Main service
generateSummary(entityType, entityId): Promise<Summary>
getSummary(entityType, entityId): Promise<Summary | null>
getOrGenerateSummary(entityType, entityId): Promise<Summary>
generateDealSummariesBatch(dealIds): Promise<BatchResult>
refreshStaleDealSummaries(limit): Promise<RefreshResult>
markDealSummariesStale(dealIds): Promise<void>
getSummaryStats(): Promise<SummaryStats>
cleanupOrphanedSummaries(): Promise<CleanupResult>
```

---

## 9. Analytics

**Path:** `src/lib/analytics/`

Analytics and reporting utilities.

### Files

| File | Purpose |
|------|---------|
| `whitespaceAnalyzer.ts` | Analyze whitespace opportunities |

---

## 10. Autopilot

**Path:** `src/lib/autopilot/`

AI Autopilot system for automated workflows.

### Exported Functions

```typescript
// Main orchestrator
runAutopilot(options: AutopilotOptions): Promise<AutopilotResponse>
runAllAutopilots(options?): Promise<AutopilotResponse>
getAutopilotStatus(): Promise<AutopilotStatusResponse>

// Individual workflows
runSchedulerAutopilot(options): Promise<AutopilotWorkflowResult>
runNeedsReplyAutopilot(options): Promise<AutopilotWorkflowResult>
runTranscriptAutopilot(options): Promise<AutopilotWorkflowResult>

// Status
getSchedulerAutopilotStatus(): Promise<SchedulerStatus>
getNeedsReplyAutopilotStatus(): Promise<NeedsReplyStatus>
getTranscriptAutopilotStatus(): Promise<TranscriptStatus>

// Helpers
parseWorkflows(workflowsStr): AutopilotWorkflow[]
createEmptySummary(): AutopilotWorkflowResult
```

### Types

```typescript
type AutopilotWorkflow = 'scheduler' | 'needs-reply' | 'transcript';

interface AutopilotOptions {
  workflows: AutopilotWorkflow[];
  dryRun?: boolean;
  userId?: string;
  limit?: number;
}

interface AutopilotResponse {
  success: boolean;
  results: { scheduler?; needsReply?; transcript? };
  totalActionsExecuted: number;
  totalFlagsCreated: number;
  totalErrors: number;
  runAt: string;
  dryRun: boolean;
}
```

---

## 11. Command Center

**Path:** `src/lib/commandCenter/`

Command Center v3.1 "Momentum Engine" - AI co-pilot for daily planning.

### Exported Functions

```typescript
// Daily Planning
getRepTimeProfile(userId): Promise<RepTimeProfile>
calculateDailyCapacity(profile): DailyCapacity
generateDailyPlan(userId): Promise<DailyPlan>
getDailyPlan(userId): Promise<GetDailyPlanResponse>
refreshDailyPlan(userId): Promise<DailyPlan>
getCurrentBlockIndex(plan): number
getNextAvailableBlock(plan): TimeBlock | null

// Momentum Scoring
calculateMomentumScore(params, context?): MomentumScore
scoreItems(items): ScoredItem[]
getBasePriority(actionType): number
getTimePressure(dueAt): number
getValueScore(dealValue, probability): number

// Action Durations
getTypicalDuration(actionType): number
getDuration(item): number
estimateTotalDuration(items): number
canFitInTime(items, availableMinutes): boolean
itemsThatFit(items, availableMinutes): Item[]

// Item Generation
syncAllSources(userId): Promise<SyncResult>
syncEmailDrafts(userId): Promise<SyncResult>
syncMeetingPrep(userId): Promise<SyncResult>
syncMeetingFollowUps(userId): Promise<SyncResult>
syncStaleDeals(userId): Promise<SyncResult>
syncAISignals(userId): Promise<SyncResult>
createCommandCenterItem(item): Promise<CreateResult>
updateItemScore(itemId): Promise<boolean>
refreshAllScores(userId): Promise<RefreshResult>
findDealForCompany(companyId): Promise<Deal | null>
generateWhyNow(params): string

// Context Enrichment
gatherContext(item): Promise<EnrichmentContext>
enrichItem(item): Promise<EnrichedItem>
enrichAndSaveItem(itemId): Promise<EnrichedItem>
regenerateEmailDraft(itemId): Promise<EmailDraft>

// Tier Detection
classifyItem(item): Promise<ClassificationResult>
classifyAllItems(userId): Promise<BatchResult>
sortTier1(items): SortedItems
sortTier2(items): SortedItems
sortTier3(items): SortedItems
sortTier4(items): SortedItems
getTierForTrigger(trigger): PriorityTier

// Already Handled Detection
detectAlreadyHandled(item): Promise<HandledResult>
batchDetectAlreadyHandled(items): Promise<BatchHandledResult>

// Action Reconciliation
reconcileCompanyActions(companyId): Promise<ReconcileResult>
syncActionCompletion(itemId): Promise<void>
runBatchReconciliation(): Promise<BatchResult>
```

---

## 12. Communication Hub

**Path:** `src/lib/communicationHub/`

Unified communication system - Communications = FACTS, Analysis = OPINIONS.

### Exported Functions

```typescript
// Adapters
emailToCommunication(email): Communication
syncEmailToCommunications(emailId): Promise<SyncResult>
syncAllEmailsToCommunications(): Promise<BatchResult>

transcriptToCommunication(transcript): Communication
syncTranscriptToCommunications(transcriptId): Promise<SyncResult>
syncAllTranscriptsToCommunications(): Promise<BatchResult>

// Analysis
analyzeCommunication(communicationId): Promise<AnalysisResult>
analyzeAllPending(): Promise<BatchAnalysisResult>

// Confidence Gating
filterByConfidence(analyses, threshold): Analysis[]
categorizeByConfidence(analyses): CategorizedAnalyses
getConfidenceLabel(score): 'high' | 'medium' | 'low'
canTriggerAction(analysis): boolean

// Prompts
buildAnalysisPrompt(communication, context): string
ANALYSIS_PROMPT_VERSION: string
PRODUCTS: string[]
COMMUNICATION_TYPES: string[]

// Direct Microsoft Graph Sync (recommended)
syncEmailsDirectToCommunications(userId, options): Promise<DirectSyncResult>
syncRecentEmailsDirectToCommunications(userId): Promise<DirectSyncResult>

// Transcript Sync
syncTranscriptToCommunication(transcriptId): Promise<SyncResult>
syncRecentTranscriptsToCommunications(userId): Promise<BatchResult>
```

---

## 13. Communications

**Path:** `src/lib/communications/`

Communication event handling.

### Files

| File | Purpose |
|------|---------|
| `addNote.ts` | Add notes to communications |
| `events.ts` | Communication event types |
| `index.ts` | Re-exports |

---

## 14. Cron

**Path:** `src/lib/cron/`

Cron job utilities.

### Files

| File | Purpose |
|------|---------|
| `logging.ts` | Structured logging for cron jobs |

---

## 15. Duplicates

**Path:** `src/lib/duplicates/`

Duplicate detection and merging system.

### Exported Functions

```typescript
// detection.ts (lines 12-192)
normalizeName(name): string
normalizePhone(phone): string
normalizeEmail(email): string
normalizeDomain(domain): string
calculateCompletenessScore(record, weights): CompletenessResult
stringSimilarity(str1, str2): number
getConfidenceFromScore(score): 'exact' | 'high' | 'medium' | 'low'

// algorithms.ts
findCompanyDuplicates(companyId): Promise<DuplicateGroup[]>
findContactDuplicates(contactId): Promise<DuplicateGroup[]>
scanAllDuplicates(): Promise<ScanResult>

// merge.ts
mergeCompanies(sourceId, targetId, options): Promise<MergeResult>
mergeContacts(sourceId, targetId, options): Promise<MergeResult>
autoMergeGroup(groupId): Promise<AutoMergeResult>
```

### Constants

```typescript
const COMPANY_FIELD_WEIGHTS: FieldWeights = {
  name: 10,
  domain: 15,
  status: 5,
  segment: 5,
  vfp_customer_id: 10,
  ats_id: 10,
  external_ids: 10,
  // ...
};

const CONFIDENCE_THRESHOLDS = {
  exact: 100,
  high: 85,
  medium: 70,
  low: 50,
};
```

---

## 16. Email

**Path:** `src/lib/email/`

Email intelligence and processing.

### Exported Functions

```typescript
// enrichEmailContext.ts
enrichEmailContext(email): Promise<EnrichedContext>

// analyzeEmail.ts
analyzeEmail(email, context): Promise<EmailAnalysis>

// processInboundEmail.ts
processInboundEmail(email): Promise<ProcessingResult>

// noiseDetection.ts
classifyEmailNoise(senderEmail, subject): NoiseClassification
isNoiseEmail(senderEmail, subject): boolean
```

---

## 17. Event Sourcing

**Path:** `src/lib/eventSourcing/`

Event sourcing infrastructure for lifecycle and support case domains.

### Exported Functions

```typescript
// guardrails.ts - Enforce architectural rules
assertNotProjectionWrite(tableName): void
createReadOnlyProjectionsClient(): SupabaseClient
isProjectorFile(filePath): boolean
findProjectionWriteViolations(): ProjectionWriteViolation[]
withProjectionGuard(supabase, fn): Promise<T>

// observability.ts - Structured logging and metrics
esLogger(level, message, data): void
trackCommandExecution(command, duration, result): void
trackEventAppended(event, aggregateType): void
trackProjectorRun(projector, eventsProcessed, duration): void
trackSlaBreachDetected(aggregateId, slaType): void
trackRebuildStarted(projector): void
trackRebuildProgress(projector, progress): void
trackRebuildCompleted(projector, duration, eventsProcessed): void
getMetricsSnapshot(): MetricsSnapshot
getRecentLogs(limit?): StructuredLogEntry[]
getProjectionLagSummary(): LagSummary
exportPrometheusMetrics(): string

// rebuild.ts - Deterministic projection rebuilding
rebuildProjections(options): Promise<RebuildResult>
takeProjectionSnapshot(projectorName): Promise<ProjectionSnapshot>
compareSnapshots(before, after): SnapshotDiff
verifyRebuildDeterminism(projectorName, iterations): Promise<boolean>

// projectorRegistry.ts
getProjectorByName(name): Projector | null
getAllProjectors(): Projector[]
getProjectorNames(): string[]
registerProjector(name, projector): void
clearRegistry(): void
```

### Constants

```typescript
const PROJECTION_TABLES = [
  'company_product_read_models',
  'company_product_stage_facts',
  'product_pipeline_stage_counts',
  'support_case_read_models',
  'support_case_sla_facts',
  'open_case_counts_per_product',
];

const AUTHORITATIVE_TABLES = [
  'lifecycle_events',
  'support_case_events',
];
```

---

## 18. Features

**Path:** `src/lib/features/`

Feature flag system.

### Files

| File | Purpose |
|------|---------|
| `flags.ts` | Feature flag definitions and checks |
| `index.ts` | Re-exports |

---

## 19. Fireflies

**Path:** `src/lib/fireflies/`

Fireflies.ai integration for meeting transcription.

### Exported Functions

```typescript
// client.ts
class FirefliesClient {
  getTranscripts(limit?): Promise<FirefliesTranscriptListItem[]>
  getTranscript(id): Promise<FirefliesTranscript>
  getUser(): Promise<FirefliesUser>
}

// sync.ts
syncFirefliesTranscripts(userId): Promise<SyncResult>
connectFireflies(userId, apiKey): Promise<void>
disconnectFireflies(userId): Promise<void>
getFirefliesConnectionStatus(userId): Promise<FirefliesConnection>
updateFirefliesSettings(userId, settings): Promise<void>
```

### Types

```typescript
interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  transcript_text: string;
  sentences: FirefliesSentence[];
  participants: string[];
  duration: number;
}
```

---

## 20. Focus

**Path:** `src/lib/focus/`

Focus mode utilities (minimal, just index.ts).

---

## 21. Import

**Path:** `src/lib/import/`

Data import utilities.

### Files

| File | Purpose |
|------|---------|
| `dataTransform.ts` | Transform imported data |
| `importService.ts` | Import service orchestrator |
| `types.ts` | Import type definitions |

---

## 22. Inbox

**Path:** `src/lib/inbox/`

Inbox management and AI analysis.

### Files

| File | Purpose |
|------|---------|
| `actionsService.ts` | Inbox action handling |
| `aiAnalysis.ts` | AI analysis for inbox items |
| `inboxService.ts` | Core inbox service |
| `schedulingBridge.ts` | Bridge to scheduling system |
| `slaService.ts` | SLA tracking for inbox items |

---

## 23. Intelligence

**Path:** `src/lib/intelligence/`

Intelligence collection and synthesis.

### Exported Functions

```typescript
// Entity Matcher (Phase 1A) - AI-powered entity matching
intelligentEntityMatch(communication): Promise<EntityMatchResult>
extractRawIdentifiers(communication): RawIdentifiers
findCandidateCompanies(identifiers): Promise<Company[]>
findCandidateContacts(identifiers): Promise<Contact[]>

// Context-First Pipeline (Phase 1B)
processIncomingCommunication(communication): Promise<ProcessingResult>
buildFullRelationshipContext(companyId): Promise<RelationshipContext>
analyzeWithFullContext(communication, context): Promise<Analysis>
updateRelationshipIntelligence(companyId, analysis): Promise<void>
determineActionsWithContext(analysis, context): Promise<Action[]>

// Orchestrator
collectIntelligence(companyId, options?): Promise<Intelligence>
getCollectionProgress(companyId): Promise<CollectionProgress>
getIntelligence(companyId): Promise<Intelligence | null>
isIntelligenceStale(companyId): Promise<boolean>

// Synthesis
synthesizeIntelligence(rawData): Promise<SynthesizedIntelligence>
saveIntelligence(companyId, intelligence): Promise<void>

// Collectors
websiteCollector.collect(domain): Promise<WebsiteData>
facebookCollector.collect(companyName): Promise<FacebookData>
googleReviewsCollector.collect(companyName): Promise<ReviewsData>
apolloCompanyCollector.collect(domain): Promise<ApolloCompanyData>
apolloPeopleCollector.collect(companyId): Promise<ApolloContactData[]>
industryCollector.collect(industry): Promise<IndustryData>
marketingActivityCollector.collect(companyId): Promise<MarketingData>

// Enrichment
enrichCompanyFromIntelligence(companyId): Promise<EnrichmentResult>
autoDetectCompanyDomain(companyName): Promise<string | null>
enrichExistingContacts(companyId): Promise<BatchResult>
enrichContact(contactId): Promise<EnrichmentResult>
enrichContactFromEmail(email): Promise<Contact | null>
```

---

## 24. Lens

**Path:** `src/lib/lens/`

Lens system for role-based UI configuration.

### Exported Functions

```typescript
// lensConfig.ts
getLensConfig(lensType): LensConfig
getAllLenses(): LensConfig[]
isWidgetVisible(lens, widget): boolean
isPrimaryCTA(lens, ctaType): boolean
isQueueDefault(lens, queueId): boolean

// LensContext.tsx (React)
LensProvider: React.FC
useLens(): LensState
useWidgetVisibility(widget): boolean
usePrimaryCTA(): string
useDefaultQueue(): string

// focusSegmentMapping.ts
getFocusSegmentConfig(focus): FocusSegmentConfig
getVisibleQueuesForLens(lens): Queue[]
isQueueVisibleForLens(lens, queueId): boolean
getCTALabel(lens): string
getFocusRestriction(role): FocusRestriction
canAccessLens(role, lens): boolean
canSwitchLens(role): boolean
getDefaultLensForRole(role): LensType
isNavItemHidden(lens, navItem): boolean
getOrderedQueuesForLens(lens): Queue[]
```

---

## 25. Lifecycle

**Path:** `src/lib/lifecycle/`

Event-sourced lifecycle management for CompanyProduct aggregates.

### Exported Functions

```typescript
// events.ts
// All lifecycle event types and builders

// aggregate.ts
loadLifecycleAggregate(productId, companyId): Promise<LifecycleAggregate>
applyLifecycleEvent(state, event): LifecycleState
replayLifecycleEvents(events): LifecycleState

// commands.ts
startOnboarding(command): Promise<CommandResult>
moveStage(command): Promise<CommandResult>
setHealthStatus(command): Promise<CommandResult>
recordEngagement(command): Promise<CommandResult>
flagRisk(command): Promise<CommandResult>
resolveRisk(command): Promise<CommandResult>
scheduleFollowUp(command): Promise<CommandResult>
recordMilestone(command): Promise<CommandResult>

// projectors/
runProjector(projector, fromSequence?): Promise<ProjectorResult>
rebuildProjector(projector): Promise<RebuildResult>
getCheckpoint(projector): Promise<number>
runAllProjectors(): Promise<AllProjectorsResult>
rebuildAllProjectors(): Promise<RebuildAllResult>
getProjectorStatuses(): Promise<ProjectorStatus[]>
getProjectorLag(): Promise<ProjectorLag>

// Projector instances
CompanyProductReadModelProjector
CompanyProductStageFactsProjector
ProductPipelineStageCountsProjector
```

---

## 26. Microsoft

**Path:** `src/lib/microsoft/`

Microsoft Graph API integration.

### Exported Functions

```typescript
// auth.ts (lines 8-149)
getValidToken(userId): Promise<string | null>
hasActiveConnection(userId): Promise<boolean>
getConnection(userId): Promise<MicrosoftConnection | null>
disconnectMicrosoft(userId): Promise<boolean>
updateLastSync(userId): Promise<void>

// emailSync.ts
syncEmails(userId, options?): Promise<EmailSyncResult>
fetchEmailsFromGraph(token, query): Promise<GraphEmail[]>
processEmail(email, userId): Promise<ProcessedEmail>

// calendarSync.ts
syncCalendar(userId, options?): Promise<CalendarSyncResult>
fetchEventsFromGraph(token, query): Promise<GraphEvent[]>
processCalendarEvent(event, userId): Promise<ProcessedEvent>

// graph.ts
getGraphClient(token): GraphClient
callGraphAPI(client, endpoint): Promise<GraphResponse>
```

---

## 27. Pipelines

**Path:** `src/lib/pipelines/`

Background processing pipelines.

### Files

| File | Purpose |
|------|---------|
| `detectDealDeadlines.ts` | Detect approaching deal deadlines |
| `detectInboundEmails.ts` | Process new inbound emails |
| `detectMeetingFollowups.ts` | Detect meetings needing follow-up |
| `processTranscriptAnalysis.ts` | Process transcript for insights |
| `updateSlaStatus.ts` | Update SLA status for items |

---

## 28. Process

**Path:** `src/lib/process/`

Process management utilities.

### Files

| File | Purpose |
|------|---------|
| `index.ts` | Process exports |
| `types.ts` | Process type definitions |

---

## 29. PST

**Path:** `src/lib/pst/`

PST file parsing for email import.

### Files

| File | Purpose |
|------|---------|
| `pstParser.ts` | Parse PST files for email extraction |

---

## 30. RBAC

**Path:** `src/lib/rbac/`

Role-based access control.

### Files

| File | Purpose |
|------|---------|
| `index.ts` | RBAC exports |
| `types.ts` | RBAC type definitions |

---

## 31. Scheduler

**Path:** `src/lib/scheduler/`

Full-featured AI scheduling system (largest module - 393 lines in index.ts).

### Exported Functions

```typescript
// Core Types
export * from './types';
export * from './events';

// Tagged Timestamps (bulletproof timezone handling)
createTaggedTimestamp(isoString, timezone): TaggedTimestamp
formatTaggedForDisplay(tagged): string
formatTaggedForEmail(tagged): string
formatTaggedForGraphAPI(tagged): string
isTaggedInFuture(tagged): boolean
parseAndTagTimestamp(dateStr, timezone): TaggedTimestamp

// Timestamp Validation
validateProposedTime(time, context): ValidationResult
validateProposedTimes(times, context): ValidationResult[]
detectMistreatedBareTimestamp(timestamp): boolean
suggestCorrectInterpretation(timestamp): string

// Scheduling Service
schedulingService: SchedulingService
adminSchedulingService: SchedulingService

// Email Generation
generateSchedulingEmail(request, emailType): Promise<Email>
generateEmailVariants(request, count): Promise<Email[]>
formatTimeSlotsForEmail(slots): string
generateProposedTimes(userId, options): Promise<TaggedTimestamp[]>
parseSchedulingResponse(email): Promise<ParsedSchedulingResponse>
generateMeetingPrepBrief(meetingId): Promise<Brief>

// Response Processing
findMatchingSchedulingRequest(email): Promise<SchedulingRequest | null>
processSchedulingResponse(email, request): Promise<ProcessingResult>
processSchedulingEmails(userId): Promise<BatchResult>

// Calendar Integration
createMeetingCalendarEvent(request, confirmedTime): Promise<CalendarEvent>
updateMeetingCalendarEvent(eventId, updates): Promise<CalendarEvent>
cancelMeetingCalendarEvent(eventId): Promise<void>
getAvailableTimeSlots(userId, dateRange): Promise<TimeSlot[]>
getRealAvailableSlots(userId, options): Promise<TaggedAvailabilitySlot[]>
getMultiAttendeeAvailability(attendees, options): Promise<MultiAttendeeResult>

// Confirmation Workflow
executeConfirmationWorkflow(input): Promise<ConfirmationResult>
sendMeetingReminder(requestId): Promise<void>

// Channel Strategy
initializeChannelProgression(request): ChannelProgression
shouldEscalateChannel(progression): boolean
escalateChannel(progression): ChannelProgression
recordChannelAttempt(requestId, channel): Promise<void>
sendSchedulingSmsToContact(contactId, message): Promise<SmsResult>

// Persona Engine
detectPersona(contact): Promise<Persona>
detectPersonaWithAI(contact, history): Promise<Persona>
getToneConfig(persona): ToneConfig
adjustEmailForPersona(email, persona): Email

// Meeting Strategy
getMeetingStrategy(meetingType): MeetingStrategy
getAdjustedDuration(strategy, context): number
getRecommendedTone(strategy, context): string
isSmsAllowed(strategy): boolean

// Scheduling Intelligence
computeSchedulingIntelligence(request): Promise<SchedulingIntelligence>

// Reputation Guardrails
checkCanContact(contactId): Promise<GuardrailCheckResult>
checkCompanyCanContact(companyId): Promise<GuardrailCheckResult>
recordContactEvent(contactId, eventType): Promise<void>
blockContact(contactId, reason): Promise<void>
unblockContact(contactId): Promise<void>
getContactFrequencyState(contactId): Promise<ContactFrequencyState>

// Attendee Optimization
analyzeAttendees(request): Promise<AttendeeAnalysis>
applySuggestion(suggestionId): Promise<void>
rejectSuggestion(suggestionId): Promise<void>

// No-Show Recovery
detectNoShows(): Promise<NoShowEvent[]>
processNoShow(event): Promise<NoShowRecoveryResult>
markMeetingCompleted(requestId): Promise<void>
markMeetingRescheduled(requestId, newTime): Promise<void>

// Social Proof
getSocialProofForCompany(companyId): Promise<SocialProofItem[]>
selectSocialProofForScheduling(request): Promise<SocialProofSelection>
formatSocialProofForEmail(proof): string

// Seasonality
getSeasonalContext(date): SeasonalContext
getSchedulingAdjustments(context): SeasonalRecommendations
shouldBeMorePatient(context): boolean
getOptimalSchedulingWindow(context): DateRange

// Champion Involvement
shouldInvolveChampion(request): Promise<boolean>
recordChampionInvolvement(requestId, championId, type): Promise<void>

// Postmortems
createSchedulingPostmortem(requestId): Promise<SchedulingPostmortem>
getCompanySchedulingLearnings(companyId): Promise<Learning[]>

// Analytics
getSchedulingFunnel(dateRange): Promise<SchedulingFunnelMetrics>
getChannelMetrics(dateRange): Promise<ChannelMetrics>
getTimeSlotMetrics(dateRange): Promise<TimeSlotMetrics>
getAnalyticsSummary(dateRange): Promise<SchedulingAnalyticsSummary>

// Settings
getSchedulerSettings(userId): Promise<SchedulerSettings>
updateSchedulerSettings(userId, settings): Promise<void>
getEmailTemplates(userId): Promise<EmailTemplate[]>
createEmailTemplate(userId, template): Promise<EmailTemplate>

// Webhooks
getWebhooks(userId): Promise<WebhookConfig[]>
createWebhook(userId, config): Promise<WebhookConfig>
dispatchWebhookEvent(event): Promise<void>
dispatchMeetingScheduled(request, event): Promise<void>
verifyHmacSignature(payload, signature, secret): boolean

// API Keys
getApiKeys(userId): Promise<ApiKey[]>
createApiKey(userId, input): Promise<ApiKeyWithSecret>
validateApiKey(keyHash): Promise<ApiKey | null>
extractApiKey(request): string | null

// Draft System
generateDraft(requestId): Promise<SchedulingDraft>
getDraft(requestId): Promise<SchedulingDraft | null>
updateDraft(requestId, updates): Promise<SchedulingDraft>
getDraftForSending(requestId): Promise<SchedulingRequestWithDraft>
markDraftSent(requestId): Promise<void>
regenerateDraft(requestId): Promise<SchedulingDraft>
```

---

## 32. Signals

**Path:** `src/lib/signals/`

Signal events and projections bridging Command Center to Work items.

### Exported Functions

```typescript
// events.ts
// Signal event types and builders

// projections.ts
getActiveSignals(companyId): Promise<Signal[]>
getSignalsByType(signalType): Promise<Signal[]>
getSignalHistory(companyId, limit?): Promise<Signal[]>

// signalToWorkPipeline.ts
processSignalToWork(signal): Promise<WorkItem>
batchProcessSignals(): Promise<BatchResult>

// thresholdConfigService.ts
getThresholdConfig(signalType): Promise<ThresholdConfig>
updateThresholdConfig(signalType, config): Promise<void>
getDefaultThresholds(): ThresholdConfig[]
```

---

## 33. SMS

**Path:** `src/lib/sms/`

SMS integration via Twilio.

### Exported Functions

```typescript
// twilioService.ts
sendSms(to, message): Promise<SmsResult>
sendSchedulingSms(contactId, message): Promise<SmsResult>
getSmsHistory(contactId): Promise<SmsMessage[]>
```

---

## 34. Supabase

**Path:** `src/lib/supabase/`

Supabase client utilities.

### Exported Functions

```typescript
// admin.ts (line 8)
createAdminClient(): SupabaseClient
// IMPORTANT: Bypasses RLS - server-side only

// client.ts
createBrowserClient(): SupabaseClient

// server.ts
createClient(): Promise<SupabaseClient>
// For server components/route handlers

// middleware.ts
updateSession(request): Promise<Response>

// normalize.ts
normalizeRelation<T>(data): T | null
normalizeRelationArray<T>(data): T[]
```

---

## 35. Support Case

**Path:** `src/lib/supportCase/`

Event-sourced support case management.

### Exported Functions

```typescript
// events.ts
// All support case event types and builders
createSupportCaseCreatedEvent(data): SupportCaseCreated
createSupportCaseAssignedEvent(data): SupportCaseAssigned
createSupportCaseStatusChangedEvent(data): SupportCaseStatusChanged
createSupportCaseResolvedEvent(data): SupportCaseResolved
createSupportCaseClosedEvent(data): SupportCaseClosed
createSupportCaseReopenedEvent(data): SupportCaseReopened

// Type guards
isSupportCaseCreatedEvent(event): boolean
isSupportCaseStatusChangedEvent(event): boolean
isSupportCaseResolvedEvent(event): boolean
isSupportCaseClosedEvent(event): boolean
isSupportCaseReopenedEvent(event): boolean

// aggregate.ts
createInitialState(): SupportCaseState
applyEvent(state, event): SupportCaseState
replayEvents(events): SupportCaseState
loadSupportCaseAggregate(caseId): Promise<LoadedSupportCaseAggregate>
loadSupportCaseAggregateAtSequence(caseId, sequence): Promise<LoadedAggregate>
isValidStatusTransition(from, to): boolean
canClose(state): boolean
canReopen(state): boolean

// commands.ts
appendEvent(input): Promise<AppendEventResult>
createSupportCase(command): Promise<CommandResult>
assignSupportCase(command): Promise<CommandResult>
changeSupportCaseStatus(command): Promise<CommandResult>
changeSupportCaseSeverity(command): Promise<CommandResult>
setSupportCaseNextAction(command): Promise<CommandResult>
configureSupportCaseSla(command): Promise<CommandResult>
resolveSupportCase(command): Promise<CommandResult>
closeSupportCase(command): Promise<CommandResult>
reopenSupportCase(command): Promise<CommandResult>
```

---

## 36. Sync

**Path:** `src/lib/sync/`

Data synchronization utilities.

### Files

| File | Purpose |
|------|---------|
| `initialHistoricalSync.ts` | Initial historical data sync |

---

## 37. Tooltips

**Path:** `src/lib/tooltips/`

Tooltip content definitions.

### Files

| File | Purpose |
|------|---------|
| `definitions.ts` | Tooltip text definitions |
| `index.ts` | Re-exports |

---

## 38. Tracking

**Path:** `src/lib/tracking/`

Email tracking utilities.

### Files

| File | Purpose |
|------|---------|
| `emailTracking.ts` | Email open/click tracking |
| `tokens.ts` | Tracking token generation |

---

## 39. Utils

**Path:** `src/lib/utils/`

General utility functions.

### Exported Functions

```typescript
// index.ts (lines 4-89)
cn(...inputs: ClassValue[]): string
formatCurrency(amount: number): string
formatDate(date: string | Date): string
formatRelativeTime(date: string | Date): string
formatDistanceToNow(date: Date): string
generateSlug(text: string): string
getInitials(name: string): string
```

---

## 40. Work

**Path:** `src/lib/work/`

Work queue system for prioritized task management.

### Exported Functions

```typescript
// types.ts
// All work queue types

// queueService.ts (legacy derived data)
getQueueItems(userId, options): Promise<QueueItem[]>
getQueueCounts(userId): Promise<QueueCounts>
updateQueueItem(itemId, updates): Promise<QueueItem>

// events.ts
// Work event types and builders

// projections.ts
// Materialized views from events

// resolvers.ts
getResolverForItem(item): Resolver
resolveWorkItem(item): Promise<ResolveResult>
```

---

## 41. Workflow

**Path:** `src/lib/workflow/`

Workflow automation definitions.

### Files

| File | Purpose |
|------|---------|
| `index.ts` | Workflow exports |
| `nodes.ts` | Workflow node definitions |
| `types.ts` | Workflow type definitions |

---

## Module Dependency Graph

```
supabase/admin ─┬─> ai/core ──────────> ai/intelligence
                │                        │
                ├─> commandCenter ──────>│
                │                        │
                ├─> scheduler ───────────>│
                │                        │
                ├─> lifecycle ───────────> eventSourcing
                │                        │
                ├─> supportCase ─────────>│
                │                        │
                ├─> communicationHub ────> email
                │                        │
                ├─> intelligence ────────> ai/core
                │                        │
                └─> work ────────────────> signals
```

---

## Key Patterns

### 1. Event Sourcing

Used by: `lifecycle`, `supportCase`, `signals`, `work`

```typescript
// Commands emit events
const result = await createSupportCase({
  productId,
  companyId,
  title,
  description,
  actorId,
});

// Events are projected to read models
await runProjector(SupportCaseReadModelProjector);

// State is reconstructed from events
const aggregate = await loadSupportCaseAggregate(caseId);
```

### 2. Tagged Timestamps

Used by: `scheduler`

```typescript
// All times include explicit timezone
const tagged = createTaggedTimestamp('2026-01-15T14:00:00', 'America/New_York');
formatTaggedForEmail(tagged); // "Wednesday, January 15 at 2:00 PM ET"
formatTaggedForGraphAPI(tagged); // "2026-01-15T19:00:00.000Z"
```

### 3. Confidence Gating

Used by: `communicationHub`, `intelligence`

```typescript
const analysis = await analyzeCommunication(commId);
if (canTriggerAction(analysis)) {
  // High confidence - safe to auto-execute
} else {
  // Low confidence - create attention flag for human review
}
```

### 4. Admin Client Pattern

Used by: All server-side operations

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
// Bypasses RLS - use only in trusted server contexts
```

---

## Statistics

| Metric | Count |
|--------|-------|
| Total Files | 239 |
| Total Directories | 57 |
| Largest Module | `scheduler` (29 files) |
| Event-Sourced Domains | 3 (`lifecycle`, `supportCase`, `signals`) |
| External Integrations | 4 (Anthropic, Microsoft Graph, Fireflies, Twilio) |
