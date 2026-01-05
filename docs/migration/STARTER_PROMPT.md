# Claude Code Starter Prompt

Copy everything below this line and paste it into Claude Code to start the migration:

---

## Migration Task: Deal to Product Architecture

You are about to execute a comprehensive 6-phase migration of X-FORCE CRM from a deal-centric to product-centric architecture. This migration has been fully documented and you will work through it autonomously.

### Your Mission

1. Read the master orchestration document at `docs/migration/MIGRATION_MASTER.md`
2. Check current progress in `docs/migration/MIGRATION_CHECKLIST.md`
3. Execute each phase in order, following all steps precisely
4. Use MCP servers (Postgres, Playwright, GitHub) to verify your work
5. Update the checklist after each phase
6. Commit changes at each phase checkpoint
7. Continue until all 6 phases are complete

### Critical Rules

1. **Never skip verification steps** - Use Postgres MCP to verify database changes, Playwright MCP to verify UI changes
2. **Fix issues immediately** - If something breaks, fix it before continuing
3. **Update checklist** - After each phase, update `docs/migration/MIGRATION_CHECKLIST.md`
4. **Commit at checkpoints** - Each phase ends with a git commit
5. **Maintain backwards compatibility** - Keep deal_id support, add company_product_id alongside

### MCP Servers Available

- **Postgres MCP**: Query database directly for verification
- **Playwright MCP**: Take screenshots, test UI, verify visual changes
- **GitHub MCP**: Commit changes at checkpoints

### Start Now

Begin by reading the master document:

```bash
cat docs/migration/MIGRATION_MASTER.md
```

Then check current progress:

```bash
cat docs/migration/MIGRATION_CHECKLIST.md
```

If starting fresh, proceed to Phase 1:

```bash
cat docs/migration/PHASE_1_DATABASE.md
```

Work through each phase completely before moving to the next. Do not stop until all 6 phases are complete and verified.

### Phase Documents Location

```
docs/migration/
├── MIGRATION_MASTER.md      ← Read this first
├── MIGRATION_CHECKLIST.md   ← Track progress here
├── PHASE_1_DATABASE.md      ← Database schema
├── PHASE_2_SCHEDULER.md     ← Scheduler system
├── PHASE_3_COMMAND_CENTER.md ← Command center
├── PHASE_4_ACTIVITIES.md    ← Activities, tasks, transcriptions
├── PHASE_5_UI_NAVIGATION.md ← UI and navigation
└── PHASE_6_CLEANUP.md       ← Final cleanup
```

**BEGIN MIGRATION NOW.**
