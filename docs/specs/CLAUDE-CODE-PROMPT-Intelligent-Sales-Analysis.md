# Intelligent Sales Analysis System

## Overview

Replace keyword-based email/transcript classification with AI that understands the sales process and reasons about what it's seeing.

**Three main parts:**
1. Sales Playbook - teaches AI about our sales process
2. Playbook-informed analysis for emails AND transcripts
3. Action reconciliation - each new interaction reviews ALL outstanding actions

---

## PART 1: Create Sales Playbook

Create `src/lib/intelligence/salesPlaybook.ts`:

```typescript
export const SALES_PLAYBOOK = `
## YOUR SALES PROCESS

### Overview
You are analyzing communications for an AI-powered call analytics and AI agent platform 
sold to pest control and lawn care companies. The sales cycle typically involves:
1. Initial interest (demo request, inquiry)
2. Discovery/Demo call
3. Free trial authorization
4. Trial period (data processing, testing)
5. Trial review call
6. Proposal/Pricing
7. Close

### Types of Inbound Communications

**1. DEMO/DISCOVERY REQUEST**
What it looks like:
- Someone asking to see the product
- "I'd like to learn more", "Can we schedule a demo", "Interested in seeing how it works"
- Often from website form, cold outreach response, or referral

What to do:
- Respond quickly (speed to lead matters)
- Schedule a discovery/demo call
- Research the company before the call

Urgency: HIGH - competitors may be talking to them too


**2. FREE TRIAL AUTHORIZATION (Signed Form)**
What it looks like:
- A formal authorization form with signature
- Contains: Company name, contact info, number of agents, e-signature
- Legal language like "I confirm I have authority to enable AI Call Processing"
- This is NOT a request - it's a SIGNED COMMITMENT

What to do:
- Forward to operations team immediately (they set up the trial)
- Schedule a trial review call for 1-2 weeks out
- Do NOT reply asking if they want to proceed - they already signed!

Urgency: HIGH - they're ready, don't slow them down


**3. PRICING/QUOTE REQUEST**
What it looks like:
- "What does it cost?", "Can you send pricing?", "What's the investment?"
- May include specific scope (number of agents, features needed)

What to do:
- If simple: Send pricing sheet/calculator
- If complex: Schedule call to scope properly before quoting
- Check relationship history - are they comparing to competitor?

Urgency: MEDIUM-HIGH - they're evaluating options


**4. TECHNICAL QUESTION**
What it looks like:
- Questions about integrations, features, how something works
- "Does it work with PestPac?", "Can it handle Spanish calls?"

What to do:
- Answer directly if you can
- Loop in technical resource if needed
- Use as opportunity to advance the sale

Urgency: MEDIUM - shows engaged evaluation


**5. FOLLOW-UP / CHECK-IN**
What it looks like:
- "Just checking in", "Any update?", "Wanted to reconnect"
- Reference to prior conversation

What to do:
- Check relationship history for context
- Respond with relevant update or next step

Urgency: MEDIUM - re-engaged lead


**6. OBJECTION / CONCERN**
What it looks like:
- Pushback on price, timeline, features, risk
- "I'm not sure about...", "My concern is...", "We decided to..."

What to do:
- Address the concern directly
- Don't be defensive
- Ask questions to understand root issue

Urgency: HIGH if deal at risk, MEDIUM otherwise


**7. POSITIVE RESPONSE / READY TO MOVE FORWARD**
What it looks like:
- "Let's do it", "Send the contract", "We're ready to proceed"
- Agreement to next step

What to do:
- Act immediately - don't let momentum die
- Send whatever they need (contract, setup info, etc.)
- Confirm next steps clearly

Urgency: CRITICAL - close the loop NOW


**8. INTERNAL NOTIFICATION (Not customer-facing)**
What it looks like:
- System notifications, form submissions forwarded internally
- Calendar invites, CRM updates

What to do:
- Process appropriately (may not need customer response)
- May trigger internal workflow

Urgency: Varies


### Analyzing Meeting Transcripts

**Meeting Types:**

1. DISCOVERY/DEMO CALL
- First real conversation
- Lots of questions from prospect
- Sales rep presenting/demonstrating
- Look for: pain points mentioned, features that resonated, objections raised

2. TRIAL REVIEW / CHECK-IN CALL  
- Discussing trial results or progress
- Looking at data together
- Look for: satisfaction signals, concerns about results, ready to move forward?

3. PRICING/PROPOSAL REVIEW
- Discussing specific pricing or proposal
- Negotiation may happen
- Look for: budget concerns, approval process, timeline to decision

4. TECHNICAL DEEP-DIVE
- Detailed technical questions
- Integration discussions
- Look for: requirements, blockers, technical decision maker buy-in

5. CLOSE / CONTRACT CALL
- Final details before signing
- Implementation planning
- Look for: verbal commits, remaining concerns, start date discussions


**What to Extract from Transcripts:**

1. COMMITMENTS MADE
- By us: "I'll send you...", "We'll have that ready by...", "Let me check on..."
- By them: "I'll review with my team...", "We'll get back to you by...", "I need to talk to..."

2. DECISIONS MADE
- Agreed next steps
- Scope decisions
- Timeline agreements

3. OBJECTIONS/CONCERNS RAISED
- Price concerns
- Feature gaps
- Risk concerns
- Competitor mentions

4. BUYING SIGNALS
- Positive reactions ("that's exactly what we need")
- Forward-looking questions ("when could we start?")
- Internal selling ("I'll need to show this to...")

5. KEY FACTS LEARNED
- Company info
- Current pain points
- Decision process
- Budget/timeline


### Key Signals to Look For

**Buying Signals (positive momentum):**
- Asking about pricing/contract
- Involving other decision makers
- Asking implementation timeline questions
- Signing forms/authorizations
- Providing specific requirements (number of agents, etc.)
- Referencing budget approval

**Risk Signals (deal may stall):**
- Going quiet after engagement
- Mentioning competitors
- Pushing timeline out
- Vague responses
- "We'll get back to you"

**Urgency Indicators:**
- Mentioned deadlines ("need this by Q1")
- Business pain ("we're overwhelmed", "losing calls")
- External pressure ("board meeting", "busy season coming")


### Post-Interaction Actions

After every interaction, determine:
- What did WE commit to do? (Create Tier 3 items)
- What did THEY commit to do? (Track, create follow-up if overdue)
- What's the logical next step? (Create appropriate tier item)
- Did anything change about urgency? (Update existing items)
- Are there existing action items that are now obsolete? (Complete them)
`;
```

---

## PART 2: Update Email Analysis to Use Playbook

Update `analyzeInboundEmail.ts` to:

1. Import the SALES_PLAYBOOK
2. Include it at the start of the analysis prompt
3. Update the expected response format

The prompt should be structured as:

```typescript
const prompt = `
${SALES_PLAYBOOK}

---

## RELATIONSHIP CONTEXT
${promptContext}

---

## EMAIL TO ANALYZE
From: ${email.from_email}
Subject: ${email.subject}
Date: ${email.received_at}

${email.body_text}

---

Based on your understanding of the sales process above and the relationship context, analyze this email:

1. **Communication Type**: Which type best describes this? Explain your reasoning.
2. **Sales Journey Stage**: Where is this person in the sales process?
3. **Key Observations**: What signals do you see? (buying signals, risk signals, urgency indicators)
4. **Required Actions**: What needs to happen? List each action with who should do it and urgency level.
5. **Workflow Type**: Single response, multi-step internal, waiting on customer, or no action needed?

Return JSON:
{
  "communication_type": "demo_request" | "free_trial_form" | "pricing_request" | "technical_question" | "follow_up" | "objection" | "ready_to_proceed" | "internal_notification" | "other",
  "communication_type_reasoning": "Why you classified it this way",
  "sales_stage": "initial_interest" | "discovery" | "trial" | "proposal" | "closing" | "closed",
  "key_observations": {
    "buying_signals": [{"signal": "description", "quote": "exact quote if available", "strength": "strong|moderate|weak"}],
    "risk_signals": [{"signal": "description", "quote": "exact quote if available"}],
    "urgency_indicators": [{"indicator": "description", "quote": "exact quote if available"}]
  },
  "required_actions": [
    {
      "action": "What to do",
      "owner": "sales_rep" | "operations" | "technical" | "management",
      "urgency": "critical" | "high" | "medium" | "low",
      "reasoning": "Why this action is needed"
    }
  ],
  "workflow_type": "single_response" | "multi_step_internal" | "waiting_on_customer" | "no_action_needed",
  "tier": 1 | 2 | 3 | 4 | 5,
  "tier_reasoning": "Why this tier based on the playbook guidance",
  "response_draft": { "subject": "...", "body": "..." },
  "summary": "One sentence summary of what this email is and what needs to happen"
}
`;
```

---

## PART 3: Update Transcript Analysis to Use Playbook

Update `processTranscriptAnalysis.ts` to use the same playbook-informed approach:

1. Import the SALES_PLAYBOOK
2. Include it in the transcript analysis prompt
3. Have AI classify meeting type
4. Extract structured actions

The prompt structure should be similar to email but focused on transcript-specific extraction:
- Meeting type classification
- Commitments made (ours and theirs)
- Decisions made
- Objections raised
- Buying signals detected
- Required follow-up actions

---

## PART 4: Create Action Reconciliation System

Create `src/lib/intelligence/reconcileActions.ts`

This function runs after every new interaction to review ALL existing open actions for that contact/company and determine what should happen to each one.

### Interface

```typescript
interface ReconciliationResult {
  keep: string[];           // Item IDs to keep as-is
  complete: string[];       // Item IDs to mark complete
  update: { id: string; updates: Partial<CommandCenterItem> }[];
  combine: { keepId: string; absorbIds: string[]; newTitle?: string }[];
  create: NewCommandCenterItem[];
}

async function reconcileActionsForContact(
  contactId: string,
  companyId: string,
  newInteraction: {
    type: 'email_inbound' | 'email_outbound' | 'transcript';
    analysis: any;
    date: Date;
  },
  existingOpenItems: CommandCenterItem[],
  relationshipContext: RelationshipContext
): Promise<ReconciliationResult>
```

### Reconciliation Prompt

```typescript
const reconciliationPrompt = `
${SALES_PLAYBOOK}

---

## CURRENT SITUATION

### New Interaction Just Processed:
Type: ${newInteraction.type}
Date: ${newInteraction.date}
Summary: ${newInteraction.analysis.summary}
Communication Type: ${newInteraction.analysis.communication_type}
Actions Identified: ${JSON.stringify(newInteraction.analysis.required_actions)}

### Existing Open Action Items for This Contact/Company:
${existingItems.map(item => `
- ID: ${item.id}
  Title: ${item.title}
  Tier: ${item.tier}
  Created: ${item.created_at}
  Why Now: ${item.why_now}
  Status: ${item.status}
`).join('\n')}

### Relationship Context:
${relationshipSummary}
Last contact: ${lastContactDate}
Sales stage: ${salesStage}
Open commitments: ${openCommitments}

---

## YOUR TASK

Review the existing action items in light of this new interaction. For each existing item, determine:

1. **KEEP**: Item is still relevant and needed, no changes
2. **COMPLETE**: Item is no longer needed because:
   - The action was completed (e.g., we committed to send pricing, and this email shows we sent it)
   - The deal moved past this step (e.g., "schedule demo" but demo already happened)
   - Superseded by a more important action
3. **UPDATE**: Item is still relevant but needs modification:
   - Urgency changed (upgrade or downgrade tier)
   - Why_now needs updating based on new context
   - Title needs clarification
4. **COMBINE**: Multiple items should be merged:
   - Redundant items about the same thing
   - Related items that make sense as one task

Also determine what NEW items should be created from this interaction (that don't duplicate existing items).

Return JSON:
{
  "reasoning": "Overall assessment of how this interaction changes the action landscape",
  
  "existing_items": [
    {
      "id": "item-uuid",
      "decision": "keep" | "complete" | "update" | "combine",
      "reason": "Why this decision",
      "updates": {  // Only if decision is "update"
        "tier": 2,
        "why_now": "Updated reason"
      },
      "combine_into": "other-item-id"  // Only if decision is "combine"
    }
  ],
  
  "new_items": [
    {
      "title": "New action title",
      "tier": 2,
      "tier_trigger": "free_trial_form",
      "why_now": "Reason this is needed",
      "owner": "sales_rep" | "operations" | "technical" | "management",
      "urgency": "high"
    }
  ],
  
  "summary": "Brief summary of changes: X items completed, Y updated, Z new items created"
}
`;
```

---

## PART 5: Create Apply Reconciliation Function

```typescript
async function applyReconciliation(result: ReconciliationResult): Promise<void> {
  // 1. Mark items as complete
  for (const id of result.complete) {
    await updateCommandCenterItem(id, { 
      status: 'completed', 
      completed_at: new Date() 
    });
  }
  
  // 2. Update items
  for (const { id, updates } of result.update) {
    await updateCommandCenterItem(id, updates);
  }
  
  // 3. Combine items (mark absorbed items as complete, update keeper)
  for (const combo of result.combine) {
    for (const absorbId of combo.absorbIds) {
      await updateCommandCenterItem(absorbId, { 
        status: 'completed', 
        completed_at: new Date(),
        completed_reason: 'combined_into_' + combo.keepId 
      });
    }
    if (combo.newTitle) {
      await updateCommandCenterItem(combo.keepId, { title: combo.newTitle });
    }
  }
  
  // 4. Create new items
  for (const item of result.create) {
    await createCommandCenterItem(item);
  }
}
```

---

## PART 6: Wire Into Processing Pipeline

Update the email and transcript processing to use reconciliation:

```typescript
async function processInboundEmail(email) {
  // 1. Build context
  const context = await buildRelationshipContext({ email: email.from_email });
  
  // 2. Analyze email with playbook
  const analysis = await analyzeWithPlaybook(email, context);
  
  // 3. Get existing open items for this contact/company
  const existingItems = await getOpenItemsForContact(
    context.contact?.id, 
    context.company?.id
  );
  
  // 4. Reconcile - AI decides what to do with existing items + what new items needed
  const reconciliation = await reconcileActionsForContact(
    context.contact?.id,
    context.company?.id,
    { type: 'email_inbound', analysis, date: new Date(email.received_at) },
    existingItems,
    context
  );
  
  // 5. Apply reconciliation decisions
  await applyReconciliation(reconciliation);
  
  // 6. Update relationship intelligence
  await updateRelationshipFromAnalysis(analysis);
  
  return { analysis, reconciliation };
}
```

Do the same for `processTranscriptAnalysis` - after analyzing the transcript, run reconciliation.

---

## PART 7: Add Types

Update `src/types/commandCenter.ts` with:

```typescript
// Reconciliation types
type ReconciliationDecision = 'keep' | 'complete' | 'update' | 'combine';

interface ReconciliationItemDecision {
  id: string;
  decision: ReconciliationDecision;
  reason: string;
  updates?: Partial<CommandCenterItem>;
  combine_into?: string;
}

interface ReconciliationResult {
  reasoning: string;
  existing_items: ReconciliationItemDecision[];
  new_items: NewCommandCenterItem[];
  summary: string;
}

// Add owner field to CommandCenterItem
type ActionOwner = 'sales_rep' | 'operations' | 'technical' | 'management';

// Update communication types
type CommunicationType = 
  | 'demo_request' 
  | 'free_trial_form' 
  | 'pricing_request' 
  | 'technical_question' 
  | 'follow_up' 
  | 'objection' 
  | 'ready_to_proceed' 
  | 'internal_notification' 
  | 'other';

// Update sales stages
type SalesStage = 
  | 'initial_interest' 
  | 'discovery' 
  | 'trial' 
  | 'proposal' 
  | 'closing' 
  | 'closed';
```

---

## PART 8: Test the System

### Test 1: Raymond Kidwell Trial Form

1. Find the Raymond Kidwell trial form email
2. Re-analyze with playbook-informed analysis
3. Show:
   - What the AI classified it as (should be `free_trial_form`)
   - The AI's reasoning
   - What actions it identified (forward to ops, schedule review)
   - What tier and why

### Test 2: Reconciliation

1. Get existing open items for Raymond Kidwell
2. Run reconciliation with the trial form analysis
3. Show:
   - What items were completed (old demo request items?)
   - What items were updated
   - What new items were created
   - The AI's overall reasoning

### Test 3: Follow-up Interaction

1. Simulate or find a follow-up (like outbound email or call transcript)
2. Run through the full pipeline
3. Show how reconciliation cleans up/updates the action items

---

## Implementation Order

1. Start with Part 1 (create salesPlaybook.ts)
2. Then Part 2 (update email analysis)
3. Then Part 7 (add types - needed for Parts 4-6)
4. Then Parts 4-5 (reconciliation logic)
5. Then Part 6 (wire into pipeline)
6. Then Part 3 (transcript analysis)
7. Finally Part 8 (testing)

Show me progress after completing each part.
