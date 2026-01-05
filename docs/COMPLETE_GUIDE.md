# Products Process Views - Complete Implementation Guide

## Quick Start

Copy the **Master Prompt** below into Claude Code to begin. Claude Code will work autonomously through all 8 phases.

---

# MASTER PROMPT

```
# PROJECT: Products Process Views Implementation

## CONTEXT
You are implementing a new "Products Process Views" feature for the X-FORCE CRM platform. This feature replaces the current Products page with a process-centric view that allows users to manage Sales, Onboarding, Customer Service, and Customer Engagement processes across multiple products.

## CRITICAL EXECUTION RULES

### Autonomous Execution
1. **Work through all phases sequentially** - Do not skip phases
2. **Complete each phase fully** - All tasks, all tests, all fixes
3. **Test everything visually** - Use Playwright MCP to verify UI
4. **Verify data** - Use Postgres MCP to validate queries
5. **Debug until working** - If tests fail, fix before proceeding
6. **Commit after each phase** - Use git to save progress

### Design System Compliance (CRITICAL)
Follow these rules from CLAUDE.md exactly:
- **Light mode only** - NO dark: prefixes in Tailwind classes
- **Minimal color** - White/gray backgrounds, color only for small status indicators
- **Colors**: bg=#f6f8fb, panel=#ffffff, text=#0b1220, muted=#667085, border=#e6eaf0
- **Status colors**: good=#22c55e, warn=#f59e0b, bad=#ef4444, primary=#3b82f6
- **Typography** - System font stack, text-sm default (14px)
- **Spacing** - 4-8 point grid (p-2, p-4, p-6, gap-4)
- **Cards** - bg-white rounded-xl border border-[#e6eaf0] shadow-sm
- **No zebra striping** - Tables use border-b only

### MCP Server Usage
You MUST use these tools throughout implementation:
- **Playwright MCP**: Screenshot UI after changes, verify layouts, test interactions
- **Postgres MCP**: Query database to verify schema, test queries, validate data
- **GitHub MCP**: Commit code after each successful phase

## REFERENCE FILES

Before starting, read these files:
1. `/mnt/user-data/outputs/products-pipeline-redesign/mockup-v5-minimal.html` - Approved UI design
2. `/mnt/user-data/outputs/products-pipeline-redesign/DESIGN_SPEC_V3.md` - Full specification
3. `CLAUDE.md` - Project conventions and design system
4. `src/app/globals.css` - CSS variables and design tokens

Study the mockup carefully - it shows the exact visual design to implement.

## PHASES OVERVIEW

| Phase | Focus | Est. Time |
|-------|-------|-----------|
| 1 | Database Schema & Types | 1-2 hours |
| 2 | API Routes | 2-3 hours |
| 3 | Process Tabs & Header | 2-3 hours |
| 4 | Filter Components | 2-3 hours |
| 5 | Kanban View | 2-3 hours |
| 6 | Side Panel | 2-3 hours |
| 7 | Stage Move Modal | 1-2 hours |
| 8 | Integration & Polish | 2-3 hours |

Total: 14-22 hours

## PHASE EXECUTION PATTERN

For EACH phase, follow this pattern:

1. **Read phase requirements** - Understand all tasks
2. **Execute tasks** - Create files, write code
3. **Run tests** - Use Playwright/Postgres MCP to verify
4. **Debug if needed** - Fix any issues found
5. **Verify completion** - Check all items in checklist
6. **Commit** - Save progress with descriptive message
7. **Announce completion** - Say "PHASE X COMPLETE"
8. **Start next phase** - Say "PHASE X+1 STARTING"

## BEGIN

Start with Phase 1. Read the full phase instructions below, then execute.

Say "PHASE 1 STARTING" and begin implementation.

---

## PHASE 1: Database Schema & Types

### Tasks

1.1 **Explore Existing Schema** (Postgres MCP)
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%product%';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_products';
```

1.2 **Create Migration** (`supabase/migrations/[timestamp]_add_process_views.sql`)
- Add `last_activity_at`, `last_stage_moved_at` to company_products if not exist
- Create `product_pipeline_items` view with health calculation
- Add indexes for process queries

1.3 **Create Types** (`src/types/products.ts`)
- ProcessType, HealthStatus, ViewMode
- PipelineItem, ProcessStats, ProcessFilters
- PROCESSES constant with definitions

1.4 **Run Migration**: `npx supabase db push`

### Tests
- Query `product_pipeline_items` view via Postgres MCP
- Verify health_status calculation works
- Run `npx tsc --noEmit` for type checking

### Commit Message
```
feat(products): add database schema and types for process views
```

---

## PHASE 2: API Routes

### Tasks

2.1 **Create `/api/products/process/route.ts`**
- GET endpoint for pipeline items
- Filter by process, products, users, health, search
- Return items, stats, stages

2.2 **Create `/api/products/process/stats/route.ts`**
- GET endpoint for tab counts
- Return total and needsAttention for each process

2.3 **Create `/api/products/process/move-stage/route.ts`**
- POST endpoint for stage transitions
- Require item_id, to_stage_id, note (min 10 chars)
- Update stage, log activity

2.4 **Create `/api/products/list/route.ts`**
- GET endpoint for products dropdown

2.5 **Create `/api/products/users/route.ts`**
- GET endpoint for users dropdown

### Tests
- curl each endpoint and verify response
- Test with filters applied
- Verify error handling

### Commit Message
```
feat(products): add API routes for process views
```

---

## PHASE 3: Process Tabs & Header

### Tasks

3.1 **Create Page** (`src/app/(dashboard)/products/process/page.tsx`)
- Server component with Suspense

3.2 **Create Container** (`src/components/products/ProcessViewContainer.tsx`)
- URL state management with useSearchParams
- Fetch data, manage filters, handle interactions

3.3 **Create ProcessTabs** (`src/components/products/ProcessTabs.tsx`)
- Four tabs with icons, counts, attention indicators

3.4 **Create ProcessHeader** (`src/components/products/ProcessHeader.tsx`)
- Title, description, stats grid

3.5 **Create ProcessViewSkeleton** for loading state

### Tests (Playwright MCP)
- Navigate to page, verify renders
- Click tabs, verify URL changes
- Verify stats display

### Commit Message
```
feat(products): add process tabs and header components
```

---

## PHASE 4: Filter Components

### Tasks

4.1 **Create ProcessFilters** (`src/components/products/ProcessFilters.tsx`)
- User multi-select dropdown
- Product multi-select dropdown
- Health select
- Search input with debounce
- Quick filter button

4.2 **Create ProcessViewControls** (`src/components/products/ProcessViewControls.tsx`)
- View mode tabs (All Items, By Stage, By Company)
- Display toggle (Kanban/List)

### Tests (Playwright MCP)
- Open dropdowns, select items
- Verify URL updates
- Test search debounce
- Test quick filter toggle

### Commit Message
```
feat(products): add filter components
```

---

## PHASE 5: Kanban View

### Tasks

5.1 **Create ProcessKanban** (`src/components/products/ProcessKanban.tsx`)
- Three columns: Needs Attention, Stalled, On Track
- Group items by health_status

5.2 **Create ProcessCard** (`src/components/products/ProcessCard.tsx`)
- Company name, product badge, stage
- Health indicator, days, MRR, owner avatar
- Minimal design (white background, subtle border)

5.3 **Create ProcessEmptyState** for no results

### Tests (Playwright MCP)
- Verify 3 columns render
- Verify cards grouped correctly
- Test filter affects cards
- Test empty state

### Commit Message
```
feat(products): add kanban view components
```

---

## PHASE 6: Side Panel

### Tasks

6.1 **Create ProcessSidePanel** (`src/components/products/ProcessSidePanel.tsx`)
- Slide-in panel (480px width)
- Header with company name, product, stage
- Health alert banner
- Stats grid (days, MRR, owner)
- Quick actions (stage-specific)
- Stage selector buttons
- Assignment dropdown
- Footer actions

6.2 **Add slide animation** to globals.css

### Tests (Playwright MCP)
- Card click opens panel
- Panel shows correct data
- Close via X, Escape, backdrop

### Commit Message
```
feat(products): add side panel component
```

---

## PHASE 7: Stage Move Modal

### Tasks

7.1 **Create StageMoveModal** (`src/components/products/StageMoveModal.tsx`)
- Modal overlay
- From stage → To stage display
- Required note textarea (min 10 chars)
- Validation and error display
- Loading state during submit

7.2 **Wire up to container**
- handleStageMove triggers modal
- handleStageMoveConfirm calls API
- Refresh data on success

### Tests (Playwright MCP)
- Stage click opens modal
- Empty note shows error
- Short note shows error
- Valid submission closes modal
- Data refreshes

### Commit Message
```
feat(products): add stage move modal with validation
```

---

## PHASE 8: Integration & Polish

### Tasks

8.1 **Full Integration Test** (Playwright MCP)
- Complete user journey through all features

8.2 **Fix Identified Issues**
- Loading state flicker
- URL state sync
- Body scroll lock

8.3 **Add Error Boundary**

8.4 **Performance Optimization**
- React.memo on ProcessCard, KanbanColumn

8.5 **Accessibility Improvements**
- role="button", tabIndex, aria-labels

8.6 **Final Visual Review**
- Screenshot all states
- Compare with mockup

### Tests
- Full journey test passes
- No console errors
- Page load under 3s
- All accessibility checks pass

### Commit Message
```
feat(products): complete process views implementation
```

---

## COMPLETION

After Phase 8, verify:
- [ ] All phases committed
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass

Say "IMPLEMENTATION COMPLETE" when finished.
```

---

## File Locations Reference

| File Type | Location |
|-----------|----------|
| Page | `src/app/(dashboard)/products/process/page.tsx` |
| Components | `src/components/products/*.tsx` |
| API Routes | `src/app/api/products/**/*.ts` |
| Types | `src/types/products.ts` |
| Migration | `supabase/migrations/[timestamp]_add_process_views.sql` |
| Styles | `src/app/globals.css` |

---

## Troubleshooting

### If Playwright MCP not available:
- Manually test in browser at localhost:3000
- Take screenshots using browser dev tools

### If Postgres MCP not available:
- Use Supabase dashboard to run queries
- Check table explorer for schema

### If build fails:
- Run `npx tsc --noEmit` for type errors
- Check for missing imports
- Verify all files saved

### If API returns 500:
- Check server logs for error details
- Test query in Postgres MCP
- Verify Supabase client setup

---

## Success Metrics

The implementation is successful when:
1. User can switch between 4 process tabs
2. User can filter by users, products, health, search
3. Cards display in health-based columns
4. Clicking a card opens the side panel
5. Clicking a stage opens the move modal
6. Stage move requires a note
7. Data refreshes after changes
8. URL state enables sharing/bookmarking
9. Design matches the minimal, professional mockup
