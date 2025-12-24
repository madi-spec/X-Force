import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get single stage
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

  const { data: stage, error } = await supabase
    .from('product_sales_stages')
    .select('*')
    .eq('id', stageId)
    .eq('product_id', product.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stage });
}

// PATCH - Update stage
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

  const allowedFields = [
    'name', 'goal', 'description', 'exit_criteria',
    'pitch_points', 'objection_handlers', 'resources',
    'ai_sequence_id', 'ai_actions'
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
    .from('product_sales_stages')
    .update(updates)
    .eq('id', stageId)
    .eq('product_id', product.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stage });
}

// DELETE - Delete stage
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
    .from('product_sales_stages')
    .delete()
    .eq('id', stageId)
    .eq('product_id', product.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
