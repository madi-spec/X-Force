# Tier 1: Unknown Sender Bucket

## Overview

When an inbound email arrives from a domain/contact NOT in the database, instead of skipping it, create a **Tier 1 CC item** for manual triage. These could be new leads that shouldn't be ignored.

---

## Current Behavior

```
Email from unknown sender arrives
    ↓
Context-first pipeline runs
    ↓
entityMatcher.ts fails to find company/contact
    ↓
Pipeline returns error: "Could not identify company or contact"
    ↓
NO CC item created ❌
```

## Desired Behavior

```
Email from unknown sender arrives
    ↓
Context-first pipeline runs
    ↓
entityMatcher.ts fails to find company/contact
    ↓
Create TIER 1 CC item: "Unknown Sender: Triage Required" ✅
    ↓
Salesperson sees it, decides to:
  - Add as new company/contact
  - Mark as spam/ignore
  - Respond directly
```

---

## Implementation

### 1. Update processInboundEmail.ts

When the pipeline fails due to no company/contact match, create a special CC item:

```typescript
// In processInboundEmail.ts, where the error is caught:

if (error.message.includes('Could not identify company or contact')) {
  // Create Tier 1 CC item for unknown sender
  await createUnknownSenderItem(email);
  return { success: true, skipped: false, unknownSender: true };
}
```

### 2. Create createUnknownSenderItem Function

```typescript
async function createUnknownSenderItem(email: EmailMessage) {
  const senderDomain = email.from_email?.split('@')[1] || 'unknown';
  const senderName = email.from_name || email.from_email || 'Unknown';
  
  await supabase.from('command_center_items').insert({
    title: `Unknown Sender: ${senderName}`,
    description: `New inbound email from ${email.from_email} (${senderDomain}). Review and decide: add as contact, respond, or ignore.`,
    tier: 1,
    tier_trigger: 'unknown_sender',
    why_now: `Inbound email from unknown sender - could be a new lead`,
    source: 'email_inbound',
    source_id: email.id,
    status: 'pending',
    sla_minutes: 60, // 1 hour to triage
    workflow_steps: JSON.stringify([
      { title: 'Review email content', completed: false, owner: 'Sales' },
      { title: 'Decide: Add contact, respond, or ignore', completed: false, owner: 'Sales' },
      { title: 'Take action', completed: false, owner: 'Sales' }
    ]),
    metadata: {
      sender_email: email.from_email,
      sender_name: email.from_name,
      sender_domain: senderDomain,
      subject: email.subject,
      requires_triage: true
    },
    user_id: email.user_id,
    created_at: new Date().toISOString()
  });
  
  // Mark email as processed
  await supabase
    .from('email_messages')
    .update({ processed_for_cc: true })
    .eq('id', email.id);
}
```

### 3. Add unknown_sender to COMMUNICATION_TYPE_TIERS

In `src/lib/commandCenter/tierDetection.ts`:

```typescript
export const COMMUNICATION_TYPE_TIERS: Record<string, TierInfo> = {
  // ... existing types ...
  
  unknown_sender: {
    tier: 1,
    sla_minutes: 60,
    why_now_template: 'New inbound from unknown sender - potential lead requires triage'
  },
};
```

### 4. Add unknown_sender to TierTrigger Type

In `src/types/commandCenter.ts`:

```typescript
export type TierTrigger = 
  | 'demo_request'
  | 'pricing_request'
  // ... existing types ...
  | 'unknown_sender';  // ADD THIS
```

### 5. Update UI to Show Unknown Sender Items Distinctively

In the Command Center UI, these items should stand out:

```tsx
// In TierSection.tsx or similar
{item.tier_trigger === 'unknown_sender' && (
  <Badge variant="warning">New Lead?</Badge>
)}
```

### 6. Add Quick Actions for Unknown Sender Items

When viewing an unknown sender item, show:
- **Add as Contact** button → Opens contact creation with email pre-filled
- **Add as Company** button → Opens company creation with domain pre-filled  
- **Mark as Spam** button → Dismisses item, optionally blocks domain
- **Reply** button → Opens email composer

---

## Testing

1. Find an email from an unknown sender:
```sql
SELECT id, from_email, subject 
FROM email_messages 
WHERE processed_for_cc = false
LIMIT 5;
```

2. Trigger processing:
```bash
curl "http://localhost:3000/api/cron/analyze-emails?inbound_limit=10"
```

3. Verify CC item created:
```sql
SELECT id, title, tier, tier_trigger 
FROM command_center_items 
WHERE tier_trigger = 'unknown_sender';
```

4. Verify it shows in Tier 1 in the UI

---

## Edge Cases

### Already Processed Emails
Don't reprocess emails that already have CC items (check source_id)

### Spam Detection
Consider adding basic spam detection:
- Known spam domains
- Obvious spam patterns
- Auto-mark as spam instead of Tier 1

### Bulk Unknown Senders
If many emails from same unknown domain:
- Group into single CC item?
- Or show count in description?

---

## Prompt for Claude Code

```
Read /docs/specs/CLAUDE-CODE-PROMPT-Unknown-Sender-Tier1.md

Implement Tier 1 handling for unknown senders:

1. In src/lib/email/processInboundEmail.ts:
   - Catch the "Could not identify company or contact" error
   - Call new createUnknownSenderItem() function
   - Mark email as processed_for_cc=true

2. Create createUnknownSenderItem() function that:
   - Creates Tier 1 CC item with tier_trigger='unknown_sender'
   - Includes sender info in metadata
   - Has triage workflow steps
   - 60 minute SLA

3. Add 'unknown_sender' to COMMUNICATION_TYPE_TIERS in tierDetection.ts

4. Add 'unknown_sender' to TierTrigger type

5. Test with the stuck email:
   SELECT id FROM email_messages WHERE from_email LIKE '%voiceforpest%';
   
   Then trigger processing and verify CC item created.
```
