import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List stages for a product
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

  const { data: stages, error } = await supabase
    .from('product_sales_stages')
    .select('*')
    .eq('product_id', product.id)
    .order('stage_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stages });
}

// POST - Create new stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await params;
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

  const { name, goal, exit_criteria, description, stage_order } = body;

  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  // Generate slug from name
  const stageSlug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: stage, error } = await supabase
    .from('product_sales_stages')
    .insert({
      product_id: product.id,
      name,
      slug: stageSlug,
      goal,
      description,
      exit_criteria,
      stage_order: stage_order || 1,
      pitch_points: [],
      objection_handlers: [],
      resources: [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stage }, { status: 201 });
}
