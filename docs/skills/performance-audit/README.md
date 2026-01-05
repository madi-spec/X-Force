# X-FORCE Performance Audit Skill

> Systematically identify and fix performance issues across your entire stack.

---

## The Problem This Solves

Performance issues compound. A slow database query feeds into a slow API, which causes slow rendering, which makes users think your app is broken. This skill audits all 5 layers systematically:

1. **Database** - Queries, indexes, RLS policies
2. **API** - Route handlers, data fetching patterns
3. **Server Rendering** - Next.js RSC, SSR, caching
4. **Client Rendering** - React components, state, re-renders
5. **Bundle & Assets** - JavaScript size, images, fonts

---

## Installation

### Step 1: Create skill directory

```bash
mkdir -p docs/skills/performance-audit
mkdir -p docs/generated/performance
```

### Step 2: Copy skill files

Copy to `docs/skills/performance-audit/`:
- SKILL.md
- TEMPLATES.md
- CLAUDE-MD-INSTRUCTIONS.md

### Step 3: Update CLAUDE.md

Add content from CLAUDE-MD-INSTRUCTIONS.md to your CLAUDE.md.

---

## Usage

### Full Audit

```
Run performance audit
```

Analyzes all 5 layers, generates prioritized optimization plan.

### Single Layer

```
Audit database performance
Audit API performance
Audit React rendering
Audit bundle size
```

### Specific Issue

```
Why is the command center slow?
Why does the dashboard take 5 seconds?
```

### Pattern Search

```
Find all N+1 queries
Find missing indexes
Find unnecessary re-renders
```

---

## Output

After a full audit:

```
docs/generated/performance/
├── PERFORMANCE-AUDIT.md      # Executive summary with priority matrix
├── DATABASE-PERFORMANCE.md   # Missing indexes, N+1 queries, RLS issues
├── API-PERFORMANCE.md        # Sequential queries, over-fetching, caching
├── SERVER-PERFORMANCE.md     # RSC opportunities, SSR issues
├── CLIENT-PERFORMANCE.md     # Re-renders, memoization, virtualization
├── BUNDLE-PERFORMANCE.md     # Large deps, code splitting opportunities
└── OPTIMIZATION-PLAN.md      # Week-by-week implementation plan
```

---

## Priority Matrix

Every recommendation is categorized:

```
                    LOW EFFORT    HIGH EFFORT
              ┌───────────────┬───────────────┐
  HIGH IMPACT │  🟢 DO NOW    │  🟡 SCHEDULE  │
              ├───────────────┼───────────────┤
  LOW IMPACT  │  🟡 LATER     │  🔴 SKIP      │
              └───────────────┴───────────────┘
```

---

## Common Findings

### Database (Usually Biggest Impact)

| Issue | Symptom | Fix |
|-------|---------|-----|
| Missing index | Slow filtered queries | Add compound index |
| N+1 queries | Query count = row count | Use joins or batch |
| SELECT * | Large payloads | Select specific columns |
| No LIMIT | Huge result sets | Add pagination |
| Slow RLS | Full table scans | Optimize policy |

### API Layer

| Issue | Symptom | Fix |
|-------|---------|-----|
| Sequential queries | Slow endpoints | Promise.all |
| Over-fetching | Large payloads | Return only needed fields |
| No caching | Repeated slow calls | Add cache layer |

### React

| Issue | Symptom | Fix |
|-------|---------|-----|
| Missing memo | Laggy interactions | useMemo/useCallback |
| State too high | Wide re-renders | Move state down |
| No virtualization | Slow scrolling | react-window |
| Eager loading | Slow initial load | Dynamic imports |

---

## Quick Wins Checklist

Before running full audit, check these manually:

**Database:**
- [ ] Primary key indexes exist
- [ ] Foreign key columns are indexed
- [ ] Frequently filtered columns are indexed

**API:**
- [ ] No `await` inside loops (N+1 pattern)
- [ ] Using `Promise.all` for independent queries
- [ ] List endpoints have pagination

**React:**
- [ ] Large lists use virtualization
- [ ] Heavy components use `React.memo`
- [ ] Expensive computations use `useMemo`
- [ ] Callbacks passed to children use `useCallback`

**Bundle:**
- [ ] No `import moment` (use date-fns)
- [ ] No `import _ from 'lodash'` (use specific imports)
- [ ] Heavy modals/panels use dynamic import

---

## Measuring Success

Track these before and after:

| Metric | Tool | Target |
|--------|------|--------|
| TTFB | DevTools | < 200ms |
| LCP | Lighthouse | < 2.5s |
| FID | Lighthouse | < 100ms |
| Bundle size | Build output | < 200KB gzipped |
| API p95 | Logs | < 200ms |
| Query time | Supabase | < 50ms |

---

## Example Session

```
User: Run performance audit

Claude: Starting performance audit...

## Phase 1: Database Performance

Analyzing 74 tables...

Issues found:
1. 🔴 Missing index: command_center_items(user_id, status)
   - Impact: 40% of queries filter by these columns
   - Fix: CREATE INDEX idx_items_user_status ON command_center_items(user_id, status)
   
2. 🔴 N+1 query in getCompanyWithContacts
   - File: src/lib/companies/queries.ts:45
   - Currently: 1 + N queries (N = contact count)
   - Fix: Use single query with join

[Continues through all 5 phases...]

## Summary

| Layer | Issues | Quick Wins | Estimated Improvement |
|-------|--------|------------|----------------------|
| Database | 5 | 3 | 40% faster queries |
| API | 8 | 4 | 50% faster endpoints |
| Client | 6 | 3 | Smooth scrolling |

Top 3 recommendations:
1. Add missing indexes (30 min, 40% improvement)
2. Parallelize API queries (1 hour, 50% improvement)
3. Memoize CommandCenter (30 min, eliminates lag)

Full reports generated in docs/generated/performance/
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
