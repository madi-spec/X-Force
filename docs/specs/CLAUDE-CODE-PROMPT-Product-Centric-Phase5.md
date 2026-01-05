# Product-Centric Redesign: Phase 5 - AI Learning

## Context

Read these first:
- `/docs/specs/X-FORCE-CRM-Project-State.md`
- `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md`

**Phase 1-4 Complete:** Database, imports, product UI, proven process editor

---

## Phase 5 Overview

The CRM learns from your sales conversations to improve the proven process over time:

1. **Transcript Analysis** - Analyze call transcripts to extract insights
2. **Pitch Point Suggestions** - Find what top performers say that works
3. **Objection Extraction** - Identify common objections and successful responses
4. **Win/Loss Patterns** - What differentiates won vs lost deals
5. **Stage Metrics** - Calculate avg days in stage, conversion rates

---

## Data Sources

You already have:
- `transcripts` table with call recordings/transcripts
- `communications` table with analyzed emails
- `company_products` table with stage history
- `company_product_history` table for tracking changes

---

## Task 1: AI Analysis Types Schema

Add columns to `product_sales_stages` if not present:

```sql
-- Add AI suggestion columns to stages
ALTER TABLE product_sales_stages
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add analysis tracking to transcripts
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES product_sales_stages(id),
ADD COLUMN IF NOT EXISTS sales_insights JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS extracted_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS extracted_pitch_points JSONB DEFAULT '[]';
```

---

## Task 2: Transcript Analysis Service

Create `src/lib/ai/transcript-analyzer.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic();

interface TranscriptAnalysis {
  product_mentioned: string | null;
  stage_indicators: string[];
  objections_raised: {
    objection: string;
    response: string | null;
    was_handled: boolean;
  }[];
  pitch_points_used: {
    point: string;
    was_effective: boolean;
  }[];
  outcome_signals: {
    positive: string[];
    negative: string[];
  };
  next_steps_mentioned: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
}

export async function analyzeTranscriptForSales(
  transcriptId: string,
  transcriptContent: string,
  companyName: string,
  productContext?: { name: string; stages: string[] }
): Promise<TranscriptAnalysis> {
  const systemPrompt = `You are a sales intelligence analyst. Analyze this sales call transcript and extract actionable insights.

Company: ${companyName}
${productContext ? `Product being discussed: ${productContext.name}
Sales stages: ${productContext.stages.join(' → ')}` : ''}

Extract:
1. What product/service is being discussed
2. What stage of the sales process this appears to be
3. Any objections the prospect raised and how they were handled
4. Effective pitch points or value props mentioned
5. Positive and negative buying signals
6. Next steps mentioned
7. Overall sentiment

Be specific and quote the transcript where relevant.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyze this transcript:\n\n${transcriptContent}`
      }
    ],
    tools: [
      {
        name: 'record_analysis',
        description: 'Record the transcript analysis results',
        input_schema: {
          type: 'object',
          properties: {
            product_mentioned: {
              type: 'string',
              description: 'The product/service being discussed, or null if unclear'
            },
            stage_indicators: {
              type: 'array',
              items: { type: 'string' },
              description: 'Indicators of which sales stage this call represents'
            },
            objections_raised: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  objection: { type: 'string' },
                  response: { type: 'string' },
                  was_handled: { type: 'boolean' }
                },
                required: ['objection', 'was_handled']
              }
            },
            pitch_points_used: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  point: { type: 'string' },
                  was_effective: { type: 'boolean' }
                },
                required: ['point', 'was_effective']
              }
            },
            outcome_signals: {
              type: 'object',
              properties: {
                positive: { type: 'array', items: { type: 'string' } },
                negative: { type: 'array', items: { type: 'string' } }
              }
            },
            next_steps_mentioned: {
              type: 'array',
              items: { type: 'string' }
            },
            sentiment: {
              type: 'string',
              enum: ['positive', 'neutral', 'negative']
            },
            summary: {
              type: 'string',
              description: 'Brief summary of the call and key takeaways'
            }
          },
          required: ['sentiment', 'summary']
        }
      }
    ],
    tool_choice: { type: 'tool', name: 'record_analysis' }
  });

  // Extract tool use result
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    return toolUse.input as TranscriptAnalysis;
  }

  // Fallback
  return {
    product_mentioned: null,
    stage_indicators: [],
    objections_raised: [],
    pitch_points_used: [],
    outcome_signals: { positive: [], negative: [] },
    next_steps_mentioned: [],
    sentiment: 'neutral',
    summary: 'Analysis could not be completed'
  };
}

export async function batchAnalyzeTranscripts(
  productId: string,
  limit: number = 50
): Promise<{ analyzed: number; errors: number }> {
  const supabase = await createClient();
  
  // Get product with stages
  const { data: product } = await supabase
    .from('products')
    .select(`
      id, name, slug,
      stages:product_sales_stages(id, name, stage_order)
    `)
    .eq('id', productId)
    .single();
  
  if (!product) throw new Error('Product not found');
  
  const stageNames = (product.stages || [])
    .sort((a: any, b: any) => a.stage_order - b.stage_order)
    .map((s: any) => s.name);
  
  // Get unanalyzed transcripts for companies with this product
  const { data: transcripts } = await supabase
    .from('transcripts')
    .select(`
      id, 
      content,
      transcript_text,
      company:companies(id, name)
    `)
    .is('sales_insights', null)
    .limit(limit);
  
  let analyzed = 0;
  let errors = 0;
  
  for (const transcript of transcripts || []) {
    try {
      const content = transcript.transcript_text || transcript.content;
      if (!content) continue;
      
      const analysis = await analyzeTranscriptForSales(
        transcript.id,
        content,
        transcript.company?.name || 'Unknown',
        { name: product.name, stages: stageNames }
      );
      
      // Save analysis
      await supabase
        .from('transcripts')
        .update({
          product_id: productId,
          sales_insights: analysis,
          extracted_objections: analysis.objections_raised,
          extracted_pitch_points: analysis.pitch_points_used,
        })
        .eq('id', transcript.id);
      
      analyzed++;
    } catch (err) {
      console.error(`Error analyzing transcript ${transcript.id}:`, err);
      errors++;
    }
  }
  
  return { analyzed, errors };
}
```

---

## Task 3: Pattern Aggregation Service

Create `src/lib/ai/pattern-aggregator.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface AggregatedPatterns {
  common_objections: {
    objection: string;
    frequency: number;
    best_responses: string[];
    success_rate: number;
  }[];
  effective_pitch_points: {
    point: string;
    frequency: number;
    effectiveness_score: number;
  }[];
  stage_insights: {
    stage_id: string;
    avg_days: number;
    conversion_rate: number;
    common_blockers: string[];
  }[];
  win_patterns: string[];
  loss_patterns: string[];
}

export async function aggregatePatternsForProduct(
  productId: string
): Promise<AggregatedPatterns> {
  const supabase = await createClient();
  
  // Get all analyzed transcripts for this product
  const { data: transcripts } = await supabase
    .from('transcripts')
    .select(`
      id,
      sales_insights,
      extracted_objections,
      extracted_pitch_points,
      company:companies(
        id,
        company_products!inner(
          id, status, product_id
        )
      )
    `)
    .eq('product_id', productId)
    .not('sales_insights', 'is', null);
  
  if (!transcripts || transcripts.length === 0) {
    return {
      common_objections: [],
      effective_pitch_points: [],
      stage_insights: [],
      win_patterns: [],
      loss_patterns: []
    };
  }
  
  // Aggregate objections
  const objectionMap = new Map<string, { responses: string[]; handled: number; total: number }>();
  const pitchPointMap = new Map<string, { effective: number; total: number }>();
  
  for (const t of transcripts) {
    const objections = t.extracted_objections || [];
    const pitchPoints = t.extracted_pitch_points || [];
    
    for (const obj of objections) {
      const key = obj.objection.toLowerCase().trim();
      const existing = objectionMap.get(key) || { responses: [], handled: 0, total: 0 };
      existing.total++;
      if (obj.was_handled) {
        existing.handled++;
        if (obj.response) {
          existing.responses.push(obj.response);
        }
      }
      objectionMap.set(key, existing);
    }
    
    for (const pp of pitchPoints) {
      const key = pp.point.toLowerCase().trim();
      const existing = pitchPointMap.get(key) || { effective: 0, total: 0 };
      existing.total++;
      if (pp.was_effective) {
        existing.effective++;
      }
      pitchPointMap.set(key, existing);
    }
  }
  
  // Convert to arrays
  const common_objections = Array.from(objectionMap.entries())
    .map(([objection, data]) => ({
      objection,
      frequency: data.total,
      best_responses: [...new Set(data.responses)].slice(0, 3),
      success_rate: data.total > 0 ? data.handled / data.total : 0
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
  
  const effective_pitch_points = Array.from(pitchPointMap.entries())
    .map(([point, data]) => ({
      point,
      frequency: data.total,
      effectiveness_score: data.total > 0 ? data.effective / data.total : 0
    }))
    .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
    .slice(0, 10);
  
  // Get stage metrics from company_product_history
  const { data: stageHistory } = await supabase
    .from('company_product_history')
    .select(`
      id,
      event_type,
      from_value,
      to_value,
      created_at,
      company_product:company_products!inner(
        id, product_id, status
      )
    `)
    .eq('company_product.product_id', productId)
    .eq('event_type', 'stage_changed')
    .order('created_at');
  
  // Calculate stage conversion rates (simplified)
  const { data: stages } = await supabase
    .from('product_sales_stages')
    .select('id, name, stage_order')
    .eq('product_id', productId)
    .order('stage_order');
  
  const stage_insights = (stages || []).map(stage => ({
    stage_id: stage.id,
    avg_days: 0, // Would calculate from history
    conversion_rate: 0, // Would calculate from history
    common_blockers: []
  }));
  
  // Use AI to identify win/loss patterns
  const patterns = await identifyWinLossPatterns(transcripts);
  
  return {
    common_objections,
    effective_pitch_points,
    stage_insights,
    win_patterns: patterns.win,
    loss_patterns: patterns.loss
  };
}

async function identifyWinLossPatterns(
  transcripts: any[]
): Promise<{ win: string[]; loss: string[] }> {
  // Group by outcome
  const wonTranscripts = transcripts.filter(t => 
    t.company?.company_products?.some((cp: any) => cp.status === 'active')
  );
  const lostTranscripts = transcripts.filter(t => 
    t.company?.company_products?.some((cp: any) => cp.status === 'declined')
  );
  
  if (wonTranscripts.length < 3 && lostTranscripts.length < 3) {
    return { win: [], loss: [] };
  }
  
  // Summarize patterns with AI
  const wonInsights = wonTranscripts.map(t => t.sales_insights?.summary || '').join('\n');
  const lostInsights = lostTranscripts.map(t => t.sales_insights?.summary || '').join('\n');
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Analyze these sales call summaries and identify patterns.

WON DEALS (${wonTranscripts.length} calls):
${wonInsights}

LOST DEALS (${lostTranscripts.length} calls):
${lostInsights}

What patterns differentiate won from lost? Return as JSON:
{
  "win_patterns": ["pattern 1", "pattern 2", ...],
  "loss_patterns": ["pattern 1", "pattern 2", ...]
}`
      }
    ]
  });
  
  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return {
      win: json.win_patterns || [],
      loss: json.loss_patterns || []
    };
  } catch {
    return { win: [], loss: [] };
  }
}

export async function updateStageWithAISuggestions(
  productId: string,
  stageId: string,
  patterns: AggregatedPatterns
): Promise<void> {
  const supabase = await createClient();
  
  // Get current stage
  const { data: stage } = await supabase
    .from('product_sales_stages')
    .select('*')
    .eq('id', stageId)
    .single();
  
  if (!stage) return;
  
  // Filter suggestions relevant to this stage
  // (In a real implementation, you'd use the stage_indicators from transcripts)
  const suggestedPitchPoints = patterns.effective_pitch_points
    .filter(pp => pp.effectiveness_score > 0.6)
    .map(pp => ({
      id: crypto.randomUUID(),
      text: pp.point,
      source: 'ai_suggested',
      effectiveness_score: pp.effectiveness_score
    }));
  
  const suggestedObjections = patterns.common_objections
    .filter(obj => obj.frequency >= 2)
    .map(obj => ({
      id: crypto.randomUUID(),
      objection: obj.objection,
      response: obj.best_responses[0] || '',
      source: 'ai_suggested',
      frequency: obj.frequency,
      success_rate: obj.success_rate
    }));
  
  // Update stage with suggestions
  await supabase
    .from('product_sales_stages')
    .update({
      ai_suggested_pitch_points: suggestedPitchPoints,
      ai_suggested_objections: suggestedObjections,
      ai_insights: {
        last_analyzed: new Date().toISOString(),
        transcript_count: patterns.effective_pitch_points.length,
        win_patterns: patterns.win_patterns,
        loss_patterns: patterns.loss_patterns
      }
    })
    .eq('id', stageId);
}
```

---

## Task 4: Stage Metrics Calculator

Create `src/lib/ai/stage-metrics.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

interface StageMetrics {
  stage_id: string;
  stage_name: string;
  companies_in_stage: number;
  avg_days_in_stage: number;
  conversion_rate: number;
  companies_won: number;
  companies_lost: number;
}

export async function calculateStageMetrics(
  productId: string
): Promise<StageMetrics[]> {
  const supabase = await createClient();
  
  // Get all stages
  const { data: stages } = await supabase
    .from('product_sales_stages')
    .select('id, name, stage_order')
    .eq('product_id', productId)
    .order('stage_order');
  
  if (!stages) return [];
  
  // Get all company_products for this product
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select('id, status, current_stage_id, stage_entered_at')
    .eq('product_id', productId);
  
  // Get history for calculating avg days
  const { data: history } = await supabase
    .from('company_product_history')
    .select('*')
    .in('company_product_id', (companyProducts || []).map(cp => cp.id))
    .eq('event_type', 'stage_changed')
    .order('created_at');
  
  // Calculate metrics per stage
  const metrics: StageMetrics[] = [];
  
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const nextStage = stages[i + 1];
    
    // Count currently in stage
    const inStage = (companyProducts || []).filter(
      cp => cp.current_stage_id === stage.id && cp.status === 'in_sales'
    ).length;
    
    // Find stage transitions
    const transitionsFrom = (history || []).filter(h => h.from_value === stage.id);
    const transitionsTo = (history || []).filter(h => h.to_value === stage.id);
    
    // Calculate avg days (simplified)
    let totalDays = 0;
    let daysCount = 0;
    
    for (const t of transitionsFrom) {
      const entryRecord = transitionsTo.find(
        e => e.company_product_id === t.company_product_id && 
             new Date(e.created_at) < new Date(t.created_at)
      );
      if (entryRecord) {
        const days = Math.floor(
          (new Date(t.created_at).getTime() - new Date(entryRecord.created_at).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
        daysCount++;
      }
    }
    
    // Calculate conversion rate
    const movedToNext = nextStage 
      ? transitionsFrom.filter(t => t.to_value === nextStage.id).length
      : 0;
    
    const won = (companyProducts || []).filter(
      cp => cp.status === 'active'
    ).length;
    
    const lost = (companyProducts || []).filter(
      cp => cp.status === 'declined'
    ).length;
    
    const totalExitedStage = transitionsFrom.length;
    const conversionRate = totalExitedStage > 0 
      ? movedToNext / totalExitedStage 
      : 0;
    
    metrics.push({
      stage_id: stage.id,
      stage_name: stage.name,
      companies_in_stage: inStage,
      avg_days_in_stage: daysCount > 0 ? Math.round(totalDays / daysCount) : 0,
      conversion_rate: Math.round(conversionRate * 100),
      companies_won: won,
      companies_lost: lost
    });
  }
  
  return metrics;
}

export async function updateStageMetrics(productId: string): Promise<void> {
  const supabase = await createClient();
  const metrics = await calculateStageMetrics(productId);
  
  for (const m of metrics) {
    await supabase
      .from('product_sales_stages')
      .update({
        avg_days_in_stage: m.avg_days_in_stage,
        conversion_rate: m.conversion_rate
      })
      .eq('id', m.stage_id);
  }
}
```

---

## Task 5: AI Analysis API Endpoints

Create `src/app/api/products/[id]/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { batchAnalyzeTranscripts } from '@/lib/ai/transcript-analyzer';
import { aggregatePatternsForProduct, updateStageWithAISuggestions } from '@/lib/ai/pattern-aggregator';
import { updateStageMetrics } from '@/lib/ai/stage-metrics';
import { createClient } from '@/lib/supabase/server';

// POST - Run AI analysis for a product
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  const { type = 'full' } = body;
  
  try {
    const results: any = {};
    
    // Step 1: Analyze transcripts
    if (type === 'full' || type === 'transcripts') {
      const transcriptResults = await batchAnalyzeTranscripts(params.id, 50);
      results.transcripts = transcriptResults;
    }
    
    // Step 2: Aggregate patterns
    if (type === 'full' || type === 'patterns') {
      const patterns = await aggregatePatternsForProduct(params.id);
      results.patterns = patterns;
      
      // Update each stage with suggestions
      const { data: stages } = await supabase
        .from('product_sales_stages')
        .select('id')
        .eq('product_id', params.id);
      
      for (const stage of stages || []) {
        await updateStageWithAISuggestions(params.id, stage.id, patterns);
      }
    }
    
    // Step 3: Calculate metrics
    if (type === 'full' || type === 'metrics') {
      await updateStageMetrics(params.id);
      results.metrics = 'updated';
    }
    
    return NextResponse.json({ 
      success: true, 
      results,
      message: 'Analysis complete'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Get analysis status/results
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  // Get stages with AI insights
  const { data: stages } = await supabase
    .from('product_sales_stages')
    .select(`
      id, name, stage_order,
      avg_days_in_stage,
      conversion_rate,
      ai_suggested_pitch_points,
      ai_suggested_objections,
      ai_insights
    `)
    .eq('product_id', params.id)
    .order('stage_order');
  
  // Count analyzed transcripts
  const { count: analyzedCount } = await supabase
    .from('transcripts')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', params.id)
    .not('sales_insights', 'is', null);
  
  const { count: totalCount } = await supabase
    .from('transcripts')
    .select('*', { count: 'exact', head: true });
  
  return NextResponse.json({
    stages,
    transcripts: {
      analyzed: analyzedCount || 0,
      total: totalCount || 0
    }
  });
}
```

---

## Task 6: AI Suggestions UI Component

Create `src/components/products/AISuggestions.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Sparkles, Plus, Check, X, RefreshCw, TrendingUp } from 'lucide-react';

interface AISuggestionsProps {
  stageId: string;
  suggestedPitchPoints: {
    id: string;
    text: string;
    effectiveness_score: number;
  }[];
  suggestedObjections: {
    id: string;
    objection: string;
    response: string;
    frequency: number;
    success_rate: number;
  }[];
  onAcceptPitchPoint: (point: { text: string }) => void;
  onAcceptObjection: (handler: { objection: string; response: string }) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function AISuggestions({
  stageId,
  suggestedPitchPoints,
  suggestedObjections,
  onAcceptPitchPoint,
  onAcceptObjection,
  onRefresh,
  loading
}: AISuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  const dismissSuggestion = (id: string) => {
    setDismissed(new Set([...dismissed, id]));
  };
  
  const visiblePitchPoints = suggestedPitchPoints.filter(p => !dismissed.has(p.id));
  const visibleObjections = suggestedObjections.filter(o => !dismissed.has(o.id));
  
  if (visiblePitchPoints.length === 0 && visibleObjections.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-700">
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">AI Suggestions</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-purple-600 hover:text-purple-700 p-1 rounded"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {visiblePitchPoints.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-purple-800 mb-2">
            Suggested Pitch Points
          </h4>
          <div className="space-y-2">
            {visiblePitchPoints.map((point) => (
              <div 
                key={point.id}
                className="bg-white rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{point.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-600">
                      {Math.round(point.effectiveness_score * 100)}% effective
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onAcceptPitchPoint({ text: point.text });
                      dismissSuggestion(point.id);
                    }}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    title="Add to stage"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => dismissSuggestion(point.id)}
                    className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {visibleObjections.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-purple-800 mb-2">
            Common Objections Detected
          </h4>
          <div className="space-y-2">
            {visibleObjections.map((obj) => (
              <div 
                key={obj.id}
                className="bg-white rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">
                      "{obj.objection}"
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      → {obj.response}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>Heard {obj.frequency}x</span>
                      <span>•</span>
                      <span>{Math.round(obj.success_rate * 100)}% handled successfully</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onAcceptObjection({ 
                          objection: obj.objection, 
                          response: obj.response 
                        });
                        dismissSuggestion(obj.id);
                      }}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      title="Add to stage"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => dismissSuggestion(obj.id)}
                      className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 7: Add Analysis Button to Process Page

Update the `/products/[slug]/process` page to include an "Analyze Transcripts" button:

```tsx
// Add to the page header or as a separate component
<button
  onClick={async () => {
    setAnalyzing(true);
    await fetch(`/api/products/${product.id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'full' })
    });
    // Refresh the page to show new suggestions
    window.location.reload();
  }}
  disabled={analyzing}
  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
>
  <Sparkles className="w-4 h-4" />
  {analyzing ? 'Analyzing...' : 'Analyze Transcripts'}
</button>
```

---

## Task 8: Integrate AI Suggestions into Stage Detail Panel

Update `StageDetailPanel.tsx` to show AI suggestions:

```tsx
// Add new tab
const tabs = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'pitch', label: 'Pitch Points', icon: MessageSquare, count: editedStage.pitch_points?.length },
  { id: 'objections', label: 'Objections', icon: AlertCircle, count: editedStage.objection_handlers?.length },
  { id: 'resources', label: 'Resources', icon: FileText, count: editedStage.resources?.length },
  { id: 'ai', label: 'AI', icon: Sparkles, badge: hasSuggestions },
];

// Add AI tab content
{activeTab === 'ai' && (
  <AISuggestions
    stageId={stage.id}
    suggestedPitchPoints={stage.ai_suggested_pitch_points || []}
    suggestedObjections={stage.ai_suggested_objections || []}
    onAcceptPitchPoint={(point) => {
      const newPoints = [...(editedStage.pitch_points || []), {
        id: crypto.randomUUID(),
        text: point.text,
        source: 'ai_suggested'
      }];
      setEditedStage({ ...editedStage, pitch_points: newPoints });
    }}
    onAcceptObjection={(handler) => {
      const newHandlers = [...(editedStage.objection_handlers || []), {
        id: crypto.randomUUID(),
        ...handler,
        source: 'ai_suggested'
      }];
      setEditedStage({ ...editedStage, objection_handlers: newHandlers });
    }}
    onRefresh={handleRefreshSuggestions}
    loading={refreshing}
  />
)}
```

---

## Verification

1. Run analysis: `POST /api/products/{id}/analyze`
2. Check stages have AI suggestions
3. Accept a suggestion → moves to regular pitch points
4. View stage metrics (avg days, conversion rate)
5. See win/loss patterns in AI insights

---

## Success Criteria

- [ ] Transcript analysis extracts objections and pitch points
- [ ] Patterns aggregated across multiple transcripts
- [ ] AI suggestions appear in stage detail panel
- [ ] Can accept/dismiss suggestions
- [ ] Stage metrics calculated (avg days, conversion rate)
- [ ] Win/loss patterns identified
- [ ] "Analyze Transcripts" button works
- [ ] TypeScript compiles clean
