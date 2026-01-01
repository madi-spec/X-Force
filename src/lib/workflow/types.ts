/**
 * Workflow Builder Types
 *
 * Types for the visual workflow builder that supports:
 * - Sales Process (deals)
 * - Onboarding Milestones (customers)
 * - Support Playbooks (tickets)
 * - Engagement Plays (accounts)
 */

export type ProcessType = 'sales' | 'onboarding' | 'support' | 'engagement';

export type NodeType = 'trigger' | 'stage' | 'condition' | 'aiAction' | 'humanAction' | 'exit';

// Node category styling
export interface NodeCategory {
  type: NodeType;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

export const NODE_CATEGORIES: Record<NodeType, NodeCategory> = {
  trigger: {
    type: 'trigger',
    label: 'Triggers',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.12)',
    icon: '⚡',
  },
  stage: {
    type: 'stage',
    label: 'Stages',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    icon: '📋',
  },
  condition: {
    type: 'condition',
    label: 'Conditions',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.12)',
    icon: '🔀',
  },
  aiAction: {
    type: 'aiAction',
    label: 'AI Actions',
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.12)',
    icon: '✨',
  },
  humanAction: {
    type: 'humanAction',
    label: 'Human Actions',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    icon: '👤',
  },
  exit: {
    type: 'exit',
    label: 'Exits',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    icon: '🏁',
  },
};

// Node template item (for toolbox)
export interface NodeItem {
  id: string;
  label: string;
  icon: string;
  description?: string;
  color?: string; // Override category color (for exits)
  isCustom?: boolean; // True for user-created custom nodes
  companyCount?: number; // Number of companies in this stage (for dynamic stages)
}

// Canvas node instance
export interface WorkflowNode {
  id: string;
  type: NodeType;
  itemId: string; // Reference to node template
  label: string;
  icon: string;
  color: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  // Runtime data
  entityCount?: number;
  avgTimeInStage?: number;
}

// Connection between nodes
export interface WorkflowConnection {
  id: string;
  fromNodeId: string;
  fromPort: string; // 'default' or branch id for conditions
  toNodeId: string;
  toPort: string; // Usually 'input'
  label?: string;
  color?: string;
  style: 'solid' | 'dashed';
}

// Workflow (Process) data model
export interface Workflow {
  id: string;
  productId: string;
  processType: ProcessType;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  settings: WorkflowSettings;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface WorkflowSettings {
  allowMultiplePaths: boolean;
  autoAdvance: boolean;
  notifications: {
    onStageChange: boolean;
    onCompletion: boolean;
    onSlaWarning: boolean;
  };
}

// Process type configuration
export interface ProcessTypeConfig {
  type: ProcessType;
  label: string;
  description: string;
  entityName: string;
  entityNamePlural: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const PROCESS_TYPE_CONFIG: Record<ProcessType, ProcessTypeConfig> = {
  sales: {
    type: 'sales',
    label: 'Sales Process',
    description: 'Convert leads to customers',
    entityName: 'deal',
    entityNamePlural: 'deals',
    icon: '🎯',
    color: '#f97316',
    bgColor: 'bg-orange-50',
  },
  onboarding: {
    type: 'onboarding',
    label: 'Onboarding Milestones',
    description: 'Activate new customers',
    entityName: 'customer',
    entityNamePlural: 'customers',
    icon: '🚀',
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
  },
  support: {
    type: 'support',
    label: 'Support Playbooks',
    description: 'Resolve issues efficiently',
    entityName: 'ticket',
    entityNamePlural: 'tickets',
    icon: '🎫',
    color: '#ef4444',
    bgColor: 'bg-red-50',
  },
  engagement: {
    type: 'engagement',
    label: 'Engagement Plays',
    description: 'Retain and expand customers',
    entityName: 'account',
    entityNamePlural: 'accounts',
    icon: '💜',
    color: '#a855f7',
    bgColor: 'bg-purple-50',
  },
};

// Stage configuration
export interface StageConfig {
  goal: string;
  exitCriteria: string;
  aiAutomation: {
    enabled: boolean;
    followUpDays: number;
    autoAnalyzeCalls: boolean;
  };
  pitchPoints: Array<{ id: string; title: string; content: string }>;
  objectionHandlers: Array<{ id: string; objection: string; response: string }>;
  resources: Array<{ id: string; title: string; url: string; type: string }>;
}

// Condition configuration
export interface ConditionConfig {
  logic: 'AND' | 'OR';
  rules: Array<{
    id: string;
    field: string;
    operator: string;
    value: unknown;
  }>;
  outputs: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}

// AI Action configuration
export interface AIActionConfig {
  enabled: boolean;
  actionType: string;
  [key: string]: unknown;
}

// Human Action configuration
export interface HumanActionConfig {
  taskType: string;
  assignTo: string;
  dueIn: { value: number; unit: 'hours' | 'days' };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  notifications: {
    email: boolean;
    inApp: boolean;
    slack: boolean;
  };
}

// Exit configuration
export interface ExitConfig {
  exitType: 'won' | 'lost' | 'disqualified' | 'nurture' | 'custom';
  celebrationNotification?: boolean;
  requireReason?: boolean;
  reasons?: string[];
  winBackDays?: number;
}

// Canvas state
export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
}
