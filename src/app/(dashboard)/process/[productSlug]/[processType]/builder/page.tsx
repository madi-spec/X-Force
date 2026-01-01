import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkflowBuilder } from '@/components/workflow';
import { ProcessType } from '@/lib/workflow';
import { hydrateWorkflowFromStages } from '@/lib/workflow/hydrate';

interface BuilderPageProps {
  params: Promise<{
    productSlug: string;
    processType: string;
  }>;
}

const VALID_PROCESS_TYPES: ProcessType[] = ['sales', 'onboarding', 'support', 'engagement'];

export default async function WorkflowBuilderPage({ params }: BuilderPageProps) {
  const { productSlug, processType } = await params;

  // Validate process type
  if (!VALID_PROCESS_TYPES.includes(processType as ProcessType)) {
    notFound();
  }

  const supabase = await createClient();

  // Fetch product by slug
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, slug, color')
    .eq('slug', productSlug)
    .single();

  if (productError || !product) {
    notFound();
  }

  // Fetch existing workflow if any
  const { data: workflow } = await supabase
    .from('processes')
    .select(`
      id,
      name,
      status,
      nodes:process_nodes(
        id,
        type,
        item_id,
        label,
        icon,
        color,
        position_x,
        position_y,
        config
      ),
      connections:process_connections(
        id,
        from_node_id,
        from_port,
        to_node_id,
        to_port,
        label,
        color,
        style
      )
    `)
    .eq('product_id', product.id)
    .eq('process_type', processType)
    .single();

  // Transform nodes to match our interface
  let transformedWorkflow = workflow ? {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status as 'draft' | 'active' | 'archived',
    nodes: (workflow.nodes || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      itemId: n.item_id,
      label: n.label,
      icon: n.icon || '📋',
      color: n.color || '#3b82f6',
      position: { x: n.position_x, y: n.position_y },
      config: n.config || {},
    })),
    connections: (workflow.connections || []).map((c: any) => ({
      id: c.id,
      fromNodeId: c.from_node_id,
      fromPort: c.from_port,
      toNodeId: c.to_node_id,
      toPort: c.to_port,
      label: c.label,
      color: c.color,
      style: (c.style || 'solid') as 'solid' | 'dashed',
    })),
  } : undefined;

  // If no workflow exists, try to hydrate from existing stages
  if (!transformedWorkflow) {
    const hydratedWorkflow = await hydrateWorkflowFromStages(
      product.id,
      processType as ProcessType
    );

    if (hydratedWorkflow) {
      transformedWorkflow = {
        id: hydratedWorkflow.id as unknown as string, // Will be null, handled by context
        name: hydratedWorkflow.name,
        status: hydratedWorkflow.status,
        nodes: hydratedWorkflow.nodes.map(n => ({
          id: n.id,
          type: n.type,
          itemId: n.itemId,
          label: n.label,
          icon: n.icon || '📋',
          color: n.color || '#3b82f6',
          position: n.position,
          config: n.config || {},
        })),
        connections: hydratedWorkflow.connections.map(c => ({
          id: c.id,
          fromNodeId: c.fromNodeId,
          fromPort: c.fromPort,
          toNodeId: c.toNodeId,
          toPort: c.toPort,
          label: c.label,
          color: c.color,
          style: c.style as 'solid' | 'dashed',
        })),
      };
    }
  }

  return (
    <WorkflowBuilder
      productId={product.id}
      productName={product.name}
      productSlug={product.slug}
      processType={processType as ProcessType}
      initialWorkflow={transformedWorkflow}
    />
  );
}
