# Relationship Intelligence — Claude Code Session Guide

## Overview

This breaks the Relationship Intelligence system into 7 focused sessions. Each session is testable before moving to the next.

**Total estimate: 7 sessions, ~2-3 hours each**

---

## Session 1: Database Schema + Relationship Record

### Goal
Create the database tables and basic CRUD for relationship intelligence.

### Prompt for Claude Code

```
I'm building a Relationship Intelligence system for our CRM. This will store 
cumulative context about each contact/company relationship that grows smarter 
with every interaction.

First, explore the codebase and find:
1. How we handle database migrations
2. The contacts table schema
3. The companies table schema
4. The emails table schema

Then create these database tables:

1. relationship_intelligence table:
   - id (uuid, primary key)
   - contact_id (references contacts)
   - company_id (references companies)
   - context (jsonb) - company profile, key facts, stakeholders, preferences
   - interactions (jsonb array) - timeline of all interactions
   - open_commitments (jsonb) - {ours: [], theirs: []}
   - signals (jsonb) - {buying_signals: [], concerns: [], objections: []}
   - metrics (jsonb) - total_interactions, last_contact_date, etc.
   - relationship_summary (text) - AI-generated summary
   - created_at, updated_at
   - Unique constraint on (contact_id, company_id)

2. relationship_notes table:
   - id (uuid, primary key)
   - contact_id, company_id
   - note (text)
   - context_type (varchar) - strategy, insight, warning, general
   - added_by (references users)
   - added_at (timestamp)
   - linked_item_id (optional, references command_center_items)

3. Add to emails table:
   - analysis_json (jsonb)
   - analysis_complete (boolean default false)
   - commitments_extracted (jsonb)

After creating the schema, create basic functions:
- getOrCreateRelationshipIntelligence(contactId, companyId)
- updateRelationshipIntelligence(id, updates)
- addRelationshipNote(contactId, companyId, note, contextType, addedBy)
- getRelationshipNotes(contactId, companyId)

Test by creating a relationship record for an existing contact/company pair.
```

### Success Criteria
- [ ] Tables created with correct schema
- [ ] Can create a relationship intelligence record
- [ ] Can add a manual note
- [ ] Can retrieve relationship for a contact/company pair

---

## Session 2: Outbound Email Analysis

### Goal
Scan sent emails to extract commitments we made.

### Prompt for Claude Code

```
Now let's analyze OUTBOUND emails to track commitments we make.

Read the Relationship Intelligence spec at /docs/specs/CLAUDE-CODE-PROMPT-Relationship-Intelligence.md
Focus on the "Outbound Email Analysis" section.

Create src/lib/intelligence/analyzeOutboundEmail.ts that:

1. Takes a sent email record
2. Gets basic context (recipient contact, company, deal)
3. Calls Claude API with this prompt to extract:
   - Summary of what we said
   - Commitments we made (with deadlines if mentioned)
   - Content/materials we shared
   - Questions we asked them
   - Expected follow-up from them

4. Returns structured analysis:
{
  summary: string,
  commitments_made: [{commitment, deadline_mentioned, inferred_due_date}],
  content_shared: [{type, description}],
  questions_asked: string[],
  follow_up_expected: {expected: boolean, expected_by: Date, what: string}
}

5. Stores analysis on the email record

Test with 3 real sent emails from the database. Show me the extracted commitments.
```

### Success Criteria
- [ ] Can analyze a sent email
- [ ] Extracts commitments with deadlines
- [ ] Identifies content shared (proposals, pricing, etc.)
- [ ] Stores analysis on email record

---

## Session 3: Context Builder

### Goal
Build function that assembles full relationship context for any analysis.

### Prompt for Claude Code

```
Now let's build the context builder - the function that assembles everything 
we know about a relationship before any analysis.

Create src/lib/intelligence/buildRelationshipContext.ts that:

1. Takes contactId and companyId (either or both)

2. Gathers ALL available context:
   - Contact details (name, title, email, phone)
   - Company profile (name, industry, size, domain, description)
   - Active deal if exists (name, value, stage, close_date)
   - Relationship intelligence record if exists
   - Last 10 interactions from relationship timeline
   - Open commitments (ours and theirs)
   - Historical buying signals
   - Historical concerns/objections
   - All manual notes from salespeople
   - Recent transcript summaries (last 30 days)

3. Formats this into a structured object AND a prompt-ready string:

{
  structured: {
    contact: {...},
    company: {...},
    deal: {...},
    relationship: {...},
    interactions: [...],
    commitments: {...},
    signals: {...},
    notes: [...]
  },
  promptContext: `
    ## RELATIONSHIP CONTEXT
    
    ### Contact
    Name: John Smith
    Title: Owner
    ...
    
    ### Company
    Name: Debug Pest Control
    Industry: Pest Control
    ...
    
    ### Relationship Summary
    ...
    
    ### Recent Interactions
    - Dec 4: Demo call - Very positive...
    - Dec 5: We sent follow-up...
    ...
    
    ### Open Commitments
    ...
  `
}

Test by building context for 3 different contacts. Show me the promptContext output.
```

### Success Criteria
- [ ] Gathers context from all sources
- [ ] Handles missing data gracefully
- [ ] Produces clean prompt-ready context string
- [ ] Works for contacts with and without deals

---

## Session 4: Context-Aware Inbound Email Analysis

### Goal
Upgrade inbound email analysis to use full relationship context.

### Prompt for Claude Code

```
Now let's upgrade inbound email analysis to use the full relationship context.

Update or create src/lib/intelligence/analyzeInboundEmail.ts that:

1. Takes an inbound email
2. Calls buildRelationshipContext() to get full context
3. Uses this enhanced prompt that includes the full context:

[Include the CONTEXT_AWARE_ANALYSIS_PROMPT from the spec]

4. The analysis should now:
   - Reference prior interactions ("In your Dec 4 demo, they mentioned...")
   - Track commitment fulfillment
   - Note progression of concerns
   - Identify new facts learned
   - Suggest actions that build on relationship arc
   - Draft response that references history

5. Returns the full analysis including:
   - context_connections (how this relates to prior interactions)
   - key_facts_learned (new info we didn't know)
   - commitment_updates (fulfilled, new_ours, new_theirs)
   - signal_updates (new signals, resolved concerns)
   - relationship_progression (sentiment trend, momentum)
   - command_center_item classification

Test with an inbound email from a contact that has prior interaction history.
Compare the analysis WITH context vs WITHOUT context - show me both.
```

### Success Criteria
- [ ] Analysis references prior interactions
- [ ] New facts are identified
- [ ] Response draft is personalized to history
- [ ] Tier assignment considers full context

---

## Session 5: Update Relationship After Each Interaction

### Goal
After every analysis, update the cumulative relationship intelligence.

### Prompt for Claude Code

```
Now we need to update the relationship intelligence after every interaction.

Create src/lib/intelligence/updateRelationshipFromInteraction.ts that:

1. Takes an interaction analysis (from email or transcript)

2. Updates the relationship_intelligence record:
   - Adds interaction to timeline
   - Adds new commitments (ours and theirs)
   - Adds new buying signals
   - Adds new concerns
   - Adds new key facts
   - Updates metrics (total_interactions, last_contact_date)

3. Checks open commitments:
   - If this interaction fulfills a commitment, mark it complete
   - Example: We committed to "send pricing" → we sent an email with pricing → mark complete

4. Regenerates relationship_summary if:
   - More than 5 interactions since last summary
   - OR significant event (deal stage change, concern resolved)

5. The summary regeneration should use Claude to write 2-3 sentences 
   summarizing the current state of the relationship.

Wire this into:
- analyzeInboundEmail (after analysis)
- analyzeOutboundEmail (after analysis)
- Fireflies webhook (after transcript analysis)

Test by processing a few emails and transcripts, then verify the 
relationship record has the cumulative data.
```

### Success Criteria
- [ ] Interactions accumulate in timeline
- [ ] Commitments are tracked across interactions
- [ ] Buying signals accumulate
- [ ] Relationship summary updates
- [ ] Metrics update correctly

---

## Session 6: Manual Notes + Re-analysis

### Goal
Let salespeople add context and re-run analysis.

### Prompt for Claude Code

```
Now let's let salespeople add context and re-run analysis.

1. Create API endpoint: POST /api/command-center/[itemId]/add-context

   Request body:
   {
     context: "The manual note text",
     reanalyze: true/false
   }

   Behavior:
   - Save the note to relationship_notes table
   - Link it to the command center item
   - Update relationship_intelligence to include this note
   
   If reanalyze = true:
   - Get the source (email or transcript)
   - Rebuild full relationship context (now includes the new note)
   - Re-run analysis with the note prominently included in prompt:
     "## IMPORTANT: SALESPERSON ADDED THIS CONTEXT
      {note}
      Factor this into your analysis."
   - Update the command center item with new analysis:
     - New tier/tier_trigger if changed
     - New why_now
     - New response draft
     - New suggested actions
   - Return the new analysis

2. Create API endpoint: GET /api/relationships/[contactId]/notes
   - Returns all notes for a contact
   - Include linked items

3. Update the command center item schema to track:
   - reanalyzed_at (timestamp)
   - reanalyzed_with_context (the note that triggered re-analysis)
   - manual_context_added (all notes added to this item)

Test by:
1. Adding a note to a command center item without re-analysis
2. Adding a note with re-analysis - show me the before/after
```

### Success Criteria
- [ ] Can add note to command center item
- [ ] Note appears in relationship context
- [ ] Re-analysis produces different results with context
- [ ] Tier can change based on new context

---

## Session 7: Wire Everything Together + UI

### Goal
Connect all pipelines and update Command Center UI to show rich context.

### Prompt for Claude Code

```
Final session - wire everything together and update the UI.

1. Email Processing Pipeline:
   - When emails sync from Microsoft Graph:
     - For INBOUND: run analyzeInboundEmail → updateRelationship → create CC item
     - For OUTBOUND: run analyzeOutboundEmail → updateRelationship
   
   - Add cron job /api/cron/analyze-emails to process unanalyzed emails

2. Transcript Processing Pipeline:
   - After Fireflies webhook saves transcript:
     - Run existing analysis
     - Call updateRelationshipFromInteraction
     - Create CC items from commitments

3. Update Command Center Card UI to show:
   - Relationship context (company, deal, stage)
   - Key insight from analysis (not just keyword match)
   - Buying signals count if present
   - Link to view full relationship history
   - "Add Context" button that opens modal
   - "Re-analyze" option after adding context

4. Create Relationship View page: /relationships/[contactId]
   - Shows full relationship intelligence
   - Timeline of all interactions
   - Buying signals over time
   - Open commitments
   - All notes
   - Link to related deals

5. Add to command center item card:
   - If response draft exists, show "View Draft" button
   - Clicking opens modal with draft, can edit and send

Test the full flow:
1. Send an email to yourself from a contact email
2. Verify it gets analyzed with context
3. Verify relationship updates
4. Verify CC item appears with rich context
5. Add a note and re-analyze
6. Verify the analysis changes
```

### Success Criteria
- [ ] Full pipeline works end-to-end
- [ ] UI shows rich context on cards
- [ ] Can add context and re-analyze
- [ ] Relationship view shows cumulative intelligence
- [ ] Response drafts are viewable and sendable

---

## Quick Reference: File Structure

After all sessions, you should have:

```
src/lib/intelligence/
  ├── buildRelationshipContext.ts      # Session 3
  ├── analyzeInboundEmail.ts           # Session 4
  ├── analyzeOutboundEmail.ts          # Session 2
  ├── updateRelationshipFromInteraction.ts  # Session 5
  └── index.ts                         # Exports

src/app/api/
  ├── command-center/
  │   └── [itemId]/
  │       └── add-context/
  │           └── route.ts             # Session 6
  ├── relationships/
  │   └── [contactId]/
  │       └── notes/
  │           └── route.ts             # Session 6
  └── cron/
      └── analyze-emails/
          └── route.ts                 # Session 7

Database tables:
  - relationship_intelligence          # Session 1
  - relationship_notes                  # Session 1
  - emails.analysis_json (column)       # Session 1
```

---

## Tips for Each Session

1. **Start each session with exploration** — Have Claude Code find existing code before writing new code

2. **Test with real data** — After each feature, test with actual emails/contacts from your database

3. **Show before/after** — Especially for Session 4 and 6, compare analysis with and without context

4. **Don't skip Sessions 1-3** — They're the foundation. Context builder (Session 3) is critical.

5. **Session 7 is integration** — If earlier sessions work, this is mostly wiring

---

## Starting Session 1

Copy this to start:

```
I'm building a Relationship Intelligence system for our CRM. The full spec 
is at /docs/specs/CLAUDE-CODE-PROMPT-Relationship-Intelligence.md

This system will store cumulative context about each contact/company 
relationship that grows smarter with every email and call.

Before we start, explore the codebase and find:
1. How we handle database migrations (Prisma, raw SQL, Drizzle?)
2. The contacts table schema
3. The companies table schema  
4. The emails table schema
5. Where email sync from Microsoft Graph happens

Tell me what you find, then we'll create the database schema.
```
