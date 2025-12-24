import { NextRequest, NextResponse } from 'next/server';
import { batchAnalyzeTranscripts } from '@/lib/ai/transcript-analyzer';
import { aggregatePatternsForProduct, updateStageWithAISuggestions } from '@/lib/ai/pattern-aggregator';
import { updateStageMetrics } from '@/lib/ai/stage-metrics';
import { createClient } from '@/lib/supabase/server';

// POST - Run AI analysis for a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await params;
  const body = await request.json();
  const { type = 'full' } = body;

  // Get product ID from slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  try {
    const results: Record<string, unknown> = {};

    // Step 1: Analyze transcripts
    if (type === 'full' || type === 'transcripts') {
      const transcriptResults = await batchAnalyzeTranscripts(product.id, 50);
      results.transcripts = transcriptResults;
    }

    // Step 2: Aggregate patterns
    if (type === 'full' || type === 'patterns') {
      const patterns = await aggregatePatternsForProduct(product.id);
      results.patterns = patterns;

      // Update each stage with suggestions
      const { data: stages } = await supabase
        .from('product_sales_stages')
        .select('id')
        .eq('product_id', product.id);

      for (const stage of stages || []) {
        await updateStageWithAISuggestions(product.id, stage.id, patterns);
      }
    }

    // Step 3: Calculate metrics
    if (type === 'full' || type === 'metrics') {
      await updateStageMetrics(product.id);
      results.metrics = 'updated';
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Analysis complete'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Get analysis status/results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await params;

  // Get product ID from slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

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
    .eq('product_id', product.id)
    .order('stage_order');

  // Count analyzed transcripts
  const { count: analyzedCount } = await supabase
    .from('transcripts')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', product.id)
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
