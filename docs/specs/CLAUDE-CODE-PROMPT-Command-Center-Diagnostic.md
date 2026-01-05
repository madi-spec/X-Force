# Command Center Comprehensive Diagnostic

## Problem Summary

Only 2 of 5 tiers are being populated:
- ✅ Tier 3 (Keep Your Word) - Working, has "View Source"
- ✅ Tier 5 (Build Pipeline) - Working, no "View Source"
- ❌ Tier 1 (Respond Now) - Empty or rare
- ❌ Tier 2 (Don't Lose This) - Empty
- ❌ Tier 4 (Move Big Deals) - Empty

Additional issue: Email from sales team member mentioned "On The Fly" customer in body and attachment, but entity wasn't matched.

---

## Phase 1: Database Diagnostics

### 1.1 Tier Distribution
```sql
-- What tiers exist and how many items each?
SELECT 
  tier,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM command_center_items
GROUP BY tier
ORDER BY tier;
```

### 1.2 Tier + Trigger Breakdown
```sql
-- What tier_triggers are being used?
SELECT 
  tier,
  tier_trigger,
  COUNT(*) as count
FROM command_center_items
GROUP BY tier, tier_trigger
ORDER BY tier, count DESC;
```

### 1.3 Source Types
```sql
-- Where are items coming from?
SELECT 
  source,
  tier,
  COUNT(*) as count
FROM command_center_items
GROUP BY source, tier
ORDER BY count DESC;
```

### 1.4 Recent Items Detail
```sql
-- Last 20 items with full detail
SELECT 
  id,
  title,
  tier,
  tier_trigger,
  source,
  source_id,
  company_id,
  created_at
FROM command_center_items
ORDER BY created_at DESC
LIMIT 20;
```

---

## Phase 2: Email Analysis Investigation

### 2.1 Check Email AI Analysis Output
```sql
-- What is the AI actually returning for emails?
SELECT 
  id,
  subject,
  from_email,
  analysis_result->'command_center_classification' as cc_classification,
  analysis_result->'email_analysis'->'communication_type' as comm_type,
  analysis_result->'email_analysis'->'urgency' as urgency,
  processed_for_cc
FROM email_messages
WHERE analysis_complete = true
ORDER BY received_at DESC
LIMIT 10;
```

### 2.2 Find the Voiceforpest Email
```sql
-- Get the specific email that should have matched "On The Fly"
SELECT 
  id,
  subject,
  from_email,
  from_name,
  body_text,
  analysis_result
FROM email_messages
WHERE from_email LIKE '%voiceforpest%'
   OR from_email LIKE '%rkidwell%';
```

### 2.3 Check if "On The Fly" Company Exists
```sql
-- Does the company exist?
SELECT id, name, domain 
FROM companies 
WHERE name ILIKE '%on the fly%' 
   OR name ILIKE '%onthefly%'
   OR domain ILIKE '%onthefly%';
```

---

## Phase 3: Entity Matcher Analysis

### 3.1 Check Entity Matcher Logic
```bash
# What does entityMatcher.ts actually do?
cat src/lib/intelligence/entityMatcher.ts
```

**Questions to answer:**
- Does it only look at from_email/to_email?
- Does it parse email body for company names?
- Does it use AI to extract entities?
- Does it check attachments?

### 3.2 Check What Entity Matcher Returns
```bash
# Find where entity matching result is logged/stored
grep -r "entityMatch\|intelligentEntityMatch" src/lib/email --include="*.ts" -A 5
```

---

## Phase 4: Tier Detection Analysis

### 4.1 Check COMMUNICATION_TYPE_TIERS Mapping
```bash
# What types map to which tiers?
cat src/lib/commandCenter/tierDetection.ts
```

**Verify these mappings exist:**

| Tier | Expected Triggers |
|------|-------------------|
| 1 | demo_request, pricing_request, trial_signup, inbound_inquiry, unknown_sender |
| 2 | competitor_mentioned, deal_at_risk, deadline_pressure, objection_raised |
| 3 | commitment_made, follow_up_promised, deliverable_due |
| 4 | large_deal_stale, strategic_account, high_value_inactive |
| 5 | nurture, cold_outreach, no_urgency, default |

### 4.2 Check How Tier is Assigned in Pipeline
```bash
# Trace tier assignment
grep -r "tier_trigger\|tier:" src/lib/email/processInboundEmail.ts -B 2 -A 2
grep -r "tier_trigger\|tier:" src/lib/intelligence/contextFirstPipeline.ts -B 2 -A 2
```

---

## Phase 5: View Source Investigation

### 5.1 Check Source Data on Items
```sql
-- Items with and without source_id
SELECT 
  tier,
  source,
  CASE WHEN source_id IS NOT NULL THEN 'has_source' ELSE 'no_source' END as has_source,
  COUNT(*) as count
FROM command_center_items
GROUP BY tier, source, has_source
ORDER BY tier;
```

### 5.2 Check UI Component Logic
```bash
# How does View Source button decide to show?
grep -r "view.*source\|source_id\|View Source" src/components/commandCenter --include="*.tsx" -B 2 -A 2
```

---

## Phase 6: AI Prompt Analysis

### 6.1 Check What AI is Asked to Return
```bash
# Find the prompt that asks AI to classify emails
grep -r "command_center_classification\|tier\|communication_type" src/lib/ai --include="*.ts" -B 5 -A 10
```

**Questions:**
- Is the AI prompt asking for tier_trigger?
- Is it asking for urgency signals?
- Is it asking to extract company names from body?

### 6.2 Check Email Analysis Prompt
```bash
cat src/lib/email/analyzeEmail.ts
# or
cat src/lib/intelligence/emailAnalyzer.ts
```

---

## Phase 7: Specific Fixes Needed

Based on diagnostics, likely fixes:

### Fix 1: Entity Matcher - Parse Email Body
```typescript
// entityMatcher.ts should:
// 1. Extract company names from email body using AI
// 2. Match extracted names against companies table
// 3. Check attachments if available

async function extractEntitiesFromContent(email: Email) {
  const prompt = `Extract company and person names from this email:
  Subject: ${email.subject}
  Body: ${email.body_text}
  
  Return JSON: { companies: string[], people: string[] }`;
  
  const extracted = await callAI(prompt);
  
  // Try to match extracted companies
  for (const companyName of extracted.companies) {
    const match = await fuzzyMatchCompany(companyName);
    if (match) return match;
  }
}
```

### Fix 2: Ensure AI Returns Tier-Appropriate Triggers
```typescript
// The AI prompt should explicitly ask for communication_type
// that maps to our tier system:

const prompt = `Analyze this email and classify it.

Return communication_type as ONE of:
- demo_request (Tier 1)
- pricing_request (Tier 1)
- trial_signup (Tier 1)
- inbound_inquiry (Tier 1)
- competitor_mentioned (Tier 2)
- deal_at_risk (Tier 2)
- commitment_follow_up (Tier 3)
- ...etc
`;
```

### Fix 3: Ensure View Source Works for All Sources
```typescript
// In UI component:
const canViewSource = item.source_id && 
  ['transcription', 'email_inbound', 'email_sync'].includes(item.source);
```

---

## Deliverables

After running diagnostics:

1. **Report on actual tier distribution** - What % of items are in each tier
2. **List of missing tier_triggers** - What triggers are defined but never used
3. **Entity matcher gaps** - Does it parse body? Attachments?
4. **AI prompt gaps** - Is it asking for the right classification?
5. **Specific code fixes** - Exact changes needed

---

## Quick Start Prompt for Claude Code

```
Diagnose why Command Center only has Tier 3 and Tier 5 items.

Run these queries:

1. SELECT tier, tier_trigger, source, COUNT(*) 
   FROM command_center_items 
   GROUP BY tier, tier_trigger, source 
   ORDER BY tier;

2. SELECT tier, 
     CASE WHEN source_id IS NOT NULL THEN 'has_source' ELSE 'no_source' END,
     COUNT(*)
   FROM command_center_items GROUP BY tier, 2;

3. SELECT subject, from_email,
     analysis_result->'command_center_classification' as cc_class
   FROM email_messages 
   WHERE analysis_complete = true
   LIMIT 10;

Then check:
4. cat src/lib/commandCenter/tierDetection.ts | grep -A 50 "COMMUNICATION_TYPE_TIERS"

5. cat src/lib/intelligence/entityMatcher.ts | head -100

6. grep -r "body_text\|email.*body" src/lib/intelligence/entityMatcher.ts

Identify:
- Why aren't Tier 1, 2, 4 being created?
- Is AI returning tier_triggers that don't map to tiers?
- Does entity matcher look at email body?

Then propose specific fixes.
```
