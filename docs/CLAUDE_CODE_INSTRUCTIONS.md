# Process-Aware AI Implementation Guide

## Overview

This document guides the implementation of process-aware AI features for X-FORCE CRM. The goal is to make all AI features (transcript analysis, meeting prep, follow-up emails) context-aware based on process type (sales, onboarding, engagement, support).

**Reference Document:** `/mnt/user-data/uploads/process-aware-ai-handoff.md`

**Key Principle:** Read the handoff document first, then follow these phased instructions with QC gates.

---

## Pre-Implementation Setup

### Step 0: Environment Verification

```bash
# Verify MCP servers are available
# Use Postgres MCP to test database connection
# Use Playwright MCP to verify app is running
```

**Actions:**
1. Read the handoff document: `cat /mnt/user-data/uploads/process-aware-ai-handoff.md`
2. Query current database schema to understand existing tables:
   - `users` table structure
   - `ai_prompts` table structure  
   - `command_center_items` table structure
   - `activities` table structure
3. Verify the app is running and accessible via Playwright
4. Take a baseline screenshot of the Settings → People page

**QC Gate 0:**
- [ ] Handoff document read and understood
- [ ] Database schema documented
- [ ] App accessible via Playwright
- [ ] Baseline screenshot captured

---

## Phase 1: Database Schema Updates

### 1.1 Add `default_process_type` to Users Table

**File:** Database migration via Supabase

```sql
-- Add default_process_type to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS default_process_type TEXT 
DEFAULT 'sales'
CHECK (default_process_type IN ('sales', 'onboarding', 'engagement', 'support'));

COMMENT ON COLUMN users.default_process_type IS 
'Default process context for AI features. Onboarding specialists set to onboarding, etc.';
```

**Verification Query:**
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'default_process_type';
```

### 1.2 Add Command Center Item Types

**Database:** Add new action types for onboarding

```sql
-- First, check what action_type values currently exist
SELECT DISTINCT action_type FROM command_center_items;

-- Add new action types (if using enum, alter it; if text, just document)
-- New types: implementation_blocker, training_gap, go_live_risk, customer_action_needed, adoption_concern
```

**File:** `src/types/commandCenter.ts`

Find the existing action type definition and add:
```typescript
// Add to existing ActionType union or enum:
| 'implementation_blocker'
| 'training_gap'
| 'go_live_risk'
| 'customer_action_needed'
| 'adoption_concern'
```

### 1.3 Add Onboarding Analysis Types

**File:** Create `src/types/onboardingAnalysis.ts`

```typescript
/**
 * Onboarding Transcript Analysis Types
 * Process-specific analysis output for onboarding meetings
 */

import { Commitment, ActionItem, Sentiment } from './transcriptAnalysis'; // Reuse existing types

export interface OnboardingBlocker {
  blocker: string;
  severity: 'critical' | 'moderate' | 'minor';
  owner: 'us' | 'customer' | 'third_party';
  resolution_path: string;
}

export interface TrainingGap {
  area: string;
  users_affected: string;
  suggested_remedy: string;
}

export interface GoLiveChecklistItem {
  item: string;
  status: 'complete' | 'in_progress' | 'not_started' | 'blocked';
  owner: 'us' | 'customer';
  due_date?: string;
}

export interface AdoptionIndicator {
  signal: string;
  sentiment: 'positive' | 'concerning';
  quote?: string;
}

export interface OnboardingRisk {
  risk: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

export interface StakeholderSentiment {
  name: string;
  role: string;
  sentiment: 'champion' | 'engaged' | 'neutral' | 'frustrated' | 'blocker';
  notes: string;
}

export interface OnboardingTranscriptAnalysis {
  summary: string;
  
  // Implementation health
  blockers: OnboardingBlocker[];
  
  // Training effectiveness
  training_gaps: TrainingGap[];
  
  // Go-live readiness
  go_live_checklist: GoLiveChecklistItem[];
  
  // Shared with sales
  ourCommitments: Commitment[];
  theirCommitments: Commitment[];
  actionItems: ActionItem[];
  
  // Adoption signals
  adoption_indicators: AdoptionIndicator[];
  
  // Risks
  risks: OnboardingRisk[];
  
  // Stakeholder updates
  stakeholder_sentiment: StakeholderSentiment[];
  
  // Timeline
  go_live_date?: string;
  go_live_confidence: 'on_track' | 'at_risk' | 'delayed';
  
  sentiment: Sentiment;
}
```

**QC Gate 1:**
- [ ] Run migration and verify column exists via Postgres MCP
- [ ] Query shows `default_process_type` with correct default
- [ ] TypeScript types compile without errors (`npm run type-check` or `tsc --noEmit`)
- [ ] No existing functionality broken (run `npm run build`)

---

## Phase 2: Prompt Manager Enhancement

### 2.1 Add `getPromptWithFallback` Function

**File:** `src/lib/ai/promptManager.ts`

Add this new function after `getPromptWithVariables`:

```typescript
/**
 * Get prompt with process-type suffix, falling back to base prompt if not found
 * 
 * Example: getPromptWithFallback('transcript_analysis', 'onboarding', variables)
 * - First tries: 'transcript_analysis__onboarding'
 * - Falls back to: 'transcript_analysis'
 * 
 * @param baseKey - Base prompt key (e.g., 'transcript_analysis')
 * @param suffix - Process type suffix (e.g., 'onboarding')
 * @param variables - Variables to substitute in the prompt
 */
export async function getPromptWithFallback(
  baseKey: string,
  suffix: string | null,
  variables: Record<string, string> = {}
): Promise<{
  prompt: string;
  schema: string | null;
  model: string;
  maxTokens: number;
  usedKey: string;
} | null> {
  // Try process-specific prompt first
  if (suffix) {
    const specificKey = `${baseKey}__${suffix}`;
    const specificPrompt = await getPromptWithVariables(specificKey, variables);
    if (specificPrompt) {
      return {
        ...specificPrompt,
        usedKey: specificKey,
      };
    }
    console.log(`[PromptManager] No prompt found for "${specificKey}", falling back to "${baseKey}"`);
  }

  // Fall back to base prompt
  const basePrompt = await getPromptWithVariables(baseKey, variables);
  if (basePrompt) {
    return {
      ...basePrompt,
      usedKey: baseKey,
    };
  }

  console.error(`[PromptManager] No prompt found for base key "${baseKey}"`);
  return null;
}
```

### 2.2 Create Process Context Utility

**File:** Create `src/lib/process/getProcessContext.ts`

```typescript
/**
 * Process Context Detection
 * 
 * Determines the appropriate process type for AI features based on:
 * 1. Explicit meeting/activity metadata override
 * 2. Company's current process type (from company_product_read_model)
 * 3. User's default process type
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type ProcessType = 'sales' | 'onboarding' | 'engagement' | 'support';

interface ProcessContextParams {
  userId: string;
  companyId?: string | null;
  meetingMetadata?: { process_type?: string } | null;
}

/**
 * Get the appropriate process type for a given context
 * Priority: metadata override > company process type > user default
 */
export async function getProcessTypeForContext(
  params: ProcessContextParams
): Promise<ProcessType> {
  const { userId, companyId, meetingMetadata } = params;

  // 1. Check meeting metadata override (highest priority)
  if (meetingMetadata?.process_type) {
    const override = meetingMetadata.process_type as ProcessType;
    if (isValidProcessType(override)) {
      console.log(`[ProcessContext] Using metadata override: ${override}`);
      return override;
    }
  }

  // 2. Check company's current process type
  if (companyId) {
    const companyProcessType = await getCompanyProcessType(companyId);
    if (companyProcessType) {
      console.log(`[ProcessContext] Using company process type: ${companyProcessType}`);
      return companyProcessType;
    }
  }

  // 3. Fall back to user default
  const userDefault = await getUserDefaultProcessType(userId);
  console.log(`[ProcessContext] Using user default: ${userDefault}`);
  return userDefault;
}

/**
 * Get company's current process type from projection
 */
async function getCompanyProcessType(companyId: string): Promise<ProcessType | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('company_product_read_model')
    .select('current_process_type')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.current_process_type && isValidProcessType(data.current_process_type)) {
    return data.current_process_type as ProcessType;
  }

  return null;
}

/**
 * Get user's default process type
 */
async function getUserDefaultProcessType(userId: string): Promise<ProcessType> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('users')
    .select('default_process_type')
    .eq('id', userId)
    .single();

  if (data?.default_process_type && isValidProcessType(data.default_process_type)) {
    return data.default_process_type as ProcessType;
  }

  // Ultimate fallback
  return 'sales';
}

/**
 * Validate process type string
 */
function isValidProcessType(value: string): value is ProcessType {
  return ['sales', 'onboarding', 'engagement', 'support'].includes(value);
}

/**
 * Get display label for process type
 */
export function getProcessTypeLabel(type: ProcessType): string {
  const labels: Record<ProcessType, string> = {
    sales: 'Sales',
    onboarding: 'Onboarding',
    engagement: 'Customer Success',
    support: 'Support',
  };
  return labels[type];
}
```

**QC Gate 2:**
- [ ] `getPromptWithFallback` function added and exports correctly
- [ ] `getProcessContext.ts` created with proper types
- [ ] Both files compile without TypeScript errors
- [ ] Write a quick test: call `getPromptWithFallback('nonexistent', 'sales', {})` - should return null gracefully

---

## Phase 3: Settings UI Update

### 3.1 Update SettingsTabs Component

**File:** `src/components/settings/SettingsTabs.tsx`

Find the Profile section in the People tab and add the process type dropdown.

**Locate this section** (search for "Email Signature" or the grid with Name, Email, Role, Team):

Add a new field in the profile grid or create a new section:

```typescript
// Add to state at component top (near title/phone state)
const [defaultProcessType, setDefaultProcessType] = useState(profile?.default_process_type || 'sales');

// Add to handleSaveProfile function - update the .update() call:
const { error } = await supabase
  .from('users')
  .update({ title, phone, default_process_type: defaultProcessType })
  .eq('id', profile.id);

// Add this JSX in the profile section, after the existing grid items:
<div className="pt-6 border-t border-gray-200">
  <h3 className="text-sm font-medium text-gray-900 mb-4">AI Settings</h3>
  <p className="text-xs text-gray-500 mb-4">
    Set your default process context for AI-powered features like transcript analysis and meeting prep.
  </p>
  <div className="max-w-xs">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Default Process Type
    </label>
    <select
      value={defaultProcessType}
      onChange={(e) => setDefaultProcessType(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="sales">Sales</option>
      <option value="onboarding">Onboarding</option>
      <option value="engagement">Customer Success</option>
      <option value="support">Support</option>
    </select>
    <p className="mt-1 text-xs text-gray-500">
      This determines what the AI looks for in your meetings (e.g., buying signals vs implementation blockers).
    </p>
  </div>
</div>
```

### 3.2 Update UserProfile Type

**File:** `src/components/settings/SettingsTabs.tsx` (or wherever UserProfile is defined)

Add to the UserProfile interface:
```typescript
interface UserProfile {
  // ... existing fields
  default_process_type?: string;
}
```

**QC Gate 3:**
- [ ] Use Playwright to navigate to Settings page
- [ ] Take screenshot showing the new dropdown in Profile section
- [ ] Change the dropdown value and click Save
- [ ] Query database to verify the value was saved correctly:
  ```sql
  SELECT id, name, default_process_type FROM users WHERE email = 'test@example.com';
  ```
- [ ] Refresh page and verify dropdown shows saved value

---

## Phase 4: Add Onboarding Prompts to Database

### 4.1 Create Onboarding Transcript Analysis Prompt

**Database:** Insert into `ai_prompts` table

```sql
INSERT INTO ai_prompts (
  key,
  name,
  description,
  prompt_template,
  schema_template,
  default_prompt_template,
  default_schema_template,
  is_active,
  version,
  model,
  max_tokens,
  category,
  purpose,
  variables
) VALUES (
  'transcript_analysis__onboarding',
  'Transcript Analysis - Onboarding',
  'Analyzes meeting transcripts for onboarding-specific insights: blockers, training gaps, go-live risks, and adoption signals.',
  E'You are an expert customer onboarding analyst. Analyze this meeting transcript and extract actionable intelligence for successful implementation.

## Meeting Information
- Title: {{title}}
- Date: {{meetingDate}}
- Attendees: {{attendees}}
{{contextSection}}

## Transcription
{{transcription}}

---

Analyze this onboarding meeting and provide a comprehensive JSON response. Focus on:
1. Implementation blockers and their severity
2. Training gaps identified
3. Go-live checklist status
4. Customer and team commitments
5. Adoption indicators (positive and concerning)
6. Risks to successful implementation
7. Stakeholder sentiment
8. Timeline confidence

Be specific and actionable. Extract exact quotes where relevant.',
  E'{
  "type": "object",
  "properties": {
    "summary": { "type": "string", "description": "2-3 sentence summary of the meeting" },
    "blockers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "blocker": { "type": "string" },
          "severity": { "type": "string", "enum": ["critical", "moderate", "minor"] },
          "owner": { "type": "string", "enum": ["us", "customer", "third_party"] },
          "resolution_path": { "type": "string" }
        },
        "required": ["blocker", "severity", "owner", "resolution_path"]
      }
    },
    "training_gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "area": { "type": "string" },
          "users_affected": { "type": "string" },
          "suggested_remedy": { "type": "string" }
        },
        "required": ["area", "users_affected", "suggested_remedy"]
      }
    },
    "go_live_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "status": { "type": "string", "enum": ["complete", "in_progress", "not_started", "blocked"] },
          "owner": { "type": "string", "enum": ["us", "customer"] },
          "due_date": { "type": "string" }
        },
        "required": ["item", "status", "owner"]
      }
    },
    "ourCommitments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "commitment": { "type": "string" },
          "due_date": { "type": "string" },
          "owner": { "type": "string" }
        },
        "required": ["commitment"]
      }
    },
    "theirCommitments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "commitment": { "type": "string" },
          "due_date": { "type": "string" },
          "owner": { "type": "string" }
        },
        "required": ["commitment"]
      }
    },
    "actionItems": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "owner": { "type": "string" },
          "due_date": { "type": "string" },
          "priority": { "type": "string", "enum": ["high", "medium", "low"] }
        },
        "required": ["description"]
      }
    },
    "adoption_indicators": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "signal": { "type": "string" },
          "sentiment": { "type": "string", "enum": ["positive", "concerning"] },
          "quote": { "type": "string" }
        },
        "required": ["signal", "sentiment"]
      }
    },
    "risks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "risk": { "type": "string" },
          "likelihood": { "type": "string", "enum": ["high", "medium", "low"] },
          "impact": { "type": "string", "enum": ["high", "medium", "low"] },
          "mitigation": { "type": "string" }
        },
        "required": ["risk", "likelihood", "impact"]
      }
    },
    "stakeholder_sentiment": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "role": { "type": "string" },
          "sentiment": { "type": "string", "enum": ["champion", "engaged", "neutral", "frustrated", "blocker"] },
          "notes": { "type": "string" }
        },
        "required": ["name", "role", "sentiment", "notes"]
      }
    },
    "go_live_date": { "type": "string" },
    "go_live_confidence": { "type": "string", "enum": ["on_track", "at_risk", "delayed"] },
    "sentiment": { "type": "string", "enum": ["positive", "neutral", "negative"] }
  },
  "required": ["summary", "blockers", "training_gaps", "go_live_checklist", "ourCommitments", "theirCommitments", "actionItems", "adoption_indicators", "risks", "stakeholder_sentiment", "go_live_confidence", "sentiment"]
}',
  -- default_prompt_template (same as prompt_template for new prompts)
  E'You are an expert customer onboarding analyst...',
  -- default_schema_template (same as schema_template)
  E'{...}',
  true, -- is_active
  1,    -- version
  'claude-sonnet-4-20250514',
  4096,
  'transcript_analysis',
  'Process-aware transcript analysis for onboarding meetings',
  ARRAY['title', 'meetingDate', 'attendees', 'contextSection', 'transcription']
);
```

### 4.2 Create Onboarding Meeting Prep Prompt

```sql
INSERT INTO ai_prompts (
  key,
  name,
  description,
  prompt_template,
  schema_template,
  default_prompt_template,
  default_schema_template,
  is_active,
  version,
  model,
  max_tokens,
  category,
  purpose,
  variables
) VALUES (
  'meeting_prep__onboarding',
  'Meeting Prep - Onboarding',
  'Generates meeting preparation for onboarding meetings: implementation status, training agenda, blocker review.',
  E'Generate meeting prep for an onboarding/implementation meeting:

MEETING: {{title}}
DATE/TIME: {{meetingTime}}

ATTENDEES:
{{attendeeList}}

{{relationshipContext}}

---

Generate prep focused on:
1. Implementation status check - what milestones to review
2. Training agenda - what topics need coverage
3. Blocker review - known issues to address
4. Go-live readiness - timeline and risks to discuss
5. Questions to ask - discovery about adoption and satisfaction

Be specific to onboarding context, not sales.',
  E'{
  "type": "object",
  "properties": {
    "objective": { "type": "string" },
    "implementation_status_items": { "type": "array", "items": { "type": "string" } },
    "training_agenda": { "type": "array", "items": { "type": "string" } },
    "blockers_to_review": { "type": "array", "items": { "type": "string" } },
    "go_live_discussion_points": { "type": "array", "items": { "type": "string" } },
    "questions_to_ask": { "type": "array", "items": { "type": "string" } },
    "landmines": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["objective", "implementation_status_items", "training_agenda", "blockers_to_review", "go_live_discussion_points", "questions_to_ask"]
}',
  E'Generate meeting prep for an onboarding/implementation meeting...',
  E'{...}',
  true,
  1,
  'claude-sonnet-4-20250514',
  1024,
  'meeting_prep',
  'Process-aware meeting prep for onboarding meetings',
  ARRAY['title', 'meetingTime', 'attendeeList', 'relationshipContext']
);
```

**QC Gate 4:**
- [ ] Query to verify prompts were inserted:
  ```sql
  SELECT key, name, is_active FROM ai_prompts WHERE key LIKE '%onboarding%';
  ```
- [ ] Navigate to `/settings/ai-prompts` via Playwright and screenshot the new prompts
- [ ] Verify prompts appear in the UI and can be viewed/edited

---

## Phase 5: Update Transcript Analysis Pipeline

### 5.1 Update processTranscriptAnalysis.ts

**File:** `src/lib/pipelines/processTranscriptAnalysis.ts`

Add process-aware prompt selection. Find where the analysis is triggered and add:

```typescript
import { getProcessTypeForContext } from '@/lib/process/getProcessContext';
import { getPromptWithFallback } from '@/lib/ai/promptManager';

// In the function that processes transcripts, before calling AI:
async function analyzeTranscript(transcript: Transcript): Promise<TranscriptAnalysis | OnboardingTranscriptAnalysis> {
  // Detect process type
  const processType = await getProcessTypeForContext({
    userId: transcript.user_id,
    companyId: transcript.company_id,
    meetingMetadata: transcript.metadata,
  });

  console.log(`[TranscriptAnalysis] Using process type: ${processType} for transcript ${transcript.id}`);

  // Get appropriate prompt
  const promptData = await getPromptWithFallback(
    'transcript_analysis',
    processType,
    {
      title: transcript.title || 'Meeting',
      meetingDate: new Date(transcript.meeting_date).toLocaleDateString(),
      attendees: transcript.attendees?.join(', ') || 'Unknown',
      contextSection: '', // Build from deal/company context
      transcription: transcript.content || transcript.transcript_text || '',
    }
  );

  if (!promptData) {
    throw new Error('No transcript analysis prompt found');
  }

  console.log(`[TranscriptAnalysis] Using prompt: ${promptData.usedKey}`);

  // Call AI with the prompt
  const { data: analysis } = await callAIJson({
    prompt: promptData.prompt,
    schema: promptData.schema || undefined,
    model: promptData.model,
    maxTokens: promptData.maxTokens,
  });

  return analysis;
}
```

### 5.2 Update Command Center Item Creation

**File:** `src/lib/pipelines/processTranscriptAnalysis.ts`

Add logic to create process-appropriate CC items:

```typescript
/**
 * Create Command Center items based on process type
 */
async function createProcessAwareItems(
  transcript: Transcript,
  analysis: TranscriptAnalysis | OnboardingTranscriptAnalysis,
  processType: ProcessType
): Promise<{ created: number }> {
  let created = 0;

  if (processType === 'onboarding') {
    const onboardingAnalysis = analysis as OnboardingTranscriptAnalysis;
    
    // Create items for critical blockers
    for (const blocker of onboardingAnalysis.blockers || []) {
      if (blocker.severity === 'critical') {
        await createCommandCenterItem({
          user_id: transcript.user_id,
          company_id: transcript.company_id,
          action_type: 'implementation_blocker',
          title: `Critical Blocker: ${blocker.blocker}`,
          description: `Owner: ${blocker.owner}. Resolution: ${blocker.resolution_path}`,
          priority: 'high',
          source: 'transcript_analysis',
          source_id: transcript.id,
        });
        created++;
      }
    }

    // Create items for training gaps
    for (const gap of onboardingAnalysis.training_gaps || []) {
      await createCommandCenterItem({
        user_id: transcript.user_id,
        company_id: transcript.company_id,
        action_type: 'training_gap',
        title: `Training Gap: ${gap.area}`,
        description: `Affects: ${gap.users_affected}. Remedy: ${gap.suggested_remedy}`,
        priority: 'medium',
        source: 'transcript_analysis',
        source_id: transcript.id,
      });
      created++;
    }

    // Create items for concerning adoption signals
    for (const indicator of onboardingAnalysis.adoption_indicators || []) {
      if (indicator.sentiment === 'concerning') {
        await createCommandCenterItem({
          user_id: transcript.user_id,
          company_id: transcript.company_id,
          action_type: 'adoption_concern',
          title: `Adoption Concern: ${indicator.signal}`,
          description: indicator.quote || indicator.signal,
          priority: 'medium',
          source: 'transcript_analysis',
          source_id: transcript.id,
        });
        created++;
      }
    }

    // Create items for high-likelihood/high-impact risks
    for (const risk of onboardingAnalysis.risks || []) {
      if (risk.likelihood === 'high' || risk.impact === 'high') {
        await createCommandCenterItem({
          user_id: transcript.user_id,
          company_id: transcript.company_id,
          action_type: 'go_live_risk',
          title: `Risk: ${risk.risk}`,
          description: `Likelihood: ${risk.likelihood}, Impact: ${risk.impact}. Mitigation: ${risk.mitigation || 'None specified'}`,
          priority: risk.likelihood === 'high' && risk.impact === 'high' ? 'high' : 'medium',
          source: 'transcript_analysis',
          source_id: transcript.id,
        });
        created++;
      }
    }

  } else {
    // Existing sales-focused item creation
    // ... keep existing processBuyingSignals and processCommitments logic
  }

  return { created };
}
```

**QC Gate 5:**
- [ ] Code compiles without errors
- [ ] Trace through the code path manually to verify logic
- [ ] Create a test user with `default_process_type = 'onboarding'`
- [ ] If you have test transcript data, process it and verify:
  - Correct prompt is selected (check logs)
  - Analysis output matches expected schema
  - CC items have correct action_type values

---

## Phase 6: Update Meeting Prep Service

### 6.1 Update meetingPrep.ts

**File:** `src/lib/commandCenter/meetingPrep.ts`

Update `generateMeetingPrep` to be process-aware:

```typescript
import { getProcessTypeForContext, ProcessType } from '@/lib/process/getProcessContext';
import { getPromptWithFallback } from '@/lib/ai/promptManager';

export async function generateMeetingPrep(
  title: string,
  attendees: MeetingAttendee[],
  deal?: { name: string; stage: string; value?: number; health_score?: number },
  recentContext?: string[],
  options?: {
    userId?: string;
    companyId?: string;
    meetingMetadata?: { process_type?: string };
  }
): Promise<MeetingPrepContent> {
  
  // Determine process type
  let processType: ProcessType = 'sales';
  if (options?.userId) {
    processType = await getProcessTypeForContext({
      userId: options.userId,
      companyId: options.companyId,
      meetingMetadata: options.meetingMetadata,
    });
  }

  console.log(`[MeetingPrep] Generating prep with process type: ${processType}`);

  // Build attendee list for prompt
  const attendeeList = attendees
    .map(a => `- ${a.name}${a.title ? ` (${a.title})` : ''}${a.role !== 'unknown' ? ` - ${a.role}` : ''}`)
    .join('\n');

  // Build relationship context
  const relationshipContext = recentContext?.length
    ? `RECENT CONTEXT:\n${recentContext.join('\n')}`
    : '';

  // Get process-appropriate prompt
  const promptData = await getPromptWithFallback(
    'meeting_prep',
    processType,
    {
      title,
      meetingTime: new Date().toLocaleString(), // Would come from actual meeting
      attendeeList,
      relationshipContext,
    }
  );

  if (!promptData) {
    // Fallback to hardcoded prompt
    console.warn('[MeetingPrep] No prompt found, using fallback');
    return generateFallbackPrep(title, attendees, deal, recentContext);
  }

  try {
    const result = await callAIJson<MeetingPrepContent>({
      prompt: promptData.prompt,
      schema: promptData.schema || undefined,
      maxTokens: promptData.maxTokens,
      model: promptData.model,
    });

    return result.data;
  } catch (error) {
    console.error('[MeetingPrep] AI generation failed:', error);
    return generateFallbackPrep(title, attendees, deal, recentContext);
  }
}

// Keep existing generateFallbackPrep function or inline the fallback logic
```

### 6.2 Update generateMeetingPrep.ts (Intelligence folder)

**File:** `src/lib/intelligence/generateMeetingPrep.ts`

Apply same pattern - add process type detection before prompt selection.

**QC Gate 6:**
- [ ] Meeting prep function updated with process awareness
- [ ] API endpoint `/api/calendar/[meetingId]/prep` still works
- [ ] Test with a user set to 'onboarding' and verify different prep content is generated
- [ ] Use Playwright to navigate to a meeting and view prep (if UI exists)

---

## Phase 7: Wire Up Existing AI Prompts

The handoff document mentions 14 prompts that exist but aren't wired to backend code. Let's connect them.

### 7.1 Audit Existing Prompts

```sql
-- Find all prompts and their usage status
SELECT 
  key, 
  name, 
  category,
  is_active,
  created_at
FROM ai_prompts 
ORDER BY category, name;
```

### 7.2 Prompts to Wire Up

Based on the handoff, these prompts exist but need backend connections:

| Prompt Key | Backend Location | Action |
|------------|------------------|--------|
| `classify_email_intent` | `src/lib/inbox/aiAnalysis.ts` | Add call to this prompt |
| `identify_thread_context` | `src/lib/inbox/aiAnalysis.ts` | Add call to this prompt |
| `suggest_replies` | `src/lib/inbox/aiAnalysis.ts` | Add call to this prompt |
| `match_entity_prompt` | `src/lib/intelligence/entityMatcher.ts` | Add call to this prompt |
| `detect_objections` | `src/lib/ai/transcript-analyzer.ts` | Add call to this prompt |
| `objection_response_suggestion` | `src/lib/ai/transcript-analyzer.ts` | Add call to this prompt |
| `analyze_sentiment` | `src/lib/ai/meetingAnalysisService.ts` | Add call to this prompt |
| `calculate_health_score` | `src/lib/intelligence/healthScore.ts` | Add call to this prompt |
| `score_lead` | `src/lib/intelligence/leadScoring.ts` | Add call to this prompt |
| `analyze_deal_win` | `src/lib/pipelines/dealAnalysis.ts` | Add call to this prompt |
| `analyze_deal_loss` | `src/lib/pipelines/dealAnalysis.ts` | Add call to this prompt |
| `workflow_ai_followup` | `src/lib/workflow/aiActions.ts` | Add call to this prompt |
| `workflow_ai_analysis` | `src/lib/workflow/aiActions.ts` | Add call to this prompt |
| `workflow_ai_nurture` | `src/lib/workflow/aiActions.ts` | Add call to this prompt |

### 7.3 Implementation Pattern

For each prompt, follow this pattern:

```typescript
// Find the existing hardcoded prompt in the file
// Replace with:

import { getPromptWithVariables } from '@/lib/ai/promptManager';

// Instead of hardcoded prompt:
const promptData = await getPromptWithVariables('prompt_key_here', {
  variable1: value1,
  variable2: value2,
});

if (promptData) {
  const result = await callAIJson({
    prompt: promptData.prompt,
    schema: promptData.schema,
    model: promptData.model,
    maxTokens: promptData.maxTokens,
  });
} else {
  // Keep original hardcoded as fallback
}
```

**QC Gate 7:**
- [ ] Each prompt key verified to exist in database
- [ ] Each backend file updated to use `getPromptWithVariables`
- [ ] Fallback to original behavior if prompt not found
- [ ] Test each feature that uses the prompt still works

---

## Phase 8: Create Automated Tests

### 8.1 Playwright E2E Tests

**File:** Create `tests/e2e/process-aware-ai.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Process-Aware AI Features', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login flow - adjust based on your auth setup
    await page.goto('/login');
    // ... login steps
  });

  test('user can change default process type in settings', async ({ page }) => {
    await page.goto('/settings');
    
    // Navigate to People tab
    await page.click('text=People');
    
    // Find the process type dropdown
    const dropdown = page.locator('select').filter({ hasText: 'Sales' });
    await expect(dropdown).toBeVisible();
    
    // Change to Onboarding
    await dropdown.selectOption('onboarding');
    
    // Save
    await page.click('text=Save Changes');
    
    // Verify save confirmation
    await expect(page.locator('text=Saved')).toBeVisible();
    
    // Refresh and verify persistence
    await page.reload();
    await expect(dropdown).toHaveValue('onboarding');
  });

  test('onboarding prompts appear in AI prompts settings', async ({ page }) => {
    await page.goto('/settings/ai-prompts');
    
    // Search for onboarding prompts
    await expect(page.locator('text=Transcript Analysis - Onboarding')).toBeVisible();
    await expect(page.locator('text=Meeting Prep - Onboarding')).toBeVisible();
  });

  test('command center shows onboarding item types', async ({ page }) => {
    // This test depends on having test data
    await page.goto('/command-center');
    
    // Check for onboarding-specific item types in filters or items
    // Adjust selectors based on actual UI
    const filterPanel = page.locator('[data-testid="action-type-filter"]');
    await expect(filterPanel.locator('text=Implementation Blocker')).toBeVisible();
  });
});
```

### 8.2 Database Integrity Tests

Create a script to verify data integrity:

```sql
-- Verify all users have valid process type
SELECT COUNT(*) as invalid_users
FROM users 
WHERE default_process_type NOT IN ('sales', 'onboarding', 'engagement', 'support');

-- Verify prompts exist for all process types
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM ai_prompts WHERE key = 'transcript_analysis__onboarding') THEN 'OK'
    ELSE 'MISSING'
  END as onboarding_transcript,
  CASE 
    WHEN EXISTS (SELECT 1 FROM ai_prompts WHERE key = 'meeting_prep__onboarding') THEN 'OK'
    ELSE 'MISSING'
  END as onboarding_prep;

-- Verify command center items have valid action types
SELECT action_type, COUNT(*) 
FROM command_center_items 
GROUP BY action_type
ORDER BY COUNT(*) DESC;
```

**QC Gate 8:**
- [ ] All Playwright tests pass
- [ ] Database integrity queries return expected results
- [ ] No console errors during test runs
- [ ] Screenshots captured at key verification points

---

## Phase 9: Final Verification

### 9.1 End-to-End Test Scenario

1. **Setup:**
   - Create test user with `default_process_type = 'onboarding'`
   - Ensure user has Microsoft connection for calendar sync

2. **Test Flow:**
   - Sync a meeting for the test user
   - Trigger transcript analysis (manual or via Fireflies webhook)
   - Verify:
     - Logs show correct process type detection
     - `transcript_analysis__onboarding` prompt was used
     - Analysis output contains onboarding-specific fields (blockers, training_gaps, etc.)
     - Command Center shows items with onboarding action types

3. **Meeting Prep Test:**
   - Navigate to a meeting
   - Request meeting prep
   - Verify prep content is onboarding-focused (implementation status, training agenda, etc.)

### 9.2 Regression Checks

- [ ] Sales users still get sales-focused analysis
- [ ] Existing CC items still display correctly
- [ ] Meeting prep for sales users unchanged
- [ ] No performance degradation (prompt lookup adds one DB query)
- [ ] Settings page loads without errors
- [ ] AI prompts settings still editable

### 9.3 Documentation

Update relevant documentation:
- [ ] Add process type field to user documentation
- [ ] Document new prompt keys in prompt management docs
- [ ] Add onboarding item types to CC item documentation

---

## Debugging Guide

### Common Issues

**Issue:** Prompt not found errors
```
Solution: Check ai_prompts table for the key. Verify is_active = true.
Query: SELECT * FROM ai_prompts WHERE key = 'your_key';
```

**Issue:** Wrong process type detected
```
Solution: Check the priority order in getProcessTypeForContext.
Debug: Add console.log at each decision point.
Verify: User's default_process_type, company's current_process_type.
```

**Issue:** TypeScript errors after adding types
```
Solution: Run npm run type-check to see all errors.
Common fix: Import new types where used.
```

**Issue:** Settings dropdown not saving
```
Solution: Check browser network tab for API errors.
Verify: Supabase RLS policies allow update on users table.
```

**Issue:** CC items not created
```
Solution: Check createCommandCenterItem function.
Verify: action_type is in allowed values.
Debug: Add logging before insert.
```

### Useful Debug Queries

```sql
-- Check a user's process type
SELECT id, name, email, default_process_type FROM users WHERE email = 'user@example.com';

-- Check company process type
SELECT company_id, current_process_type, current_stage_name 
FROM company_product_read_model 
WHERE company_id = 'uuid-here';

-- Check recent CC items created
SELECT id, action_type, title, created_at 
FROM command_center_items 
ORDER BY created_at DESC 
LIMIT 20;

-- Check if onboarding prompts are being used
SELECT key, version, updated_at 
FROM ai_prompts 
WHERE key LIKE '%onboarding%';
```

---

## Summary Checklist

### Phase Completion

- [ ] Phase 0: Environment verified
- [ ] Phase 1: Database schema updated
- [ ] Phase 2: Prompt manager enhanced
- [ ] Phase 3: Settings UI updated
- [ ] Phase 4: Onboarding prompts added
- [ ] Phase 5: Transcript pipeline updated
- [ ] Phase 6: Meeting prep updated
- [ ] Phase 7: Existing prompts wired up
- [ ] Phase 8: Automated tests created
- [ ] Phase 9: Final verification complete

### Definition of Done

- [ ] All TypeScript compiles without errors
- [ ] All existing tests still pass
- [ ] New Playwright tests pass
- [ ] Settings UI shows and saves process type
- [ ] Onboarding user gets onboarding-focused analysis
- [ ] Sales user gets sales-focused analysis (unchanged)
- [ ] CC items created with correct action types
- [ ] No console errors in production build
- [ ] Documentation updated
