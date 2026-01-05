# Claude Code Prompt: Meeting Prep Hub — Phase 1
## Database Schema + Collateral Library

---

## INSTRUCTIONS FOR CLAUDE CODE

You are implementing Phase 1 of the Meeting Prep Hub feature. This phase includes:
1. Database migrations for collateral, software_links, and meeting_prep_notes tables
2. Supabase Storage bucket for collateral files
3. Collateral Library UI with upload/edit/delete functionality
4. API endpoints for collateral CRUD operations

**Read the spec first:**
```
cat /docs/specs/MEETING-PREP-HUB-INTEGRATION-SPEC.md
```

**IMPORTANT: This build should be autonomous. Run all QC checks yourself before proceeding to the next step.**

---

## STEP 1: Database Migration

### 1.1 Create Migration File

Create the migration at `supabase/migrations/[timestamp]_add_collateral_tables.sql` using the schema from the spec.

### 1.2 Run Migration

```bash
npx supabase db push
```

### 1.3 QC Check — Verify Tables Exist

**Use Postgres MCP to verify:**

```sql
-- Check all tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('collateral', 'collateral_usage', 'software_links', 'meeting_prep_notes');

-- Should return 4 rows
```

```sql
-- Verify collateral table has correct columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'collateral'
ORDER BY ordinal_position;

-- Should include: id, name, description, file_path, file_name, file_type, 
-- document_type, meeting_types, products, industries, company_sizes, etc.
```

```sql
-- Verify indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'collateral';

-- Should include GIN indexes on meeting_types, products, industries
```

```sql
-- Verify default software link was inserted
SELECT name, url FROM software_links;

-- Should return 'Demo Environment' row
```

**✅ PASS CRITERIA:** All 4 tables exist, collateral has all columns, indexes created, default data inserted.

**❌ IF FAILED:** Review migration file, check for syntax errors, re-run migration.

---

## STEP 2: Supabase Storage Bucket

### 2.1 Create Storage Bucket

Create or verify the collateral bucket exists. Add to `supabase/config.toml` or create via dashboard/API:

```typescript
// In a setup script or migration
const { data, error } = await supabase.storage.createBucket('collateral', {
  public: false,
  fileSizeLimit: 26214400, // 25MB
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/html',
    'image/png',
    'image/jpeg',
  ],
});
```

### 2.2 QC Check — Verify Bucket

```bash
# List buckets via Supabase CLI or check in dashboard
npx supabase storage ls
```

**✅ PASS CRITERIA:** 'collateral' bucket exists with correct settings.

---

## STEP 3: TypeScript Types

### 3.1 Create Types File

Create `src/types/collateral.ts`:

```typescript
export type DocumentType =
  | 'one_pager'
  | 'case_study'
  | 'pricing'
  | 'proposal_template'
  | 'implementation_guide'
  | 'technical_doc'
  | 'demo_script'
  | 'roi_calculator'
  | 'contract'
  | 'presentation'
  | 'video'
  | 'other';

export type MeetingType =
  | 'discovery'
  | 'demo'
  | 'technical_deep_dive'
  | 'proposal'
  | 'trial_kickoff'
  | 'implementation'
  | 'check_in'
  | 'executive';

export type ProductTag =
  | 'voice_agent'
  | 'performance_center'
  | 'action_hub'
  | 'accountability_hub'
  | 'call_analytics'
  | 'platform';

export type IndustryTag =
  | 'pest_control'
  | 'lawn_care'
  | 'hvac'
  | 'plumbing'
  | 'general';

export type CompanySizeTag =
  | 'smb'
  | 'mid_market'
  | 'enterprise'
  | 'pe_platform';

export interface Collateral {
  id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string;
  file_size: number | null;
  thumbnail_path: string | null;
  external_url: string | null;
  document_type: DocumentType;
  meeting_types: MeetingType[];
  products: ProductTag[];
  industries: IndustryTag[];
  company_sizes: CompanySizeTag[];
  version: string;
  is_current: boolean;
  previous_version_id: string | null;
  view_count: number;
  share_count: number;
  last_used_at: string | null;
  visibility: 'team' | 'personal' | 'public';
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CollateralUsage {
  id: string;
  collateral_id: string;
  user_id: string;
  meeting_id: string | null;
  deal_id: string | null;
  company_id: string | null;
  action: 'viewed' | 'downloaded' | 'shared' | 'copied_link';
  created_at: string;
}

export interface SoftwareLink {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  show_for_meeting_types: MeetingType[];
  show_for_products: ProductTag[];
  show_for_deal_stages: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CollateralFilters {
  document_type?: DocumentType;
  meeting_type?: MeetingType;
  product?: ProductTag;
  industry?: IndustryTag;
  search?: string;
  include_archived?: boolean;
}
```

### 3.2 QC Check — TypeScript Compiles

```bash
npx tsc --noEmit
```

**✅ PASS CRITERIA:** No TypeScript errors related to collateral types.

---

## STEP 4: API Endpoints

### 4.1 Create Collateral API Routes

Create the following files:

**`src/app/api/collateral/route.ts`** — List and create collateral
**`src/app/api/collateral/[id]/route.ts`** — Get, update, delete single item
**`src/app/api/collateral/[id]/track/route.ts`** — Track usage
**`src/app/api/collateral/upload/route.ts`** — Handle file uploads

Reference existing API patterns in the codebase for authentication, error handling, and response format.

### 4.2 QC Check — API Endpoints Work

**Test with curl or use the Playwright MCP to test via UI later:**

```bash
# Start dev server if not running
npm run dev

# Test list endpoint (should return empty array initially)
curl -X GET http://localhost:3000/api/collateral \
  -H "Cookie: [auth-cookie]" | jq

# Test create endpoint
curl -X POST http://localhost:3000/api/collateral \
  -H "Content-Type: application/json" \
  -H "Cookie: [auth-cookie]" \
  -d '{
    "name": "Test One-Pager",
    "document_type": "one_pager",
    "file_type": "link",
    "external_url": "https://example.com/test.pdf",
    "meeting_types": ["discovery", "demo"],
    "products": ["voice_agent"],
    "industries": ["pest_control"],
    "company_sizes": ["smb", "mid_market"]
  }' | jq

# Verify it was created
curl -X GET http://localhost:3000/api/collateral | jq
```

**Use Postgres MCP to verify data:**

```sql
SELECT id, name, document_type, meeting_types, products 
FROM collateral 
WHERE name = 'Test One-Pager';
```

**✅ PASS CRITERIA:** API returns 200, data appears in database with correct values.

---

## STEP 5: Collateral Library UI

### 5.1 Create Components

Create these components following existing UI patterns in the codebase:

1. **`src/components/collateral/CollateralLibrary.tsx`** — Main page component
2. **`src/components/collateral/CollateralCard.tsx`** — Individual item card
3. **`src/components/collateral/CollateralUploadModal.tsx`** — Upload/edit modal
4. **`src/components/collateral/CollateralFilters.tsx`** — Filter bar

### 5.2 Create Page Route

Create `src/app/collateral/page.tsx` that renders the CollateralLibrary.

### 5.3 Add Navigation Link

Add "Collateral" to the sidebar navigation (check existing nav component location).

### 5.4 QC Check — Visual Verification with Playwright MCP

**Use Playwright MCP to verify the UI:**

```
Navigate to http://localhost:3000/collateral

Take screenshot of the empty state

Click the "Upload New" button

Verify the upload modal appears

Take screenshot of the upload modal

Fill in the form:
- Name: "Voice Agent Overview"
- Document Type: "One-Pager" 
- File Type: select "External Link"
- URL: "https://example.com/voice-agent.pdf"
- Meeting Types: check "Discovery" and "Demo"
- Products: check "Voice Agent"

Click "Save"

Verify the card appears in the library

Take screenshot showing the new card
```

**Also verify via Postgres MCP:**

```sql
SELECT name, document_type, meeting_types, products 
FROM collateral 
WHERE name = 'Voice Agent Overview';
```

**✅ PASS CRITERIA:** 
- Page loads without errors
- Empty state displays correctly
- Upload modal opens and has all fields
- Form submission creates record
- Card appears in library with correct info

---

## STEP 6: File Upload Functionality

### 6.1 Implement File Upload

Update `CollateralUploadModal.tsx` to handle actual file uploads to Supabase Storage.

Create `src/lib/collateral/storage.ts`:

```typescript
import { createClient } from '@/lib/supabase/client';

export async function uploadCollateralFile(
  file: File,
  userId: string
): Promise<{ path: string; error: Error | null }> {
  const supabase = createClient();
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('collateral')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) {
    return { path: '', error };
  }
  
  return { path: data.path, error: null };
}

export async function getCollateralFileUrl(path: string): Promise<string> {
  const supabase = createClient();
  
  const { data } = await supabase.storage
    .from('collateral')
    .createSignedUrl(path, 3600); // 1 hour expiry
  
  return data?.signedUrl || '';
}

export async function deleteCollateralFile(path: string): Promise<void> {
  const supabase = createClient();
  
  await supabase.storage.from('collateral').remove([path]);
}
```

### 6.2 QC Check — File Upload Works

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/collateral

Click "Upload New"

Upload a test PDF file (create a simple test.pdf if needed)

Fill in required fields:
- Name: "Test PDF Upload"
- Document Type: "Other"

Submit the form

Verify success message appears

Click on the new card to preview/download

Verify the PDF can be accessed
```

**Verify in Postgres:**

```sql
SELECT name, file_path, file_name, file_type, file_size 
FROM collateral 
WHERE name = 'Test PDF Upload';

-- file_path should be populated
-- file_size should be > 0
```

**✅ PASS CRITERIA:** File uploads successfully, file_path stored, file is downloadable.

---

## STEP 7: Edit and Delete Functionality

### 7.1 Implement Edit

Add edit functionality to CollateralCard — clicking "Edit" should open the modal with existing data pre-filled.

### 7.2 Implement Delete (Archive)

Add delete functionality that soft-deletes (sets archived_at) rather than hard delete.

### 7.3 QC Check — Edit/Delete Works

**Use Playwright MCP:**

```
Navigate to http://localhost:3000/collateral

Find the "Test PDF Upload" card

Click the "..." menu and select "Edit"

Change the name to "Test PDF Upload - Edited"

Save

Verify the card shows the new name

Click "..." menu and select "Delete"

Confirm deletion

Verify the card is removed from the list
```

**Verify in Postgres:**

```sql
-- Should show the edited name and archived_at set
SELECT name, archived_at 
FROM collateral 
WHERE name LIKE 'Test PDF Upload%';
```

**✅ PASS CRITERIA:** Edit updates record, delete sets archived_at, item disappears from UI.

---

## STEP 8: Filter and Search

### 8.1 Implement Filters

Add working filters for:
- Document type dropdown
- Meeting type multi-select
- Product multi-select
- Search box

### 8.2 QC Check — Filters Work

**First, create test data via Postgres MCP:**

```sql
INSERT INTO collateral (name, document_type, file_type, external_url, meeting_types, products, industries, created_by)
VALUES 
  ('Discovery Script', 'demo_script', 'link', 'https://example.com/1', ARRAY['discovery'], ARRAY['voice_agent'], ARRAY['pest_control'], '[user-id]'),
  ('Demo Deck', 'presentation', 'link', 'https://example.com/2', ARRAY['demo'], ARRAY['platform'], ARRAY['lawn_care'], '[user-id]'),
  ('Pricing Sheet', 'pricing', 'link', 'https://example.com/3', ARRAY['proposal'], ARRAY['voice_agent', 'platform'], ARRAY['general'], '[user-id]');
```

**Use Playwright MCP to test filters:**

```
Navigate to http://localhost:3000/collateral

Verify all 3+ items show

Select "Demo Script" from document type filter

Verify only 1 item shows

Clear filter

Select "Discovery" from meeting type filter

Verify correct items show

Type "Pricing" in search box

Verify only Pricing Sheet shows
```

**✅ PASS CRITERIA:** Each filter correctly narrows results, search works, filters can be combined.

---

## STEP 9: Final QC Checklist

Run through this complete checklist before marking Phase 1 complete:

### Database
- [ ] All 4 tables exist (collateral, collateral_usage, software_links, meeting_prep_notes)
- [ ] Indexes created on array columns
- [ ] RLS policies active
- [ ] Default software link exists

### Storage
- [ ] Collateral bucket exists
- [ ] File upload works
- [ ] Signed URLs work for downloads

### API
- [ ] GET /api/collateral returns list
- [ ] POST /api/collateral creates item
- [ ] GET /api/collateral/[id] returns single item
- [ ] PATCH /api/collateral/[id] updates item
- [ ] DELETE /api/collateral/[id] archives item
- [ ] POST /api/collateral/[id]/track logs usage

### UI
- [ ] /collateral page loads
- [ ] Navigation link works
- [ ] Empty state displays
- [ ] Upload modal opens
- [ ] File upload works
- [ ] External link works
- [ ] Cards display correctly
- [ ] Edit works
- [ ] Delete (archive) works
- [ ] Filters work
- [ ] Search works

### TypeScript
- [ ] No type errors: `npx tsc --noEmit`

### Lint
- [ ] No lint errors: `npm run lint`

---

## COMPLETION

When all QC checks pass, create a commit:

```bash
git add .
git commit -m "feat: Add Collateral Library (Phase 1 of Meeting Prep Hub)

- Add collateral, collateral_usage, software_links, meeting_prep_notes tables
- Add Supabase Storage bucket for file uploads
- Create CollateralLibrary page with CRUD operations
- Add filters and search functionality
- Track collateral usage"
```

**Then proceed to Phase 2: Meeting Prep Page**
