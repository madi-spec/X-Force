import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface ProcessStage {
  id: string;
  name: string;
  slug?: string;
  description: string;
  order: number;
  goal?: string;
  config: Record<string, unknown>;
  isNew?: boolean;
  // Sales-specific fields
  pitch_points?: unknown[];
  objection_handlers?: unknown[];
  resources?: unknown[];
  ai_suggested_pitch_points?: unknown[];
  ai_suggested_objections?: unknown[];
  ai_insights?: Record<string, unknown>;
  avg_days_in_stage?: number;
  conversion_rate?: number;
  ai_sequence_id?: string;
  ai_actions?: unknown[];
  exit_criteria?: string;
  exit_actions?: unknown;
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

  // Get stages with all fields
  const { data: stages, error: stagesError } = await supabase
    .from('product_process_stages')
    .select(`
      id, name, slug, description, stage_order, goal,
      sla_days, sla_warning_days, is_terminal, terminal_type,
      pitch_points, objection_handlers, resources,
      ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
      avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
      exit_actions
    `)
    .eq('process_id', process.id)
    .order('stage_order');

  if (stagesError) {
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  // Transform to our format, including sales-specific fields
  const transformedStages: ProcessStage[] = (stages || []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description || '',
    order: s.stage_order,
    goal: s.goal,
    config: {
      sla_days: s.sla_days,
      sla_warning_days: s.sla_warning_days,
      is_terminal: s.is_terminal,
      terminal_type: s.terminal_type,
    },
    // Sales-specific fields
    pitch_points: s.pitch_points || [],
    objection_handlers: s.objection_handlers || [],
    resources: s.resources || [],
    ai_suggested_pitch_points: s.ai_suggested_pitch_points || [],
    ai_suggested_objections: s.ai_suggested_objections || [],
    ai_insights: s.ai_insights || {},
    avg_days_in_stage: s.avg_days_in_stage,
    conversion_rate: s.conversion_rate,
    ai_sequence_id: s.ai_sequence_id,
    ai_actions: s.ai_actions || [],
    exit_actions: s.exit_actions,
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

  // Validate process type (now includes 'sales')
  const validTypes = ['sales', 'onboarding', 'support', 'engagement'];
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

  // Insert new stages with all fields
  const stagesToInsert = stages.map((stage, index) => ({
    process_id: process.id,
    name: stage.name,
    slug: stage.slug || stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: stage.description,
    goal: stage.goal || null,
    stage_order: index + 1,
    sla_days: (stage.config?.sla_days as number) || (stage.config?.target_days as number) || null,
    sla_warning_days: (stage.config?.sla_warning_days as number) || null,
    is_terminal: stage.config?.is_terminal ?? (index === stages.length - 1),
    terminal_type: (stage.config?.terminal_type as string) || null,
    // Sales-specific fields
    pitch_points: stage.pitch_points || [],
    objection_handlers: stage.objection_handlers || [],
    resources: stage.resources || [],
    ai_suggested_pitch_points: stage.ai_suggested_pitch_points || [],
    ai_suggested_objections: stage.ai_suggested_objections || [],
    ai_insights: stage.ai_insights || {},
    avg_days_in_stage: stage.avg_days_in_stage || null,
    conversion_rate: stage.conversion_rate || null,
    ai_sequence_id: stage.ai_sequence_id || null,
    ai_actions: stage.ai_actions || [],
    exit_actions: stage.exit_actions || null,
  }));

  const { data: insertedStages, error: insertError } = await supabase
    .from('product_process_stages')
    .insert(stagesToInsert)
    .select(`
      id, name, slug, description, stage_order, goal,
      sla_days, sla_warning_days, is_terminal, terminal_type,
      pitch_points, objection_handlers, resources,
      ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
      avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
      exit_actions
    `);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Transform back to our format with real IDs and all fields
  const savedStages: ProcessStage[] = (insertedStages || []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description || '',
    order: s.stage_order,
    goal: s.goal,
    config: {
      sla_days: s.sla_days,
      sla_warning_days: s.sla_warning_days,
      is_terminal: s.is_terminal,
      terminal_type: s.terminal_type,
    },
    pitch_points: s.pitch_points || [],
    objection_handlers: s.objection_handlers || [],
    resources: s.resources || [],
    ai_suggested_pitch_points: s.ai_suggested_pitch_points || [],
    ai_suggested_objections: s.ai_suggested_objections || [],
    ai_insights: s.ai_insights || {},
    avg_days_in_stage: s.avg_days_in_stage,
    conversion_rate: s.conversion_rate,
    ai_sequence_id: s.ai_sequence_id,
    ai_actions: s.ai_actions || [],
    exit_actions: s.exit_actions,
  }));

  return NextResponse.json({ stages: savedStages, success: true });
}
