# Relationship Intelligence — Cumulative Context System

## The Vision

Every interaction should be smarter than the last. When analyzing a new email or transcript, the AI should know:

- Everything we've ever discussed with this person
- Everything we know about their company
- Every commitment made (by us and them)
- Every buying signal and concern detected
- Every note the salesperson has added
- The full arc of the relationship

**Context compounds. Intelligence grows.**

---

## What Gets Analyzed

| Source | Direction | What We Extract |
|--------|-----------|-----------------|
| **Emails** | Inbound | Requests, questions, buying signals, concerns, sentiment |
| **Emails** | Outbound | Commitments we made, what we promised, proposals sent |
| **Transcripts** | — | Commitments, signals, objections, action items, sentiment |
| **Notes** | Manual | Salesperson context, insider knowledge, strategy |
| **Research** | Auto/Manual | Company intel, news, financials, key people |

---

## The Relationship Record

For each Contact + Company, maintain a cumulative intelligence record:

```typescript
interface RelationshipIntelligence {
  // Identity
  contact_id: string;
  company_id: string;
  
  // Cumulative Context (grows over time)
  context: {
    // Company Intelligence
    company_profile: {
      name: string;
      industry: string;
      size: string;
      location: string;
      description: string;
      recent_news: string[];
      tech_stack: string[];
      competitors: string[];
      key_people: Person[];
      // From research tool or manual entry
    };
    
    // Relationship Summary (AI-generated, updated after each interaction)
    relationship_summary: string;  // "Debug Pest is a 35-year pest control company evaluating our platform. Owner Bill is the decision maker, very positive after Dec 4 demo. Main interest: call analytics and AI agents for their understaffed call center."
    
    // Key Facts Learned
    key_facts: Array<{
      fact: string;
      source: 'email' | 'transcript' | 'note' | 'research';
      source_id: string;
      date: Date;
    }>;
    // "Company is 35 years old", "45 employees", "Understaffed call center", "65% residential / 35% commercial"
    
    // Decision Makers & Stakeholders
    stakeholders: Array<{
      name: string;
      title: string;
      role: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'user';
      sentiment: string;
      notes: string;
    }>;
    
    // Communication Preferences Learned
    preferences: {
      preferred_channel: 'email' | 'phone' | 'text';
      best_time_to_reach: string;
      communication_style: string;  // "Direct and numbers-focused" or "Relationship-first"
      response_pattern: string;     // "Usually replies within 24 hours"
    };
  };
  
  // Interaction Timeline
  interactions: Array<{
    id: string;
    type: 'email_inbound' | 'email_outbound' | 'transcript' | 'note' | 'meeting_scheduled';
    date: Date;
    summary: string;           // One-line summary
    analysis_id: string;       // Link to full analysis
    key_points: string[];      // Bullet points of what matters
    commitments_made: string[];
    commitments_received: string[];
    buying_signals: string[];
    concerns: string[];
    sentiment: string;
  }>;
  
  // Active Commitments (not yet completed)
  open_commitments: {
    ours: Array<{
      commitment: string;
      made_on: Date;
      due_by: Date;
      source_type: string;
      source_id: string;
      status: 'pending' | 'overdue' | 'completed';
    }>;
    theirs: Array<{
      commitment: string;
      made_on: Date;
      expected_by: Date;
      source_type: string;
      source_id: string;
      status: 'pending' | 'overdue' | 'completed';
    }>;
  };
  
  // Cumulative Signals
  signals: {
    buying_signals: Array<{
      signal: string;
      quote: string;
      strength: 'strong' | 'moderate' | 'weak';
      date: Date;
      source_id: string;
    }>;
    concerns: Array<{
      concern: string;
      severity: 'high' | 'medium' | 'low';
      resolved: boolean;
      resolution: string;
      date: Date;
      source_id: string;
    }>;
    objections: Array<{
      objection: string;
      response_given: string;
      outcome: 'overcome' | 'pending' | 'blocker';
      date: Date;
      source_id: string;
    }>;
  };
  
  // Overall Metrics
  metrics: {
    total_interactions: number;
    days_in_relationship: number;
    average_response_time_hours: number;
    last_contact_date: Date;
    overall_sentiment_trend: 'improving' | 'stable' | 'declining';
    engagement_score: number;
  };
  
  // Salesperson Notes (manual additions)
  manual_notes: Array<{
    id: string;
    note: string;
    added_by: string;
    added_at: Date;
    context_type: 'strategy' | 'insight' | 'warning' | 'general';
  }>;
  
  // Last Updated
  updated_at: Date;
}
```

---

## Outbound Email Analysis

Scan sent emails to track commitments and understand what we've communicated:

```typescript
interface OutboundEmailAnalysis {
  email_id: string;
  
  // What we said
  summary: string;
  
  // Commitments we made
  commitments_made: Array<{
    commitment: string;
    deadline_mentioned: string | null;
    inferred_due_date: Date;
  }>;
  // "I'll send the proposal by Friday"
  // "Let me check on pricing and get back to you"
  // "I'll schedule a follow-up call for next week"
  
  // What we shared
  content_shared: Array<{
    type: 'proposal' | 'pricing' | 'case_study' | 'contract' | 'info' | 'other';
    description: string;
  }>;
  // "Sent pricing breakdown for 5 agents"
  // "Attached case study from pest control industry"
  
  // Questions we asked them
  questions_asked: string[];
  // "What's your timeline for implementation?"
  // "Who else needs to be involved in the decision?"
  
  // Tone/approach
  tone: string;
  // "Consultative, focused on their understaffing challenge"
  
  // Follow-up expected
  follow_up_expected: {
    expected: boolean;
    expected_by: Date | null;
    what: string;
  };
  // "Expecting them to review materials and reply by Monday"
}
```

### Outbound Analysis Prompt

```typescript
const OUTBOUND_EMAIL_PROMPT = `
Analyze this OUTBOUND email (sent by our salesperson) to extract:

1. What commitments or promises did we make?
2. What content/materials did we share?
3. What questions did we ask them?
4. What response or follow-up are we expecting?

## CONTEXT
Recipient: {recipient_name} ({recipient_email})
Company: {company_name}
Deal Stage: {deal_stage}

## THE EMAIL WE SENT
To: {to}
Subject: {subject}
Date: {sent_at}

{email_body}

---

Return JSON:
{
  "summary": "One sentence summary of what this email does",
  "commitments_made": [
    {
      "commitment": "What we promised",
      "deadline_mentioned": "Friday" or null,
      "inferred_due_date": "2024-12-20"
    }
  ],
  "content_shared": [
    {
      "type": "proposal" | "pricing" | "case_study" | "contract" | "info" | "other",
      "description": "What was shared"
    }
  ],
  "questions_asked": ["Questions we asked them"],
  "tone": "Brief description of our tone/approach",
  "follow_up_expected": {
    "expected": true/false,
    "expected_by": "2024-12-23" or null,
    "what": "What we expect them to do"
  }
}
`;
```

---

## Building Cumulative Context

After EVERY interaction (email in, email out, transcript), update the Relationship Intelligence:

```typescript
// src/lib/intelligence/updateRelationshipContext.ts

export async function updateRelationshipContext(
  contactId: string,
  companyId: string,
  newInteraction: InteractionAnalysis
) {
  // 1. Get existing relationship record
  let relationship = await getRelationshipIntelligence(contactId, companyId);
  
  if (!relationship) {
    relationship = await createRelationshipIntelligence(contactId, companyId);
  }
  
  // 2. Add interaction to timeline
  relationship.interactions.push({
    id: newInteraction.source_id,
    type: newInteraction.type,
    date: newInteraction.date,
    summary: newInteraction.summary,
    analysis_id: newInteraction.analysis_id,
    key_points: newInteraction.key_points,
    commitments_made: newInteraction.commitments_made,
    commitments_received: newInteraction.commitments_received,
    buying_signals: newInteraction.buying_signals,
    concerns: newInteraction.concerns,
    sentiment: newInteraction.sentiment
  });
  
  // 3. Update open commitments
  for (const commitment of newInteraction.commitments_made || []) {
    relationship.open_commitments.ours.push({
      commitment: commitment.text,
      made_on: newInteraction.date,
      due_by: commitment.due_date,
      source_type: newInteraction.type,
      source_id: newInteraction.source_id,
      status: 'pending'
    });
  }
  
  // 4. Add new buying signals
  for (const signal of newInteraction.buying_signals || []) {
    relationship.signals.buying_signals.push({
      ...signal,
      date: newInteraction.date,
      source_id: newInteraction.source_id
    });
  }
  
  // 5. Add new concerns
  for (const concern of newInteraction.concerns || []) {
    relationship.signals.concerns.push({
      ...concern,
      resolved: false,
      date: newInteraction.date,
      source_id: newInteraction.source_id
    });
  }
  
  // 6. Update key facts (AI extracts these)
  for (const fact of newInteraction.key_facts_learned || []) {
    // Only add if not duplicate
    if (!relationship.context.key_facts.some(f => f.fact === fact)) {
      relationship.context.key_facts.push({
        fact,
        source: newInteraction.type,
        source_id: newInteraction.source_id,
        date: newInteraction.date
      });
    }
  }
  
  // 7. Update metrics
  relationship.metrics.total_interactions++;
  relationship.metrics.last_contact_date = newInteraction.date;
  
  // 8. Regenerate relationship summary (periodic, not every time)
  if (shouldRegenerateSummary(relationship)) {
    relationship.context.relationship_summary = await generateRelationshipSummary(relationship);
  }
  
  // 9. Save
  await saveRelationshipIntelligence(relationship);
  
  return relationship;
}
```

---

## Context-Aware Analysis Prompt

When analyzing ANY new interaction, include the full relationship context:

```typescript
const CONTEXT_AWARE_ANALYSIS_PROMPT = `
You are analyzing a new interaction with a contact. Use the full relationship history to inform your analysis.

## RELATIONSHIP CONTEXT

### Company Profile
{company_profile}

### Relationship Summary
{relationship_summary}

### Key Facts We Know
{key_facts}

### Stakeholders
{stakeholders}

### Recent Interaction Timeline (Last 10)
{interaction_timeline}

### Open Commitments
Our commitments to them:
{our_commitments}

Their commitments to us:
{their_commitments}

### Buying Signals Detected (Historical)
{buying_signals}

### Concerns/Objections (Historical)
{concerns}

### Salesperson Notes
{manual_notes}

---

## NEW INTERACTION TO ANALYZE

Type: {interaction_type}
Date: {date}
{interaction_content}

---

Analyze this new interaction IN CONTEXT of everything above. Your analysis should:

1. Reference relevant prior interactions ("In your Dec 4 demo, they mentioned...")
2. Track commitment fulfillment ("You promised to send pricing — this is that follow-up")
3. Note progression of concerns ("They raised AI concerns before — this email shows they're coming around")
4. Identify new information that updates our understanding
5. Suggest next actions that build on the relationship arc

Return JSON:
{
  "summary": "One sentence summary",
  "full_analysis": "2-3 paragraphs understanding this in full context",
  
  "context_connections": [
    {
      "connection": "How this relates to prior interactions",
      "prior_interaction_id": "id",
      "relevance": "Why this matters"
    }
  ],
  
  "key_facts_learned": ["New facts about them we didn't know"],
  
  "commitment_updates": {
    "fulfilled": ["Commitments that are now fulfilled"],
    "new_ours": ["New commitments we made"],
    "new_theirs": ["New commitments they made"]
  },
  
  "signal_updates": {
    "new_buying_signals": [...],
    "new_concerns": [...],
    "resolved_concerns": ["Concerns that seem resolved now"]
  },
  
  "relationship_progression": {
    "stage_change": true/false,
    "sentiment_change": "improving" | "stable" | "declining",
    "momentum": "high" | "medium" | "low" | "stalled",
    "assessment": "Where this relationship stands now"
  },
  
  "suggested_actions": [
    {
      "action": "What to do",
      "priority": "high" | "medium" | "low",
      "reasoning": "Why, given the full context",
      "timing": "When to do it"
    }
  ],
  
  "response_draft": {
    "subject": "...",
    "body": "...",
    "personalization_notes": "How this draft leverages relationship context"
  },
  
  "command_center_item": {
    "tier": 1-5,
    "tier_trigger": "...",
    "why_now": "Compelling reason given full context",
    "sla_minutes": ...
  }
}
`;
```

---

## Manual Context Addition + Re-analysis

Allow salespeople to add context and re-run analysis:

### UI Component

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🟡 Pricing question: Bill Thompson                          ⏱️ 2h 15m  │
│   Debug Pest Control · Platform Deal · $15K                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 💡 He's asking about volume discount for 8 agents.                     │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │ 📝 Add Context                                                  │    │
│ │                                                                 │    │
│ │ I spoke with Bill on the phone yesterday. He mentioned they    │    │
│ │ just lost a key employee and are more urgent than before.      │    │
│ │ He's ready to sign if we can do implementation before Jan 1.   │    │
│ │                                                                 │    │
│ │                                    [Add & Re-analyze]          │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│   [📧 Reply]  [📝 View Draft]  [📞 Call]  [+ Add Context]             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### API Endpoint

```typescript
// src/app/api/command-center/[itemId]/add-context/route.ts

export async function POST(request: Request, { params }) {
  const { itemId } = params;
  const { context, reanalyze } = await request.json();
  
  // 1. Get the command center item
  const item = await getCommandCenterItem(itemId);
  
  // 2. Add manual note to relationship intelligence
  await addManualNote({
    contact_id: item.contact_id,
    company_id: item.company_id,
    note: context,
    added_by: getCurrentUserId(),
    context_type: 'insight',
    linked_item_id: itemId
  });
  
  // 3. If reanalyze requested, re-run analysis with new context
  if (reanalyze) {
    // Get the source (email or transcript)
    const source = await getSource(item.source_type, item.source_id);
    
    // Get updated relationship context (now includes the new note)
    const relationshipContext = await getRelationshipIntelligence(
      item.contact_id, 
      item.company_id
    );
    
    // Re-run analysis
    const newAnalysis = await analyzeWithContext(source, relationshipContext);
    
    // Update the command center item
    await updateCommandCenterItem(itemId, {
      tier: newAnalysis.command_center_item.tier,
      tier_trigger: newAnalysis.command_center_item.tier_trigger,
      why_now: newAnalysis.command_center_item.why_now,
      context_summary: newAnalysis.summary,
      email_analysis: newAnalysis,
      email_draft: newAnalysis.response_draft,
      suggested_actions: newAnalysis.suggested_actions,
      reanalyzed_at: new Date(),
      reanalyzed_with_context: context
    });
    
    return Response.json({ 
      success: true, 
      newAnalysis,
      message: 'Re-analyzed with your context'
    });
  }
  
  return Response.json({ success: true, message: 'Context added' });
}
```

### Re-analysis Prompt Addition

When re-analyzing, prepend the manual context:

```typescript
const REANALYSIS_PROMPT = `
## IMPORTANT: SALESPERSON ADDED THIS CONTEXT

The salesperson just added this note to help with analysis:

"{manual_context}"

Factor this into your analysis. This is insider knowledge that changes the picture.

---

${CONTEXT_AWARE_ANALYSIS_PROMPT}
`;
```

---

## Database Schema

```sql
-- Relationship Intelligence table
CREATE TABLE relationship_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  
  -- JSON blobs for flexible storage
  context JSONB DEFAULT '{}',
  interactions JSONB DEFAULT '[]',
  open_commitments JSONB DEFAULT '{"ours": [], "theirs": []}',
  signals JSONB DEFAULT '{"buying_signals": [], "concerns": [], "objections": []}',
  metrics JSONB DEFAULT '{}',
  
  -- Summary (regenerated periodically)
  relationship_summary TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contact_id, company_id)
);

-- Manual notes table
CREATE TABLE relationship_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  
  note TEXT NOT NULL,
  context_type VARCHAR(50) DEFAULT 'general', -- strategy, insight, warning, general
  
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional link to specific item
  linked_item_id UUID REFERENCES command_center_items(id),
  linked_source_type VARCHAR(50),
  linked_source_id UUID
);

-- Add analysis to emails (both directions)
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS analysis_json JSONB,
ADD COLUMN IF NOT EXISTS analysis_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commitments_extracted JSONB,
ADD COLUMN IF NOT EXISTS relationship_updated BOOLEAN DEFAULT FALSE;

-- Add reanalysis tracking to command center items
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS reanalyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reanalyzed_with_context TEXT,
ADD COLUMN IF NOT EXISTS manual_context_added TEXT;

-- Indexes
CREATE INDEX idx_relationship_contact ON relationship_intelligence(contact_id);
CREATE INDEX idx_relationship_company ON relationship_intelligence(company_id);
CREATE INDEX idx_notes_contact ON relationship_notes(contact_id);
CREATE INDEX idx_notes_company ON relationship_notes(company_id);
```

---

## Processing Flow

### For Every Email (Inbound OR Outbound)

```
Email saved to database
        ↓
Get or create relationship intelligence
        ↓
Build full context prompt:
  - Company profile
  - Relationship summary
  - Key facts
  - Last 10 interactions
  - Open commitments
  - Historical signals
  - Salesperson notes
        ↓
Run AI analysis with full context
        ↓
Store analysis on email record
        ↓
Update relationship intelligence:
  - Add to interaction timeline
  - Add new commitments
  - Add new signals
  - Add new facts learned
        ↓
If inbound + needs response:
  - Create command center item
  - Tier assignment based on full context
        ↓
Regenerate relationship summary (if needed)
```

### For Manual Context Addition

```
Salesperson adds context to item
        ↓
Save note to relationship_notes
        ↓
Update relationship_intelligence
        ↓
If "Re-analyze" requested:
  - Rebuild full context prompt
  - Include new manual note prominently
  - Re-run AI analysis
  - Update command center item
  - Show salesperson the new analysis
```

---

## What Changes in the Analysis

### Before (No Context)
```
Email: "What about volume pricing?"

Analysis: "Pricing question. They want to know about volume discounts."

Why Now: "They asked about pricing."

Tier: 1 (keyword match)
```

### After (Full Context)
```
Email: "What about volume pricing?"

Analysis: "Bill is expanding the deal scope from 5 to 8 agents before signing. 
This follows his very positive Dec 4 demo where he called the product 'amazing' 
and mentioned tracking X-Ray for 6-9 months. He's asking about volume pricing 
because he wants to start with the full team — a strong buying signal. Combined 
with the salesperson's note that Bill is urgent due to losing an employee and 
wants implementation before Jan 1, this deal is ready to close. Fast response 
with volume pricing could close this within days."

Why Now: "Bill's ready to expand and close. Lost employee = urgent. Jan 1 deadline."

Tier: 2 (High velocity deal, multiple strong signals, urgency)

Suggested Action: "Call Bill directly. He's ready. Don't let email slow this down."
```

---

## Summary

| Capability | Before | After |
|------------|--------|-------|
| **Inbound email analysis** | Keyword matching | Full context AI |
| **Outbound email analysis** | None | Track commitments, questions asked |
| **Context available** | Just this email | All emails, calls, notes, research |
| **Relationship memory** | None | Cumulative intelligence |
| **Manual input** | None | Add context, re-analyze |
| **Commitment tracking** | From transcripts only | From all sources |
| **Buying signals** | Per-interaction | Cumulative, show progression |
| **Response drafts** | Generic | Personalized to full history |
| **Tier assignment** | Keyword-based | Context + urgency + signals |

**This transforms the CRM from a task list into a relationship intelligence system.**
