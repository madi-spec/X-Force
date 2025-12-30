import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkflowBuilder } from '@/components/workflow';
import { ProcessType } from '@/lib/workflow';

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
  const transformedWorkflow = workflow ? {
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
