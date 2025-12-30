# X-FORCE Sales Platform - Complete System Architecture

**Generated:** December 29, 2025
**Version:** 1.0
**Platform:** Next.js 14+ / Supabase / Claude API

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [API Routes](#api-routes)
5. [Library Services](#library-services)
6. [UI Components](#ui-components)
7. [Page Routes & Navigation](#page-routes--navigation)
8. [Design System](#design-system)
9. [Redundancies & Technical Debt](#redundancies--technical-debt)
10. [Recommendations](#recommendations)

---

## Executive Summary

X-FORCE is an AI-first sales platform built for X-RAI Labs. The system manages the complete sales lifecycle from lead generation through customer success, with heavy AI integration for insights, automation, and decision support.

### Key Metrics

| Metric | Value |
|--------|-------|
| Database Tables | 47+ |
| API Endpoints | 200+ |
| Library Files | 232 |
| Library LOC | 95,579 |
| UI Components | 180+ |
| Component LOC | 66,590 |
| Primary Pages | 15+ |
| Sub-Pages | 60+ |

### Core Technologies

- **Frontend:** Next.js 14+, React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **AI:** Claude API (Anthropic)
- **Email/Calendar:** Microsoft Graph API
- **Transcription:** Fireflies.ai integration

### Architectural Patterns

1. **Event Sourcing** - Immutable event log for lifecycle management
2. **CQRS** - Command/Query separation with projections
3. **AI-First** - Claude-powered analysis, recommendations, and automation
4. **Domain-Driven Design** - Clear bounded contexts per feature area

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  Next.js Pages → React Components → Tailwind CSS             │
├─────────────────────────────────────────────────────────────┤
│                      API LAYER                               │
│  Next.js API Routes → Route Handlers → Middleware            │
├─────────────────────────────────────────────────────────────┤
│                    SERVICE LAYER                             │
│  src/lib/* → AI Services → Event Handlers → Projectors       │
├─────────────────────────────────────────────────────────────┤
│                     DATA LAYER                               │
│  Supabase → PostgreSQL → Event Store → Read Models           │
├─────────────────────────────────────────────────────────────┤
│                  INTEGRATION LAYER                           │
│  Microsoft Graph → Fireflies → External APIs                 │
└─────────────────────────────────────────────────────────────┘
```

### Core Domains

| Domain | Purpose | Architecture |
|--------|---------|--------------|
| **Sales Pipeline** | Deal management, stages, health scoring | Traditional CRUD |
| **Product Lifecycle** | Sales → Onboarding → Engagement | Event-Sourced |
| **Command Center** | Daily planning, AI recommendations | Hybrid |
| **Communications** | Email/meeting analysis | Event-Sourced |
| **Scheduler** | AI-powered meeting scheduling | Service-based |
| **Support Cases** | Ticket management | Event-Sourced |
| **Intelligence** | Company/contact research | Pipeline-based |

---

## Database Schema

### Schema Overview

The database implements 47+ tables organized into these categories:

1. **Core Sales** - companies, contacts, deals, activities
2. **Product Catalog** - product_categories, products, company_products
3. **AI Intelligence** - ai_summaries, ai_action_queue, ai_signals, ai_email_drafts
4. **Command Center** - command_center_items, daily_plans, rep_time_profiles
5. **Event Sourcing** - event_store, projector_checkpoints
6. **Lifecycle** - product_processes, product_process_stages, projections
7. **Communications** - email_conversations, email_messages
8. **Support Cases** - support_cases, support_case_read_model
9. **Integrations** - microsoft_connections, outlook_folders

### Core Tables

#### companies
Primary entity for organizations (prospects, customers, churned).

```sql
- id (UUID) - Primary key
- name (TEXT)
- status (enum: cold_lead, prospect, customer, churned)
- segment (enum: smb, mid_market, enterprise, pe_platform, franchisor)
- industry (enum: pest, lawn, both)
- agent_count (INTEGER)
- crm_platform (enum: fieldroutes, pestpac, realgreen, other)
- domain (TEXT) - For web research
- voice_customer (BOOLEAN)
- external_ids (JSONB) - {ats_id, rev_id, etc.}
```

#### contacts
Individual people at companies with AI-detected relationship intelligence.

```sql
- id (UUID)
- company_id (UUID) - FK to companies
- name, email, phone, title (TEXT)
- role (enum: decision_maker, influencer, champion, end_user, blocker)
- is_primary (BOOLEAN)
- relationship_facts (JSONB) - AI-detected personal facts
- communication_style (JSONB) - Detected preferences
- ai_confidence (NUMERIC 0-1)
```

#### deals
Sales opportunities with health scoring.

```sql
- id (UUID)
- company_id, owner_id (UUIDs)
- stage (enum: new_lead → closed_won/lost)
- deal_type (enum: new_business, upsell, cross_sell, expansion, renewal)
- health_score (INTEGER 0-100)
- health_factors (JSONB)
- health_trend (enum: improving, stable, declining)
- estimated_value (NUMERIC)
- products (JSONB)
```

#### event_store (Append-Only)
Immutable event log - source of truth for event-sourced domains.

```sql
- id (UUID)
- aggregate_type (TEXT) - 'company_product', 'support_case', etc.
- aggregate_id (UUID)
- sequence_number (BIGINT) - Per-aggregate ordering
- global_sequence (BIGSERIAL)
- event_type (TEXT) - 'StageTransitioned', 'TaskCompleted'
- event_data (JSONB)
- metadata (JSONB) - correlation_id, causation_id
- actor_type (enum: user, system, ai)
- occurred_at, recorded_at (TIMESTAMPTZ)
```

**Immutability enforced via triggers - no updates or deletes allowed.**

#### command_center_items
Unified action queue with momentum scoring.

```sql
- id (UUID)
- user_id (UUID)
- action_type (VARCHAR) - call, email_send_draft, meeting_prep, etc.
- title, description (TEXT)
- momentum_score (INTEGER 0-100)
- score_factors (JSONB)
- why_now (TEXT) - "He opened your proposal 3x in last hour"
- context_brief, win_tip (TEXT)
- status (enum: pending, in_progress, completed, snoozed, dismissed)
- planned_for_date (DATE)
- source (enum: system, manual, email_sync, calendar_sync, signal_detection)
```

### Projection Tables (Read Models)

These tables are derived from the event_store and should never be written to directly:

| Table | Purpose |
|-------|---------|
| `company_product_read_model` | Current lifecycle state |
| `company_product_stage_facts` | Stage duration analytics |
| `product_pipeline_stage_counts` | Pre-aggregated kanban counts |
| `work_item_projections` | Cross-lens work items |
| `work_queue_projections` | Queue summaries |
| `support_case_read_model` | Support case state |
| `support_case_sla_facts` | SLA tracking |

### Key Enums

```sql
-- Company/Deal
organization_type: prospect, customer, churned
segment: smb, mid_market, enterprise, pe_platform, franchisor
deal_stage: new_lead, qualifying, discovery, demo, data_review,
            trial, negotiation, closed_won, closed_lost

-- Users
user_role: rep, manager, admin
user_level: l1_foundation, l2_established, l3_senior
team: xrai, voice

-- AI
ai_action_type: send_email, move_stage, create_task, schedule_meeting,
                alert, update_value, add_contact, send_content
ai_signal_type: risk, opportunity, buying_signal, stale, competitor,
                sentiment_negative, engagement_spike, stage_stuck

-- Process
process_type: sales, onboarding, engagement
process_status: draft, published, archived
```

### RLS Security Model

| Access Level | Tables |
|--------------|--------|
| **Public Read** | product_categories, products |
| **Authenticated** | companies, contacts, deals, activities |
| **Own Data Only** | command_center_items, daily_plans, email_conversations |
| **Role-Based** | deals (managers see all), certifications (admin only) |
| **Service Role** | event_store, projections, projector_checkpoints |

---

## API Routes

### Route Inventory by Domain

#### Command Center & Daily Planning (25+ endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/command-center` | GET, POST | Unified daily view with AI enrichment |
| `/api/command-center/[itemId]` | GET, PUT, DELETE | Item CRUD |
| `/api/command-center/[itemId]/add-context` | POST | Add AI context |
| `/api/command-center/items/[id]/enrich` | POST | AI enrichment |
| `/api/command-center/items/[id]/generate-email` | POST | Generate email draft |
| `/api/command-center/score` | GET | Momentum scores |
| `/api/command-center/plan` | GET | Daily plan with time blocks |
| `/api/daily-driver` | GET | **PARALLEL** - Legacy prioritized lists |

#### Communications (20+ endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/communications` | GET | Query with filters |
| `/api/communications/[id]` | GET, PUT, DELETE | CRUD |
| `/api/communications/[id]/draft-reply` | POST | AI draft generation |
| `/api/communications/[id]/respond` | POST | Mark responded |
| `/api/communications/conversations` | GET | Grouped conversations |
| `/api/communications/response-queue` | GET | Awaiting response |
| `/api/communications/promises` | GET | Commitment tracking |

#### Scheduler (30+ endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/scheduler/requests` | GET, POST | Scheduling requests |
| `/api/scheduler/requests/[id]/confirm` | POST | Confirm meeting |
| `/api/scheduler/requests/[id]/book` | POST | Book meeting |
| `/api/scheduler/dashboard` | GET | Dashboard data |
| `/api/scheduler/automation` | GET, POST | Automation settings |
| `/api/scheduler/templates` | GET, POST | Email templates |
| `/api/scheduler/webhooks` | GET, POST | Webhook management |
| `/api/scheduler/leverage-moments` | GET, POST | Leverage opportunities |
| `/api/scheduler/analytics` | GET | Performance metrics |

#### Products & Pipeline (15+ endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/products` | GET, POST | Product catalog |
| `/api/products/[slug]` | GET, PUT, DELETE | Product details |
| `/api/products/[slug]/stages` | GET, POST | Sales stages |
| `/api/company-products/[id]/move-stage` | POST | Stage transition (event-sourced) |
| `/api/lifecycle/commands` | POST | Event-sourced commands |

#### Intelligence & Research (15+ endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/intelligence/[companyId]` | GET, POST | Company intelligence |
| `/api/intelligence/[companyId]/enrich-company` | POST | Company enrichment |
| `/api/intelligence/[companyId]/enrich-contacts` | POST | Contact enrichment |
| `/api/intelligence-v61/[companyId]/research` | POST | **V61** - Advanced research |
| `/api/intelligence-v61/[companyId]/strategy` | POST | **V61** - Strategy generation |

#### Companies & Contacts (20+ endpoints)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/companies` | GET, POST | Company list (5000+ supported) |
| `/api/companies/[id]` | GET, PUT, DELETE | Company CRUD |
| `/api/companies/[id]/products` | GET, POST | Company products |
| `/api/companies/[id]/intelligence` | GET, POST | Intelligence data |
| `/api/companies/[id]/memory` | GET, POST | AI context memory |
| `/api/contacts` | GET, POST | Contact list |
| `/api/contacts/[id]/enrich` | POST | AI enrichment |

#### Cron Jobs (15+ endpoints)

| Route | Purpose |
|-------|---------|
| `/api/cron/sync-communications` | Sync communications |
| `/api/cron/sync-inbox` | Sync inbox |
| `/api/cron/sync-microsoft` | Sync Microsoft 365 |
| `/api/cron/analyze-communications` | AI analysis |
| `/api/cron/generate-daily-plans` | Daily plan generation |
| `/api/cron/calculate-momentum` | Momentum scoring |
| `/api/cron/run-pipelines` | Projection pipelines |

### Identified Redundancies

| Issue | Routes | Recommendation |
|-------|--------|----------------|
| **Parallel Systems** | `/api/daily-driver` vs `/api/command-center` | Consolidate to command-center |
| **Intelligence Versions** | `/api/intelligence/*` vs `/api/intelligence-v61/*` | Migrate to v61, deprecate v1 |
| **Scheduler Complexity** | 30+ scheduler endpoints | Audit for unused endpoints |

---

## Library Services

### Module Inventory

The `src/lib/` directory contains 232 files totaling 95,579 lines of code.

#### AI Layer (9,000+ LOC)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `ai/core/` | Claude API integration | `callAI()`, `callAIJson()`, `callAIStream()` |
| `ai/intelligence/` | Deterministic deal scoring | `computeDealIntelligence()` |
| `ai/scoring/` | Health score calculation | `calculateHealthScore()` |
| `ai/signals/` | Signal detection | `signalDetector` |
| `ai/summaries/` | Entity summarization | `dealSummary`, `companySummary` |
| `ai/leverage/` | Brief generation | `briefGenerator`, `stopRules` |

#### Scheduler Module (300+ exports)

Complete meeting scheduling system with 9 phases:

1. Email generation & response processing
2. Calendar integration & confirmation
3. Channel strategy & persona engine
4. Scheduling intelligence & reputation
5. Leverage moments & no-show recovery
6. Social proof & seasonality
7. Analytics & metrics
8. Settings & configuration
9. Webhooks & API keys

Key services:
- `SchedulingService` - Main orchestrator
- `generateSchedulingEmail()` - Email generation
- `processSchedulingResponse()` - Response parsing
- `checkSchedulingStopRules()` - Safety gates

#### Command Center Module

Daily planning engine with tier-based prioritization.

```typescript
// Key functions
generateDailyPlan()      // Capacity-based planning
calculateMomentumScore() // Item prioritization
classifyItem()           // Tier detection (1-4)
enrichItem()             // Context enrichment
syncAllSources()         // Multi-source sync
```

#### Event Sourcing Infrastructure

| Component | Purpose |
|-----------|---------|
| `eventSourcing/guardrails` | Projection write protection |
| `eventSourcing/observability` | Metrics & SLA tracking |
| `eventSourcing/rebuild` | Deterministic snapshot & verification |
| `eventSourcing/registry` | Projector registration |

#### Lifecycle Engine (Event-Sourced)

Projectors for read model generation:
- `CompanyProductReadModelProjector` - Current state
- `CompanyProductStageFactsProjector` - Stage analytics
- `ProductPipelineStageCountsProjector` - Kanban counts
- `SLABreachFactsProjector` - SLA violations

#### Autopilot System

Three automated workflows with safety gates:
1. **Scheduler Autopilot** - Auto-process scheduling
2. **Needs Reply Autopilot** - Auto-respond to communications
3. **Transcript Autopilot** - Auto-send follow-ups

### Module Health Assessment

| Module | Status | Notes |
|--------|--------|-------|
| Scheduler | Complex | 300+ exports, needs decomposition |
| Event Sourcing | Good | Solid guardrails |
| AI/Core | Good | Clean separation, caching |
| Lifecycle | Good | Event-sourced, projectors working |
| Command Center | Good | Clear tier system |
| Health Score | **Bad** | Duplicate implementations |
| PST | **Legacy** | Unused, should archive |

---

## UI Components

### Component Inventory

180+ components across 35 feature folders totaling 66,590 lines of code.

#### Design System (`src/components/ui/`)

Base primitives:
- `Button.tsx` - 4 variants (default, outline, ghost, destructive)
- `Badge.tsx` - 5 variants (default, outline, destructive, success, warning)
- `Tooltip.tsx` - Radix-based tooltip
- `InfoTooltip.tsx` - Enhanced with definitions
- `Skeleton.tsx` - Loading states
- `Toast.tsx` - Notification system
- `ResizablePane.tsx` - Panel container

#### Command Center (`src/components/commandCenter/`) - 19 Components

The "Your Day" AI co-pilot view:
- `YourDayView.tsx` - Main orchestrator
- `ActionCard.tsx` / `ActionCardCompact.tsx` - Action items
- `TimeBlockBar.tsx` - Schedule visualization
- `DaySummary.tsx` - Daily metrics
- `SchedulerPopout.tsx` - Scheduling modal
- `EmailComposerPopout.tsx` - Email drafting
- `MeetingPrepPopout.tsx` - Meeting preparation
- `TranscriptPreviewModal.tsx` - Transcript viewer

#### Work Queue (`src/components/work/`) - 10 Components

- `WorkView.tsx` - Main work queue
- `WorkQueues.tsx` - Queue selector
- `QueueItemList.tsx` - Item list
- `WorkItemDetails.tsx` - Detail view
- `WorkItemContextPanel.tsx` - Context panel

#### Pipeline (`src/components/pipeline/`) - 4 Components

- `PipelineView.tsx` - Main orchestrator
- `KanbanBoard.tsx` - Board container
- `PipelineColumn.tsx` - Column renderer
- `DealCard.tsx` - Card component

#### Communications (`src/components/communications/`) - 8 Components

- `ConversationList.tsx` - Conversation list
- `ConversationThread.tsx` - Thread view
- `CustomerContext.tsx` - Customer panel
- `ResponseQueue.tsx` - Response queue
- `PromisesTracker.tsx` - Commitment tracker

### Component Duplication Issues

#### Scheduler Modal Duplication (4 variants)

| Location | Context |
|----------|---------|
| `commandCenter/SchedulerPopout.tsx` | Command Center |
| `scheduler/ScheduleMeetingModal.tsx` | Generic |
| `dailyDriver/ScheduleMeetingModal.tsx` | Daily Driver |
| `work/WorkSchedulerModal.tsx` | Work Queue |

**Recommendation:** Consolidate to single modal with context props.

#### Pipeline Duplication

| File | Size | Data Source |
|------|------|-------------|
| `ProductPipeline.tsx` | 6,219 bytes | `CompanyProduct[]` |
| `ProcessPipeline.tsx` | 6,178 bytes | `CompanyProductReadModel` |

**Recommendation:** Investigate consolidation.

---

## Page Routes & Navigation

### Primary Navigation

| Path | Purpose | Type |
|------|---------|------|
| `/work` | Unified work queue | Server + Client |
| `/customers` | Customer directory | Server |
| `/process` | Process Studio | Server |
| `/products` | Product catalog | Server |
| `/reports` | Analytics dashboard | Server |

### Secondary Navigation ("More Tools")

| Path | Purpose |
|------|---------|
| `/command-center` | AI command center |
| `/daily` | Daily driver view |
| `/communications` | Email management |
| `/cases` | Support cases |
| `/companies` | Company directory |
| `/deals` | Deal pipeline |
| `/scheduler` | Meeting scheduling |
| `/settings` | Configuration |

### Role-Based Access Control

Navigation items are filtered by role via `isNavItemHidden()`:

| Role | Visible Items |
|------|---------------|
| `sales_rep` | Work, Deals, Pipeline, Scheduler |
| `onboarding_specialist` | Work, Customers, Onboarding |
| `customer_success_manager` | Work, Customers, Cases |
| `support_agent` | Work, Cases |
| `admin` | All items |

### Lens System

Multi-perspective views controlled by `LensProvider`:
- Sales lens
- Onboarding lens
- Customer Success lens
- Support lens

Each lens filters data and adjusts UI accordingly.

---

## Design System

### Design Philosophy

**"McKinsey meets Apple meets Stripe"** - Enterprise-grade data visualization with approachable simplicity.

### Color System

```css
/* Light Mode */
--background: #ffffff
--foreground: #0A0A0A (NOT pure black)
--muted: #F5F5F5
--muted-foreground: #737373
--border: #E5E5E5

/* Dark Mode */
--background: #0A0A0A
--foreground: #FAFAFA (NOT pure white)
--muted: #262626
--border: #262626

/* Semantic Colors */
--success: #10B981 (Emerald-500)
--warning: #F59E0B (Amber-500)
--error: #EF4444 (Red-500)
--primary: #3B82F6 (Blue-500)
```

### Typography

System font stack for native performance:
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

Type scale:
- Display: `text-3xl` (30px) - Hero metrics
- Title: `text-xl` (20px) - Page headers
- Body: `text-sm` (14px) - Default text
- Caption: `text-xs` (12px) - Supporting text

### Spacing System

4-8 point grid:
```css
p-2  (8px)  - Tight spacing
p-4  (16px) - Default spacing
p-6  (24px) - Comfortable spacing
gap-4 (16px) - Default grid gaps
gap-6 (24px) - Section spacing
```

### Component Patterns

**Card Anatomy:**
```jsx
<Card className="
  bg-white dark:bg-[#1a1a1a]
  rounded-xl              // 12px radius
  p-6                     // 24px padding
  border border-gray-200
  shadow-sm
  hover:shadow-md
  transition-all duration-300
">
```

**Table Design:**
- NO zebra striping
- Horizontal borders only (`border-b`)
- Hover: `hover:bg-gray-50`
- Headers: `uppercase text-xs tracking-wider`

### Animation Guidelines

```css
/* Quick Feedback */
transition-colors duration-200

/* Standard Transitions */
transition-all duration-300

/* Data Animations */
transition-all duration-700 ease-out
```

---

## Redundancies & Technical Debt

### High Priority Issues

#### 1. Health Score Duplication (990 LOC)

Two independent implementations:
- `src/lib/ai/health-score.ts` (252 LOC)
- `src/lib/ai/scoring/healthScore.ts` (738 LOC)

**Impact:** Confusion, inconsistent scores
**Fix:** Consolidate to single implementation (2-4 hours)

#### 2. Daily Driver vs Command Center

Parallel systems serving similar purposes:
- `/api/daily-driver` - Legacy prioritized lists
- `/api/command-center` - Newer AI-enriched version

**Impact:** Code duplication, maintenance burden
**Fix:** Migrate to Command Center, deprecate Daily Driver (4-8 hours)

#### 3. Intelligence Version Mismatch

- V1: `/api/intelligence/[companyId]/*`
- V61: `/api/intelligence-v61/[companyId]/*`

**Impact:** Unclear which is canonical
**Fix:** Complete V61 migration, remove V1 (8-16 hours)

### Medium Priority Issues

#### 4. Scheduler Modal Duplication

4 nearly identical scheduler modals in different contexts.

**Fix:** Create single configurable modal (4-8 hours)

#### 5. Pipeline Component Duplication

`ProductPipeline.tsx` vs `ProcessPipeline.tsx` - nearly identical.

**Fix:** Investigate and consolidate (2-4 hours)

#### 6. Communication System Overlap

Three conversation list implementations:
- `communications/ConversationList.tsx`
- `inbox/ConversationList.tsx`
- `email/EmailList.tsx`

**Fix:** Define clear responsibilities, consolidate (8-16 hours)

### Legacy Code

| Module | Status | Action |
|--------|--------|--------|
| `src/lib/pst/` | Unused | Archive/remove |
| `pipelines/detectInboundEmails.ts` | Deprecated | Remove |
| `work/queueService.ts` | Legacy | Migrate to events |

### Technical Debt Summary

| Category | LOC | Effort | Priority |
|----------|-----|--------|----------|
| Health Score Duplication | 990 | 2-4h | P0 |
| Daily Driver Consolidation | 500+ | 4-8h | P0 |
| Intelligence Migration | 1,000+ | 8-16h | P1 |
| Scheduler Modals | 2,000+ | 4-8h | P1 |
| PST Module Removal | 500 | 1h | P2 |
| **Total** | **~5,000** | **20-40h** | -- |

---

## Recommendations

### Immediate (Week 1)

1. **Resolve Health Score Duplication**
   - Keep `scoring/healthScore.ts` (more complete)
   - Deprecate `ai/health-score.ts`
   - Update all imports

2. **Document Event Sourcing Pattern**
   - Create ADR for projection architecture
   - Document which tables are read-only

### Short Term (Month 1)

3. **Consolidate Command Center**
   - Migrate Daily Driver functionality
   - Create deprecation notices
   - Update all references

4. **Complete Intelligence V61 Migration**
   - Audit V1 usage
   - Migrate remaining callers
   - Remove V1 endpoints

5. **Create Single Scheduler Modal**
   - Extract common component
   - Replace 4 variants with configurable props

### Medium Term (Quarter 1)

6. **Archive Legacy Code**
   - Remove PST module
   - Remove deprecated email detection
   - Clean up queue service

7. **Audit Scheduler Endpoints**
   - Identify unused endpoints
   - Consolidate cron jobs
   - Document API surface

8. **Complete Design System**
   - Add missing form components
   - Implement dark mode fully
   - Create component guidelines

### Ongoing

9. **Establish Code Review Standards**
   - No duplicate modules
   - Event-sourced changes require projector updates
   - Autopilot workflows require safety gates

10. **Monitor Technical Health**
    - Track module complexity
    - Alert on code duplication
    - Maintain test coverage

---

## Appendix: File Paths

### Key Configuration Files

```
/CLAUDE.md                    - Project instructions
/next.config.ts              - Next.js configuration
/tsconfig.json               - TypeScript configuration
/tailwind.config.ts          - Tailwind configuration
/.env.local                  - Environment variables
```

### Directory Structure

```
src/
├── app/
│   ├── (auth)/              - Login pages
│   ├── (dashboard)/         - Main app pages
│   └── api/                 - API routes
├── components/
│   ├── ui/                  - Design system
│   ├── commandCenter/       - Command center
│   ├── work/                - Work queue
│   ├── communications/      - Communications
│   └── [feature]/           - Feature components
├── lib/
│   ├── ai/                  - AI services
│   ├── scheduler/           - Scheduler module
│   ├── lifecycle/           - Event sourcing
│   ├── supabase/            - Database clients
│   └── [service]/           - Other services
└── types/                   - TypeScript types

supabase/
└── migrations/              - Database migrations

docs/
└── SYSTEM_ARCHITECTURE.md   - This document
```

---

*Document generated by Claude Code analysis of X-FORCE codebase.*
