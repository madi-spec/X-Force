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
          type: 'object' as const,
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

interface TranscriptRow {
  id: string;
  content: string | null;
  transcript_text: string | null;
  company: { id: string; name: string }[] | { id: string; name: string } | null;
}

interface ProductStage {
  id: string;
  name: string;
  stage_order: number;
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

  const stageNames = ((product.stages as ProductStage[]) || [])
    .sort((a, b) => a.stage_order - b.stage_order)
    .map(s => s.name);

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

  for (const transcript of (transcripts as TranscriptRow[]) || []) {
    try {
      const content = transcript.transcript_text || transcript.content;
      if (!content) continue;

      // Handle company being an array or single object
      const company = Array.isArray(transcript.company)
        ? transcript.company[0]
        : transcript.company;

      const analysis = await analyzeTranscriptForSales(
        transcript.id,
        content,
        company?.name || 'Unknown',
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
