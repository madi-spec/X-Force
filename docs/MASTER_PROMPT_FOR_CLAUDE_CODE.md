# MASTER PROMPT - Products Process Views

Copy and paste this entire prompt into Claude Code to begin implementation.

---

## Project: Products Process Views Implementation

Implement the Products Process Views feature following the implementation guide at `docs/PRODUCTS_PROCESS_VIEWS_IMPLEMENTATION.md`.

## Critical Instructions

1. **Read the implementation guide first** - Before writing any code, read the entire `docs/PRODUCTS_PROCESS_VIEWS_IMPLEMENTATION.md` file to understand the full scope.

2. **Read the design mockup** - Open and study `docs/designs/products-pipeline-redesign/mockup-v5-minimal.html` to understand the exact visual design.

3. **Follow design system exactly** - Read `CLAUDE.md` for project conventions. Key rules:
   - Light mode only (NO dark: prefixes)
   - Minimal color (white/gray backgrounds, tiny status indicators only)
   - Use exact color values from the guide

4. **Execute phases in order** - Complete all 8 phases sequentially:
   - Phase 1: Database Schema & Types
   - Phase 2: API Routes
   - Phase 3: Process Tabs & Header
   - Phase 4: Filter Components
   - Phase 5: Kanban View
   - Phase 6: Side Panel
   - Phase 7: Stage Move Modal
   - Phase 8: Integration & Polish

5. **Test each phase before proceeding** - Use available tools:
   - **Playwright MCP**: Screenshot UI changes, verify layouts, test interactions
   - **Postgres MCP**: Query database, verify schema, validate data
   - **GitHub MCP**: Commit after each successful phase

6. **Debug until working** - If tests fail, fix issues before moving to next phase

7. **Announce progress** - After completing each phase, say "PHASE X COMPLETE - PHASE X+1 STARTING"

## Execution Pattern

For each phase:
1. Read phase requirements from the implementation guide
2. Execute all tasks
3. Run all specified tests
4. Fix any issues found
5. Verify completion checklist
6. Commit with the specified message
7. Announce completion and start next phase

## Begin

Start by reading the implementation guide:
```
cat docs/PRODUCTS_PROCESS_VIEWS_IMPLEMENTATION.md
```

Then read the mockup to understand the design.

Say "PHASE 1 STARTING" and begin implementation.

Work autonomously through all 8 phases. No intervention needed until you say "IMPLEMENTATION COMPLETE".
