import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStageById } from '@/lib/process/queries';

// Helper to verify stage belongs to product
async function verifyStageOwnership(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  productId: string,
  stageId: string
): Promise<boolean> {
  const { data: stage } = await supabase
    .from('product_process_stages')
    .select('process_id, process:product_processes!inner(product_id)')
    .eq('id', stageId)
    .single();

  if (!stage) return false;

  // Handle Supabase join - can return array or single object
  const processData = stage.process as unknown;
  const process = Array.isArray(processData) ? processData[0] : processData;
  return (process as { product_id: string } | null)?.product_id === productId;
}

// GET - Get single stage (uses unified product_process_stages)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; stageId: string }> }
) {
  const supabase = await createClient();
  const { slug, stageId } = await params;

  // Get product ID from slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Use query helper to get stage
  const stage = await getStageById(supabase, stageId);

  if (!stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
  }

  return NextResponse.json({ stage });
}

// PATCH - Update stage (uses unified product_process_stages)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; stageId: string }> }
) {
  const supabase = await createClient();
  const { slug, stageId } = await params;
  const body = await request.json();

  // Get product ID from slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Verify stage belongs to this product
  const isOwned = await verifyStageOwnership(supabase, product.id, stageId);
  if (!isOwned) {
    return NextResponse.json({ error: 'Stage not found for this product' }, { status: 404 });
  }

  const allowedFields = [
    'name', 'goal', 'description', 'exit_criteria',
    'pitch_points', 'objection_handlers', 'resources',
    'ai_sequence_id', 'ai_actions', 'ai_suggested_pitch_points',
    'ai_suggested_objections', 'ai_insights', 'avg_days_in_stage',
    'conversion_rate', 'exit_actions', 'sla_days', 'sla_warning_days',
    'is_terminal', 'terminal_type'
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Update slug if name changed
  if (updates.name && typeof updates.name === 'string') {
    updates.slug = updates.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  const { data: stage, error } = await supabase
    .from('product_process_stages')
    .update(updates)
    .eq('id', stageId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stage });
}

// DELETE - Delete stage (uses unified product_process_stages)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; stageId: string }> }
) {
  const supabase = await createClient();
  const { slug, stageId } = await params;

  // Get product ID from slug
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Verify stage belongs to this product
  const isOwned = await verifyStageOwnership(supabase, product.id, stageId);
  if (!isOwned) {
    return NextResponse.json({ error: 'Stage not found for this product' }, { status: 404 });
  }

  // Check if any companies are in this stage
  const { count } = await supabase
    .from('company_products')
    .select('*', { count: 'exact', head: true })
    .eq('current_stage_id', stageId);

  if (count && count > 0) {
    return NextResponse.json({
      error: `Cannot delete: ${count} companies are in this stage`
    }, { status: 400 });
  }

  const { error } = await supabase
    .from('product_process_stages')
    .delete()
    .eq('id', stageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
