# X-FORCE: Complete Context-First Architecture (Phases 2-5)

## Context

Phase 1 is complete:
- ✅ `contextFirstPipeline.ts` — Main entry point for all communications
- ✅ `entityMatcher.ts` — AI-powered matching (95% confidence on known contacts)
- ✅ Integration test passed (7/7 checks)
- ✅ Cleanup complete (9 deprecated files removed)

Now complete Phases 2-5 to make the company page the true source of truth.

---

## Phase 2: Schema Validation & Refinement

### Check Current Schema

```sql
-- Check relationship_intelligence table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'relationship_intelligence'
ORDER BY ordinal_position;
```

### Required Columns

Ensure these columns exist (add if missing):

```sql
-- Core context fields
ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  context_summary TEXT;

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  context_summary_updated_at TIMESTAMPTZ;

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  facts_learned JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  communication_history JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  open_commitments JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  buying_signals JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  concerns_objections JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  stakeholders JSONB DEFAULT '[]';

-- Salesperson additions (Phase 4 prep)
ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  salesperson_notes JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  salesperson_corrections JSONB DEFAULT '[]';

-- Metadata
ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  last_interaction_at TIMESTAMPTZ;

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  interaction_count INTEGER DEFAULT 0;

ALTER TABLE relationship_intelligence ADD COLUMN IF NOT EXISTS 
  health_score INTEGER;
```

### Create Indexes for Performance

```sql
CREATE INDEX IF NOT EXISTS idx_ri_company_id ON relationship_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_ri_contact_id ON relationship_intelligence(contact_id);
CREATE INDEX IF NOT EXISTS idx_ri_deal_id ON relationship_intelligence(deal_id);
CREATE INDEX IF NOT EXISTS idx_ri_last_interaction ON relationship_intelligence(last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_ri_user_id ON relationship_intelligence(user_id);
```

---

## Phase 3: Company Page as Source of Truth

### Goal

The company page should show EVERYTHING we know about a relationship in one place.

### Check Current Company Page

```bash
find src -path "*company*" -name "*.tsx" | head -20
cat src/app/companies/[id]/page.tsx
```

### Required Sections on Company Page

Create or update the company detail page to include:

#### 1. Relationship Summary Card
```tsx
// Shows AI-generated context summary
<RelationshipSummaryCard 
  summary={relationshipIntelligence.context_summary}
  updatedAt={relationshipIntelligence.context_summary_updated_at}
  healthScore={relationshipIntelligence.health_score}
/>
```

#### 2. Key Facts Panel
```tsx
// All facts we've learned about this company/relationship
<KeyFactsPanel facts={relationshipIntelligence.facts_learned} />
```

#### 3. Communication Timeline
```tsx
// Chronological view of all interactions
<CommunicationTimeline 
  history={relationshipIntelligence.communication_history}
  emails={linkedEmails}
  transcripts={linkedTranscripts}
  meetings={linkedMeetings}
/>
```

#### 4. Commitments Tracker
```tsx
// What we promised them, what they promised us
<CommitmentsTracker 
  ourCommitments={relationshipIntelligence.open_commitments.filter(c => c.owner === 'us')}
  theirCommitments={relationshipIntelligence.open_commitments.filter(c => c.owner === 'them')}
/>
```

#### 5. Buying Signals & Concerns
```tsx
// Signals detected from communications
<SignalsPanel 
  buyingSignals={relationshipIntelligence.buying_signals}
  concerns={relationshipIntelligence.concerns_objections}
/>
```

#### 6. Stakeholder Map
```tsx
// All people involved in the relationship
<StakeholderMap 
  stakeholders={relationshipIntelligence.stakeholders}
  contacts={linkedContacts}
/>
```

#### 7. Active Actions (from Command Center)
```tsx
// What's pending for this company - derived from current state
<ActiveActionsPanel companyId={company.id} />
```

#### 8. Salesperson Notes (Phase 4)
```tsx
// Manual notes and corrections
<SalespersonNotesPanel 
  notes={relationshipIntelligence.salesperson_notes}
  corrections={relationshipIntelligence.salesperson_corrections}
  onAddNote={handleAddNote}
  onAddCorrection={handleAddCorrection}
/>
```

### API Endpoint for Full Company Intelligence

Create or update: `src/app/api/companies/[id]/intelligence/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const companyId = params.id;
  
  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();
  
  // Get relationship intelligence
  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  // Get linked contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId);
  
  // Get linked deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('company_id', companyId);
  
  // Get recent emails
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, from_address, to_address, received_at, direction')
    .eq('company_id', companyId)
    .order('received_at', { ascending: false })
    .limit(20);
  
  // Get transcripts
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, duration_minutes')
    .eq('company_id', companyId)
    .order('meeting_date', { ascending: false })
    .limit(10);
  
  // Get active command center items
  const { data: actions } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('tier', { ascending: true });
  
  // Get account intelligence (research data)
  const { data: accountIntel } = await supabase
    .from('account_intelligence')
    .select('*')
    .eq('company_id', companyId)
    .single();
  
  return NextResponse.json({
    company,
    relationshipIntelligence: ri,
    contacts,
    deals,
    recentEmails: emails,
    transcripts,
    activeActions: actions,
    accountIntelligence: accountIntel
  });
}
```

---

## Phase 4: Salesperson Notes & Corrections

### Goal

Allow salespeople to:
1. Add their own notes/observations
2. Correct AI mistakes
3. Override AI classifications when needed

### API Endpoints

#### Add Note
`POST /api/companies/[id]/notes`

```typescript
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { note, noteType } = await request.json();
  // noteType: 'observation' | 'strategy' | 'warning' | 'context'
  
  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('salesperson_notes')
    .eq('company_id', params.id)
    .single();
  
  const notes = ri?.salesperson_notes || [];
  notes.push({
    id: crypto.randomUUID(),
    note,
    noteType,
    addedAt: new Date().toISOString(),
    addedBy: userId
  });
  
  await supabase
    .from('relationship_intelligence')
    .update({ salesperson_notes: notes })
    .eq('company_id', params.id);
  
  return NextResponse.json({ success: true });
}
```

#### Add Correction
`POST /api/companies/[id]/corrections`

```typescript
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { field, originalValue, correctedValue, reason } = await request.json();
  
  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('salesperson_corrections')
    .eq('company_id', params.id)
    .single();
  
  const corrections = ri?.salesperson_corrections || [];
  corrections.push({
    id: crypto.randomUUID(),
    field,
    originalValue,
    correctedValue,
    reason,
    correctedAt: new Date().toISOString(),
    correctedBy: userId
  });
  
  await supabase
    .from('relationship_intelligence')
    .update({ 
      salesperson_corrections: corrections,
      // Also update the actual field if it's a direct field
      ...(field === 'context_summary' ? { context_summary: correctedValue } : {})
    })
    .eq('company_id', params.id);
  
  return NextResponse.json({ success: true });
}
```

### UI Components

#### Notes Panel
```tsx
// src/components/intelligence/SalespersonNotesPanel.tsx

interface Note {
  id: string;
  note: string;
  noteType: 'observation' | 'strategy' | 'warning' | 'context';
  addedAt: string;
  addedBy: string;
}

export function SalespersonNotesPanel({ 
  notes, 
  onAddNote 
}: { 
  notes: Note[];
  onAddNote: (note: string, type: string) => void;
}) {
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('observation');
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-lg mb-4">Your Notes</h3>
      
      {/* Add new note */}
      <div className="mb-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this relationship..."
          className="w-full border rounded p-2"
          rows={3}
        />
        <div className="flex gap-2 mt-2">
          <select 
            value={noteType} 
            onChange={(e) => setNoteType(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="observation">Observation</option>
            <option value="strategy">Strategy</option>
            <option value="warning">Warning</option>
            <option value="context">Context</option>
          </select>
          <button
            onClick={() => {
              onAddNote(newNote, noteType);
              setNewNote('');
            }}
            className="bg-blue-500 text-white px-4 py-1 rounded"
          >
            Add Note
          </button>
        </div>
      </div>
      
      {/* Existing notes */}
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="border-l-4 border-blue-500 pl-3 py-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className={`px-2 py-0.5 rounded text-xs ${
                note.noteType === 'warning' ? 'bg-red-100 text-red-800' :
                note.noteType === 'strategy' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {note.noteType}
              </span>
              <span>{new Date(note.addedAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1">{note.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Correction Interface
```tsx
// Allow clicking on any AI-generated content to correct it
<CorrectableText
  value={relationshipIntelligence.context_summary}
  field="context_summary"
  onCorrect={(original, corrected, reason) => {
    handleCorrection('context_summary', original, corrected, reason);
  }}
/>
```

---

## Phase 5: Command Center as Derived View

### Goal

Command center items should be DERIVED from current context, not stored separately. When context changes, actions update automatically.

### Current State

Currently: Actions are stored in `command_center_items` table, can become stale.

### Target State

Actions are generated on-the-fly based on:
1. Current relationship intelligence state
2. Open commitments (ours and theirs)
3. Time since last interaction
4. Deal stage and health
5. Pending follow-ups from emails

### Implementation Approach

#### Option A: Hybrid (Recommended for Now)
Keep stored items but add reconciliation on every context update.

```typescript
// In contextFirstPipeline.ts, after updating relationship intelligence:

async function reconcileCommandCenterItems(
  companyId: string,
  contactId: string,
  updatedContext: RelationshipContext
) {
  // Get current active items for this company
  const { data: existingItems } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active');
  
  // Determine what actions SHOULD exist based on current context
  const requiredActions = deriveActionsFromContext(updatedContext);
  
  // Reconcile:
  // 1. Mark completed items that are now done
  // 2. Update items that need changes
  // 3. Create new items that should exist
  // 4. Mark obsolete items that no longer apply
  
  for (const existing of existingItems) {
    const stillRelevant = requiredActions.find(r => 
      r.type === existing.action_type && 
      r.sourceId === existing.source_id
    );
    
    if (!stillRelevant) {
      // Mark as obsolete
      await supabase
        .from('command_center_items')
        .update({ status: 'obsolete', obsoleted_at: new Date() })
        .eq('id', existing.id);
    }
  }
  
  for (const required of requiredActions) {
    const exists = existingItems.find(e => 
      e.action_type === required.type && 
      e.source_id === required.sourceId
    );
    
    if (!exists) {
      // Create new item
      await supabase
        .from('command_center_items')
        .insert({
          company_id: companyId,
          contact_id: contactId,
          action_type: required.type,
          title: required.title,
          tier: required.tier,
          ...required
        });
    }
  }
}
```

#### Option B: Fully Derived (Future)
Generate command center view entirely from queries, no storage.

```typescript
// GET /api/command-center - generates items on the fly
export async function GET() {
  // Get all companies with recent activity
  const { data: companies } = await supabase
    .from('relationship_intelligence')
    .select(`
      *,
      company:companies(*),
      contact:contacts(*)
    `)
    .order('last_interaction_at', { ascending: false })
    .limit(100);
  
  // Generate actions for each based on current state
  const allActions = companies.flatMap(ri => 
    deriveActionsFromContext(ri)
  );
  
  // Sort by tier and urgency
  allActions.sort((a, b) => a.tier - b.tier || b.urgency - a.urgency);
  
  return NextResponse.json({ items: allActions });
}
```

---

## Deliverables

### Phase 2 Deliverables
- [ ] Schema validation script run
- [ ] All required columns exist
- [ ] Indexes created for performance

### Phase 3 Deliverables
- [ ] Company page shows relationship summary
- [ ] Company page shows all facts learned
- [ ] Company page shows communication timeline
- [ ] Company page shows commitments (ours/theirs)
- [ ] Company page shows buying signals & concerns
- [ ] Company page shows stakeholder map
- [ ] Company page shows active actions
- [ ] API endpoint for full company intelligence

### Phase 4 Deliverables
- [ ] Add note API endpoint
- [ ] Add correction API endpoint
- [ ] Notes panel component
- [ ] Correctable text component
- [ ] Notes display on company page
- [ ] Corrections tracked and applied

### Phase 5 Deliverables
- [ ] Reconciliation runs on every context update
- [ ] Obsolete items marked when no longer relevant
- [ ] New items created when context requires
- [ ] Items update when context changes

---

## Testing

After each phase, verify:

### Phase 2
```sql
-- Verify columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'relationship_intelligence';
```

### Phase 3
```bash
# Test company intelligence endpoint
curl http://localhost:3000/api/companies/[id]/intelligence
```

### Phase 4
```bash
# Test add note
curl -X POST http://localhost:3000/api/companies/[id]/notes \
  -H "Content-Type: application/json" \
  -d '{"note": "Test note", "noteType": "observation"}'
```

### Phase 5
```bash
# Process an email and verify command center updates
# Then verify items are reconciled properly
```

---

## Order of Implementation

1. **Phase 2 first** — Schema must be right before building on it
2. **Phase 3 next** — Company page is the user-facing goal
3. **Phase 4 parallel** — Can build notes UI alongside Phase 3
4. **Phase 5 last** — Reconciliation ties everything together

Estimated time: 1 week for all phases
