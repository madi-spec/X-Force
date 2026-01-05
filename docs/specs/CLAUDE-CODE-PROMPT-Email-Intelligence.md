# Email Intelligence — Deep Analysis Like Transcripts

## The Problem

Transcripts get rich analysis:
- ✅ Commitments extracted with timing
- ✅ Buying signals with strength ratings
- ✅ Sentiment analysis
- ✅ Interest/urgency levels
- ✅ Follow-up email draft ready to send

Emails get shallow keyword matching:
- ❌ "Contains 'demo'" → must be a demo request
- ❌ No context about who they are
- ❌ No understanding of what they're actually asking
- ❌ No suggested response
- ❌ No connection to prior conversations

**We need Email Intelligence that matches Transcript Intelligence.**

---

## What Email Intelligence Should Produce

For every inbound email, generate analysis JSON like this:

```json
{
  "sender_context": {
    "name": "Bill Thompson",
    "email": "bill@debugpest.com",
    "title": "Owner",
    "company": {
      "name": "Debug Pest Control",
      "industry": "Pest Control",
      "size": "45 employees",
      "location": "Rhode Island"
    },
    "relationship_stage": "active_prospect",
    "deal": {
      "id": "deal_123",
      "name": "Debug Pest Platform Deal",
      "value": 15000,
      "stage": "Proposal Sent"
    },
    "interaction_history": [
      {
        "type": "meeting",
        "date": "2024-12-04",
        "summary": "Platform demo - very positive, owner amazed, 6 strong buying signals"
      },
      {
        "type": "email_sent",
        "date": "2024-12-05", 
        "summary": "Sent follow-up with PDF materials and pricing breakdown"
      }
    ],
    "last_contact_days": 3,
    "total_interactions": 5
  },
  
  "email_analysis": {
    "request_type": "pricing_question",
    "summary": "Asking about volume discount for 8 agents instead of quoted 5",
    "full_understanding": "Bill reviewed the proposal and wants to expand the initial rollout from 5 to 8 agents. He's asking if there's a volume discount and whether they can add more agents later at the same rate.",
    "key_questions": [
      "Is there a volume discount for 8+ agents?",
      "Can we add agents later at the same rate?"
    ],
    "urgency": "Medium",
    "sentiment": "Positive",
    "tone": "Interested, moving toward decision"
  },
  
  "buying_signals": [
    {
      "signal": "Expanding scope before signing",
      "quote": "thinking we should just start with the full team",
      "strength": "strong",
      "implication": "Higher deal value, stronger commitment"
    },
    {
      "signal": "Asking about growth pricing",
      "quote": "add more agents later",
      "strength": "moderate", 
      "implication": "Thinking long-term, sees ongoing value"
    }
  ],
  
  "concerns_detected": [],
  
  "suggested_actions": [
    {
      "action": "Reply with volume pricing tier",
      "priority": "high",
      "reasoning": "Direct answer to his question, removes friction"
    },
    {
      "action": "Offer call to discuss full rollout",
      "priority": "medium",
      "reasoning": "Opportunity to expand deal and accelerate close"
    }
  ],
  
  "response_draft": {
    "subject": "Re: Quick question on pricing",
    "body": "Hi Bill,\n\nGreat question — and I love that you're thinking about starting with the full team!\n\nFor 8 agents, here's how it breaks down:\n• Performance Center: $1,200/month ($150/agent × 8)\n• Action Hub: $275/month (flat fee)\n• Accountability Hub: $275/month (flat fee)\n• Total: $1,750/month\n\nThat's the same per-agent rate — we don't charge more as you scale. And yes, you can absolutely add agents later at the same $150/agent rate.\n\nWant to hop on a quick call to map out the rollout? I can also show you how other pest control companies have phased in the AI agents after the initial launch.\n\nBest,\nJT"
  },
  
  "command_center_item": {
    "tier": 1,
    "tier_trigger": "pricing_question",
    "title": "Reply: Bill's pricing question (Debug Pest)",
    "why_now": "He's expanding the deal scope. Fast response keeps momentum.",
    "sla_minutes": 120
  }
}
```

---

## How to Generate This

### Step 1: Enrich Context BEFORE AI Analysis

Before sending to AI, gather everything we know:

```typescript
// src/lib/email/enrichEmailContext.ts

export async function enrichEmailContext(email: InboundEmail): Promise<EmailContext> {
  const domain = extractDomain(email.from_email);
  
  // 1. Find or create contact
  let contact = await findContactByEmail(email.from_email);
  if (!contact) {
    contact = await createContact({
      email: email.from_email,
      name: email.from_name,
      source: 'email'
    });
  }
  
  // 2. Find company by domain
  let company = await findCompanyByDomain(domain);
  if (!company && !isPersonalEmail(domain)) {
    // Create placeholder company from domain
    company = await createCompany({
      name: domainToCompanyName(domain),
      domain: domain,
      source: 'email_inferred'
    });
    // Link contact to company
    await linkContactToCompany(contact.id, company.id);
  }
  
  // 3. Find active deal
  const deal = await findActiveDeal(contact.id, company?.id);
  
  // 4. Get interaction history
  const history = await getInteractionHistory(contact.id, company?.id, {
    limit: 10,
    types: ['email', 'meeting', 'call']
  });
  
  // 5. Get prior emails in this thread
  const threadEmails = await getEmailThread(email.thread_id);
  
  // 6. Get any transcript summaries from recent meetings
  const recentMeetings = await getRecentMeetingSummaries(contact.id, company?.id, {
    days: 30
  });
  
  return {
    contact,
    company,
    deal,
    history,
    threadEmails,
    recentMeetings,
    lastContactDays: calculateDaysSinceLastContact(history),
    totalInteractions: history.length
  };
}

function isPersonalEmail(domain: string): boolean {
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
                          'aol.com', 'icloud.com', 'me.com', 'live.com'];
  return personalDomains.includes(domain.toLowerCase());
}

function domainToCompanyName(domain: string): string {
  // debugpest.com → Debug Pest
  // lawn-doctor.com → Lawn Doctor
  return domain
    .replace(/\.(com|net|org|io|co)$/, '')
    .split(/[-_.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

### Step 2: Build Rich Prompt with Context

```typescript
// src/lib/email/analyzeEmail.ts

const EMAIL_ANALYSIS_PROMPT = `
You are analyzing an inbound email for a sales team. Your job is to understand:
1. Who is this person and what's our relationship?
2. What are they asking for or telling us?
3. What buying signals or concerns are present?
4. What should we do next?
5. Draft a response if appropriate.

## CONTEXT ABOUT THE SENDER

<sender>
Name: {sender_name}
Email: {sender_email}
Title: {sender_title}
Company: {company_name}
Industry: {company_industry}
Company Size: {company_size}
</sender>

<relationship>
Stage: {relationship_stage}
Last Contact: {last_contact_days} days ago
Total Interactions: {total_interactions}
</relationship>

<active_deal>
Deal Name: {deal_name}
Value: ${deal_value}
Stage: {deal_stage}
</active_deal>

<recent_interactions>
{interaction_history}
</recent_interactions>

<recent_meeting_context>
{meeting_summaries}
</recent_meeting_context>

<email_thread>
{thread_context}
</email_thread>

## THE NEW EMAIL TO ANALYZE

From: {from_name} <{from_email}>
Subject: {subject}
Date: {received_at}

{email_body}

---

Analyze this email and return JSON with this structure:

{
  "email_analysis": {
    "request_type": "demo_request" | "pricing_question" | "general_question" | "meeting_request" | "follow_up" | "complaint" | "info_share" | "introduction" | "other",
    "summary": "One sentence summary of what they want",
    "full_understanding": "2-3 sentences explaining the full context and what they're really asking, considering our history",
    "key_questions": ["List", "of", "specific", "questions", "they", "asked"],
    "urgency": "High" | "Medium" | "Low",
    "sentiment": "Very Positive" | "Positive" | "Neutral" | "Concerned" | "Frustrated" | "Negative",
    "tone": "Brief description of their tone and mindset"
  },
  "buying_signals": [
    {
      "signal": "What the signal indicates",
      "quote": "Exact quote from email if available",
      "strength": "strong" | "moderate" | "weak",
      "implication": "What this means for the deal"
    }
  ],
  "concerns_detected": [
    {
      "concern": "What they're worried about",
      "quote": "Exact quote if available",
      "severity": "high" | "medium" | "low",
      "suggested_response": "How to address this"
    }
  ],
  "suggested_actions": [
    {
      "action": "Specific action to take",
      "priority": "high" | "medium" | "low",
      "reasoning": "Why this action"
    }
  ],
  "response_draft": {
    "subject": "Re: {original_subject}",
    "body": "Full draft email response, personalized to the context. Use their name. Reference prior conversations if relevant. Be helpful and move the deal forward. Keep it concise but warm."
  },
  "command_center_classification": {
    "tier": 1 | 2 | 3 | 4 | 5,
    "tier_trigger": "demo_request" | "pricing_request" | "email_reply" | "meeting_request" | "hot_lead" | "general",
    "sla_minutes": 15 | 120 | 240,
    "why_now": "One compelling sentence for why this needs attention now"
  }
}

Guidelines:
- If this is from an active deal with recent positive interactions, factor that into urgency
- If they asked specific questions, the response draft MUST answer those questions
- If there's meeting context, reference relevant points from those meetings
- Buying signals should focus on intent to purchase, timeline, budget, decision-making
- Be specific in the response draft - use real numbers, reference real conversations
- The "why_now" should be specific and compelling, not generic
`;

export async function analyzeEmail(email: InboundEmail): Promise<EmailAnalysis> {
  // Step 1: Enrich with context
  const context = await enrichEmailContext(email);
  
  // Step 2: Build prompt with all context
  const prompt = buildPrompt(EMAIL_ANALYSIS_PROMPT, {
    sender_name: context.contact?.name || email.from_name,
    sender_email: email.from_email,
    sender_title: context.contact?.title || 'Unknown',
    company_name: context.company?.name || 'Unknown',
    company_industry: context.company?.industry || 'Unknown',
    company_size: context.company?.employee_count || 'Unknown',
    relationship_stage: inferRelationshipStage(context),
    last_contact_days: context.lastContactDays || 'Never',
    total_interactions: context.totalInteractions || 0,
    deal_name: context.deal?.name || 'No active deal',
    deal_value: context.deal?.value || 0,
    deal_stage: context.deal?.stage || 'N/A',
    interaction_history: formatInteractionHistory(context.history),
    meeting_summaries: formatMeetingSummaries(context.recentMeetings),
    thread_context: formatThreadContext(context.threadEmails),
    from_name: email.from_name,
    from_email: email.from_email,
    subject: email.subject,
    received_at: formatDateTime(email.received_at),
    email_body: email.body_text || email.body_preview
  });
  
  // Step 3: Call AI
  const response = await callAI({
    model: 'claude-sonnet-4-20250514',
    prompt,
    maxTokens: 2000
  });
  
  // Step 4: Parse and return
  return JSON.parse(response.content);
}

function inferRelationshipStage(context: EmailContext): string {
  if (!context.deal && context.totalInteractions === 0) return 'new_contact';
  if (!context.deal && context.totalInteractions > 0) return 'known_contact';
  if (context.deal?.stage === 'Closed Won') return 'customer';
  if (context.deal?.stage === 'Closed Lost') return 'lost_opportunity';
  if (context.deal) return 'active_prospect';
  return 'unknown';
}

function formatInteractionHistory(history: Interaction[]): string {
  if (!history?.length) return 'No prior interactions';
  
  return history.map(h => 
    `- ${h.date}: ${h.type} - ${h.summary}`
  ).join('\n');
}

function formatMeetingSummaries(meetings: MeetingSummary[]): string {
  if (!meetings?.length) return 'No recent meetings';
  
  return meetings.map(m => `
Meeting: ${m.title} (${m.date})
Summary: ${m.summary}
Key Points: ${m.key_points?.join(', ') || 'N/A'}
Commitments Made: ${m.commitments?.join(', ') || 'None'}
Sentiment: ${m.sentiment}
`).join('\n---\n');
}

function formatThreadContext(emails: Email[]): string {
  if (!emails?.length || emails.length <= 1) return 'This is a new thread';
  
  // Show previous emails in thread, most recent first
  return emails.slice(0, 5).map(e => `
[${e.direction === 'outbound' ? 'YOU' : 'THEM'}] ${formatDateTime(e.sent_at)}
${e.body_preview?.slice(0, 300)}...
`).join('\n---\n');
}
```

### Step 3: Process and Store Analysis

```typescript
// src/lib/email/processInboundEmail.ts

export async function processInboundEmail(email: InboundEmail) {
  // Skip if already processed
  if (email.analysis_complete) return;
  
  // Skip if it's our own email
  if (email.direction !== 'inbound') return;
  
  // Check if we already replied (then less urgent)
  const alreadyReplied = await checkIfReplied(email.thread_id, email.received_at);
  
  // Run deep analysis
  const analysis = await analyzeEmail(email);
  
  // Store analysis on email record
  await db.execute(`
    UPDATE emails 
    SET analysis_json = $1, analysis_complete = TRUE 
    WHERE id = $2
  `, [JSON.stringify(analysis), email.id]);
  
  // If already replied, don't create command center item
  if (alreadyReplied) return;
  
  // Create command center item from classification
  const cc = analysis.command_center_classification;
  
  await createCommandCenterItem({
    user_id: email.user_id,
    title: cc.tier === 1 
      ? `${analysis.email_analysis.request_type.replace('_', ' ')}: ${email.from_name}`
      : `Reply to ${email.from_name}`,
    type: 'email_response',
    source_type: 'email',
    source_id: email.id,
    
    // Context from enrichment
    contact_id: analysis.sender_context?.contact?.id,
    company_id: analysis.sender_context?.company?.id,
    deal_id: analysis.sender_context?.deal?.id,
    company_name: analysis.sender_context?.company?.name,
    deal_name: analysis.sender_context?.deal?.name,
    deal_value: analysis.sender_context?.deal?.value,
    deal_stage: analysis.sender_context?.deal?.stage,
    
    // Classification
    tier: cc.tier,
    tier_trigger: cc.tier_trigger,
    sla_minutes: cc.sla_minutes,
    received_at: email.received_at,
    
    // Rich context
    why_now: cc.why_now,
    context_summary: analysis.email_analysis.summary,
    
    // Store for UI
    email_analysis: analysis.email_analysis,
    buying_signals: analysis.buying_signals,
    concerns: analysis.concerns_detected,
    suggested_actions: analysis.suggested_actions,
    
    // Pre-drafted response
    email_draft: analysis.response_draft,
    
    // For reply functionality
    email_thread_id: email.thread_id,
    email_message_id: email.message_id,
    primary_contact: {
      name: email.from_name,
      email: email.from_email
    },
    
    estimated_minutes: 5,
    available_actions: ['email', 'call', 'schedule']
  });
}
```

---

## Updated Command Center Card UI

With this rich analysis, the card can show much more:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔴 RESPOND NOW                                              2 items    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ☐ Pricing question: Bill Thompson                           ⏱️ 45 min │
│   Debug Pest Control · Platform Deal · $15K · Proposal                 │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ 💡 He's expanding scope from 5 to 8 agents before signing.   │    │
│   │    Fast response keeps momentum. Had great demo Dec 4.       │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   📊 2 buying signals: "start with full team" (strong)                 │
│   ❓ Key question: Volume discount for 8+ agents?                      │
│                                                                         │
│   [📧 Reply]  [📝 View Draft]  [📞 Call Instead]                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Clicking "View Draft" shows the AI-generated response:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Draft Response                                               [Edit] [✕] │
├─────────────────────────────────────────────────────────────────────────┤
│ To: bill@debugpest.com                                                  │
│ Subject: Re: Quick question on pricing                                  │
│                                                                         │
│ Hi Bill,                                                                │
│                                                                         │
│ Great question — and I love that you're thinking about starting        │
│ with the full team!                                                     │
│                                                                         │
│ For 8 agents, here's how it breaks down:                               │
│ • Performance Center: $1,200/month ($150/agent × 8)                    │
│ • Action Hub: $275/month (flat fee)                                    │
│ • Accountability Hub: $275/month (flat fee)                            │
│ • Total: $1,750/month                                                  │
│                                                                         │
│ That's the same per-agent rate — we don't charge more as you           │
│ scale. And yes, you can absolutely add agents later at the             │
│ same $150/agent rate.                                                  │
│                                                                         │
│ Want to hop on a quick call to map out the rollout?                    │
│                                                                         │
│ Best,                                                                   │
│ JT                                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                    [Send as Draft]  [Send Now]          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Updates

```sql
-- Add analysis to emails table
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS analysis_json JSONB,
ADD COLUMN IF NOT EXISTS analysis_complete BOOLEAN DEFAULT FALSE;

-- Add richer fields to command_center_items
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS email_analysis JSONB,
ADD COLUMN IF NOT EXISTS buying_signals JSONB,
ADD COLUMN IF NOT EXISTS concerns JSONB,
ADD COLUMN IF NOT EXISTS suggested_actions JSONB,
ADD COLUMN IF NOT EXISTS email_draft JSONB;

-- Index for finding unanalyzed emails
CREATE INDEX IF NOT EXISTS idx_emails_unanalyzed 
ON emails(user_id, direction, analysis_complete) 
WHERE direction = 'inbound' AND analysis_complete = FALSE;
```

---

## Processing Flow

```
New inbound email received (via Graph sync or webhook)
                    ↓
        enrichEmailContext()
        - Find/create contact from email
        - Find company from domain
        - Find active deal
        - Get interaction history
        - Get recent meeting summaries
        - Get thread context
                    ↓
        analyzeEmail() 
        - Build rich prompt with all context
        - Call Claude for deep analysis
        - Parse JSON response
                    ↓
        Store analysis on email record
                    ↓
        Check if already replied
                    ↓
        If not replied:
        - Create command center item
        - Include tier, why_now, buying signals
        - Attach draft response
                    ↓
        Email appears in correct tier
        with rich context and ready-to-send draft
```

---

## Cron Job for Unanalyzed Emails

```typescript
// src/app/api/cron/analyze-emails/route.ts

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get unanalyzed inbound emails from last 7 days
  const unanalyzed = await db.query(`
    SELECT * FROM emails
    WHERE direction = 'inbound'
      AND analysis_complete = FALSE
      AND received_at > NOW() - INTERVAL '7 days'
    ORDER BY received_at DESC
    LIMIT 10
  `);
  
  let processed = 0;
  
  for (const email of unanalyzed) {
    try {
      await processInboundEmail(email);
      processed++;
    } catch (error) {
      console.error(`Failed to analyze email ${email.id}:`, error);
    }
  }
  
  return Response.json({ processed });
}
```

Add to vercel.json:
```json
{
  "path": "/api/cron/analyze-emails",
  "schedule": "*/5 * * * *"
}
```

---

## Summary: Transcript vs Email Intelligence

| Feature | Transcripts | Emails (NEW) |
|---------|-------------|--------------|
| Context enrichment | ✅ From meeting | ✅ From domain, history, thread |
| Commitment extraction | ✅ "Our Commitments" | ✅ "Suggested Actions" |
| Buying signals | ✅ With strength | ✅ With strength |
| Sentiment analysis | ✅ | ✅ |
| Urgency detection | ✅ | ✅ |
| Interest level | ✅ | ✅ (inferred from signals) |
| Follow-up draft | ✅ Ready to send | ✅ Ready to send |
| Prior context | ✅ From transcript | ✅ From history + meetings |
| Key questions identified | ❌ | ✅ NEW |
| Concerns detected | ✅ Objections | ✅ Concerns |
| Command center tier | Manual | ✅ Auto-classified |

Now emails get the same intelligence as transcripts.
