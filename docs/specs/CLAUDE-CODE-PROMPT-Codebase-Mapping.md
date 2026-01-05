# X-FORCE: Comprehensive Codebase Mapping

## Objective

Map the entire current codebase against the Platform Vision document to create a clear picture of:
1. What's implemented and working
2. What's in the vision but not yet built
3. What's built but not documented in the vision
4. The current state of each major component

---

## Part 1: Directory Structure Inventory

### Map the entire src/ directory structure

```bash
find src -type f -name "*.ts" -o -name "*.tsx" | head -200
```

Create a tree showing:
- All directories and their purpose
- Key files in each directory
- Approximate file counts per directory

---

## Part 2: Component-by-Component Mapping

For each component in the Platform Vision, identify what exists:

### 1. Relationship Intelligence
**Vision says:** Cumulative context that grows over time, stored per company/contact

**Check:**
- [ ] Database table: `relationship_intelligence`
- [ ] Schema columns: facts_learned, communication_history, context_summary, etc.
- [ ] Functions that read/write relationship intelligence
- [ ] Where is it used?

```bash
grep -r "relationship_intelligence" src --include="*.ts" | head -20
```

### 2. AI-Powered Entity Matching
**Vision says:** Intelligent matching using AI, no keyword fallbacks

**Check:**
- [ ] File: `src/lib/intelligence/entityMatcher.ts`
- [ ] Function: `intelligentEntityMatch`
- [ ] AI model calls for matching
- [ ] Where is it called from?

```bash
grep -r "intelligentEntityMatch\|entityMatcher" src --include="*.ts"
```

### 3. Sales Playbook
**Vision says:** Teaches AI the sales process, defines communication types

**Check:**
- [ ] File: `src/lib/intelligence/salesPlaybook.ts`
- [ ] Communication type definitions
- [ ] Action templates
- [ ] Where is playbook used?

```bash
grep -r "salesPlaybook\|SALES_PLAYBOOK" src --include="*.ts"
```

### 4. Command Center
**Vision says:** 5-tier prioritization, workflow cards with checklists

**Check:**
- [ ] Database table: `command_center_items`
- [ ] UI components for command center
- [ ] Tier assignment logic
- [ ] Workflow steps/checklists

```bash
grep -r "command.center\|CommandCenter\|command_center" src --include="*.ts" --include="*.tsx"
```

### 5. AI Scheduler
**Vision says:** Persistent meeting coordination agent, state machine, email negotiation

**Check:**
- [ ] Database tables: `scheduling_requests`, `scheduling_attendees`, `scheduling_actions`
- [ ] State machine implementation
- [ ] Email generation for scheduling
- [ ] No-show detection
- [ ] Dashboard UI

```bash
grep -r "scheduling\|scheduler\|Scheduler" src --include="*.ts" --include="*.tsx"
```

### 6. Meeting Prep
**Vision says:** AI-generated briefings before meetings

**Check:**
- [ ] File: `src/lib/intelligence/meetingPrep.ts` or similar
- [ ] Meeting prep generation function
- [ ] Where is it triggered?
- [ ] UI to display meeting prep

```bash
grep -r "meetingPrep\|MeetingPrep\|meeting.prep" src --include="*.ts" --include="*.tsx"
```

### 7. Company/Deal Pages
**Vision says:** Source of truth interface showing all intelligence

**Check:**
- [ ] Company detail page component
- [ ] Deal detail page component
- [ ] Displays relationship intelligence?
- [ ] Shows communication history?

```bash
find src -path "*company*" -o -path "*deal*" | grep -E "\.(ts|tsx)$"
```

### 8. Research Agent
**Vision says:** Phased company intelligence gathering with confidence scoring

**Check:**
- [ ] Research agent implementation
- [ ] Phase management (Identify → Ground → Enrich → Validate)
- [ ] Source confidence matrix
- [ ] Where is it triggered?

```bash
grep -r "research\|Research" src --include="*.ts" | grep -v node_modules
```

### 9. Marketing Intelligence
**Vision says:** Comprehensive marketing activity detection

**Check:**
- [ ] Marketing intelligence collectors
- [ ] Blog, YouTube, Facebook, Instagram detection
- [ ] Marketing score calculation
- [ ] Where is it stored/displayed?

```bash
grep -r "marketing\|Marketing" src --include="*.ts" | grep -v node_modules
```

### 10. Integrations
**Vision says:** Microsoft 365, Fireflies, future Teams

**Check:**
- [ ] Microsoft email sync
- [ ] Microsoft calendar sync
- [ ] Fireflies transcript import
- [ ] Any other integrations

```bash
ls -la src/lib/microsoft/ src/lib/fireflies/ 2>/dev/null
```

---

## Part 3: Database Schema Inventory

### List all tables and their purposes

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

For key tables, show columns:

```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN (
  'companies', 'contacts', 'deals', 
  'email_messages', 'transcripts', 
  'relationship_intelligence', 'command_center_items',
  'scheduling_requests', 'scheduling_attendees', 'scheduling_actions'
)
ORDER BY table_name, ordinal_position;
```

---

## Part 4: API Endpoints Inventory

### List all API routes

```bash
find src/app/api -name "route.ts" | sort
```

For each route, note:
- HTTP methods supported
- What it does
- What it connects to

---

## Part 5: UI Components Inventory

### List all page components

```bash
find src/app -name "page.tsx" | sort
```

### List all major components

```bash
find src/components -name "*.tsx" | sort
```

---

## Part 6: Gap Analysis

Based on findings, create three lists:

### Implemented & Documented ✅
Features that exist in both code and vision

### Implemented But Undocumented 🔍
Features in code that aren't in the vision document

### Documented But Not Implemented 📋
Features in vision that don't exist in code yet

### Partially Implemented 🔄
Features that are started but incomplete

---

## Part 7: Output Format

Create a comprehensive report:

```markdown
# X-FORCE Codebase Map

## Executive Summary
- Total files: X
- Total API endpoints: X
- Total database tables: X
- Vision alignment: X%

## Component Status

| Component | Vision Status | Implementation Status | Files | Notes |
|-----------|--------------|----------------------|-------|-------|
| Relationship Intelligence | ✅ Documented | ✅ Complete | 3 | |
| Entity Matching | ✅ Documented | ✅ Complete | 1 | |
| ... | | | | |

## Detailed Findings

### 1. Relationship Intelligence
**Status:** ✅ Complete
**Files:**
- src/lib/intelligence/contextFirstPipeline.ts
- src/lib/intelligence/relationshipStore.ts
**Database:** relationship_intelligence table
**Used by:** Email processing, transcript processing, meeting prep

### 2. AI Scheduler
**Status:** [Determine actual status]
**Files:** [List files found]
**Database:** [List tables found]
**Notes:** [Any observations]

[Continue for all 10 components...]

## Gap Analysis

### Not Yet Implemented
1. [Feature] — [What's needed]
2. [Feature] — [What's needed]

### Partially Implemented
1. [Feature] — [What exists] — [What's missing]

### Implemented Beyond Vision
1. [Feature] — [What it does]

## Recommendations
1. [Priority recommendation]
2. [Priority recommendation]
```

---

## Instructions

1. Run all the grep/find commands to discover what exists
2. Check the database schema
3. Map findings against the 10 vision components
4. Create the comprehensive report
5. Identify gaps and surprises

Take your time - this is about getting an accurate picture, not speed.
