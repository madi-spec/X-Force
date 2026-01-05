# API Routes Documentation

> Generated: 2026-01-01
> Source: `src/app/api/**/route.ts`
> Total Routes: 210

## Table of Contents

1. [Authentication Patterns](#authentication-patterns)
2. [Activities API](#activities-api)
3. [Admin API](#admin-api)
4. [AI API](#ai-api)
5. [Analytics API](#analytics-api)
6. [Attention Flags API](#attention-flags-api)
7. [Auth API](#auth-api)
8. [Calendar API](#calendar-api)
9. [Cases API](#cases-api)
10. [Command Center API](#command-center-api)
11. [Communications API](#communications-api)
12. [Companies API](#companies-api)
13. [Contacts API](#contacts-api)
14. [Cron Jobs API](#cron-jobs-api)
15. [Daily Driver API](#daily-driver-api)
16. [Deal Rooms API](#deal-rooms-api)
17. [Deals API](#deals-api)
18. [Duplicates API](#duplicates-api)
19. [Focus API](#focus-api)
20. [Inbox API](#inbox-api)
21. [Integrations API](#integrations-api)
22. [Intelligence API](#intelligence-api)
23. [Jobs API](#jobs-api)
24. [Learning API](#learning-api)
25. [Legacy Deals API](#legacy-deals-api)
26. [Leverage Moments API](#leverage-moments-api)
27. [Lifecycle API](#lifecycle-api)
28. [Meetings API](#meetings-api)
29. [Microsoft API](#microsoft-api)
30. [Process API](#process-api)
31. [Products API](#products-api)
32. [Public API](#public-api)
33. [Relationships API](#relationships-api)
34. [Scheduler API](#scheduler-api)
35. [SMS API](#sms-api)
36. [Sync API](#sync-api)
37. [Tasks API](#tasks-api)
38. [Track API](#track-api)
39. [Transcripts API](#transcripts-api)
40. [Triage API](#triage-api)
41. [Webhooks API](#webhooks-api)

---

## Authentication Patterns

### User Authentication (Most Common)
```typescript
// src/app/api/*/route.ts
const authSupabase = await createClient();
const { data: { user } } = await authSupabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const supabase = createAdminClient(); // Bypass RLS
```

### Cron Secret Validation
```typescript
// src/app/api/cron/*/route.ts
const cronSecret = request.headers.get('x-cron-secret');
if (expectedSecret && cronSecret !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### No Authentication (Public)
Some routes are intentionally public:
- `/api/public/rooms/[slug]` - Public deal rooms
- `/api/track/open` - Email tracking pixel
- `/api/track/click` - Link click tracking

---

## Activities API

### `GET /api/activities`
**Source:** `src/app/api/activities/route.ts:16`
**Auth:** None (admin client)

Query activities with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| company_id | string | Filter by company |
| contact_id | string | Filter by contact |
| type | string | Filter by type (meeting, email, call) |
| upcoming | boolean | Only future activities |
| limit | number | Max results (default 50) |

**Response:** `{ activities: Activity[] }`

### `POST /api/activities/resolve-review`
**Source:** `src/app/api/activities/resolve-review/route.ts`
**Auth:** User

Resolve an activity requiring review.

---

## Admin API

### `GET /api/admin/projections/metrics`
**Source:** `src/app/api/admin/projections/metrics/route.ts`
**Auth:** User

Get projection metrics and stats.

### `POST /api/admin/projections/rebuild`
**Source:** `src/app/api/admin/projections/rebuild/route.ts`
**Auth:** User

Trigger rebuild of all projections.

---

## AI API

### `POST /api/ai/health-score`
**Source:** `src/app/api/ai/health-score/route.ts`
**Auth:** User

Calculate AI-powered health score for a deal/company.

### `GET /api/ai/signals`
**Source:** `src/app/api/ai/signals/route.ts`
**Auth:** User

List AI signals with filters.

### `POST /api/ai/signals`
Create new AI signal.

### `GET|PATCH|DELETE /api/ai/signals/[id]`
**Source:** `src/app/api/ai/signals/[id]/route.ts`
**Auth:** User

Single signal CRUD operations.

### `GET /api/ai/summaries`
**Source:** `src/app/api/ai/summaries/route.ts`
**Auth:** User

List AI summaries.

### `POST /api/ai/summaries`
Generate new AI summary.

### `GET /api/ai/summaries/[type]/[id]`
**Source:** `src/app/api/ai/summaries/[type]/[id]/route.ts`
**Auth:** User

Get specific AI summary by type and ID.

### `GET /api/ai-activity`
**Source:** `src/app/api/ai-activity/route.ts`
**Auth:** User

AI action audit log feed.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| source | string | Filter by source (scheduler, communications, transcript) |
| status | string | Filter by status (success, skipped, failed) |
| actionType | string | Filter by action type |
| companyId | string | Filter by company |
| since | string | ISO date - after |
| until | string | ISO date - before |
| limit | number | Max 200, default 50 |
| offset | number | Pagination offset |

### `GET|POST /api/ai-prompts`
**Source:** `src/app/api/ai-prompts/route.ts`
**Auth:** User

Prompt template management.

### `GET|PUT|DELETE /api/ai-prompts/[id]`
**Source:** `src/app/api/ai-prompts/[id]/route.ts`
**Auth:** User

Single prompt CRUD.

### `GET /api/ai-prompts/[id]/history`
**Source:** `src/app/api/ai-prompts/[id]/history/route.ts`
**Auth:** User

Prompt version history.

---

## Analytics API

### `GET /api/analytics/whitespace`
**Source:** `src/app/api/analytics/whitespace/route.ts`
**Auth:** None

Whitespace opportunity analysis.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| view | string | 'stats' or 'opportunities' |
| product_id | string | Filter by product |
| min_fit_score | number | Minimum fit score |
| limit | number | Max results |
| sort_by | string | potential_mrr, fit_score, priority |

---

## Attention Flags API

### `GET /api/attention-flags`
**Source:** `src/app/api/attention-flags/route.ts`
**Auth:** None (admin client)

List attention flags.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| company_id | string | Filter by company |
| status | string | Filter by status |
| source_type | string | Filter by source type |

### `POST /api/attention-flags/create`
**Source:** `src/app/api/attention-flags/create/route.ts`
**Auth:** User

Create manual attention flag.

**Request Body:**
```typescript
{
  company_id: string;
  company_product_id?: string;
  flag_type: AttentionFlagType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommended_action: string;
}
```

### `POST /api/attention-flags/[id]/resolve`
**Source:** `src/app/api/attention-flags/[id]/resolve/route.ts`
**Auth:** User

Resolve an attention flag.

### `POST /api/attention-flags/[id]/snooze`
**Source:** `src/app/api/attention-flags/[id]/snooze/route.ts`
**Auth:** User

Snooze an attention flag.

**Request Body:**
```typescript
{
  snooze_until: string; // ISO timestamp
  reason?: string;
}
```

### `POST /api/attention-flags/[id]/unsnooze`
Unsnooze a snoozed flag.

### `POST /api/attention-flags/[id]/execute`
Execute recommended action.

### `POST /api/attention-flags/[id]/send-email`
Send email for flag action.

### `POST /api/attention-flags/[id]/mark-sent`
Mark email as sent.

---

## Auth API

### `GET /api/auth/me`
**Source:** `src/app/api/auth/me/route.ts`
**Auth:** User

Get current authenticated user profile.

**Response:**
```typescript
{
  user: {
    id: string;
    auth_id: string;
    name: string;
    email: string;
    role: string;
  }
}
```

### `GET /api/auth/microsoft`
**Source:** `src/app/api/auth/microsoft/route.ts`
**Auth:** User

Initiate Microsoft OAuth flow.

### `GET /api/auth/microsoft/callback`
**Source:** `src/app/api/auth/microsoft/callback/route.ts`
**Auth:** None (OAuth callback)

Microsoft OAuth callback handler.

---

## Calendar API

### `GET /api/calendar/[meetingId]/prep`
**Source:** `src/app/api/calendar/[meetingId]/prep/route.ts:151`
**Auth:** User
**Lines:** 454

Meeting prep with AI-generated content and attendee intelligence.

**Response:**
```typescript
{
  id: string;
  meeting_id: string;
  title: string;
  start_time: string;
  attendees: MeetingAttendee[];
  prep: {
    objective: string;
    talking_points: string[];
    landmines: string[];
    questions_to_ask: string[];
  };
  prep_materials: PrepMaterial[];
  has_rich_context: boolean;
}
```

---

## Cases API (Support Cases)

### `GET /api/cases`
**Source:** `src/app/api/cases/route.ts:34`
**Auth:** User

List support cases from projection.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| product_id | string | Filter by product |
| company_id | string | Filter by company |
| company_product_id | string | Filter by company product |
| status | string | Comma-separated statuses |
| severity | string | Comma-separated severities |
| owner_id | string | Filter by owner |
| sla_breached | boolean | Filter by SLA breach |
| search | string | Search in title |
| sort | string | Sort field (default: opened_at) |
| order | string | asc/desc |
| limit | number | Default 50 |
| offset | number | Pagination |

### `POST /api/cases`
**Source:** `src/app/api/cases/route.ts:138`
**Auth:** User

Create new support case via command.

**Request Body:**
```typescript
{
  company_id: string;
  company_product_id?: string;
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  subcategory?: string;
  source?: SupportCaseSource;
  external_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
}
```

### `GET /api/cases/[id]`
**Source:** `src/app/api/cases/[id]/route.ts:44`
**Auth:** User

Get single case with company and owner.

### `POST /api/cases/[id]`
**Source:** `src/app/api/cases/[id]/route.ts:94`
**Auth:** User

Execute command on case.

**Request Body:**
```typescript
{
  command: 'assign' | 'change_status' | 'change_severity' |
           'set_next_action' | 'resolve' | 'close' | 'reopen';
  // Command-specific params
}
```

### `GET /api/cases/[id]/timeline`
**Source:** `src/app/api/cases/[id]/timeline/route.ts:23`
**Auth:** User

Get event history from event store.

---

## Command Center API

### `GET /api/command-center`
**Source:** `src/app/api/command-center/route.ts`
**Auth:** User

List command center items.

### `GET|PUT|DELETE /api/command-center/[itemId]`
**Source:** `src/app/api/command-center/[itemId]/route.ts`
**Auth:** User
**Lines:** 672

Single item CRUD with complex context enrichment.

### `POST /api/command-center/[itemId]/snooze`
**Source:** `src/app/api/command-center/[itemId]/snooze/route.ts`
**Auth:** User

Snooze command center item.

### `GET|POST /api/command-center/[itemId]/context`
Get or add context to item.

### `POST /api/command-center/[itemId]/add-context`
Add context note to item.

### `POST /api/command-center/score`
**Source:** `src/app/api/command-center/score/route.ts`
**Auth:** User

Recalculate momentum score.

### `GET|POST /api/command-center/plan`
**Source:** `src/app/api/command-center/plan/route.ts`
**Auth:** User

Daily plan generation.

### `GET /api/command-center/debug`
**Source:** `src/app/api/command-center/debug/route.ts`
**Auth:** User

Calendar debug information.

### `POST|PATCH /api/command-center/extra-credit`
**Source:** `src/app/api/command-center/extra-credit/route.ts`
**Auth:** User

Overflow items for extra time.

### `POST /api/command-center/items/[id]/schedule`
**Source:** `src/app/api/command-center/items/[id]/schedule/route.ts`
**Auth:** User

Schedule meeting from item.

### `POST /api/command-center/items/[id]/generate-email`
**Source:** `src/app/api/command-center/items/[id]/generate-email/route.ts`
**Auth:** User

AI email draft generation.

### `POST /api/command-center/items/[id]/enrich`
**Source:** `src/app/api/command-center/items/[id]/enrich/route.ts`
**Auth:** User

Context enrichment for item.

---

## Communications API

### `GET /api/communications`
**Source:** `src/app/api/communications/route.ts:14`
**Auth:** None (admin client)

List communications with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string | Direct communication ID |
| company_id | string | Filter by company |
| contact_id | string | Filter by contact |
| deal_id | string | Filter by deal |
| sender_email | string | Filter by sender |
| channel | string | Filter by channel |
| direction | string | inbound/outbound |
| awaiting_response | boolean | Awaiting our response |
| ai_only | boolean | AI-generated only |
| limit | number | Default 50 |
| offset | number | Pagination |

### `GET|POST /api/communications/[id]/notes`
**Source:** `src/app/api/communications/[id]/notes/route.ts`
**Auth:** User

Communication notes management.

### `POST /api/communications/[id]/assign`
Assign communication to company.

### `POST /api/communications/[id]/create-lead`
Create lead from communication.

### `POST /api/communications/[id]/draft-reply`
Generate AI draft reply.

### `POST|DELETE /api/communications/[id]/exclude`
**Source:** `src/app/api/communications/[id]/exclude/route.ts`
**Auth:** User

Exclude/restore communication from view.

### `POST /api/communications/[id]/respond`
Send response to communication.

### `POST /api/communications/analyze`
AI analysis of communication.

### `GET /api/communications/conversations`
Grouped conversations view.

### `GET /api/communications/conversations/stats`
Conversation statistics.

### `GET /api/communications/promises`
Extracted promises/commitments.

### `GET /api/communications/response-queue`
Communications awaiting response.

### `POST /api/communications/send-reply`
Send reply via Microsoft Graph.

### `GET /api/communications/source`
Get original email source.

### `GET /api/communications/stats`
Communication statistics.

---

## Companies API

### `GET /api/companies`
**Source:** `src/app/api/companies/route.ts`
**Auth:** User

List companies with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| limit | number | Max 5000 |
| search | string | Search by name |
| status | string | Filter by status |

### `POST /api/companies`
Create new company with duplicate check.

### `GET|PUT|DELETE /api/companies/[id]`
**Source:** `src/app/api/companies/[id]/route.ts`
**Auth:** User

Single company CRUD.

### `GET /api/companies/[id]/contacts`
**Source:** `src/app/api/companies/[id]/contacts/route.ts`
**Auth:** User

List contacts for company.

### `GET|POST /api/companies/[id]/memory`
**Source:** `src/app/api/companies/[id]/memory/route.ts`
**Auth:** User

Company memory notes.

### `GET /api/companies/[id]/products`
Company products list.

### `POST /api/companies/[id]/products/convert`
Convert company product status.

### `GET|POST|DELETE /api/companies/[id]/intelligence`
Company intelligence data.

### `GET|POST /api/companies/[id]/intelligence/notes`
Intelligence notes.

### `POST /api/companies/[id]/intelligence/corrections`
Intelligence corrections.

---

## Contacts API

### `GET /api/contacts`
**Source:** `src/app/api/contacts/route.ts:14`
**Auth:** User

List contacts with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| limit | number | Max 500, default 100 |
| company_id | string | Filter by company |
| search | string | Search by name/email |

### `POST /api/contacts`
**Source:** `src/app/api/contacts/route.ts:75`
**Auth:** User

Create contact with duplicate check.

### `GET|PATCH|DELETE /api/contacts/[id]`
**Source:** `src/app/api/contacts/[id]/route.ts`
**Auth:** User

Single contact CRUD.

### `POST /api/contacts/[id]/enrich`
**Source:** `src/app/api/contacts/[id]/enrich/route.ts`
**Auth:** Admin

Enrich contact with external data.

### `GET|POST|DELETE /api/contacts/[id]/intelligence`
**Source:** `src/app/api/contacts/[id]/intelligence/route.ts`
**Auth:** User

Relationship intelligence facts.

---

## Cron Jobs API

All cron routes use `CRON_SECRET` header validation.

### `GET /api/cron/scheduler`
**Source:** `src/app/api/cron/scheduler/route.ts`
**Schedule:** `* * * * *` (every minute)

Process deferred scheduling responses.

### `GET /api/cron/sync-microsoft`
**Source:** `src/app/api/cron/sync-microsoft/route.ts`
**Schedule:** `*/15 * * * *`

Microsoft 365 email/calendar sync.

### `GET /api/cron/sync-inbox`
**Source:** `src/app/api/cron/sync-inbox/route.ts`
**Schedule:** `*/10 * * * *`

Inbox sync across users.

### `GET /api/cron/sync-communications`
**Source:** `src/app/api/cron/sync-communications/route.ts`
**Schedule:** `2,12,22,32,42,52 * * * *`

Communications table sync.

### `GET /api/cron/sync-fireflies`
**Source:** `src/app/api/cron/sync-fireflies/route.ts`
**Schedule:** `*/30 * * * *`

Fireflies transcript sync.

### `GET /api/cron/generate-daily-plans`
**Source:** `src/app/api/cron/generate-daily-plans/route.ts`
**Schedule:** `0 6 * * *`

Morning plan generation (6 AM).

### `GET /api/cron/calculate-momentum`
**Source:** `src/app/api/cron/calculate-momentum/route.ts`
**Schedule:** `*/15 * * * *`

Momentum score updates.

### `GET /api/cron/sync-command-center`
**Source:** `src/app/api/cron/sync-command-center/route.ts`
**Schedule:** `*/5 * * * *`

Command center item refresh.

### `GET /api/cron/classify-tiers`
**Source:** `src/app/api/cron/classify-tiers/route.ts`
**Schedule:** `*/5 * * * *`

Email tier classification.

### `GET /api/cron/run-pipelines`
**Source:** `src/app/api/cron/run-pipelines/route.ts`
**Schedule:** `*/5 * * * *`

Pipeline processing.

### `GET /api/cron/analyze-emails`
**Source:** `src/app/api/cron/analyze-emails/route.ts`
**Schedule:** `5,20,35,50 * * * *`

AI email analysis batch.

### `GET /api/cron/detect-no-shows`
**Source:** `src/app/api/cron/detect-no-shows/route.ts`
**Schedule:** `10,25,40,55 * * * *`

Meeting no-show detection.

### `GET /api/cron/analyze-communications`
**Source:** `src/app/api/cron/analyze-communications/route.ts`
**Schedule:** `*/15 * * * *`

Communications AI analysis.

### `GET /api/cron/reconcile-actions`
Reconcile action states.

### `GET /api/cron/scan-duplicates`
Scan for duplicate records.

### `GET /api/cron/status`
Cron job status overview.

---

## Daily Driver API

### `GET /api/daily-driver`
**Source:** `src/app/api/daily-driver/route.ts`
**Auth:** User
**Lines:** 694

Daily driver queue with rich context.

---

## Deal Rooms API

### `GET|POST /api/deal-rooms/[dealId]`
**Source:** `src/app/api/deal-rooms/[dealId]/route.ts`
**Auth:** User

Deal room management.

### `GET|POST /api/deal-rooms/[dealId]/assets`
**Source:** `src/app/api/deal-rooms/[dealId]/assets/route.ts`
**Auth:** User

Deal room assets.

### `PATCH|DELETE /api/deal-rooms/[dealId]/assets/[assetId]`
**Source:** `src/app/api/deal-rooms/[dealId]/assets/[assetId]/route.ts`
**Auth:** User

Single asset operations.

---

## Deals API

### `GET|POST /api/deals`
**Source:** `src/app/api/deals/route.ts`
**Auth:** User

Deal listing and creation.

### `POST /api/deals/[id]/convert`
Convert deal status.

### `GET /api/deals/[id]/intelligence`
**Source:** `src/app/api/deals/[id]/intelligence/route.ts`
**Auth:** User

Deal intelligence computation.

### `GET|POST /api/deals/[id]/postmortem`
**Source:** `src/app/api/deals/[id]/postmortem/route.ts`
**Auth:** User

Deal postmortem analysis.

---

## Duplicates API

### `GET /api/duplicates`
**Source:** `src/app/api/duplicates/route.ts`
**Auth:** User

List duplicate groups.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| entityType | string | company, contact, customer |
| status | string | pending, merged, marked_separate |
| confidence | string | exact, high, medium, low |
| groupId | string | Specific group |
| limit | number | Max results |

### `POST /api/duplicates/scan`
**Source:** `src/app/api/duplicates/scan/route.ts`
**Auth:** User

Trigger duplicate scan.

### `POST /api/duplicates/[groupId]/merge`
**Source:** `src/app/api/duplicates/[groupId]/merge/route.ts`
**Auth:** User

Merge duplicates in group.

### `POST /api/duplicates/[groupId]/separate`
**Source:** `src/app/api/duplicates/[groupId]/separate/route.ts`
**Auth:** User

Mark as intentionally separate.

---

## Focus API

### `GET /api/focus/permissions`
Get focus permissions.

### `POST /api/focus/set`
Set focus context.

---

## Inbox API

### `GET /api/inbox/sync`
**Source:** `src/app/api/inbox/sync/route.ts`
**Auth:** User
**Status:** Deprecated

Legacy inbox sync.

### `GET /api/inbox/conversations`
**Source:** `src/app/api/inbox/conversations/route.ts`
**Auth:** User

Email conversations list.

### `GET /api/inbox/conversations/[id]`
**Source:** `src/app/api/inbox/conversations/[id]/route.ts`
**Auth:** User

Single conversation with messages.

### `POST /api/inbox/conversations/[id]/actions`
**Source:** `src/app/api/inbox/conversations/[id]/actions/route.ts`
**Auth:** User

Conversation actions (archive, snooze, link, priority).

### `POST /api/inbox/bulk`
**Source:** `src/app/api/inbox/bulk/route.ts`
**Auth:** User

Bulk email actions.

### `POST /api/inbox/analyze`
**Source:** `src/app/api/inbox/analyze/route.ts`
**Auth:** User

Conversation AI analysis.

### `GET|POST /api/inbox/schedule`
**Source:** `src/app/api/inbox/schedule/route.ts`
**Auth:** User

Scheduling from conversation.

### `GET|POST /api/inbox/drafts`
**Source:** `src/app/api/inbox/drafts/route.ts`
**Auth:** User

Draft management.

---

## Integrations API

### `POST|DELETE /api/integrations/fireflies/connect`
**Source:** `src/app/api/integrations/fireflies/connect/route.ts`
**Auth:** User

Fireflies connect/disconnect.

### `GET /api/integrations/fireflies/status`
**Source:** `src/app/api/integrations/fireflies/status/route.ts`
**Auth:** User

Fireflies connection status.

### `POST /api/integrations/fireflies/sync`
**Source:** `src/app/api/integrations/fireflies/sync/route.ts`
**Auth:** User

Manual Fireflies sync.

### `PATCH /api/integrations/fireflies/settings`
**Source:** `src/app/api/integrations/fireflies/settings/route.ts`
**Auth:** User

Fireflies settings update.

---

## Intelligence API

### `GET|POST /api/intelligence/[companyId]`
**Source:** `src/app/api/intelligence/[companyId]/route.ts`
**Auth:** Admin

Company intelligence data.

### `POST /api/intelligence/[companyId]/refresh`
**Source:** `src/app/api/intelligence/[companyId]/refresh/route.ts`
**Auth:** Admin

Refresh intelligence data.

### `POST /api/intelligence/[companyId]/enrich-company`
**Source:** `src/app/api/intelligence/[companyId]/enrich-company/route.ts`
**Auth:** Admin

Company enrichment.

### `POST /api/intelligence/[companyId]/enrich-contacts`
**Source:** `src/app/api/intelligence/[companyId]/enrich-contacts/route.ts`
**Auth:** Admin

Contacts enrichment.

### `GET /api/intelligence/[companyId]/marketing`
**Source:** `src/app/api/intelligence/[companyId]/marketing/route.ts`
**Auth:** Admin

Marketing intelligence.

### `GET /api/intelligence/status/[companyId]`
**Source:** `src/app/api/intelligence/status/[companyId]/route.ts`
**Auth:** None

Collection progress.

### Intelligence v61 (Agentic Research)

### `POST /api/intelligence-v61/batch`
**Source:** `src/app/api/intelligence-v61/batch/route.ts`
**Auth:** Admin

Batch company intelligence.

### `GET|POST /api/intelligence-v61/[companyId]/strategy`
**Source:** `src/app/api/intelligence-v61/[companyId]/strategy/route.ts`
**Auth:** Admin

Strategic analysis.

### `GET|POST /api/intelligence-v61/[companyId]/research`
**Source:** `src/app/api/intelligence-v61/[companyId]/research/route.ts`
**Auth:** Admin
**Lines:** 253

Agentic research.

### `GET|POST|PATCH /api/intelligence-v61/[companyId]/extract`
**Source:** `src/app/api/intelligence-v61/[companyId]/extract/route.ts`
**Auth:** Admin
**Lines:** 847

Data extraction.

---

## Jobs API

### `POST /api/jobs/ai-autopilot/run`
Run AI autopilot job.

### `POST /api/jobs/generate-stall-flags`
Generate stall attention flags.

---

## Learning API

### `GET /api/learning/calibration`
**Source:** `src/app/api/learning/calibration/route.ts`
**Auth:** Manager+

Trigger calibration stats.

### `GET /api/learning/trust-profiles`
**Source:** `src/app/api/learning/trust-profiles/route.ts`
**Auth:** User/Manager

Trust profiles and leaderboard.

---

## Legacy Deals API

### `GET /api/legacy-deals`
List legacy deals.

### `POST /api/legacy-deals/[id]/close`
Close legacy deal.

### `POST /api/legacy-deals/[id]/re-engage`
Re-engage legacy deal.

### `POST /api/legacy-deals/[id]/snooze`
Snooze legacy deal.

---

## Leverage Moments API

### `GET|POST /api/leverage-moments`
**Source:** `src/app/api/leverage-moments/route.ts`
**Auth:** User

Leverage moments CRUD.

### `GET|PATCH /api/leverage-moments/[id]`
**Source:** `src/app/api/leverage-moments/[id]/route.ts`
**Auth:** User

Single leverage moment.

### `POST /api/leverage-moments/scan`
**Source:** `src/app/api/leverage-moments/scan/route.ts`
**Auth:** User

Scan for leverage moments.

---

## Lifecycle API

### `POST /api/lifecycle/commands`
**Source:** `src/app/api/lifecycle/commands/route.ts`
**Auth:** None
**Lines:** 461

All lifecycle mutations via commands.

**Request Body:**
```typescript
{
  action: 'start-sale' | 'advance-stage' | 'set-phase' |
          'set-owner' | 'set-tier' | 'set-mrr' | 'set-seats' |
          'set-next-step-due' | 'complete-process' |
          'complete-sale-start-onboarding' |
          'complete-onboarding-start-engagement';
  companyProductId: string;
  companyId: string;
  productId: string;
  actorId?: string;
  actorType?: 'user' | 'system' | 'ai';
  // Action-specific params
}
```

---

## Meetings API

### `POST /api/meetings/direct-book`
Direct booking of meeting.

### `GET /api/meetings/transcriptions`
List meeting transcriptions.

### `GET|DELETE /api/meetings/transcriptions/[id]`
**Source:** `src/app/api/meetings/transcriptions/[id]/route.ts`
**Auth:** User

Single transcription.

### `POST /api/meetings/transcriptions/[id]/analyze`
**Source:** `src/app/api/meetings/transcriptions/[id]/analyze/route.ts`
**Auth:** User

Analyze transcription.

### `POST /api/meetings/transcriptions/[id]/create-tasks`
**Source:** `src/app/api/meetings/transcriptions/[id]/create-tasks/route.ts`
**Auth:** User

Create tasks from analysis.

### `POST /api/meetings/transcriptions/[id]/apply-recommendations`
**Source:** `src/app/api/meetings/transcriptions/[id]/apply-recommendations/route.ts`
**Auth:** User

Apply AI recommendations.

### `POST /api/meetings/transcriptions/[id]/draft-followup`
Draft follow-up email.

---

## Microsoft API

### `POST /api/microsoft/send`
**Source:** `src/app/api/microsoft/send/route.ts`
**Auth:** User

Send email via Graph API.

### `DELETE /api/microsoft/disconnect`
**Source:** `src/app/api/microsoft/disconnect/route.ts`
**Auth:** User

Disconnect Microsoft account.

### `POST /api/microsoft/sync`
**Source:** `src/app/api/microsoft/sync/route.ts`
**Auth:** User

Manual Microsoft sync.

---

## Process API

### `GET /api/process/[productSlug]/[processType]`
Get process definition.

### `GET /api/process/[productSlug]/[processType]/workflow`
Get process workflow.

---

## Products API

### `GET /api/products`
**Source:** `src/app/api/products/route.ts`
**Auth:** User

List products with optional modules/stats.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| include_modules | boolean | Include child modules |
| include_stats | boolean | Include stats |
| sellable_only | boolean | Only sellable products |

### `GET /api/products/[slug]`
**Source:** `src/app/api/products/[slug]/route.ts`
**Auth:** User

Single product with pipeline and stats.

### `POST /api/products/[slug]/analyze`
Analyze product performance.

### `GET|POST /api/products/[slug]/stages`
**Source:** `src/app/api/products/[slug]/stages/route.ts`
**Auth:** User

Stage listing and creation.

### `GET|PATCH|DELETE /api/products/[slug]/stages/[stageId]`
**Source:** `src/app/api/products/[slug]/stages/[stageId]/route.ts`
**Auth:** User

Single stage CRUD.

### `POST /api/products/[slug]/stages/reorder`
Reorder stages.

### `POST /api/products/migration/complete`
Complete product migration.

### `POST /api/products/reorder`
Reorder products.

### `POST /api/company-products/[id]/move-stage`
**Source:** `src/app/api/company-products/[id]/move-stage/route.ts`
**Auth:** None

Process stage transition via events.

---

## Public API

### `GET|POST /api/public/rooms/[slug]`
**Source:** `src/app/api/public/rooms/[slug]/route.ts`
**Auth:** None (Public)

Public deal room with view tracking.

---

## Relationships API

### `GET|POST /api/relationships/[contactId]/notes`
Contact relationship notes.

---

## Scheduler API

### `GET|POST /api/scheduler/requests`
**Source:** `src/app/api/scheduler/requests/route.ts`
**Auth:** User

Scheduling request listing and creation.

### `GET|PATCH|DELETE /api/scheduler/requests/[id]`
**Source:** `src/app/api/scheduler/requests/[id]/route.ts`
**Auth:** User

Single request CRUD.

### `POST /api/scheduler/requests/[id]/confirm`
**Source:** `src/app/api/scheduler/requests/[id]/confirm/route.ts`
**Auth:** User

Confirm meeting.

### `GET /api/scheduler/requests/[id]/attendees`
Get attendees.

### `POST /api/scheduler/requests/[id]/book`
Book meeting.

### `GET|POST /api/scheduler/requests/[id]/draft`
Draft email.

### `GET /api/scheduler/requests/[id]/preview`
Preview email.

### `POST /api/scheduler/requests/[id]/send`
Send scheduling email.

### `GET /api/scheduler/dashboard`
**Source:** `src/app/api/scheduler/dashboard/route.ts`
**Auth:** User

Scheduler dashboard data.

### `GET|POST /api/scheduler/automation`
**Source:** `src/app/api/scheduler/automation/route.ts`
**Auth:** User

Automation processor.

### `GET /api/scheduler/analytics`
**Source:** `src/app/api/scheduler/analytics/route.ts`
**Auth:** None

Scheduling funnel metrics.

### `GET|PUT|DELETE /api/scheduler/settings`
**Source:** `src/app/api/scheduler/settings/route.ts`
**Auth:** None

Scheduler settings.

### `GET|POST /api/scheduler/templates`
**Source:** `src/app/api/scheduler/templates/route.ts`
**Auth:** None

Email templates.

### `GET|PUT|DELETE /api/scheduler/templates/[id]`
**Source:** `src/app/api/scheduler/templates/[id]/route.ts`
**Auth:** None

Single template.

### `POST /api/scheduler/no-shows`
**Source:** `src/app/api/scheduler/no-shows/route.ts`
**Auth:** None

No-show detection.

### `GET /api/scheduler/leverage-moments`
**Source:** `src/app/api/scheduler/leverage-moments/route.ts`
**Auth:** Admin

Scheduling leverage moments.

### `POST /api/scheduler/leverage-moments/check`
**Source:** `src/app/api/scheduler/leverage-moments/check/route.ts`
**Auth:** Admin

Check leverage moments.

### `GET|POST /api/scheduler/postmortem`
**Source:** `src/app/api/scheduler/postmortem/route.ts`
**Auth:** None

Scheduling performance report.

### `GET /api/scheduler/seasonality`
**Source:** `src/app/api/scheduler/seasonality/route.ts`
**Auth:** None

Seasonal context.

### `GET|POST /api/scheduler/social-proof`
**Source:** `src/app/api/scheduler/social-proof/route.ts`
**Auth:** None

Social proof for scheduling.

### `GET|POST /api/scheduler/settings/seasonality`
**Source:** `src/app/api/scheduler/settings/seasonality/route.ts`
**Auth:** None

Seasonality settings.

### `GET|POST /api/scheduler/settings/social-proof`
**Source:** `src/app/api/scheduler/settings/social-proof/route.ts`
**Auth:** None

Social proof settings.

### `GET|POST /api/scheduler/webhooks`
**Source:** `src/app/api/scheduler/webhooks/route.ts`
**Auth:** User

Webhook management.

### `GET|PUT|DELETE /api/scheduler/webhooks/[id]`
**Source:** `src/app/api/scheduler/webhooks/[id]/route.ts`
**Auth:** User

Single webhook.

### `POST /api/scheduler/webhooks/[id]/test`
**Source:** `src/app/api/scheduler/webhooks/[id]/test/route.ts`
**Auth:** User

Test webhook.

### `GET /api/scheduler/webhooks/[id]/deliveries`
**Source:** `src/app/api/scheduler/webhooks/[id]/deliveries/route.ts`
**Auth:** User

Webhook delivery history.

### `GET|POST /api/scheduler/api-keys`
**Source:** `src/app/api/scheduler/api-keys/route.ts`
**Auth:** None

API key management.

### `GET|PUT|DELETE /api/scheduler/api-keys/[id]`
**Source:** `src/app/api/scheduler/api-keys/[id]/route.ts`
**Auth:** None

Single API key.

### `POST /api/scheduler/api-keys/[id]/revoke`
**Source:** `src/app/api/scheduler/api-keys/[id]/revoke/route.ts`
**Auth:** None

Revoke API key.

### `GET /api/scheduler/api-keys/[id]/usage`
**Source:** `src/app/api/scheduler/api-keys/[id]/usage/route.ts`
**Auth:** None

API key usage stats.

### `GET /api/scheduler/availability`
Calendar availability.

### `GET /api/scheduler/preview`
Preview scheduling options.

### `POST /api/scheduler/process-responses`
Process scheduling responses.

### `POST /api/scheduler/quick-book`
Quick booking.

### `GET /api/scheduler/users`
Scheduler users.

---

## SMS API

### `POST /api/sms/status`
**Source:** `src/app/api/sms/status/route.ts`
**Auth:** None (Twilio callback)

Twilio SMS status webhook.

### `GET|POST /api/sms/webhook`
**Source:** `src/app/api/sms/webhook/route.ts`
**Auth:** None (Twilio callback)

Twilio incoming SMS webhook. Returns TwiML.

---

## Sync API

### `GET|POST /api/sync/initial-historical`
**Source:** `src/app/api/sync/initial-historical/route.ts`
**Auth:** User

Initial historical sync.

### `GET /api/sync/progress`
Sync progress status.

---

## Tasks API

### `GET|POST /api/tasks`
**Source:** `src/app/api/tasks/route.ts`
**Auth:** User

Task listing and creation.

### `GET|PATCH|DELETE /api/tasks/[taskId]`
**Source:** `src/app/api/tasks/[taskId]/route.ts`
**Auth:** User

Single task CRUD.

### `POST /api/tasks/complete`
**Source:** `src/app/api/tasks/complete/route.ts`
**Auth:** User

Mark task complete.

### `POST /api/tasks/suggest-email`
**Source:** `src/app/api/tasks/suggest-email/route.ts`
**Auth:** User

AI email suggestions.

### `POST /api/tasks/resolve-transcript-review`
Resolve transcript review task.

---

## Track API

### `GET /api/track/open`
**Source:** `src/app/api/track/open/route.ts`
**Auth:** None

Email open tracking pixel (returns 1x1 GIF).

### `GET /api/track/click`
**Source:** `src/app/api/track/click/route.ts`
**Auth:** None

Link click tracking (redirects to destination).

---

## Transcripts API

### `GET|DELETE /api/transcripts`
**Source:** `src/app/api/transcripts/route.ts`
**Auth:** User

Transcript listing and bulk delete.

### `GET /api/transcripts/[id]`
Single transcript.

### `POST /api/transcripts/analyze`
**Source:** `src/app/api/transcripts/analyze/route.ts`
**Auth:** User

Bulk transcript analysis.

---

## Triage API

### `GET|POST /api/triage`
**Source:** `src/app/api/triage/route.ts`
**Auth:** User

Unassigned communications triage.

**GET Response:**
```typescript
{
  items: TriageItem[];
  count: number;
}
```

**POST Body:**
```typescript
{
  communicationId: string;
  companyId?: string;
  action: 'assign' | 'ignore';
}
```

---

## Webhooks API

### `POST /api/webhooks/microsoft`
**Source:** `src/app/api/webhooks/microsoft/route.ts`
**Auth:** Token validation
**Lines:** 396

Microsoft Graph webhook for emails/calendar.

### `POST /api/webhooks/microsoft/subscribe`
**Source:** `src/app/api/webhooks/microsoft/subscribe/route.ts`
**Auth:** User

Create Graph subscriptions.

### `GET|POST /api/webhooks/fireflies`
**Source:** `src/app/api/webhooks/fireflies/route.ts`
**Auth:** None

Fireflies transcript webhook.

---

## Error Responses

All routes follow consistent error response format:

```typescript
{
  error: string;
  details?: string[];
}
```

**Common Status Codes:**
| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing/invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate detected |
| 500 | Internal Server Error |

---

## Lib Module Dependencies

Common lib modules imported by routes:

| Module | Purpose |
|--------|---------|
| `@/lib/supabase/server` | Auth client (createClient) |
| `@/lib/supabase/admin` | Admin client (createAdminClient) |
| `@/lib/ai/core/aiClient` | AI API calls |
| `@/lib/scheduler` | Scheduling logic |
| `@/lib/microsoft/auth` | Microsoft token management |
| `@/lib/lifecycle/commands` | Event sourcing commands |
| `@/lib/lifecycle/projectors` | Projection updates |
| `@/lib/supportCase/commands` | Support case commands |
| `@/lib/duplicates` | Duplicate detection/merge |
| `@/lib/intelligence` | Company intelligence |
| `@/lib/fireflies` | Fireflies integration |
