import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  getStageNodesInConnectionOrder,
  validateStageRemoval,
  getOrCreateProductProcess,
  syncStagesToDatabase,
  updateWorkflowStatus,
} from '@/lib/workflow/publish';
import { ProcessType } from '@/lib/workflow/types';

// POST - Publish workflow to operational stages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productSlug: string; processType: string }> }
) {
  const { productSlug, processType } = await params;
  const supabase = await createClient();

  // Validate process type
  const validTypes: ProcessType[] = ['sales', 'onboarding', 'support', 'engagement'];
  if (!validTypes.includes(processType as ProcessType)) {
    return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
  }

  try {
    // 1. Get product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, slug')
      .eq('slug', productSlug)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. Get current workflow from processes table
    const { data: workflow, error: workflowError } = await supabase
      .from('processes')
      .select('id, name, status')
      .eq('product_id', product.id)
      .eq('process_type', processType)
      .in('status', ['draft', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'No workflow found. Create and save a workflow first.' },
        { status: 404 }
      );
    }

    // 3. Extract stage nodes and determine order via topological sort
    const stageNodes = await getStageNodesInConnectionOrder(workflow.id);

    if (stageNodes.length === 0) {
      return NextResponse.json(
        { error: 'Workflow has no stages. Add at least one stage before publishing.' },
        { status: 400 }
      );
    }

    // 4. Validate: check if any removed stages have companies
    const validation = await validateStageRemoval(
      product.id,
      processType as ProcessType,
      stageNodes
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Cannot remove stages that have companies',
          stagesWithCompanies: validation.stagesWithCompanies,
        },
        { status: 400 }
      );
    }

    // 5. Get or create product_processes record
    const { id: processId, isNew } = await getOrCreateProductProcess(
      product.id,
      processType as ProcessType
    );

    // 6. Sync stages to product_process_stages
    const { created, updated } = await syncStagesToDatabase(
      processId,
      workflow.id,
      stageNodes
    );

    // 7. Update workflow status to active
    await updateWorkflowStatus(workflow.id, 'active');

    // 8. Log publish event (optional - if event sourcing is set up)
    try {
      await supabase.from('event_store').insert({
        aggregate_type: 'ProductProcess',
        aggregate_id: processId,
        event_type: 'ProcessPublished',
        event_data: {
          productId: product.id,
          productSlug: product.slug,
          processType,
          stageCount: stageNodes.length,
          created,
          updated,
          publishedAt: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Event logging is optional, don't fail publish
      console.warn('Failed to log publish event');
    }

    return NextResponse.json({
      success: true,
      processId,
      stageCount: stageNodes.length,
      created,
      updated,
      isNew,
      message: `Published ${stageNodes.length} stages (${created} new, ${updated} updated)`,
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish workflow' },
      { status: 500 }
    );
  }
}

// GET - Check publish status / preview what will be published
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productSlug: string; processType: string }> }
) {
  const { productSlug, processType } = await params;
  const supabase = await createClient();

  // Validate process type
  const validTypes: ProcessType[] = ['sales', 'onboarding', 'support', 'engagement'];
  if (!validTypes.includes(processType as ProcessType)) {
    return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
  }

  try {
    // Get product
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('slug', productSlug)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get workflow
    const { data: workflow } = await supabase
      .from('processes')
      .select('id, name, status, updated_at, published_at')
      .eq('product_id', product.id)
      .eq('process_type', processType)
      .in('status', ['draft', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!workflow) {
      return NextResponse.json({ hasWorkflow: false });
    }

    // Get stage nodes in order
    const stageNodes = await getStageNodesInConnectionOrder(workflow.id);

    // Check for validation issues
    const validation = await validateStageRemoval(
      product.id,
      processType as ProcessType,
      stageNodes
    );

    // Get current published stages
    const { data: currentProcess } = await supabase
      .from('product_processes')
      .select('id')
      .eq('product_id', product.id)
      .eq('process_type', processType)
      .eq('status', 'published')
      .single();

    let currentStageCount = 0;
    if (currentProcess) {
      const { count } = await supabase
        .from('product_process_stages')
        .select('id', { count: 'exact', head: true })
        .eq('process_id', currentProcess.id);
      currentStageCount = count || 0;
    }

    return NextResponse.json({
      hasWorkflow: true,
      workflowStatus: workflow.status,
      workflowUpdatedAt: workflow.updated_at,
      lastPublishedAt: workflow.published_at,
      stages: stageNodes.map((s) => ({
        order: s.stage_order,
        name: s.label,
        icon: s.icon,
        color: s.color,
      })),
      stageCount: stageNodes.length,
      currentStageCount,
      validation,
    });
  } catch (error) {
    console.error('Publish preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get publish preview' },
      { status: 500 }
    );
  }
}
