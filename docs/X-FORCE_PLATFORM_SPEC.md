# X-FORCE Platform Specification
## AI-First Sales Platform for X-RAI Labs

**Version**: 1.0
**Last Updated**: December 2024
**Status**: Production

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Architecture](#2-platform-architecture)
3. [Core Philosophy](#3-core-philosophy)
4. [Database Schema](#4-database-schema)
5. [Dashboard Pages](#5-dashboard-pages)
6. [API Reference](#6-api-reference)
7. [Component Library](#7-component-library)
8. [Service Libraries](#8-service-libraries)
9. [AI Systems](#9-ai-systems)
10. [Integration Points](#10-integration-points)
11. [Design System](#11-design-system)
12. [Data Flow Architecture](#12-data-flow-architecture)

---

## 1. Executive Summary

X-FORCE is an AI-first sales platform that transforms how sales representatives operate. Rather than traditional CRM approaches where reps must navigate complex interfaces to find what matters, X-FORCE uses AI as an orchestrator that proactively identifies what needs attention and presents a prioritized daily plan.

### Technology Stack
- **Frontend**: Next.js 14+ with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: Anthropic Claude API (Haiku, Sonnet, Opus models)
- **Email/Calendar**: Microsoft Graph API
- **Meeting Transcription**: Fireflies.ai integration
- **SMS**: Twilio

### Key Metrics
- **181** API routes across 25 domains
- **150+** React components in 25 directories
- **34** service libraries
- **100+** database tables with comprehensive RLS policies
- **17** intelligence collectors for company research

---

## 2. Platform Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Command     │ │ Pipeline    │ │ Calendar    │ │ Intelligence│   │
│  │ Center      │ │ View        │ │ View        │ │ Tabs        │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                         API LAYER (181 Routes)                       │
│  Companies │ Contacts │ Deals │ Communications │ Scheduler │ AI     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      SERVICE LAYER (34 Libraries)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ AI Core  │ │ Scheduler│ │ Command  │ │ Intel-   │ │ Communi- │  │
│  │          │ │ Service  │ │ Center   │ │ ligence  │ │ cation   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      INTEGRATION LAYER                               │
│      Microsoft Graph  │  Fireflies.ai  │  Twilio  │  Apollo.io      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      DATA LAYER (Supabase)                           │
│    PostgreSQL + Row Level Security + Realtime Subscriptions          │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Key Technologies |
|-------|----------------|------------------|
| UI | User interaction, data display, form handling | React, Next.js, Tailwind |
| API | Request routing, auth, validation | Next.js App Router |
| Service | Business logic, AI orchestration, workflows | TypeScript classes |
| Integration | External API communication | REST, GraphQL, OAuth |
| Data | Persistence, queries, security | PostgreSQL, Supabase |

---

## 3. Core Philosophy

### AI as Orchestrator

The fundamental principle: **AI identifies what needs attention, humans decide what to do**.

```
Traditional CRM:
  Rep → Navigate UI → Find data → Decide what to do → Take action

X-FORCE:
  AI → Analyze all data → Identify priorities → Present daily plan → Rep decides → Execute
```

### The Five Principles

1. **Data First, Design Second** - Never let aesthetics obscure information
2. **Proactive Intelligence** - System finds risks/opportunities before reps look
3. **Human Choice Always** - AI recommends, humans approve
4. **Context Is King** - Every action informed by full relationship history
5. **Progressive Automation** - Phases 1-9 rollout of autonomous capabilities

### Priority Tier System

| Tier | Priority | Description | Time Allocation |
|------|----------|-------------|-----------------|
| 1 | Critical | Active deals at risk, urgent responses needed | 40% |
| 2 | High | Stale deals, upcoming deadlines | 30% |
| 3 | Important | Follow-ups, relationship maintenance | 20% |
| 4 | Monitor | Low-urgency items, future opportunities | 10% |

---

## 4. Database Schema

### Core Entity Tables

#### Companies Table
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'prospect',  -- prospect, customer, churned
  segment TEXT,                     -- smb, mid_market, enterprise, pe_platform
  industry TEXT,
  agent_count INTEGER,
  vfp_customer_id TEXT,            -- Legacy Rev system ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Status Values**: `prospect`, `active_opportunity`, `customer`, `churned`, `disqualified`
**Segment Values**: `smb` (1-5 agents), `mid_market` (6-20), `enterprise` (21-100), `pe_platform` (100+), `franchisor`

#### Contacts Table
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  role TEXT,           -- decision_maker, influencer, champion, end_user, blocker
  is_primary BOOLEAN DEFAULT false,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Role Values**: `decision_maker`, `influencer`, `champion`, `end_user`, `blocker`

#### Deals Table
```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  stage TEXT NOT NULL,           -- Pipeline stage
  amount DECIMAL(12,2),
  close_date DATE,
  owner_id UUID REFERENCES users(id),
  health_score INTEGER,          -- 0-100
  is_legacy BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Stage Values**: `new_lead`, `qualifying`, `discovery`, `demo`, `data_review`, `trial`, `negotiation`, `closed_won`, `closed_lost`

### Products System

#### Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,                  -- voice, ai_features, integrations
  mrr DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  is_sellable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Company Products (Junction)
```sql
CREATE TABLE company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  product_id UUID REFERENCES products(id),
  status TEXT DEFAULT 'active',   -- active, churned, pending
  current_stage TEXT,             -- Pipeline stage for this product
  stage_entered_at TIMESTAMPTZ,
  mrr DECIMAL(10,2),
  is_legacy BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Product Pipeline Stages
```sql
CREATE TABLE product_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  description TEXT,
  duration_days INTEGER,          -- Expected time in stage
  is_terminal BOOLEAN DEFAULT false
);
```

### Communication System

#### Communications Table
```sql
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,             -- email, call, meeting, sms
  direction TEXT,                 -- inbound, outbound
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  external_id TEXT,               -- Microsoft message ID
  thread_id TEXT,
  sent_at TIMESTAMPTZ,
  is_analyzed BOOLEAN DEFAULT false,
  analysis JSONB,                 -- AI analysis results
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Email Messages (Microsoft Sync)
```sql
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_id TEXT UNIQUE,         -- Microsoft Graph message ID
  internet_message_id TEXT,
  thread_id TEXT,
  subject TEXT,
  body_preview TEXT,
  body_html TEXT,
  body_text TEXT,
  sender_email TEXT,
  sender_name TEXT,
  recipients JSONB,
  folder TEXT,                    -- inbox, sent, etc.
  received_at TIMESTAMPTZ,
  is_read BOOLEAN,
  is_analyzed BOOLEAN DEFAULT false,
  analysis JSONB,
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Command Center System

#### Command Center Items
```sql
CREATE TABLE command_center_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,             -- email_response, meeting_prep, stale_deal, follow_up
  source_type TEXT,               -- email, meeting, transcript, deal
  source_id TEXT,
  tier INTEGER,                   -- 1-4 priority tier
  momentum_score INTEGER,         -- 0-100 priority score
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, dismissed
  title TEXT NOT NULL,
  description TEXT,
  action_type TEXT,               -- call, email, schedule, research
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  context JSONB,                  -- Rich context for UI
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Tier Values**:
- `1` = Critical (respond now)
- `2` = High (deal momentum)
- `3` = Important (relationship maintenance)
- `4` = Monitor (future opportunities)

**Type Values**: `email_response`, `meeting_prep`, `stale_deal`, `follow_up`, `transcript_review`, `close_deadline`, `competitor_risk`

### Intelligence System

#### Company Intelligence
```sql
CREATE TABLE company_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) UNIQUE,
  website_data JSONB,             -- Crawled website content
  social_data JSONB,              -- Facebook, LinkedIn, etc.
  review_data JSONB,              -- Google reviews, sentiment
  apollo_data JSONB,              -- Apollo.io company data
  industry_data JSONB,            -- Industry benchmarks
  marketing_data JSONB,           -- Marketing activity signals
  synthesized_summary TEXT,       -- AI-generated executive summary
  key_insights JSONB,             -- Extracted key facts
  last_collected_at TIMESTAMPTZ,
  collection_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Relationship Intelligence
```sql
CREATE TABLE contact_relationship_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) UNIQUE,
  company_id UUID REFERENCES companies(id),
  interaction_count INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  sentiment_trend TEXT,           -- positive, neutral, negative
  key_facts JSONB,                -- Array of important facts
  communication_preferences JSONB,
  stakeholder_influence TEXT,     -- high, medium, low
  buying_signals JSONB,
  objections_raised JSONB,
  commitments_made JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Account Memory
```sql
CREATE TABLE account_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) UNIQUE,
  key_facts JSONB,                -- Persistent facts about account
  preferences JSONB,              -- Known preferences
  history_summary TEXT,           -- AI-generated history
  important_dates JSONB,          -- Renewal, contract dates
  stakeholder_map JSONB,          -- Org chart/influence map
  notes JSONB,                    -- Manual notes from reps
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Scheduling System

#### Scheduling Requests
```sql
CREATE TABLE scheduling_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  status TEXT DEFAULT 'initiated',  -- initiated, sent, awaiting_response, confirmed, cancelled
  meeting_type TEXT,                -- discovery, demo, follow_up, check_in
  duration_minutes INTEGER DEFAULT 30,
  proposed_times JSONB,             -- Array of proposed time slots
  confirmed_time TIMESTAMPTZ,
  email_thread_id TEXT,
  attempt_count INTEGER DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Status Flow**: `initiated` → `sent` → `awaiting_response` → `confirmed` (or `cancelled`)

#### Scheduling Actions
```sql
CREATE TABLE scheduling_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID REFERENCES scheduling_requests(id),
  action_type TEXT,               -- initial_outreach, followup, confirmation, reminder
  channel TEXT,                   -- email, sms, call
  message_subject TEXT,
  message_body TEXT,
  sent_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Meeting Transcriptions

```sql
CREATE TABLE meeting_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  external_id TEXT,               -- Fireflies transcript ID
  title TEXT,
  transcript_text TEXT,
  duration_minutes INTEGER,
  attendees JSONB,
  meeting_date TIMESTAMPTZ,
  is_analyzed BOOLEAN DEFAULT false,
  analysis JSONB,                 -- AI analysis results
  summary TEXT,
  action_items JSONB,
  buying_signals JSONB,
  objections JSONB,
  sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tasks System

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  due_date DATE,
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  source_type TEXT,               -- manual, ai_generated, transcript
  source_id TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Attention Flags

```sql
CREATE TABLE attention_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,             -- stale_deal, no_response, competitor_risk, etc.
  severity TEXT,                  -- low, medium, high, critical
  status TEXT DEFAULT 'open',     -- open, snoozed, resolved
  title TEXT,
  description TEXT,
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  suggested_action TEXT,
  snoozed_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Users & Authentication

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,            -- Supabase Auth ID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'rep',        -- admin, manager, rep
  rep_level TEXT,                 -- L1, L2, L3
  microsoft_refresh_token TEXT,
  fireflies_api_key TEXT,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Enums Reference

```sql
-- Company Status
CREATE TYPE company_status AS ENUM (
  'prospect', 'active_opportunity', 'customer', 'churned', 'disqualified'
);

-- Market Segment
CREATE TYPE market_segment AS ENUM (
  'smb', 'mid_market', 'enterprise', 'pe_platform', 'franchisor'
);

-- Contact Role
CREATE TYPE contact_role AS ENUM (
  'decision_maker', 'influencer', 'champion', 'end_user', 'blocker'
);

-- Deal Stage
CREATE TYPE deal_stage AS ENUM (
  'new_lead', 'qualifying', 'discovery', 'demo',
  'data_review', 'trial', 'negotiation', 'closed_won', 'closed_lost'
);

-- Communication Type
CREATE TYPE communication_type AS ENUM (
  'email', 'call', 'meeting', 'sms', 'note'
);

-- Command Center Item Type
CREATE TYPE cc_item_type AS ENUM (
  'email_response', 'meeting_prep', 'stale_deal', 'follow_up',
  'transcript_review', 'close_deadline', 'competitor_risk'
);
```

---

## 5. Dashboard Pages

### Page Inventory (40+ Pages)

#### 5.1 Pipeline Management

| Page | Path | Purpose |
|------|------|---------|
| Pipeline | `/pipeline` | Kanban board for all deals |
| Deals List | `/deals` | Table view of all deals |
| Deal Detail | `/deals/[id]` | Single deal with full context |
| Deal Room | `/deals/[id]/room` | Collaborative deal space |

**Pipeline Page Features**:
- Drag-and-drop Kanban columns by stage
- Health score badges on each card
- Quick actions (call, email, schedule)
- Filter by owner, segment, health
- Real-time stage updates

#### 5.2 Company Management

| Page | Path | Purpose |
|------|------|---------|
| Companies List | `/companies` | All companies with search/filter |
| Company Detail | `/companies/[id]` | Full company profile |
| Intelligence Tab | `/companies/[id]/intelligence` | Research & enrichment |
| Products Tab | `/companies/[id]/products` | Product relationships |

**Company Detail Tabs**:
- Overview (summary, contacts, recent activity)
- Intelligence (research data, AI insights)
- Products (current products, pipeline, stages)
- Communications (email/call history)
- Deals (active and historical deals)

#### 5.3 Contact Management

| Page | Path | Purpose |
|------|------|---------|
| Contacts List | `/contacts` | All contacts with search |
| Contact Detail | `/contacts/[id]` | Full contact profile |

**Contact Detail Features**:
- Relationship intelligence panel
- Communication timeline
- Key facts and preferences
- Stakeholder influence map
- Activity history

#### 5.4 Communication Hub

| Page | Path | Purpose |
|------|------|---------|
| Inbox | `/inbox` | Email management |
| Communications | `/communications` | Unified comm view |

**Inbox Features**:
- Folder navigation (Inbox, Sent, Drafts)
- Conversation threading
- AI analysis badges
- Quick reply with AI drafts
- Link to company/deal
- Response queue

#### 5.5 Calendar & Scheduling

| Page | Path | Purpose |
|------|------|---------|
| Calendar | `/calendar` | Calendar views |
| Scheduler | `/scheduler` | Scheduling requests |

**Calendar Views**:
- Month, Week, Day, Agenda views
- Meeting prep integration
- One-click scheduling
- Attendee context

**Scheduler Features**:
- Active scheduling requests
- Email sequence tracking
- Response monitoring
- Confirmation workflow

#### 5.6 Products & Pipeline

| Page | Path | Purpose |
|------|------|---------|
| Products List | `/products` | All products |
| Product Detail | `/products/[slug]` | Product pipeline view |

**Product Detail Features**:
- Proven Process (sales stages)
- Pipeline view by stage
- Customer list
- Stage analytics
- AI suggestions

#### 5.7 AI & Automation

| Page | Path | Purpose |
|------|------|---------|
| Command Center | `/ai` | Daily planning view |
| Daily Driver | `/daily` | Operating layer |
| Learning | `/learning` | Rep coaching |

**Command Center (Your Day)**:
- Time-blocked daily schedule
- Priority tier sections
- Action cards with context
- Meeting prep popouts
- Email composer
- Progress tracking

**Daily Driver Features**:
- Needs Reply queue
- Needs Human Attention
- Stalled Deals
- Ready to Close

#### 5.8 Settings & Configuration

| Page | Path | Purpose |
|------|------|---------|
| Settings | `/settings` | All settings |

**Settings Tabs**:
- Profile settings
- Team management
- Microsoft connection
- Fireflies integration
- AI prompts editor
- Scheduler configuration
- Notification preferences

#### 5.9 Leverage Moments

| Page | Path | Purpose |
|------|------|---------|
| Leverage | `/leverage` | Human leverage opportunities |

**Features**:
- Detected leverage moments
- Execution briefs
- Trust basis tracking
- Stop rule display

---

## 6. API Reference

### 6.1 Companies Domain (10 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/companies` | GET | List companies with filters |
| `/api/companies` | POST | Create new company |
| `/api/companies/[id]` | GET | Get company details |
| `/api/companies/[id]` | PATCH | Update company |
| `/api/companies/[id]/contacts` | GET/POST | Company contacts |
| `/api/companies/[id]/products` | GET/POST | Company products |
| `/api/companies/[id]/intelligence` | GET/PATCH | Intelligence data |
| `/api/companies/[id]/memory` | GET/PATCH/POST | Account memory |

**GET /api/companies Query Params**:
```typescript
interface CompanyListParams {
  search?: string;      // Name search
  status?: string;      // Filter by status
  segment?: string;     // Filter by segment
  limit?: number;       // Default 50
  offset?: number;      // Pagination
}
```

### 6.2 Contacts Domain (5 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/contacts` | GET | List contacts |
| `/api/contacts` | POST | Create contact |
| `/api/contacts/[id]/enrich` | POST | Enrich from Apollo |
| `/api/contacts/[id]/intelligence` | GET | Relationship intelligence |
| `/api/relationships/[contactId]/notes` | GET/POST | Contact notes |

### 6.3 Deals Domain (5 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/deals` | GET | List deals |
| `/api/deals` | POST | Create deal |
| `/api/deals/[id]/convert` | POST | Convert legacy deal |
| `/api/deals/[id]/intelligence` | GET | Deal intelligence |
| `/api/deals/[id]/postmortem` | GET/POST | Deal postmortem |

### 6.4 Command Center Domain (10 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/command-center` | GET | Get daily items by tier |
| `/api/command-center` | POST | Create item |
| `/api/command-center/[itemId]` | GET/PATCH/DELETE | Item operations |
| `/api/command-center/[itemId]/context` | GET | Enriched context |
| `/api/command-center/[itemId]/add-context` | POST | Add manual context |
| `/api/command-center/items/[id]/enrich` | POST | Trigger AI enrichment |
| `/api/command-center/items/[id]/generate-email` | POST | Generate draft |
| `/api/command-center/plan` | GET | Time-blocked plan |
| `/api/command-center/score` | GET | Momentum scores |

**GET /api/command-center Query Params**:
```typescript
interface CommandCenterParams {
  date?: string;        // 'today', 'tomorrow', or 'YYYY-MM-DD'
  tier?: number;        // Filter by tier (1-4)
  status?: string;      // pending, completed, dismissed
}
```

### 6.5 Communications Domain (13 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/communications` | GET | List communications |
| `/api/communications` | POST | Create/link communication |
| `/api/communications/[id]` | GET/PATCH/DELETE | Communication operations |
| `/api/communications/[id]/respond` | POST | Send response |
| `/api/communications/[id]/draft-reply` | POST | AI draft |
| `/api/communications/[id]/assign` | POST | Assign to deal |
| `/api/communications/[id]/exclude` | POST | Exclude from processing |
| `/api/communications/[id]/create-lead` | POST | Create lead |
| `/api/communications/conversations` | GET/POST | Conversation threads |
| `/api/communications/response-queue` | GET | Awaiting response |
| `/api/communications/send-reply` | POST | Bulk send |
| `/api/communications/stats` | GET | Statistics |

### 6.6 Scheduler Domain (24 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/scheduler/requests` | GET/POST | Scheduling requests |
| `/api/scheduler/requests/[id]` | GET/PATCH/DELETE | Request operations |
| `/api/scheduler/requests/[id]/confirm` | POST | Confirm time |
| `/api/scheduler/requests/[id]/send` | POST | Send email |
| `/api/scheduler/requests/[id]/book` | POST | Direct book |
| `/api/scheduler/settings` | GET/POST | User settings |
| `/api/scheduler/templates` | GET/POST | Email templates |
| `/api/scheduler/availability` | GET | Available slots |
| `/api/scheduler/preview` | POST | Preview request |
| `/api/scheduler/analytics` | GET | Scheduling metrics |
| `/api/scheduler/dashboard` | GET | Dashboard data |
| `/api/scheduler/no-shows` | GET | No-show detection |

### 6.7 Intelligence Domain (12 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/intelligence/[companyId]` | GET | Get intelligence |
| `/api/intelligence/[companyId]` | POST | Trigger collection |
| `/api/intelligence/[companyId]/refresh` | POST | Force refresh |
| `/api/intelligence/[companyId]/enrich-company` | POST | Enrich company |
| `/api/intelligence/[companyId]/enrich-contacts` | POST | Enrich contacts |
| `/api/intelligence/[companyId]/marketing` | GET/POST | Marketing intelligence |
| `/api/intelligence/status/[companyId]` | GET | Collection status |
| `/api/intelligence-v61/[companyId]/research` | POST | V6.1 research |
| `/api/intelligence-v61/[companyId]/extract` | POST | Extract data |
| `/api/intelligence-v61/batch` | POST | Batch collection |

### 6.8 Meetings & Transcripts Domain (6 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/calendar/[meetingId]/prep` | GET | Meeting prep |
| `/api/meetings/transcriptions` | GET | List transcripts |
| `/api/meetings/transcriptions` | POST | Upload transcript |
| `/api/meetings/transcriptions/[id]` | GET/PATCH | Transcript operations |
| `/api/meetings/transcriptions/[id]/analyze` | POST | Run analysis |
| `/api/meetings/transcriptions/[id]/create-tasks` | POST | Create tasks |

### 6.9 Tasks Domain (6 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tasks` | GET | Get user tasks |
| `/api/tasks` | POST | Create task |
| `/api/tasks/[taskId]` | GET/PATCH/DELETE | Task operations |
| `/api/tasks/complete` | POST | Mark complete |
| `/api/tasks/resolve-transcript-review` | POST | Resolve review |
| `/api/tasks/suggest-email` | POST | Suggest response |

### 6.10 Attention Flags Domain (9 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/attention-flags` | GET | List flags |
| `/api/attention-flags/create` | POST | Create flag |
| `/api/attention-flags/[id]` | GET/PATCH/DELETE | Flag operations |
| `/api/attention-flags/[id]/resolve` | POST | Resolve flag |
| `/api/attention-flags/[id]/snooze` | POST | Snooze flag |
| `/api/attention-flags/[id]/unsnooze` | POST | Unsnooze |
| `/api/attention-flags/[id]/execute` | POST | Execute action |
| `/api/attention-flags/[id]/send-email` | POST | Send email |

### 6.11 Cron Jobs (12 Routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cron/analyze-emails` | GET/POST | Analyze new emails |
| `/api/cron/sync-command-center` | POST | Regenerate daily plan |
| `/api/cron/sync-communications` | POST | Sync all comms |
| `/api/cron/sync-microsoft` | POST | Sync Microsoft |
| `/api/cron/sync-fireflies` | POST | Sync transcripts |
| `/api/cron/calculate-momentum` | GET/POST | Recalculate scores |
| `/api/cron/classify-tiers` | POST | Classify items |
| `/api/cron/reconcile-actions` | POST | Reconcile actions |
| `/api/cron/generate-daily-plans` | POST | Generate plans |
| `/api/cron/run-pipelines` | POST | Detection pipelines |
| `/api/cron/detect-no-shows` | GET | No-show detection |

### 6.12 Authentication Patterns

All authenticated routes follow this pattern:

```typescript
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Route logic...
}
```

### 6.13 Response Patterns

**Success (single item)**:
```json
{ "data": { "id": "...", "name": "..." } }
```

**Success (list)**:
```json
{
  "data": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

**Error**:
```json
{ "error": "Error message here" }
```

---

## 7. Component Library

### 7.1 Component Directory Structure

```
src/components/
├── activities/          # Activity logging
├── ai/                  # Health scores, signals, summaries
├── analytics/           # Whitespace, adoption charts
├── calendar/            # Calendar views (Month/Week/Day/Agenda)
├── commandCenter/       # Your Day, action cards
├── communications/      # Conversation threads
├── companies/           # Company forms, lists
├── contacts/            # Contact cards, forms
├── dailyDriver/         # Operating layer views
├── dashboard/           # Dashboard widgets
├── deals/               # Deal forms, cards, rooms
├── email/               # Email preview, compose
├── import/              # Import wizard steps
├── inbox/               # Inbox views, action queue
├── intelligence/        # Research tabs, data fields
├── legacyDeals/         # Legacy conversion
├── meetings/            # Transcript analysis
├── pipeline/            # Kanban board
├── products/            # Product pipeline
├── providers/           # Context providers
├── relationship/        # Relationship intelligence
├── scheduler/           # Meeting scheduling
├── settings/            # Settings tabs
├── shared/              # Header, sidebar
├── tasks/               # Task lists
└── ui/                  # Base primitives
```

### 7.2 Key Component Patterns

#### Card Pattern (DataCard)
```tsx
<Card className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 border border-gray-200 dark:border-[#2a2a2a]">
  <div className="flex items-center gap-2 mb-4">
    <Icon className="h-5 w-5 text-gray-400" />
    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
      Title
    </h3>
  </div>
  <div className="text-3xl font-light text-gray-900 dark:text-gray-100">
    {metric}
  </div>
  <div className={cn("text-sm", trend > 0 ? "text-green-600" : "text-red-600")}>
    {trend > 0 ? "+" : ""}{trend}%
  </div>
</Card>
```

#### List Item Pattern
```tsx
<div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-200 dark:border-[#2a2a2a]">
  <div className="flex items-center gap-3">
    <Avatar />
    <div>
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <Badge>{status}</Badge>
    <Button variant="ghost" size="icon">
      <ChevronRight />
    </Button>
  </div>
</div>
```

#### Modal Pattern
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      {/* Form fields */}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 7.3 Command Center Components

| Component | Purpose |
|-----------|---------|
| `YourDayView` | Main orchestrator for daily planning |
| `ActionCard` | Individual action with context |
| `ActionCardCompact` | Condensed action card |
| `TimeBlockBar` | Visual time allocation |
| `DaySummary` | Daily metrics summary |
| `MeetingCard` | Meeting display |
| `MeetingPrepPopout` | Meeting prep materials |
| `EmailComposerPopout` | Quick email compose |
| `SchedulerPopout` | Quick schedule meeting |
| `AddContextModal` | Add context to action |

### 7.4 Intelligence Components

| Component | Purpose |
|-----------|---------|
| `IntelligenceTab` | Main container |
| `IntelligenceDataTab` | Structured fields |
| `CompanyResearchTab` | Web research |
| `InsightsView` | AI-generated insights |
| `DataField` | Individual field editor |
| `RawDataEditor` | JSON editor |

### 7.5 AI Components

| Component | Purpose |
|-----------|---------|
| `HealthScoreRing` | Circular score display |
| `HealthScoreBreakdown` | Factor breakdown |
| `SignalCard` | Risk/opportunity signal |
| `SignalBadge` | Compact signal indicator |
| `SignalsList` | List of all signals |
| `SummaryCard` | AI-generated summary |

### 7.6 Pipeline Components

| Component | Purpose |
|-----------|---------|
| `KanbanBoard` | Main drag-drop board |
| `PipelineColumn` | Stage column |
| `DealCard` | Deal card in column |
| `PipelineView` | Page wrapper |

---

## 8. Service Libraries

### 8.1 AI Core Services

#### AI Client (`src/lib/ai/core/aiClient.ts`)
```typescript
// Lazy-initialized Anthropic client
export function getAnthropicClient(): Anthropic;

// Send text request
export async function callAI(request: AIRequest): Promise<AIResponse>;

// Send structured JSON request
export async function callAIJson<T>(request: AIJsonRequest): Promise<T>;
```

#### Prompt Manager (`src/lib/ai/promptManager.ts`)
```typescript
// Get prompt with 5-minute caching
export async function getPrompt(key: string): Promise<AIPrompt | null>;

// Get prompt with variable replacement
export async function getPromptWithVariables(
  key: string,
  variables: Record<string, string>
): Promise<string>;
```

#### Health Score (`src/lib/ai/health-score.ts`)
```typescript
interface HealthScoreFactors {
  engagementRecency: number;    // 25%
  stageVelocity: number;        // 20%
  stakeholderCoverage: number;  // 15%
  activityQuality: number;      // 15%
  competitorRisk: number;       // 10%
  trialEngagement: number;      // 15%
}

export function calculateHealthScore(deal: Deal): {
  score: number;
  factors: HealthScoreFactors;
  breakdown: string[];
};
```

### 8.2 Command Center Service (`src/lib/commandCenter/`)

```typescript
// Generate complete daily plan
export async function generateDailyPlan(userId: string, date: Date): Promise<DailyPlan>;

// Sync all sources into command center items
export async function syncAllSources(userId: string): Promise<void>;

// Classify item into tier (1-4)
export function classifyItem(item: CommandCenterItem): number;

// Calculate momentum score (0-100)
export function calculateMomentumScore(item: CommandCenterItem): number;

// Enrich item with context
export async function enrichItem(itemId: string): Promise<EnrichedItem>;
```

**Momentum Score Calculation**:
```typescript
momentum =
  (basePriority × 0.3) +      // Tier × deal value
  (timePressure × 0.25) +     // Urgency factor
  (valueScore × 0.2) +        // Deal size impact
  (engagementScore × 0.15) +  // Recent activity
  (riskScore × 0.1)           // Risk multiplier
```

### 8.3 Scheduling Service (`src/lib/scheduler/`)

```typescript
export class SchedulingService {
  // Create scheduling request
  async createSchedulingRequest(data: CreateRequestInput): Promise<SchedulingRequest>;

  // Preview email before sending
  async previewSchedulingEmail(
    requestId: string,
    emailType: EmailType
  ): Promise<EmailPreview>;

  // Send scheduling email
  async sendSchedulingEmail(
    requestId: string,
    userId: string,
    options: SendOptions
  ): Promise<SendResult>;

  // Process incoming response
  async processResponse(
    requestId: string,
    responseEmail: Email
  ): Promise<ProcessResult>;

  // Confirm meeting time
  async confirmMeeting(
    requestId: string,
    confirmedTime: Date
  ): Promise<ConfirmResult>;

  // Get available time slots
  async getAvailability(
    userId: string,
    dateRange: DateRange
  ): Promise<TimeSlot[]>;
}
```

### 8.4 Intelligence Service (`src/lib/intelligence/`)

```typescript
// Orchestrate all collectors
export async function collectIntelligence(companyId: string): Promise<AccountIntelligence>;

// Entity matching
export async function intelligentEntityMatch(
  email: Email
): Promise<EntityMatchResult>;

// Context-first processing
export async function processIncomingCommunication(
  communication: Communication
): Promise<ProcessingResult>;

// Build full relationship context
export async function buildFullRelationshipContext(
  companyId: string,
  contactId?: string
): Promise<RelationshipContext>;
```

**Intelligence Collectors** (17 total):
- `websiteCollector` - Website crawling
- `facebookCollector` - Facebook data
- `googleReviewsCollector` - Reviews
- `apolloCompanyCollector` - Apollo company
- `apolloPeopleCollector` - Apollo contacts
- `industryCollector` - Industry benchmarks
- `linkedinCompanyCollector` - LinkedIn
- `serperResearchCollector` - Search research
- ... and more

### 8.5 Communication Hub (`src/lib/communicationHub/`)

```typescript
// Analyze any communication type
export async function analyzeCommunication(
  communication: Communication
): Promise<AnalysisResult>;

// Match email to company
export async function matchEmailToCompany(
  senderEmail: string,
  subject: string,
  body: string
): Promise<EntityMatchResult>;

// Sync email to unified format
export async function syncEmail(
  email: EmailMessage
): Promise<Communication>;
```

### 8.6 Microsoft Integration (`src/lib/microsoft/`)

```typescript
// Get calendar events
export async function getCalendarEvents(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]>;

// Create calendar event
export async function createCalendarEvent(
  userId: string,
  event: CreateEventInput
): Promise<CalendarEvent>;

// Sync all emails
export async function syncAllFolderEmails(
  userId: string,
  folders: string[]
): Promise<SyncResult>;
```

### 8.7 Fireflies Integration (`src/lib/fireflies/`)

```typescript
// Sync all transcripts
export async function syncFirefliesTranscripts(userId: string): Promise<SyncResult>;

// Extract entities from transcript
export function extractEntityDataFromTranscript(
  transcript: Transcript
): EntityData;
```

---

## 9. AI Systems

### 9.1 AI Model Usage

| Model | Use Case | Max Tokens |
|-------|----------|------------|
| Claude Haiku | Quick classifications, simple analysis | 1024 |
| Claude Sonnet | Email analysis, meeting prep | 4096 |
| Claude Opus | Complex synthesis, strategic insights | 8192 |

### 9.2 AI Prompt Categories

| Category | Examples |
|----------|----------|
| `analysis` | Email analysis, transcript analysis |
| `generation` | Email drafts, meeting prep |
| `classification` | Tier classification, entity matching |
| `synthesis` | Intelligence summary, relationship context |
| `extraction` | Action items, buying signals |

### 9.3 Health Score Algorithm

```typescript
function calculateHealthScore(deal: Deal): number {
  const weights = {
    engagementRecency: 0.25,
    stageVelocity: 0.20,
    stakeholderCoverage: 0.15,
    activityQuality: 0.15,
    competitorRisk: 0.10,
    trialEngagement: 0.15
  };

  const factors = {
    engagementRecency: scoreEngagement(deal),
    stageVelocity: scoreVelocity(deal),
    stakeholderCoverage: scoreStakeholders(deal),
    activityQuality: scoreActivity(deal),
    competitorRisk: scoreCompetitorRisk(deal),
    trialEngagement: scoreTrialEngagement(deal)
  };

  return Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + factors[key] * weight,
    0
  );
}
```

### 9.4 Tier Classification Logic

```typescript
function classifyTier(item: CommandCenterItem): number {
  // Tier 1: Critical - Respond NOW
  if (item.type === 'email_response' && item.timeSinceReceived < 4 * HOURS) return 1;
  if (item.type === 'meeting_prep' && item.meetingIn < 2 * HOURS) return 1;
  if (item.deal?.healthScore < 40) return 1;

  // Tier 2: High - Deal momentum
  if (item.deal?.daysStale > 10) return 2;
  if (item.deal?.closeDate && daysUntil(item.deal.closeDate) < 14) return 2;
  if (item.type === 'follow_up' && item.priority === 'high') return 2;

  // Tier 3: Important - Relationship maintenance
  if (item.type === 'follow_up') return 3;
  if (item.type === 'transcript_review') return 3;

  // Tier 4: Monitor - Low urgency
  return 4;
}
```

### 9.5 Entity Matching

The AI entity matcher uses pure Claude reasoning (no keyword fallbacks):

```typescript
async function intelligentEntityMatch(email: Email): Promise<EntityMatchResult> {
  // 1. Find candidate companies from domain, name mentions
  const candidates = await findCandidateCompanies(email);

  // 2. Ask Claude to reason about the best match
  const matchResult = await callAI({
    prompt: `Given this email and these candidate companies,
             determine which company this is from and why.

             Email: ${email.subject} - ${email.bodyPreview}
             Sender: ${email.senderEmail}

             Candidates: ${JSON.stringify(candidates)}

             Return: { companyId, confidence, reasoning }`,
    model: 'haiku'
  });

  return matchResult;
}
```

---

## 10. Integration Points

### 10.1 Microsoft Graph API

**Scopes Required**:
- `User.Read` - User profile
- `Mail.Read` - Read emails
- `Mail.Send` - Send emails
- `Calendars.ReadWrite` - Calendar access

**OAuth Flow**:
1. User clicks "Connect Microsoft"
2. Redirect to Microsoft OAuth
3. User grants permissions
4. Callback stores refresh token
5. Token auto-refresh on expiry

**Key Operations**:
```typescript
// List messages
GET /me/messages?$top=50&$orderby=receivedDateTime desc

// Send message
POST /me/sendMail
{ message: { subject, body, toRecipients } }

// List calendar events
GET /me/calendar/events?startDateTime=X&endDateTime=Y

// Create event
POST /me/calendar/events
{ subject, body, start, end, attendees }
```

### 10.2 Fireflies.ai

**Integration Method**: API Key + Webhooks

**Sync Flow**:
1. User adds Fireflies API key in settings
2. Cron job polls for new transcripts
3. Transcripts processed through meeting analysis
4. Command center items created for review

**Webhook Events**:
- `transcription.completed` - New transcript ready

### 10.3 Apollo.io

**Usage**: Contact and company enrichment

**Data Retrieved**:
- Company: size, industry, funding, tech stack
- Contacts: title, email, phone, LinkedIn

### 10.4 Twilio (SMS)

**Usage**: Multi-channel scheduling escalation

**Flow**: Email → No response → SMS → No response → Phone

---

## 11. Design System

### 11.1 Color Palette

```css
/* Light Mode */
--background: 0 0% 100%;           /* #FFFFFF */
--foreground: 0 0% 3.9%;           /* #0A0A0A */
--muted: 0 0% 96.1%;               /* #F5F5F5 */
--muted-foreground: 0 0% 45.1%;    /* #737373 */
--border: 0 0% 89.8%;              /* #E5E5E5 */

/* Dark Mode */
--background: 0 0% 3.9%;           /* #0A0A0A */
--foreground: 0 0% 98%;            /* #FAFAFA */
--muted: 0 0% 14.9%;               /* #262626 */
--border: 0 0% 14.9%;              /* #262626 */

/* Semantic Colors */
--success: #10B981;   /* Emerald-500 */
--warning: #F59E0B;   /* Amber-500 */
--error: #EF4444;     /* Red-500 */
--primary: #3B82F6;   /* Blue-500 */
```

### 11.2 Typography

```css
/* Font Stack */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

/* Scale */
.text-3xl { font-size: 30px; }  /* Hero metrics */
.text-xl { font-size: 20px; }   /* Page headers */
.text-base { font-size: 16px; } /* Section headers */
.text-sm { font-size: 14px; }   /* Body text */
.text-xs { font-size: 12px; }   /* Captions */

/* Weights */
.font-light { font-weight: 300; }    /* Large metrics */
.font-normal { font-weight: 400; }   /* Body text */
.font-medium { font-weight: 500; }   /* Labels */
.font-semibold { font-weight: 600; } /* Headers */
```

### 11.3 Spacing (4-8px Grid)

```css
p-1  → 4px   /* Micro */
p-2  → 8px   /* Tight */
p-3  → 12px  /* Compact */
p-4  → 16px  /* Default */
p-6  → 24px  /* Comfortable */
p-8  → 32px  /* Spacious */

gap-4 → 16px  /* Grid gaps */
gap-6 → 24px  /* Section spacing */
```

### 11.4 Component Patterns

**Card**:
```css
bg-white dark:bg-[#1a1a1a]
rounded-xl
p-6
border border-gray-200 dark:border-[#2a2a2a]
shadow-sm hover:shadow-md
transition-all duration-300
```

**Button**:
```css
h-9 px-4 text-sm
rounded-lg
transition-colors duration-200
```

**Table**:
```css
/* No zebra striping */
/* Horizontal borders only */
hover:bg-gray-50 dark:hover:bg-gray-800/50
py-3 px-4 /* Cell padding */
```

### 11.5 Animation

```css
/* Quick feedback */
transition-colors duration-200

/* Standard transitions */
transition-all duration-300

/* Data animations */
transition-all duration-700 ease-out

/* Easing */
cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 12. Data Flow Architecture

### 12.1 Email Processing Flow

```
Microsoft Graph → Email Sync → Communication Hub
                      ↓
              Entity Matching (AI)
                      ↓
              Email Analysis (AI)
                      ↓
              ┌───────┴───────┐
              ↓               ↓
    Update Relationship    Create Command
    Intelligence           Center Item
              ↓               ↓
        Account Memory    Daily Plan
```

### 12.2 Meeting Transcript Flow

```
Fireflies.ai → Transcript Sync → Meeting Analysis (AI)
                                        ↓
                  ┌────────────────────┬┴────────────────────┐
                  ↓                    ↓                     ↓
           Extract Action      Update Relationship    Detect Contacts
           Items               Intelligence           (New/Existing)
                  ↓                    ↓                     ↓
           Create Tasks         Account Memory        Create/Update
                                                      Contacts
                  └──────────────────┬┴──────────────────────┘
                                     ↓
                          Command Center Item
                          (Transcript Review)
```

### 12.3 Command Center Generation

```
Cron Job (Every 15 mins)
         ↓
┌────────┴────────┐────────────┐────────────┐
↓                 ↓            ↓            ↓
Detect         Detect       Detect       Detect
Inbound       Meeting      Stale        Close
Emails        Follow-ups   Deals        Deadlines
         └────────┴────────┴─────────────┘
                          ↓
                 Item Generator
                          ↓
                 Tier Classification (AI)
                          ↓
                 Momentum Scoring
                          ↓
                 Already-Handled Detection
                          ↓
                 Deduplication
                          ↓
                 Daily Plan
```

### 12.4 Intelligence Collection Flow

```
Trigger (Manual or Scheduled)
              ↓
      Intelligence Orchestrator
              ↓
┌─────────────┴─────────────┐
↓             ↓             ↓
Website    Social        Apollo
Collector  Collectors    Enrichment
     └─────────┴─────────┘
              ↓
      Data Synthesis (AI)
              ↓
┌─────────────┴─────────────┐
↓             ↓             ↓
Company     Key          AI
Summary     Insights     Summary
              ↓
      Store in company_intelligence
```

### 12.5 Scheduling Flow

```
User Creates Request → SchedulingService.createRequest()
         ↓
 Generate Proposed Times → CalendarIntegration.getAvailability()
         ↓
 Generate Email → EmailGeneration.generateSchedulingEmail()
         ↓
 Send Email → Microsoft Graph (or preview first)
         ↓
 Update Status: 'awaiting_response'
         ↓
[Wait for response]
         ↓
 Parse Response → ResponseProcessor.processResponse()
         ↓
 ┌───────┴───────┐
 ↓               ↓
Time          More Info
Selected      Needed
 ↓               ↓
Confirm       Send
Meeting       Follow-up
 ↓
Create Calendar Event
```

---

## Appendix A: Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Microsoft Graph
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
MICROSOFT_TENANT_ID=xxx

# Fireflies
FIREFLIES_API_KEY=xxx

# Twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx

# Apollo
APOLLO_API_KEY=xxx
```

---

## Appendix B: Database Indexes

Key indexes for performance:

```sql
-- Companies
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_vfp_customer_id ON companies(vfp_customer_id);

-- Contacts
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Deals
CREATE INDEX idx_deals_company_id ON deals(company_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_owner_id ON deals(owner_id);

-- Communications
CREATE INDEX idx_communications_company_id ON communications(company_id);
CREATE INDEX idx_communications_thread_id ON communications(thread_id);
CREATE INDEX idx_communications_sent_at ON communications(sent_at);

-- Command Center Items
CREATE INDEX idx_cc_items_user_id_date ON command_center_items(user_id, created_at);
CREATE INDEX idx_cc_items_tier ON command_center_items(tier);
CREATE INDEX idx_cc_items_status ON command_center_items(status);

-- Email Messages
CREATE INDEX idx_email_messages_user_id ON email_messages(user_id);
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX idx_email_messages_received_at ON email_messages(received_at);
```

---

## Appendix C: Row Level Security

All tables implement RLS with user isolation:

```sql
-- Example: Companies RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company data"
ON companies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deals
    WHERE deals.company_id = companies.id
    AND deals.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_companies.company_id = companies.id
    AND user_companies.user_id = auth.uid()
  )
);
```

---

## Appendix D: Rep Skill System

### Levels
| Level | Criteria | Allowed Segments |
|-------|----------|------------------|
| L1 Foundation | <3 months OR <5 deals | SMB only |
| L2 Established | 5+ deals, 3+ months | SMB + Mid-Market |
| L3 Senior | 20+ deals, 12+ months | All segments |

### Certifications
- Voice Core, Voice Advanced
- X-RAI Performance Center
- Action Hub, Accountability Hub
- AI Agents Basic, AI Agents Integrated
- CRM: FieldRoutes, PestPac, RealGreen

---

## Appendix E: Market Segments

| Segment | Agent Count | Deal Value | Typical Close |
|---------|-------------|------------|---------------|
| SMB | 1-5 | $5-15K ACV | 30-45 days |
| Mid-Market | 6-20 | $15-50K ACV | 45-90 days |
| Enterprise | 21-100 | $50-150K ACV | 90-180 days |
| PE Platform | 100+ | $150K+ ACV | 180+ days |
| Franchisor | Corp + franchisees | $250K+ ACV | 180+ days |

---

*End of X-FORCE Platform Specification*
