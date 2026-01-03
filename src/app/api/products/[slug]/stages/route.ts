import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStagesByProductId } from '@/lib/process/queries';

// GET - List stages for a product (uses unified product_process_stages)
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

  // Use unified query helper to get stages from product_process_stages
  const stages = await getStagesByProductId(supabase, product.id, 'sales');

  return NextResponse.json({ stages });
}

// POST - Create new stage (uses unified product_process_stages)
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

  // Get or create product_processes entry for sales
  let { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', product.id)
    .eq('process_type', 'sales')
    .eq('status', 'published')
    .single();

  if (!process) {
    const { data: newProcess, error: createError } = await supabase
      .from('product_processes')
      .insert({
        product_id: product.id,
        process_type: 'sales',
        name: 'Sales Process',
        status: 'published',
        version: 1,
      })
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    process = newProcess;
  }

  // Generate slug from name
  const stageSlug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Insert into unified product_process_stages table
  const { data: stage, error } = await supabase
    .from('product_process_stages')
    .insert({
      process_id: process.id,
      name,
      slug: stageSlug,
      goal,
      description,
      stage_order: stage_order || 1,
      pitch_points: [],
      objection_handlers: [],
      resources: [],
      ai_suggested_pitch_points: [],
      ai_suggested_objections: [],
      ai_insights: {},
      ai_actions: [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stage }, { status: 201 });
}
