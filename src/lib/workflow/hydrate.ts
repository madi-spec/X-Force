import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { ProcessType, WorkflowNode, WorkflowConnection, PROCESS_TYPE_CONFIG } from './types';

interface ProductProcessStage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  description?: string;
  goal?: string;
  exit_criteria?: Array<{ text: string }>;
  pitch_points?: Array<{ id: string; title: string; content: string; source?: string }>;
  objection_handlers?: Array<{ id: string; objection: string; response: string; source?: string }>;
  resources?: Array<{ id: string; title: string; url: string; type: string }>;
  sla_days?: number;
  sla_warning_days?: number;
  is_terminal?: boolean;
  terminal_type?: string;
  ai_actions?: Array<{ type: string; config?: Record<string, unknown> }>;
  icon?: string;
  color?: string;
}

interface HydratedWorkflow {
  id: null; // Not saved yet
  name: string;
  status: 'draft';
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

/**
 * Create a workflow from existing product_process_stages
 * Used when a user has published stages but no workflow exists
 */
export async function hydrateWorkflowFromStages(
  productId: string,
  processType: ProcessType
): Promise<HydratedWorkflow | null> {
  const supabase = await createClient();

  // Get the product_processes record
  const { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .single();

  if (!process) {
    return null;
  }

  // Get the stages
  const { data: stages } = await supabase
    .from('product_process_stages')
    .select('*')
    .eq('process_id', process.id)
    .order('stage_order', { ascending: true });

  if (!stages || stages.length === 0) {
    return null;
  }

  const processConfig = PROCESS_TYPE_CONFIG[processType];
  const nodes: WorkflowNode[] = [];
  const connections: WorkflowConnection[] = [];

  // Create trigger node
  const triggerId = `trigger_${Date.now()}`;
  const triggerNode: WorkflowNode = {
    id: triggerId,
    type: 'trigger',
    itemId: 'new-entity',
    label: `New ${processConfig.entityName.charAt(0).toUpperCase() + processConfig.entityName.slice(1)}`,
    icon: '⚡',
    color: '#f97316',
    position: { x: 100, y: 200 },
    config: {},
  };
  nodes.push(triggerNode);

  // Create stage nodes from database stages
  let prevNodeId = triggerId;
  const xStart = 300;
  const yStart = 200;
  const xGap = 250;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i] as ProductProcessStage;
    const stageId = `stage_${stage.id}`;

    // Extract AI automation config from ai_actions
    let aiAutomation = {
      enabled: false,
      followUpDays: 3,
      autoAnalyzeCalls: true,
    };

    if (stage.ai_actions && stage.ai_actions.length > 0) {
      const followUpAction = stage.ai_actions.find(a => a.type === 'follow_up');
      if (followUpAction && followUpAction.config) {
        aiAutomation = {
          enabled: true,
          followUpDays: (followUpAction.config.days as number) || 3,
          autoAnalyzeCalls: (followUpAction.config.autoAnalyzeCalls as boolean) ?? true,
        };
      }
    }

    const stageNode: WorkflowNode = {
      id: stageId,
      type: 'stage',
      itemId: stage.id,
      label: stage.name,
      icon: stage.icon || String(i + 1),
      color: stage.color || '#3b82f6',
      position: { x: xStart + i * xGap, y: yStart },
      config: {
        goal: stage.goal || '',
        exitCriteria: stage.exit_criteria?.[0]?.text || '',
        pitchPoints: stage.pitch_points || [],
        objectionHandlers: stage.objection_handlers || [],
        resources: stage.resources || [],
        slaDays: stage.sla_days || null,
        slaWarningDays: stage.sla_warning_days || null,
        isTerminal: stage.is_terminal || false,
        terminalType: stage.terminal_type || null,
        aiAutomation,
        description: stage.description || '',
      },
      entityCount: 0, // Will be populated when loaded
    };
    nodes.push(stageNode);

    // Connect to previous node
    const connectionId = `conn_${prevNodeId}_${stageId}`;
    connections.push({
      id: connectionId,
      fromNodeId: prevNodeId,
      fromPort: 'default',
      toNodeId: stageId,
      toPort: 'input',
      style: 'solid',
    });

    prevNodeId = stageId;
  }

  // Add exit nodes for terminal stages
  const terminalStages = stages.filter((s: ProductProcessStage) => s.is_terminal);
  for (let i = 0; i < terminalStages.length; i++) {
    const stage = terminalStages[i] as ProductProcessStage;
    const stageNodeId = `stage_${stage.id}`;
    const exitId = `exit_${stage.id}`;

    const exitColor = stage.terminal_type === 'won' ? '#10b981'
      : stage.terminal_type === 'lost' ? '#ef4444'
        : stage.terminal_type === 'churned' ? '#f97316'
          : '#6b7280';

    const exitNode: WorkflowNode = {
      id: exitId,
      type: 'exit',
      itemId: `exit-${stage.terminal_type || 'completed'}`,
      label: stage.terminal_type
        ? stage.terminal_type.charAt(0).toUpperCase() + stage.terminal_type.slice(1)
        : 'Completed',
      icon: '🏁',
      color: exitColor,
      position: {
        x: xStart + stages.length * xGap,
        y: yStart + i * 100,
      },
      config: {
        exitType: stage.terminal_type || 'completed',
      },
    };
    nodes.push(exitNode);

    // Connect stage to exit
    connections.push({
      id: `conn_${stageNodeId}_${exitId}`,
      fromNodeId: stageNodeId,
      fromPort: 'default',
      toNodeId: exitId,
      toPort: 'input',
      style: 'solid',
    });
  }

  return {
    id: null,
    name: `${processType.charAt(0).toUpperCase() + processType.slice(1)} Workflow`,
    status: 'draft',
    nodes,
    connections,
  };
}

/**
 * Check if we need to hydrate from existing stages
 */
export async function shouldHydrateFromStages(
  productId: string,
  processType: ProcessType
): Promise<boolean> {
  const supabase = await createClient();

  // Check if workflow exists
  const { data: workflow } = await supabase
    .from('processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', processType)
    .in('status', ['draft', 'active'])
    .limit(1)
    .single();

  if (workflow) {
    return false;
  }

  // Check if stages exist
  const { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .single();

  if (!process) {
    return false;
  }

  const { count } = await supabase
    .from('product_process_stages')
    .select('id', { count: 'exact', head: true })
    .eq('process_id', process.id);

  return (count || 0) > 0;
}
