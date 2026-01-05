# End-to-End Flow Diagnostic: Happinest Test Case

## Problem Statement

Despite multiple fixes, the core data flows aren't working:
- Relationship Context tab is empty
- Emails aren't populating relationship intelligence
- Transcripts aren't populating relationship intelligence
- Command Center items may not have proper context

**We will trace EVERY step for Happinest to find ALL breaks.**

---

## Phase 1: Establish What Data Exists

### 1.1 Find Happinest Company
```sql
SELECT 
  id,
  name,
  domain,
  created_at
FROM companies 
WHERE name ILIKE '%happinest%';
```
**Save the company_id for all subsequent queries.**

### 1.2 Find All Happinest Contacts
```sql
SELECT 
  id,
  first_name,
  last_name,
  email,
  company_id
FROM contacts 
WHERE company_id = '[HAPPINEST_ID]';
```

### 1.3 Find All Happinest Deals
```sql
SELECT 
  id,
  name,
  stage,
  company_id,
  value
FROM deals 
WHERE company_id = '[HAPPINEST_ID]';
```

### 1.4 Find All Happinest Emails
```sql
SELECT 
  id,
  subject,
  from_email,
  to_email,
  direction,
  received_at,
  analysis_complete,
  processed_for_cc,
  company_id,
  contact_id
FROM email_messages
WHERE company_id = '[HAPPINEST_ID]'
   OR from_email ILIKE '%happinest%'
   OR to_email ILIKE '%happinest%'
ORDER BY received_at DESC;
```

### 1.5 Find All Happinest Transcripts
```sql
SELECT 
  id,
  title,
  meeting_date,
  company_id,
  contact_id,
  analysis_status
FROM meeting_transcriptions
WHERE company_id = '[HAPPINEST_ID]'
   OR title ILIKE '%happinest%'
ORDER BY meeting_date DESC;
```

### 1.6 Find Happinest Relationship Intelligence
```sql
SELECT 
  id,
  company_id,
  contact_id,
  context_summary,
  facts_learned,
  buying_signals,
  objections,
  commitments_made,
  commitments_received,
  communication_history,
  updated_at
FROM relationship_intelligence
WHERE company_id = '[HAPPINEST_ID]';
```

### 1.7 Find Happinest Command Center Items
```sql
SELECT 
  id,
  title,
  tier,
  tier_trigger,
  source,
  source_id,
  company_id,
  status,
  created_at
FROM command_center_items
WHERE company_id = '[HAPPINEST_ID]'
   OR title ILIKE '%happinest%'
ORDER BY created_at DESC;
```

---

## Phase 2: Trace the Gaps

### Gap A: Emails Not Linked to Happinest?
```sql
-- Are there emails that SHOULD be linked but aren't?
SELECT 
  id,
  subject,
  from_email,
  company_id,
  contact_id
FROM email_messages
WHERE (from_email ILIKE '%happinest%' OR to_email ILIKE '%happinest%')
  AND company_id IS NULL;
```

**If results:** Entity matcher isn't matching Happinest emails.

### Gap B: Transcripts Not Linked to Happinest?
```sql
-- Are there transcripts that SHOULD be linked but aren't?
SELECT 
  id,
  title,
  company_id,
  contact_id
FROM meeting_transcriptions
WHERE title ILIKE '%happinest%'
  AND company_id IS NULL;
```

**If results:** Transcript processing isn't linking companies.

### Gap C: Relationship Intelligence Empty or Missing?
```sql
-- Does RI exist for Happinest?
SELECT COUNT(*) FROM relationship_intelligence WHERE company_id = '[HAPPINEST_ID]';

-- If exists, what's in it?
SELECT 
  jsonb_array_length(COALESCE(facts_learned, '[]'::jsonb)) as facts_count,
  jsonb_array_length(COALESCE(buying_signals, '[]'::jsonb)) as signals_count,
  jsonb_array_length(COALESCE(communication_history, '[]'::jsonb)) as history_count,
  context_summary IS NOT NULL as has_summary
FROM relationship_intelligence
WHERE company_id = '[HAPPINEST_ID]';
```

**If 0 or empty arrays:** RI isn't being populated from emails/transcripts.

### Gap D: Command Center Items Missing Company Link?
```sql
-- CC items that mention Happinest but aren't linked
SELECT id, title, company_id
FROM command_center_items
WHERE title ILIKE '%happinest%'
  AND company_id IS NULL;
```

---

## Phase 3: Trace the Code Paths

### 3.1 Where Does Email → RI Happen?

```bash
# Find where relationship_intelligence is updated from emails
grep -r "relationship_intelligence" src/lib/email --include="*.ts"
grep -r "relationship_intelligence" src/lib/intelligence --include="*.ts" | grep -i "update\|insert\|upsert"
```

**Expected:** After email analysis, should call something like `updateRelationshipIntelligence()`

### 3.2 Where Does Transcript → RI Happen?

```bash
# Find where relationship_intelligence is updated from transcripts
grep -r "relationship_intelligence" src/lib/pipelines --include="*.ts"
grep -r "relationship_intelligence" src/lib/fireflies --include="*.ts"
```

**Expected:** After transcript analysis, should update RI.

### 3.3 Check processInboundEmail Flow

```bash
cat src/lib/email/processInboundEmail.ts
```

**Look for:**
- Does it call any RI update function?
- Where does analysis result go?
- Is there a call to update relationship_intelligence table?

### 3.4 Check processTranscriptAnalysis Flow

```bash
cat src/lib/pipelines/processTranscriptAnalysis.ts
```

**Look for:**
- Does it call any RI update function?
- Where does analysis result go?

### 3.5 Check the API Endpoint

```bash
cat src/app/api/companies/[id]/intelligence/route.ts
```

**Look for:**
- What tables is it querying?
- Is it joining relationship_intelligence correctly?
- What's being returned to the UI?

---

## Phase 4: Expected Flow vs Actual Flow

### Expected: Email Flow
```
Email arrives
    ↓
processInboundEmail() runs
    ↓
Entity matcher finds Happinest → sets company_id
    ↓
AI analyzes email → extracts facts, signals, commitments
    ↓
updateRelationshipIntelligence() called ← IS THIS HAPPENING?
    ↓
relationship_intelligence table updated with:
  - New facts in facts_learned[]
  - New signals in buying_signals[]
  - New entry in communication_history[]
    ↓
/api/companies/[id]/intelligence returns data
    ↓
UI shows in Relationship Context tab
```

### Expected: Transcript Flow
```
Transcript synced from Fireflies
    ↓
processTranscriptAnalysis() runs
    ↓
Entity matcher finds Happinest → sets company_id
    ↓
AI analyzes transcript → extracts commitments, facts, signals
    ↓
updateRelationshipIntelligence() called ← IS THIS HAPPENING?
    ↓
relationship_intelligence table updated
    ↓
Command Center items created with proper tier
    ↓
UI shows in Relationship Context tab
```

---

## Phase 5: Find the Missing Link

### 5.1 Check if updateRelationshipIntelligence Exists

```bash
# Find the RI update function
grep -r "updateRelationshipIntelligence\|upsertRelationship\|saveRelationship" src/lib --include="*.ts"
```

### 5.2 Check relationshipStore.ts

```bash
cat src/lib/intelligence/relationshipStore.ts
```

**This should have functions to:**
- Add facts
- Add signals
- Add communication history
- Update context summary

### 5.3 Check if It's Being Called

```bash
# Is relationshipStore being imported and used?
grep -r "relationshipStore\|RelationshipStore" src/lib/email --include="*.ts"
grep -r "relationshipStore\|RelationshipStore" src/lib/pipelines --include="*.ts"
```

**If NOT found:** That's the gap - RI isn't being updated!

---

## Phase 6: Specific Fix Based on Findings

### If Gap is "RI Not Being Updated":

Add to processInboundEmail.ts:
```typescript
import { updateRelationshipIntelligence } from '@/lib/intelligence/relationshipStore';

// After analysis completes:
if (analysis && companyId) {
  await updateRelationshipIntelligence({
    companyId,
    contactId,
    facts: analysis.facts_learned || [],
    signals: analysis.buying_signals || [],
    communication: {
      type: 'email',
      date: email.received_at,
      summary: analysis.summary,
      source_id: email.id
    }
  });
}
```

Add to processTranscriptAnalysis.ts:
```typescript
// After transcript analysis:
if (analysis && transcript.company_id) {
  await updateRelationshipIntelligence({
    companyId: transcript.company_id,
    contactId: transcript.contact_id,
    facts: analysis.facts_learned || [],
    signals: analysis.buying_signals || [],
    commitmentsMade: analysis.commitments_we_made || [],
    commitmentsReceived: analysis.commitments_they_made || [],
    communication: {
      type: 'transcript',
      date: transcript.meeting_date,
      summary: analysis.summary,
      source_id: transcript.id
    }
  });
}
```

### If Gap is "API Not Returning RI":

Fix /api/companies/[id]/intelligence/route.ts to properly query and return RI data.

### If Gap is "UI Not Displaying":

Check the React components are actually rendering the data.

---

## Phase 7: Reprocess Happinest Data

After fixes, manually reprocess:

### Reprocess Emails
```sql
-- Mark Happinest emails for reprocessing
UPDATE email_messages
SET processed_for_cc = false, analysis_complete = false
WHERE company_id = '[HAPPINEST_ID]';
```

Then trigger: `curl http://localhost:3000/api/cron/analyze-emails?inbound_limit=20`

### Reprocess Transcripts
```sql
-- Mark Happinest transcripts for reprocessing
UPDATE meeting_transcriptions
SET analysis_status = 'pending'
WHERE company_id = '[HAPPINEST_ID]';
```

Then trigger: `curl http://localhost:3000/api/cron/process-transcripts`

---

## Phase 8: Verify Everything Works

### 8.1 Check RI Populated
```sql
SELECT 
  company_id,
  jsonb_array_length(COALESCE(facts_learned, '[]'::jsonb)) as facts,
  jsonb_array_length(COALESCE(buying_signals, '[]'::jsonb)) as signals,
  jsonb_array_length(COALESCE(communication_history, '[]'::jsonb)) as history,
  context_summary IS NOT NULL as has_summary
FROM relationship_intelligence
WHERE company_id = '[HAPPINEST_ID]';
```

### 8.2 Check API Returns Data
```bash
curl http://localhost:3000/api/companies/[HAPPINEST_ID]/intelligence | jq
```

### 8.3 Check UI Shows Data
Open the Happinest company page → Relationship Context tab → Verify data displays

### 8.4 Check Command Center
```sql
SELECT tier, COUNT(*) 
FROM command_center_items 
WHERE company_id = '[HAPPINEST_ID]'
GROUP BY tier;
```

---

## Deliverables

1. **Data inventory:** What Happinest data exists in each table
2. **Gap identification:** Which step in the flow is broken
3. **Code fix:** The specific change needed
4. **Verification:** Proof that data flows end-to-end

---

## Quick Start Prompt for Claude Code

```
End-to-end diagnostic for Happinest. Data exists but isn't flowing to Relationship Context.

Phase 1 - Find Happinest data:

SELECT id, name FROM companies WHERE name ILIKE '%happinest%';
-- Save this ID as HAPPINEST_ID

SELECT COUNT(*) as emails FROM email_messages WHERE company_id = '[HAPPINEST_ID]';
SELECT COUNT(*) as transcripts FROM meeting_transcriptions WHERE company_id = '[HAPPINEST_ID]';
SELECT COUNT(*) as ri_records FROM relationship_intelligence WHERE company_id = '[HAPPINEST_ID]';
SELECT COUNT(*) as cc_items FROM command_center_items WHERE company_id = '[HAPPINEST_ID]';

Phase 2 - Check what's in RI:

SELECT facts_learned, buying_signals, communication_history, context_summary
FROM relationship_intelligence WHERE company_id = '[HAPPINEST_ID]';

Phase 3 - Find the gap:

grep -r "relationship_intelligence" src/lib/email --include="*.ts"
grep -r "relationship_intelligence" src/lib/pipelines --include="*.ts"
grep -r "updateRelationshipIntelligence\|relationshipStore" src/lib --include="*.ts"

Phase 4 - Check if RI update is called:

cat src/lib/email/processInboundEmail.ts | grep -A 5 -B 5 "relationship"
cat src/lib/pipelines/processTranscriptAnalysis.ts | grep -A 5 -B 5 "relationship"

Phase 5 - Find and fix the missing connection:

If RI isn't being updated from emails/transcripts, add the calls.
Show me exactly where in the code the gap is.

Then we'll reprocess Happinest data and verify it flows through.
```
