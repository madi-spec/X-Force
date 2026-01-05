# Meeting Prep Hub — Integration Spec

## Overview

This spec **extends** the existing meeting prep system with:
1. **Collateral Library** — Upload, tag, and manage sales materials
2. **Enhanced Prep Page** — Full page view with collateral + software links + notes
3. **Notes Sync** — Prep notes persist to CRM

---

# Existing System Reference

## Functions to REUSE (Do Not Recreate)

### From `src/lib/commandCenter/meetingPrep.ts`:
```typescript
// Enrich attendees with relationship intelligence
enrichAttendees(attendeeEmails: string[], companyId?: string): Promise<MeetingAttendee[]>

// Generate AI prep content (objective, talking points, landmines, questions)
generateMeetingPrep(title, attendees, deal, recentContext): Promise<MeetingPrepContent>

// Get links to deals, company intel, transcripts, recent meetings
gatherPrepMaterials(meetingId, dealId, companyId): Promise<PrepMaterial[]>

// Full prep generation combining all above
generateCompleteMeetingPrep(userId, meeting): Promise<{attendees, prep, materials}>
```

### From `src/lib/intelligence/generateMeetingPrep.ts`:
```typescript
// Rich context-aware prep using Relationship Intelligence
generateContextAwareMeetingPrep(meeting: MeetingInfo): Promise<FullMeetingPrep>

// Check if we have rich context for attendees
hasRichContext(attendeeEmails: string[]): Promise<boolean>
```

### From `src/lib/scheduler/emailGeneration.ts`:
```typescript
// Detailed prep brief with objection handling
generateMeetingPrepBrief(input): Promise<{
  executive_summary,
  meeting_objective,
  key_talking_points,
  questions_to_ask,
  landmines_to_avoid,
  objection_prep,
  next_steps_to_propose,
  attendee_insights
}>
```

### Existing Component:
```typescript
// src/components/commandCenter/MeetingPrepPopout.tsx
// Popout modal - reference this for UI patterns
```

### Existing Types:
```typescript
// src/types/commandCenter.ts
MeetingAttendee, MeetingPrepContent, PrepMaterial
```

---

# NEW: Database Schema

## Migration: `add_collateral_and_prep_notes.sql`

```sql
-- ============================================
-- COLLATERAL LIBRARY
-- ============================================

CREATE TABLE collateral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- File storage (Supabase Storage)
  file_path TEXT,                     -- Storage path (null if external link)
  file_name VARCHAR(255),
  file_type VARCHAR(50) NOT NULL,     -- pdf, docx, pptx, html, link
  file_size INTEGER,
  thumbnail_path TEXT,
  
  -- External link (alternative to file)
  external_url TEXT,                  -- If type is 'link'
  
  -- Categorization
  document_type VARCHAR(50) NOT NULL,
  -- Values: 'one_pager', 'case_study', 'pricing', 'proposal_template', 
  -- 'implementation_guide', 'technical_doc', 'demo_script',
  -- 'roi_calculator', 'contract', 'presentation', 'video', 'other'
  
  -- Smart matching tags (arrays for flexible querying)
  meeting_types TEXT[] DEFAULT '{}',
  -- Values: 'discovery', 'demo', 'technical_deep_dive', 'proposal', 
  -- 'trial_kickoff', 'implementation', 'check_in', 'executive'
  
  products TEXT[] DEFAULT '{}',
  -- Values: 'voice_agent', 'performance_center', 'action_hub', 
  -- 'accountability_hub', 'call_analytics', 'platform'
  
  industries TEXT[] DEFAULT '{}',
  -- Values: 'pest_control', 'lawn_care', 'hvac', 'plumbing', 'general'
  
  company_sizes TEXT[] DEFAULT '{}',
  -- Values: 'smb', 'mid_market', 'enterprise', 'pe_platform'
  
  -- Versioning
  version VARCHAR(20) DEFAULT '1.0',
  is_current BOOLEAN DEFAULT true,
  previous_version_id UUID REFERENCES collateral(id),
  
  -- Usage tracking
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Ownership
  visibility VARCHAR(20) DEFAULT 'team',
  created_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_collateral_meeting_types ON collateral USING GIN(meeting_types);
CREATE INDEX idx_collateral_products ON collateral USING GIN(products);
CREATE INDEX idx_collateral_industries ON collateral USING GIN(industries);
CREATE INDEX idx_collateral_document_type ON collateral(document_type);
CREATE INDEX idx_collateral_is_current ON collateral(is_current) WHERE is_current = true AND archived_at IS NULL;


-- ============================================
-- COLLATERAL USAGE TRACKING
-- ============================================

CREATE TABLE collateral_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID REFERENCES collateral(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  meeting_id UUID,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL,  -- 'viewed', 'downloaded', 'shared', 'copied_link'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_collateral_usage_collateral ON collateral_usage(collateral_id);
CREATE INDEX idx_collateral_usage_deal ON collateral_usage(deal_id);


-- ============================================
-- SOFTWARE ACCESS LINKS
-- ============================================

CREATE TABLE software_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  icon VARCHAR(50),  -- Lucide icon name
  
  -- Context for when to show
  show_for_meeting_types TEXT[] DEFAULT '{}',
  show_for_products TEXT[] DEFAULT '{}',
  show_for_deal_stages TEXT[] DEFAULT '{}',
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default demo environment link
INSERT INTO software_links (name, description, url, icon, show_for_meeting_types, sort_order)
VALUES ('Demo Environment', 'Main demo login', 'https://demo.xrai.com', 'Monitor', ARRAY['demo', 'discovery'], 1);


-- ============================================
-- MEETING PREP NOTES (persisted)
-- ============================================

CREATE TABLE meeting_prep_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  meeting_id VARCHAR(255) NOT NULL,   -- Microsoft Graph meeting ID
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Content
  prep_notes TEXT,      -- Notes before meeting
  meeting_notes TEXT,   -- Notes during/after
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_meeting_prep_notes_unique ON meeting_prep_notes(meeting_id, user_id);
CREATE INDEX idx_meeting_prep_notes_deal ON meeting_prep_notes(deal_id);
CREATE INDEX idx_meeting_prep_notes_company ON meeting_prep_notes(company_id);


-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE collateral ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep_notes ENABLE ROW LEVEL SECURITY;

-- Collateral: team visibility (all authenticated users can see team collateral)
CREATE POLICY "Users can view team collateral" ON collateral
  FOR SELECT USING (visibility = 'team' AND archived_at IS NULL);

CREATE POLICY "Users can insert collateral" ON collateral
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own collateral" ON collateral
  FOR UPDATE USING (auth.uid() = created_by);

-- Collateral usage: users see their own
CREATE POLICY "Users can view own usage" ON collateral_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert usage" ON collateral_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Software links: all users can view active
CREATE POLICY "Users can view active software links" ON software_links
  FOR SELECT USING (is_active = true);

-- Meeting prep notes: users see their own
CREATE POLICY "Users can manage own prep notes" ON meeting_prep_notes
  FOR ALL USING (auth.uid() = user_id);
```

---

# NEW: Collateral Matching Logic

## File: `src/lib/collateral/matching.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

interface MatchingContext {
  meetingType: string;
  products: string[];
  industry?: string;
  companySize?: string;
}

interface ScoredCollateral {
  id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  external_url: string | null;
  file_type: string;
  document_type: string;
  relevanceScore: number;
}

/**
 * Get collateral matching the meeting context, ranked by relevance
 */
export async function getMatchingCollateral(
  context: MatchingContext
): Promise<ScoredCollateral[]> {
  const supabase = createAdminClient();
  
  const { data } = await supabase
    .from('collateral')
    .select('*')
    .eq('is_current', true)
    .is('archived_at', null);
  
  if (!data || data.length === 0) return [];
  
  // Score each item by relevance
  const scored = data.map(item => {
    let score = 0;
    
    // Meeting type match (+10)
    if (item.meeting_types?.includes(context.meetingType)) {
      score += 10;
    }
    
    // Product match (+5 each)
    const productMatches = context.products.filter(p => 
      item.products?.includes(p) || item.products?.includes('platform')
    ).length;
    score += productMatches * 5;
    
    // Industry match (+3)
    if (context.industry && 
        (item.industries?.includes(context.industry) || 
         item.industries?.includes('general'))) {
      score += 3;
    }
    
    // Company size match (+2)
    if (context.companySize && 
        (item.company_sizes?.includes(context.companySize) || 
         item.company_sizes?.length === 0)) {
      score += 2;
    }
    
    // Boost frequently used items slightly
    if (item.view_count > 10) score += 1;
    
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      file_path: item.file_path,
      external_url: item.external_url,
      file_type: item.file_type,
      document_type: item.document_type,
      relevanceScore: score,
    };
  });
  
  // Return items with score > 0, sorted by relevance
  return scored
    .filter(item => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);
}
```

---

# NEW: Meeting Type Inference

## File: `src/lib/collateral/inferMeetingType.ts`

```typescript
/**
 * Infer meeting type from title and deal stage
 * Used to match appropriate collateral
 */
export function inferMeetingType(
  title: string,
  dealStage?: string | null
): string {
  const titleLower = title.toLowerCase();
  
  // Check title keywords first
  const titleMappings: [string[], string][] = [
    [['discovery', 'intro', 'introduction', 'learn more'], 'discovery'],
    [['demo', 'demonstration', 'show', 'walkthrough'], 'demo'],
    [['technical', 'integration', 'api', 'it review'], 'technical_deep_dive'],
    [['proposal', 'pricing', 'quote', 'investment'], 'proposal'],
    [['kickoff', 'onboarding', 'implementation', 'setup'], 'trial_kickoff'],
    [['check-in', 'check in', 'review', 'status'], 'check_in'],
    [['executive', 'leadership', 'c-level', 'ceo', 'coo'], 'executive'],
  ];
  
  for (const [keywords, meetingType] of titleMappings) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      return meetingType;
    }
  }
  
  // Fall back to deal stage
  if (dealStage) {
    const stageMappings: Record<string, string> = {
      'new_lead': 'discovery',
      'qualifying': 'discovery',
      'discovery': 'discovery',
      'demo': 'demo',
      'data_review': 'demo',
      'trial': 'check_in',
      'negotiation': 'proposal',
      'closed_won': 'implementation',
    };
    return stageMappings[dealStage] || 'discovery';
  }
  
  return 'discovery';
}
```

---

# NEW: Enhanced Prep Data Builder

## File: `src/lib/meetingPrep/buildEnhancedPrep.ts`

```typescript
import { generateContextAwareMeetingPrep, hasRichContext } from '@/lib/intelligence/generateMeetingPrep';
import { generateCompleteMeetingPrep } from '@/lib/commandCenter/meetingPrep';
import { getMatchingCollateral } from '@/lib/collateral/matching';
import { inferMeetingType } from '@/lib/collateral/inferMeetingType';
import { createAdminClient } from '@/lib/supabase/admin';

interface EnhancedMeetingPrep {
  meeting: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    joinUrl?: string;
    meetingType: string;
  };
  attendees: any[];  // From existing enrichAttendees
  deal: {
    id: string;
    name: string;
    stage: string;
    value: number | null;
    health_score: number | null;
    products: { voice: boolean; platform: boolean };
    competitor?: string;
  } | null;
  company: {
    id: string;
    name: string;
    industry: string | null;
    segment: string | null;
  } | null;
  aiPrep: {
    objective: string;
    talking_points: string[];
    landmines: string[];
    questions_to_ask: string[];
  };
  collateral: any[];  // Matched collateral
  softwareLinks: any[];  // Contextual links
  pastContext: any[];  // From existing gatherPrepMaterials
  notes: {
    prep_notes: string | null;
    meeting_notes: string | null;
  } | null;
}

export async function buildEnhancedMeetingPrep(
  userId: string,
  meetingId: string,
  meetingData: {
    title: string;
    startTime: string;
    endTime: string;
    attendeeEmails: string[];
    joinUrl?: string;
    dealId?: string | null;
    companyId?: string | null;
  }
): Promise<EnhancedMeetingPrep> {
  const supabase = createAdminClient();
  
  // 1. Get deal and company context
  let deal = null;
  let company = null;
  
  if (meetingData.dealId) {
    const { data } = await supabase
      .from('deals')
      .select('id, name, stage, estimated_value, health_score, products, competitor_mentioned, organization_id')
      .eq('id', meetingData.dealId)
      .single();
    
    if (data) {
      deal = {
        id: data.id,
        name: data.name,
        stage: data.stage,
        value: data.estimated_value,
        health_score: data.health_score,
        products: data.products || { voice: false, platform: false },
        competitor: data.competitor_mentioned,
      };
      
      // Get company from deal if not provided
      if (!meetingData.companyId && data.organization_id) {
        meetingData.companyId = data.organization_id;
      }
    }
  }
  
  if (meetingData.companyId) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, industry, segment')
      .eq('id', meetingData.companyId)
      .single();
    
    if (data) {
      company = data;
    }
  }
  
  // 2. Infer meeting type
  const meetingType = inferMeetingType(meetingData.title, deal?.stage);
  
  // 3. Use EXISTING prep generation
  // Try rich context first, fall back to basic
  let aiPrep;
  const hasRich = await hasRichContext(meetingData.attendeeEmails);
  
  if (hasRich) {
    const richPrep = await generateContextAwareMeetingPrep({
      id: meetingId,
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      duration_minutes: 30,
      attendeeEmails: meetingData.attendeeEmails,
      dealId: meetingData.dealId,
      companyId: meetingData.companyId,
    });
    aiPrep = richPrep.prep;
  } else {
    const basicPrep = await generateCompleteMeetingPrep(userId, {
      id: meetingId,
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      attendeeEmails: meetingData.attendeeEmails,
      dealId: meetingData.dealId,
      companyId: meetingData.companyId,
    });
    aiPrep = basicPrep.prep;
  }
  
  // 4. Get matching collateral (NEW)
  const products: string[] = [];
  if (deal?.products?.voice) products.push('voice_agent');
  if (deal?.products?.platform) products.push('performance_center', 'action_hub');
  
  const collateral = await getMatchingCollateral({
    meetingType,
    products,
    industry: company?.industry || undefined,
    companySize: company?.segment || undefined,
  });
  
  // 5. Get software links (NEW)
  const { data: softwareLinks } = await supabase
    .from('software_links')
    .select('*')
    .eq('is_active', true)
    .or(`show_for_meeting_types.cs.{${meetingType}},show_for_meeting_types.eq.{}`)
    .order('sort_order');
  
  // 6. Get existing prep notes (NEW)
  const { data: existingNotes } = await supabase
    .from('meeting_prep_notes')
    .select('prep_notes, meeting_notes')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .single();
  
  // 7. Get past context using EXISTING function pattern
  const pastContext: any[] = [];
  
  if (deal) {
    pastContext.push({
      type: 'deal',
      label: `Deal: ${deal.name}`,
      url: `/deals/${deal.id}`,
    });
  }
  
  if (company) {
    pastContext.push({
      type: 'intelligence',
      label: `${company.name} Intelligence`,
      url: `/companies/${company.id}/intelligence`,
    });
  }
  
  // Recent transcripts
  if (meetingData.companyId) {
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date')
      .eq('company_id', meetingData.companyId)
      .order('meeting_date', { ascending: false })
      .limit(3);
    
    transcripts?.forEach(tx => {
      const date = new Date(tx.meeting_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      pastContext.push({
        type: 'transcript',
        label: `${date}: ${tx.title}`,
        url: `/meetings/transcriptions/${tx.id}`,
      });
    });
  }
  
  return {
    meeting: {
      id: meetingId,
      title: meetingData.title,
      startTime: meetingData.startTime,
      endTime: meetingData.endTime,
      joinUrl: meetingData.joinUrl,
      meetingType,
    },
    attendees: [], // Populated by existing enrichAttendees in API
    deal,
    company,
    aiPrep: {
      objective: aiPrep.objective || '',
      talking_points: aiPrep.talking_points || [],
      landmines: aiPrep.landmines || [],
      questions_to_ask: aiPrep.questions_to_ask || [],
    },
    collateral,
    softwareLinks: softwareLinks || [],
    pastContext,
    notes: existingNotes || null,
  };
}
```

---

# Component Structure

```
src/
├── app/
│   ├── meetings/
│   │   └── [meetingId]/
│   │       └── prep/
│   │           └── page.tsx              # NEW: Full prep page
│   ├── collateral/
│   │   └── page.tsx                      # NEW: Collateral library
│   └── api/
│       ├── collateral/
│       │   ├── route.ts                  # List/create collateral
│       │   ├── [id]/
│       │   │   ├── route.ts              # Get/update/delete
│       │   │   └── track/route.ts        # Track usage
│       │   └── upload/route.ts           # File upload
│       ├── meetings/
│       │   └── [meetingId]/
│       │       └── prep/
│       │           ├── route.ts          # Get enhanced prep
│       │           └── notes/route.ts    # Save notes
│       └── settings/
│           └── software-links/route.ts   # Manage links
│
├── components/
│   ├── collateral/
│   │   ├── CollateralLibrary.tsx         # Main grid view
│   │   ├── CollateralCard.tsx            # Individual item
│   │   ├── CollateralUploadModal.tsx     # Upload/edit form
│   │   └── CollateralFilters.tsx         # Filter controls
│   │
│   └── meetingPrep/
│       ├── MeetingPrepPage.tsx           # Full page layout
│       ├── PrepHeader.tsx                # Meeting title, time, join button
│       ├── AttendeesList.tsx             # Uses existing MeetingAttendee type
│       ├── DealContext.tsx               # Deal summary card
│       ├── AIPrepSection.tsx             # Objective, talking points, etc.
│       ├── CollateralGrid.tsx            # Matched collateral cards
│       ├── SoftwareLinks.tsx             # Quick access buttons
│       ├── PastContextLinks.tsx          # Links to related records
│       └── PrepNotesEditor.tsx           # Auto-save textarea
│
└── lib/
    ├── collateral/
    │   ├── matching.ts                   # Relevance scoring
    │   ├── inferMeetingType.ts           # Type inference
    │   └── storage.ts                    # Supabase storage helpers
    │
    └── meetingPrep/
        └── buildEnhancedPrep.ts          # Orchestrates everything
```

---

# API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/collateral` | GET | List collateral with filters |
| `/api/collateral` | POST | Create new collateral |
| `/api/collateral/upload` | POST | Upload file to storage |
| `/api/collateral/[id]` | GET | Get single item |
| `/api/collateral/[id]` | PATCH | Update metadata |
| `/api/collateral/[id]` | DELETE | Archive (soft delete) |
| `/api/collateral/[id]/track` | POST | Track view/download/share |
| `/api/meetings/[id]/prep` | GET | Get full enhanced prep |
| `/api/meetings/[id]/prep/notes` | POST | Save prep notes |
| `/api/settings/software-links` | GET/POST | Manage software links |
