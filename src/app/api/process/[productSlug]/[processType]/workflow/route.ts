import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface WorkflowNode {
  id: string;
  type: string;
  itemId: string;
  label: string;
  icon?: string;
  color?: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

interface WorkflowConnection {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  label?: string;
  color?: string;
  style: 'solid' | 'dashed';
}

interface WorkflowPayload {
  id?: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

// GET - Fetch workflow for a product/process type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productSlug: string; processType: string }> }
) {
  const { productSlug, processType } = await params;
  const supabase = await createClient();

  // Validate process type
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

  // Get workflow with nodes and connections
  const { data: workflow, error: workflowError } = await supabase
    .from('processes')
    .select(`
      id,
      name,
      status,
      canvas_zoom,
      canvas_pan_x,
      canvas_pan_y,
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
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (workflowError && workflowError.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is OK
    return NextResponse.json({ error: workflowError.message }, { status: 500 });
  }

  if (!workflow) {
    // No workflow exists yet
    return NextResponse.json({ workflow: null });
  }

  // Transform to our interface format
  const transformedWorkflow = {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    canvasState: {
      zoom: workflow.canvas_zoom || 1,
      pan: {
        x: workflow.canvas_pan_x || 0,
        y: workflow.canvas_pan_y || 0,
      },
    },
    nodes: (workflow.nodes as Array<Record<string, unknown>> || []).map((n) => ({
      id: n.id as string,
      type: n.type as string,
      itemId: n.item_id as string,
      label: n.label as string,
      icon: (n.icon as string) || '📋',
      color: (n.color as string) || '#3b82f6',
      position: { x: n.position_x as number, y: n.position_y as number },
      config: (n.config as Record<string, unknown>) || {},
    })),
    connections: (workflow.connections as Array<Record<string, unknown>> || []).map((c) => ({
      id: c.id as string,
      fromNodeId: c.from_node_id as string,
      fromPort: c.from_port as string,
      toNodeId: c.to_node_id as string,
      toPort: c.to_port as string,
      label: c.label as string | undefined,
      color: c.color as string | undefined,
      style: ((c.style as string) || 'solid') as 'solid' | 'dashed',
    })),
  };

  return NextResponse.json({ workflow: transformedWorkflow });
}

// POST - Save workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productSlug: string; processType: string }> }
) {
  const { productSlug, processType } = await params;
  const supabase = await createClient();
  const body = await request.json() as WorkflowPayload;
  const { id: workflowId, name, nodes, connections } = body;

  // Validate process type
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

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  let processId = workflowId;

  if (workflowId) {
    // Update existing workflow
    const { error: updateError } = await supabase
      .from('processes')
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Delete existing nodes and connections (cascade will handle connections)
    await supabase
      .from('process_nodes')
      .delete()
      .eq('process_id', workflowId);

  } else {
    // Create new workflow
    const { data: newProcess, error: createError } = await supabase
      .from('processes')
      .insert({
        product_id: product.id,
        process_type: processType,
        name: name || `${product.name} ${processType.charAt(0).toUpperCase() + processType.slice(1)} Workflow`,
        status: 'draft',
        created_by: user?.id,
      })
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    processId = newProcess.id;
  }

  // Create node ID mapping (client IDs -> server IDs)
  const nodeIdMap = new Map<string, string>();

  // Insert nodes
  if (nodes.length > 0) {
    const nodesToInsert = nodes.map((node, index) => ({
      process_id: processId,
      type: node.type,
      item_id: node.itemId,
      label: node.label,
      icon: node.icon,
      color: node.color,
      position_x: Math.round(node.position.x),
      position_y: Math.round(node.position.y),
      config: node.config,
      node_order: index,
    }));

    const { data: insertedNodes, error: nodesError } = await supabase
      .from('process_nodes')
      .insert(nodesToInsert)
      .select('id, item_id, node_order');

    if (nodesError) {
      return NextResponse.json({ error: nodesError.message }, { status: 500 });
    }

    // Build mapping from client node IDs to server node IDs
    // We use node_order to correlate since we inserted in the same order
    if (insertedNodes) {
      nodes.forEach((clientNode, index) => {
        const serverNode = insertedNodes.find((n) => n.node_order === index);
        if (serverNode) {
          nodeIdMap.set(clientNode.id, serverNode.id);
        }
      });
    }
  }

  // Insert connections (with mapped node IDs)
  if (connections.length > 0) {
    const connectionsToInsert = connections
      .filter((conn) => {
        // Only insert connections where both nodes exist
        return nodeIdMap.has(conn.fromNodeId) && nodeIdMap.has(conn.toNodeId);
      })
      .map((conn, index) => ({
        process_id: processId,
        from_node_id: nodeIdMap.get(conn.fromNodeId),
        from_port: conn.fromPort,
        to_node_id: nodeIdMap.get(conn.toNodeId),
        to_port: conn.toPort,
        label: conn.label,
        color: conn.color,
        style: conn.style,
        connection_order: index,
      }));

    if (connectionsToInsert.length > 0) {
      const { error: connectionsError } = await supabase
        .from('process_connections')
        .insert(connectionsToInsert);

      if (connectionsError) {
        return NextResponse.json({ error: connectionsError.message }, { status: 500 });
      }
    }
  }

  // Fetch the complete saved workflow to return
  const { data: savedWorkflow } = await supabase
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
    .eq('id', processId)
    .single();

  if (!savedWorkflow) {
    return NextResponse.json({ success: true, workflowId: processId });
  }

  // Transform for response
  const transformedWorkflow = {
    id: savedWorkflow.id,
    name: savedWorkflow.name,
    status: savedWorkflow.status,
    nodes: (savedWorkflow.nodes as Array<Record<string, unknown>> || []).map((n) => ({
      id: n.id as string,
      type: n.type as string,
      itemId: n.item_id as string,
      label: n.label as string,
      icon: (n.icon as string) || '📋',
      color: (n.color as string) || '#3b82f6',
      position: { x: n.position_x as number, y: n.position_y as number },
      config: (n.config as Record<string, unknown>) || {},
    })),
    connections: (savedWorkflow.connections as Array<Record<string, unknown>> || []).map((c) => ({
      id: c.id as string,
      fromNodeId: c.from_node_id as string,
      fromPort: c.from_port as string,
      toNodeId: c.to_node_id as string,
      toPort: c.to_port as string,
      label: c.label as string | undefined,
      color: c.color as string | undefined,
      style: ((c.style as string) || 'solid') as 'solid' | 'dashed',
    })),
  };

  return NextResponse.json({ success: true, workflow: transformedWorkflow });
}
