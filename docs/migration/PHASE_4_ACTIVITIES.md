# Phase 4: Activities, Tasks & Transcriptions Migration

## Objective

Update all activity, task, and meeting transcription creation to use `company_product_id`. This ensures all historical tracking and new records are product-aware.

## Pre-Flight Check

**Verify Phase 3 is complete:**
```bash
grep -A5 "Phase 3:" docs/migration/MIGRATION_CHECKLIST.md
npm run build
```

**Verify columns exist (Postgres MCP):**
```sql
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name = 'company_product_id' 
AND table_name IN ('activities', 'tasks', 'meeting_transcriptions')
AND table_schema = 'public';
```
Expected: 3 rows

**Do not proceed if Phase 3 is incomplete.**

---

## Files to Modify

### Activities
- `src/app/api/activities/route.ts`
- All files that insert into activities table

### Tasks
- `src/app/api/tasks/route.ts`
- `src/app/api/meetings/transcriptions/[id]/create-tasks/route.ts`
- All files that insert into tasks table

### Transcriptions
- `src/app/api/meetings/transcriptions/route.ts`
- `src/lib/fireflies/sync.ts`
- `src/lib/fireflies/transcriptUtils.ts`

---

## Step 1: Find All Activity Creation Locations

**Run this search to find all places where activities are created:**

```bash
grep -rn "from('activities')" --include="*.ts" --include="*.tsx" src/ | grep -i insert
```

**Also search for:**
```bash
grep -rn "\.from\(['\"]activities" --include="*.ts" --include="*.tsx" src/
```

**Document all files found in the checklist before proceeding.**

Common locations:
- `src/app/api/activities/route.ts`
- `src/app/api/deals/[id]/convert/route.ts`
- `src/app/api/meetings/transcriptions/route.ts`
- `src/lib/fireflies/sync.ts`
- `src/lib/commandCenter/` various files

---

## Step 2: Update Activity API

### File: `src/app/api/activities/route.ts`

**Find the POST handler and update:**

**1. Update body destructuring:**
```typescript
const {
  deal_id,
  company_product_id,  // ADD THIS
  company_id,
  type,
  subject,
  body,
  // ... other fields
} = await request.json();
```

**2. Update the insert:**
```typescript
const { data: activity, error } = await supabase
  .from('activities')
  .insert({
    deal_id: deal_id || null,
    company_product_id: company_product_id || null,  // ADD THIS
    company_id: company_id || null,
    user_id: profile.id,
    type,
    subject,
    body,
    occurred_at: new Date().toISOString(),
    // ... other fields
  })
  .select()
  .single();
```

---

## Step 3: Update All Activity Creation Locations

**For EACH file found in Step 1, add company_product_id to the insert.**

**Pattern to apply:**

Before:
```typescript
await supabase.from('activities').insert({
  deal_id: dealId,
  company_id: companyId,
  // ...
});
```

After:
```typescript
await supabase.from('activities').insert({
  deal_id: dealId,
  company_product_id: companyProductId || null,  // ADD THIS
  company_id: companyId,
  // ...
});
```

**If the code doesn't have access to companyProductId, you can:**
1. Add it as a parameter to the function
2. Look it up from company_products table
3. Leave as null (acceptable for now)

**Example lookup if needed:**
```typescript
// If you have companyId but not companyProductId
let companyProductId = null;
if (companyId) {
  const { data: cp } = await supabase
    .from('company_products')
    .select('id')
    .eq('company_id', companyId)
    .in('status', ['in_sales', 'in_onboarding', 'active'])
    .limit(1)
    .single();
  companyProductId = cp?.id || null;
}
```

---

## Step 4: Find All Task Creation Locations

**Run search:**
```bash
grep -rn "from('tasks')" --include="*.ts" --include="*.tsx" src/ | grep -i insert
```

**Document all files found.**

Common locations:
- `src/app/api/tasks/route.ts`
- `src/app/api/meetings/transcriptions/[id]/create-tasks/route.ts`
- `src/lib/fireflies/sync.ts`
- `src/lib/commandCenter/` various files

---

## Step 5: Update Task API

### File: `src/app/api/tasks/route.ts`

**1. Update body destructuring:**
```typescript
const {
  deal_id,
  company_product_id,  // ADD THIS
  company_id,
  title,
  description,
  priority,
  due_at,
  // ... other fields
} = await request.json();
```

**2. Update the insert:**
```typescript
const { data: task, error } = await supabase
  .from('tasks')
  .insert({
    deal_id: deal_id || null,
    company_product_id: company_product_id || null,  // ADD THIS
    company_id: company_id || null,
    assigned_to: profile.id,
    created_by: profile.id,
    title,
    description,
    priority: priority || 'medium',
    due_at,
    // ... other fields
  })
  .select()
  .single();
```

---

## Step 6: Update Task Creation from Transcriptions

### File: `src/app/api/meetings/transcriptions/[id]/create-tasks/route.ts`

**Find where tasks are created and add company_product_id:**

```typescript
const tasksToCreate = selectedItems.map((item: MeetingActionItem) => ({
  deal_id: transcription.deal_id,
  company_product_id: transcription.company_product_id,  // ADD THIS
  company_id: transcription.company_id,
  assigned_to: profile.id,
  created_by: profile.id,
  type: inferTaskType(item.task),
  title: item.task,
  description: `From meeting: ${transcription.title}`,
  priority: item.priority,
  due_at: item.dueDate || getDefaultDueDate(item.priority),
  source: 'meeting_extraction' as const,
}));
```

---

## Step 7: Update All Task Creation Locations

**Apply the same pattern as activities to all task insert locations found in Step 4.**

---

## Step 8: Update Transcription API

### File: `src/app/api/meetings/transcriptions/route.ts`

**In the POST handler:**

**1. Update body parsing:**
```typescript
const {
  dealId,
  companyProductId,  // ADD THIS
  companyId,
  title,
  meetingDate,
  transcriptionText,
  // ... other fields
} = body;
```

**2. Update the insert:**
```typescript
const { data: transcription, error: insertError } = await supabase
  .from('meeting_transcriptions')
  .insert({
    user_id: profile.id,
    deal_id: dealId || null,
    company_product_id: companyProductId || null,  // ADD THIS
    company_id: companyId || null,
    title,
    meeting_date: meetingDate,
    transcription_text: transcriptionText,
    // ... other fields
  })
  .select()
  .single();
```

---

## Step 9: Update Fireflies Sync

### File: `src/lib/fireflies/sync.ts`

**Find the syncFirefliesTranscripts function and add product matching.**

**1. After company matching, look up company_product:**

Find where `match.companyId` is available and add:
```typescript
// After company matching, find the company_product
let companyProductId: string | null = null;
if (match.companyId) {
  const { data: cp } = await supabase
    .from('company_products')
    .select('id')
    .eq('company_id', match.companyId)
    .in('status', ['in_sales', 'in_onboarding', 'active'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  companyProductId = cp?.id || null;
}
```

**2. Include in transcription insert:**

Find where the meeting_transcription is inserted and add:
```typescript
const { data: saved, error: saveError } = await supabase
  .from('meeting_transcriptions')
  .insert({
    // ... existing fields
    deal_id: match.dealId || null,
    company_product_id: companyProductId,  // ADD THIS
    company_id: match.companyId || null,
    // ... rest of fields
  })
  .select('id')
  .single();
```

---

## Step 10: Update Transcript Utils

### File: `src/lib/fireflies/transcriptUtils.ts`

**Find createTranscriptReviewTask and related functions.**

If there are task creation functions, add company_product_id:
```typescript
await supabase.from('tasks').insert({
  // ... existing fields
  company_product_id: companyProductId || null,
});
```

---

## Step 11: TypeScript Verification

```bash
npm run build
```

**Fix all errors before proceeding.**

---

## Step 12: Integration Testing

### Test Activity Creation

**Using Postgres MCP, first get test IDs:**
```sql
SELECT c.id as company_id, cp.id as company_product_id 
FROM companies c 
JOIN company_products cp ON cp.company_id = c.id 
LIMIT 1;
```

**Test via API (use actual auth or skip if auth is complex):**
```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "[COMPANY_ID]",
    "company_product_id": "[COMPANY_PRODUCT_ID]",
    "type": "note",
    "body": "Test activity with company_product_id"
  }'
```

**Verify with Postgres MCP:**
```sql
SELECT id, company_id, company_product_id, type, body, created_at
FROM activities
WHERE company_product_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Test Task Creation

```sql
SELECT id, company_id, company_product_id, title, created_at
FROM tasks
WHERE company_product_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Test Transcription

```sql
SELECT id, company_id, company_product_id, title, source, created_at
FROM meeting_transcriptions
WHERE company_product_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

---

## Phase 4 Success Criteria

### ✅ Build Verification
```bash
npm run build
# Expected: Exit code 0
```

### ✅ Activity API (Postgres MCP)
```sql
-- Activities can have company_product_id
SELECT COUNT(*) FROM activities WHERE company_product_id IS NOT NULL;
-- Should be >= 0 (increases as system is used)
```

### ✅ Task API (Postgres MCP)
```sql
-- Tasks can have company_product_id
SELECT COUNT(*) FROM tasks WHERE company_product_id IS NOT NULL;
```

### ✅ Transcription API (Postgres MCP)
```sql
-- Transcriptions can have company_product_id
SELECT COUNT(*) FROM meeting_transcriptions WHERE company_product_id IS NOT NULL;
```

### ✅ All Insert Locations Updated
- Document all files modified in checklist

---

## Commit Checkpoint

```bash
git add -A
git commit -m "Phase 4: Activities, Tasks, and Transcriptions support company_product_id

Files modified:
- src/app/api/activities/route.ts - Accept company_product_id
- src/app/api/tasks/route.ts - Accept company_product_id
- src/app/api/meetings/transcriptions/route.ts - Accept company_product_id
- src/app/api/meetings/transcriptions/[id]/create-tasks/route.ts - Pass product ID
- src/lib/fireflies/sync.ts - Match transcripts to company_products
- [List other modified files]

All activity, task, and transcription creation now supports company_product_id.
Backwards compatible - deal_id still supported."
```

---

## Update Checklist

Edit `docs/migration/MIGRATION_CHECKLIST.md`:
1. Mark Phase 4 as ✅ Complete
2. Record timestamp
3. Record commit hash
4. List ALL files modified for activity inserts
5. List ALL files modified for task inserts
6. Note any issues

---

## Next Phase

```bash
cat docs/migration/PHASE_5_UI_NAVIGATION.md
```
