# Context-First Architecture with AI-Powered Matching

## Overview

This document describes a fundamental architectural shift in how the CRM processes communications. The core principle:

**The company/deal is the SOURCE OF TRUTH. Everything else derives from it.**

### Current (Broken) Flow
```
Email arrives → Analyze in isolation → Maybe link to company → Create action items
```

### Correct Flow
```
Email arrives 
  → FIRST: Identify company/contact using AI (match or create)
  → THEN: Load ALL context for that relationship
  → THEN: Analyze WITH that context
  → THEN: Update the relationship context (it grows)
  → THEN: Determine actions needed (which may obsolete previous actions)
  → Command Center = just a view of "what needs attention now"
```

---

## PHASE 1: Context-First Processing Pipeline

Create `src/lib/intelligence/contextFirstPipeline.ts`

This is the NEW main entry point for processing any communication.

### Main Function

```typescript
interface ProcessingResult {
  company: Company;
  contact: Contact;
  deal: Deal | null;
  contextBefore: RelationshipContext;
  contextAfter: RelationshipContext;
  analysisWithContext: PlaybookAnalysis;
  actionsCreated: CommandCenterItem[];
  actionsUpdated: CommandCenterItem[];
  actionsCompleted: CommandCenterItem[];
}

async function processIncomingCommunication(
  communication: {
    type: 'email_inbound' | 'email_outbound' | 'transcript';
    content: Email | Transcript;
  },
  userId: string
): Promise<ProcessingResult> {
  
  // ============================================
  // STEP 1: IDENTIFY COMPANY AND CONTACT FIRST
  // (Using AI-powered matching - see section below)
  // ============================================
  
  const matchResult = await intelligentEntityMatch(communication, userId);
  
  const company = matchResult.company;
  const contact = matchResult.contact;
  
  if (!company || !contact) {
    throw new Error('Could not identify company/contact for this communication');
  }
  
  // Find or create deal (if this looks like a sales opportunity)
  let deal = await findActiveDealForContact(contact.id, company.id);
  // We'll decide whether to create a deal AFTER analysis
  
  // ============================================
  // STEP 2: LOAD ALL EXISTING CONTEXT
  // ============================================
  
  const contextBefore = await buildFullRelationshipContext({
    companyId: company.id,
    contactId: contact.id,
    dealId: deal?.id,
    includeAllHistory: true
  });
  
  // This returns EVERYTHING we know:
  // - Company info, all contacts at company
  // - All previous communications (emails, transcripts)
  // - All commitments (ours and theirs, open and completed)
  // - All concerns/objections raised
  // - All buying signals detected
  // - Salesperson notes
  // - Current deal stage and history
  // - Relationship summary
  
  // ============================================
  // STEP 3: ANALYZE WITH FULL CONTEXT
  // ============================================
  
  const analysis = await analyzeWithFullContext({
    communication,
    context: contextBefore,
    playbook: SALES_PLAYBOOK
  });
  
  // The AI now knows EVERYTHING about this relationship before analyzing
  // It can reference previous conversations, track commitment fulfillment,
  // notice patterns, understand where we are in the sales process
  
  // ============================================
  // STEP 4: UPDATE THE RELATIONSHIP CONTEXT
  // ============================================
  
  // Add this communication to history
  await addCommunicationToHistory(company.id, contact.id, communication, analysis);
  
  // Update relationship intelligence with new learnings
  await updateRelationshipIntelligence({
    companyId: company.id,
    contactId: contact.id,
    newFacts: analysis.key_facts_learned,
    newSignals: analysis.buying_signals,
    newConcerns: analysis.concerns_raised,
    commitmentUpdates: analysis.commitment_updates,
    summaryUpdate: analysis.relationship_summary_update
  });
  
  // Create deal if needed (AI determined this is a real opportunity)
  if (!deal && analysis.should_create_deal) {
    deal = await createDeal({
      company_id: company.id,
      contact_id: contact.id,
      name: `${contact.name} - ${company.name}`,
      stage: analysis.recommended_deal_stage,
      estimated_value: analysis.estimated_deal_value,
      source: analysis.communication_type
    });
  }
  
  // Update deal stage if needed
  if (deal && analysis.deal_stage_change) {
    await updateDeal(deal.id, {
      stage: analysis.deal_stage_change.new_stage,
      stage_change_reason: analysis.deal_stage_change.reason
    });
  }
  
  // ============================================
  // STEP 5: DETERMINE ACTIONS (MAY OBSOLETE PREVIOUS)
  // ============================================
  
  // Get all existing open actions for this company/contact
  const existingActions = await getOpenActionsForRelationship(company.id, contact.id);
  
  // AI determines what actions are needed NOW, given full context
  // This may complete/obsolete previous actions
  const actionDecisions = await determineActionsWithContext({
    analysis,
    existingActions,
    context: contextBefore,
    communication
  });
  
  // Apply action decisions
  const actionsCompleted = [];
  const actionsUpdated = [];
  const actionsCreated = [];
  
  for (const decision of actionDecisions.existing) {
    if (decision.action === 'complete') {
      await completeAction(decision.id, decision.reason);
      actionsCompleted.push(decision);
    } else if (decision.action === 'update') {
      await updateAction(decision.id, decision.updates);
      actionsUpdated.push(decision);
    }
    // 'keep' = no change needed
  }
  
  for (const newAction of actionDecisions.new) {
    const created = await createAction({
      ...newAction,
      company_id: company.id,
      contact_id: contact.id,
      deal_id: deal?.id,
      source_type: communication.type,
      source_id: communication.content.id
    });
    actionsCreated.push(created);
  }
  
  // ============================================
  // STEP 6: RETURN FULL RESULT
  // ============================================
  
  const contextAfter = await buildFullRelationshipContext({
    companyId: company.id,
    contactId: contact.id,
    dealId: deal?.id
  });
  
  return {
    company,
    contact,
    deal,
    contextBefore,
    contextAfter,
    analysisWithContext: analysis,
    actionsCreated,
    actionsUpdated,
    actionsCompleted
  };
}
```

---

## CRITICAL: AI-POWERED ENTITY MATCHING

The identification step (finding company/contact) MUST be AI-powered, not keyword/string matching.

### Why Keywords Fail

Simple matching breaks on:
- "Lawn Doctor of Hanover" vs "Lawn Doctor Hanover" vs "Lawn Doctor (Franchisee)"
- "Andy Canniff" vs "Andrew Canniff" vs "A. Canniff"
- Someone emailing from personal email but mentioning their company
- "I spoke with your colleague John about this" (relationship inference)
- Company name in signature but not in from address
- "Following up on our call with BHB" (company mentioned mid-sentence)

### The AI Matching Function

```typescript
async function intelligentEntityMatch(
  communication: Email | Transcript,
  userId: string
): Promise<{ 
  company: Company | null; 
  contact: Contact | null; 
  confidence: number; 
  reasoning: string 
}> {
  
  // STEP A: Extract raw identifiers (simple extraction, not matching)
  const rawIdentifiers = extractRawIdentifiers(communication);
  // Returns: {
  //   emails: ['acanniff@lawndoctorma.com'],
  //   phones: ['+17818312165'],
  //   names_mentioned: ['Andrew Canniff', 'Andy'],
  //   company_mentions: ['Lawn Doctor', 'Lawn Doctor of Hanover'],
  //   domain: 'lawndoctorma.com'
  // }
  
  // STEP B: Get CANDIDATE matches from database (cast a wide net)
  const candidateCompanies = await findCandidateCompanies({
    // Search by domain (partial match)
    domains: [rawIdentifiers.domain],
    // Search by name fragments (first word of each mention)
    nameFragments: rawIdentifiers.company_mentions.map(n => n.split(' ')[0]),
    // Search by any email domain we've seen
    emailDomains: rawIdentifiers.emails.map(e => e.split('@')[1])
  });
  // Returns maybe 5-10 possible company matches
  
  const candidateContacts = await findCandidateContacts({
    emails: rawIdentifiers.emails,
    phones: rawIdentifiers.phones,
    nameFragments: rawIdentifiers.names_mentioned,
    companyIds: candidateCompanies.map(c => c.id)
  });
  // Returns maybe 5-10 possible contact matches
  
  // STEP C: Let AI reason about the best match
  const matchResult = await callAIForMatching(
    communication,
    rawIdentifiers,
    candidateCompanies,
    candidateContacts
  );
  
  // STEP D: Apply the match with confidence threshold
  let company = null;
  let contact = null;
  
  if (matchResult.company_match.confidence >= 0.7) {
    company = candidateCompanies.find(c => c.id === matchResult.company_match.company_id);
  } else if (matchResult.create_company.should_create) {
    company = await createCompany({
      name: matchResult.create_company.suggested_name,
      domain: rawIdentifiers.domain,
      created_by: userId,
      source: 'ai_extracted'
    });
  }
  
  if (matchResult.contact_match.confidence >= 0.7) {
    contact = candidateContacts.find(c => c.id === matchResult.contact_match.contact_id);
  } else if (matchResult.create_contact.should_create) {
    contact = await createContact({
      name: matchResult.create_contact.suggested_name,
      email: matchResult.create_contact.suggested_email,
      title: matchResult.create_contact.suggested_title,
      company_id: company?.id,
      created_by: userId,
      source: 'ai_extracted'
    });
  }
  
  return {
    company,
    contact,
    confidence: matchResult.overall_confidence,
    reasoning: matchResult.overall_reasoning
  };
}
```

### AI Matching Prompt

```typescript
const matchingPrompt = `
You are matching an incoming communication to existing CRM records.

## THE COMMUNICATION
Type: ${communication.type}
From: ${communication.from}
Subject: ${communication.subject || 'N/A'}
Content Preview:
${communication.body?.substring(0, 1000)}

## RAW IDENTIFIERS EXTRACTED
Emails mentioned: ${rawIdentifiers.emails.join(', ')}
Phones mentioned: ${rawIdentifiers.phones.join(', ')}
Names mentioned: ${rawIdentifiers.names_mentioned.join(', ')}
Company mentions: ${rawIdentifiers.company_mentions.join(', ')}
Email domain: ${rawIdentifiers.domain}

## CANDIDATE COMPANIES IN OUR CRM
${candidateCompanies.map((c, i) => `
${i + 1}. ID: ${c.id}
   Name: ${c.name}
   Domain: ${c.domain}
   Location: ${c.city}, ${c.state}
   Industry: ${c.industry}
   Previous contacts: ${c.contact_count}
`).join('\n')}

${candidateCompanies.length === 0 ? 'No candidate companies found in CRM.' : ''}

## CANDIDATE CONTACTS IN OUR CRM
${candidateContacts.map((c, i) => `
${i + 1}. ID: ${c.id}
   Name: ${c.name}
   Email: ${c.email}
   Phone: ${c.phone}
   Title: ${c.title}
   Company: ${c.company_name} (${c.company_id})
`).join('\n')}

${candidateContacts.length === 0 ? 'No candidate contacts found in CRM.' : ''}

## YOUR TASK

Determine which company and contact this communication is from/about.

Consider:
- Email domain matches (lawndoctorma.com → Lawn Doctor)
- Name variations (Andy = Andrew, Rob = Robert, Bill = William)
- Company name variations (Lawn Doctor of Hanover = Lawn Doctor Hanover)
- Context clues ("Following up on our demo" = existing relationship)
- Franchise/location qualifiers
- When someone uses personal email but company is clear from content
- Signatures in the email body

Return JSON:
{
  "company_match": {
    "match_type": "exact" | "confident" | "probable" | "none",
    "company_id": "uuid or null",
    "reasoning": "Why this is the right company",
    "confidence": 0.0-1.0
  },
  "contact_match": {
    "match_type": "exact" | "confident" | "probable" | "none", 
    "contact_id": "uuid or null",
    "reasoning": "Why this is the right contact",
    "confidence": 0.0-1.0
  },
  "create_company": {
    "should_create": true/false,
    "suggested_name": "Company Name",
    "suggested_domain": "domain.com",
    "suggested_industry": "industry if determinable",
    "reasoning": "Why we should create this"
  },
  "create_contact": {
    "should_create": true/false,
    "suggested_name": "Contact Name",
    "suggested_email": "email",
    "suggested_phone": "phone if known",
    "suggested_title": "title if known",
    "reasoning": "Why we should create this"
  },
  "overall_confidence": 0.0-1.0,
  "overall_reasoning": "Summary of matching logic"
}

Match types:
- exact: Email or phone directly matches a record
- confident: Strong signals (domain + name match, clear context)
- probable: Good signals but some ambiguity
- none: No match found, should create new record
`;
```

### Confidence Thresholds

```typescript
const CONFIDENCE_THRESHOLDS = {
  AUTO_MATCH: 0.85,      // Match automatically, no review needed
  LIKELY_MATCH: 0.70,    // Match but flag for verification
  UNCERTAIN: 0.50,       // Show user candidates, ask to confirm
  NO_MATCH: 0.0          // Create new entity
};
```

### Human-in-the-Loop for Uncertainty

When confidence is between 0.50-0.70:

```typescript
if (confidence >= 0.50 && confidence < 0.70) {
  // Create action item for salesperson to verify
  await createVerificationTask({
    title: `Verify: Is this from ${suggestedCompany.name}?`,
    tier: 3,
    context: matchResult.overall_reasoning,
    options: [
      { label: `Yes, this is ${suggestedCompany.name}`, action: 'confirm_match' },
      { label: 'No, this is a different company', action: 'select_different' },
      { label: 'This is a new company', action: 'create_new' }
    ]
  });
}
```

### What AI Matching Enables

| Communication | AI Reasoning | Match |
|--------------|--------------|-------|
| From: acanniff@lawndoctorma.com | "Email domain lawndoctorma.com matches Lawn Doctor of Hanover. Andrew Canniff is likely Andy Canniff in our CRM (common nickname)." | ✓ Correct match |
| "Following up on our BHB demo" | "BHB mentioned in context. We have BHB Pest Control in CRM. This is a follow-up to existing relationship." | ✓ Correct match |
| From: andy.c@gmail.com, mentions "Lawn Doctor franchise" | "Personal email but clearly identifies as Lawn Doctor in body. Matches existing company." | ✓ Correct match |
| New company, new person | "No matches found. Domain pestguys.com is new. Should create company 'Pest Guys LLC' and contact 'John Smith'." | ✓ Creates new |

### NO KEYWORD FALLBACKS ALLOWED

Remove all of these patterns from the codebase:

```typescript
// ❌ DELETE THIS KIND OF CODE
if (subject.toLowerCase().includes('lawn doctor')) { ... }
if (email.split('@')[1] === company.domain) { ... }
if (name.toLowerCase() === contact.name.toLowerCase()) { ... }
if (title.includes('trial')) tier = 1;

// ✅ ONLY USE AI FOR MATCHING AND CLASSIFICATION
const match = await intelligentEntityMatch(communication, userId);
const analysis = await analyzeWithFullContext(communication, context);
```

The ONLY simple lookups allowed are to get CANDIDATES for the AI to reason about:
- `SELECT * FROM companies WHERE domain ILIKE '%lawndoctor%'` → gives candidates
- AI then reasons about which candidate (if any) is correct

---

## PHASE 2: Relationship Context Storage

The `relationship_intelligence` table should be the GROWING CONTEXT for each relationship.

### Schema Updates

```sql
-- Relationship context that grows over time
ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  communication_history JSONB DEFAULT '[]';
  -- Array of { date, type, summary, key_points }

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS
  facts_learned JSONB DEFAULT '[]';
  -- Array of { fact, source, date, confidence }
  -- Example: "They have 16 agents" - from trial form - Dec 16 - high confidence

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS
  salesperson_notes JSONB DEFAULT '[]';
  -- Array of { note, author, date, note_type }
  -- Manual additions by the salesperson

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS
  context_summary TEXT;
  -- AI-generated summary of the entire relationship, updated after each interaction

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS
  context_summary_updated_at TIMESTAMPTZ;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ri_company_contact 
  ON relationship_intelligence(company_id, contact_id);
```

### Context Building Function

```typescript
async function buildFullRelationshipContext(params: {
  companyId: string;
  contactId: string;
  dealId?: string;
  includeAllHistory?: boolean;
}): Promise<RelationshipContext> {
  
  const { companyId, contactId, dealId, includeAllHistory = false } = params;
  
  // Get company with all contacts
  const company = await getCompanyWithContacts(companyId);
  
  // Get specific contact
  const contact = await getContact(contactId);
  
  // Get deal if exists
  const deal = dealId ? await getDeal(dealId) : await findActiveDealForContact(contactId, companyId);
  
  // Get relationship intelligence
  const ri = await getRelationshipIntelligence(companyId, contactId);
  
  // Get communication history
  const communications = includeAllHistory 
    ? await getAllCommunications(companyId, contactId)
    : await getRecentCommunications(companyId, contactId, 10);
  
  // Get salesperson notes
  const notes = await getSalespersonNotes(companyId, contactId);
  
  // Get open commitments
  const commitments = await getOpenCommitments(companyId, contactId);
  
  // Build formatted context for AI
  const formattedContext = formatContextForAI({
    company,
    contact,
    deal,
    relationshipIntelligence: ri,
    communications,
    notes,
    commitments
  });
  
  return {
    company,
    contact,
    deal,
    relationshipIntelligence: ri,
    communications,
    notes,
    commitments,
    formattedForAI: formattedContext
  };
}
```

---

## PHASE 3: Company/Deal Page - The Source of Truth

Create or update the Company detail page to show all relationship intelligence.

### Page Layout

```
/companies/[id] page layout:

┌─────────────────────────────────────────────────────────────────┐
│ LAWN DOCTOR OF HANOVER                                          │
│ Pest Control · lawndoctorma.com · Hanover, MA                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ RELATIONSHIP SUMMARY (AI-generated, always current)             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Active trial customer. Andrew Canniff (VP/GM) signed trial  │ │
│ │ authorization Dec 16 for 16 agents. Trial setup in progress.│ │
│ │ Very engaged - provided all info promptly. Decision maker.  │ │
│ │ Next step: Schedule trial review call for early January.    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ DEAL         │ │ STAGE        │ │ VALUE        │              │
│ │ X-RAI Trial  │ │ Trial        │ │ $38,400/yr   │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ TABS: [Overview] [Communications] [Intelligence] [Notes] [Deal] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ KEY FACTS LEARNED                              [+ Add Fact]     │
│ • 16 call center agents (from trial form, Dec 16)               │
│ • VP/GM title - decision maker (from trial form, Dec 16)        │
│ • Franchisee location (from trial form, Dec 16)                 │
│                                                                 │
│ BUYING SIGNALS                                                  │
│ 🟢 STRONG: Signed trial authorization                           │
│ 🟢 STRONG: Provided specific team size for scoping              │
│ 🟢 STRONG: Senior decision maker directly involved              │
│                                                                 │
│ CONCERNS / OBJECTIONS                                           │
│ (none recorded)                                                 │
│                                                                 │
│ COMMITMENTS                                                     │
│ OURS:                                                           │
│ ☐ Set up 16-agent trial environment (due: ASAP)                 │
│ ☐ Schedule trial review call (due: early January)               │
│ THEIRS:                                                         │
│ ✓ Sign trial authorization (completed Dec 16)                   │
│                                                                 │
│ SALESPERSON NOTES                              [+ Add Note]     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ No notes yet. Add context, strategy, or corrections here.   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ COMMUNICATION TIMELINE                                          │
│ Dec 17 │ 📧 Email: Trial form forwarded to ops (outbound)       │
│ Dec 16 │ 📧 Email: Trial authorization form received (inbound)  │
│        │    → Extracted: 16 agents, VP/GM, franchisee           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### React Components Needed

```typescript
// src/components/company/CompanyIntelligenceView.tsx
// - Displays relationship summary
// - Shows key facts, signals, concerns
// - Shows commitments (ours and theirs)

// src/components/company/SalespersonNotesSection.tsx
// - List of notes with add/edit functionality
// - Note types: context, strategy, correction, warning

// src/components/company/CommunicationTimeline.tsx
// - Chronological list of all interactions
// - Click to expand/view details

// src/components/company/CompanyHeader.tsx
// - Company name, industry, location
// - Quick stats (deal stage, value, last contact)
```

---

## PHASE 4: Salesperson Notes Interface

Salespeople need to add their own context that the AI will incorporate.

### API Endpoints

```typescript
// POST /api/companies/[id]/notes
// POST /api/deals/[id]/notes
// POST /api/contacts/[id]/notes

interface SalespersonNote {
  note: string;
  note_type: 'context' | 'strategy' | 'correction' | 'warning' | 'general';
  // context = "They're also evaluating Gong"
  // strategy = "Need to emphasize ROI, they're cost-conscious"
  // correction = "AI got this wrong - they actually have 20 agents"
  // warning = "Do NOT mention competitor X, bad history"
}

// GET /api/companies/[id]/notes
// Returns all notes for the company, sorted by date
```

### Note Processing

When notes are added:
1. Store in `relationship_intelligence.salesperson_notes`
2. Include in context for ALL future AI analysis
3. If note_type is 'correction':
   - Update the relevant fact in `facts_learned`
   - Mark old fact as corrected
   - Use corrected value going forward

```typescript
async function addSalespersonNote(
  companyId: string,
  contactId: string | null,
  note: SalespersonNote,
  userId: string
): Promise<void> {
  
  // Get current notes
  const ri = await getRelationshipIntelligence(companyId, contactId);
  const currentNotes = ri?.salesperson_notes || [];
  
  // Add new note
  const newNote = {
    id: crypto.randomUUID(),
    ...note,
    author_id: userId,
    created_at: new Date().toISOString()
  };
  
  // If it's a correction, also update the facts
  if (note.note_type === 'correction') {
    await processCorrectionNote(companyId, contactId, note);
  }
  
  // Update relationship intelligence
  await updateRelationshipIntelligence(companyId, contactId, {
    salesperson_notes: [...currentNotes, newNote]
  });
  
  // Regenerate context summary to incorporate new note
  await regenerateContextSummary(companyId, contactId);
}
```

---

## PHASE 5: Command Center = Derived View

The command center should NOT store relationship data. It should DERIVE actions from relationship intelligence.

### Conceptual Shift

**Old model:** Command center items are independent records with copied data
**New model:** Command center is a query that derives what needs attention from relationship state

### Implementation

```typescript
async function getCommandCenterView(userId: string): Promise<CommandCenterView> {
  
  // Get all relationships for this user that might need attention
  const relationships = await getRelationshipsWithActivity(userId);
  
  const items: CommandCenterItem[] = [];
  
  for (const rel of relationships) {
    // Load full context
    const context = await buildFullRelationshipContext({
      companyId: rel.company_id,
      contactId: rel.contact_id,
      dealId: rel.deal_id
    });
    
    // Determine what actions are needed based on CURRENT state
    const neededActions = await determineNeededActions(context);
    
    for (const action of neededActions) {
      items.push({
        // Derived from context, not stored
        id: `${rel.company_id}-${action.type}`,
        title: action.title,
        tier: deriveTierFromContext(context, action),
        why_now: deriveWhyNow(context, action),
        company: context.company,
        contact: context.contact,
        deal: context.deal,
        workflow_steps: action.steps,
        // Link to source of truth
        relationship_context: context
      });
    }
  }
  
  // Sort by tier, then urgency within tier
  return {
    items: items.sort(byTierThenUrgency),
    summary: generateSummary(items)
  };
}
```

### What This Means

- No stale action items that don't reflect current state
- When context changes, command center automatically reflects it
- Single source of truth (relationship_intelligence)
- No more orphaned or unlinked items — everything derives from relationships

### Caching for Performance

Since deriving everything on every load would be slow:

```typescript
// Cache the derived view, invalidate when context changes
async function getCommandCenterViewCached(userId: string): Promise<CommandCenterView> {
  const cacheKey = `command_center:${userId}`;
  const cached = await cache.get(cacheKey);
  
  if (cached && !await hasContextChanged(userId, cached.generatedAt)) {
    return cached.view;
  }
  
  const view = await getCommandCenterView(userId);
  await cache.set(cacheKey, { view, generatedAt: new Date() }, TTL_5_MINUTES);
  
  return view;
}

// Invalidate cache when any relationship context changes
async function onRelationshipContextChanged(companyId: string, userId: string) {
  await cache.delete(`command_center:${userId}`);
}
```

---

## IMPLEMENTATION ORDER

1. **Phase 1A**: Create `intelligentEntityMatch()` function with AI-powered matching
2. **Phase 1B**: Create `contextFirstPipeline.ts` - the new processing flow
3. **Phase 2**: Update relationship_intelligence schema and storage
4. **Phase 3**: Update/create Company detail page with full context view
5. **Phase 4**: Add salesperson notes functionality
6. **Phase 5**: Refactor command center to derive from context

### For Each Phase, Show Me:
- What was created/changed
- How it connects to the vision
- What it enables
- Test results proving it works

---

## VALIDATION AFTER PHASE 1

Test with the Raymond Kidwell / Lawn Doctor trial form:

1. Process the email through contextFirstPipeline
2. Show me:
   - **AI Matching**: How did it identify company/contact? What was the confidence?
   - **Context Loaded**: What did we already know about this relationship?
   - **Analysis Result**: What did AI determine with full context?
   - **Context Updated**: What new facts were added?
   - **Actions Determined**: What needs to happen now?

3. Then simulate a follow-up email from Andrew asking about trial status
4. Show me:
   - How AI matched to existing company/contact (should be high confidence)
   - The GROWN context (now includes trial form + follow-up)
   - How actions updated (previous actions may be obsoleted)

---

## WHAT SUCCESS LOOKS LIKE

After full implementation:

1. **Every communication is matched intelligently** — No "orphaned" items, no manual linking needed
2. **Context grows over time** — Each interaction adds to what we know
3. **Salesperson can add notes** — Corrections, strategy, warnings are incorporated
4. **Command center reflects current reality** — Not stale copies of data
5. **Company/Deal page is the source of truth** — All intelligence visible in one place
6. **AI reasons about relationships, not keywords** — No regex, no string matching, no fallbacks

Take your time. Do this right. This is the foundation for everything else.
