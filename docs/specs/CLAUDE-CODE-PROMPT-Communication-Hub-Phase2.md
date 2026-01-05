# Communication Hub: Phase 2 - Analysis Pipeline

## Overview

Phase 1 created the foundation (tables, adapters, backfill). Phase 2 adds the intelligence layer - AI analyzes each communication and extracts structured intelligence.

**Core Principle:**
```
Communications = FACTS (immutable, Phase 1 ✅)
Analysis = OPINIONS (versioned, replaceable - THIS PHASE)
Prioritization = JUDGMENT (Phase 4)
```

---

## Phase 2 Tasks

### Task 1: Create Analysis Prompt (Versioned)

Create `src/lib/communicationHub/analysis/prompts/v1.ts`:

```typescript
export const ANALYSIS_PROMPT_VERSION = 'v1';

export const PRODUCTS = [
  'Voice Agent',
  'Call Analytics', 
  'Action Hub',
  'Performance Center',
  'Accountability Hub',
];

export const COMMUNICATION_TYPES = [
  'sales',
  'onboarding', 
  'support',
  'success',
  'billing',
  'internal',
];

export function buildAnalysisPrompt(communication: {
  channel: string;
  direction: string;
  subject: string | null;
  content: string | null;
  participants: { our: string[]; their: string[] };
}): string {
  return `
Analyze this ${communication.channel} communication and extract structured intelligence.

COMMUNICATION:
Channel: ${communication.channel}
Direction: ${communication.direction}
Subject: ${communication.subject || 'N/A'}
Our participants: ${communication.participants.our.join(', ') || 'Unknown'}
Their participants: ${communication.participants.their.join(', ') || 'Unknown'}

Content:
${communication.content || '[No content]'}

INSTRUCTIONS:
Extract the following with confidence scores (0.0-1.0). Only include items you're confident about.

1. SUMMARY: 1-2 sentence summary of the communication

2. COMMUNICATION_TYPE: One of: ${COMMUNICATION_TYPES.join(', ')}

3. PRODUCTS_DISCUSSED: Which products mentioned: ${PRODUCTS.join(', ')}

4. SENTIMENT: 
   - sentiment: positive, neutral, negative, concerned, excited
   - score: -1.0 (very negative) to 1.0 (very positive)
   - confidence: 0.0-1.0

5. FACTS_LEARNED: New facts about the company/contact
   [{ "fact": "string", "confidence": 0.0-1.0, "quote": "source text" }]

6. SIGNALS: Buying signals or risk signals
   [{ "signal": "budget_confirmed|timeline_urgent|competitor_evaluating|deal_at_risk|ready_to_proceed|etc", 
      "detail": "string", "confidence": 0.0-1.0 }]

7. OBJECTIONS: Concerns or objections raised
   [{ "objection": "string", "detail": "string", "confidence": 0.0-1.0, "addressed": false }]

8. COMMITMENTS_US: Promises/commitments WE made (X-RAI team)
   [{ "commitment": "string", "confidence": 0.0-1.0, "due_by": "YYYY-MM-DD or null", "owner": "name or null" }]

9. COMMITMENTS_THEM: Promises/commitments THEY made (customer/prospect)
   [{ "commitment": "string", "confidence": 0.0-1.0, "due_by": "YYYY-MM-DD or null", "who": "name or null" }]

10. COMPETITORS: Competitors mentioned
    [{ "competitor": "string", "context": "currently using|evaluating|mentioned", "confidence": 0.0-1.0 }]

11. NEXT_STEPS: Identified next actions
    [{ "step": "string", "owner": "us|them", "priority": "high|medium|low", "confidence": 0.0-1.0 }]

12. POTENTIAL_TRIGGERS: What Command Center actions might this trigger?
    Choose from: inbound_inquiry, demo_request, pricing_request, commitment_made, commitment_due, 
    competitor_mentioned, objection_raised, deal_at_risk, follow_up_needed, question_asked, 
    positive_signal, negative_signal, escalation_needed, none
    
Return as array: ["trigger1", "trigger2"]

RESPONSE FORMAT:
Return valid JSON matching this schema:
{
  "summary": "string",
  "communication_type": "string",
  "products_discussed": ["string"],
  "sentiment": { "sentiment": "string", "score": number, "confidence": number },
  "extracted_facts": [...],
  "extracted_signals": [...],
  "extracted_objections": [...],
  "extracted_commitments_us": [...],
  "extracted_commitments_them": [...],
  "extracted_competitors": [...],
  "extracted_next_steps": [...],
  "potential_triggers": ["string"]
}

Be conservative with confidence scores. Only high confidence (>0.85) items should trigger actions.
If unsure about something, either omit it or give it a low confidence score.
`;
}
```

### Task 2: Create Analysis Function

Create `src/lib/communicationHub/analysis/analyzeCommunication.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { buildAnalysisPrompt, ANALYSIS_PROMPT_VERSION } from './prompts/v1';
import { Communication, CommunicationAnalysis } from '@/types/communicationHub';

// Schema for AI response validation
const AnalysisResultSchema = z.object({
  summary: z.string(),
  communication_type: z.string(),
  products_discussed: z.array(z.string()).default([]),
  sentiment: z.object({
    sentiment: z.string(),
    score: z.number(),
    confidence: z.number(),
  }),
  extracted_facts: z.array(z.object({
    fact: z.string(),
    confidence: z.number(),
    quote: z.string().optional(),
  })).default([]),
  extracted_signals: z.array(z.object({
    signal: z.string(),
    detail: z.string(),
    confidence: z.number(),
  })).default([]),
  extracted_objections: z.array(z.object({
    objection: z.string(),
    detail: z.string(),
    confidence: z.number(),
    addressed: z.boolean().default(false),
  })).default([]),
  extracted_commitments_us: z.array(z.object({
    commitment: z.string(),
    confidence: z.number(),
    due_by: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
  })).default([]),
  extracted_commitments_them: z.array(z.object({
    commitment: z.string(),
    confidence: z.number(),
    due_by: z.string().nullable().optional(),
    who: z.string().nullable().optional(),
  })).default([]),
  extracted_competitors: z.array(z.object({
    competitor: z.string(),
    context: z.string(),
    confidence: z.number(),
  })).default([]),
  extracted_next_steps: z.array(z.object({
    step: z.string(),
    owner: z.enum(['us', 'them']),
    priority: z.enum(['high', 'medium', 'low']),
    confidence: z.number(),
  })).default([]),
  potential_triggers: z.array(z.string()).default([]),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export async function analyzeCommunication(
  communicationId: string
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  const supabase = createAdminClient();
  
  // Fetch communication
  const { data: comm, error: fetchError } = await supabase
    .from('communications')
    .select('*')
    .eq('id', communicationId)
    .single();
  
  if (fetchError || !comm) {
    return { success: false, error: `Communication not found: ${communicationId}` };
  }
  
  // Skip if no content to analyze
  if (!comm.full_content && !comm.content_preview && !comm.subject) {
    // Mark as complete with no analysis needed
    await supabase
      .from('communications')
      .update({ analysis_status: 'complete' })
      .eq('id', communicationId);
    return { success: true, analysisId: undefined };
  }
  
  // Mark as processing
  await supabase
    .from('communications')
    .update({ analysis_status: 'processing' })
    .eq('id', communicationId);
  
  try {
    // Build prompt
    const prompt = buildAnalysisPrompt({
      channel: comm.channel,
      direction: comm.direction,
      subject: comm.subject,
      content: comm.full_content || comm.content_preview,
      participants: {
        our: (comm.our_participants || []).map((p: any) => p.name || p.email).filter(Boolean),
        their: (comm.their_participants || []).map((p: any) => p.name || p.email).filter(Boolean),
      },
    });
    
    // Call AI
    const { object: result } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: AnalysisResultSchema,
      prompt,
    });
    
    // Get current version number
    const { data: existingAnalyses } = await supabase
      .from('communication_analysis')
      .select('version')
      .eq('communication_id', communicationId)
      .order('version', { ascending: false })
      .limit(1);
    
    const nextVersion = (existingAnalyses?.[0]?.version || 0) + 1;
    
    // Mark old analyses as not current
    await supabase
      .from('communication_analysis')
      .update({ is_current: false })
      .eq('communication_id', communicationId);
    
    // Insert new analysis
    const { data: analysis, error: insertError } = await supabase
      .from('communication_analysis')
      .insert({
        communication_id: communicationId,
        version: nextVersion,
        is_current: true,
        model_used: 'gpt-4o-mini',
        prompt_version: ANALYSIS_PROMPT_VERSION,
        summary: result.summary,
        communication_type: result.communication_type,
        products_discussed: result.products_discussed,
        sentiment: result.sentiment.sentiment,
        sentiment_score: result.sentiment.score,
        sentiment_confidence: result.sentiment.confidence,
        extracted_facts: result.extracted_facts,
        extracted_signals: result.extracted_signals,
        extracted_objections: result.extracted_objections,
        extracted_commitments_us: result.extracted_commitments_us,
        extracted_commitments_them: result.extracted_commitments_them,
        extracted_competitors: result.extracted_competitors,
        extracted_next_steps: result.extracted_next_steps,
        potential_triggers: result.potential_triggers,
        analyzed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    // Update communication with analysis reference
    await supabase
      .from('communications')
      .update({
        analysis_status: 'complete',
        current_analysis_id: analysis.id,
      })
      .eq('id', communicationId);
    
    // Extract promises
    await extractPromises(communicationId, analysis.id, result, comm, supabase);
    
    console.log(`[Analysis] Completed for communication ${communicationId}`);
    return { success: true, analysisId: analysis.id };
    
  } catch (error: any) {
    console.error(`[Analysis] Failed for ${communicationId}:`, error);
    
    await supabase
      .from('communications')
      .update({ analysis_status: 'failed' })
      .eq('id', communicationId);
    
    return { success: false, error: error.message };
  }
}

async function extractPromises(
  communicationId: string,
  analysisId: string,
  result: AnalysisResult,
  comm: any,
  supabase: any
): Promise<void> {
  const promises: any[] = [];
  
  // Our commitments
  for (const commitment of result.extracted_commitments_us) {
    if (commitment.confidence < 0.7) continue; // Skip low confidence
    
    promises.push({
      direction: 'we_promised',
      promise_text: commitment.commitment,
      company_id: comm.company_id,
      contact_id: comm.contact_id,
      deal_id: comm.deal_id,
      owner_user_id: comm.user_id,
      owner_name: commitment.owner || null,
      promised_at: comm.occurred_at,
      due_by: commitment.due_by || null,
      status: 'pending',
      source_communication_id: communicationId,
      source_analysis_id: analysisId,
      confidence: commitment.confidence,
    });
  }
  
  // Their commitments
  for (const commitment of result.extracted_commitments_them) {
    if (commitment.confidence < 0.7) continue; // Skip low confidence
    
    promises.push({
      direction: 'they_promised',
      promise_text: commitment.commitment,
      company_id: comm.company_id,
      contact_id: comm.contact_id,
      deal_id: comm.deal_id,
      promiser_name: commitment.who || null,
      promised_at: comm.occurred_at,
      due_by: commitment.due_by || null,
      status: 'pending',
      source_communication_id: communicationId,
      source_analysis_id: analysisId,
      confidence: commitment.confidence,
    });
  }
  
  if (promises.length > 0) {
    const { error } = await supabase.from('promises').insert(promises);
    if (error) {
      console.error(`[Analysis] Failed to insert promises:`, error);
    } else {
      console.log(`[Analysis] Extracted ${promises.length} promises`);
    }
  }
}

export async function analyzeAllPending(
  options?: { limit?: number }
): Promise<{ analyzed: number; errors: number }> {
  const supabase = createAdminClient();
  
  const { data: pending, error } = await supabase
    .from('communications')
    .select('id')
    .eq('analysis_status', 'pending')
    .order('occurred_at', { ascending: false })
    .limit(options?.limit || 50);
  
  if (error || !pending) {
    console.error('[Analysis] Failed to fetch pending:', error);
    return { analyzed: 0, errors: 1 };
  }
  
  console.log(`[Analysis] Found ${pending.length} pending communications`);
  
  let analyzed = 0;
  let errors = 0;
  
  for (const comm of pending) {
    const result = await analyzeCommunication(comm.id);
    if (result.success) {
      analyzed++;
    } else {
      errors++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { analyzed, errors };
}
```

### Task 3: Create Analysis API Endpoint

Create `src/app/api/communications/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeCommunication, analyzeAllPending } from '@/lib/communicationHub/analysis/analyzeCommunication';

// POST - Analyze specific communication or batch
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { communication_id, batch, limit } = body;
  
  if (communication_id) {
    // Analyze single communication
    const result = await analyzeCommunication(communication_id);
    return NextResponse.json(result);
  }
  
  if (batch) {
    // Analyze all pending
    const result = await analyzeAllPending({ limit: limit || 50 });
    return NextResponse.json({
      success: true,
      ...result,
    });
  }
  
  return NextResponse.json(
    { error: 'Must provide communication_id or batch: true' },
    { status: 400 }
  );
}

// GET - Get analysis status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const communicationId = searchParams.get('communication_id');
  
  if (!communicationId) {
    return NextResponse.json(
      { error: 'communication_id required' },
      { status: 400 }
    );
  }
  
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('communication_analysis')
    .select('*')
    .eq('communication_id', communicationId)
    .eq('is_current', true)
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ analysis: data });
}
```

### Task 4: Create Analysis Cron Endpoint

Create `src/app/api/cron/analyze-communications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeAllPending } from '@/lib/communicationHub/analysis/analyzeCommunication';

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  console.log('[Cron] Starting communication analysis...');
  
  const result = await analyzeAllPending({ limit: 25 });
  
  console.log(`[Cron] Analysis complete: ${result.analyzed} analyzed, ${result.errors} errors`);
  
  return NextResponse.json({
    success: true,
    ...result,
  });
}

// Allow manual trigger via POST
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const limit = body.limit || 25;
  
  const result = await analyzeAllPending({ limit });
  
  return NextResponse.json({
    success: true,
    ...result,
  });
}
```

### Task 5: Create Promises API Endpoint

Create `src/app/api/communications/promises/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const userId = searchParams.get('user_id');
  const companyId = searchParams.get('company_id');
  const direction = searchParams.get('direction'); // 'we_promised' or 'they_promised'
  const status = searchParams.get('status'); // 'pending', 'completed', 'overdue'
  const includeHidden = searchParams.get('include_hidden') === 'true';
  
  let query = supabase
    .from('promises')
    .select(`
      *,
      company:companies(id, name),
      contact:contacts(id, first_name, last_name),
      source_communication:communications(id, channel, subject, occurred_at)
    `)
    .order('due_by', { ascending: true, nullsFirst: false });
  
  // Filters
  if (userId) query = query.eq('owner_user_id', userId);
  if (companyId) query = query.eq('company_id', companyId);
  if (direction) query = query.eq('direction', direction);
  if (status) query = query.eq('status', status);
  if (!includeHidden) query = query.eq('is_hidden', false);
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Categorize
  const now = new Date();
  const categorized = {
    overdue: [] as any[],
    due_today: [] as any[],
    due_this_week: [] as any[],
    upcoming: [] as any[],
    no_due_date: [] as any[],
    completed: [] as any[],
  };
  
  for (const promise of data || []) {
    if (promise.status === 'completed') {
      categorized.completed.push(promise);
      continue;
    }
    
    if (!promise.due_by) {
      categorized.no_due_date.push(promise);
      continue;
    }
    
    const dueBy = new Date(promise.due_by);
    const daysUntilDue = (dueBy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysUntilDue < 0) {
      categorized.overdue.push({ ...promise, days_overdue: Math.abs(daysUntilDue) });
    } else if (daysUntilDue < 1) {
      categorized.due_today.push(promise);
    } else if (daysUntilDue < 7) {
      categorized.due_this_week.push(promise);
    } else {
      categorized.upcoming.push(promise);
    }
  }
  
  return NextResponse.json({
    promises: categorized,
    total: data?.length || 0,
    counts: {
      overdue: categorized.overdue.length,
      due_today: categorized.due_today.length,
      due_this_week: categorized.due_this_week.length,
      upcoming: categorized.upcoming.length,
      no_due_date: categorized.no_due_date.length,
      completed: categorized.completed.length,
    },
  });
}

// PATCH - Update promise status
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { promise_id, status, is_hidden } = body;
  
  if (!promise_id) {
    return NextResponse.json({ error: 'promise_id required' }, { status: 400 });
  }
  
  const updates: any = { updated_at: new Date().toISOString() };
  
  if (status) {
    updates.status = status;
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
  }
  
  if (typeof is_hidden === 'boolean') {
    updates.is_hidden = is_hidden;
  }
  
  const { data, error } = await supabase
    .from('promises')
    .update(updates)
    .eq('id', promise_id)
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ promise: data });
}
```

### Task 6: Create Confidence Filtering Utility

Create `src/lib/communicationHub/analysis/confidenceGating.ts`:

```typescript
import { CONFIDENCE_THRESHOLDS } from '@/types/communicationHub';

interface WithConfidence {
  confidence: number;
}

/**
 * Filter items by confidence threshold
 */
export function filterByConfidence<T extends WithConfidence>(
  items: T[],
  threshold: number = CONFIDENCE_THRESHOLDS.MEDIUM
): T[] {
  return items.filter(item => item.confidence >= threshold);
}

/**
 * Categorize items by confidence level
 */
export function categorizeByConfidence<T extends WithConfidence>(
  items: T[]
): {
  high: T[];
  medium: T[];
  low: T[];
} {
  return {
    high: items.filter(i => i.confidence >= CONFIDENCE_THRESHOLDS.HIGH),
    medium: items.filter(i => 
      i.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM && 
      i.confidence < CONFIDENCE_THRESHOLDS.HIGH
    ),
    low: items.filter(i => i.confidence < CONFIDENCE_THRESHOLDS.MEDIUM),
  };
}

/**
 * Get display label for confidence level
 */
export function getConfidenceLabel(confidence: number): {
  level: 'high' | 'medium' | 'low';
  label: string;
  showByDefault: boolean;
} {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return { level: 'high', label: '', showByDefault: true };
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return { level: 'medium', label: 'Possible', showByDefault: true };
  }
  return { level: 'low', label: 'Uncertain', showByDefault: false };
}

/**
 * Should this item trigger a Command Center action?
 */
export function canTriggerAction(confidence: number): boolean {
  return confidence >= CONFIDENCE_THRESHOLDS.HIGH;
}
```

### Task 7: Create Analysis Script for Testing

Create `scripts/analyze-communications.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0] || '10');
  
  console.log(`Analyzing up to ${limit} communications...\n`);
  
  // Get pending
  const { data: pending, error } = await supabase
    .from('communications')
    .select('id, channel, subject')
    .eq('analysis_status', 'pending')
    .limit(limit);
  
  if (error) {
    console.error('Error fetching pending:', error);
    return;
  }
  
  console.log(`Found ${pending?.length || 0} pending communications\n`);
  
  // Trigger analysis via API
  const response = await fetch('http://localhost:3000/api/communications/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch: true, limit }),
  });
  
  const result = await response.json();
  console.log('Analysis result:', result);
  
  // Show results
  console.log('\n=== Analysis Complete ===');
  
  const { data: analyses } = await supabase
    .from('communication_analysis')
    .select('communication_id, summary, communication_type, potential_triggers, extracted_commitments_us, extracted_commitments_them')
    .eq('is_current', true)
    .order('analyzed_at', { ascending: false })
    .limit(limit);
  
  for (const a of analyses || []) {
    console.log(`\n--- ${a.communication_id} ---`);
    console.log(`Type: ${a.communication_type}`);
    console.log(`Summary: ${a.summary}`);
    console.log(`Triggers: ${a.potential_triggers?.join(', ') || 'none'}`);
    console.log(`Our commitments: ${a.extracted_commitments_us?.length || 0}`);
    console.log(`Their commitments: ${a.extracted_commitments_them?.length || 0}`);
  }
  
  // Show promises
  const { data: promises } = await supabase
    .from('promises')
    .select('direction, promise_text, due_by, confidence')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n=== Recent Promises ===');
  for (const p of promises || []) {
    console.log(`[${p.direction}] ${p.promise_text} (conf: ${p.confidence}, due: ${p.due_by || 'no date'})`);
  }
}

main().catch(console.error);
```

### Task 8: Add Cron to vercel.json

Update `vercel.json` to add the analysis cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/analyze-communications",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Note: Merge with existing crons if they exist.

---

## Verification

After implementation:

1. **Test single analysis:**
```bash
curl -X POST http://localhost:3000/api/communications/analyze \
  -H "Content-Type: application/json" \
  -d '{"communication_id": "YOUR_COMM_ID"}'
```

2. **Test batch analysis:**
```bash
curl -X POST http://localhost:3000/api/communications/analyze \
  -H "Content-Type: application/json" \
  -d '{"batch": true, "limit": 10}'
```

3. **Check analyses created:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN is_current THEN 1 END) as current
FROM communication_analysis;
```

4. **Check promises extracted:**
```sql
SELECT direction, COUNT(*), AVG(confidence)
FROM promises
GROUP BY direction;
```

5. **Test promises API:**
```bash
curl http://localhost:3000/api/communications/promises
```

6. **Run test script:**
```bash
npx ts-node scripts/analyze-communications.ts 10
```

---

## Success Criteria

- [ ] Analysis prompt created with versioning
- [ ] analyzeCommunication() works for single communication
- [ ] analyzeAllPending() processes batch
- [ ] communication_analysis records created with all fields
- [ ] Promises extracted to promises table (confidence >= 0.7)
- [ ] /api/communications/analyze endpoint works
- [ ] /api/communications/promises endpoint works
- [ ] Cron endpoint created
- [ ] TypeScript compiles clean

---

## Expected Results

After running analysis on 113 communications:
- communication_analysis: ~113 records
- promises: Variable (depends on content, maybe 20-50)
- Each analysis has: summary, type, sentiment, extractions, triggers
