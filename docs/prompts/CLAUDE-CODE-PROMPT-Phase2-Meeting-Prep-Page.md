# Claude Code Prompt: Meeting Prep Hub — Phase 2
## Enhanced Meeting Prep Page

---

## PREREQUISITES

**Phase 1 must be complete.** Verify by running:

```sql
-- Via Postgres MCP
SELECT COUNT(*) FROM collateral;
SELECT COUNT(*) FROM software_links;
-- Both should return results
```

**Read the spec:**
```bash
cat /docs/specs/MEETING-PREP-HUB-INTEGRATION-SPEC.md
```

---

## OVERVIEW

This phase builds the enhanced Meeting Prep page at `/meetings/[meetingId]/prep` that:
1. Uses EXISTING prep generation functions (do not recreate)
2. Adds collateral matching based on meeting context
3. Shows software links contextually
4. Displays past context (existing functionality)
5. Provides a notes section (persisted)

---

## STEP 1: Collateral Matching Logic

### 1.1 Create Matching Module

Create `src/lib/collateral/matching.ts` as specified in the integration spec.

### 1.2 Create Meeting Type Inference

Create `src/lib/collateral/inferMeetingType.ts` as specified.

### 1.3 QC Check — Matching Logic Works

**Create test data via Postgres MCP:**

```sql
-- Clear any test data first
DELETE FROM collateral WHERE name LIKE 'QC Test%';

-- Insert test collateral with specific tags
INSERT INTO collateral (name, document_type, file_type, external_url, meeting_types, products, industries, company_sizes, is_current, created_by)
VALUES 
  ('QC Test - Discovery One-Pager', 'one_pager', 'link', 'https://test.com/1', 
   ARRAY['discovery'], ARRAY['voice_agent'], ARRAY['pest_control'], ARRAY['smb'], true, (SELECT id FROM users LIMIT 1)),
  ('QC Test - Demo Deck', 'presentation', 'link', 'https://test.com/2', 
   ARRAY['demo'], ARRAY['voice_agent', 'platform'], ARRAY['general'], ARRAY[]::text[], true, (SELECT id FROM users LIMIT 1)),
  ('QC Test - Proposal Template', 'proposal_template', 'link', 'https://test.com/3', 
   ARRAY['proposal'], ARRAY['platform'], ARRAY['lawn_care'], ARRAY['enterprise'], true, (SELECT id FROM users LIMIT 1)),
  ('QC Test - Universal Case Study', 'case_study', 'link', 'https://test.com/4', 
   ARRAY['discovery', 'demo', 'proposal'], ARRAY['voice_agent', 'platform'], ARRAY['pest_control', 'lawn_care'], ARRAY[]::text[], true, (SELECT id FROM users LIMIT 1));
```

**Test matching in Node REPL or create a test file:**

```typescript
// Create src/lib/collateral/__tests__/matching.test.ts
import { getMatchingCollateral } from '../matching';

describe('Collateral Matching', () => {
  it('should return discovery collateral for discovery meeting', async () => {
    const results = await getMatchingCollateral({
      meetingType: 'discovery',
      products: ['voice_agent'],
      industry: 'pest_control',
      companySize: 'smb',
    });
    
    // Should include Discovery One-Pager and Universal Case Study
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.name.includes('Discovery'))).toBe(true);
  });
  
  it('should rank more specific matches higher', async () => {
    const results = await getMatchingCollateral({
      meetingType: 'demo',
      products: ['voice_agent', 'platform'],
      industry: 'pest_control',
    });
    
    // Demo Deck should rank high (matches meeting type + products)
    // Universal Case Study should also appear
    console.log('Demo matching results:', results.map(r => ({ name: r.name, score: r.relevanceScore })));
    expect(results.length).toBeGreaterThan(0);
  });
});
```

**Run test:**
```bash
npm test -- --testPathPattern=matching
```

**✅ PASS CRITERIA:** Matching returns relevant collateral, ranked by relevance score.

---

## STEP 2: Enhanced Prep Data Builder

### 2.1 Create Builder Module

Create `src/lib/meetingPrep/buildEnhancedPrep.ts` as specified.

**CRITICAL:** This must call the EXISTING functions:
- `generateContextAwareMeetingPrep()` from `src/lib/intelligence/generateMeetingPrep.ts`
- `generateCompleteMeetingPrep()` from `src/lib/commandCenter/meetingPrep.ts`
- `hasRichContext()` from `src/lib/intelligence/generateMeetingPrep.ts`

Do NOT recreate the AI prep generation logic.

### 2.2 QC Check — Builder Integrates Correctly

**Verify existing functions are imported:**

```bash
grep -n "generateContextAwareMeetingPrep\|generateCompleteMeetingPrep\|hasRichContext" src/lib/meetingPrep/buildEnhancedPrep.ts
```

**Should show imports from the existing files, NOT new implementations.**

**Create a simple integration test:**

```typescript
// src/lib/meetingPrep/__tests__/buildEnhancedPrep.test.ts
import { buildEnhancedMeetingPrep } from '../buildEnhancedPrep';

describe('Enhanced Prep Builder', () => {
  it('should return complete prep data structure', async () => {
    // Use a real user ID and meeting data
    const result = await buildEnhancedMeetingPrep(
      'test-user-id', // Replace with real user ID
      'test-meeting-id',
      {
        title: 'Demo with Test Company',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        attendeeEmails: ['test@example.com'],
        dealId: null,
        companyId: null,
      }
    );
    
    // Verify structure
    expect(result.meeting).toBeDefined();
    expect(result.meeting.meetingType).toBe('demo'); // Inferred from title
    expect(result.aiPrep).toBeDefined();
    expect(result.aiPrep.objective).toBeDefined();
    expect(result.collateral).toBeInstanceOf(Array);
    expect(result.softwareLinks).toBeInstanceOf(Array);
    expect(result.pastContext).toBeInstanceOf(Array);
  });
});
```

**✅ PASS CRITERIA:** Builder returns complete structure, uses existing prep functions, includes matched collateral.

---

## STEP 3: API Endpoint

### 3.1 Create Prep API Route

Create `src/app/api/meetings/[meetingId]/prep/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildEnhancedMeetingPrep } from '@/lib/meetingPrep/buildEnhancedPrep';
import { enrichAttendees } from '@/lib/commandCenter/meetingPrep';

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const meetingId = params.meetingId;
  
  // Get meeting from Microsoft sync or activities
  // This depends on your existing meeting data structure
  // Check src/lib/microsoft/ for how meetings are stored
  
  // ... fetch meeting data ...
  
  const prepData = await buildEnhancedMeetingPrep(
    user.id,
    meetingId,
    meetingData // From your meeting fetch
  );
  
  // Enrich attendees using existing function
  prepData.attendees = await enrichAttendees(
    meetingData.attendeeEmails,
    prepData.company?.id
  );
  
  return NextResponse.json(prepData);
}
```

### 3.2 Create Notes API Route

Create `src/app/api/meetings/[meetingId]/prep/notes/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  const { prep_notes, meeting_notes, deal_id, company_id } = body;
  
  // Upsert notes
  const { data, error } = await supabase
    .from('meeting_prep_notes')
    .upsert(
      {
        meeting_id: params.meetingId,
        user_id: user.id,
        prep_notes,
        meeting_notes,
        deal_id,
        company_id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'meeting_id,user_id',
      }
    )
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}
```

### 3.3 QC Check — API Works

**Test the notes endpoint:**

```bash
# Save notes
curl -X POST http://localhost:3000/api/meetings/test-meeting-123/prep/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: [auth-cookie]" \
  -d '{
    "prep_notes": "Remember to ask about their spring rush",
    "meeting_notes": null
  }' | jq
```

**Verify in Postgres:**

```sql
SELECT * FROM meeting_prep_notes WHERE meeting_id = 'test-meeting-123';
```

**✅ PASS CRITERIA:** Notes save correctly, upsert works on duplicate meeting_id+user_id.

---

## STEP 4: Meeting Prep Page UI

### 4.1 Create Page Components

Create these components based on existing UI patterns:

**`src/components/meetingPrep/MeetingPrepPage.tsx`** — Main layout
**`src/components/meetingPrep/PrepHeader.tsx`** — Title, time, join button
**`src/components/meetingPrep/AttendeesList.tsx`** — Attendee cards with intel
**`src/components/meetingPrep/DealContext.tsx`** — Deal summary card
**`src/components/meetingPrep/AIPrepSection.tsx`** — Objective, talking points, landmines, questions
**`src/components/meetingPrep/CollateralGrid.tsx`** — Matched collateral cards
**`src/components/meetingPrep/SoftwareLinks.tsx`** — Quick access buttons
**`src/components/meetingPrep/PastContextLinks.tsx`** — Links to related records
**`src/components/meetingPrep/PrepNotesEditor.tsx`** — Auto-save textarea

**Reference existing components:**
- `src/components/commandCenter/MeetingPrepPopout.tsx` for layout patterns
- Existing card components for styling

### 4.2 Create Page Route

Create `src/app/meetings/[meetingId]/prep/page.tsx`:

```typescript
import { MeetingPrepPage } from '@/components/meetingPrep/MeetingPrepPage';

export default function PrepPage({ params }: { params: { meetingId: string } }) {
  return <MeetingPrepPage meetingId={params.meetingId} />;
}
```

### 4.3 QC Check — Page Renders

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/meetings/[real-meeting-id]/prep

Take screenshot of the full page

Verify these sections are visible:
- Header with meeting title and time
- Attendees section (or empty state)
- Deal context (or empty state)
- AI Prep section with objective, talking points
- Collateral grid
- Software links
- Past context links
- Notes editor

Take screenshot of each section
```

**✅ PASS CRITERIA:** Page loads without errors, all sections render, loading states work.

---

## STEP 5: Collateral Display

### 5.1 Implement CollateralGrid

The CollateralGrid should:
- Display matched collateral as cards
- Show name, document type, icon
- Provide "View" and "Copy Link" actions
- Track usage when clicked

### 5.2 QC Check — Collateral Shows Correctly

**First, ensure test collateral exists (from Step 1.3)**

**Use Playwright MCP:**

```
Navigate to a meeting prep page where:
- Meeting title contains "demo" 
- OR deal stage is "demo"

Verify collateral grid shows relevant items

Click "View" on a collateral item

Verify it opens (external link or file download)

Click "Copy Link"

Verify clipboard contains URL
```

**Verify usage tracking in Postgres:**

```sql
SELECT c.name, cu.action, cu.created_at 
FROM collateral_usage cu 
JOIN collateral c ON cu.collateral_id = c.id 
ORDER BY cu.created_at DESC 
LIMIT 5;
```

**✅ PASS CRITERIA:** Relevant collateral displayed, actions work, usage tracked.

---

## STEP 6: Notes Auto-Save

### 6.1 Implement PrepNotesEditor

The notes editor should:
- Load existing notes on mount
- Auto-save after 1 second of no typing (debounce)
- Show "Saving..." and "Saved ✓" indicators
- Associate notes with deal_id and company_id if available

### 6.2 QC Check — Notes Persist

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/meetings/[meeting-id]/prep

Find the notes editor

Type: "Test note - checking auto-save"

Wait 2 seconds

Verify "Saved ✓" indicator appears

Refresh the page

Verify the notes are still there
```

**Verify in Postgres:**

```sql
SELECT prep_notes, updated_at 
FROM meeting_prep_notes 
WHERE meeting_id = '[meeting-id]';
```

**✅ PASS CRITERIA:** Notes auto-save, persist across refresh, show save indicator.

---

## STEP 7: Link from Existing UI

### 7.1 Add Prep Link to Meeting Components

Find where meetings are displayed in the UI:
- Calendar view
- Command Center meeting cards
- Focus Mode (if implemented)

Add a "Meeting Prep" button/link that navigates to `/meetings/[id]/prep`.

### 7.2 QC Check — Navigation Works

**Use Playwright MCP:**

```
Navigate to the calendar or Command Center

Find an upcoming meeting

Click the "Meeting Prep" button/link

Verify it navigates to /meetings/[id]/prep

Verify the correct meeting data loads
```

**✅ PASS CRITERIA:** Prep link visible on meetings, navigation works correctly.

---

## STEP 8: Software Links Display

### 8.1 Implement SoftwareLinks Component

Should:
- Query software_links table based on meeting context
- Display as buttons with icons
- Open in new tab on click

### 8.2 QC Check — Software Links Work

**First, verify/add software link data:**

```sql
-- Check existing
SELECT * FROM software_links WHERE is_active = true;

-- Add more if needed
INSERT INTO software_links (name, description, url, icon, show_for_meeting_types, is_active, sort_order)
VALUES 
  ('Technical Docs', 'API and integration documentation', 'https://docs.xrai.com', 'Book', ARRAY['technical_deep_dive'], true, 2);
```

**Use Playwright MCP:**

```
Navigate to a demo meeting prep page

Verify "Demo Environment" link is visible

Click the link

Verify it opens in new tab (check window.open was called)

Navigate to a technical_deep_dive meeting prep page

Verify "Technical Docs" link is visible
```

**✅ PASS CRITERIA:** Links show contextually, open correctly.

---

## STEP 9: Full Integration Test

### 9.1 End-to-End Test

**Create a complete test scenario:**

```
1. Create a deal in stage "demo" with products voice=true
2. Create a company in industry "pest_control"
3. Associate them
4. Navigate to a meeting with this deal
5. Verify:
   - Meeting type inferred as "demo"
   - Voice Agent collateral shows
   - Pest control case studies show
   - Demo Environment link shows
   - AI prep has talking points
   - Notes can be saved
```

**Use Playwright MCP to execute this flow.**

### 9.2 QC Check — Complete Flow

**Verify in Postgres after the test:**

```sql
-- Check collateral usage was tracked
SELECT c.name, cu.action, cu.deal_id, cu.meeting_id
FROM collateral_usage cu
JOIN collateral c ON cu.collateral_id = c.id
WHERE cu.created_at > NOW() - INTERVAL '1 hour';

-- Check notes were saved with deal association
SELECT mpn.prep_notes, d.name as deal_name
FROM meeting_prep_notes mpn
LEFT JOIN deals d ON mpn.deal_id = d.id
WHERE mpn.created_at > NOW() - INTERVAL '1 hour';
```

**✅ PASS CRITERIA:** Complete flow works end-to-end, data associations correct.

---

## STEP 10: Final QC Checklist

### API Endpoints
- [ ] GET /api/meetings/[id]/prep returns enhanced prep data
- [ ] POST /api/meetings/[id]/prep/notes saves notes
- [ ] Notes upsert works (no duplicates)

### UI Components
- [ ] MeetingPrepPage loads and renders all sections
- [ ] PrepHeader shows meeting info and join button
- [ ] AttendeesList shows attendees with intel
- [ ] DealContext shows deal info when available
- [ ] AIPrepSection shows objective, talking points, landmines, questions
- [ ] CollateralGrid shows matched collateral
- [ ] SoftwareLinks shows contextual links
- [ ] PastContextLinks shows related records
- [ ] PrepNotesEditor auto-saves

### Integration
- [ ] Collateral matching uses correct context
- [ ] Meeting type inference works
- [ ] Notes associate with deal/company
- [ ] Usage tracking works
- [ ] Navigation from calendar/command center works

### Existing Integration
- [ ] Uses existing generateContextAwareMeetingPrep
- [ ] Uses existing enrichAttendees
- [ ] No duplicate AI prompt logic

### Code Quality
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`
- [ ] No console errors in browser

---

## COMPLETION

When all checks pass:

```bash
git add .
git commit -m "feat: Add Enhanced Meeting Prep Page (Phase 2 of Meeting Prep Hub)

- Add /meetings/[id]/prep page with full prep view
- Integrate collateral matching by meeting context
- Add software links display
- Add auto-save prep notes
- Connect to existing AI prep generation
- Add navigation from calendar and command center"
```

**Then proceed to Phase 3: Polish and Settings**
