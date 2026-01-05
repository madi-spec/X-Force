# X-FORCE Codebase Map

**Generated:** December 21, 2024
**Purpose:** Comprehensive mapping of codebase against Platform Vision

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total TypeScript/TSX Files** | 454 |
| **Total API Endpoints** | 116 |
| **Total Database Tables** | 50+ |
| **Total UI Pages** | 35 |
| **Total Components** | 116 |
| **Database Migrations** | 50 |
| **Vision Alignment** | ~75% |

---

## Component Status Matrix

| # | Component | Vision Status | Implementation Status | Completeness | Notes |
|---|-----------|--------------|----------------------|--------------|-------|
| 1 | Relationship Intelligence | ✅ Documented | ✅ Implemented | 90% | Core working, needs Phase 2-5 |
| 2 | AI-Powered Entity Matching | ✅ Documented | ✅ Implemented | 95% | Recently cleaned up |
| 3 | Sales Playbook | ✅ Documented | ✅ Implemented | 85% | Used in analysis |
| 4 | Command Center | ✅ Documented | ✅ Implemented | 90% | 5-tier system working |
| 5 | AI Scheduler | ✅ Documented | ⚠️ Partial | 60% | Schema + services exist, needs wiring |
| 6 | Meeting Prep | ✅ Documented | ✅ Implemented | 80% | Generates briefs |
| 7 | Company/Deal Pages | ✅ Documented | ✅ Implemented | 75% | Basic UI, needs intelligence panels |
| 8 | Research Agent | ✅ Documented | ✅ Implemented | 80% | v6.1 working |
| 9 | Marketing Intelligence | ✅ Documented | ⚠️ Partial | 50% | Collectors exist, synthesis incomplete |
| 10 | Integrations | ✅ Documented | ✅ Implemented | 85% | Microsoft + Fireflies working |

---

## Detailed Component Analysis

### 1. Relationship Intelligence
**Status:** ✅ Complete (Core)
**Completeness:** 90%

**Files:**
```
src/lib/intelligence/
├── contextFirstPipeline.ts    # Main entry point
├── entityMatcher.ts           # AI-powered matching
├── relationshipStore.ts       # CRUD for RI data
├── reconcileActions.ts        # Action reconciliation
└── types.ts                   # Type definitions
```

**Database Tables:**
- `relationship_intelligence` - Cumulative context per contact/company
- `relationship_notes` - Manual salesperson notes

**API Endpoints:**
- `GET /api/command-center/[itemId]/context` - Load context
- `POST /api/command-center/[itemId]/add-context` - Add manual context
- `POST /api/relationships/[contactId]/notes` - Add notes

**UI Components:**
- `RelationshipIntelligencePanel.tsx`
- `ContactCardWithFacts.tsx`

**What's Working:**
- Context loading before analysis
- Context growing after processing
- Facts, interactions, commitments, signals stored
- Integration with Command Center

**What's Missing (Phase 2-5):**
- Company page showing full RI as source of truth
- Salesperson correction workflow
- Context-derived actions (vs stored)

---

### 2. AI-Powered Entity Matching
**Status:** ✅ Complete
**Completeness:** 95%

**Files:**
```
src/lib/intelligence/
├── entityMatcher.ts           # intelligentEntityMatch()
└── contextFirstPipeline.ts    # Uses entity matcher
```

**Functions:**
- `intelligentEntityMatch(communication, userId)` - Main entry
- Supports email_inbound, email_outbound, transcript types
- Returns `EntityMatchResult` with company/contact/deal + confidence

**Used By:**
- `fireflies/sync.ts` - Transcript matching
- `contextFirstPipeline.ts` - Email processing
- `processInboundEmail.ts` - Email analysis

**What's Working:**
- AI reasoning for all matching (no keyword fallbacks)
- Confidence scoring
- Human review task creation for low confidence

**What's Missing:**
- Nothing significant - recently cleaned up

---

### 3. Sales Playbook
**Status:** ✅ Complete
**Completeness:** 85%

**Files:**
```
src/lib/intelligence/
└── salesPlaybook.ts           # SALES_PLAYBOOK constant
```

**Defines:**
- Communication types (demo_request, pricing_request, etc.)
- Sales stages (initial_interest, discovery, trial, etc.)
- Action templates per communication type
- Response timing expectations
- Workflow types

**Used By:**
- `meetingAnalysisService.ts` - Transcript analysis
- `reconcileActions.ts` - Action generation
- Analysis prompts for classification

**What's Working:**
- Playbook-informed classification
- Action template injection
- Tier trigger mapping

**What's Missing:**
- UI for editing playbook
- Multiple playbook support
- A/B testing of playbook variants

---

### 4. Command Center
**Status:** ✅ Complete
**Completeness:** 90%

**Files:**
```
src/lib/commandCenter/
├── tierDetection.ts           # 5-tier classification
├── itemGenerator.ts           # Create CC items
├── momentumScoring.ts         # Score calculation
├── dailyPlanner.ts            # Daily plan generation
├── alreadyHandledDetection.ts # Duplicate prevention
├── contextEnrichment.ts       # Enrich items with context
├── meetingPrep.ts             # Meeting prep for items
└── actionDurations.ts         # Time estimates
```

**Database Tables:**
- `command_center_items` - Main items table
- `daily_plans` - Generated daily plans
- `rep_time_profiles` - Rep availability

**API Endpoints:**
- `GET /api/command-center` - List items by tier
- `GET/PATCH /api/command-center/[itemId]` - Item CRUD
- `GET /api/command-center/[itemId]/context` - Context
- `POST /api/command-center/[itemId]/add-context` - Add context
- `GET /api/command-center/plan` - Daily plan
- `POST /api/command-center/items/[id]/enrich` - Enrich
- `POST /api/command-center/items/[id]/generate-email` - Draft
- `POST /api/command-center/items/[id]/schedule` - Schedule

**UI Components:**
```
src/components/commandCenter/
├── ActionCard.tsx             # Individual card
├── YourDayView.tsx            # Main view
├── EmailComposerPopout.tsx    # Email composition
├── MeetingPrepPopout.tsx      # Meeting prep view
├── SchedulerPopout.tsx        # Scheduling interface
├── LinkCompanyPopout.tsx      # Link to company
├── LinkDealPopout.tsx         # Link to deal
└── ExtraCreditPanel.tsx       # Extra credit items
```

**UI Pages:**
- `/command-center` - Main command center page
- `/ai` - Unified AI view (also shows CC)

**What's Working:**
- 5-tier priority system
- Workflow cards with checklists
- Email drafting
- Meeting prep popouts
- Tier-based SLAs
- "Why Now" explanations

**What's Missing:**
- Timer/countdown for SLA breach
- Digest view (collapsed tiers)
- Mobile optimization

---

### 5. AI Scheduler
**Status:** ⚠️ Partial
**Completeness:** 60%

**Files:**
```
src/lib/scheduler/
├── schedulingService.ts       # Core service
├── schedulingIntelligence.ts  # AI decision making
├── emailGeneration.ts         # Email drafts
├── noShowRecovery.ts          # No-show handling
├── confirmationWorkflow.ts    # Confirmation flow
├── responseProcessor.ts       # Process responses
├── personaEngine.ts           # Persona-based emails
├── attendeeOptimization.ts    # Optimize attendees
├── championInvolvement.ts     # Champion detection
├── channelStrategy.ts         # Channel selection
├── meetingStrategy.ts         # Meeting type selection
├── calendarIntegration.ts     # Calendar sync
├── schedulingStopRules.ts     # Stop rules
├── schedulingLeverage.ts      # Leverage moments
├── seasonality.ts             # Seasonal adjustments
├── socialProof.ts             # Social proof injection
├── reputationGuardrails.ts    # Reputation protection
├── postmortem.ts              # Post-meeting analysis
├── types.ts                   # Type definitions
├── analytics.ts               # Analytics
├── settingsService.ts         # Settings
├── webhookService.ts          # Webhooks
└── apiKeyService.ts           # API keys
```

**Database Tables:**
- `scheduling_requests` - Scheduling requests
- `scheduling_attendees` - Attendees per request
- `scheduling_actions` - Action log
- `scheduling_templates` - Email templates
- `meeting_prep_briefs` - Generated prep briefs

**API Endpoints:**
```
/api/scheduler/
├── requests/                  # CRUD for requests
├── requests/[id]/confirm      # Confirm meeting
├── analytics                  # Analytics
├── dashboard                  # Dashboard data
├── settings                   # Settings
├── templates/                 # Email templates
├── no-shows                   # No-show handling
├── postmortem                 # Post-meeting
├── seasonality                # Seasonal settings
├── social-proof               # Social proof
├── api-keys/                  # API key management
├── webhooks/                  # Webhook management
├── leverage-moments/          # Leverage moments
└── automation                 # Automation rules
```

**UI Pages:**
- `/scheduler` - Main scheduler dashboard
- `/scheduler/analytics` - Analytics view
- `/scheduler/settings` - Settings
- `/scheduler/webhooks` - Webhook management

**UI Components:**
```
src/components/scheduler/
├── SchedulerDashboard.tsx
├── RequestList.tsx
├── RequestDetail.tsx
├── AnalyticsView.tsx
├── SettingsPanel.tsx
└── WebhookManager.tsx
```

**What's Working:**
- Schema and services exist
- Email template generation
- Basic state machine logic
- Settings management
- API key management

**What's Missing:**
- Full state machine implementation
- Email sending integration
- Response parsing
- Calendar booking
- Reschedule handling
- Production testing

---

### 6. Meeting Prep
**Status:** ✅ Complete
**Completeness:** 80%

**Files:**
```
src/lib/intelligence/
├── generateMeetingPrep.ts     # Generate prep briefs
└── meetingPrep.ts             # Alternative implementation

src/lib/commandCenter/
└── meetingPrep.ts             # CC-specific prep
```

**API Endpoints:**
- `GET /api/calendar/[meetingId]/prep` - Get meeting prep

**UI Components:**
- `MeetingPrepPopout.tsx` - Popout view in command center

**What's Working:**
- Relationship context loading
- Brief generation with talking points
- Integration with command center
- Account history inclusion

**What's Missing:**
- Standalone meeting prep page
- Print/export functionality
- Multi-attendee prep

---

### 7. Company/Deal Pages
**Status:** ✅ Implemented (Basic)
**Completeness:** 75%

**Files:**
```
src/app/(dashboard)/companies/
├── page.tsx                   # List view
├── [id]/page.tsx              # Detail view
├── [id]/edit/page.tsx         # Edit form
├── [id]/intelligence/         # Intelligence tab
└── new/page.tsx               # Create form

src/app/(dashboard)/deals/
├── page.tsx                   # List view
├── DealsView.tsx              # Alternative view
├── [id]/page.tsx              # Detail view
├── [id]/edit/page.tsx         # Edit form
└── new/page.tsx               # Create form
```

**UI Components:**
```
src/components/companies/
├── CompanyDetail.tsx
├── CompanyForm.tsx
├── CompanyList.tsx
└── AccountMemoryPanel.tsx

src/components/deals/
├── DealForm.tsx
├── DealHeaderActions.tsx
├── DealIntelligenceCard.tsx
├── DealPostmortem.tsx
├── DealRoomSection.tsx
├── DealRoomAnalytics.tsx
├── AssetUploadModal.tsx
├── ActivityLogger.tsx
├── MarkAsWonButton.tsx
└── TeamSection.tsx

src/components/intelligence/
├── IntelligenceTab.tsx
├── IntelligenceOverviewPanel.tsx
├── IntelligenceDataTab.tsx
├── CompanyResearchTab.tsx
├── InsightsView.tsx
├── DataField.tsx
└── RawDataEditor.tsx
```

**What's Working:**
- Basic CRUD for companies/deals
- Intelligence tab with research data
- Deal intelligence card
- Account memory panel
- Deal rooms for collaboration

**What's Missing:**
- Full relationship intelligence view
- Communication timeline
- Context as source of truth display
- Salesperson edit capabilities

---

### 8. Research Agent
**Status:** ✅ Complete
**Completeness:** 80%

**Files:**
```
src/lib/intelligence/
├── researchAgentV61.ts        # v6.1 research agent
├── researchCoordinator.ts     # Orchestrates research
├── orchestrator.ts            # Legacy orchestrator
├── collectorV2.ts             # V2 collector
├── siteIndexedAdapter.ts      # Site indexing
└── collectors/
    ├── websiteCollector.ts
    ├── facebookCollector.ts
    ├── googleReviewsCollector.ts
    ├── apolloCompanyCollector.ts
    ├── apolloPeopleCollector.ts
    ├── industryCollector.ts
    ├── linkedinCompanyCollector.ts
    ├── blogDetector.ts
    ├── youtubeDetector.ts
    └── [many more]
```

**API Endpoints:**
```
/api/intelligence/[companyId]/
├── route.ts                   # Get intelligence
├── refresh/route.ts           # Trigger refresh
├── enrich-company/route.ts    # Enrich company
├── enrich-contacts/route.ts   # Enrich contacts
└── marketing/route.ts         # Marketing intel

/api/intelligence-v61/[companyId]/
├── research/route.ts          # v6.1 research
├── extract/route.ts           # Extract data
├── strategy/route.ts          # Strategy generation
└── batch/route.ts             # Batch processing
```

**Database Tables:**
- `account_intelligence` - Aggregated intelligence
- `intelligence_sources` - Raw source data
- `contact_intelligence` - Contact enrichment
- `industry_mentions` - News/mentions
- `company_research` - Research cache

**What's Working:**
- Multi-source data collection
- Website, Facebook, Google Reviews scraping
- Apollo integration for contacts
- Research caching
- Phased collection

**What's Missing:**
- LinkedIn scraping (blocked)
- Real-time monitoring
- Confidence scoring display

---

### 9. Marketing Intelligence
**Status:** ⚠️ Partial
**Completeness:** 50%

**Files:**
```
src/lib/intelligence/collectors/
├── marketingActivityCollector.ts
├── marketingOrchestrator.ts
├── websiteMarketingCollector.ts
├── blogDetector.ts
├── youtubeDetector.ts
└── employeeMediaCollector.ts
```

**API Endpoints:**
- `GET /api/intelligence/[companyId]/marketing` - Marketing data

**Database Tables:**
- Marketing columns in `account_intelligence`
- `marketing_profile` JSONB field

**What's Working:**
- Blog detection
- YouTube presence detection
- Social media activity tracking
- Marketing maturity scoring

**What's Missing:**
- Full synthesis into recommendations
- UI for marketing intelligence
- Competitor marketing comparison
- Content strategy suggestions

---

### 10. Integrations
**Status:** ✅ Complete
**Completeness:** 85%

#### Microsoft 365
**Files:**
```
src/lib/microsoft/
├── auth.ts                    # OAuth flow
├── graph.ts                   # Graph API client
├── emailSync.ts               # Email synchronization
└── calendarSync.ts            # Calendar synchronization
```

**API Endpoints:**
- `GET/POST /api/auth/microsoft` - OAuth
- `GET/POST /api/microsoft/sync` - Trigger sync
- `POST /api/microsoft/send` - Send email
- `POST /api/microsoft/disconnect` - Disconnect

**Database Tables:**
- `microsoft_connections` - OAuth tokens
- `email_messages` - Synced emails
- `email_conversations` - Conversation threads

**What's Working:**
- OAuth authentication
- Email sync (inbound + outbound)
- Calendar event sync
- Email sending

#### Fireflies
**Files:**
```
src/lib/fireflies/
├── client.ts                  # API client
├── sync.ts                    # Transcript sync
├── transcriptUtils.ts         # Utility functions
└── index.ts                   # Exports
```

**API Endpoints:**
- `GET/POST /api/integrations/fireflies/connect` - Connect
- `GET /api/integrations/fireflies/status` - Status
- `POST /api/integrations/fireflies/sync` - Sync
- `POST /api/webhooks/fireflies` - Webhook receiver

**Database Tables:**
- `fireflies_connections` - API keys
- `meeting_transcriptions` - Synced transcripts

**What's Working:**
- API key management
- Transcript import
- Entity matching on import
- Analysis triggering

---

## Features Not in Vision Document

### 1. Deal Rooms
**Location:** `src/components/deals/DealRoom*.tsx`
**Purpose:** Collaborative deal workspace with asset sharing
**Tables:** `deal_rooms`, `deal_room_assets`, `deal_room_views`

### 2. Deal Postmortems
**Location:** `src/lib/ai/learning/`, `src/components/deals/DealPostmortem.tsx`
**Purpose:** Win/loss analysis after deal closes
**Tables:** `deal_postmortems`

### 3. Rep Trust Profiles
**Location:** `src/lib/ai/learning/repTrustService.ts`
**Purpose:** Track rep behavior for AI calibration
**Tables:** `rep_trust_profiles`

### 4. Human Leverage Moments
**Location:** `src/lib/ai/leverage/`, `src/components/dashboard/HumanLeverageMoments.tsx`
**Purpose:** AI-triggered alerts for human action
**Tables:** `human_leverage_moments`

### 5. SMS Integration
**Location:** `src/lib/sms/twilioService.ts`
**Purpose:** SMS sending via Twilio
**Endpoints:** `/api/sms/`

### 6. Email Tracking
**Location:** `src/lib/tracking/`
**Purpose:** Track email opens and clicks
**Endpoints:** `/api/track/open`, `/api/track/click`

### 7. Public Deal Rooms
**Location:** `src/app/room/[slug]/page.tsx`
**Purpose:** External-facing deal rooms
**Endpoints:** `/api/public/rooms/[slug]`

### 8. Learning System
**Location:** `src/lib/ai/learning/`
**Purpose:** Pattern learning from outcomes
**Tables:** `pattern_learnings`, `trigger_accuracy`

### 9. Import System
**Location:** `src/lib/import/`
**Purpose:** Bulk data import
**Pages:** `/settings/import`

---

## Database Tables Summary

### Core CRM (7 tables)
- `users` - User accounts
- `companies` - Company records
- `contacts` - Contact records
- `deals` - Deal/opportunity records
- `activities` - Activity log
- `tasks` - Tasks
- `organizations` - Organizations (legacy?)

### Intelligence (10+ tables)
- `account_intelligence` - Aggregated intelligence
- `intelligence_sources` - Raw source data
- `contact_intelligence` - Contact enrichment
- `industry_mentions` - News mentions
- `company_research` - Research cache
- `relationship_intelligence` - Relationship context
- `relationship_notes` - Manual notes
- `company_intelligence_raw` - Raw intel data
- `company_intelligence_analysis` - Analyzed intel
- `company_intelligence_edits` - Manual edits

### Command Center (4 tables)
- `command_center_items` - Action items
- `daily_plans` - Generated plans
- `rep_time_profiles` - Availability
- `ai_action_queue` - Action queue

### AI/ML (8 tables)
- `ai_prompts` - Editable prompts
- `ai_prompt_history` - Prompt versions
- `ai_roles` - AI role definitions
- `ai_jobs` - AI job definitions
- `ai_job_runs` - Job execution log
- `ai_insights_log` - AI usage tracking
- `ai_signals` - Detected signals
- `ai_summaries` - Generated summaries

### Scheduler (5 tables)
- `scheduling_requests` - Scheduling requests
- `scheduling_attendees` - Attendees
- `scheduling_actions` - Action log
- `scheduling_templates` - Templates
- `meeting_prep_briefs` - Prep briefs

### Learning (4 tables)
- `rep_trust_profiles` - Rep behavior
- `trigger_accuracy` - Trigger calibration
- `deal_postmortems` - Win/loss analysis
- `pattern_learnings` - Learned patterns

### Human Leverage (2 tables)
- `human_leverage_moments` - Leverage alerts
- `account_memory` - Account learnings
- `account_memory_updates` - Memory audit

### Integrations (4 tables)
- `microsoft_connections` - Microsoft OAuth
- `fireflies_connections` - Fireflies API
- `email_messages` - Synced emails
- `meeting_transcriptions` - Transcripts

### Deal Collaboration (3 tables)
- `deal_rooms` - Deal rooms
- `deal_room_assets` - Assets
- `deal_room_views` - View tracking

---

## API Endpoints Count by Category

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| Command Center | 12 | `/api/command-center/*` |
| Companies | 4 | `/api/companies/*` |
| Contacts | 3 | `/api/contacts/*` |
| Deals | 4 | `/api/deals/*` |
| Intelligence | 8 | `/api/intelligence/*`, `/api/intelligence-v61/*` |
| Scheduler | 20+ | `/api/scheduler/*` |
| Meetings | 6 | `/api/meetings/*` |
| Microsoft | 4 | `/api/microsoft/*`, `/api/auth/microsoft/*` |
| Fireflies | 5 | `/api/integrations/fireflies/*` |
| AI | 6 | `/api/ai/*` |
| Tasks | 5 | `/api/tasks/*` |
| Inbox | 8 | `/api/inbox/*` |
| Cron | 8 | `/api/cron/*` |
| Leverage | 3 | `/api/leverage-moments/*` |
| Learning | 2 | `/api/learning/*` |
| Webhooks | 2 | `/api/webhooks/*` |
| **Total** | **~116** | |

---

## Gap Analysis

### Vision Features NOT Yet Implemented

| Feature | Vision Section | Priority | Effort |
|---------|---------------|----------|--------|
| Full AI Scheduler wiring | AI Scheduler | High | 2-3 weeks |
| Company page as source of truth | Company/Deal Pages | High | 1 week |
| Salesperson correction UI | Relationship Intelligence | Medium | 1 week |
| Context-derived actions | Command Center | Medium | 1 week |
| Pattern learning UI | Learning System | Low | 1 week |
| Rep trust dashboard | Learning System | Low | 3 days |
| Multiple playbook support | Sales Playbook | Low | 1 week |

### Implemented But Needs Polish

| Feature | Status | What's Needed |
|---------|--------|---------------|
| Command Center | 90% | SLA timers, mobile view |
| Meeting Prep | 80% | Standalone page, export |
| Research Agent | 80% | Confidence display, monitoring |
| Marketing Intelligence | 50% | Full UI, synthesis |

### Features Ahead of Vision

| Feature | Description | Value |
|---------|-------------|-------|
| Deal Rooms | Collaborative deal workspaces | High |
| SMS Integration | Twilio-based SMS | Medium |
| Email Tracking | Open/click tracking | Medium |
| Public Deal Rooms | External sharing | High |
| Import System | Bulk data import | Medium |

---

## Recommendations

### Immediate (This Week)
1. **Complete Phase 2-5** of Context-First Architecture
   - Company page showing full RI
   - Salesperson edit capabilities
   - Context-derived actions

2. **Wire AI Scheduler** to production
   - Email sending integration
   - Response parsing
   - Calendar booking

### Short-term (Next 2 Weeks)
3. **Polish Command Center**
   - SLA countdown timers
   - Mobile responsive
   - Digest/collapsed view

4. **Complete Marketing Intelligence**
   - Full synthesis
   - UI components
   - Recommendations

### Medium-term (Month)
5. **Learning System UI**
   - Pattern learnings dashboard
   - Calibration reports
   - Rep trust (admin only)

6. **Deal Room Enhancement**
   - Activity tracking
   - Proposal builder
   - Signature integration

---

## Architecture Notes

### Clean Architecture After Cleanup
```
src/lib/intelligence/
├── contextFirstPipeline.ts    # Main entry point
├── entityMatcher.ts           # AI matching
├── relationshipStore.ts       # RI storage
├── reconcileActions.ts        # Action logic
├── salesPlaybook.ts           # Playbook
├── generateMeetingPrep.ts     # Meeting prep
├── types.ts                   # Types
└── collectors/                # Data collectors
```

### Key Integration Points
1. **Email Sync** → `processIncomingCommunication` → RI Update → CC Item
2. **Transcript Sync** → `intelligentEntityMatch` → RI Update → CC Item
3. **Calendar Sync** → Meeting Prep → CC Meeting Item
4. **Research** → Account Intelligence → RI Context

### Data Flow
```
Email/Transcript → Entity Match → Load Context → Analyze → Update Context → Generate Actions
```

---

*Generated by Claude Code - December 21, 2024*
