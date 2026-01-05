# X-FORCE Performance Audit Skill

> **Version:** 1.0.0  
> **Purpose:** Systematically identify and fix performance issues across the stack  
> **Prerequisite:** Documentation audit helpful but not required  
> **Mode:** READ-ONLY analysis, generates optimization plan

---

## CRITICAL CONSTRAINTS

### 🚫 ABSOLUTE PROHIBITIONS

1. **NEVER modify code during audit** — only analyze and plan
2. **NEVER assume a fix without measuring impact**
3. **NEVER optimize prematurely** — measure first, then fix
4. **NEVER recommend changes without understanding the tradeoff**

### ✅ REQUIRED BEHAVIORS

1. **ALWAYS measure before recommending**
2. **ALWAYS cite file:line for issues found**
3. **ALWAYS estimate impact (HIGH/MEDIUM/LOW)**
4. **ALWAYS consider side effects of optimizations**
5. **ALWAYS prioritize by effort vs impact**

---

## PERFORMANCE DOMAINS

### The 5 Layers to Audit

```
┌─────────────────────────────────────────┐
│  1. DATABASE                            │  ← Usually biggest impact
│     Queries, indexes, RLS, connections  │
├─────────────────────────────────────────┤
│  2. API LAYER                           │
│     Route handlers, data fetching       │
├─────────────────────────────────────────┤
│  3. SERVER RENDERING                    │
│     RSC, SSR, caching                   │
├─────────────────────────────────────────┤
│  4. CLIENT RENDERING                    │
│     React components, state, re-renders │
├─────────────────────────────────────────┤
│  5. BUNDLE & ASSETS                     │  ← Often overlooked
│     JS size, images, fonts, CDN         │
└─────────────────────────────────────────┘
```

---

## AUDIT PHASES

### Phase 1: Database Performance

**Goal:** Find slow queries, missing indexes, inefficient patterns

#### Step 1.1: Identify Heavy Tables

Check DATABASE.md or migrations for:
- Tables with most relationships (joins)
- Tables queried most frequently
- Tables with large row counts

```markdown
## Heavy Tables Analysis

| Table | Rows (est) | Relationships | Query Frequency | Risk |
|-------|------------|---------------|-----------------|------|
| companies | 500+ | 8 FKs pointing here | Every page load | HIGH |
| command_center_items | 1000+ | 5 FKs | Dashboard, list views | HIGH |
| activities | 10000+ | 4 FKs | Timeline views | HIGH |
```

#### Step 1.2: Audit Indexes

For each heavy table, check:
- Are filtered columns indexed?
- Are sorted columns indexed?
- Are foreign keys indexed?
- Are compound indexes needed for common query patterns?

```markdown
## Index Analysis: command_center_items

**Current Indexes:**
- PRIMARY KEY (id)
- idx_items_user_id (user_id)

**Missing Indexes (recommended):**
| Columns | Reason | Query Pattern |
|---------|--------|---------------|
| (user_id, status) | Filter by user + status | Dashboard filtered view |
| (user_id, tier, created_at) | Sort by tier then date | Command center display |
| (company_id) | FK not indexed | Company detail page |

**SQL to add:**
```sql
CREATE INDEX idx_items_user_status ON command_center_items(user_id, status);
CREATE INDEX idx_items_user_tier_date ON command_center_items(user_id, tier, created_at DESC);
CREATE INDEX idx_items_company ON command_center_items(company_id);
```
```

#### Step 1.3: Find N+1 Queries

Search for patterns like:
```typescript
// N+1 PATTERN - BAD
const companies = await getCompanies();
for (const company of companies) {
  company.contacts = await getContacts(company.id); // Query per company!
}

// FIXED - Single query with join
const companies = await getCompaniesWithContacts();
```

**Search patterns:**
- `for...of` or `forEach` containing `await` and database calls
- `.map()` with async callbacks hitting database
- Multiple sequential queries that could be joined

#### Step 1.4: Audit RLS Policies

Check if RLS policies cause full table scans:
```sql
-- BAD: Forces scan of all rows
CREATE POLICY select_own ON items
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE org_id = current_user_org())
  );

-- BETTER: Direct comparison, uses index
CREATE POLICY select_own ON items
  FOR SELECT USING (user_id = auth.uid());
```

#### Step 1.5: Check Query Patterns

Look for:
- `SELECT *` when only few columns needed
- Missing `LIMIT` on list queries
- Ordering without index support
- Large `IN` clauses that could be joins

**Output:** DATABASE-PERFORMANCE.md with findings and SQL fixes

---

### Phase 2: API Layer Performance

**Goal:** Find slow endpoints, unnecessary data fetching, missing caching

#### Step 2.1: Identify Slow Endpoints

Check API.md and trace heavy endpoints:
```markdown
## API Performance Analysis

| Endpoint | Queries | Payload Size | Caching | Risk |
|----------|---------|--------------|---------|------|
| GET /api/command-center | 5 queries | ~50KB | None | HIGH |
| GET /api/companies/[id] | 8 queries | ~30KB | None | HIGH |
| GET /api/scheduler/dashboard | 12 queries | ~100KB | None | CRITICAL |
```

#### Step 2.2: Find Sequential Queries

Look for queries that could run in parallel:
```typescript
// BAD: Sequential - 300ms + 200ms + 150ms = 650ms
const company = await getCompany(id);
const contacts = await getContacts(id);
const deals = await getDeals(id);

// GOOD: Parallel - max(300ms, 200ms, 150ms) = 300ms
const [company, contacts, deals] = await Promise.all([
  getCompany(id),
  getContacts(id),
  getDeals(id),
]);
```

#### Step 2.3: Check Data Over-fetching

Look for:
- Fetching full objects when only IDs needed
- Fetching all columns when displaying subset
- Fetching nested data that's not displayed
- No pagination on list endpoints

```markdown
## Over-fetching Analysis

### GET /api/command-center

**Currently fetches:**
- Full company object (20 fields)
- Full contact object (15 fields)
- Full deal object (25 fields)
- All activities (no limit)

**Actually displayed:**
- Company: name, id only
- Contact: name, email only
- Deal: name, stage, value only
- Activities: last 5 only

**Recommendation:**
- Use SELECT with specific columns
- Add LIMIT 5 to activities
- Estimated reduction: 70% payload size
```

#### Step 2.4: Audit Caching Strategy

Check for:
- Static data fetched repeatedly (settings, templates)
- User data that rarely changes
- Expensive computations repeated

```markdown
## Caching Opportunities

| Data | Current | Recommended | TTL |
|------|---------|-------------|-----|
| Scheduler settings | Fetched every request | Cache in memory | 5 min |
| Product stages | Fetched every deal view | Cache in memory | 1 hour |
| User permissions | Fetched every API call | Cache in session | 15 min |
| Company intelligence | Computed on demand | Cache in DB | 24 hours |
```

**Output:** API-PERFORMANCE.md with findings and code fixes

---

### Phase 3: Server Rendering Performance

**Goal:** Optimize Next.js server-side rendering

#### Step 3.1: Audit Server vs Client Components

Check for:
- Large components marked 'use client' that could be server
- Data fetching in client components that could be server
- Interactive components that are larger than needed

```markdown
## Component Rendering Analysis

| Component | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| CompanyList | Client | Server | Only displays data, no interactivity |
| DealCard | Client | Server | Click handler can be separate small client component |
| CommandCenter | Client | Keep | Heavy interactivity required |
| Sidebar | Client | Server | Static navigation |
```

#### Step 3.2: Check Data Fetching Patterns

Look for:
- Client-side fetching that could be server-side
- Waterfalls (parent fetches, then child fetches)
- Missing Suspense boundaries

```typescript
// BAD: Client-side fetch, shows loading spinner
'use client';
export function CompanyPage({ id }) {
  const [company, setCompany] = useState(null);
  useEffect(() => {
    fetch(`/api/companies/${id}`).then(r => r.json()).then(setCompany);
  }, [id]);
  if (!company) return <Spinner />;
  return <CompanyView company={company} />;
}

// GOOD: Server component, no spinner needed
export async function CompanyPage({ params: { id } }) {
  const company = await getCompany(id);
  return <CompanyView company={company} />;
}
```

#### Step 3.3: Audit Caching Headers

Check API routes for:
- Missing Cache-Control headers
- Static data without revalidation config
- Dynamic data that could have short cache

**Output:** SERVER-PERFORMANCE.md with findings and fixes

---

### Phase 4: Client Rendering Performance

**Goal:** Find and fix React rendering issues

#### Step 4.1: Find Unnecessary Re-renders

Search for patterns:
```typescript
// BAD: New object every render, causes child re-render
<ChildComponent style={{ margin: 10 }} />
<ChildComponent data={{ items: list }} />
<ChildComponent onClick={() => handleClick(id)} />

// GOOD: Stable references
const style = useMemo(() => ({ margin: 10 }), []);
const data = useMemo(() => ({ items: list }), [list]);
const handleClickMemo = useCallback(() => handleClick(id), [id]);
```

#### Step 4.2: Audit State Management

Look for:
- State too high in tree (causes wide re-renders)
- Derived state that should be computed
- Context providers causing unnecessary re-renders

```markdown
## State Analysis

### CommandCenter.tsx

**Current state location:** Top-level component
**State changes:** Every filter change, every item update

**Problem:** Changing filter re-renders entire item list including
items that didn't change.

**Fix:** 
1. Move filter state to URL params (useSearchParams)
2. Memoize individual ActionCard components
3. Use React.memo with custom comparison
```

#### Step 4.3: Find Missing Virtualization

Check for:
- Lists rendering 100+ items
- Tables without windowing
- Infinite scroll loading all items

```markdown
## Virtualization Opportunities

| Component | Items | Currently | Recommendation |
|-----------|-------|-----------|----------------|
| CommandCenter list | 50-200 | Renders all | Use react-window |
| Activity timeline | 100+ | Renders all | Use virtualization |
| Contact list | 500+ | Paginated (good) | Keep as-is |
```

#### Step 4.4: Audit Component Size

Look for:
- Components doing too much
- Missing code splitting for heavy components
- Modals/drawers loaded eagerly

```typescript
// BAD: Heavy modal loaded with page
import { HeavySchedulerModal } from './HeavySchedulerModal';

// GOOD: Lazy load when needed
const HeavySchedulerModal = dynamic(
  () => import('./HeavySchedulerModal'),
  { loading: () => <ModalSkeleton /> }
);
```

**Output:** CLIENT-PERFORMANCE.md with findings and fixes

---

### Phase 5: Bundle & Assets Performance

**Goal:** Reduce JavaScript bundle size and optimize assets

#### Step 5.1: Analyze Bundle Size

```bash
# Generate bundle analysis
npx next build
npx @next/bundle-analyzer
```

Look for:
- Large dependencies (moment.js, lodash full import)
- Duplicate dependencies
- Dependencies in client bundle that should be server-only

```markdown
## Bundle Analysis

**Total Client JS:** 450KB (gzipped)
**Target:** < 200KB

### Large Dependencies

| Package | Size | Used For | Recommendation |
|---------|------|----------|----------------|
| moment.js | 70KB | Date formatting | Replace with date-fns (tree-shakeable) |
| lodash | 70KB | Various utils | Import specific functions |
| @anthropic-ai/sdk | 50KB | In client bundle! | Move to server only |

### Code Splitting Opportunities

| Route | Current | With Splitting |
|-------|---------|----------------|
| /dashboard | 450KB | 150KB |
| /scheduler | 450KB | 180KB |
| /intelligence | 450KB | 120KB |
```

#### Step 5.2: Audit Images

Look for:
- Images without next/image optimization
- Large images not resized
- Missing lazy loading

#### Step 5.3: Check Fonts

Look for:
- Fonts loaded from external URLs (FOIT)
- Too many font weights loaded
- Missing font-display: swap

**Output:** BUNDLE-PERFORMANCE.md with findings and fixes

---

## OUTPUT FORMAT

### Executive Summary

```markdown
# Performance Audit Report

**Audited:** [Date]
**Overall Score:** [CRITICAL / NEEDS WORK / ACCEPTABLE / GOOD]

## Impact Summary

| Layer | Issues | Estimated Impact | Effort |
|-------|--------|------------------|--------|
| Database | 5 | HIGH | 2 hours |
| API | 8 | HIGH | 4 hours |
| Server Rendering | 3 | MEDIUM | 2 hours |
| Client Rendering | 6 | MEDIUM | 3 hours |
| Bundle | 4 | LOW | 2 hours |

## Top 5 Quick Wins

1. **Add missing indexes** - 30% query speedup, 30 min effort
2. **Parallelize API queries** - 50% endpoint speedup, 1 hour effort
3. **Add pagination to activities** - 70% payload reduction, 30 min effort
4. **Memoize CommandCenter items** - Eliminates re-render lag, 1 hour effort
5. **Lazy load modals** - 100KB bundle reduction, 30 min effort

## Detailed Reports

- [DATABASE-PERFORMANCE.md](./DATABASE-PERFORMANCE.md)
- [API-PERFORMANCE.md](./API-PERFORMANCE.md)
- [SERVER-PERFORMANCE.md](./SERVER-PERFORMANCE.md)
- [CLIENT-PERFORMANCE.md](./CLIENT-PERFORMANCE.md)
- [BUNDLE-PERFORMANCE.md](./BUNDLE-PERFORMANCE.md)
```

---

## OPTIMIZATION PRIORITY MATRIX

```
                    LOW EFFORT    HIGH EFFORT
                  ┌─────────────┬─────────────┐
    HIGH IMPACT   │   DO FIRST  │  PLAN FOR   │
                  │   🟢        │  🟡         │
                  ├─────────────┼─────────────┤
    LOW IMPACT    │   DO LATER  │   SKIP      │
                  │   🟡        │  🔴         │
                  └─────────────┴─────────────┘
```

**Always include effort estimate with each recommendation.**

---

## COMMON PATTERNS BY SYMPTOM

### Symptom: Page loads slowly
**Check:**
1. Database queries (N+1, missing indexes)
2. API waterfall (sequential fetches)
3. Large initial payload
4. Bundle size

### Symptom: Interactions feel laggy
**Check:**
1. Unnecessary re-renders
2. Heavy computations on main thread
3. Missing React.memo
4. State too high in tree

### Symptom: Scrolling is janky
**Check:**
1. Missing virtualization
2. Images not lazy loaded
3. Layout thrashing
4. Too many DOM nodes

### Symptom: Memory grows over time
**Check:**
1. Event listeners not cleaned up
2. Subscriptions not unsubscribed
3. Large objects held in state
4. Closure memory leaks

---

## INVOCATION

### Full Performance Audit

```
Run performance audit
```

Executes all 5 phases, generates full report.

### Single Layer Audit

```
Audit database performance
Audit API performance
Audit React rendering performance
Audit bundle size
```

### Specific Issue Investigation

```
Why is the command center slow?
Why does the dashboard take 5 seconds to load?
Find all N+1 queries
Find all missing indexes
```

---

## OUTPUT LOCATIONS

```
docs/generated/performance/
├── PERFORMANCE-AUDIT.md      # Executive summary
├── DATABASE-PERFORMANCE.md   # Database findings
├── API-PERFORMANCE.md        # API layer findings
├── SERVER-PERFORMANCE.md     # Server rendering findings
├── CLIENT-PERFORMANCE.md     # React rendering findings
├── BUNDLE-PERFORMANCE.md     # Bundle size findings
└── OPTIMIZATION-PLAN.md      # Prioritized fix list
```

---

## CHECKPOINTS

1. **After Phase 1 (Database):** Review index recommendations before proceeding
2. **After Phase 2 (API):** Confirm N+1 patterns identified
3. **After Phase 4 (Client):** Validate re-render analysis
4. **After all phases:** Review priority matrix and confirm plan

---

## MEASURING SUCCESS

### Before/After Metrics

Track these metrics before and after optimization:

| Metric | How to Measure | Target |
|--------|----------------|--------|
| Time to First Byte (TTFB) | Browser DevTools | < 200ms |
| Largest Contentful Paint (LCP) | Lighthouse | < 2.5s |
| First Input Delay (FID) | Lighthouse | < 100ms |
| Cumulative Layout Shift (CLS) | Lighthouse | < 0.1 |
| API Response Time | Network tab | < 200ms |
| Database Query Time | Supabase dashboard | < 50ms |
| Bundle Size (gzipped) | Build output | < 200KB |

### Monitoring

After fixes, set up:
- Supabase query performance monitoring
- Vercel analytics for Core Web Vitals
- Error tracking for performance regressions

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-01 | Initial skill definition |
