# Communication Hub: Phase 4 - Integration & Live Wiring

## Context (Claude Code Restart)

You're working on the X-FORCE CRM. Key documents:

- **Project State:** `/docs/specs/X-FORCE-CRM-Project-State.md`
- **Communication Hub Spec:** `/docs/specs/X-FORCE-Communication-Hub-Specification-v2.md`
- **Codebase:** Next.js 14, Supabase, TypeScript

The Communication Hub has been built (Phases 1-3):
- `communications` table exists with 113 records (backfilled)
- `communication_analysis` table exists with AI analysis
- `promises` table exists with extracted commitments
- Three-panel UI at `/communications` is working

**Problem:** New emails and transcripts aren't flowing into the communications table. The old pipelines still write to `email_messages` and `meeting_transcriptions` but don't sync to `communications`.

---

## Phase 4 Goals

1. **Re-sync all existing data** - Catch any emails/transcripts added since last backfill
2. **Wire live email flow** - New emails automatically sync to communications
3. **Wire live transcript flow** - New transcripts automatically sync to communications
4. **Trigger analysis** - New communications get analyzed automatically

---

## Tasks

### Task 1: Update Backfill Script to Be Re-runnable

The current backfill script should skip already-synced items. Verify `scripts/backfill-communications.ts` checks for existing records before inserting.

Run the backfill to catch anything new:
```bash
npx ts-node scripts/backfill-communications.ts
```

### Task 2: Find Email Ingestion Points

Search the codebase for where emails are saved to `email_messages`:

```bash
# Find all places that insert into email_messages
grep -r "email_messages" --include="*.ts" --include="*.tsx" src/
grep -r "from_email\|to_email" --include="*.ts" src/lib/
grep -r "microsoft\|outlook\|graph" --include="*.ts" src/
```

Common locations:
- `/api/webhooks/microsoft` or `/api/webhooks/outlook`
- `/api/email/sync` or `/api/emails/sync`
- `/lib/email/` or `/lib/microsoft/`
- Cron jobs in `/api/cron/`

### Task 3: Wire Email → Communications Sync

Once you find where emails are inserted, add the sync call. 

Create a helper function in `src/lib/communicationHub/sync/syncEmail.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

interface EmailMessage {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  to_name: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_sent_by_user: boolean;
  conversation_id: string | null;
  message_id: string | null;
  attachments: any[];
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  user_id: string | null;
}

export async function syncEmailToCommunication(emailId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // Fetch email
  const { data: email, error: emailError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', emailId)
    .single();
  
  if (emailError || !email) {
    console.error(`[EmailSync] Email not found: ${emailId}`, emailError);
    return null;
  }
  
  // Check if already synced
  const { data: existing } = await supabase
    .from('communications')
    .select('id')
    .eq('source_table', 'email_messages')
    .eq('source_id', emailId)
    .single();
  
  if (existing) {
    console.log(`[EmailSync] Already synced: ${emailId}`);
    return existing.id;
  }
  
  // Convert to communication
  const isOutbound = email.is_sent_by_user;
  const communication = {
    channel: 'email',
    direction: isOutbound ? 'outbound' : 'inbound',
    occurred_at: email.received_at || email.sent_at || new Date().toISOString(),
    subject: email.subject,
    content_preview: email.body_text?.substring(0, 500) || null,
    full_content: email.body_text,
    content_html: email.body_html,
    attachments: email.attachments || [],
    our_participants: isOutbound
      ? [{ email: email.from_email || '', name: email.from_name || '', role: 'sender' }]
      : [{ email: email.to_email || '', name: email.to_name || '', role: 'recipient' }],
    their_participants: isOutbound
      ? [{ email: email.to_email || '', name: email.to_name || '' }]
      : [{ email: email.from_email || '', name: email.from_name || '' }],
    source_table: 'email_messages',
    source_id: email.id,
    external_id: email.message_id,
    thread_id: email.conversation_id,
    awaiting_our_response: !isOutbound,
    awaiting_their_response: isOutbound,
    response_sla_minutes: !isOutbound ? 240 : null,
    response_due_by: !isOutbound
      ? new Date(new Date(email.received_at || email.sent_at || Date.now()).getTime() + 4 * 60 * 60 * 1000).toISOString()
      : null,
    company_id: email.company_id,
    contact_id: email.contact_id,
    deal_id: email.deal_id,
    user_id: email.user_id,
    is_ai_generated: false,
    analysis_status: 'pending',
  };
  
  // Insert
  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();
  
  if (insertError) {
    console.error(`[EmailSync] Failed to insert:`, insertError);
    return null;
  }
  
  console.log(`[EmailSync] Synced email ${emailId} → communication ${inserted.id}`);
  
  // Trigger analysis (async, don't wait)
  triggerAnalysis(inserted.id).catch(console.error);
  
  return inserted.id;
}

async function triggerAnalysis(communicationId: string): Promise<void> {
  try {
    // Call the analysis endpoint
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/communications/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communication_id: communicationId }),
    });
  } catch (error) {
    console.error(`[EmailSync] Failed to trigger analysis:`, error);
  }
}
```

### Task 4: Hook Into Email Pipeline

Find the file where emails are inserted and add the sync call. Example patterns:

**Pattern A: After email insert in webhook/sync function**
```typescript
// Existing code that inserts email
const { data: email } = await supabase
  .from('email_messages')
  .insert(emailData)
  .select()
  .single();

// ADD THIS: Sync to communications
import { syncEmailToCommunication } from '@/lib/communicationHub/sync/syncEmail';
await syncEmailToCommunication(email.id);
```

**Pattern B: In a processing function**
```typescript
// After email is processed
async function processEmail(email: EmailMessage) {
  // ... existing processing ...
  
  // ADD THIS at the end
  await syncEmailToCommunication(email.id);
}
```

### Task 5: Wire Transcript → Communications Sync

Create `src/lib/communicationHub/sync/syncTranscript.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

export async function syncTranscriptToCommunication(transcriptId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // Fetch transcript
  const { data: transcript, error: transcriptError } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('id', transcriptId)
    .single();
  
  if (transcriptError || !transcript) {
    console.error(`[TranscriptSync] Transcript not found: ${transcriptId}`, transcriptError);
    return null;
  }
  
  // Check if already synced
  const { data: existing } = await supabase
    .from('communications')
    .select('id')
    .eq('source_table', 'meeting_transcriptions')
    .eq('source_id', transcriptId)
    .single();
  
  if (existing) {
    console.log(`[TranscriptSync] Already synced: ${transcriptId}`);
    return existing.id;
  }
  
  // Parse attendees
  const attendees = (transcript.attendees || []) as any[];
  const ourParticipants = attendees
    .filter((a) => a.is_internal)
    .map((a) => ({ name: a.name || '', email: a.email, role: a.role || 'attendee' }));
  const theirParticipants = attendees
    .filter((a) => !a.is_internal)
    .map((a) => ({ name: a.name || '', email: a.email, title: a.title }));
  
  const durationSeconds = transcript.duration_seconds
    || (transcript.duration_minutes ? transcript.duration_minutes * 60 : null);
  
  // Convert to communication
  const communication = {
    channel: 'meeting',
    direction: 'internal',
    occurred_at: transcript.meeting_date || new Date().toISOString(),
    duration_seconds: durationSeconds,
    subject: transcript.title,
    content_preview: transcript.summary?.substring(0, 500) || null,
    full_content: transcript.transcript_text,
    recording_url: transcript.video_url || transcript.audio_url,
    our_participants: ourParticipants,
    their_participants: theirParticipants,
    source_table: 'meeting_transcriptions',
    source_id: transcript.id,
    external_id: transcript.fireflies_id,
    awaiting_our_response: false,
    awaiting_their_response: false,
    company_id: transcript.company_id,
    contact_id: transcript.contact_id,
    deal_id: transcript.deal_id,
    user_id: transcript.user_id,
    is_ai_generated: false,
    analysis_status: 'pending',
  };
  
  // Insert
  const { data: inserted, error: insertError } = await supabase
    .from('communications')
    .insert(communication)
    .select('id')
    .single();
  
  if (insertError) {
    console.error(`[TranscriptSync] Failed to insert:`, insertError);
    return null;
  }
  
  console.log(`[TranscriptSync] Synced transcript ${transcriptId} → communication ${inserted.id}`);
  
  // Trigger analysis (async)
  triggerAnalysis(inserted.id).catch(console.error);
  
  return inserted.id;
}

async function triggerAnalysis(communicationId: string): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/communications/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communication_id: communicationId }),
    });
  } catch (error) {
    console.error(`[TranscriptSync] Failed to trigger analysis:`, error);
  }
}
```

### Task 6: Hook Into Transcript Pipeline

Find where transcripts are saved (likely `/api/webhooks/fireflies` or similar) and add:

```typescript
import { syncTranscriptToCommunication } from '@/lib/communicationHub/sync/syncTranscript';

// After transcript is inserted
await syncTranscriptToCommunication(transcript.id);
```

### Task 7: Create Sync Index File

Create `src/lib/communicationHub/sync/index.ts`:

```typescript
export { syncEmailToCommunication } from './syncEmail';
export { syncTranscriptToCommunication } from './syncTranscript';
```

### Task 8: Create Catch-up Cron (Optional but Recommended)

Create `/api/cron/sync-communications/route.ts` to catch any missed items:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncEmailToCommunication } from '@/lib/communicationHub/sync/syncEmail';
import { syncTranscriptToCommunication } from '@/lib/communicationHub/sync/syncTranscript';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  
  // Find emails not yet synced (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: unsyncedEmails } = await supabase
    .from('email_messages')
    .select('id')
    .gte('created_at', oneDayAgo)
    .not('id', 'in', 
      supabase
        .from('communications')
        .select('source_id')
        .eq('source_table', 'email_messages')
    );
  
  let emailsSynced = 0;
  for (const email of unsyncedEmails || []) {
    const result = await syncEmailToCommunication(email.id);
    if (result) emailsSynced++;
  }
  
  // Find transcripts not yet synced (last 24 hours)
  const { data: unsyncedTranscripts } = await supabase
    .from('meeting_transcriptions')
    .select('id')
    .gte('created_at', oneDayAgo)
    .not('id', 'in',
      supabase
        .from('communications')
        .select('source_id')
        .eq('source_table', 'meeting_transcriptions')
    );
  
  let transcriptsSynced = 0;
  for (const transcript of unsyncedTranscripts || []) {
    const result = await syncTranscriptToCommunication(transcript.id);
    if (result) transcriptsSynced++;
  }
  
  return NextResponse.json({
    success: true,
    emails_synced: emailsSynced,
    transcripts_synced: transcriptsSynced,
  });
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-communications",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Task 9: Run Full Re-sync

After wiring everything, run:

```bash
# Re-sync all historical data
npx ts-node scripts/backfill-communications.ts

# Then analyze any pending
curl -X POST http://localhost:3000/api/communications/analyze \
  -H "Content-Type: application/json" \
  -d '{"batch": true, "limit": 100}'
```

---

## Verification

1. **Check current counts:**
```sql
SELECT 
  (SELECT COUNT(*) FROM email_messages) as emails,
  (SELECT COUNT(*) FROM meeting_transcriptions) as transcripts,
  (SELECT COUNT(*) FROM communications) as communications,
  (SELECT COUNT(*) FROM communications WHERE source_table = 'email_messages') as comm_emails,
  (SELECT COUNT(*) FROM communications WHERE source_table = 'meeting_transcriptions') as comm_transcripts;
```

2. **Test live sync (if you have email sync running):**
- Send a test email
- Check if it appears in Communications Hub

3. **Navigate to /communications:**
- Should show more conversations
- Emails should appear in conversation threads

---

## Success Criteria

- [ ] Backfill script ran successfully (caught any new items)
- [ ] syncEmailToCommunication function created
- [ ] syncTranscriptToCommunication function created
- [ ] Found and hooked into email ingestion point
- [ ] Found and hooked into transcript ingestion point
- [ ] Catch-up cron created
- [ ] All emails from email_messages appear in communications
- [ ] All transcripts from meeting_transcriptions appear in communications
- [ ] New emails automatically sync (test if possible)
- [ ] TypeScript compiles clean
