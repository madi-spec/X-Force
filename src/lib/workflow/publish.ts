import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProcessType } from './types';

interface ProcessNode {
  id: string;
  type: string;
  item_id: string;
  label: string;
  icon?: string;
  color?: string;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
  stage_id?: string;
}

interface ProcessConnection {
  id: string;
  from_node_id: string;
  to_node_id: string;
  from_port: string;
  to_port: string;
}

interface StageNodeWithOrder extends ProcessNode {
  stage_order: number;
}

/**
 * Get all stage nodes from a workflow, ordered by connection path from trigger
 */
export async function getStageNodesInConnectionOrder(workflowId: string): Promise<StageNodeWithOrder[]> {
  const supabase = await createClient();

  // Get all nodes
  const { data: nodes, error: nodesError } = await supabase
    .from('process_nodes')
    .select('id, type, item_id, label, icon, color, position_x, position_y, config, stage_id')
    .eq('process_id', workflowId);

  if (nodesError || !nodes) {
    throw new Error(`Failed to fetch nodes: ${nodesError?.message}`);
  }

  // Get all connections
  const { data: connections, error: connError } = await supabase
    .from('process_connections')
    .select('id, from_node_id, to_node_id, from_port, to_port')
    .eq('process_id', workflowId);

  if (connError) {
    throw new Error(`Failed to fetch connections: ${connError.message}`);
  }

  // Find trigger node (entry point)
  const trigger = nodes.find(n => n.type === 'trigger');
  if (!trigger) {
    // No trigger - fall back to position-based ordering
    return nodes
      .filter(n => n.type === 'stage')
      .sort((a, b) => a.position_x - b.position_x)
      .map((node, index) => ({ ...node, stage_order: index + 1 }));
  }

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  (connections || []).forEach(conn => {
    const existing = adjacency.get(conn.from_node_id) || [];
    existing.push(conn.to_node_id);
    adjacency.set(conn.from_node_id, existing);
  });

  // BFS from trigger to collect stages in order
  const orderedStages: ProcessNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [trigger.id];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === 'stage') {
      orderedStages.push(node);
    }

    // Add connected nodes to queue
    const nextNodeIds = adjacency.get(nodeId) || [];
    for (const nextId of nextNodeIds) {
      if (!visited.has(nextId)) {
        queue.push(nextId);
      }
    }
  }

  // Assign stage_order
  return orderedStages.map((stage, index) => ({
    ...stage,
    stage_order: index + 1,
  }));
}

/**
 * Generate a URL-safe slug from a stage name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate that no stages being removed have companies in them
 */
export async function validateStageRemoval(
  productId: string,
  processType: ProcessType,
  newStageNodes: StageNodeWithOrder[]
): Promise<{ valid: boolean; stagesWithCompanies?: { name: string; count: number }[] }> {
  // Use admin client to read from protected tables
  const supabase = createAdminClient();

  // Get the current product_processes record
  const { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .single();

  if (!process) {
    // No published process yet, nothing to validate
    return { valid: true };
  }

  // Get current stages
  const { data: currentStages } = await supabase
    .from('product_process_stages')
    .select('id, name, slug')
    .eq('process_id', process.id);

  if (!currentStages || currentStages.length === 0) {
    return { valid: true };
  }

  // Build sets of identifiers from new stage nodes
  // Match by: slug, stage_id (from node config), or item_id (for hydrated nodes)
  const newStageSlugs = new Set(newStageNodes.map(n => generateSlug(n.label)));
  const newStageIds = new Set(
    newStageNodes
      .map(n => n.stage_id || n.item_id)
      .filter((id): id is string => !!id && !id.startsWith('stage_'))
  );

  // Find stages being removed (not matched by slug OR by ID)
  const removedStages = currentStages.filter(s =>
    !newStageSlugs.has(s.slug) && !newStageIds.has(s.id)
  );

  if (removedStages.length === 0) {
    return { valid: true };
  }

  // Check if any removed stages have companies
  const { data: companyCounts } = await supabase
    .from('company_products')
    .select('current_stage_id')
    .in('current_stage_id', removedStages.map(s => s.id));

  if (!companyCounts || companyCounts.length === 0) {
    return { valid: true };
  }

  // Count companies per stage
  const countByStageId = new Map<string, number>();
  companyCounts.forEach(c => {
    if (c.current_stage_id) {
      countByStageId.set(c.current_stage_id, (countByStageId.get(c.current_stage_id) || 0) + 1);
    }
  });

  const stagesWithCompanies = removedStages
    .filter(s => countByStageId.has(s.id))
    .map(s => ({ name: s.name, count: countByStageId.get(s.id) || 0 }));

  if (stagesWithCompanies.length > 0) {
    return { valid: false, stagesWithCompanies };
  }

  return { valid: true };
}

/**
 * Get or create the product_processes record for a product/process type
 */
export async function getOrCreateProductProcess(
  productId: string,
  processType: ProcessType
): Promise<{ id: string; isNew: boolean }> {
  // Use admin client to bypass RLS for write operations
  const supabase = createAdminClient();

  // Try to get existing
  const { data: existing } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .single();

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  // Create new
  const { data: newProcess, error } = await supabase
    .from('product_processes')
    .insert({
      product_id: productId,
      process_type: processType,
      name: `${processType.charAt(0).toUpperCase() + processType.slice(1)} Process`,
      status: 'published',
      version: 1,
    })
    .select('id')
    .single();

  if (error || !newProcess) {
    throw new Error(`Failed to create product_processes: ${error?.message}`);
  }

  return { id: newProcess.id, isNew: true };
}

/**
 * Sync stage nodes from workflow builder to product_process_stages table
 */
export async function syncStagesToDatabase(
  processId: string,
  workflowId: string,
  stageNodes: StageNodeWithOrder[]
): Promise<{ created: number; updated: number }> {
  // Use admin client to bypass RLS for write operations
  const supabase = createAdminClient();

  // Get existing stages
  const { data: existingStages } = await supabase
    .from('product_process_stages')
    .select('id, name, slug')
    .eq('process_id', processId);

  // Build lookup maps for matching
  const existingBySlug = new Map(existingStages?.map(s => [s.slug, s]) || []);
  const existingById = new Map(existingStages?.map(s => [s.id, s]) || []);

  // First pass: identify which existing stages will be matched
  const matchedStageIds = new Set<string>();
  for (const node of stageNodes) {
    const slug = generateSlug(node.label);
    let existing = node.stage_id ? existingById.get(node.stage_id) : null;
    if (!existing && node.item_id && !node.item_id.startsWith('stage_')) {
      existing = existingById.get(node.item_id);
    }
    if (!existing) {
      existing = existingBySlug.get(slug);
    }
    if (existing) {
      matchedStageIds.add(existing.id);
    }
  }

  // Delete unmatched stages (they have no companies - validation already checked)
  const unmatchedStages = existingStages?.filter(s => !matchedStageIds.has(s.id)) || [];
  if (unmatchedStages.length > 0) {
    await supabase
      .from('product_process_stages')
      .delete()
      .in('id', unmatchedStages.map(s => s.id));
  }

  // Clear all stage_orders first to avoid unique constraint conflicts during updates
  // Use unique negative numbers based on index
  if (matchedStageIds.size > 0) {
    const stageIdArray = Array.from(matchedStageIds);
    for (let i = 0; i < stageIdArray.length; i++) {
      await supabase
        .from('product_process_stages')
        .update({ stage_order: -(i + 1000) })
        .eq('id', stageIdArray[i]);
    }
  }

  let created = 0;
  let updated = 0;

  for (const node of stageNodes) {
    const slug = generateSlug(node.label);

    // Try to find existing stage by multiple methods:
    // 1. By stage_id if node was previously linked
    // 2. By item_id if node was hydrated from database (item_id = stage UUID)
    // 3. By slug as fallback
    let existing = node.stage_id ? existingById.get(node.stage_id) : null;
    if (!existing && node.item_id && !node.item_id.startsWith('stage_')) {
      existing = existingById.get(node.item_id);
    }
    if (!existing) {
      existing = existingBySlug.get(slug);
    }
    // Skip if this stage was deleted as unmatched
    if (existing && !matchedStageIds.has(existing.id)) {
      existing = null;
    }
    const config = node.config || {};
    const aiAutomation = config.aiAutomation as { enabled?: boolean; followUpDays?: number; autoAnalyzeCalls?: boolean } | undefined;

    const stageData = {
      process_id: processId,
      name: node.label,
      slug: slug,
      stage_order: node.stage_order,
      description: config.description as string || null,
      goal: config.goal as string || null,
      exit_criteria: config.exitCriteria ? [{ text: config.exitCriteria }] : [],
      pitch_points: config.pitchPoints || [],
      objection_handlers: config.objectionHandlers || [],
      resources: config.resources || [],
      sla_days: config.slaDays as number || null,
      sla_warning_days: config.slaWarningDays as number || null,
      is_terminal: config.isTerminal as boolean || false,
      terminal_type: config.terminalType as string || null,
      ai_actions: aiAutomation?.enabled ? [{
        type: 'follow_up',
        config: {
          days: aiAutomation.followUpDays,
          autoAnalyzeCalls: aiAutomation.autoAnalyzeCalls,
        },
      }] : [],
      icon: node.icon,
      color: node.color,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing stage (preserves ID for company_products FK)
      const { error } = await supabase
        .from('product_process_stages')
        .update(stageData)
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Failed to update stage ${node.label}: ${error.message}`);
      }

      // Link process_node to stage
      await supabase
        .from('process_nodes')
        .update({ stage_id: existing.id })
        .eq('id', node.id);

      updated++;
    } else {
      // Insert new stage
      const { data: newStage, error } = await supabase
        .from('product_process_stages')
        .insert({
          ...stageData,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !newStage) {
        throw new Error(`Failed to create stage ${node.label}: ${error?.message}`);
      }

      // Link process_node to new stage
      await supabase
        .from('process_nodes')
        .update({ stage_id: newStage.id })
        .eq('id', node.id);

      created++;
    }
  }

  return { created, updated };
}

/**
 * Update workflow status after publishing
 */
export async function updateWorkflowStatus(
  workflowId: string,
  status: 'draft' | 'active' | 'archived'
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'active') {
    updates.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('processes')
    .update(updates)
    .eq('id', workflowId);

  if (error) {
    throw new Error(`Failed to update workflow status: ${error.message}`);
  }
}
