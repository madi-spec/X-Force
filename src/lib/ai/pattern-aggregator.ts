import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface ObjectionData {
  objection: string;
  response?: string;
  was_handled: boolean;
}

interface PitchPointData {
  point: string;
  was_effective: boolean;
}

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

interface CompanyProduct {
  id: string;
  status: string;
  product_id: string;
}

interface CompanyWithProducts {
  id: string;
  company_products: CompanyProduct[];
}

interface TranscriptRecord {
  id: string;
  sales_insights: { summary?: string } | null;
  extracted_objections: ObjectionData[] | null;
  extracted_pitch_points: PitchPointData[] | null;
  company: CompanyWithProducts[] | CompanyWithProducts | null;
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

  const typedTranscripts = transcripts as unknown as TranscriptRecord[];

  // Aggregate objections
  const objectionMap = new Map<string, { responses: string[]; handled: number; total: number }>();
  const pitchPointMap = new Map<string, { effective: number; total: number }>();

  for (const t of typedTranscripts) {
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
  const { data: stages } = await supabase
    .from('product_sales_stages')
    .select('id, name, stage_order')
    .eq('product_id', productId)
    .order('stage_order');

  const stage_insights = (stages || []).map(stage => ({
    stage_id: stage.id,
    avg_days: 0,
    conversion_rate: 0,
    common_blockers: []
  }));

  // Use AI to identify win/loss patterns
  const patterns = await identifyWinLossPatterns(typedTranscripts);

  return {
    common_objections,
    effective_pitch_points,
    stage_insights,
    win_patterns: patterns.win,
    loss_patterns: patterns.loss
  };
}

function getCompanyFromTranscript(t: TranscriptRecord): CompanyWithProducts | null {
  if (!t.company) return null;
  return Array.isArray(t.company) ? t.company[0] : t.company;
}

async function identifyWinLossPatterns(
  transcripts: TranscriptRecord[]
): Promise<{ win: string[]; loss: string[] }> {
  // Group by outcome
  const wonTranscripts = transcripts.filter(t => {
    const company = getCompanyFromTranscript(t);
    return company?.company_products?.some((cp: CompanyProduct) => cp.status === 'active');
  });
  const lostTranscripts = transcripts.filter(t => {
    const company = getCompanyFromTranscript(t);
    return company?.company_products?.some((cp: CompanyProduct) => cp.status === 'declined');
  });

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
