# X-FORCE Workflow Documentation

> Auto-generated documentation for workflows, cron jobs, and automation pipelines
> Generated: 2026-01-01

## Overview

X-FORCE uses multiple workflow systems:
1. **Visual Workflow Builder** - Process-specific flows (sales, onboarding, support, engagement)
2. **Cron Jobs** - Scheduled background tasks (14 jobs)
3. **Event-Driven Pipelines** - Real-time signal processing

---

## Table of Contents

1. [Visual Workflow Builder](#1-visual-workflow-builder)
2. [Cron Jobs](#2-cron-jobs)
3. [Background Pipelines](#3-background-pipelines)
4. [Event Sourcing Flows](#4-event-sourcing-flows)
5. [AI Autopilot Workflows](#5-ai-autopilot-workflows)

---

## 1. Visual Workflow Builder

**Location:** `src/lib/workflow/`

The workflow builder allows users to create visual process flows for different business contexts.

### Process Types

| Type | Entity | Description | Icon |
|------|--------|-------------|------|
| `sales` | Deal | Convert leads to customers | 🎯 |
| `onboarding` | Customer | Activate new customers | 🚀 |
| `support` | Ticket | Resolve issues efficiently | 🎫 |
| `engagement` | Account | Retain and expand customers | 💜 |

### Node Types

| Node Type | Label | Color | Purpose |
|-----------|-------|-------|---------|
| `trigger` | Triggers | Orange (#f97316) | Entry points that start flows |
| `stage` | Stages | Blue (#3b82f6) | Major milestones in the process |
| `condition` | Conditions | Yellow (#eab308) | Branch logic based on criteria |
| `aiAction` | AI Actions | Purple (#a855f7) | Automated AI-powered actions |
| `humanAction` | Human Actions | Cyan (#06b6d4) | Tasks requiring human involvement |
| `exit` | Exits | Green (#10b981) | Terminal states (won, lost, etc.) |

### Sales Process Nodes

**Triggers:**
- `new_lead` - New Lead Created
- `form_submit` - Form Submitted
- `call_complete` - Call Completed
- `email_replied` - Email Replied
- `meeting_complete` - Meeting Completed
- `trial_started` - Trial Started

**Stages:**
1. Actively Engaging
2. Demo Scheduled
3. Demo Complete
4. Trial
5. Proposal
6. Negotiation

**AI Actions:**
- AI Scheduler - Auto-schedule meetings
- AI Follow-up - Send personalized follow-up
- AI Objection Handler - Handle objections
- AI Call Analysis - Analyze call transcripts

**Exits:**
- Closed Won ✅
- Closed Lost ❌
- Disqualified 🚫
- Send to Nurture 🌱

### Onboarding Process Nodes

**Triggers:**
- `contract_signed` - Contract Signed
- `account_created` - Account Created
- `first_login` - First Login
- `integration_connected` - Integration Connected
- `milestone_completed` - Milestone Completed

**Stages:**
1. Welcome / Kickoff
2. Technical Setup
3. Training Scheduled
4. Training Complete
5. Go-Live
6. Adoption Review

**AI Actions:**
- AI Training Recommendation
- AI Setup Assistant
- AI Health Check

**Exits:**
- Successfully Onboarded
- Onboarding Stalled
- Churned During Onboarding
- Fast-Track Complete

### Support Process Nodes

**Triggers:**
- `ticket_created` - Ticket Created
- `severity_changed` - Severity Changed
- `sla_warning` - SLA Warning (75% time elapsed)
- `sla_breach` - SLA Breach
- `customer_replied` - Customer Replied
- `escalation_requested` - Escalation Requested

**Stages:**
1. New / Triage
2. Assigned
3. In Progress
4. Waiting on Customer
5. Waiting on Internal
6. Pending Resolution

**AI Actions:**
- AI Ticket Classifier - Auto-categorize tickets
- AI Solution Suggester - Suggest solutions
- AI Response Drafter - Draft replies
- AI Escalation Predictor - Predict escalations

**Exits:**
- Resolved
- Closed - No Response
- Escalated to Engineering
- Merged / Duplicate

### Engagement Process Nodes

**Triggers:**
- `health_changed` - Health Score Changed
- `usage_dropped` - Usage Dropped
- `nps_received` - NPS Response Received
- `renewal_approaching` - Renewal Approaching (30/60/90 day)
- `tickets_spike` - Support Tickets Spike
- `champion_left` - Champion Left Company
- `expansion_opportunity` - Expansion Opportunity

**Stages:**
1. Monitoring
2. At Risk Identified
3. Intervention Active
4. Stabilizing
5. Expansion Discussion
6. Renewal Negotiation

**AI Actions:**
- AI Churn Predictor - Predict churn risk
- AI Expansion Identifier - Find upsell opportunities
- AI Health Calculator - Calculate health score
- AI Win-Back Campaign - Re-engage at-risk

**Exits:**
- Renewed
- Expanded
- Churned
- Downgraded
- Saved (was at-risk)

### Common Nodes (All Process Types)

**Conditions:**
- Time in Stage - Days/hours in current stage
- Custom Field Check - Check any field value
- Tag Check - Check for specific tags

**Human Actions:**
- Create Task - Assign a task to team
- Send Notification - Alert team members
- Assign to User - Assign ownership
- Send Email Template - Send templated email
- Add Tag - Apply a tag

**AI Actions:**
- AI Follow-up - Smart follow-up email
- AI Summary - Generate summary
- AI Sentiment Analysis - Analyze sentiment

---

## 2. Cron Jobs

**Location:** `vercel.json` (crons configuration)

### Cron Schedule

| Job | Path | Schedule | Frequency |
|-----|------|----------|-----------|
| Scheduler | `/api/cron/scheduler` | `* * * * *` | Every minute |
| Microsoft Sync | `/api/cron/sync-microsoft` | `*/15 * * * *` | Every 15 min |
| Fireflies Sync | `/api/cron/sync-fireflies` | `*/30 * * * *` | Every 30 min |
| Inbox Sync | `/api/cron/sync-inbox` | `*/10 * * * *` | Every 10 min |
| Communications Sync | `/api/cron/sync-communications` | `2,12,22,32,42,52 * * * *` | Every 10 min (offset) |
| Daily Plans | `/api/cron/generate-daily-plans` | `0 6 * * *` | 6:00 AM daily |
| Momentum Calc | `/api/cron/calculate-momentum` | `*/15 * * * *` | Every 15 min |
| Command Center Sync | `/api/cron/sync-command-center` | `*/5 * * * *` | Every 5 min |
| Tier Classification | `/api/cron/classify-tiers` | `*/5 * * * *` | Every 5 min |
| Pipeline Runner | `/api/cron/run-pipelines` | `*/5 * * * *` | Every 5 min |
| Email Analysis | `/api/cron/analyze-emails` | `5,20,35,50 * * * *` | Every 15 min (offset) |
| No-Show Detection | `/api/cron/detect-no-shows` | `10,25,40,55 * * * *` | Every 15 min (offset) |
| Communication Analysis | `/api/cron/analyze-communications` | `*/15 * * * *` | Every 15 min |

### Cron Job Details

#### `/api/cron/scheduler` (Every minute)
Processes deferred scheduling responses:
1. Finds requests with `next_action_type = 'process_response'`
2. Fetches matching inbound emails
3. Processes scheduling responses

#### `/api/cron/sync-microsoft` (Every 15 min)
Syncs Microsoft 365 data:
1. Syncs email messages from Graph API
2. Syncs calendar events
3. Updates `microsoft_connections.last_sync_at`

#### `/api/cron/sync-fireflies` (Every 30 min)
Syncs Fireflies.ai transcripts:
1. Fetches new transcripts via GraphQL
2. Matches to companies/contacts
3. Triggers AI analysis

#### `/api/cron/sync-inbox` (Every 10 min)
Syncs inbox items:
1. Fetches new emails from Microsoft
2. Creates email_messages records
3. Matches to contacts/companies

#### `/api/cron/sync-communications` (Every 10 min, offset)
Syncs to unified communications table:
1. Processes email_messages → communications
2. Processes transcripts → communications
3. Runs entity matching

#### `/api/cron/generate-daily-plans` (6:00 AM)
Generates daily plans for all users:
1. Calculates daily capacity
2. Scores pending items
3. Creates optimized daily plans

#### `/api/cron/calculate-momentum` (Every 15 min)
Updates momentum scores:
1. Recalculates scores for all pending items
2. Updates time pressure factors
3. Refreshes urgency rankings

#### `/api/cron/sync-command-center` (Every 5 min)
Syncs command center items:
1. Creates items from email drafts
2. Creates items from upcoming meetings
3. Creates items from AI signals
4. Updates existing items

#### `/api/cron/classify-tiers` (Every 5 min)
AI-powered tier classification:
1. Analyzes pending communications
2. Assigns priority tiers (1-5)
3. Determines tier triggers

#### `/api/cron/run-pipelines` (Every 5 min)
Runs background pipelines:
1. Detect deal deadlines
2. Detect inbound emails
3. Detect meeting follow-ups
4. Process transcript analysis
5. Update SLA status

#### `/api/cron/analyze-emails` (Every 15 min, offset)
Analyzes unprocessed emails:
1. AI analysis of email content
2. Sentiment detection
3. Action item extraction

#### `/api/cron/detect-no-shows` (Every 15 min, offset)
Detects and handles no-shows:
1. Finds meetings that occurred without attendance
2. Triggers recovery workflows
3. Updates scheduling requests

#### `/api/cron/analyze-communications` (Every 15 min)
Analyzes communications for insights:
1. AI-powered communication analysis
2. Signal detection
3. Updates relationship intelligence

---

## 3. Background Pipelines

**Location:** `src/lib/pipelines/`

### Pipeline Functions

| Pipeline | File | Purpose |
|----------|------|---------|
| Detect Deal Deadlines | `detectDealDeadlines.ts` | Find approaching close dates |
| Detect Inbound Emails | `detectInboundEmails.ts` | Process new inbound emails |
| Detect Meeting Follow-ups | `detectMeetingFollowups.ts` | Find meetings needing follow-up |
| Process Transcript Analysis | `processTranscriptAnalysis.ts` | Analyze transcript insights |
| Update SLA Status | `updateSlaStatus.ts` | Update SLA breach/warning status |

### Pipeline Flow

```
Cron Trigger (/api/cron/run-pipelines)
    │
    ├──> detectDealDeadlines()
    │       └──> Creates attention flags for approaching deadlines
    │
    ├──> detectInboundEmails()
    │       └──> Matches to companies, creates command center items
    │
    ├──> detectMeetingFollowups()
    │       └──> Creates follow-up items for recent meetings
    │
    ├──> processTranscriptAnalysis()
    │       └──> Extracts insights, updates relationship intelligence
    │
    └──> updateSlaStatus()
            └──> Marks items as warning/breached
```

---

## 4. Event Sourcing Flows

**Location:** `src/lib/lifecycle/`, `src/lib/supportCase/`

### Lifecycle Event Flow

```
Command Handler (e.g., moveStage)
    │
    ├──> Validate command against aggregate state
    │
    ├──> Append event to lifecycle_events
    │       └──> Event: StageTransitioned, ProcessCompleted, etc.
    │
    └──> Projectors run on new events
            ├──> CompanyProductReadModelProjector
            │       └──> Updates company_product_read_models
            │
            ├──> CompanyProductStageFactsProjector
            │       └──> Updates company_product_stage_facts
            │
            └──> ProductPipelineStageCountsProjector
                    └──> Updates product_pipeline_stage_counts
```

### Support Case Event Flow

```
Command Handler (e.g., createSupportCase)
    │
    ├──> Validate command
    │
    ├──> Append event to support_case_events
    │       └──> Event: SupportCaseCreated, StatusChanged, etc.
    │
    └──> Projectors run on new events
            ├──> SupportCaseReadModelProjector
            │       └──> Updates support_case_read_models
            │
            ├──> SupportCaseSLAFactsProjector
            │       └──> Updates support_case_sla_facts
            │
            └──> OpenCaseCountsProjector
                    └──> Updates open_case_counts_per_product
```

---

## 5. AI Autopilot Workflows

**Location:** `src/lib/autopilot/`

### Autopilot Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Scheduler | `schedulerAutopilot.ts` | Auto-process scheduling requests |
| Needs Reply | `needsReplyAutopilot.ts` | Auto-respond to simple communications |
| Transcript | `transcriptAutopilot.ts` | Auto-send meeting follow-ups |

### Autopilot Flow

```
runAutopilot({ workflows: ['scheduler', 'needs-reply', 'transcript'] })
    │
    ├──> runSchedulerAutopilot()
    │       ├──> Find pending scheduling requests
    │       ├──> Evaluate safety rules
    │       ├──> Process confirmations automatically
    │       └──> Log to ai_action_log
    │
    ├──> runNeedsReplyAutopilot()
    │       ├──> Find emails needing reply
    │       ├──> Check confidence threshold
    │       ├──> Generate and send response
    │       └──> Create attention flag if unsure
    │
    └──> runTranscriptAutopilot()
            ├──> Find meetings needing follow-up
            ├──> Generate follow-up email from transcript
            ├──> Send or queue for review
            └──> Log action
```

### Safety Rules

All autopilot workflows enforce:
1. **Confidence Threshold** - Only act on high-confidence analyses
2. **Rate Limiting** - Prevent excessive automated actions
3. **Human Escalation** - Create attention flags when uncertain
4. **Audit Logging** - Log all actions to `ai_action_log`
5. **Dry Run Mode** - Test without executing

---

## Workflow Data Flow

```
                    ┌─────────────────────────────────────┐
                    │           External Sources          │
                    │  (Microsoft 365, Fireflies, Forms)  │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │           Sync Cron Jobs            │
                    │ (sync-microsoft, sync-fireflies...)  │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │        Communications Table         │
                    │         (Unified FACTS)             │
                    └─────────────────┬───────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐   ┌──────────▼──────────┐
│  AI Analysis Cron   │   │  Tier Classification │   │  Pipeline Runner    │
│ (analyze-comms...)  │   │  (classify-tiers)    │   │  (run-pipelines)    │
└──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │        Command Center Items         │
                    │    (Prioritized Work Queue)         │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │          AI Autopilot               │
                    │  (scheduler, needs-reply, transcript)│
                    └─────────────────┬───────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐   ┌──────────▼──────────┐
│   Auto-Execute      │   │  Human Review        │   │  Attention Flags    │
│   (high confidence) │   │  (medium confidence) │   │  (low confidence)   │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

## Statistics

| Metric | Count |
|--------|-------|
| Cron Jobs | 13 |
| Process Types | 4 |
| Node Types | 6 |
| Sales Triggers | 6 |
| Onboarding Triggers | 5 |
| Support Triggers | 6 |
| Engagement Triggers | 7 |
| Autopilot Workflows | 3 |
| Background Pipelines | 5 |
