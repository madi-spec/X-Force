# X-FORCE Bidirectional Inbox v2 — Relational Communication Engine

## Overview

Build a **conversation-centric email system** where salespeople work entirely in X-FORCE while Outlook stays perfectly organized. This isn't email sync — it's a **prioritized, deal-linked action system** that turns the inbox into a control center.

**Core Philosophy:**
- Reps think in **threads**, not messages
- Outlook owns **physical state** (folders, read/unread)
- X-FORCE owns **sales state** (deal links, priority, follow-up intent)
- Auto-linking must be **confidence-based** (wrong links destroy trust)
- The inbox becomes **"what matters and what to do next"**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           X-FORCE                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Daily Action Queue                              │   │
│  │  • Overdue Follow-ups (SLA breached)                             │   │
│  │  • High Priority Inbound                                         │   │
│  │  • Scheduling Threads → [Send to AI Scheduler]                   │   │
│  │  • Deal-Critical Conversations                                   │   │
│  │  • Returning from Snooze                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Conversation Views                              │   │
│  │  • Needs Action │ Awaiting Response │ Snoozed │ All              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│              Reconciliation Layer (handles conflicts)                   │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                Microsoft Graph API (Immutable IDs)                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Outlook                                          │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Inbox     │  │ X-FORCE         │  │ Sent Items      │              │
│  │ (active)    │  │ Processed       │  │ (normal)        │              │
│  └─────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Source of Truth Contract

**Make this visible to users in settings:**

```typescript
const SYNC_CONTRACT = {
  // OUTLOOK owns physical state
  outlook_owns: [
    'folder_location',
    'read_unread_status', 
    'outlook_flags',
    'deleted_status'
  ],
  
  // X-FORCE owns sales state
  xforce_owns: [
    'deal_link',
    'contact_link', 
    'company_link',
    'ai_priority',
    'ai_category',
    'sales_status',      // pending, awaiting_response, processed
    'snooze_intent',
    'follow_up_due',
    'sla_tracking'
  ],
  
  // When they conflict
  conflict_resolution: {
    user_moves_in_outlook: 'respect_and_adapt',
    user_deletes_in_outlook: 'mark_ignored_in_xforce',
    user_flags_in_outlook: 'boost_priority_in_xforce',
    xforce_and_outlook_disagree: 'show_conflict_badge_with_one_click_resolve'
  }
};
```

---

## Database Schema

### Core Tables

```sql
-- ============================================================
-- CONVERSATIONS (Primary Entity - Reps think in threads)
-- ============================================================
CREATE TABLE email_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Microsoft identifiers (IMMUTABLE)
  conversation_id VARCHAR(255) NOT NULL,      -- Graph conversationId
  
  -- Thread status (X-FORCE's source of truth)
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- 'pending'            = needs action from rep
  -- 'awaiting_response'  = we sent, waiting for reply
  -- 'snoozed'            = temporarily hidden
  -- 'processed'          = handled/archived
  -- 'ignored'            = not relevant
  
  -- Linking with confidence scoring
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  link_confidence INTEGER,                    -- 0-100
  link_method VARCHAR(30),                    -- 'auto_high', 'auto_suggested', 'manual', 'thread_inherited'
  link_reasoning TEXT,                        -- Human-readable explanation
  
  -- Thread metadata
  subject VARCHAR(1000),
  participant_emails TEXT[],                  -- All emails in thread
  participant_names TEXT[],
  message_count INTEGER DEFAULT 1,
  has_attachments BOOLEAN DEFAULT FALSE,
  
  -- Timeline tracking
  first_message_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_inbound_at TIMESTAMP WITH TIME ZONE,   -- When THEY last sent
  last_outbound_at TIMESTAMP WITH TIME ZONE,  -- When WE last sent
  
  -- SLA tracking
  response_due_at TIMESTAMP WITH TIME ZONE,
  sla_hours INTEGER,                          -- Expected response time
  sla_status VARCHAR(20) DEFAULT 'ok',        -- 'ok', 'warning', 'overdue'
  
  -- AI analysis (thread-level)
  ai_priority VARCHAR(20),                    -- 'high', 'medium', 'low'
  ai_category VARCHAR(50),                    -- 'pricing', 'scheduling', 'objection', etc.
  ai_sentiment VARCHAR(20),                   -- 'positive', 'neutral', 'negative', 'urgent'
  ai_sentiment_trend VARCHAR(30),             -- 'improving', 'stable', 'declining'
  ai_thread_summary TEXT,
  ai_suggested_action TEXT,
  ai_evidence_quotes TEXT[],                  -- Quotes supporting analysis
  
  -- Signal detection
  signals JSONB DEFAULT '{}',
  -- {
  --   cc_escalation: boolean,
  --   legal_procurement: boolean,
  --   competitor_mentions: string[],
  --   budget_discussed: boolean,
  --   timeline_mentioned: string,
  --   buying_signals: string[],
  --   objections: string[],
  --   scheduling_proposed: string[],
  --   out_of_office: { until: string, delegate?: string }
  -- }
  
  -- Snooze handling
  snoozed_until TIMESTAMP WITH TIME ZONE,
  snooze_reason VARCHAR(255),
  
  -- Draft handling
  has_pending_draft BOOLEAN DEFAULT FALSE,
  draft_confidence INTEGER,
  
  -- User management flag (don't fight user's filing)
  user_managed BOOLEAN DEFAULT FALSE,         -- User moved it manually, stop auto-organizing
  
  -- Sync state
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_conflict BOOLEAN DEFAULT FALSE,
  sync_conflict_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, conversation_id)
);

-- Indexes for conversation queries
CREATE INDEX idx_conversations_user_status ON email_conversations(user_id, status);
CREATE INDEX idx_conversations_user_priority ON email_conversations(user_id, ai_priority, status);
CREATE INDEX idx_conversations_sla ON email_conversations(user_id, sla_status, response_due_at) 
  WHERE status = 'awaiting_response';
CREATE INDEX idx_conversations_snoozed ON email_conversations(user_id, snoozed_until) 
  WHERE status = 'snoozed';
CREATE INDEX idx_conversations_deal ON email_conversations(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_conversations_company ON email_conversations(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_conversations_last_message ON email_conversations(user_id, last_message_at DESC);


-- ============================================================
-- MESSAGES (Children of Conversations)
-- ============================================================
CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_ref UUID REFERENCES email_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Microsoft identifiers (IMMUTABLE - use Prefer: IdType="ImmutableId")
  message_id VARCHAR(255) NOT NULL,           -- Graph immutable ID
  internet_message_id VARCHAR(500),           -- RFC 2822 Message-ID (backup identifier)
  
  -- Location in Outlook
  outlook_folder_id VARCHAR(255),
  outlook_folder_name VARCHAR(100),
  
  -- Message metadata
  subject VARCHAR(1000),
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails TEXT[],
  to_names TEXT[],
  cc_emails TEXT[],
  cc_names TEXT[],
  
  -- Content
  body_preview TEXT,                          -- First ~200 chars
  body_text TEXT,                             -- Full plain text (for search)
  body_html TEXT,                             -- Full HTML (for display)
  
  -- State
  is_read BOOLEAN DEFAULT FALSE,
  is_sent_by_user BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  importance VARCHAR(20),                     -- 'low', 'normal', 'high'
  
  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  
  -- AI analysis (message-level)
  ai_analysis JSONB,
  -- {
  --   intent: string,
  --   key_points: string[],
  --   evidence_quotes: string[],
  --   risk_flags: string[]
  -- }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, message_id)
);

CREATE INDEX idx_messages_conversation ON email_messages(conversation_ref);
CREATE INDEX idx_messages_user_received ON email_messages(user_id, received_at DESC);
CREATE INDEX idx_messages_internet_id ON email_messages(internet_message_id);


-- ============================================================
-- OUTLOOK FOLDER MAPPING
-- ============================================================
CREATE TABLE outlook_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Folder IDs (using immutable IDs)
  inbox_id VARCHAR(255),
  sent_items_id VARCHAR(255),
  processed_folder_id VARCHAR(255),           -- "X-FORCE Processed"
  
  -- User preferences
  folder_mode VARCHAR(30) DEFAULT 'move',     -- 'move' or 'label_only'
  -- 'move' = physically move emails to X-FORCE folders
  -- 'label_only' = use categories, don't move (for conservative teams)
  
  folders_created BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);


-- ============================================================
-- AI DRAFTS (Ghost Writing)
-- ============================================================
CREATE TABLE email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES email_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Draft content
  subject VARCHAR(1000),
  body_html TEXT,
  body_text TEXT,
  
  -- AI metadata
  confidence INTEGER,                         -- 0-100
  generation_trigger VARCHAR(50),             -- 'high_priority', 'pricing_question', etc.
  generation_context JSONB,                   -- What context was used
  needs_human_review TEXT[],                  -- ["Verify pricing", "Confirm date"]
  placeholders TEXT[],                        -- ["[SPECIFIC_DATE]", "[CONFIRM_PRICE]"]
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending_review',
  -- 'pending_review', 'edited', 'sent', 'discarded'
  
  -- If sent
  sent_message_id VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drafts_conversation ON email_drafts(conversation_id);
CREATE INDEX idx_drafts_user_pending ON email_drafts(user_id, status) 
  WHERE status = 'pending_review';


-- ============================================================
-- CONTACT EMAIL PATTERNS (Velocity Intelligence)
-- ============================================================
CREATE TABLE contact_email_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Response patterns
  total_threads INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5,4),                 -- 0.0000 to 1.0000
  
  -- Timing patterns
  avg_response_time_hours DECIMAL(8,2),
  median_response_time_hours DECIMAL(8,2),
  fastest_response_hours DECIMAL(8,2),
  slowest_response_hours DECIMAL(8,2),
  
  -- Time-of-day patterns
  typical_response_hours INT[],               -- e.g., [9, 10, 11, 14, 15] for business hours
  typical_response_days INT[],                -- e.g., [1, 2, 3, 4, 5] for weekdays
  
  -- Current state
  last_response_time_hours DECIMAL(8,2),
  current_thread_wait_hours DECIMAL(8,2),
  deviation_status VARCHAR(30),               -- 'normal', 'slower', 'much_slower', 'faster'
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(contact_id, user_id)
);


-- ============================================================
-- EMAIL TEMPLATES WITH EFFECTIVENESS TRACKING
-- ============================================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),          -- NULL = org-wide
  organization_id UUID,
  
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),                       -- 'follow_up', 'intro', 'pricing', etc.
  subject VARCHAR(1000),
  body_html TEXT,
  body_text TEXT,
  
  -- Variables
  variables TEXT[],                           -- ["{{contact_name}}", "{{company_name}}"]
  
  -- Effectiveness tracking
  times_used INTEGER DEFAULT 0,
  times_got_response INTEGER DEFAULT 0,
  response_rate DECIMAL(5,4),
  avg_response_time_hours DECIMAL(8,2),
  positive_response_rate DECIMAL(5,4),
  leads_to_meeting_rate DECIMAL(5,4),
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- ACTION AUDIT LOG
-- ============================================================
CREATE TABLE email_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES email_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES email_messages(id),
  user_id UUID REFERENCES users(id),
  
  action VARCHAR(50) NOT NULL,
  -- 'viewed', 'replied', 'forwarded', 'archived', 'snoozed', 'unsnoozed',
  -- 'linked_to_deal', 'unlinked', 'priority_changed', 'ignored',
  -- 'draft_created', 'draft_sent', 'draft_discarded',
  -- 'conflict_resolved', 'sla_breached'
  
  -- State changes
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  
  -- Details
  deal_id UUID,
  snooze_until TIMESTAMP WITH TIME ZONE,
  template_id UUID,
  notes TEXT,
  
  -- Source
  source VARCHAR(30),                         -- 'xforce_ui', 'outlook_sync', 'ai_auto', 'api'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_actions_conversation ON email_actions(conversation_id);
CREATE INDEX idx_email_actions_user ON email_actions(user_id, created_at DESC);


-- ============================================================
-- SYNC STATE
-- ============================================================
CREATE TABLE email_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Delta tokens (for incremental sync)
  inbox_delta_token TEXT,
  sent_delta_token TEXT,
  
  -- Webhook subscription
  subscription_id VARCHAR(255),
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Sync timestamps
  last_full_sync_at TIMESTAMP WITH TIME ZONE,
  last_delta_sync_at TIMESTAMP WITH TIME ZONE,
  last_webhook_at TIMESTAMP WITH TIME ZONE,
  
  -- Health tracking
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  
  -- Stats
  total_conversations_synced INTEGER DEFAULT 0,
  total_messages_synced INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);
```

---

## Core Implementation

### Microsoft Graph Client (with Immutable IDs)

```typescript
// lib/microsoft/graph.ts

export class MicrosoftGraphClient {
  private accessToken: string;
  private baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'IdType="ImmutableId"',  // CRITICAL - Always use immutable IDs
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Graph API error');
    }

    return response.json();
  }
}
```

### Folder Setup (Minimal Footprint)

```typescript
// lib/microsoft/folderSetup.ts

export async function setupOutlookFolders(
  accessToken: string,
  userId: string,
  options: { mode: 'move' | 'label_only' } = { mode: 'move' }
): Promise<void> {
  
  const graph = new MicrosoftGraphClient(accessToken);
  
  // Get standard folder IDs
  const inbox = await graph.request('/me/mailFolders/inbox');
  const sentItems = await graph.request('/me/mailFolders/sentitems');
  
  let processedFolderId = null;
  
  if (options.mode === 'move') {
    // Only create ONE folder (minimal footprint)
    processedFolderId = await createFolderIfNotExists(graph, 'X-FORCE Processed');
  }
  
  // Store configuration
  await db.insert(outlookFolders)
    .values({
      user_id: userId,
      inbox_id: inbox.id,
      sent_items_id: sentItems.id,
      processed_folder_id: processedFolderId,
      folder_mode: options.mode,
      folders_created: true
    })
    .onConflictDoUpdate({
      target: outlookFolders.user_id,
      set: {
        inbox_id: inbox.id,
        sent_items_id: sentItems.id,
        processed_folder_id: processedFolderId,
        folder_mode: options.mode,
        folders_created: true,
        updated_at: new Date()
      }
    });
}
```

### Initial Sync (with Big Mailbox Protection)

```typescript
// lib/microsoft/emailSync.ts

const SYNC_CONFIG = {
  initial_sync_days: 30,        // Only last 30 days on connect
  max_messages_per_batch: 50,   // Batch size
  rate_limit_delay_ms: 100      // Delay between batches
};

export async function performInitialSync(
  userId: string,
  accessToken: string
): Promise<{ conversations: number; messages: number; linked: number }> {
  
  const graph = new MicrosoftGraphClient(accessToken);
  const cutoffDate = subDays(new Date(), SYNC_CONFIG.initial_sync_days).toISOString();
  
  let stats = { conversations: 0, messages: 0, linked: 0 };
  
  // Sync inbox with pagination
  let nextLink = `/me/mailFolders/inbox/messages?` +
    `$filter=receivedDateTime ge ${cutoffDate}&` +
    `$top=${SYNC_CONFIG.max_messages_per_batch}&` +
    `$orderby=receivedDateTime desc&` +
    `$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,` +
    `receivedDateTime,sentDateTime,isRead,hasAttachments,bodyPreview,importance,flag`;
  
  while (nextLink) {
    const response = await graph.request(nextLink);
    
    for (const message of response.value) {
      const result = await processMessage(userId, message, 'inbound');
      stats.messages++;
      if (result.newConversation) stats.conversations++;
      if (result.linked) stats.linked++;
    }
    
    nextLink = response['@odata.nextLink']?.replace('https://graph.microsoft.com/v1.0', '');
    
    if (nextLink) {
      await sleep(SYNC_CONFIG.rate_limit_delay_ms);
    }
  }
  
  // Similar for sent items...
  
  // Store delta token for future syncs
  const deltaResponse = await graph.request('/me/mailFolders/inbox/messages/delta?$select=id');
  
  await db.insert(emailSyncState)
    .values({
      user_id: userId,
      inbox_delta_token: deltaResponse['@odata.deltaLink'],
      last_full_sync_at: new Date(),
      total_conversations_synced: stats.conversations,
      total_messages_synced: stats.messages
    })
    .onConflictDoUpdate({
      target: emailSyncState.user_id,
      set: {
        inbox_delta_token: deltaResponse['@odata.deltaLink'],
        last_full_sync_at: new Date(),
        updated_at: new Date()
      }
    });
  
  return stats;
}
```

### Process Message (Thread-First)

```typescript
async function processMessage(
  userId: string,
  message: MicrosoftMessage,
  direction: 'inbound' | 'outbound'
): Promise<{ newConversation: boolean; linked: boolean }> {
  
  const isInbound = direction === 'inbound';
  const primaryEmail = isInbound 
    ? message.from?.emailAddress?.address?.toLowerCase()
    : message.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();
  
  // Check if conversation exists
  let conversation = await db.select()
    .from(emailConversations)
    .where(and(
      eq(emailConversations.user_id, userId),
      eq(emailConversations.conversation_id, message.conversationId)
    ))
    .limit(1)
    .then(r => r[0]);
  
  let newConversation = false;
  let linked = false;
  
  if (!conversation) {
    // NEW CONVERSATION - create it
    newConversation = true;
    
    // Calculate link confidence
    const linkResult = await calculateLinkConfidence(userId, message, primaryEmail);
    linked = linkResult.confidence >= 60;
    
    // Determine initial status
    const status = isInbound ? 'pending' : 'awaiting_response';
    
    // Create conversation
    const [newConv] = await db.insert(emailConversations)
      .values({
        user_id: userId,
        conversation_id: message.conversationId,
        status,
        
        // Linking
        contact_id: linkResult.contactId,
        company_id: linkResult.companyId,
        deal_id: linkResult.confidence >= 85 ? linkResult.dealId : null, // Only auto-link if high confidence
        link_confidence: linkResult.confidence,
        link_method: linkResult.method,
        link_reasoning: linkResult.reasoning,
        
        // Metadata
        subject: message.subject,
        participant_emails: extractAllParticipants(message),
        message_count: 1,
        has_attachments: message.hasAttachments,
        
        // Timeline
        first_message_at: message.receivedDateTime || message.sentDateTime,
        last_message_at: message.receivedDateTime || message.sentDateTime,
        last_inbound_at: isInbound ? message.receivedDateTime : null,
        last_outbound_at: !isInbound ? message.sentDateTime : null
      })
      .returning();
    
    conversation = newConv;
    
    // Set SLA if awaiting response
    if (status === 'awaiting_response') {
      await setResponseSLA(conversation);
    }
    
    // Queue AI analysis
    await queueConversationAnalysis(conversation.id);
    
  } else {
    // EXISTING CONVERSATION - update it
    const updates: Partial<EmailConversation> = {
      message_count: conversation.message_count + 1,
      last_message_at: message.receivedDateTime || message.sentDateTime,
      has_attachments: conversation.has_attachments || message.hasAttachments,
      updated_at: new Date()
    };
    
    if (isInbound) {
      updates.last_inbound_at = message.receivedDateTime;
      
      // They replied! Clear awaiting_response, set to pending
      if (conversation.status === 'awaiting_response') {
        updates.status = 'pending';
        updates.sla_status = 'ok';
        updates.response_due_at = null;
      }
      
      // If was snoozed, bring back to pending
      if (conversation.status === 'snoozed') {
        updates.status = 'pending';
        updates.snoozed_until = null;
      }
      
    } else {
      updates.last_outbound_at = message.sentDateTime;
      
      // We sent - mark as awaiting response
      if (conversation.status === 'pending') {
        updates.status = 'awaiting_response';
      }
    }
    
    await db.update(emailConversations)
      .set(updates)
      .where(eq(emailConversations.id, conversation.id));
    
    // Re-queue AI analysis for new message
    await queueConversationAnalysis(conversation.id);
  }
  
  // Store individual message
  await db.insert(emailMessages)
    .values({
      conversation_ref: conversation.id,
      user_id: userId,
      message_id: message.id,
      internet_message_id: message.internetMessageId,
      subject: message.subject,
      from_email: message.from?.emailAddress?.address,
      from_name: message.from?.emailAddress?.name,
      to_emails: message.toRecipients?.map(r => r.emailAddress.address) || [],
      cc_emails: message.ccRecipients?.map(r => r.emailAddress.address) || [],
      body_preview: message.bodyPreview,
      is_read: message.isRead,
      is_sent_by_user: !isInbound,
      is_flagged: message.flag?.flagStatus === 'flagged',
      has_attachments: message.hasAttachments,
      importance: message.importance,
      received_at: message.receivedDateTime,
      sent_at: message.sentDateTime
    })
    .onConflictDoNothing();
  
  return { newConversation, linked };
}
```

---

## Confidence-Based Linking

```typescript
// lib/email/linkConfidence.ts

interface LinkResult {
  confidence: number;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  method: 'auto_high' | 'auto_suggested' | 'none';
  reasoning: string;
  factors: {
    participant_match: number;      // 0-40
    thread_match: number;           // 0-30
    domain_match: number;           // 0-15
    recency_match: number;          // 0-10
    subject_similarity: number;     // 0-5
  };
}

const LINK_THRESHOLDS = {
  AUTO_HIGH: 85,     // Auto-link, show subtle confirmation
  AUTO_SUGGESTED: 60, // Show "Likely match" UI with one-click confirm
  NO_LINK: 0          // Don't link automatically
};

export async function calculateLinkConfidence(
  userId: string,
  message: MicrosoftMessage,
  primaryEmail: string
): Promise<LinkResult> {
  
  const factors = {
    participant_match: 0,
    thread_match: 0,
    domain_match: 0,
    recency_match: 0,
    subject_similarity: 0
  };
  
  const reasoning: string[] = [];
  let contactId = null, companyId = null, dealId = null;
  
  // 1. Check if email matches a known contact
  const contact = await findContactByEmail(primaryEmail);
  
  if (contact) {
    contactId = contact.id;
    companyId = contact.company_id;
    reasoning.push(`Matched contact: ${contact.name}`);
    
    // Check if contact is on an active deal
    const activeDeals = await getActiveDealsForContact(contact.id, userId);
    
    if (activeDeals.length === 1) {
      factors.participant_match = 40;
      dealId = activeDeals[0].id;
      reasoning.push(`Contact on one active deal: ${activeDeals[0].name}`);
    } else if (activeDeals.length > 1) {
      factors.participant_match = 20;
      reasoning.push(`Contact on ${activeDeals.length} deals - needs disambiguation`);
    }
    
    // Check recency
    const lastActivity = await getLastActivityWithContact(userId, contact.id);
    if (lastActivity && differenceInDays(new Date(), lastActivity.created_at) <= 7) {
      factors.recency_match = 10;
      reasoning.push('Recent activity (within 7 days)');
    }
    
  } else {
    // No contact - try domain match
    const domain = primaryEmail.split('@')[1];
    const company = await findCompanyByDomain(domain);
    
    if (company) {
      companyId = company.id;
      factors.domain_match = 15;
      reasoning.push(`Domain matches company: ${company.name}`);
    }
  }
  
  // 2. Check if part of already-linked thread
  const existingThread = await db.select()
    .from(emailConversations)
    .where(and(
      eq(emailConversations.user_id, userId),
      eq(emailConversations.conversation_id, message.conversationId),
      isNotNull(emailConversations.deal_id)
    ))
    .limit(1);
  
  if (existingThread.length > 0) {
    factors.thread_match = 30;
    dealId = existingThread[0].deal_id;
    reasoning.push('Thread already linked to deal');
  }
  
  const confidence = Object.values(factors).reduce((a, b) => a + b, 0);
  
  let method: 'auto_high' | 'auto_suggested' | 'none' = 'none';
  if (confidence >= LINK_THRESHOLDS.AUTO_HIGH) method = 'auto_high';
  else if (confidence >= LINK_THRESHOLDS.AUTO_SUGGESTED) method = 'auto_suggested';
  
  return {
    confidence,
    contactId,
    companyId,
    dealId: method !== 'none' ? dealId : null,
    method,
    reasoning: reasoning.join('. '),
    factors
  };
}
```

---

## State Reconciliation Layer

```typescript
// lib/microsoft/reconciliation.ts

export async function reconcileOutlookChange(
  userId: string,
  change: {
    messageId: string;
    changeType: 'moved' | 'deleted' | 'flagged' | 'unflagged' | 'read' | 'unread';
    newFolderId?: string;
  }
): Promise<void> {
  
  const message = await db.select()
    .from(emailMessages)
    .where(and(
      eq(emailMessages.user_id, userId),
      eq(emailMessages.message_id, change.messageId)
    ))
    .limit(1)
    .then(r => r[0]);
  
  if (!message) return;
  
  const conversation = await getConversation(message.conversation_ref);
  if (!conversation) return;
  
  const folders = await getOutlookFolders(userId);
  
  switch (change.changeType) {
    case 'deleted':
      // User deleted in Outlook → respect it
      await db.update(emailConversations)
        .set({ status: 'ignored', updated_at: new Date() })
        .where(eq(emailConversations.id, conversation.id));
      
      await logAction(userId, conversation.id, 'ignored', {
        source: 'outlook_sync',
        notes: 'User deleted in Outlook'
      });
      break;
      
    case 'moved':
      if (change.newFolderId === folders.inbox_id) {
        // Moved back to inbox - user wants it back
        if (['processed', 'snoozed'].includes(conversation.status)) {
          await db.update(emailConversations)
            .set({
              status: 'pending',
              snoozed_until: null,
              user_managed: true, // Stop fighting them
              updated_at: new Date()
            })
            .where(eq(emailConversations.id, conversation.id));
        }
        
      } else if (change.newFolderId !== folders.processed_folder_id) {
        // User moved to their own folder - mark as user-managed
        await db.update(emailConversations)
          .set({ user_managed: true, updated_at: new Date() })
          .where(eq(emailConversations.id, conversation.id));
      }
      break;
      
    case 'flagged':
      // User flagged in Outlook → boost priority
      await db.update(emailConversations)
        .set({ ai_priority: 'high', updated_at: new Date() })
        .where(eq(emailConversations.id, conversation.id));
      break;
  }
}
```

---

## Conversation Actions

### Archive with Undo

```typescript
// lib/email/actions.ts

export async function archiveConversation(
  userId: string,
  conversationId: string,
  options?: { logToDeal?: string }
): Promise<{ success: boolean; undoToken: string }> {
  
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) throw new Error('Conversation not found');
  
  // Move to Processed folder (unless user-managed)
  if (!conversation.user_managed) {
    const folders = await getOutlookFolders(userId);
    
    if (folders.folder_mode === 'move' && folders.processed_folder_id) {
      const messages = await getConversationMessages(conversationId);
      const accessToken = await getValidToken(userId);
      const graph = new MicrosoftGraphClient(accessToken);
      
      for (const message of messages) {
        try {
          await graph.request(`/me/messages/${message.message_id}/move`, {
            method: 'POST',
            body: JSON.stringify({ destinationId: folders.processed_folder_id })
          });
        } catch (e) {
          // Continue even if some moves fail
        }
      }
    }
  }
  
  // Update status
  const previousStatus = conversation.status;
  
  await db.update(emailConversations)
    .set({
      status: 'processed',
      deal_id: options?.logToDeal || conversation.deal_id,
      updated_at: new Date()
    })
    .where(eq(emailConversations.id, conversationId));
  
  // Log action with undo capability
  const action = await logAction(userId, conversationId, 'archived', {
    from_status: previousStatus,
    to_status: 'processed',
    deal_id: options?.logToDeal,
    source: 'xforce_ui'
  });
  
  return { success: true, undoToken: action.id };
}

// Undo within 5 minutes
export async function undoAction(userId: string, actionId: string): Promise<boolean> {
  const action = await db.select()
    .from(emailActions)
    .where(and(
      eq(emailActions.id, actionId),
      eq(emailActions.user_id, userId),
      gte(emailActions.created_at, subMinutes(new Date(), 5))
    ))
    .limit(1)
    .then(r => r[0]);
  
  if (!action || !action.from_status) return false;
  
  await db.update(emailConversations)
    .set({ status: action.from_status, updated_at: new Date() })
    .where(eq(emailConversations.id, action.conversation_id));
  
  return true;
}
```

### Snooze

```typescript
export async function snoozeConversation(
  userId: string,
  conversationId: string,
  snoozeUntil: Date,
  reason?: string
): Promise<{ success: boolean; undoToken: string }> {
  
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) throw new Error('Conversation not found');
  
  await db.update(emailConversations)
    .set({
      status: 'snoozed',
      snoozed_until: snoozeUntil,
      snooze_reason: reason,
      updated_at: new Date()
    })
    .where(eq(emailConversations.id, conversationId));
  
  const action = await logAction(userId, conversationId, 'snoozed', {
    from_status: conversation.status,
    to_status: 'snoozed',
    snooze_until: snoozeUntil,
    source: 'xforce_ui'
  });
  
  return { success: true, undoToken: action.id };
}

// Background job
export async function processSnoozeWakeups(): Promise<number> {
  const now = new Date();
  
  const dueConversations = await db.select()
    .from(emailConversations)
    .where(and(
      eq(emailConversations.status, 'snoozed'),
      lte(emailConversations.snoozed_until, now)
    ));
  
  let processed = 0;
  
  for (const conv of dueConversations) {
    await db.update(emailConversations)
      .set({
        status: 'pending',
        snoozed_until: null,
        snooze_reason: null,
        updated_at: new Date()
      })
      .where(eq(emailConversations.id, conv.id));
    
    await createNotification({
      userId: conv.user_id,
      type: 'snooze_expired',
      title: 'Thread returned from snooze',
      message: conv.subject,
      link: `/inbox/${conv.id}`
    });
    
    processed++;
  }
  
  return processed;
}
```

---

## SLA Management

```typescript
// lib/email/sla.ts

const SLA_RULES = [
  { dealStage: 'negotiation', persona: 'any', defaultHours: 4, warningPercent: 50 },
  { dealStage: 'proposal', persona: 'any', defaultHours: 24, warningPercent: 75 },
  { dealStage: 'demo', persona: 'executive', defaultHours: 12, warningPercent: 50 },
  { dealStage: 'demo', persona: 'any', defaultHours: 24, warningPercent: 75 },
  { dealStage: 'any', persona: 'any', defaultHours: 48, warningPercent: 75 }
];

export async function setResponseSLA(conversation: EmailConversation): Promise<void> {
  const deal = conversation.deal_id ? await getDeal(conversation.deal_id) : null;
  const contact = conversation.contact_id ? await getContact(conversation.contact_id) : null;
  
  // Check contact's historical pattern
  const pattern = contact ? await getContactEmailPattern(contact.id, conversation.user_id) : null;
  
  // Find matching rule
  const rule = SLA_RULES.find(r =>
    (r.dealStage === deal?.stage || r.dealStage === 'any') &&
    (r.persona === contact?.persona || r.persona === 'any')
  ) || SLA_RULES[SLA_RULES.length - 1];
  
  // Adjust based on pattern
  let slaHours = rule.defaultHours;
  if (pattern?.total_responses >= 3) {
    slaHours = Math.max(rule.defaultHours, Math.ceil(pattern.avg_response_time_hours * 1.5));
  }
  
  const dueAt = addHours(new Date(), slaHours);
  
  await db.update(emailConversations)
    .set({
      response_due_at: dueAt,
      sla_hours: slaHours,
      sla_status: 'ok'
    })
    .where(eq(emailConversations.id, conversation.id));
}

// Background job: Check SLAs every 15 minutes
export async function checkSLAStatus(): Promise<{ warnings: number; overdue: number }> {
  const now = new Date();
  let warnings = 0, overdue = 0;
  
  const awaitingConversations = await db.select()
    .from(emailConversations)
    .where(and(
      eq(emailConversations.status, 'awaiting_response'),
      isNotNull(emailConversations.response_due_at)
    ));
  
  for (const conv of awaitingConversations) {
    const dueAt = new Date(conv.response_due_at);
    const sentAt = new Date(conv.last_outbound_at);
    const totalWindow = dueAt.getTime() - sentAt.getTime();
    const elapsed = now.getTime() - sentAt.getTime();
    const percentElapsed = (elapsed / totalWindow) * 100;
    
    let newStatus = 'ok';
    if (now > dueAt) {
      newStatus = 'overdue';
      overdue++;
      await createFollowUpSuggestion(conv);
    } else if (percentElapsed >= 75) {
      newStatus = 'warning';
      warnings++;
    }
    
    if (newStatus !== conv.sla_status) {
      await db.update(emailConversations)
        .set({ sla_status: newStatus })
        .where(eq(emailConversations.id, conv.id));
    }
  }
  
  return { warnings, overdue };
}
```

---

## AI Analysis & Signal Detection

```typescript
// lib/email/aiAnalysis.ts

interface EmailSignals {
  cc_escalation: boolean;
  legal_procurement: boolean;
  competitor_mentions: string[];
  budget_discussed: boolean;
  timeline_mentioned: string | null;
  buying_signals: string[];
  objections: string[];
  scheduling_proposed: string[];
  out_of_office: { until: string; delegate?: string } | null;
}

export async function analyzeConversation(conversationId: string): Promise<void> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return;
  
  const messages = await db.select()
    .from(emailMessages)
    .where(eq(emailMessages.conversation_ref, conversationId))
    .orderBy(asc(emailMessages.received_at));
  
  const deal = conversation.deal_id ? await getDeal(conversation.deal_id) : null;
  const contact = conversation.contact_id ? await getContact(conversation.contact_id) : null;
  
  const prompt = `Analyze this email thread and extract sales intelligence.

## Thread (oldest to newest)
${messages.map(m => `
---
From: ${m.from_email}
CC: ${m.cc_emails?.join(', ') || 'none'}
Date: ${m.received_at || m.sent_at}
Body: ${m.body_preview}
`).join('\n')}

## Context
${deal ? `Deal: ${deal.name} - Stage: ${deal.stage} - Value: $${deal.estimated_value}` : 'No linked deal'}
${contact ? `Contact: ${contact.name} (${contact.title})` : 'Unknown contact'}

---

Return JSON:
{
  "priority": "high|medium|low",
  "category": "pricing|scheduling|objection|ready_to_buy|follow_up|info_request|general",
  "sentiment": "positive|neutral|negative|urgent",
  "sentiment_trend": "improving|stable|declining",
  "summary": "One sentence thread summary",
  "suggested_action": "What the rep should do next",
  "signals": {
    "cc_escalation": boolean,
    "legal_procurement": boolean,
    "competitor_mentions": ["names"],
    "budget_discussed": boolean,
    "timeline_mentioned": "Q1 2025" or null,
    "buying_signals": ["specific phrases"],
    "objections": ["specific objections"],
    "scheduling_proposed": ["proposed times"],
    "out_of_office": { "until": "ISO date", "delegate": "name" } or null
  },
  "evidence_quotes": ["1-3 quotes supporting analysis"]
}`;

  const response = await callAI({ prompt, maxTokens: 1000 });
  const analysis = JSON.parse(response.content);
  
  await db.update(emailConversations)
    .set({
      ai_priority: analysis.priority,
      ai_category: analysis.category,
      ai_sentiment: analysis.sentiment,
      ai_sentiment_trend: analysis.sentiment_trend,
      ai_thread_summary: analysis.summary,
      ai_suggested_action: analysis.suggested_action,
      ai_evidence_quotes: analysis.evidence_quotes,
      signals: analysis.signals,
      updated_at: new Date()
    })
    .where(eq(emailConversations.id, conversationId));
  
  // Handle special signals
  await handleSignals(conversation, analysis.signals);
  
  // Generate draft if appropriate
  if (analysis.priority === 'high' || 
      ['pricing', 'scheduling', 'objection', 'ready_to_buy'].includes(analysis.category)) {
    await generateDraftResponse(conversation, analysis.category);
  }
}

async function handleSignals(conversation: EmailConversation, signals: EmailSignals): Promise<void> {
  // CC escalation → notify
  if (signals.cc_escalation) {
    await createNotification({
      userId: conversation.user_id,
      type: 'cc_escalation',
      title: 'Contact CC\'d their boss',
      message: conversation.subject,
      link: `/inbox/${conversation.id}`,
      priority: 'high'
    });
  }
  
  // Out of office → adjust SLA
  if (signals.out_of_office) {
    const returnDate = new Date(signals.out_of_office.until);
    if (returnDate > new Date()) {
      await db.update(emailConversations)
        .set({
          response_due_at: addDays(returnDate, 1),
          sla_status: 'ok'
        })
        .where(eq(emailConversations.id, conversation.id));
    }
  }
  
  // Competitor mention → alert
  if (signals.competitor_mentions.length > 0 && conversation.deal_id) {
    await createNotification({
      userId: conversation.user_id,
      type: 'competitor_mentioned',
      title: `Competitor mentioned: ${signals.competitor_mentions.join(', ')}`,
      message: conversation.subject,
      priority: 'high'
    });
  }
}
```

---

## AI Draft Generation (Ghost Writing)

```typescript
// lib/email/draftGeneration.ts

export async function generateDraftResponse(
  conversation: EmailConversation,
  trigger: string
): Promise<void> {
  // Check if draft already exists
  const existingDraft = await db.select()
    .from(emailDrafts)
    .where(and(
      eq(emailDrafts.conversation_id, conversation.id),
      eq(emailDrafts.status, 'pending_review')
    ))
    .limit(1);
  
  if (existingDraft.length > 0) return;
  
  // Get latest inbound message
  const latestMessage = await db.select()
    .from(emailMessages)
    .where(and(
      eq(emailMessages.conversation_ref, conversation.id),
      eq(emailMessages.is_sent_by_user, false)
    ))
    .orderBy(desc(emailMessages.received_at))
    .limit(1)
    .then(r => r[0]);
  
  if (!latestMessage) return;
  
  // Gather context
  const deal = conversation.deal_id ? await getDeal(conversation.deal_id) : null;
  const contact = conversation.contact_id ? await getContact(conversation.contact_id) : null;
  const priceBook = deal?.products ? await getPricing(deal.products) : null;
  
  const prompt = `Generate a draft reply.

## Email to Reply To
From: ${latestMessage.from_email}
Subject: ${latestMessage.subject}
Body: ${latestMessage.body_preview}

## Thread Summary
${conversation.ai_thread_summary}

## Context
${deal ? `Deal: ${deal.name} - Stage: ${deal.stage} - Value: $${deal.estimated_value}` : 'No active deal'}
${contact ? `Contact: ${contact.name} (${contact.title})` : ''}
${priceBook ? `Pricing: ${JSON.stringify(priceBook)}` : ''}

## Requirements
1. Be specific with pricing/next steps if available
2. Keep under 150 words
3. Flag anything needing human verification

Return JSON:
{
  "subject": "Re: ...",
  "body_html": "...",
  "body_text": "...",
  "confidence": 0-100,
  "needs_human_review": ["things to verify"],
  "placeholders": ["[DATE_TO_CONFIRM]", etc]
}`;

  const response = await callAI({ prompt, maxTokens: 1000 });
  const draft = JSON.parse(response.content);
  
  await db.insert(emailDrafts).values({
    conversation_id: conversation.id,
    user_id: conversation.user_id,
    subject: draft.subject,
    body_html: draft.body_html,
    body_text: draft.body_text,
    confidence: draft.confidence,
    generation_trigger: trigger,
    needs_human_review: draft.needs_human_review,
    placeholders: draft.placeholders,
    status: 'pending_review'
  });
  
  await db.update(emailConversations)
    .set({
      has_pending_draft: true,
      draft_confidence: draft.confidence
    })
    .where(eq(emailConversations.id, conversation.id));
  
  await createNotification({
    userId: conversation.user_id,
    type: 'draft_ready',
    title: 'AI Draft Ready',
    message: `Reply drafted: ${conversation.subject}`
  });
}
```

---

## Daily Action Queue

```typescript
// lib/email/actionQueue.ts

interface DailyActionQueue {
  overdue_followups: ConversationWithContext[];
  high_priority_inbound: ConversationWithContext[];
  scheduling_threads: ConversationWithContext[];
  deal_critical: ConversationWithContext[];
  expiring_snoozes: ConversationWithContext[];
  drafts_ready: ConversationWithContext[];
  suggested_links: ConversationWithContext[];
}

export async function getDailyActionQueue(userId: string): Promise<DailyActionQueue> {
  const now = new Date();
  const endOfDay = endOfToday();
  
  return {
    // Overdue follow-ups
    overdue_followups: await db.select()
      .from(emailConversations)
      .leftJoin(deals, eq(emailConversations.deal_id, deals.id))
      .leftJoin(contacts, eq(emailConversations.contact_id, contacts.id))
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailConversations.status, 'awaiting_response'),
        eq(emailConversations.sla_status, 'overdue')
      ))
      .orderBy(asc(emailConversations.response_due_at)),
    
    // High priority inbound
    high_priority_inbound: await db.select()
      .from(emailConversations)
      .leftJoin(deals, eq(emailConversations.deal_id, deals.id))
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailConversations.status, 'pending'),
        eq(emailConversations.ai_priority, 'high')
      ))
      .orderBy(desc(emailConversations.last_inbound_at)),
    
    // Scheduling threads
    scheduling_threads: await db.select()
      .from(emailConversations)
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailConversations.status, 'pending'),
        eq(emailConversations.ai_category, 'scheduling')
      )),
    
    // Deal-critical
    deal_critical: await db.select()
      .from(emailConversations)
      .innerJoin(deals, eq(emailConversations.deal_id, deals.id))
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailConversations.status, 'pending'),
        inArray(deals.stage, ['negotiation', 'proposal', 'verbal_commit']),
        gte(deals.estimated_value, 10000)
      )),
    
    // Expiring snoozes
    expiring_snoozes: await db.select()
      .from(emailConversations)
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailConversations.status, 'snoozed'),
        between(emailConversations.snoozed_until, now, endOfDay)
      )),
    
    // Drafts ready
    drafts_ready: await db.select()
      .from(emailConversations)
      .innerJoin(emailDrafts, eq(emailConversations.id, emailDrafts.conversation_id))
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailDrafts.status, 'pending_review')
      )),
    
    // Suggested links (confidence 60-84, no deal linked)
    suggested_links: await db.select()
      .from(emailConversations)
      .where(and(
        eq(emailConversations.user_id, userId),
        eq(emailConversations.status, 'pending'),
        eq(emailConversations.link_method, 'auto_suggested'),
        isNull(emailConversations.deal_id)
      ))
  };
}
```

---

## Scheduling Bridge (→ AI Scheduler)

```typescript
// lib/email/schedulingBridge.ts

export async function sendToScheduler(
  userId: string,
  conversationId: string,
  options: {
    meeting_type: string;
    duration_minutes: number;
  }
): Promise<{ schedulingRequestId: string }> {
  
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) throw new Error('Conversation not found');
  
  const contact = conversation.contact_id 
    ? await getContact(conversation.contact_id)
    : null;
  
  if (!contact?.email) throw new Error('No contact email');
  
  // Create scheduling request
  const [request] = await db.insert(schedulingRequests)
    .values({
      deal_id: conversation.deal_id,
      company_id: conversation.company_id,
      created_by: userId,
      meeting_type: options.meeting_type,
      duration_minutes: options.duration_minutes,
      context: `Follow-up to: ${conversation.subject}`,
      status: 'initiated',
      source: 'email_inbox'
    })
    .returning();
  
  await db.insert(schedulingAttendees).values({
    scheduling_request_id: request.id,
    side: 'external',
    contact_id: contact.id,
    email: contact.email,
    is_required: true
  });
  
  // Update conversation with link to scheduler
  await db.update(emailConversations)
    .set({
      signals: {
        ...conversation.signals,
        scheduling_request_id: request.id
      }
    })
    .where(eq(emailConversations.id, conversationId));
  
  await triggerSchedulerInitialEmail(request.id);
  
  return { schedulingRequestId: request.id };
}
```

---

## Contact Email Velocity

```typescript
// lib/email/velocity.ts

export async function updateContactEmailPattern(conversationId: string): Promise<void> {
  const conversation = await getConversation(conversationId);
  if (!conversation?.contact_id) return;
  
  const threads = await db.select()
    .from(emailConversations)
    .where(and(
      eq(emailConversations.user_id, conversation.user_id),
      eq(emailConversations.contact_id, conversation.contact_id)
    ));
  
  let totalResponses = 0;
  let totalResponseTime = 0;
  const responseTimes: number[] = [];
  
  for (const thread of threads) {
    const messages = await db.select()
      .from(emailMessages)
      .where(eq(emailMessages.conversation_ref, thread.id))
      .orderBy(asc(emailMessages.received_at));
    
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];
      
      // We sent → they replied
      if (prev.is_sent_by_user && !curr.is_sent_by_user) {
        const diffHours = differenceInHours(
          new Date(curr.received_at),
          new Date(prev.sent_at)
        );
        totalResponses++;
        totalResponseTime += diffHours;
        responseTimes.push(diffHours);
      }
    }
  }
  
  if (totalResponses === 0) return;
  
  const avgResponseTime = totalResponseTime / totalResponses;
  const currentWait = conversation.last_outbound_at 
    ? differenceInHours(new Date(), new Date(conversation.last_outbound_at))
    : 0;
  
  let deviationStatus = 'normal';
  if (currentWait > avgResponseTime * 3) deviationStatus = 'much_slower';
  else if (currentWait > avgResponseTime * 1.5) deviationStatus = 'slower';
  
  await db.insert(contactEmailPatterns)
    .values({
      contact_id: conversation.contact_id,
      user_id: conversation.user_id,
      total_threads: threads.length,
      total_responses: totalResponses,
      response_rate: totalResponses / threads.length,
      avg_response_time_hours: avgResponseTime,
      current_thread_wait_hours: currentWait,
      deviation_status: deviationStatus
    })
    .onConflictDoUpdate({
      target: [contactEmailPatterns.contact_id, contactEmailPatterns.user_id],
      set: {
        total_threads: threads.length,
        total_responses: totalResponses,
        avg_response_time_hours: avgResponseTime,
        deviation_status: deviationStatus,
        updated_at: new Date()
      }
    });
}
```

---

## Scheduled Jobs

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/email-delta-sync", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/email-sla-check", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/email-snooze-wakeup", "schedule": "* * * * *" },
    { "path": "/api/cron/email-webhook-renewal", "schedule": "0 0 * * *" },
    { "path": "/api/cron/email-full-reconciliation", "schedule": "0 3 * * *" }
  ]
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Database schema (conversations, messages, folders, sync state)
- Microsoft Graph client with immutable IDs
- Folder setup (single "Processed" folder)
- Initial sync with big mailbox protection

### Phase 2: Thread Processing (Week 2)
- Process messages into conversations
- Confidence-based linking
- Basic status management
- State reconciliation layer

### Phase 3: Actions (Week 3)
- Archive with folder move
- Snooze with wake-up job
- Link to deal
- Undo capability

### Phase 4: Daily Action Queue (Week 4)
- SLA tracking
- Action queue queries
- Queue UI
- Contact velocity tracking

### Phase 5: AI Intelligence (Week 5)
- Thread analysis
- Signal detection
- Draft generation

### Phase 6: Real-Time & Polish (Week 6)
- Webhook subscriptions
- Scheduling bridge
- Template tracking
- Performance optimization

---

## Testing Checklist

### Sync & Data
- [ ] Initial sync respects 30-day limit
- [ ] Messages grouped into conversations
- [ ] Immutable IDs used throughout
- [ ] Delta sync catches changes
- [ ] Big mailbox doesn't crash

### Linking
- [ ] High confidence (85+) auto-links
- [ ] Medium confidence (60-84) shows suggestion
- [ ] Low confidence (<60) doesn't link
- [ ] Thread inheritance works

### Reconciliation
- [ ] User deletes in Outlook → ignored
- [ ] User moves back to inbox → pending + user_managed
- [ ] User flags → priority boosted

### Actions
- [ ] Archive moves to Processed
- [ ] Snooze respects wake-up time
- [ ] Undo works within 5 minutes

### SLA & Queue
- [ ] SLA set on outbound email
- [ ] Warning at 75%
- [ ] Overdue triggers follow-up suggestion
- [ ] Queue shows correct sections

### AI
- [ ] Analysis runs on new threads
- [ ] Signals detected
- [ ] Drafts generated for high priority
- [ ] Out-of-office adjusts SLA

### Scheduling Bridge
- [ ] Scheduling intent detected
- [ ] "Send to Scheduler" creates request
