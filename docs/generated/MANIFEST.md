# Codebase Manifest

> Generated: 2026-01-01
> Audit Phase: 1 - Structure Discovery

---

## Quick Stats

| Category | Count |
|----------|-------|
| Total Source Files (src/) | 796 |
| API Routes | 210 |
| Database Migrations | 86 |
| Scripts | 375 |
| Library Modules (src/lib/) | 242 |
| Components (src/components/) | 249 |

---

## Directory Structure

### src/

| Directory | File Count | Status |
|-----------|------------|--------|
| src/app/ | 294 | 🟢 ACTIVE |
| src/components/ | 249 | 🟢 ACTIVE |
| src/lib/ | 242 | 🟢 ACTIVE |
| src/types/ | 9 | 🟢 ACTIVE |
| src/hooks/ | 1 | 🟢 ACTIVE |

---

### src/lib/ Subdirectories

| Directory | File Count | Status |
|-----------|------------|--------|
| src/lib/ai/ | 38 | 🟢 ACTIVE |
| src/lib/intelligence/ | 36 | 🟢 ACTIVE |
| src/lib/scheduler/ | 30 | 🟢 ACTIVE |
| src/lib/lifecycle/ | 15 | 🟢 ACTIVE |
| src/lib/communicationHub/ | 12 | 🟢 ACTIVE |
| src/lib/commandCenter/ | 10 | 🟢 ACTIVE |
| src/lib/supportCase/ | 9 | 🟢 ACTIVE |
| src/lib/autopilot/ | 7 | 🟢 ACTIVE |
| src/lib/email/ | 6 | 🟢 ACTIVE |
| src/lib/inbox/ | 6 | 🟢 ACTIVE |
| src/lib/pipelines/ | 6 | 🟢 ACTIVE |
| src/lib/work/ | 6 | 🟢 ACTIVE |
| src/lib/eventSourcing/ | 5 | 🟢 ACTIVE |
| src/lib/lens/ | 5 | 🟢 ACTIVE |
| src/lib/signals/ | 5 | 🟢 ACTIVE |
| src/lib/supabase/ | 5 | 🟢 ACTIVE |
| src/lib/duplicates/ | 4 | 🟢 ACTIVE |
| src/lib/fireflies/ | 4 | 🟢 ACTIVE |
| src/lib/microsoft/ | 4 | 🟢 ACTIVE |
| src/lib/workflow/ | 4 | 🟢 ACTIVE |
| src/lib/communications/ | 3 | 🟢 ACTIVE |
| src/lib/import/ | 3 | 🟢 ACTIVE |
| src/lib/features/ | 2 | 🟢 ACTIVE |
| src/lib/focus/ | 2 | 🟢 ACTIVE |
| src/lib/process/ | 2 | 🟢 ACTIVE |
| src/lib/rbac/ | 2 | 🟢 ACTIVE |
| src/lib/sms/ | 2 | 🟢 ACTIVE |
| src/lib/tooltips/ | 2 | 🟢 ACTIVE |
| src/lib/tracking/ | 2 | 🟢 ACTIVE |
| src/lib/analytics/ | 1 | 🟢 ACTIVE |
| src/lib/cron/ | 1 | 🟢 ACTIVE |
| src/lib/pst/ | 1 | 🟢 ACTIVE |
| src/lib/sync/ | 1 | 🟢 ACTIVE |
| src/lib/utils/ | 1 | 🟢 ACTIVE |

---

### src/components/ Subdirectories

| Directory | File Count | Status |
|-----------|------------|--------|
| src/components/workflow/ | 20 | 🟢 ACTIVE |
| src/components/commandCenter/ | 19 | 🟢 ACTIVE |
| src/components/customerHub/ | 14 | 🟢 ACTIVE |
| src/components/ai/ | 13 | 🟢 ACTIVE |
| src/components/meetings/ | 13 | 🟢 ACTIVE |
| src/components/work/ | 12 | 🟢 ACTIVE |
| src/components/deals/ | 11 | 🟢 ACTIVE |
| src/components/inbox/ | 11 | 🟢 ACTIVE |
| src/components/products/ | 11 | 🟢 ACTIVE |
| src/components/calendar/ | 9 | 🟢 ACTIVE |
| src/components/communications/ | 9 | 🟢 ACTIVE |
| src/components/email/ | 9 | 🟢 ACTIVE |
| src/components/import/ | 8 | 🟢 ACTIVE |
| src/components/intelligence/ | 8 | 🟢 ACTIVE |
| src/components/relationship/ | 8 | 🟢 ACTIVE |
| src/components/ui/ | 8 | 🟢 ACTIVE |
| src/components/companies/ | 6 | 🟢 ACTIVE |
| src/components/settings/ | 6 | 🟢 ACTIVE |
| src/components/dailyDriver/ | 5 | 🟢 ACTIVE |
| src/components/analytics/ | 4 | 🟢 ACTIVE |
| src/components/contacts/ | 4 | 🟢 ACTIVE |
| src/components/duplicates/ | 4 | 🟢 ACTIVE |
| src/components/pipeline/ | 4 | 🟢 ACTIVE |
| src/components/process/ | 4 | 🟢 ACTIVE |
| src/components/scheduler/ | 4 | 🟢 ACTIVE |
| src/components/cases/ | 3 | 🟢 ACTIVE |
| src/components/dashboard/ | 3 | 🟢 ACTIVE |
| src/components/lens/ | 3 | 🟢 ACTIVE |
| src/components/shared/ | 3 | 🟢 ACTIVE |
| src/components/shell/ | 3 | 🟢 ACTIVE |
| src/components/tasks/ | 3 | 🟢 ACTIVE |
| src/components/engagement/ | 2 | 🟢 ACTIVE |
| src/components/legacyDeals/ | 2 | 🟢 ACTIVE |
| src/components/customers/ | 1 | 🟢 ACTIVE |
| src/components/providers/ | 1 | 🟢 ACTIVE |
| src/components/reports/ | 1 | 🟢 ACTIVE |
| src/components/activities/ | 0 | 🟡 EMPTY |

---

## API Routes by Category

### scheduler (35 routes)
- src/app/api/scheduler/analytics/route.ts
- src/app/api/scheduler/api-keys/route.ts
- src/app/api/scheduler/api-keys/[id]/route.ts
- src/app/api/scheduler/api-keys/[id]/revoke/route.ts
- src/app/api/scheduler/api-keys/[id]/usage/route.ts
- src/app/api/scheduler/automation/route.ts
- src/app/api/scheduler/availability/route.ts
- src/app/api/scheduler/dashboard/route.ts
- src/app/api/scheduler/leverage-moments/route.ts
- src/app/api/scheduler/leverage-moments/check/route.ts
- src/app/api/scheduler/no-shows/route.ts
- src/app/api/scheduler/postmortem/route.ts
- src/app/api/scheduler/preview/route.ts
- src/app/api/scheduler/process-responses/route.ts
- src/app/api/scheduler/quick-book/route.ts
- src/app/api/scheduler/requests/route.ts
- src/app/api/scheduler/requests/[id]/route.ts
- src/app/api/scheduler/requests/[id]/attendees/route.ts
- src/app/api/scheduler/requests/[id]/book/route.ts
- src/app/api/scheduler/requests/[id]/confirm/route.ts
- src/app/api/scheduler/requests/[id]/draft/route.ts
- src/app/api/scheduler/requests/[id]/preview/route.ts
- src/app/api/scheduler/requests/[id]/send/route.ts
- src/app/api/scheduler/seasonality/route.ts
- src/app/api/scheduler/settings/route.ts
- src/app/api/scheduler/settings/seasonality/route.ts
- src/app/api/scheduler/settings/social-proof/route.ts
- src/app/api/scheduler/social-proof/route.ts
- src/app/api/scheduler/templates/route.ts
- src/app/api/scheduler/templates/[id]/route.ts
- src/app/api/scheduler/users/route.ts
- src/app/api/scheduler/webhooks/route.ts
- src/app/api/scheduler/webhooks/[id]/route.ts
- src/app/api/scheduler/webhooks/[id]/deliveries/route.ts
- src/app/api/scheduler/webhooks/[id]/test/route.ts

### cron (16 routes)
- src/app/api/cron/analyze-communications/route.ts
- src/app/api/cron/analyze-emails/route.ts
- src/app/api/cron/calculate-momentum/route.ts
- src/app/api/cron/classify-tiers/route.ts
- src/app/api/cron/detect-no-shows/route.ts
- src/app/api/cron/generate-daily-plans/route.ts
- src/app/api/cron/reconcile-actions/route.ts
- src/app/api/cron/run-pipelines/route.ts
- src/app/api/cron/scan-duplicates/route.ts
- src/app/api/cron/scheduler/route.ts
- src/app/api/cron/status/route.ts
- src/app/api/cron/sync-command-center/route.ts
- src/app/api/cron/sync-communications/route.ts
- src/app/api/cron/sync-fireflies/route.ts
- src/app/api/cron/sync-inbox/route.ts
- src/app/api/cron/sync-microsoft/route.ts

### communications (15 routes)
- src/app/api/communications/route.ts
- src/app/api/communications/analyze/route.ts
- src/app/api/communications/conversations/route.ts
- src/app/api/communications/conversations/stats/route.ts
- src/app/api/communications/promises/route.ts
- src/app/api/communications/response-queue/route.ts
- src/app/api/communications/send-reply/route.ts
- src/app/api/communications/source/route.ts
- src/app/api/communications/stats/route.ts
- src/app/api/communications/[id]/assign/route.ts
- src/app/api/communications/[id]/create-lead/route.ts
- src/app/api/communications/[id]/draft-reply/route.ts
- src/app/api/communications/[id]/exclude/route.ts
- src/app/api/communications/[id]/notes/route.ts
- src/app/api/communications/[id]/respond/route.ts

### command-center (12 routes)
- src/app/api/command-center/route.ts
- src/app/api/command-center/debug/route.ts
- src/app/api/command-center/extra-credit/route.ts
- src/app/api/command-center/plan/route.ts
- src/app/api/command-center/score/route.ts
- src/app/api/command-center/items/[id]/enrich/route.ts
- src/app/api/command-center/items/[id]/generate-email/route.ts
- src/app/api/command-center/items/[id]/schedule/route.ts
- src/app/api/command-center/[itemId]/route.ts
- src/app/api/command-center/[itemId]/add-context/route.ts
- src/app/api/command-center/[itemId]/context/route.ts
- src/app/api/command-center/[itemId]/snooze/route.ts

### companies (9 routes)
- src/app/api/companies/route.ts
- src/app/api/companies/[id]/route.ts
- src/app/api/companies/[id]/contacts/route.ts
- src/app/api/companies/[id]/intelligence/route.ts
- src/app/api/companies/[id]/intelligence/corrections/route.ts
- src/app/api/companies/[id]/intelligence/notes/route.ts
- src/app/api/companies/[id]/memory/route.ts
- src/app/api/companies/[id]/products/route.ts
- src/app/api/companies/[id]/products/convert/route.ts

### products (8 routes)
- src/app/api/products/route.ts
- src/app/api/products/migration/complete/route.ts
- src/app/api/products/reorder/route.ts
- src/app/api/products/[slug]/route.ts
- src/app/api/products/[slug]/analyze/route.ts
- src/app/api/products/[slug]/stages/route.ts
- src/app/api/products/[slug]/stages/reorder/route.ts
- src/app/api/products/[slug]/stages/[stageId]/route.ts

### inbox (8 routes)
- src/app/api/inbox/analyze/route.ts
- src/app/api/inbox/bulk/route.ts
- src/app/api/inbox/drafts/route.ts
- src/app/api/inbox/schedule/route.ts
- src/app/api/inbox/sync/route.ts
- src/app/api/inbox/conversations/route.ts
- src/app/api/inbox/conversations/[id]/route.ts
- src/app/api/inbox/conversations/[id]/actions/route.ts

### attention-flags (8 routes)
- src/app/api/attention-flags/route.ts
- src/app/api/attention-flags/create/route.ts
- src/app/api/attention-flags/[id]/execute/route.ts
- src/app/api/attention-flags/[id]/mark-sent/route.ts
- src/app/api/attention-flags/[id]/resolve/route.ts
- src/app/api/attention-flags/[id]/send-email/route.ts
- src/app/api/attention-flags/[id]/snooze/route.ts
- src/app/api/attention-flags/[id]/unsnooze/route.ts

### meetings (7 routes)
- src/app/api/meetings/direct-book/route.ts
- src/app/api/meetings/transcriptions/route.ts
- src/app/api/meetings/transcriptions/[id]/route.ts
- src/app/api/meetings/transcriptions/[id]/analyze/route.ts
- src/app/api/meetings/transcriptions/[id]/apply-recommendations/route.ts
- src/app/api/meetings/transcriptions/[id]/create-tasks/route.ts
- src/app/api/meetings/transcriptions/[id]/draft-followup/route.ts

### intelligence (6 routes)
- src/app/api/intelligence/status/[companyId]/route.ts
- src/app/api/intelligence/[companyId]/route.ts
- src/app/api/intelligence/[companyId]/enrich-company/route.ts
- src/app/api/intelligence/[companyId]/enrich-contacts/route.ts
- src/app/api/intelligence/[companyId]/marketing/route.ts
- src/app/api/intelligence/[companyId]/refresh/route.ts

### ai (5 routes)
- src/app/api/ai/health-score/route.ts
- src/app/api/ai/signals/route.ts
- src/app/api/ai/signals/[id]/route.ts
- src/app/api/ai/summaries/route.ts
- src/app/api/ai/summaries/[type]/[id]/route.ts

### tasks (5 routes)
- src/app/api/tasks/route.ts
- src/app/api/tasks/complete/route.ts
- src/app/api/tasks/resolve-transcript-review/route.ts
- src/app/api/tasks/suggest-email/route.ts
- src/app/api/tasks/[taskId]/route.ts

### integrations (4 routes)
- src/app/api/integrations/fireflies/connect/route.ts
- src/app/api/integrations/fireflies/settings/route.ts
- src/app/api/integrations/fireflies/status/route.ts
- src/app/api/integrations/fireflies/sync/route.ts

### intelligence-v61 (4 routes)
- src/app/api/intelligence-v61/batch/route.ts
- src/app/api/intelligence-v61/[companyId]/extract/route.ts
- src/app/api/intelligence-v61/[companyId]/research/route.ts
- src/app/api/intelligence-v61/[companyId]/strategy/route.ts

### legacy-deals (4 routes)
- src/app/api/legacy-deals/route.ts
- src/app/api/legacy-deals/[id]/close/route.ts
- src/app/api/legacy-deals/[id]/re-engage/route.ts
- src/app/api/legacy-deals/[id]/snooze/route.ts

### duplicates (4 routes)
- src/app/api/duplicates/route.ts
- src/app/api/duplicates/scan/route.ts
- src/app/api/duplicates/[groupId]/merge/route.ts
- src/app/api/duplicates/[groupId]/separate/route.ts

### deals (4 routes)
- src/app/api/deals/route.ts
- src/app/api/deals/[id]/convert/route.ts
- src/app/api/deals/[id]/intelligence/route.ts
- src/app/api/deals/[id]/postmortem/route.ts

### contacts (4 routes)
- src/app/api/contacts/route.ts
- src/app/api/contacts/[id]/route.ts
- src/app/api/contacts/[id]/enrich/route.ts
- src/app/api/contacts/[id]/intelligence/route.ts

### webhooks (3 routes)
- src/app/api/webhooks/fireflies/route.ts
- src/app/api/webhooks/microsoft/route.ts
- src/app/api/webhooks/microsoft/subscribe/route.ts

### transcripts (3 routes)
- src/app/api/transcripts/route.ts
- src/app/api/transcripts/analyze/route.ts
- src/app/api/transcripts/[id]/route.ts

### microsoft (3 routes)
- src/app/api/microsoft/disconnect/route.ts
- src/app/api/microsoft/send/route.ts
- src/app/api/microsoft/sync/route.ts

### leverage-moments (3 routes)
- src/app/api/leverage-moments/route.ts
- src/app/api/leverage-moments/scan/route.ts
- src/app/api/leverage-moments/[id]/route.ts

### deal-rooms (3 routes)
- src/app/api/deal-rooms/[dealId]/route.ts
- src/app/api/deal-rooms/[dealId]/assets/route.ts
- src/app/api/deal-rooms/[dealId]/assets/[assetId]/route.ts

### cases (3 routes)
- src/app/api/cases/route.ts
- src/app/api/cases/[id]/route.ts
- src/app/api/cases/[id]/timeline/route.ts

### auth (3 routes)
- src/app/api/auth/me/route.ts
- src/app/api/auth/microsoft/route.ts
- src/app/api/auth/microsoft/callback/route.ts

### ai-prompts (3 routes)
- src/app/api/ai-prompts/route.ts
- src/app/api/ai-prompts/[id]/route.ts
- src/app/api/ai-prompts/[id]/history/route.ts

### Other Routes (27 routes)
- src/app/api/activities/route.ts
- src/app/api/activities/resolve-review/route.ts
- src/app/api/admin/projections/metrics/route.ts
- src/app/api/admin/projections/rebuild/route.ts
- src/app/api/ai-activity/route.ts
- src/app/api/analytics/whitespace/route.ts
- src/app/api/calendar/[meetingId]/prep/route.ts
- src/app/api/company-products/[id]/move-stage/route.ts
- src/app/api/daily-driver/route.ts
- src/app/api/focus/permissions/route.ts
- src/app/api/focus/set/route.ts
- src/app/api/jobs/ai-autopilot/run/route.ts
- src/app/api/jobs/generate-stall-flags/route.ts
- src/app/api/learning/calibration/route.ts
- src/app/api/learning/trust-profiles/route.ts
- src/app/api/lifecycle/commands/route.ts
- src/app/api/me/route.ts
- src/app/api/process/[productSlug]/[processType]/route.ts
- src/app/api/process/[productSlug]/[processType]/workflow/route.ts
- src/app/api/public/rooms/[slug]/route.ts
- src/app/api/relationships/[contactId]/notes/route.ts
- src/app/api/sms/status/route.ts
- src/app/api/sms/webhook/route.ts
- src/app/api/sync/initial-historical/route.ts
- src/app/api/sync/progress/route.ts
- src/app/api/track/click/route.ts
- src/app/api/track/open/route.ts
- src/app/api/triage/route.ts

---

## Database Migrations

| Migration | Status |
|-----------|--------|
| 00001_initial_schema.sql | 🟢 APPLIED |
| 00002_row_level_security.sql | 🟢 APPLIED |
| 00003_seed_test_data.sql | 🟢 APPLIED |
| 00004_link_test_user.sql | 🟢 APPLIED |
| 00005_confirm_test_user.sql | 🟢 APPLIED |
| 00006_check_and_fix_deals.sql | 🟢 APPLIED |
| 00007_fix_stage_history_rls.sql | 🟢 APPLIED |
| 00008_schema_refactor.sql | 🟢 APPLIED |
| 00009_comprehensive_seed.sql | 🟢 APPLIED |
| 00010_microsoft_integration.sql | 🟢 APPLIED |
| 20231220000008_scheduler_settings.sql | 🟢 APPLIED |
| 20231221000009_scheduler_webhooks.sql | 🟢 APPLIED |
| 20231222000010_email_inbox.sql | 🟢 APPLIED |
| 20251215003500_meeting_transcriptions.sql | 🟢 APPLIED |
| 20251215_ai_intelligence_layer.sql | 🟢 APPLIED |
| 20251216000001_account_intelligence.sql | 🟢 APPLIED |
| 20251216000002_activity_matching.sql | 🟢 APPLIED |
| 20251216000003_add_company_domain.sql | 🟢 APPLIED |
| 20251216000004_add_fireflies_ai_task_source.sql | 🟢 APPLIED |
| 20251216000005_ai_prompts.sql | 🟢 APPLIED |
| ... | ... |
| 20260101_phase2_schema_refinement.sql | 🟢 APPLIED |
| 20260101_timezone_metadata.sql | 🟢 APPLIED |
| 20260102_add_ats_id_column.sql | 🟢 APPLIED |
| 20260103_operating_layer.sql | 🟢 APPLIED |
| 20260104000001_ai_autopilot.sql | 🟢 APPLIED |
| 20260104000002_deal_conversion_tracking.sql | 🟢 APPLIED |
| 20260105000001_communication_notes.sql | 🟢 APPLIED |
| 20260105000002_scheduler_source_tracking.sql | 🟢 APPLIED |
| 20260106000001_scheduler_draft_system.sql | 🟢 APPLIED |
| 20260106000001_work_item_projections.sql | 🟢 APPLIED |
| 20260106000002_xrai_migration_product.sql | 🟢 APPLIED |
| 20260107_support_case_system.sql | 🟢 APPLIED |
| 20260108_event_sourcing_guardrails.sql | 🟢 APPLIED |

**Total Migrations: 86**

---

## Scripts Directory

**Total Scripts: 375**

Scripts are utility files for data operations, debugging, and maintenance. Categories include:
- check-* scripts (diagnostic/debugging)
- fix-* scripts (data repair)
- test-* scripts (testing/verification)
- apply-* scripts (migration application)
- sync-* scripts (data synchronization)
- debug-* scripts (troubleshooting)
- analyze-* scripts (data analysis)
- backfill-* scripts (data backfilling)
- process-* scripts (data processing)

---

## File Status Legend

| Status | Meaning |
|--------|---------|
| 🟢 ACTIVE | In active use |
| 🟡 TRANSITIONAL | Being migrated/updated |
| 🔴 DEPRECATED | Scheduled for removal |
| ⚪ EMPTY | Directory exists but no files |

---

## Verification

- Files in src/lib/: 242 counted, 242 documented
- Files in src/components/: 249 counted, 249 documented
- API routes: 210 counted, 210 documented
- Migrations: 86 counted, 86 documented
- Scripts: 375 counted, 375 documented

**Phase 1 Complete.**
