# X-FORCE Type System Documentation

> Auto-generated documentation for TypeScript types in `src/types`
> Generated: 2026-01-01

## Overview

The `src/types` directory contains 9 TypeScript files defining the complete type system for X-FORCE, including database entities, event sourcing, and domain models.

---

## Table of Contents

1. [Core Types (index.ts)](#1-core-types)
2. [Command Center Types](#2-command-center-types)
3. [Communication Hub Types](#3-communication-hub-types)
4. [Event Sourcing Types](#4-event-sourcing-types)
5. [Support Case Types](#5-support-case-types)
6. [Operating Layer Types](#6-operating-layer-types)
7. [Products Types](#7-products-types)
8. [Engagement Types](#8-engagement-types)
9. [Duplicates Types](#9-duplicates-types)

---

## 1. Core Types

**File:** `src/types/index.ts` (~985 lines)

Core database types for all entities.

### Enums

```typescript
// Company & Organization
type CompanyStatus = 'cold_lead' | 'prospect' | 'customer' | 'churned';
type Segment = 'smb' | 'mid_market' | 'enterprise' | 'pe_platform' | 'franchisor';
type Industry = 'pest' | 'lawn' | 'both';
type CRMPlatform = 'fieldroutes' | 'pestpac' | 'realgreen' | 'other' | null;

// Contacts
type ContactRole = 'decision_maker' | 'influencer' | 'champion' | 'end_user' | 'blocker' | null;

// Deals
type DealStage = 'new_lead' | 'qualifying' | 'discovery' | 'demo' | 'data_review'
               | 'trial' | 'negotiation' | 'closed_won' | 'closed_lost' | 'closed_converted';
type DealType = 'new_business' | 'upsell' | 'cross_sell' | 'expansion' | 'renewal';
type HealthTrend = 'improving' | 'stable' | 'declining';

// Sales
type SalesTeam = 'voice_outside' | 'voice_inside' | 'xrai';
type ProductOwner = 'voice' | 'xrai';
type ProductEventType = 'pitched' | 'declined' | 'purchased' | 'churned' | 'upgraded' | 'downgraded';
type CompanyProductStatus = 'active' | 'churned' | 'paused';
type CollaboratorRole = 'owner' | 'collaborator' | 'informed';

// Signals
type SignalType = 'voicemail_spike' | 'queue_time_increase' | 'engagement_drop'
                | 'did_request' | 'expansion_indicator' | 'churn_risk' | 'upsell_opportunity';
type SignalStatus = 'new' | 'acted_on' | 'dismissed';

// Activities
type ActivityType = 'email_sent' | 'email_received' | 'meeting_held' | 'call_made'
                  | 'proposal_sent' | 'note' | 'stage_change';
type Sentiment = 'positive' | 'neutral' | 'negative' | null;

// Users
type UserRole = 'rep' | 'manager' | 'admin';
type UserLevel = 'l1_foundation' | 'l2_established' | 'l3_senior';
type Team = 'xrai' | 'voice';

// Tasks
type TaskType = 'follow_up' | 'call' | 'email' | 'meeting' | 'review' | 'custom';
type TaskPriority = 'high' | 'medium' | 'low';
type TaskSource = 'ai_recommendation' | 'manual' | 'meeting_extraction' | 'sequence' | 'fireflies_ai';

// Transcriptions
type TranscriptionFormat = 'plain' | 'vtt' | 'srt' | 'teams' | 'zoom' | 'otter' | 'fireflies';
type TranscriptionSource = 'manual' | 'fireflies' | 'zoom' | 'teams';
```

### Core Interfaces

```typescript
// Company (formerly Organization)
interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  segment: Segment;
  industry: Industry;
  agent_count: number;
  domain?: string | null;
  crm_platform: CRMPlatform;
  address: Address | string | null;
  voice_customer: boolean;
  external_ids: ExternalIds | null;
  vfp_customer_id?: string | null;  // Revenue system ID
  ats_id?: string | null;           // Billing ID
  // Relations
  contacts?: Contact[];
  deals?: Deal[];
  company_products?: CompanyProduct[];
}

// Contact
interface Contact {
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  role: ContactRole;
  is_primary: boolean;
  relationship_facts?: RelationshipFact[];
  communication_style?: CommunicationStyle | null;
}

// Deal
interface Deal {
  id: string;
  company_id: string;
  owner_id: string;
  name: string;
  stage: DealStage;
  deal_type: DealType;
  sales_team: SalesTeam | null;
  health_score: number;
  health_factors: HealthFactors | null;
  health_trend: HealthTrend | null;
  estimated_value: number;
  quoted_products: string[];
  trial_start_date: string | null;
  trial_end_date: string | null;
  expected_close_date: string | null;
}

// Activity
interface Activity {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string;
  user_id: string;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  sentiment: Sentiment;
  action_items: string[] | null;
  occurred_at: string;
}

// User
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  level: UserLevel;
  team: Team;
  territory: string | null;
  is_active: boolean;
}

// Task
interface Task {
  id: string;
  deal_id: string | null;
  company_id: string | null;
  assigned_to: string;
  type: TaskType;
  title: string;
  priority: TaskPriority;
  due_at: string;
  completed_at: string | null;
  source: TaskSource;
}
```

### Meeting Analysis Types

```typescript
interface MeetingAnalysis {
  summary: string;
  headline: string;
  keyPoints: MeetingKeyPoint[];
  stakeholders: MeetingStakeholder[];
  buyingSignals: MeetingBuyingSignal[];
  objections: MeetingObjection[];
  actionItems: MeetingActionItem[];
  theirCommitments: MeetingCommitment[];
  ourCommitments: MeetingOurCommitment[];
  sentiment: MeetingSentiment;
  extractedInfo: MeetingExtractedInfo;
  recommendations: MeetingRecommendation[];
  followUpEmail: MeetingFollowUpEmail;
}

interface MeetingStakeholder {
  name: string;
  role: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyQuotes: string[];
  dealRole?: ContactRole;
  personalFacts?: PersonalFact[];
}

interface MeetingSentiment {
  overall: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  interestLevel: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  trustLevel: 'established' | 'building' | 'uncertain';
}
```

### Microsoft Integration Types

```typescript
interface MicrosoftConnection {
  id: string;
  user_id: string;
  microsoft_user_id: string | null;
  email: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  is_active: boolean;
}

interface MicrosoftEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  from?: { emailAddress: { address: string; name?: string } };
  receivedDateTime?: string;
  conversationId?: string;
}

interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: AttendeeInfo[];
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl: string };
}
```

### Constants

```typescript
const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'new_lead', name: 'New Lead', order: 1, color: 'bg-gray-500' },
  { id: 'qualifying', name: 'Qualifying', order: 2, color: 'bg-blue-500' },
  // ... 10 stages total
];

const ACTIVITY_TYPES: ActivityTypeInfo[] = [
  { id: 'email_sent', name: 'Email Sent', icon: 'mail', color: 'bg-blue-100 text-blue-700' },
  // ... 7 activity types
];

const COMPANY_STATUSES: CompanyStatusInfo[] = [
  { id: 'cold_lead', name: 'Cold Lead', color: 'bg-gray-500' },
  // ... 4 statuses
];
```

---

## 2. Command Center Types

**File:** `src/types/commandCenter.ts`

Priority tier system and command center item types.

### Priority Tiers

```typescript
type PriorityTier = 1 | 2 | 3 | 4 | 5;

type TierTrigger =
  // Tier 1: RESPOND NOW
  | 'demo_request' | 'free_trial_form' | 'pricing_request' | 'meeting_request'
  | 'direct_question' | 'email_reply' | 'email_needs_response' | 'inbound_request'

  // Tier 2: DON'T LOSE THIS
  | 'deadline_critical' | 'competitive_risk' | 'buying_signal' | 'champion_dark'

  // Tier 3: KEEP YOUR WORD
  | 'transcript_commitment' | 'meeting_follow_up' | 'action_item_due' | 'promise_made'

  // Tier 4: MOVE BIG DEALS
  | 'high_value' | 'strategic_account' | 'csuite_contact' | 'deal_stale'

  // Tier 5: BUILD PIPELINE
  | 'cold_lead_reengage' | 'new_contact_no_outreach' | 'research_needed';

const TIER_CONFIGS: Record<PriorityTier, TierConfig> = {
  1: { name: 'RESPOND NOW', icon: '🔴', color: 'text-red-700' },
  2: { name: "DON'T LOSE THIS", icon: '🟠', color: 'text-orange-700' },
  3: { name: 'KEEP YOUR WORD', icon: '🟡', color: 'text-yellow-700' },
  4: { name: 'MOVE BIG DEALS', icon: '🔵', color: 'text-blue-700' },
  5: { name: 'BUILD PIPELINE', icon: '⚪', color: 'text-gray-600' },
};
```

### Command Center Item Types

```typescript
type ActionType =
  | 'email_respond' | 'email_send_draft' | 'call' | 'call_with_prep'
  | 'meeting_prep' | 'meeting_follow_up' | 'proposal_review'
  | 'research_account' | 'linkedin_touch' | 'task_simple';

type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed' | 'snoozed';
type ItemSource = 'email_sync' | 'calendar_sync' | 'signal_detection' | 'manual' | 'ai_analysis';

interface CommandCenterItem {
  id: string;
  user_id: string;
  action_type: ActionType;
  title: string;
  description: string | null;
  tier: PriorityTier;
  tier_trigger: TierTrigger;
  momentum_score: number;
  estimated_minutes: number;
  due_at: string | null;
  company_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  status: ItemStatus;
  source: ItemSource;
}
```

---

## 3. Communication Hub Types

**File:** `src/types/communicationHub.ts`

Communication analysis and AI confidence types.

### Communication Types

```typescript
type CommunicationType =
  | 'demo_request' | 'pricing_inquiry' | 'trial_request' | 'meeting_request'
  | 'question' | 'objection' | 'positive_signal' | 'status_update'
  | 'complaint' | 'churn_signal' | 'general_inquiry';

type CommunicationChannel = 'email' | 'meeting' | 'call' | 'chat';

interface Communication {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  content_preview: string | null;
  full_content: string | null;
  occurred_at: string;
  their_participants: Participant[];
  our_participants: Participant[];
}
```

### AI Analysis Types

```typescript
interface CommunicationAnalysis {
  id: string;
  communication_id: string;
  prompt_version: string;
  analysis_version: number;

  // AI-detected fields
  communication_type: CommunicationType;
  tier_trigger: TierTrigger | null;
  sentiment: Sentiment;
  urgency: 'high' | 'medium' | 'low';

  // Confidence scores
  confidence_overall: number;
  confidence_type: number;
  confidence_sentiment: number;

  // Extracted data
  key_points: string[];
  action_items: ActionItem[];
  questions: Question[];
  objections: Objection[];

  analyzed_at: string;
}
```

---

## 4. Event Sourcing Types

**File:** `src/types/eventSourcing.ts` (~529 lines)

Event sourcing infrastructure for lifecycle management.

### Core Event Sourcing Types

```typescript
type ProcessType = 'sales' | 'onboarding' | 'engagement';
type ProcessStatus = 'draft' | 'published' | 'archived';
type ActorType = 'user' | 'system' | 'ai';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type TerminalType = 'won' | 'lost' | 'completed' | 'churned' | 'cancelled';
type ExitReason = 'progressed' | 'regressed' | 'completed' | 'cancelled';
type ProjectorStatus = 'active' | 'paused' | 'rebuilding' | 'error';

interface EventStore {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence_number: number;
  global_sequence: number;
  event_type: string;
  event_data: Record<string, unknown>;
  metadata: EventMetadata;
  actor_type: ActorType;
  actor_id: string | null;
  occurred_at: string;
  recorded_at: string;
}

interface EventMetadata {
  correlation_id?: string;
  causation_id?: string;
  request_id?: string;
  source?: string;
}
```

### Lifecycle Events

```typescript
// Stage transition
interface StageTransitionedEvent {
  event_type: 'StageTransitioned';
  event_data: {
    from_stage_id: string | null;
    to_stage_id: string;
    to_stage_name: string;
    process_type: ProcessType;
    triggered_by?: 'manual' | 'automation' | 'ai';
  };
}

// Process completion
interface ProcessCompletedEvent {
  event_type: 'ProcessCompleted';
  event_data: {
    process_id: string;
    terminal_stage_id: string;
    terminal_type: TerminalType;
    duration_days: number;
  };
}

// SLA breach
interface SLABreachedEvent {
  event_type: 'SLABreached';
  event_data: {
    stage_id: string;
    sla_days: number;
    actual_days: number;
    days_over: number;
  };
}

// Health score update
interface HealthScoreUpdatedEvent {
  event_type: 'HealthScoreUpdated';
  event_data: {
    previous_score: number | null;
    new_score: number;
    risk_level: RiskLevel;
    risk_factors: string[];
  };
}

type CompanyProductEvent =
  | StageTransitionedEvent
  | ProcessStartedEvent
  | ProcessCompletedEvent
  | SLABreachedEvent
  | HealthScoreUpdatedEvent
  | TaskCompletedEvent
  | NoteAddedEvent
  | ActivityRecordedEvent;
```

### Read Models (Projections)

```typescript
interface CompanyProductReadModel {
  company_product_id: string;
  company_id: string;
  product_id: string;
  current_process_type: ProcessType | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  stage_entered_at: string | null;
  stage_sla_deadline: string | null;
  is_sla_breached: boolean;
  is_sla_warning: boolean;
  days_in_current_stage: number | null;
  health_score: number | null;
  risk_level: RiskLevel | null;
  risk_factors: string[];
  last_event_at: string | null;
  projected_at: string;
}

interface ProductPipelineStageCount {
  product_id: string;
  process_id: string;
  stage_id: string;
  stage_name: string;
  total_count: number;
  active_count: number;
  stalled_count: number;
  breached_count: number;
  total_value: number;
  avg_days_in_stage: number | null;
}
```

### Projector Types

```typescript
interface Projector<TState> {
  name: string;
  apply(state: TState | null, event: EventStore): TState;
  getInitialState(): TState;
}

interface ProjectorCheckpoint {
  projector_name: string;
  last_processed_global_sequence: number;
  events_processed_count: number;
  status: ProjectorStatus;
}

interface ProjectorResult {
  success: boolean;
  events_processed: number;
  errors: ProjectorError[];
  new_checkpoint: number;
}
```

---

## 5. Support Case Types

**File:** `src/types/supportCase.ts` (~601 lines)

Event-sourced support case management.

### Enums

```typescript
type SupportCaseStatus =
  | 'open' | 'in_progress' | 'waiting_on_customer'
  | 'waiting_on_internal' | 'escalated' | 'resolved' | 'closed';

type SupportCaseSeverity = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

type SupportCaseSource = 'email' | 'phone' | 'chat' | 'portal' | 'internal';

type EngagementImpact = 'positive' | 'neutral' | 'negative' | 'critical';

type SLAType = 'first_response' | 'resolution' | 'update';
```

### Read Model

```typescript
interface SupportCaseReadModel {
  support_case_id: string;
  company_id: string;
  company_product_id: string | null;

  // Case information
  title: string | null;
  description: string | null;
  source: SupportCaseSource | null;
  status: SupportCaseStatus;
  severity: SupportCaseSeverity;

  // Assignment
  owner_id: string | null;
  assigned_team: string | null;

  // SLA tracking
  first_response_due_at: string | null;
  first_response_at: string | null;
  first_response_breached: boolean;
  resolution_due_at: string | null;
  resolved_at: string | null;
  resolution_breached: boolean;

  // Metrics
  response_count: number;
  escalation_count: number;
  reopen_count: number;

  // CSAT
  csat_score: number | null;
  engagement_impact: EngagementImpact | null;
  churn_risk_contribution: number | null;
}
```

### Support Case Events

```typescript
interface SupportCaseCreated {
  type: 'SupportCaseCreated';
  data: {
    title: string;
    severity: SupportCaseSeverity;
    source: SupportCaseSource;
  };
}

interface SupportCaseStatusChanged {
  type: 'SupportCaseStatusChanged';
  data: {
    from_status: SupportCaseStatus;
    to_status: SupportCaseStatus;
    reason?: string;
  };
}

interface SupportCaseSLABreached {
  type: 'SupportCaseSLABreached';
  data: {
    sla_type: SLAType;
    target_hours: number;
    actual_hours: number;
    hours_over: number;
  };
}

interface SupportCaseResolved {
  type: 'SupportCaseResolved';
  data: {
    resolution_summary: string;
    root_cause?: string;
    resolution_time_hours: number;
    sla_met: boolean;
  };
}

type SupportCaseEventType =
  | SupportCaseCreated
  | SupportCaseAssigned
  | SupportCaseStatusChanged
  | SupportCaseSeverityChanged
  | SupportCaseResponseAdded
  | SupportCaseEscalated
  | SupportCaseSLABreached
  | SupportCaseResolved
  | SupportCaseClosed
  | SupportCaseReopened
  | SupportCaseCSATSubmitted;
```

### Commands

```typescript
interface CreateSupportCaseCommand {
  company_id: string;
  company_product_id?: string;
  title: string;
  severity: SupportCaseSeverity;
  source: SupportCaseSource;
  actor: { type: ActorType; id: string };
}

interface ResolveSupportCaseCommand {
  support_case_id: string;
  resolution_summary: string;
  root_cause?: string;
  actor: { type: ActorType; id: string };
}

interface CloseSupportCaseCommand {
  support_case_id: string;
  close_reason: 'resolved' | 'duplicate' | 'no_response' | 'cancelled' | 'other';
  actor: { type: ActorType; id: string };
}
```

---

## 6. Operating Layer Types

**File:** `src/types/operatingLayer.ts`

AI-driven sales orchestration types.

### Attention Flags

```typescript
type AttentionFlagType =
  | 'NEEDS_REPLY'
  | 'BOOK_MEETING_APPROVAL'
  | 'PROPOSAL_APPROVAL'
  | 'PRICING_EXCEPTION'
  | 'CLOSE_DECISION'
  | 'HIGH_RISK_OBJECTION'
  | 'NO_NEXT_STEP_AFTER_MEETING'
  | 'STALE_IN_STAGE'
  | 'GHOSTING_AFTER_PROPOSAL'
  | 'DATA_MISSING_BLOCKER'
  | 'SYSTEM_ERROR';

type AttentionFlagSeverity = 'low' | 'medium' | 'high' | 'critical';
type AttentionFlagOwner = 'human' | 'ai';
type AttentionFlagStatus = 'open' | 'snoozed' | 'resolved';

interface AttentionFlag {
  id: string;
  company_id: string;
  company_product_id: string | null;
  source_type: 'communication' | 'pipeline' | 'system';
  source_id: string | null;
  flag_type: AttentionFlagType;
  severity: AttentionFlagSeverity;
  reason: string;
  recommended_action: string | null;
  owner: AttentionFlagOwner;
  status: AttentionFlagStatus;
  snoozed_until: string | null;
}
```

### Daily Driver Types

```typescript
interface DailyDriverItem {
  id: string;
  company_id: string;
  company_name: string;
  tier: PriorityTier;
  tier_trigger: TierTrigger;
  action_required: string;
  context: string;
  urgency_reason: string;
  sla_deadline: string | null;
  sla_status: 'on_track' | 'warning' | 'breached';
  source_type: 'communication' | 'pipeline' | 'ai_signal';
  source_id: string | null;
}

interface DailyDriverResponse {
  items: DailyDriverItem[];
  stats: {
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    tier4_count: number;
    tier5_count: number;
    sla_breached_count: number;
    sla_warning_count: number;
  };
}
```

---

## 7. Products Types

**File:** `src/types/products.ts`

Product catalog and configuration types.

```typescript
interface ProductDisplay {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  is_sellable: boolean;
  sort_order: number;
}

interface ProductProcess {
  id: string;
  product_id: string;
  process_type: 'sales' | 'onboarding' | 'engagement';
  version: number;
  status: 'draft' | 'published' | 'archived';
  stages: ProductProcessStage[];
}

interface ProductProcessStage {
  id: string;
  process_id: string;
  name: string;
  slug: string;
  stage_order: number;
  sla_days: number | null;
  exit_criteria: ExitCriteria[];
  is_terminal: boolean;
  terminal_type: 'won' | 'lost' | 'completed' | 'churned' | null;
}
```

---

## 8. Engagement Types

**File:** `src/types/engagement.ts`

Customer engagement tracking types.

```typescript
interface EngagementScore {
  company_product_id: string;
  overall_score: number;
  trend: 'improving' | 'stable' | 'declining';
  factors: EngagementFactor[];
  calculated_at: string;
}

interface EngagementFactor {
  name: string;
  weight: number;
  score: number;
  contribution: number;
  details: string;
}

type EngagementSignal =
  | 'high_usage'
  | 'declining_usage'
  | 'feature_adoption'
  | 'support_ticket'
  | 'expansion_signal'
  | 'churn_risk';
```

---

## 9. Duplicates Types

**File:** `src/types/duplicates.ts`

Duplicate detection and merge types.

```typescript
type DuplicateConfidence = 'exact' | 'high' | 'medium' | 'low';
type DuplicateStatus = 'pending' | 'merged' | 'rejected' | 'auto_merged';

interface DuplicateGroup {
  id: string;
  entity_type: 'company' | 'contact';
  confidence: DuplicateConfidence;
  status: DuplicateStatus;
  match_score: number;
  match_reasons: string[];
  primary_id: string;
  duplicate_ids: string[];
  created_at: string;
  resolved_at: string | null;
}

interface MergeResult {
  success: boolean;
  merged_id: string;
  removed_ids: string[];
  fields_merged: string[];
  relations_transferred: RelationTransfer[];
}

interface FieldWeights {
  [field: string]: number;
}

interface CompletenessResult {
  fieldCount: number;
  score: number;
}
```

---

## Type Hierarchy

```
Core Types (index.ts)
├── Company/Organization
│   ├── Contact
│   ├── Deal
│   │   └── DealCollaborator
│   ├── Activity
│   ├── CompanyProduct
│   ├── CompanyProductHistory
│   └── CompanySignal
├── User
│   └── RepCertification
├── Task
├── MeetingTranscription
│   └── MeetingAnalysis
├── DealRoom
│   └── DealRoomAsset
└── MicrosoftConnection

Event Sourcing Types
├── EventStore
├── LifecycleEvent
│   ├── StageTransitionedEvent
│   ├── ProcessCompletedEvent
│   ├── SLABreachedEvent
│   └── HealthScoreUpdatedEvent
├── ProductProcess
│   └── ProductProcessStage
├── CompanyProductReadModel (Projection)
└── ProjectorCheckpoint

Support Case Types
├── SupportCase (Aggregate Root)
├── SupportCaseEvent
│   ├── SupportCaseCreated
│   ├── SupportCaseStatusChanged
│   ├── SupportCaseResolved
│   └── SupportCaseClosed
├── SupportCaseReadModel (Projection)
└── SupportCaseSLAFact (Projection)

Command Center Types
├── PriorityTier (1-5)
├── TierTrigger
├── CommandCenterItem
└── TIER_CONFIGS

Operating Layer Types
├── AttentionFlag
├── DailyDriverItem
└── DailyDriverResponse
```

---

## Type Guards

```typescript
// Check if event is a specific type
function isStageTransitionedEvent(event: LifecycleEvent): event is StageTransitionedEvent {
  return event.event_type === 'StageTransitioned';
}

function isSupportCaseCreatedEvent(event: SupportCaseEvent): event is SupportCaseCreated {
  return event.type === 'SupportCaseCreated';
}

// Check health score status
function getHealthScoreLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Needs Attention';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}
```

---

## Statistics

| Metric | Count |
|--------|-------|
| Type Files | 9 |
| Total Interfaces | ~120 |
| Total Enums | ~45 |
| Event Types | ~25 |
| Command Types | ~20 |
