# Command Center: Fix All Tier Gaps

## Overview

Diagnostic found 6 gaps causing only Tier 3 & 5 to populate. This prompt fixes all of them.

**Priority Order:**
1. Gap 3: source_id (View Source broken) - CRITICAL
2. Gap 1: Communication type aliases + AI prompt update
3. Gap 2: Add meeting_commitment mapping
4. Gap 4: Backfill deal_stale items to Tier 4
5. Gap 6: AI-based company extraction from email body

---

## Fix 1: Gap 3 - Set source_id (CRITICAL)

**Problem:** ALL items have `source_id = null`, breaking View Source.

### Fix 1a: processInboundEmail.ts

Find where CC items are inserted and add `source_id`:

```typescript
// In src/lib/email/processInboundEmail.ts
// Find the supabase.from('command_center_items').insert() call
// Add these fields:

await supabase.from('command_center_items').insert({
  // ... existing fields ...
  source: 'email_inbound',
  source_id: emailId,  // ADD THIS
  email_id: emailId,   // ADD THIS if column exists
});
```

### Fix 1b: processTranscriptAnalysis.ts

```typescript
// In src/lib/pipelines/processTranscriptAnalysis.ts
// Find where CC items are created for transcripts

await supabase.from('command_center_items').insert({
  // ... existing fields ...
  source: 'transcription',
  source_id: transcript.id,  // ADD THIS
  transcription_id: transcript.id,  // ADD THIS if column exists
});
```

### Fix 1c: createUnknownSenderItem (if exists)

```typescript
// In the unknown sender handler
await supabase.from('command_center_items').insert({
  // ... existing fields ...
  source: 'email_inbound',
  source_id: email.id,  // ADD THIS
});
```

---

## Fix 2: Gap 1 - Communication Type Aliases + AI Prompt

**Problem:** Pipeline returns `trial_request` but COMMUNICATION_TYPE_TIERS expects `free_trial_form`.

### Fix 2a: Add aliases to tierDetection.ts

```typescript
// In src/lib/commandCenter/tierDetection.ts
// Add these to COMMUNICATION_TYPE_TIERS:

export const COMMUNICATION_TYPE_TIERS: Record<string, TierInfo> = {
  // Existing entries...
  
  // === TIER 1 ALIASES ===
  trial_request: { tier: 1, sla_minutes: 15, why_now_template: 'Trial request needs immediate response.' },
  pricing_inquiry: { tier: 1, sla_minutes: 120, why_now_template: 'Pricing inquiry - prospect is evaluating.' },
  demo_inquiry: { tier: 1, sla_minutes: 15, why_now_template: 'Demo request needs immediate response.' },
  inbound_lead: { tier: 1, sla_minutes: 60, why_now_template: 'New inbound lead requires response.' },
  
  // === TIER 2 ALIASES ===
  objection: { tier: 2, sla_minutes: 480, why_now_template: 'Objection raised - address concerns.' },
  competitor: { tier: 2, sla_minutes: 480, why_now_template: 'Competitor mentioned - risk of losing deal.' },
  risk_signal: { tier: 2, sla_minutes: 480, why_now_template: 'Deal risk detected.' },
  
  // === TIER 3 ALIASES ===
  meeting_commitment: { tier: 3, sla_minutes: 1440, why_now_template: 'Commitment from meeting needs follow-through.' },
  follow_up: { tier: 3, sla_minutes: 1440, why_now_template: 'Follow-up promised.' },
  deliverable_promised: { tier: 3, sla_minutes: 1440, why_now_template: 'Deliverable was promised.' },
  
  // === TIER 5 ALIASES ===
  general: { tier: 5, sla_minutes: 4320, why_now_template: 'General communication - no urgency.' },
  informational: { tier: 5, sla_minutes: 4320, why_now_template: 'Informational - no action required.' },
  nurture: { tier: 5, sla_minutes: 4320, why_now_template: 'Nurture touch - build relationship.' },
  
  // === CATCH-ALL ===
  needs_ai_classification: { tier: 5, sla_minutes: 4320, why_now_template: 'Needs review.' },
};
```

### Fix 2b: Update AI Prompt to Return Exact Keys

Find where AI is prompted to classify emails and update the prompt:

```bash
# Find the AI classification prompt
grep -r "communication_type\|classify" src/lib/ai --include="*.ts" -l
grep -r "communication_type\|classify" src/lib/email --include="*.ts" -l
```

Update the prompt to be explicit:

```typescript
// In the AI prompt (likely in analyzeEmail.ts or contextFirstPipeline.ts):

const classificationPrompt = `
Analyze this email and return a classification.

For communication_type, use EXACTLY one of these values:
- demo_request (someone wants a demo)
- pricing_request (asking about pricing)
- trial_request (wants to start a trial)
- inbound_lead (new potential customer reaching out)
- objection_raised (expressing concerns or objections)
- competitor_mentioned (talking about a competitor)
- commitment_follow_up (following up on a promise)
- follow_up_general (general follow-up needed)
- question (asking a question)
- general (general communication)

For urgency, use: critical, high, medium, low

Return JSON:
{
  "communication_type": "one of above",
  "urgency": "high/medium/low",
  "summary": "brief summary"
}
`;
```

---

## Fix 3: Gap 2 - Add meeting_commitment

Already covered in Fix 2a above. Verify it's added to COMMUNICATION_TYPE_TIERS.

---

## Fix 4: Gap 4 - Backfill deal_stale Items

**Problem:** 15 items with `tier_trigger: deal_stale` are Tier 5, should be Tier 4.

```sql
-- Run this migration
UPDATE command_center_items
SET tier = 4
WHERE tier_trigger = 'deal_stale' 
AND tier = 5;

-- Verify
SELECT tier, COUNT(*) 
FROM command_center_items 
WHERE tier_trigger = 'deal_stale'
GROUP BY tier;
```

---

## Fix 5: Gap 6 - AI-Based Company Extraction

**Problem:** Regex patterns miss companies like "On The Fly" in email body.

### Fix 5a: Add AI extraction function to entityMatcher.ts

```typescript
// In src/lib/intelligence/entityMatcher.ts

import { generateObject } from 'ai';  // or your AI client

/**
 * Extract company names from email content using AI
 */
async function extractCompaniesFromContent(
  subject: string,
  body: string
): Promise<string[]> {
  try {
    const prompt = `Extract all company or business names mentioned in this email.
    
Subject: ${subject}

Body:
${body?.substring(0, 2000)}

Return a JSON array of company names only. If no companies mentioned, return [].
Example: ["Acme Corp", "TechStart Inc"]`;

    const result = await generateObject({
      model: 'gpt-4o-mini',  // or your preferred model
      prompt,
      schema: {
        type: 'array',
        items: { type: 'string' }
      }
    });
    
    return result || [];
  } catch (error) {
    console.warn('[EntityMatcher] AI extraction failed:', error);
    return [];
  }
}

/**
 * Try to match extracted company names against database
 */
async function matchExtractedCompanies(
  extractedNames: string[],
  supabase: SupabaseClient
): Promise<{ companyId: string; companyName: string } | null> {
  for (const name of extractedNames) {
    // Try exact match first
    const { data: exactMatch } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', name)
      .limit(1)
      .single();
    
    if (exactMatch) {
      return { companyId: exactMatch.id, companyName: exactMatch.name };
    }
    
    // Try fuzzy match (contains)
    const { data: fuzzyMatch } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();
    
    if (fuzzyMatch) {
      return { companyId: fuzzyMatch.id, companyName: fuzzyMatch.name };
    }
    
    // Try matching individual words (for "On The Fly Pest Solutions" → "On The Fly")
    const words = name.split(' ').filter(w => w.length > 2);
    if (words.length >= 2) {
      const partialName = words.slice(0, 3).join(' ');
      const { data: partialMatch } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${partialName}%`)
        .limit(1)
        .single();
      
      if (partialMatch) {
        return { companyId: partialMatch.id, companyName: partialMatch.name };
      }
    }
  }
  
  return null;
}
```

### Fix 5b: Integrate into main entity matching flow

```typescript
// In the main intelligentEntityMatch function, add AI extraction as a fallback:

export async function intelligentEntityMatch(
  email: EmailMessage,
  supabase: SupabaseClient
): Promise<EntityMatchResult> {
  // 1. Try domain matching (existing logic)
  const domainMatch = await matchByDomain(email.from_email, supabase);
  if (domainMatch) return domainMatch;
  
  // 2. Try contact email matching (existing logic)
  const contactMatch = await matchByContactEmail(email.from_email, supabase);
  if (contactMatch) return contactMatch;
  
  // 3. NEW: Try AI extraction from email body
  const extractedCompanies = await extractCompaniesFromContent(
    email.subject || '',
    email.body_text || ''
  );
  
  if (extractedCompanies.length > 0) {
    const aiMatch = await matchExtractedCompanies(extractedCompanies, supabase);
    if (aiMatch) {
      return {
        companyId: aiMatch.companyId,
        companyName: aiMatch.companyName,
        matchedVia: 'ai_body_extraction',
        confidence: 0.7
      };
    }
  }
  
  // 4. No match found
  return { companyId: null, matchedVia: 'none', confidence: 0 };
}
```

---

## Fix 6: Backfill source_id on Existing Items

After fixing the code, backfill existing items:

```sql
-- Backfill email items
UPDATE command_center_items cci
SET source_id = em.id
FROM email_messages em
WHERE cci.source IN ('email_inbound', 'email_sync', 'email_ai_analysis')
AND cci.source_id IS NULL
AND cci.title LIKE '%' || em.subject || '%'
AND cci.created_at::date = em.received_at::date;

-- Backfill transcript items
UPDATE command_center_items cci
SET source_id = mt.id
FROM meeting_transcriptions mt
WHERE cci.source = 'transcription'
AND cci.source_id IS NULL
AND cci.title LIKE '%' || SPLIT_PART(mt.title, ':', 1) || '%';

-- Check results
SELECT source, 
  COUNT(*) as total,
  COUNT(source_id) as has_source_id
FROM command_center_items
GROUP BY source;
```

---

## Testing Checklist

After implementing fixes:

```sql
-- 1. Verify tier distribution improved
SELECT tier, COUNT(*) FROM command_center_items GROUP BY tier ORDER BY tier;

-- 2. Verify source_id is being set on new items
SELECT id, title, source, source_id 
FROM command_center_items 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Verify aliases work
SELECT tier_trigger, tier, COUNT(*) 
FROM command_center_items 
GROUP BY tier_trigger, tier 
ORDER BY tier;

-- 4. Test with voiceforpest email (should now match "On The Fly")
-- Reprocess that email and verify it matches the company
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/lib/commandCenter/tierDetection.ts` | Add communication type aliases |
| `src/lib/email/processInboundEmail.ts` | Set source_id on insert |
| `src/lib/pipelines/processTranscriptAnalysis.ts` | Set source_id on insert |
| `src/lib/intelligence/entityMatcher.ts` | Add AI-based company extraction |
| `src/lib/ai/*.ts` or email analyzer | Update AI prompt with exact keys |
| SQL migration | Fix deal_stale items, backfill source_id |

---

## Prompt for Claude Code

```
Fix Command Center tier gaps. Read /docs/specs/CLAUDE-CODE-PROMPT-Fix-Command-Center-Gaps.md

Execute in this order:

1. CRITICAL - Fix source_id (View Source broken):
   - In processInboundEmail.ts: add source_id: emailId to CC insert
   - In processTranscriptAnalysis.ts: add source_id: transcript.id to CC insert

2. Add communication type aliases to tierDetection.ts:
   - trial_request, pricing_inquiry, demo_inquiry → Tier 1
   - objection, competitor, risk_signal → Tier 2
   - meeting_commitment, follow_up, deliverable_promised → Tier 3
   - general, informational, nurture, needs_ai_classification → Tier 5

3. Backfill deal_stale items:
   UPDATE command_center_items SET tier = 4 
   WHERE tier_trigger = 'deal_stale' AND tier = 5;

4. Add AI company extraction to entityMatcher.ts:
   - Create extractCompaniesFromContent() using AI
   - Create matchExtractedCompanies() for fuzzy matching
   - Integrate as fallback in intelligentEntityMatch()

5. Update AI classification prompt to use exact tier_trigger values

6. Test:
   - Verify tier distribution: SELECT tier, COUNT(*) FROM command_center_items GROUP BY tier;
   - Verify source_id on new items
   - Reprocess voiceforpest email, verify "On The Fly" is matched

TypeScript must compile clean after all changes.
```
