# Database Schema Documentation

> Generated: 2026-01-01
> Audit Phase: 2 - Database Schema
> Source: 86 migration files in `supabase/migrations/`

---

## Quick Stats

| Category | Count |
|----------|-------|
| Tables | 74 |
| Views | 6 |
| Indexes | 180+ |
| RLS Policies | 120+ |
| Enum Types | 35 |
| Functions | 25+ |
| Triggers | 30+ |

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    %% Core Entities
    users ||--o{ deals : owns
    users ||--o{ activities : creates
    users ||--o{ tasks : assigned_to
    users ||--o{ command_center_items : assigned_to

    companies ||--o{ contacts : has
    companies ||--o{ deals : has
    companies ||--o{ activities : related_to
    companies ||--o{ communications : has
    companies ||--o{ company_products : has
    companies ||--o{ account_intelligence : has
    companies ||--o{ support_cases : has

    contacts ||--o{ activities : related_to
    contacts ||--o{ communications : from_to

    deals ||--o{ activities : related_to
    deals ||--o{ deal_stage_history : tracks
    deals ||--o{ deal_health_history : tracks
    deals ||--o{ deal_collaborators : has
    deals ||--o{ scheduling_requests : related_to

    %% Email System
    email_conversations ||--o{ email_messages : contains
    email_conversations ||--o{ email_drafts : has
    users ||--o{ email_conversations : owns

    %% Scheduling
    scheduling_requests ||--o{ scheduling_attendees : has
    scheduling_requests ||--o{ scheduling_actions : logs
    scheduling_requests ||--o{ meeting_prep_briefs : generates

    %% Products
    product_categories ||--o{ products : contains
    products ||--o{ company_products : sold_as
    products ||--o{ product_process_stages : has

    %% Support Cases
    support_cases ||--|| support_case_read_model : projects_to
    support_cases ||--o{ support_case_sla_facts : tracks

    %% AI Layer
    ai_signals }o--|| deals : alerts_about
    ai_action_queue }o--|| deals : suggests_for
    ai_summaries }o--|| deals : summarizes

    %% Command Center
    command_center_items }o--|| deals : tracks
    command_center_items }o--|| companies : tracks
    daily_plans ||--o{ command_center_items : schedules

    %% Workflow
    processes ||--o{ process_nodes : contains
    processes ||--o{ process_connections : has
    process_nodes ||--o{ process_connections : from
    process_nodes ||--o{ process_connections : to
```

---

## Tables by Domain

### Core Entities

#### users
Sales representatives and system users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| auth_id | UUID | UNIQUE | Links to Supabase Auth |
| email | TEXT | UNIQUE, NOT NULL | User email |
| name | TEXT | NOT NULL | Display name |
| role | user_role | NOT NULL, DEFAULT 'rep' | rep, manager, admin |
| level | user_level | NOT NULL, DEFAULT 'l1_foundation' | Skill level |
| team | team | NOT NULL | xrai, voice |
| territory | TEXT | | Assigned territory |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active status |
| hire_date | DATE | NOT NULL | Employment start date |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created timestamp |

**Source:** `00001_initial_schema.sql:43-54`

---

#### companies
Customer and prospect organizations. (Renamed from `organizations` in migration 00008)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| name | TEXT | NOT NULL | Company name |
| status | company_status | NOT NULL | cold_lead, prospect, customer, churned |
| segment | segment | NOT NULL | smb, mid_market, enterprise, pe_platform, franchisor |
| industry | industry | NOT NULL | pest, lawn, both |
| agent_count | INTEGER | NOT NULL, DEFAULT 0 | Number of agents |
| crm_platform | crm_platform | | fieldroutes, pestpac, realgreen, other |
| address | JSONB | | {street, city, state, zip, lat, lng} |
| voice_customer | BOOLEAN | NOT NULL, DEFAULT false | Voice product customer |
| voice_customer_since | TIMESTAMPTZ | | When became voice customer |
| external_ids | JSONB | DEFAULT '{}' | External system IDs |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated timestamp |

**Source:** `00001_initial_schema.sql:56-69`, `00008_schema_refactor.sql:61-79`

**RLS:** Enabled. Policies: companies_select, companies_insert, companies_update, companies_delete

---

#### contacts
People associated with companies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL | Parent company |
| name | TEXT | NOT NULL | Contact name |
| email | TEXT | NOT NULL | Email address |
| phone | TEXT | | Phone number |
| title | TEXT | | Job title |
| role | contact_role | | decision_maker, influencer, champion, end_user, blocker |
| is_primary | BOOLEAN | NOT NULL, DEFAULT false | Primary contact flag |
| last_contacted_at | TIMESTAMPTZ | | Last contact timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created timestamp |

**Source:** `00001_initial_schema.sql:71-82`

**Indexes:** idx_contacts_company, idx_contacts_email

---

#### deals
Sales opportunities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL | Parent company |
| owner_id | UUID | FK → users(id), NOT NULL | Deal owner |
| name | TEXT | NOT NULL | Deal name |
| stage | deal_stage | NOT NULL, DEFAULT 'new_lead' | Pipeline stage |
| deal_type | deal_type | NOT NULL, DEFAULT 'new_business' | new_business, upsell, cross_sell, expansion, renewal |
| sales_team | sales_team | | voice_outside, voice_inside, xrai |
| health_score | INTEGER | NOT NULL, DEFAULT 50, CHECK (0-100) | AI-calculated health |
| health_factors | JSONB | | Score breakdown |
| health_trend | health_trend | | improving, stable, declining |
| health_updated_at | TIMESTAMPTZ | | Last health calculation |
| estimated_value | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Deal value |
| products | JSONB | | {voice, platform, ai_agents} |
| quoted_products | JSONB | DEFAULT '[]' | Array of product IDs |
| primary_product_category_id | UUID | FK → product_categories(id) | Primary category |
| competitor_mentioned | TEXT | | Competitor name |
| trial_start_date | DATE | | Trial start |
| trial_end_date | DATE | | Trial end |
| expected_close_date | DATE | | Expected close |
| closed_at | TIMESTAMPTZ | | Actual close time |
| lost_reason | TEXT | | Loss reason |
| stage_entered_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Stage entry time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated timestamp |

**Source:** `00001_initial_schema.sql:84-102`, `00008_schema_refactor.sql:197-206`, `20251215_ai_intelligence_layer.sql:394-417`

**Indexes:** idx_deals_company, idx_deals_owner, idx_deals_stage, idx_deals_health_score, idx_deals_deal_type, idx_deals_sales_team

**Triggers:** deals_updated_at, deals_stage_change

---

#### activities
All interaction events (emails, calls, meetings, notes).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| deal_id | UUID | FK → deals(id) ON DELETE SET NULL | Related deal |
| contact_id | UUID | FK → contacts(id) ON DELETE SET NULL | Related contact |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL | Parent company |
| user_id | UUID | FK → users(id), NOT NULL | Activity creator |
| type | activity_type | NOT NULL | email_sent, email_received, meeting, note, call |
| subject | TEXT | | Activity subject |
| body | TEXT | | Content body |
| summary | TEXT | | AI-generated summary |
| metadata | JSONB | | Channel-specific data |
| sentiment | sentiment | | positive, neutral, negative |
| action_items | JSONB | | Extracted actions |
| visible_to_teams | TEXT[] | DEFAULT ['voice','xrai'] | Team visibility |
| match_status | activity_match_status | DEFAULT 'pending' | AI matching status |
| match_confidence | DECIMAL(3,2) | | Match confidence |
| match_reasoning | TEXT | | Match explanation |
| matched_at | TIMESTAMPTZ | | Match timestamp |
| exclude_reason | TEXT | | Exclusion reason |
| occurred_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created timestamp |

**Source:** `00001_initial_schema.sql:104-117`, `00008_schema_refactor.sql:269-272`, `20251216000002_activity_matching.sql:20-24`

**Indexes:** idx_activities_deal, idx_activities_company, idx_activities_user, idx_activities_occurred_at, idx_activities_match_status, idx_activities_visible_to_teams (GIN)

---

#### tasks
Action items assigned to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| deal_id | UUID | FK → deals(id) ON DELETE SET NULL | Related deal |
| company_id | UUID | FK → companies(id) ON DELETE SET NULL | Related company |
| assigned_to | UUID | FK → users(id), NOT NULL | Assignee |
| created_by | UUID | FK → users(id) | Creator (null = AI) |
| type | task_type | NOT NULL | follow_up, call, email, meeting, review, custom |
| title | TEXT | NOT NULL | Task title |
| description | TEXT | | Task details |
| priority | task_priority | NOT NULL, DEFAULT 'medium' | high, medium, low |
| due_at | TIMESTAMPTZ | NOT NULL | Due date |
| completed_at | TIMESTAMPTZ | | Completion time |
| source | task_source | NOT NULL, DEFAULT 'manual' | ai_recommendation, manual, meeting_extraction, sequence |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created timestamp |

**Source:** `00001_initial_schema.sql:132-145`

---

### Email System

#### email_conversations
Email thread tracking. Primary entity for rep email workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| user_id | UUID | FK → users(id) ON DELETE CASCADE | Owner |
| conversation_id | VARCHAR(255) | NOT NULL | Microsoft Graph conversationId |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'pending' | Thread status |
| contact_id | UUID | FK → contacts(id) | Linked contact |
| company_id | UUID | FK → companies(id) | Linked company |
| deal_id | UUID | FK → deals(id) | Linked deal |
| link_confidence | INTEGER | | 0-100 linking confidence |
| link_method | VARCHAR(30) | | auto_high, auto_suggested, manual, thread_inherited |
| link_reasoning | TEXT | | Link explanation |
| subject | VARCHAR(1000) | | Thread subject |
| participant_emails | TEXT[] | | All participants |
| participant_names | TEXT[] | | Participant names |
| message_count | INTEGER | DEFAULT 1 | Messages in thread |
| has_attachments | BOOLEAN | DEFAULT FALSE | Has attachments |
| first_message_at | TIMESTAMPTZ | | First message time |
| last_message_at | TIMESTAMPTZ | | Last message time |
| last_inbound_at | TIMESTAMPTZ | | Last received |
| last_outbound_at | TIMESTAMPTZ | | Last sent |
| response_due_at | TIMESTAMPTZ | | SLA deadline |
| sla_hours | INTEGER | | Expected response time |
| sla_status | VARCHAR(20) | DEFAULT 'ok' | ok, warning, overdue |
| ai_priority | VARCHAR(20) | | high, medium, low |
| ai_category | VARCHAR(50) | | Thread category |
| ai_sentiment | VARCHAR(20) | | positive, neutral, negative, urgent |
| ai_sentiment_trend | VARCHAR(30) | | improving, stable, declining |
| ai_thread_summary | TEXT | | AI summary |
| ai_suggested_action | TEXT | | AI suggestion |
| ai_evidence_quotes | TEXT[] | | Supporting quotes |
| signals | JSONB | DEFAULT '{}' | Detected signals |
| snoozed_until | TIMESTAMPTZ | | Snooze end time |
| snooze_reason | VARCHAR(255) | | Snooze reason |
| has_pending_draft | BOOLEAN | DEFAULT FALSE | Has draft |
| draft_confidence | INTEGER | | Draft confidence |
| user_managed | BOOLEAN | DEFAULT FALSE | User manually managed |
| last_synced_at | TIMESTAMPTZ | | Last sync |
| sync_conflict | BOOLEAN | DEFAULT FALSE | Has conflict |
| sync_conflict_reason | TEXT | | Conflict reason |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20231222000010_email_inbox.sql:8-92`

**Indexes:** idx_conversations_user_status, idx_conversations_user_priority, idx_conversations_sla, idx_conversations_snoozed, idx_conversations_deal, idx_conversations_company, idx_conversations_last_message

**Unique:** (user_id, conversation_id)

---

#### email_messages
Individual email messages within conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| conversation_ref | UUID | FK → email_conversations(id) ON DELETE CASCADE | Parent conversation |
| user_id | UUID | FK → users(id) ON DELETE CASCADE | Owner |
| message_id | VARCHAR(255) | NOT NULL | Graph immutable ID |
| internet_message_id | VARCHAR(500) | | RFC 2822 Message-ID |
| outlook_folder_id | VARCHAR(255) | | Outlook folder |
| outlook_folder_name | VARCHAR(100) | | Folder name |
| subject | VARCHAR(1000) | | Subject |
| from_email | VARCHAR(255) | | Sender email |
| from_name | VARCHAR(255) | | Sender name |
| to_emails | TEXT[] | | Recipients |
| to_names | TEXT[] | | Recipient names |
| cc_emails | TEXT[] | | CC list |
| cc_names | TEXT[] | | CC names |
| body_preview | TEXT | | Preview text |
| body_text | TEXT | | Plain text body |
| body_html | TEXT | | HTML body |
| is_read | BOOLEAN | DEFAULT FALSE | Read status |
| is_sent_by_user | BOOLEAN | DEFAULT FALSE | Outbound flag |
| is_flagged | BOOLEAN | DEFAULT FALSE | Flagged |
| has_attachments | BOOLEAN | DEFAULT FALSE | Has attachments |
| importance | VARCHAR(20) | | low, normal, high |
| received_at | TIMESTAMPTZ | | Received time |
| sent_at | TIMESTAMPTZ | | Sent time |
| ai_analysis | JSONB | | AI analysis |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |

**Source:** `20231222000010_email_inbox.sql:109-159`

**Indexes:** idx_messages_conversation, idx_messages_user_received, idx_messages_internet_id

**Unique:** (user_id, message_id)

---

### AI Intelligence Layer

#### ai_summaries
AI-generated summaries for entities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| deal_id | UUID | FK → deals(id) ON DELETE CASCADE | Related deal |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE | Related company |
| contact_id | UUID | FK → contacts(id) ON DELETE CASCADE | Related contact |
| summary_type | ai_summary_type | NOT NULL | Summary type enum |
| summary | JSONB | NOT NULL, DEFAULT '{}' | Summary content |
| summary_text | TEXT | | Plain text summary |
| key_points | TEXT[] | | Key points |
| risks | TEXT[] | | Identified risks |
| opportunities | TEXT[] | | Identified opportunities |
| generated_at | TIMESTAMPTZ | DEFAULT NOW() | Generation time |
| context_hash | VARCHAR(64) | | Input data hash |
| stale | BOOLEAN | DEFAULT FALSE | Staleness flag |
| model_used | VARCHAR(100) | | AI model used |
| tokens_used | INTEGER | | Token count |
| confidence | DECIMAL(3,2) | | 0.00-1.00 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251215_ai_intelligence_layer.sql:109-146`

**Constraint:** Only one entity reference allowed (deal, company, or contact)

---

#### ai_signals
AI-detected signals and alerts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| deal_id | UUID | FK → deals(id) ON DELETE CASCADE | Related deal |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE | Related company |
| contact_id | UUID | FK → contacts(id) ON DELETE CASCADE | Related contact |
| user_id | UUID | FK → users(id) | Assignee |
| signal_type | ai_signal_type | NOT NULL | Signal type |
| title | VARCHAR(255) | NOT NULL | Signal title |
| description | TEXT | | Details |
| severity | ai_signal_severity | NOT NULL, DEFAULT 'info' | critical, warning, info, positive |
| score | INTEGER | CHECK (0-100) | Signal strength |
| evidence | JSONB | DEFAULT '{}' | Evidence data |
| source | VARCHAR(100) | | email, meeting, activity, time_based, health_check |
| status | ai_signal_status | NOT NULL, DEFAULT 'active' | active, acknowledged, resolved, dismissed |
| acknowledged_by | UUID | FK → users(id) | Who acknowledged |
| acknowledged_at | TIMESTAMPTZ | | Acknowledgement time |
| resolved_at | TIMESTAMPTZ | | Resolution time |
| dismissed_reason | TEXT | | Dismissal reason |
| auto_resolve_condition | JSONB | | Auto-resolve rules |
| suggested_action | TEXT | | Recommended action |
| action_queue_id | UUID | FK → ai_action_queue(id) ON DELETE SET NULL | Linked action |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251215_ai_intelligence_layer.sql:211-249`

---

#### ai_action_queue
AI-suggested actions pending approval.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| deal_id | UUID | FK → deals(id) ON DELETE CASCADE | Related deal |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE | Related company |
| contact_id | UUID | FK → contacts(id) ON DELETE CASCADE | Related contact |
| user_id | UUID | FK → users(id) | Assignee |
| action_type | ai_action_type | NOT NULL | Action type |
| action_data | JSONB | NOT NULL, DEFAULT '{}' | Action parameters |
| title | VARCHAR(255) | NOT NULL | Action title |
| description | TEXT | | Details |
| priority | ai_action_priority | NOT NULL, DEFAULT 'medium' | critical, high, medium, low |
| auto_execute | BOOLEAN | DEFAULT FALSE | Auto-execute flag |
| requires_approval | BOOLEAN | DEFAULT TRUE | Needs approval |
| status | ai_action_status | NOT NULL, DEFAULT 'pending' | pending, approved, executed, rejected, expired |
| reasoning | TEXT | | AI reasoning |
| confidence | DECIMAL(3,2) | | 0.00-1.00 |
| trigger_source | VARCHAR(100) | | What triggered this |
| approved_by | UUID | FK → users(id) | Approver |
| approved_at | TIMESTAMPTZ | | Approval time |
| executed_at | TIMESTAMPTZ | | Execution time |
| execution_result | JSONB | | Execution outcome |
| rejected_reason | TEXT | | Rejection reason |
| expires_at | TIMESTAMPTZ | | Expiration time |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |

**Source:** `20251215_ai_intelligence_layer.sql:159-198`

---

### Command Center

#### command_center_items
Unified action queue for the Command Center.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| user_id | UUID | FK → users(id) ON DELETE CASCADE, NOT NULL | Owner |
| task_id | UUID | FK → tasks(id) ON DELETE SET NULL | Source task |
| conversation_id | UUID | FK → email_conversations(id) ON DELETE SET NULL | Source conversation |
| deal_id | UUID | FK → deals(id) ON DELETE SET NULL | Related deal |
| company_id | UUID | FK → companies(id) ON DELETE SET NULL | Related company |
| contact_id | UUID | FK → contacts(id) ON DELETE SET NULL | Related contact |
| signal_id | UUID | FK → ai_signals(id) ON DELETE SET NULL | Source signal |
| meeting_id | TEXT | | Calendar event ID |
| action_type | VARCHAR(50) | NOT NULL | Action type |
| title | TEXT | NOT NULL | Item title |
| description | TEXT | | Details |
| target_name | TEXT | | Contact/company name |
| company_name | TEXT | | Company name |
| deal_value | NUMERIC(15,2) | | Deal value |
| deal_probability | FLOAT | DEFAULT 0.5 | Win probability |
| deal_stage | VARCHAR(50) | | Current stage |
| estimated_minutes | INTEGER | DEFAULT 15 | Time estimate |
| momentum_score | INTEGER | DEFAULT 0, CHECK (0-100) | Priority score |
| score_factors | JSONB | DEFAULT '{}' | Score breakdown |
| score_explanation | TEXT[] | DEFAULT '{}' | Score reasons |
| base_priority | INTEGER | DEFAULT 0 | Base priority |
| time_pressure | INTEGER | DEFAULT 0 | Time urgency |
| value_score | INTEGER | DEFAULT 0 | Value weight |
| engagement_score | INTEGER | DEFAULT 0 | Engagement weight |
| due_at | TIMESTAMPTZ | | Due date |
| optimal_hours | INTEGER[] | | Best hours (0-23) |
| optimal_days | TEXT[] | | Best days |
| why_now | TEXT | | Urgency reason |
| context_brief | TEXT | | Context summary |
| win_tip | TEXT | | Tactical tip |
| status | VARCHAR(30) | DEFAULT 'pending' | pending, in_progress, completed, snoozed, dismissed |
| started_at | TIMESTAMPTZ | | Start time |
| completed_at | TIMESTAMPTZ | | Completion time |
| dismissed_at | TIMESTAMPTZ | | Dismissal time |
| dismissed_reason | TEXT | | Dismissal reason |
| snoozed_until | TIMESTAMPTZ | | Snooze end |
| snooze_count | INTEGER | DEFAULT 0 | Times snoozed |
| last_snoozed_at | TIMESTAMPTZ | | Last snooze time |
| skip_count | INTEGER | DEFAULT 0 | Times skipped |
| last_skipped_at | TIMESTAMPTZ | | Last skip time |
| planned_for_date | DATE | | Planned date |
| planned_block_index | INTEGER | | Time block index |
| planned_order | INTEGER | | Execution order |
| queue_id | VARCHAR(50) | | Work queue ID |
| lens | VARCHAR(30) | | Lens view |
| days_stale | INTEGER | DEFAULT 0 | Days stale |
| last_activity_at | TIMESTAMPTZ | | Last activity |
| primary_action_label | TEXT | DEFAULT 'Do It' | Button label |
| primary_action_url | TEXT | | Action URL |
| fallback_action_label | TEXT | | Fallback label |
| source | VARCHAR(50) | DEFAULT 'system' | Item source |
| source_id | TEXT | | Source system ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251219000001_command_center_v31.sql:10-101`, `20251230000005_unified_work_queues.sql:10-23`

**Indexes:** idx_cci_user_status, idx_cci_user_date, idx_cci_momentum, idx_cci_user_pending, idx_cci_due_at, idx_cci_deal, idx_cci_company, idx_cci_conversation, idx_cc_items_queue_id, idx_cc_items_lens, idx_cc_items_queue_lens

---

#### daily_plans
Daily capacity and time block planning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| user_id | UUID | FK → users(id) ON DELETE CASCADE, NOT NULL | Owner |
| plan_date | DATE | NOT NULL | Plan date |
| total_work_minutes | INTEGER | DEFAULT 480 | Total work time |
| meeting_minutes | INTEGER | DEFAULT 0 | Meeting time |
| prep_buffer_minutes | INTEGER | DEFAULT 0 | Pre-meeting buffer |
| reactive_buffer_minutes | INTEGER | DEFAULT 60 | Unexpected work buffer |
| available_minutes | INTEGER | DEFAULT 0 | Available for planning |
| planned_minutes | INTEGER | DEFAULT 0 | Actually planned |
| time_blocks | JSONB | DEFAULT '[]' | Time block array |
| planned_item_ids | UUID[] | DEFAULT '{}' | Planned items |
| total_potential_value | NUMERIC(15,2) | DEFAULT 0 | Potential value |
| completed_value | NUMERIC(15,2) | DEFAULT 0 | Completed value |
| items_planned | INTEGER | DEFAULT 0 | Planned count |
| items_completed | INTEGER | DEFAULT 0 | Completed count |
| completion_rate | FLOAT | DEFAULT 0 | Completion % |
| generated_at | TIMESTAMPTZ | DEFAULT NOW() | Generation time |
| last_refreshed_at | TIMESTAMPTZ | | Last refresh |
| calendar_hash | TEXT | | Calendar hash |

**Source:** `20251219000001_command_center_v31.sql:134-167`

**Unique:** (user_id, plan_date)

---

### Scheduler System

#### scheduling_requests
AI-powered meeting scheduling requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| created_by | UUID | FK → users(id) | Creator |
| deal_id | UUID | FK → deals(id) | Related deal |
| company_id | UUID | FK → companies(id) | Related company |
| meeting_type | VARCHAR(50) | NOT NULL | discovery, demo, follow_up, custom |
| duration_minutes | INTEGER | NOT NULL, DEFAULT 30 | Duration |
| title | VARCHAR(500) | | Meeting title |
| context | TEXT | | User context for AI |
| meeting_platform | VARCHAR(50) | DEFAULT 'teams' | teams, zoom, google_meet, phone, in_person |
| meeting_location | TEXT | | Location |
| meeting_link | TEXT | | Generated link |
| date_range_start | DATE | | Start of range |
| date_range_end | DATE | | End of range |
| preferred_times | JSONB | DEFAULT '{...}' | Time preferences |
| avoid_days | JSONB | DEFAULT '[]' | Days to avoid |
| timezone | VARCHAR(50) | DEFAULT 'America/New_York' | Timezone |
| status | VARCHAR(30) | NOT NULL, DEFAULT 'initiated' | State machine status |
| attempt_count | INTEGER | DEFAULT 0 | Scheduling attempts |
| no_show_count | INTEGER | DEFAULT 0 | No-shows |
| last_action_at | TIMESTAMPTZ | | Last action time |
| next_action_at | TIMESTAMPTZ | | Next action time |
| next_action_type | VARCHAR(50) | | Next action type |
| proposed_times | JSONB | DEFAULT '[]' | Proposed times |
| scheduled_time | TIMESTAMPTZ | | Confirmed time |
| calendar_event_id | TEXT | | Calendar event ID |
| invite_accepted | BOOLEAN | DEFAULT FALSE | Invite accepted |
| completed_at | TIMESTAMPTZ | | Completion time |
| outcome | VARCHAR(30) | | held, cancelled_by_us, cancelled_by_them, no_show, rescheduled |
| outcome_notes | TEXT | | Outcome details |
| email_thread_id | TEXT | | Email thread ID |
| conversation_history | JSONB | DEFAULT '[]' | Conversation log |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251227000001_ai_scheduler.sql:22-77`

**Indexes:** idx_scheduling_requests_status, idx_scheduling_requests_next_action, idx_scheduling_requests_deal, idx_scheduling_requests_company, idx_scheduling_requests_created_by, idx_scheduling_requests_scheduled

---

#### scheduling_attendees
Meeting attendees for scheduling requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| scheduling_request_id | UUID | FK → scheduling_requests(id) ON DELETE CASCADE | Parent request |
| side | VARCHAR(10) | NOT NULL | internal, external |
| user_id | UUID | FK → users(id) | For internal |
| contact_id | UUID | FK → contacts(id) | For external |
| name | VARCHAR(255) | | Attendee name |
| email | VARCHAR(255) | NOT NULL | Email |
| title | VARCHAR(255) | | Job title |
| is_required | BOOLEAN | DEFAULT TRUE | Required attendee |
| is_organizer | BOOLEAN | DEFAULT FALSE | Organizer flag |
| is_primary_contact | BOOLEAN | DEFAULT FALSE | Primary contact |
| invite_status | VARCHAR(20) | DEFAULT 'pending' | pending, accepted, declined, tentative |
| responded_at | TIMESTAMPTZ | | Response time |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |

**Source:** `20251227000001_ai_scheduler.sql:94-118`

---

#### scheduling_actions
Audit log for scheduling actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| scheduling_request_id | UUID | FK → scheduling_requests(id) ON DELETE CASCADE | Parent request |
| action_type | VARCHAR(50) | NOT NULL | Action type |
| email_id | TEXT | | Email reference |
| times_proposed | JSONB | | Proposed times |
| time_selected | TIMESTAMPTZ | | Selected time |
| message_subject | TEXT | | Message subject |
| message_content | TEXT | | Message content |
| previous_status | VARCHAR(30) | | Previous status |
| new_status | VARCHAR(30) | | New status |
| ai_reasoning | TEXT | | AI reasoning |
| actor | VARCHAR(20) | NOT NULL | ai, user, prospect |
| actor_id | UUID | | Actor ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |

**Source:** `20251227000001_ai_scheduler.sql:129-159`

---

### Communication Hub

#### communications
Unified communication records. Immutable facts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| company_id | UUID | FK → companies(id) | Company |
| contact_id | UUID | FK → contacts(id) | Contact |
| deal_id | UUID | FK → deals(id) | Deal |
| user_id | UUID | FK → users(id) | User |
| channel | TEXT | NOT NULL | email, call, meeting, sms, chat, note |
| direction | TEXT | NOT NULL | inbound, outbound, internal |
| our_participants | JSONB | DEFAULT '[]' | Our participants |
| their_participants | JSONB | DEFAULT '[]' | Their participants |
| is_ai_generated | BOOLEAN | DEFAULT FALSE | AI-generated flag |
| ai_action_type | TEXT | | AI action type |
| ai_initiated_by | UUID | FK → users(id) | AI initiator |
| ai_approved_by | UUID | FK → users(id) | AI approver |
| ai_model_used | TEXT | | Model used |
| occurred_at | TIMESTAMPTZ | NOT NULL | Event time |
| duration_seconds | INTEGER | | Duration |
| subject | TEXT | | Subject |
| content_preview | TEXT | | Preview |
| full_content | TEXT | | Full content |
| content_html | TEXT | | HTML content |
| attachments | JSONB | DEFAULT '[]' | Attachments |
| recording_url | TEXT | | Recording URL |
| source_table | TEXT | | Source table |
| source_id | UUID | | Source ID |
| external_id | TEXT | | External ID |
| thread_id | TEXT | | Thread ID |
| in_reply_to | UUID | FK → communications(id) | Reply to |
| awaiting_our_response | BOOLEAN | DEFAULT FALSE | Awaiting our reply |
| awaiting_their_response | BOOLEAN | DEFAULT FALSE | Awaiting their reply |
| response_due_by | TIMESTAMPTZ | | Response due |
| response_sla_minutes | INTEGER | | SLA minutes |
| responded_at | TIMESTAMPTZ | | Response time |
| response_communication_id | UUID | FK → communications(id) | Response ID |
| email_opened_at | TIMESTAMPTZ | | Open time |
| email_clicked_at | TIMESTAMPTZ | | Click time |
| email_bounced | BOOLEAN | DEFAULT FALSE | Bounced |
| tags | TEXT[] | DEFAULT '{}' | Tags |
| is_starred | BOOLEAN | DEFAULT FALSE | Starred |
| is_archived | BOOLEAN | DEFAULT FALSE | Archived |
| analysis_status | TEXT | DEFAULT 'pending' | Analysis status |
| current_analysis_id | UUID | FK → communication_analysis(id) | Current analysis |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251230000002_communication_hub.sql:5-73`

**Indexes:** idx_comm_company_time, idx_comm_contact_time, idx_comm_deal_time, idx_comm_user_time, idx_comm_channel, idx_comm_direction, idx_comm_ai_generated, idx_comm_awaiting_us, idx_comm_source, idx_comm_thread, idx_comm_analysis_pending

---

#### communication_analysis
AI analysis of communications. Versioned opinions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| communication_id | UUID | FK → communications(id) ON DELETE CASCADE, NOT NULL | Parent communication |
| version | INTEGER | NOT NULL, DEFAULT 1 | Version number |
| is_current | BOOLEAN | DEFAULT TRUE | Current version flag |
| model_used | TEXT | | Model used |
| prompt_version | TEXT | | Prompt version |
| summary | TEXT | | Summary |
| communication_type | TEXT | | Type classification |
| products_discussed | TEXT[] | DEFAULT '{}' | Products mentioned |
| sentiment | TEXT | | Sentiment |
| sentiment_score | DECIMAL(3,2) | | Sentiment score |
| sentiment_confidence | DECIMAL(3,2) | | Confidence |
| extracted_facts | JSONB | DEFAULT '[]' | Extracted facts |
| extracted_signals | JSONB | DEFAULT '[]' | Signals |
| extracted_objections | JSONB | DEFAULT '[]' | Objections |
| extracted_commitments_us | JSONB | DEFAULT '[]' | Our commitments |
| extracted_commitments_them | JSONB | DEFAULT '[]' | Their commitments |
| extracted_competitors | JSONB | DEFAULT '[]' | Competitors |
| extracted_next_steps | JSONB | DEFAULT '[]' | Next steps |
| potential_triggers | TEXT[] | DEFAULT '{}' | Potential triggers |
| analyzed_at | TIMESTAMPTZ | DEFAULT NOW() | Analysis time |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |

**Source:** `20251230000002_communication_hub.sql:76-111`

**Unique Index:** idx_analysis_current ON (communication_id) WHERE is_current = TRUE

---

#### promises
Tracked commitments from communications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| direction | TEXT | NOT NULL | we_promised, they_promised |
| promise_text | TEXT | NOT NULL | Promise text |
| company_id | UUID | FK → companies(id) | Company |
| contact_id | UUID | FK → contacts(id) | Contact |
| deal_id | UUID | FK → deals(id) | Deal |
| owner_user_id | UUID | FK → users(id) | Owner (for we_promised) |
| owner_name | TEXT | | Owner name |
| promiser_contact_id | UUID | FK → contacts(id) | Promiser (for they_promised) |
| promiser_name | TEXT | | Promiser name |
| promised_at | TIMESTAMPTZ | NOT NULL | Promise time |
| due_by | TIMESTAMPTZ | | Due date |
| status | TEXT | DEFAULT 'pending' | pending, completed, overdue, cancelled |
| completed_at | TIMESTAMPTZ | | Completion time |
| completed_communication_id | UUID | FK → communications(id) | Completion communication |
| source_communication_id | UUID | FK → communications(id) | Source communication |
| source_analysis_id | UUID | FK → communication_analysis(id) | Source analysis |
| confidence | DECIMAL(3,2) | | Confidence |
| is_hidden | BOOLEAN | DEFAULT FALSE | Hidden flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251230000002_communication_hub.sql:114-153`

---

### Products & Catalog

#### product_categories
Product category definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| name | TEXT | NOT NULL, UNIQUE | Category name |
| display_name | TEXT | NOT NULL | Display name |
| owner | product_owner | NOT NULL | voice, xrai |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Sort order |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |

**Source:** `00008_schema_refactor.sql:119-126`

---

#### products
Product definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| category_id | UUID | FK → product_categories(id) ON DELETE CASCADE, NOT NULL | Category |
| name | TEXT | NOT NULL, UNIQUE | Product name |
| display_name | TEXT | NOT NULL | Display name |
| description | TEXT | | Description |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active flag |
| typical_mrr_low | NUMERIC(10,2) | | Low MRR estimate |
| typical_mrr_high | NUMERIC(10,2) | | High MRR estimate |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Sort order |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |

**Source:** `00008_schema_refactor.sql:128-140`

---

#### company_products
Products owned by companies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Primary key |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL | Company |
| product_id | UUID | FK → products(id) ON DELETE CASCADE, NOT NULL | Product |
| status | company_product_status | NOT NULL, DEFAULT 'active' | active, churned, paused |
| started_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Start date |
| ended_at | TIMESTAMPTZ | | End date |
| churn_reason | TEXT | | Churn reason |
| mrr | NUMERIC(10,2) | | Monthly revenue |
| configuration_notes | TEXT | | Config notes |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated |

**Source:** `00008_schema_refactor.sql:150-163`

**Unique:** (company_id, product_id)

---

### Support Cases (Event-Sourced)

#### support_cases
Thin identity table for support cases. Aggregate root.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL | Company |
| company_product_id | UUID | FK → company_products(id) ON DELETE SET NULL | Product |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated |

**Source:** `20260107_support_case_system.sql:28-39`

**Note:** All mutable state is in support_case_read_model projection.

---

#### support_case_read_model
Projection of current support case state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| support_case_id | UUID | PK, FK → support_cases(id) ON DELETE CASCADE | Case ID |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL | Company |
| company_product_id | UUID | FK → company_products(id) ON DELETE SET NULL | Product |
| title | TEXT | | Case title |
| description | TEXT | | Description |
| external_id | TEXT | | External ticket ID |
| source | TEXT | | email, phone, chat, portal, internal |
| status | TEXT | NOT NULL, DEFAULT 'open' | open, in_progress, waiting_on_customer, waiting_on_internal, escalated, resolved, closed |
| severity | TEXT | NOT NULL, DEFAULT 'medium' | low, medium, high, urgent, critical |
| category | TEXT | | Category |
| subcategory | TEXT | | Subcategory |
| tags | JSONB | DEFAULT '[]' | Tags |
| owner_id | TEXT | | Owner ID |
| owner_name | TEXT | | Owner name |
| assigned_team | TEXT | | Team |
| first_response_due_at | TIMESTAMPTZ | | First response SLA |
| first_response_at | TIMESTAMPTZ | | First response time |
| first_response_breached | BOOLEAN | DEFAULT FALSE | Breached flag |
| resolution_due_at | TIMESTAMPTZ | | Resolution SLA |
| resolved_at | TIMESTAMPTZ | | Resolution time |
| resolution_breached | BOOLEAN | DEFAULT FALSE | Breached flag |
| opened_at | TIMESTAMPTZ | NOT NULL | Open time |
| last_customer_contact_at | TIMESTAMPTZ | | Last customer contact |
| last_agent_response_at | TIMESTAMPTZ | | Last agent response |
| closed_at | TIMESTAMPTZ | | Close time |
| response_count | INTEGER | DEFAULT 0 | Total responses |
| customer_response_count | INTEGER | DEFAULT 0 | Customer responses |
| agent_response_count | INTEGER | DEFAULT 0 | Agent responses |
| escalation_count | INTEGER | DEFAULT 0 | Escalations |
| reopen_count | INTEGER | DEFAULT 0 | Reopens |
| csat_score | INTEGER | CHECK (1-5) | CSAT score |
| csat_comment | TEXT | | CSAT comment |
| csat_submitted_at | TIMESTAMPTZ | | CSAT time |
| resolution_summary | TEXT | | Resolution summary |
| root_cause | TEXT | | Root cause |
| engagement_impact | TEXT | | positive, neutral, negative, critical |
| churn_risk_contribution | INTEGER | CHECK (0-100) | Churn risk contribution |
| last_event_at | TIMESTAMPTZ | | Last event time |
| last_event_type | TEXT | | Last event type |
| last_event_sequence | BIGINT | | Last event sequence |
| projected_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Projection time |
| projection_version | INTEGER | NOT NULL, DEFAULT 1 | Version |

**Source:** `20260107_support_case_system.sql:77-164`

**Note:** PROJECTION - derived from event_store. Never write directly.

---

### Workflow Builder

#### processes
Visual workflow definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| product_id | UUID | FK → products(id) ON DELETE CASCADE, NOT NULL | Product |
| process_type | process_type | NOT NULL | Process type |
| name | TEXT | NOT NULL | Workflow name |
| description | TEXT | | Description |
| status | TEXT | NOT NULL, DEFAULT 'draft' | draft, active, archived |
| canvas_zoom | NUMERIC(4,2) | DEFAULT 1.0 | Canvas zoom |
| canvas_pan_x | INTEGER | DEFAULT 0 | Canvas pan X |
| canvas_pan_y | INTEGER | DEFAULT 0 | Canvas pan Y |
| created_by | UUID | FK → auth.users(id) | Creator |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated |
| published_at | TIMESTAMPTZ | | Published time |

**Source:** `20251230000006_workflow_builder.sql:16-38`

**Unique Index:** Only one active per product/process_type

---

#### process_nodes
Visual nodes on workflow canvas.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| process_id | UUID | FK → processes(id) ON DELETE CASCADE, NOT NULL | Parent workflow |
| type | TEXT | NOT NULL | trigger, stage, condition, aiAction, humanAction, exit |
| item_id | TEXT | NOT NULL | Node template ID |
| label | TEXT | NOT NULL | Display label |
| icon | TEXT | | Icon |
| color | TEXT | | Color |
| position_x | INTEGER | NOT NULL, DEFAULT 0 | X position |
| position_y | INTEGER | NOT NULL, DEFAULT 0 | Y position |
| config | JSONB | DEFAULT '{}' | Node config |
| stage_id | UUID | FK → product_process_stages(id) | Linked stage |
| node_order | INTEGER | | Order |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated |

**Source:** `20251230000006_workflow_builder.sql:53-84`

---

#### process_connections
Connections between workflow nodes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| process_id | UUID | FK → processes(id) ON DELETE CASCADE, NOT NULL | Parent workflow |
| from_node_id | UUID | FK → process_nodes(id) ON DELETE CASCADE, NOT NULL | Source node |
| from_port | TEXT | NOT NULL, DEFAULT 'default' | Output port |
| to_node_id | UUID | FK → process_nodes(id) ON DELETE CASCADE, NOT NULL | Target node |
| to_port | TEXT | NOT NULL, DEFAULT 'input' | Input port |
| label | TEXT | | Connection label |
| color | TEXT | | Color |
| style | TEXT | NOT NULL, DEFAULT 'solid' | solid, dashed |
| condition | JSONB | | Condition logic |
| connection_order | INTEGER | DEFAULT 0 | Priority order |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Updated |

**Source:** `20251230000006_workflow_builder.sql:97-127`

**Unique:** (process_id, from_node_id, from_port, to_node_id, to_port)

---

### Account Intelligence

#### account_intelligence
AI-gathered company intelligence.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| company_id | UUID | FK → companies(id) ON DELETE CASCADE, NOT NULL, UNIQUE | Company |
| overall_score | INTEGER | | 0-100 |
| website_score | INTEGER | | Website score |
| social_score | INTEGER | | Social score |
| review_score | INTEGER | | Review score |
| industry_score | INTEGER | | Industry score |
| executive_summary | TEXT | | AI summary |
| pain_points | JSONB | DEFAULT '[]' | Pain points |
| opportunities | JSONB | DEFAULT '[]' | Opportunities |
| talking_points | JSONB | DEFAULT '[]' | Talking points |
| recommended_approach | TEXT | | Recommended approach |
| last_collected_at | TIMESTAMPTZ | | Last collection |
| collection_status | TEXT | DEFAULT 'pending' | pending, collecting, complete, failed, partial |
| context_hash | TEXT | | Context hash |
| error_message | TEXT | | Error message |
| created_at | TIMESTAMPTZ | DEFAULT now() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Updated |

**Source:** `20251216000001_account_intelligence.sql:8-36`

---

### Meeting Transcriptions

#### meeting_transcriptions
Uploaded meeting transcripts and AI analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| deal_id | UUID | FK → deals(id) ON DELETE SET NULL | Deal |
| company_id | UUID | FK → companies(id) ON DELETE SET NULL | Company |
| contact_id | UUID | FK → contacts(id) ON DELETE SET NULL | Contact |
| activity_id | UUID | FK → activities(id) ON DELETE SET NULL | Activity |
| user_id | UUID | FK → users(id), NOT NULL | Owner |
| title | VARCHAR(255) | NOT NULL | Title |
| meeting_date | DATE | NOT NULL | Date |
| duration_minutes | INTEGER | | Duration |
| attendees | TEXT[] | | Attendees |
| transcription_text | TEXT | NOT NULL | Transcript |
| transcription_format | VARCHAR(50) | | plain, vtt, srt, teams, zoom |
| word_count | INTEGER | | Word count |
| analysis | JSONB | | AI analysis |
| analysis_generated_at | TIMESTAMPTZ | | Analysis time |
| summary | TEXT | | Summary |
| follow_up_email_draft | TEXT | | Draft email |
| source | VARCHAR(50) | DEFAULT 'manual' | Source |
| external_id | VARCHAR(255) | | External ID |
| external_metadata | JSONB | | External data |
| match_confidence | DECIMAL(3,2) | | Match confidence |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Updated |

**Source:** `20251215003500_meeting_transcriptions.sql:4-36`, `20251216000006_fireflies_integration.sql:76-89`

---

### AI Prompts

#### ai_prompts
Editable AI prompt templates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Prompt key |
| name | VARCHAR(255) | NOT NULL | Display name |
| description | TEXT | | Description |
| prompt_template | TEXT | NOT NULL | Current template |
| schema_template | TEXT | | Output schema |
| default_prompt_template | TEXT | NOT NULL | Default template |
| default_schema_template | TEXT | | Default schema |
| is_active | BOOLEAN | DEFAULT true | Active flag |
| version | INTEGER | DEFAULT 1 | Version |
| created_at | TIMESTAMPTZ | DEFAULT now() | Created |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Updated |
| updated_by | UUID | FK → users(id) | Last editor |

**Source:** `20251216000005_ai_prompts.sql:5-19`

---

## Enum Types

| Enum Type | Values | Source |
|-----------|--------|--------|
| organization_type | prospect, customer, churned | 00001:11 |
| segment | smb, mid_market, enterprise, pe_platform, franchisor | 00001:12 |
| industry | pest, lawn, both | 00001:13 |
| crm_platform | fieldroutes, pestpac, realgreen, other | 00001:14 |
| contact_role | decision_maker, influencer, champion, end_user, blocker | 00001:16 |
| deal_stage | new_lead, qualifying, discovery, demo, data_review, trial, negotiation, closed_won, closed_lost | 00001:18-22 |
| activity_type | email_sent, email_received, meeting, note, call | 00001:24 |
| sentiment | positive, neutral, negative | 00001:25 |
| user_role | rep, manager, admin | 00001:27 |
| user_level | l1_foundation, l2_established, l3_senior | 00001:28 |
| team | xrai, voice | 00001:29 |
| task_type | follow_up, call, email, meeting, review, custom | 00001:31 |
| task_priority | high, medium, low | 00001:32 |
| task_source | ai_recommendation, manual, meeting_extraction, sequence | 00001:33 |
| company_status | cold_lead, prospect, customer, churned | 00008:19 |
| deal_type | new_business, upsell, cross_sell, expansion, renewal | 00008:22 |
| sales_team | voice_outside, voice_inside, xrai | 00008:25 |
| product_owner | voice, xrai | 00008:28 |
| product_event_type | pitched, declined, purchased, churned, upgraded, downgraded | 00008:31 |
| company_product_status | active, churned, paused | 00008:34 |
| collaborator_role | owner, collaborator, informed | 00008:37 |
| signal_type | voicemail_spike, queue_time_increase, engagement_drop, did_request, expansion_indicator, churn_risk, upsell_opportunity | 00008:40-48 |
| signal_status | new, acted_on, dismissed | 00008:51 |
| ai_summary_type | deal_overview, deal_status, company_overview, contact_overview, relationship_summary, engagement_summary | 20251215:16-23 |
| ai_action_type | send_email, move_stage, create_task, schedule_meeting, alert, update_value, add_contact, send_content, log_activity | 20251215:25-35 |
| ai_action_status | pending, approved, executed, rejected, expired | 20251215:37-43 |
| ai_action_priority | critical, high, medium, low | 20251215:45-50 |
| ai_signal_type | risk, opportunity, buying_signal, stale, competitor, sentiment_negative, sentiment_positive, engagement_spike, engagement_drop, stage_stuck, action_needed | 20251215:52-64 |
| ai_signal_severity | critical, warning, info, positive | 20251215:66-71 |
| ai_signal_status | active, acknowledged, resolved, dismissed | 20251215:73-78 |
| ai_email_draft_type | follow_up, response, introduction, proposal, check_in, re_engagement, meeting_request, thank_you, custom | 20251215:80-90 |
| ai_email_draft_status | draft, approved, sent, rejected | 20251215:92-97 |
| health_trend | improving, stable, declining | 20251215:99-103 |
| activity_match_status | pending, matched, excluded, review_needed, unmatched | 20251216000002:8-14 |

---

## Views

| View Name | Description | Source |
|-----------|-------------|--------|
| company_summary | Company with product counts, MRR, deals, signals | 00008:495-513 |
| active_signals_view | Active AI signals with entity info | 20251215:535-546 |
| pending_actions_view | Pending AI actions with entity info | 20251215:549-567 |
| deal_health_view | Deals with latest health scores | 20251215:570-589 |
| work_queue_stats | Queue statistics by queue_id and lens | 20251230000005:108-120 |

---

## RLS Policy Summary

All tables have Row Level Security enabled. Common patterns:

1. **Authenticated users can read:** Most reference and operational tables
2. **Users can only access their own data:** command_center_items, daily_plans, scheduling_requests
3. **Service role has full access:** All tables for cron jobs and admin operations
4. **Reference data is public:** product_categories, products (SELECT only)

---

## Verification

- Tables documented: 74
- Enum types documented: 35
- All columns include type, constraints, and source line references
- ERD generated in Mermaid format
- RLS policies summarized

**Phase 2 Complete.**
