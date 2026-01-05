# Fix: Remove Keyword Detection, Use AI Analysis for Tiers

## Problem

A recent "fix" added keyword-based tier detection:
```typescript
// THIS IS WRONG - violates our architecture:
const tier1Keywords = ['trial', 'immediately respond', 'respond with', ...];
if (title.toLowerCase().includes(keyword)) { return tier1; }
```

**This completely undermines the context-first architecture.**

The correct approach: Tiers should be derived from **AI analysis results** using the **Sales Playbook**.

---

## How It Should Work

### The Pipeline
```
Email Arrives
    ↓
processIncomingCommunication() runs AI analysis
    ↓
AI returns: {
  communicationType: 'demo_request',  // ← This determines tier
  urgency: 'high',
  buyingSignals: [...],
  requiredActions: [...]
}
    ↓
Sales Playbook maps communicationType → tier:
  'demo_request' → Tier 1
  'pricing_request' → Tier 1
  'follow_up_required' → Tier 3
    ↓
CC item created with correct tier FROM ANALYSIS
```

### The Sales Playbook Already Defines This

Check `src/lib/intelligence/salesPlaybook.ts`:

```typescript
export const SALES_PLAYBOOK = {
  communication_types: {
    demo_request: {
      tier: 1,
      sla_minutes: 15,
      description: 'Prospect requesting a demo'
    },
    pricing_request: {
      tier: 1,
      sla_minutes: 15,
      description: 'Prospect asking about pricing'
    },
    trial_signup: {
      tier: 1,
      sla_minutes: 15,
      description: 'Prospect signing up for trial'
    },
    question: {
      tier: 2,
      sla_minutes: 240,
      description: 'General question'
    },
    follow_up: {
      tier: 3,
      sla_minutes: 1440,
      description: 'Follow-up required'
    },
    // ... etc
  }
};
```

---

## Task 1: Remove Keyword-Based Detection

### Find and remove keyword matching in tierDetection.ts

```bash
cat src/lib/commandCenter/tierDetection.ts
```

Remove any code like:
```typescript
// DELETE THIS:
const tier1Keywords = ['trial', 'immediately respond', ...];
for (const keyword of tier1Keywords) {
  if (title.toLowerCase().includes(keyword)) {
    return { tier: 1, ... };
  }
}
```

---

## Task 2: Ensure AI Analysis Stores Communication Type

### Check processIncomingCommunication output

```bash
cat src/lib/intelligence/contextFirstPipeline.ts
```

The analysis should return `communicationType`. Verify it's being:
1. Returned from AI analysis
2. Stored somewhere accessible (on the CC item or source record)

### Update command_center_items table if needed

```sql
-- Check if communication_type column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'command_center_items' AND column_name = 'communication_type';

-- Add if missing
ALTER TABLE command_center_items 
ADD COLUMN IF NOT EXISTS communication_type TEXT;

ALTER TABLE command_center_items 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
```

---

## Task 3: Wire Tier Detection to Use Playbook

### Update tierDetection.ts

```typescript
import { SALES_PLAYBOOK } from '@/lib/intelligence/salesPlaybook';

export function detectTier(item: CommandCenterItem): TierResult {
  // Get communication type from item (set during analysis)
  const communicationType = item.communication_type || item.ai_analysis?.communicationType;
  
  if (communicationType) {
    // Look up tier from playbook
    const playbookEntry = SALES_PLAYBOOK.communication_types[communicationType];
    if (playbookEntry) {
      return {
        tier: playbookEntry.tier,
        sla_minutes: playbookEntry.sla_minutes,
        reason: `${communicationType}: ${playbookEntry.description}`,
        trigger_type: communicationType
      };
    }
  }
  
  // Fallback for items without analysis (legacy data)
  // Use source type as hint, NOT keywords
  if (item.source === 'email_inbound') {
    // Unanalyzed inbound email - default to Tier 2 until analyzed
    return {
      tier: 2,
      reason: 'Inbound email pending analysis',
      trigger_type: 'pending_analysis'
    };
  }
  
  // Default
  return {
    tier: 4,
    reason: 'Standard priority',
    trigger_type: 'default'
  };
}
```

---

## Task 4: Ensure CC Items Get Communication Type at Creation

### Find where CC items are created for emails

```bash
grep -r "command_center_items" src/lib/intelligence --include="*.ts" | grep -i "insert\|create"
grep -r "command_center_items" src/lib/email --include="*.ts" | grep -i "insert\|create"
```

### Update to include communication_type

```typescript
// When creating CC item from email analysis:
await supabase.from('command_center_items').insert({
  title: generateTitle(analysis),
  source: 'email_inbound',
  source_id: emailId,
  company_id: entityMatch.companyId,
  contact_id: entityMatch.contactId,
  
  // ADD THESE - from AI analysis:
  communication_type: analysis.communicationType,
  ai_analysis: analysis,
  tier: SALES_PLAYBOOK.communication_types[analysis.communicationType]?.tier || 4,
  
  // ... other fields
});
```

---

## Task 5: Verify the Full Flow

### Test with a real email

1. Find a recent inbound email:
```sql
SELECT id, subject, from_address FROM email_messages 
WHERE direction = 'inbound' 
ORDER BY received_at DESC LIMIT 1;
```

2. Manually trigger analysis (or check if it ran):
```sql
SELECT id, subject, analysis_status, analyzed_at 
FROM email_messages WHERE id = '[EMAIL_ID]';
```

3. Check CC item was created with communication_type:
```sql
SELECT id, title, tier, communication_type, ai_analysis 
FROM command_center_items 
WHERE source_id = '[EMAIL_ID]';
```

4. Verify tier matches playbook:
```typescript
// If communication_type = 'demo_request'
// Then tier should = 1 (from playbook)
```

---

## Task 6: Backfill Existing Items

For items created before this fix:

```sql
-- Update items that have ai_analysis but no communication_type
UPDATE command_center_items
SET communication_type = ai_analysis->>'communicationType'
WHERE ai_analysis IS NOT NULL 
AND communication_type IS NULL;

-- Reclassify tiers based on communication_type
-- (Run the classify-tiers cron after this)
```

---

## Verification Checklist

- [ ] Keyword matching code REMOVED from tierDetection.ts
- [ ] tierDetection.ts uses SALES_PLAYBOOK for tier lookup
- [ ] CC item creation includes communication_type from analysis
- [ ] Existing items backfilled
- [ ] classify-tiers cron uses new logic
- [ ] Test: demo_request email → Tier 1
- [ ] Test: general question email → Tier 2
- [ ] Test: follow-up email → Tier 3

---

## Expected Outcome

```
BEFORE (wrong):
  Email with "trial" in subject → Tier 1 (keyword match)
  Email asking about pricing → Tier 4 (no keyword match)

AFTER (correct):
  Email with "trial" in subject → AI analyzes → communicationType: 'trial_signup' → Tier 1
  Email asking about pricing → AI analyzes → communicationType: 'pricing_request' → Tier 1
  Email saying "following up" → AI analyzes → communicationType: 'follow_up' → Tier 3
```

The AI UNDERSTANDS the email. It doesn't just scan for words.

---

## Files to Modify

1. `src/lib/commandCenter/tierDetection.ts` - Remove keywords, use playbook
2. `src/lib/intelligence/contextFirstPipeline.ts` - Ensure communicationType returned
3. Wherever CC items are created - Include communication_type
4. `src/lib/intelligence/salesPlaybook.ts` - Verify tier mappings complete
5. Migration for `communication_type` column if needed
