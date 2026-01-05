# Performance Audit - Claude Code Instructions

> Add this section to your project's CLAUDE.md file

---

## Performance Audit Commands

### Full Performance Audit

When user says: "Run performance audit" or "Why is the app slow?" or "Optimize performance"

**Behavior:**
1. Read `/docs/skills/performance-audit/SKILL.md`
2. Read `/docs/skills/performance-audit/TEMPLATES.md`
3. Execute all 5 phases:
   - Phase 1: Database Performance
   - Phase 2: API Layer Performance
   - Phase 3: Server Rendering Performance
   - Phase 4: Client Rendering Performance
   - Phase 5: Bundle & Assets Performance
4. Generate executive summary and detailed reports
5. Output to `/docs/generated/performance/`

**Critical Constraints:**
- NEVER modify code during audit
- ALWAYS measure/estimate impact before recommending
- ALWAYS prioritize by effort vs impact
- ALWAYS cite file:line for issues

---

### Single Layer Audit

When user says: "Audit database performance" or "Check API performance" or "Audit React rendering"

**Behavior:**
1. Read skill files
2. Execute only the specified phase
3. Generate layer-specific report

**Examples:**
```
User: Audit database performance
Claude: [Analyzes indexes, N+1 queries, RLS policies]
        [Generates DATABASE-PERFORMANCE.md]

User: Why is React rendering slow?
Claude: [Analyzes re-renders, memoization, virtualization]
        [Generates CLIENT-PERFORMANCE.md]
```

---

### Specific Performance Issue

When user says: "Why is [page/component/endpoint] slow?"

**Behavior:**
1. Identify the layer (database, API, client, etc.)
2. Trace the performance bottleneck
3. Provide specific fix with estimated impact

**Example:**
```
User: Why is the command center slow?

Claude: Let me trace the performance...

Entry: GET /api/command-center
Issues found:
1. 5 sequential database queries (should be parallel)
2. Fetching all activities (no limit)
3. CommandCenter component re-renders on every filter change

Top fix: Parallelize queries
- Current: 500ms (100+150+100+80+70)
- After: 150ms (parallel)
- Effort: 30 minutes
```

---

### Find Specific Patterns

When user says patterns like:
- "Find all N+1 queries"
- "Find missing indexes"
- "Find unnecessary re-renders"
- "What's making the bundle large?"

**Behavior:**
1. Search codebase for the specific pattern
2. List all occurrences with file:line
3. Prioritize by impact
4. Suggest fixes

---

## Output Location

Performance reports go to `/docs/generated/performance/`:

```
docs/generated/performance/
├── PERFORMANCE-AUDIT.md      # Executive summary
├── DATABASE-PERFORMANCE.md   # Database issues
├── API-PERFORMANCE.md        # API layer issues
├── SERVER-PERFORMANCE.md     # Next.js server issues
├── CLIENT-PERFORMANCE.md     # React rendering issues
├── BUNDLE-PERFORMANCE.md     # Bundle size issues
└── OPTIMIZATION-PLAN.md      # Prioritized fix plan
```

---

## Quick Reference: Common Issues

### Database
- Missing indexes on filtered/sorted columns
- N+1 queries (await in loops)
- SELECT * instead of specific columns
- Missing LIMIT on list queries
- RLS policies causing full scans

### API
- Sequential queries (should be Promise.all)
- Over-fetching data
- Missing caching for static data
- Large payloads

### React
- Missing useMemo/useCallback
- Missing React.memo
- State too high in component tree
- Missing virtualization for long lists
- Missing code splitting for heavy components

### Bundle
- Large dependencies (moment, lodash full)
- Client-side code that should be server-only
- Missing dynamic imports
- Unoptimized images

---

## Priority Framework

Always categorize findings by:

```
🟢 DO NOW:     High impact + Low effort
🟡 SCHEDULE:   High impact + High effort
🟡 WHEN TIME:  Low impact + Low effort  
🔴 SKIP:       Low impact + High effort
```

---

## Checkpoints

1. **After Phase 1 (Database):** Review index recommendations
2. **After Phase 2 (API):** Confirm N+1 patterns
3. **After Phase 4 (Client):** Validate re-render analysis
4. **After all phases:** Review priority matrix with user

---

## Integration with Other Skills

### After finding issues in specific modules:
→ Check documentation audit for module context

### After finding potential bugs during audit:
→ Use bug investigation skill for deep dive

### After optimization, if code becomes complex:
→ Document the optimization in MODULES.md
