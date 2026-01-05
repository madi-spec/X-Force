# Claude Code Prompt: Meeting Prep Hub — Phase 3
## Polish, Settings & Final Integration

---

## PREREQUISITES

**Phase 1 and Phase 2 must be complete.** Verify:

```bash
# Check collateral library works
curl http://localhost:3000/api/collateral | jq '.length'

# Check prep page route exists
ls src/app/meetings/*/prep/
```

```sql
-- Via Postgres MCP
SELECT COUNT(*) FROM collateral;
SELECT COUNT(*) FROM meeting_prep_notes;
-- Both should have data
```

---

## OVERVIEW

This phase adds:
1. Software Links management UI in settings
2. Collateral usage analytics
3. Notes sync to activity feed
4. Mobile responsiveness
5. Error handling and edge cases
6. Final polish and cleanup

---

## STEP 1: Software Links Settings UI

### 1.1 Create Settings Page

Create `src/app/settings/software-links/page.tsx`:

```typescript
import { SoftwareLinksManager } from '@/components/settings/SoftwareLinksManager';

export default function SoftwareLinkSettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Software Links</h1>
      <p className="text-gray-600 mb-8">
        Configure quick access links shown on meeting prep pages.
      </p>
      <SoftwareLinksManager />
    </div>
  );
}
```

### 1.2 Create Manager Component

Create `src/components/settings/SoftwareLinksManager.tsx`:

Features:
- List all software links
- Add new link (modal)
- Edit existing link
- Delete link
- Drag to reorder (sort_order)
- Toggle active/inactive

### 1.3 Create API Routes

Create `src/app/api/settings/software-links/route.ts` (GET, POST)
Create `src/app/api/settings/software-links/[id]/route.ts` (PATCH, DELETE)

### 1.4 QC Check — Settings UI Works

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/settings/software-links

Take screenshot of the page

Verify the default "Demo Environment" link is shown

Click "Add Link"

Fill in:
- Name: "Customer Portal"
- URL: "https://portal.xrai.com"
- Icon: "Users"
- Meeting Types: check "check_in", "implementation"

Save

Verify new link appears in list

Click edit on the new link

Change name to "Customer Admin Portal"

Save

Verify name updated

Toggle the link inactive

Verify it shows as inactive
```

**Verify in Postgres:**

```sql
SELECT name, url, is_active, show_for_meeting_types 
FROM software_links 
ORDER BY sort_order;
```

**✅ PASS CRITERIA:** CRUD operations work, list updates correctly, order can be changed.

---

## STEP 2: Collateral Analytics

### 2.1 Add Analytics to Collateral Library

Enhance the Collateral Library page to show:
- Total views per item
- Recent usage
- Most used this month

### 2.2 Create Analytics API

Create `src/app/api/collateral/analytics/route.ts`:

```typescript
// Returns usage stats for dashboard
export async function GET() {
  const supabase = createAdminClient();
  
  // Most viewed collateral
  const { data: mostViewed } = await supabase
    .from('collateral')
    .select('id, name, view_count')
    .order('view_count', { ascending: false })
    .limit(10);
  
  // Recent usage
  const { data: recentUsage } = await supabase
    .from('collateral_usage')
    .select(`
      action,
      created_at,
      collateral:collateral_id (name),
      deal:deal_id (name)
    `)
    .order('created_at', { ascending: false })
    .limit(20);
  
  // Usage by meeting type
  const { data: byMeetingType } = await supabase
    .rpc('collateral_usage_by_meeting_type'); // Create this function
  
  return NextResponse.json({
    mostViewed,
    recentUsage,
    byMeetingType,
  });
}
```

### 2.3 QC Check — Analytics Display

**Generate some usage data first:**

```sql
-- Insert sample usage data
INSERT INTO collateral_usage (collateral_id, user_id, action, meeting_id, deal_id, created_at)
SELECT 
  c.id,
  (SELECT id FROM users LIMIT 1),
  'viewed',
  'meeting-' || generate_series,
  NULL,
  NOW() - (generate_series || ' hours')::interval
FROM collateral c, generate_series(1, 20);
```

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/collateral

Verify analytics/stats section is visible

Check that view counts show on cards

Take screenshot showing usage data
```

**✅ PASS CRITERIA:** Analytics visible, view counts accurate, recent usage shows.

---

## STEP 3: Notes Sync to Activity Feed

### 3.1 Create Activity on Notes Save

When meeting notes are saved (after the meeting), create an activity record for the deal/company.

Update the notes API to optionally create activity:

```typescript
// In POST /api/meetings/[id]/prep/notes
if (meeting_notes && deal_id) {
  await supabase.from('activities').insert({
    user_id: user.id,
    deal_id,
    company_id,
    type: 'note',
    subject: `Meeting notes: ${meetingTitle}`,
    description: meeting_notes.substring(0, 500), // Truncate for preview
    metadata: {
      source: 'meeting_prep',
      meeting_id: meetingId,
      full_notes_available: meeting_notes.length > 500,
    },
    occurred_at: new Date().toISOString(),
  });
}
```

### 3.2 QC Check — Activity Created

**Use Playwright MCP:**

```
Navigate to a meeting prep page with a linked deal

Add meeting notes: "Great call. They're ready to move forward with trial."

Save (or wait for auto-save)

Navigate to the deal page

Verify an activity/note appears in the timeline
```

**Verify in Postgres:**

```sql
SELECT subject, description, metadata 
FROM activities 
WHERE type = 'note' 
AND metadata->>'source' = 'meeting_prep'
ORDER BY created_at DESC 
LIMIT 5;
```

**✅ PASS CRITERIA:** Notes create activity record, visible on deal timeline.

---

## STEP 4: Mobile Responsiveness

### 4.1 Audit Current Pages

Check responsive behavior on:
- Collateral Library (`/collateral`)
- Meeting Prep Page (`/meetings/[id]/prep`)
- Software Links Settings

### 4.2 Fix Mobile Issues

Common fixes needed:
- Stack columns on small screens
- Adjust card grid to single column
- Make modals full-screen on mobile
- Ensure touch targets are 44px minimum
- Fix horizontal overflow

### 4.3 QC Check — Mobile Works

**Use Playwright MCP with mobile viewport:**

```
Set viewport to 375x667 (iPhone SE)

Navigate to http://localhost:3000/collateral

Take screenshot

Verify:
- No horizontal scroll
- Cards stack vertically
- Filters are accessible (maybe collapsed)
- Upload button is reachable

Navigate to http://localhost:3000/meetings/[id]/prep

Take screenshot

Verify:
- All sections visible
- No overflow
- Notes editor is usable
- Collateral grid adapts
```

**Repeat with tablet viewport (768x1024)**

**✅ PASS CRITERIA:** All pages usable on mobile and tablet, no horizontal scroll, touch-friendly.

---

## STEP 5: Error Handling

### 5.1 Add Error Boundaries

Ensure error boundaries exist for:
- Collateral Library
- Meeting Prep Page
- Individual components that fetch data

### 5.2 Handle Edge Cases

Implement handling for:
- Meeting with no deal/company
- Meeting with no attendees
- No matching collateral
- Failed AI prep generation
- Network errors on auto-save
- Expired auth during long prep session

### 5.3 QC Check — Errors Handled Gracefully

**Test error scenarios:**

```
# Test no collateral matches
Navigate to prep page for a meeting with no deal
Verify empty state shows "No matching collateral" message

# Test API error
Temporarily break the prep API
Navigate to prep page
Verify error message displays, not crash

# Test offline auto-save
Open prep page
Disconnect network (can simulate in DevTools)
Type in notes
Verify error indicator shows
Reconnect
Verify it recovers and saves
```

**✅ PASS CRITERIA:** All error states have user-friendly messages, no crashes.

---

## STEP 6: Loading States

### 6.1 Add Skeletons

Add skeleton loading states for:
- Collateral grid
- AI prep section
- Attendees list
- Deal context

### 6.2 QC Check — Loading States Visible

**Use Playwright MCP with network throttling:**

```
Set network to "Slow 3G" in DevTools

Navigate to http://localhost:3000/meetings/[id]/prep

Take screenshot during loading

Verify skeleton states visible for each section

Wait for load complete

Verify final state renders correctly
```

**✅ PASS CRITERIA:** Skeletons show during load, smooth transition to loaded state.

---

## STEP 7: Accessibility

### 7.1 Audit Accessibility

Run accessibility checks:

```bash
# Install if needed
npm install -D @axe-core/playwright

# Add to a test file
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('collateral page accessibility', async ({ page }) => {
  await page.goto('/collateral');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

### 7.2 Fix Issues

Common fixes:
- Add aria-labels to icon buttons
- Ensure color contrast meets WCAG AA
- Add focus indicators
- Make modals trap focus
- Add alt text to any images

### 7.3 QC Check — Accessibility Passes

```bash
npm test -- --testPathPattern=accessibility
```

**✅ PASS CRITERIA:** No critical accessibility violations.

---

## STEP 8: Performance Optimization

### 8.1 Audit Performance

Check for:
- Unnecessary re-renders
- Large bundle sizes
- Slow queries
- Missing indexes

### 8.2 Optimizations

Apply as needed:
- Add `React.memo` to expensive components
- Lazy load CollateralUploadModal
- Add database indexes if queries slow
- Implement pagination for large collateral lists

### 8.3 QC Check — Performance Acceptable

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/collateral
Measure page load time (should be < 2s)

Navigate to http://localhost:3000/meetings/[id]/prep
Measure page load time (should be < 3s including AI prep)

Type in notes editor
Verify no lag/jank
```

**✅ PASS CRITERIA:** Pages load in reasonable time, no UI jank.

---

## STEP 9: Documentation

### 9.1 Add Code Comments

Ensure key functions have JSDoc comments:
- `getMatchingCollateral`
- `inferMeetingType`
- `buildEnhancedMeetingPrep`

### 9.2 Update README

Add section to project README about:
- Collateral Library usage
- Meeting Prep page
- Software Links configuration

### 9.3 Create User Guide

Create `docs/COLLATERAL-LIBRARY-GUIDE.md`:
- How to upload collateral
- Tagging best practices
- How collateral matching works

---

## STEP 10: Final Integration Test

### 10.1 Full User Journey Test

**Use Playwright MCP to execute complete flow:**

```
# Setup
1. Login as sales user
2. Navigate to /collateral

# Upload collateral
3. Upload a one-pager for Voice Agent, tagged for Discovery meetings
4. Upload a case study for pest control
5. Verify both appear in library

# Configure software links
6. Navigate to /settings/software-links
7. Add a new link for "Training Videos"
8. Verify it saves

# Test prep page
9. Navigate to calendar
10. Find an upcoming meeting with a pest control company
11. Click "Meeting Prep"
12. Verify:
    - Meeting info shows
    - AI prep generated
    - Voice Agent one-pager appears (if products match)
    - Pest control case study appears
    - Software links show
13. Add prep notes
14. Verify auto-save works

# Verify data persistence
15. Refresh the page
16. Verify notes still there
17. Navigate to deal page
18. Verify activity was created (if notes were meeting notes)

# Test collateral tracking
19. Click "View" on a collateral item
20. Navigate back to collateral library
21. Verify view count increased
```

### 10.2 Final Postgres Verification

```sql
-- Check all tables have data
SELECT 'collateral' as table_name, COUNT(*) as count FROM collateral
UNION ALL
SELECT 'collateral_usage', COUNT(*) FROM collateral_usage
UNION ALL
SELECT 'software_links', COUNT(*) FROM software_links
UNION ALL
SELECT 'meeting_prep_notes', COUNT(*) FROM meeting_prep_notes;

-- Check indexes are being used
EXPLAIN ANALYZE
SELECT * FROM collateral 
WHERE 'demo' = ANY(meeting_types) 
AND 'voice_agent' = ANY(products);
```

**✅ PASS CRITERIA:** Complete user journey works, all data persists correctly.

---

## STEP 11: Cleanup

### 11.1 Remove Test Data

```sql
DELETE FROM collateral WHERE name LIKE 'QC Test%';
DELETE FROM collateral WHERE name LIKE 'Test%';
DELETE FROM collateral_usage WHERE meeting_id LIKE 'test-%';
DELETE FROM meeting_prep_notes WHERE meeting_id LIKE 'test-%';
```

### 11.2 Remove Console Logs

```bash
# Find any remaining console.logs
grep -r "console.log" src/components/collateral/ src/components/meetingPrep/ src/lib/collateral/ src/lib/meetingPrep/
```

### 11.3 Final Lint/Type Check

```bash
npx tsc --noEmit
npm run lint
npm run build
```

**✅ PASS CRITERIA:** Build succeeds with no errors or warnings.

---

## FINAL QC CHECKLIST

### Collateral Library
- [ ] Upload file works
- [ ] Upload external link works
- [ ] Edit collateral works
- [ ] Delete (archive) works
- [ ] Filters work correctly
- [ ] Search works
- [ ] View count displays
- [ ] Usage tracking works

### Meeting Prep Page
- [ ] Page loads for any meeting
- [ ] AI prep displays (objective, talking points, etc.)
- [ ] Attendees show with intel
- [ ] Deal context shows when available
- [ ] Collateral matches based on context
- [ ] Software links show contextually
- [ ] Past context links work
- [ ] Notes auto-save
- [ ] Notes persist on refresh

### Software Links Settings
- [ ] List displays all links
- [ ] Add new link works
- [ ] Edit link works
- [ ] Delete link works
- [ ] Toggle active/inactive works
- [ ] Reorder works

### Integration
- [ ] Notes create activity on deal
- [ ] Collateral usage tracked
- [ ] Navigation from calendar works
- [ ] Navigation from Command Center works

### Quality
- [ ] Mobile responsive
- [ ] Error states handled
- [ ] Loading states display
- [ ] Accessibility passes
- [ ] Performance acceptable
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Build succeeds

---

## COMPLETION

When all checks pass:

```bash
git add .
git commit -m "feat: Complete Meeting Prep Hub (Phase 3)

- Add Software Links settings UI
- Add collateral usage analytics
- Sync notes to activity feed
- Add mobile responsiveness
- Improve error handling and loading states
- Add accessibility improvements
- Performance optimizations
- Documentation"
```

---

## POST-LAUNCH

After deploying, monitor:
1. Collateral usage patterns — what's actually being used?
2. Prep page load times — any slow queries?
3. User feedback — missing features?

Consider future enhancements:
- Collateral recommendations based on win data
- AI-generated personalized collateral
- Collateral effectiveness analytics (used in won vs lost deals)
