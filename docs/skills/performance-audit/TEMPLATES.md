# Performance Audit Output Templates

> Standardized formats for performance analysis and optimization plans

---

## PERFORMANCE-AUDIT.md (Executive Summary)

```markdown
# Performance Audit Report

**Audited:** [Date]
**Auditor:** Claude Code
**Codebase Version:** [git commit or date]

---

## Overall Assessment

**Score:** [CRITICAL / NEEDS WORK / ACCEPTABLE / GOOD]

**Summary:** [2-3 sentence overview of performance state]

---

## Layer Scores

| Layer | Score | Issues | Est. Impact | Est. Effort |
|-------|-------|--------|-------------|-------------|
| Database | 🔴 CRITICAL | X | HIGH | X hours |
| API | 🟡 NEEDS WORK | X | MEDIUM | X hours |
| Server Rendering | 🟢 GOOD | X | LOW | X hours |
| Client Rendering | 🟡 NEEDS WORK | X | MEDIUM | X hours |
| Bundle & Assets | 🟢 GOOD | X | LOW | X hours |

---

## Top 10 Issues by Impact

| # | Issue | Layer | Impact | Effort | Priority |
|---|-------|-------|--------|--------|----------|
| 1 | [Issue] | [Layer] | HIGH | LOW | 🟢 DO NOW |
| 2 | [Issue] | [Layer] | HIGH | LOW | 🟢 DO NOW |
| 3 | [Issue] | [Layer] | HIGH | MEDIUM | 🟡 PLAN |
| ... | ... | ... | ... | ... | ... |

---

## Quick Wins (< 1 hour each)

1. **[Fix name]**
   - File: `[path]`
   - Change: [description]
   - Impact: [expected improvement]

2. **[Fix name]**
   - File: `[path]`
   - Change: [description]
   - Impact: [expected improvement]

---

## Metrics Baseline

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| TTFB | Xms | 200ms | -Xms |
| LCP | Xs | 2.5s | -Xs |
| FID | Xms | 100ms | -Xms |
| Bundle Size | XKB | 200KB | -XKB |
| Avg Query Time | Xms | 50ms | -Xms |
| Avg API Response | Xms | 200ms | -Xms |

---

## Detailed Reports

- [Database Performance](./DATABASE-PERFORMANCE.md)
- [API Performance](./API-PERFORMANCE.md)
- [Server Performance](./SERVER-PERFORMANCE.md)
- [Client Performance](./CLIENT-PERFORMANCE.md)
- [Bundle Performance](./BUNDLE-PERFORMANCE.md)
- [Optimization Plan](./OPTIMIZATION-PLAN.md)

---

## Next Steps

1. [ ] Review quick wins
2. [ ] Implement top 3 high-impact fixes
3. [ ] Measure improvement
4. [ ] Proceed with remaining optimizations
5. [ ] Set up monitoring
```

---

## DATABASE-PERFORMANCE.md Template

```markdown
# Database Performance Analysis

**Audited:** [Date]
**Tables Analyzed:** X
**Issues Found:** Y

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Missing Indexes | X | 🔴 HIGH |
| N+1 Query Patterns | X | 🔴 HIGH |
| Inefficient RLS | X | 🟡 MEDIUM |
| Over-fetching | X | 🟡 MEDIUM |
| Missing Limits | X | 🟡 MEDIUM |

---

## Table Analysis

### High-Traffic Tables

| Table | Est. Rows | Queries/min | Indexes | Status |
|-------|-----------|-------------|---------|--------|
| [table] | X | X | X | 🔴 Needs work |
| [table] | X | X | X | 🟢 OK |

---

## Missing Indexes

### [table_name]

**Current Indexes:**
```sql
-- List current indexes
```

**Missing Indexes:**

| Columns | Reason | Query Pattern | Priority |
|---------|--------|---------------|----------|
| (col1, col2) | [reason] | [pattern] | HIGH |

**SQL to Add:**
```sql
CREATE INDEX idx_name ON table_name(col1, col2);
```

**Expected Impact:** [X]% improvement on [query pattern]

---

## N+1 Query Patterns

### Pattern 1: [Description]

**Location:** `[file:line]`

**Current Code:**
```typescript
// The problematic pattern
```

**Problem:** [Explain why this is N+1]

**Fixed Code:**
```typescript
// The solution
```

**Expected Impact:** Reduces [X] queries to [Y] queries

---

## RLS Policy Issues

### [policy_name] on [table]

**Current Policy:**
```sql
-- Current RLS
```

**Problem:** [Why it's slow]

**Optimized Policy:**
```sql
-- Fixed RLS
```

**Expected Impact:** [description]

---

## Over-Fetching

### [Query Location]

**File:** `[path:line]`

**Current:**
```typescript
const data = await supabase.from('table').select('*')
```

**Optimized:**
```typescript
const data = await supabase.from('table').select('id, name, status')
```

**Reduction:** [X] columns → [Y] columns ([Z]% payload reduction)

---

## Action Items

| Priority | Action | File | Effort |
|----------|--------|------|--------|
| 🔴 HIGH | Add index on X | migration | 15 min |
| 🔴 HIGH | Fix N+1 in Y | [file] | 30 min |
| 🟡 MED | Optimize RLS Z | migration | 30 min |
```

---

## API-PERFORMANCE.md Template

```markdown
# API Performance Analysis

**Audited:** [Date]
**Endpoints Analyzed:** X
**Issues Found:** Y

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Sequential Queries | X | 🔴 HIGH |
| Over-fetching | X | 🟡 MEDIUM |
| Missing Caching | X | 🟡 MEDIUM |
| Large Payloads | X | 🟡 MEDIUM |

---

## Endpoint Analysis

### Slow Endpoints (> 500ms)

| Endpoint | Avg Time | Queries | Payload | Issues |
|----------|----------|---------|---------|--------|
| [endpoint] | Xms | X | XKB | [issues] |

---

## Sequential Query Issues

### [Endpoint]

**File:** `[path:line]`

**Current (Sequential):**
```typescript
const a = await getA();      // 100ms
const b = await getB();      // 150ms
const c = await getC();      // 100ms
// Total: 350ms
```

**Optimized (Parallel):**
```typescript
const [a, b, c] = await Promise.all([
  getA(),
  getB(),
  getC(),
]);
// Total: 150ms (max of all three)
```

**Time Saved:** ~200ms

---

## Over-fetching Issues

### [Endpoint]

**File:** `[path:line]`

**Currently Returns:**
```json
{
  "company": { /* 20 fields */ },
  "contacts": [ /* full objects */ ],
  "deals": [ /* all deals */ ],
  "activities": [ /* no limit! */ ]
}
```

**Actually Used by Frontend:**
```json
{
  "company": { "id": "", "name": "" },
  "contacts": [ { "id": "", "name": "" } ],
  "deals": [ { "id": "", "stage": "" } ],
  "activities": [ /* last 5 only */ ]
}
```

**Recommendation:**
- Select specific columns
- Add LIMIT to activities
- Consider separate endpoints

**Payload Reduction:** ~70%

---

## Caching Opportunities

| Data | Endpoint | Freshness Needed | Recommended Cache |
|------|----------|------------------|-------------------|
| [data] | [endpoint] | [X minutes] | [strategy] |

### Implementation Example

```typescript
// Using unstable_cache (Next.js)
const getCachedSettings = unstable_cache(
  async (userId: string) => getSettings(userId),
  ['user-settings'],
  { revalidate: 300 } // 5 minutes
);
```

---

## Action Items

| Priority | Action | Endpoint | Effort |
|----------|--------|----------|--------|
| 🔴 HIGH | Parallelize queries | [endpoint] | 30 min |
| 🔴 HIGH | Reduce payload | [endpoint] | 1 hour |
| 🟡 MED | Add caching | [endpoint] | 30 min |
```

---

## CLIENT-PERFORMANCE.md Template

```markdown
# Client Rendering Performance Analysis

**Audited:** [Date]
**Components Analyzed:** X
**Issues Found:** Y

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Unnecessary Re-renders | X | 🔴 HIGH |
| Missing Memoization | X | 🟡 MEDIUM |
| Missing Virtualization | X | 🟡 MEDIUM |
| State Too High | X | 🟡 MEDIUM |
| Missing Code Splitting | X | 🟢 LOW |

---

## Re-render Analysis

### [ComponentName]

**File:** `[path:line]`

**Problem:** Re-renders on every parent state change

**Evidence:**
```typescript
// New object created every render
<Child config={{ option: true }} />

// New function created every render
<Child onClick={() => doThing(id)} />
```

**Fix:**
```typescript
const config = useMemo(() => ({ option: true }), []);
const handleClick = useCallback(() => doThing(id), [id]);

<Child config={config} />
<Child onClick={handleClick} />
```

---

## Missing Memoization

### [ComponentName]

**File:** `[path:line]`

**Current:**
```typescript
function ExpensiveList({ items, filter }) {
  // Filters on every render
  const filtered = items.filter(i => i.type === filter);
  
  return filtered.map(item => <Item key={item.id} {...item} />);
}
```

**Optimized:**
```typescript
function ExpensiveList({ items, filter }) {
  const filtered = useMemo(
    () => items.filter(i => i.type === filter),
    [items, filter]
  );
  
  return filtered.map(item => <Item key={item.id} {...item} />);
}

const Item = React.memo(function Item(props) {
  // Only re-renders when props change
});
```

---

## Virtualization Needed

### [ComponentName]

**File:** `[path:line]`

**Current:** Renders [X] items, all in DOM

**Impact:** 
- [X] DOM nodes
- [X]ms render time
- Janky scrolling

**Solution:**
```typescript
import { FixedSizeList } from 'react-window';

function VirtualizedList({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <Item {...items[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

---

## State Location Issues

### [Issue Description]

**Current Structure:**
```
App
└── Dashboard (filter state here)
    └── Header
    └── Sidebar
    └── MainContent
        └── ItemList (needs filter)
            └── Item × 100 (all re-render on filter change!)
```

**Optimized Structure:**
```
App
└── Dashboard
    └── Header
    └── Sidebar
    └── MainContent
        └── FilterProvider (filter state here, closer to usage)
            └── ItemList
                └── Item × 100 (memoized, only affected items re-render)
```

---

## Code Splitting Opportunities

### Heavy Components

| Component | Size | Load Time | Recommendation |
|-----------|------|-----------|----------------|
| SchedulerModal | 50KB | 200ms | Dynamic import |
| ChartPanel | 80KB | 300ms | Dynamic import |
| PDFViewer | 150KB | 500ms | Dynamic import |

**Implementation:**
```typescript
const SchedulerModal = dynamic(
  () => import('./SchedulerModal'),
  { 
    loading: () => <ModalSkeleton />,
    ssr: false 
  }
);
```

---

## Action Items

| Priority | Action | Component | Effort |
|----------|--------|-----------|--------|
| 🔴 HIGH | Add memoization | [component] | 30 min |
| 🔴 HIGH | Add virtualization | [component] | 1 hour |
| 🟡 MED | Fix state location | [component] | 1 hour |
| 🟢 LOW | Add code splitting | [component] | 30 min |
```

---

## OPTIMIZATION-PLAN.md Template

```markdown
# Performance Optimization Plan

**Generated:** [Date]
**Total Issues:** X
**Estimated Effort:** Y hours
**Expected Improvement:** Z%

---

## Priority Matrix

```
                    LOW EFFORT         HIGH EFFORT
                    (< 1 hour)         (> 1 hour)
              ┌──────────────────┬──────────────────┐
  HIGH        │ 🟢 DO NOW        │ 🟡 SCHEDULE      │
  IMPACT      │                  │                  │
  (> 30%      │ 1. Add indexes   │ 5. Refactor     │
  improve-    │ 2. Parallelize   │    state mgmt   │
  ment)       │ 3. Add limits    │ 6. Add virtual- │
              │ 4. Memoize       │    ization      │
              ├──────────────────┼──────────────────┤
  LOW         │ 🟡 WHEN TIME     │ 🔴 SKIP/DEFER   │
  IMPACT      │    PERMITS       │                  │
  (< 30%      │                  │                  │
  improve-    │ 7. Cache static  │ 9. Rewrite      │
  ment)       │ 8. Code split    │    component    │
              └──────────────────┴──────────────────┘
```

---

## Week 1: Quick Wins

### Day 1: Database Indexes

| Task | File | Time | Impact |
|------|------|------|--------|
| Add idx_items_user_status | migration | 15 min | 30% query speedup |
| Add idx_items_company | migration | 15 min | 25% join speedup |

### Day 2: API Parallelization

| Task | File | Time | Impact |
|------|------|------|--------|
| Parallelize /api/command-center | [file] | 30 min | 50% faster |
| Parallelize /api/companies/[id] | [file] | 30 min | 40% faster |

### Day 3: Payload Reduction

| Task | File | Time | Impact |
|------|------|------|--------|
| Add pagination to activities | [file] | 30 min | 70% smaller |
| Select specific columns | [file] | 30 min | 50% smaller |

---

## Week 2: React Optimization

### Day 1-2: Memoization

| Task | Component | Time | Impact |
|------|-----------|------|--------|
| Memoize ActionCard | [file] | 30 min | Eliminates re-render |
| Memoize filtered lists | [file] | 1 hour | 60% faster filter |

### Day 3-4: Virtualization

| Task | Component | Time | Impact |
|------|-----------|------|--------|
| Virtualize CommandCenter | [file] | 2 hours | Smooth scrolling |
| Virtualize ActivityTimeline | [file] | 2 hours | Handle 1000+ items |

---

## Week 3: Advanced Optimization

- [ ] Implement caching strategy
- [ ] Add code splitting
- [ ] Optimize bundle size
- [ ] Set up monitoring

---

## Success Metrics

After completing optimizations:

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| TTFB | Xms | 200ms | |
| LCP | Xs | 2.5s | |
| API p95 | Xms | 200ms | |
| Bundle | XKB | 200KB | |

---

## Monitoring Setup

After optimizations, set up:

1. **Vercel Analytics** - Core Web Vitals tracking
2. **Supabase Dashboard** - Query performance
3. **Sentry** - Performance transaction tracking
4. **Custom logging** - API response times

---

## Rollback Plan

If optimization causes issues:

1. Each optimization is a separate commit
2. Can revert individual changes
3. Feature flags for major changes
4. Monitor error rates after each deploy
```
