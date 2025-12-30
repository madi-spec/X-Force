import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface ProcessStage {
  id: string;
  name: string;
  description: string;
  order: number;
  config: Record<string, unknown>;
  isNew?: boolean;
}

// GET - Fetch process stages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productSlug: string; processType: string }> }
) {
  const { productSlug, processType } = await params;
  const supabase = await createClient();

  // Get product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name')
    .eq('slug', productSlug)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Get or create process
  let { data: process, error: processError } = await supabase
    .from('product_processes')
    .select('id, name, version, status')
    .eq('product_id', product.id)
    .eq('process_type', processType)
    .eq('status', 'published')
    .single();

  if (!process) {
    // Check for draft
    const { data: draft } = await supabase
      .from('product_processes')
      .select('id, name, version, status')
      .eq('product_id', product.id)
      .eq('process_type', processType)
      .eq('status', 'draft')
      .single();

    process = draft;
  }

  if (!process) {
    // No process exists yet
    return NextResponse.json({ stages: [] });
  }

  // Get stages
  const { data: stages, error: stagesError } = await supabase
    .from('product_process_stages')
    .select('id, name, description, stage_order, sla_days, sla_warning_days, is_terminal')
    .eq('process_id', process.id)
    .order('stage_order');

  if (stagesError) {
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  // Transform to our format
  const transformedStages: ProcessStage[] = (stages || []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description || '',
    order: s.stage_order,
    config: {
      sla_days: s.sla_days,
      sla_warning_days: s.sla_warning_days,
      is_terminal: s.is_terminal,
    },
  }));

  return NextResponse.json({ stages: transformedStages, process });
}

// POST - Save process stages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productSlug: string; processType: string }> }
) {
  const { productSlug, processType } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { stages } = body as { stages: ProcessStage[] };

  // Validate process type
  const validTypes = ['onboarding', 'support', 'engagement'];
  if (!validTypes.includes(processType)) {
    return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
  }

  // Get product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name')
    .eq('slug', productSlug)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Get or create process
  let { data: process } = await supabase
    .from('product_processes')
    .select('id, version')
    .eq('product_id', product.id)
    .eq('process_type', processType)
    .in('status', ['published', 'draft'])
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (!process) {
    // Create new process
    const { data: newProcess, error: createError } = await supabase
      .from('product_processes')
      .insert({
        product_id: product.id,
        process_type: processType,
        name: `${product.name} ${processType.charAt(0).toUpperCase() + processType.slice(1)} Process`,
        version: 1,
        status: 'published',
        config: {},
      })
      .select('id, version')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    process = newProcess;
  }

  // Delete existing stages for this process
  await supabase
    .from('product_process_stages')
    .delete()
    .eq('process_id', process.id);

  // Insert new stages
  const stagesToInsert = stages.map((stage, index) => ({
    process_id: process.id,
    name: stage.name,
    slug: stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: stage.description,
    stage_order: index + 1,
    sla_days: (stage.config.sla_days as number) || (stage.config.target_days as number) || null,
    sla_warning_days: (stage.config.sla_warning_days as number) || null,
    is_terminal: index === stages.length - 1,
  }));

  const { data: insertedStages, error: insertError } = await supabase
    .from('product_process_stages')
    .insert(stagesToInsert)
    .select('id, name, description, stage_order');

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Transform back to our format with real IDs
  const savedStages: ProcessStage[] = (insertedStages || []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description || '',
    order: s.stage_order,
    config: stages.find((orig) => orig.name === s.name)?.config || {},
  }));

  return NextResponse.json({ stages: savedStages, success: true });
}
