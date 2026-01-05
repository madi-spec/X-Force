'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  AI_FLOW_GROUPS,
  FlowGroup,
  FlowNode,
  FlowConnection,
  FLOW_COLORS,
  CATEGORY_COLORS,
  FlowNodeType,
  FlowCategory,
  getFlowStats,
  getCategoryCounts,
} from '@/lib/ai/promptFlowConfig';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Activity,
  Zap,
  Brain,
  MessageSquare,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface AIPromptFlowViewProps {
  onPromptSelect?: (promptKey: string) => void;
  selectedPromptKey?: string | null;
  promptStats?: Record<string, {
    callsLast24h: number;
    avgLatencyMs: number;
    errorRate: number;
    lastCalledAt: string | null;
  }>;
}

interface NodePosition {
  x: number;
  y: number;
}

const LAYOUT = {
  nodeWidth: 160,
  nodeHeight: 60,
  horizontalSpacing: 80,
  verticalSpacing: 30,
  groupPadding: 20,
  columnWidths: {
    trigger: 0,
    worker: 260,
    condition: 520,
    prompt: 520,
    output: 780,
  },
};

const CATEGORY_CONFIG: Record<FlowCategory, { label: string; icon: React.ReactNode; description: string }> = {
  autopilot: { label: 'Autopilot', icon: <Zap className="w-4 h-4" />, description: 'Automated background processes' },
  intelligence: { label: 'Intelligence', icon: <Brain className="w-4 h-4" />, description: 'Analysis and insights' },
  communication: { label: 'Communication', icon: <MessageSquare className="w-4 h-4" />, description: 'Email and message handling' },
  lifecycle: { label: 'Lifecycle', icon: <RefreshCw className="w-4 h-4" />, description: 'Deal and customer lifecycle' },
  realtime: { label: 'Real-time', icon: <Clock className="w-4 h-4" />, description: 'User-triggered interactions' },
};

function getNodeTypeColumn(type: FlowNodeType): number {
  return LAYOUT.columnWidths[type] || 0;
}

function calculateGroupLayout(group: FlowGroup) {
  const positions = new Map<string, NodePosition>();
  const nodesByType: Record<FlowNodeType, FlowNode[]> = { trigger: [], worker: [], condition: [], prompt: [], output: [] };

  for (const node of group.nodes) {
    nodesByType[node.type].push(node);
  }

  let maxHeight = 0;
  for (const type of ['trigger', 'worker', 'condition', 'prompt', 'output'] as FlowNodeType[]) {
    const nodes = nodesByType[type];
    const x = getNodeTypeColumn(type) + LAYOUT.groupPadding;
    nodes.forEach((node, index) => {
      const y = LAYOUT.groupPadding + index * (LAYOUT.nodeHeight + LAYOUT.verticalSpacing);
      positions.set(node.id, { x, y });
      maxHeight = Math.max(maxHeight, y + LAYOUT.nodeHeight);
    });
  }

  return {
    positions,
    width: LAYOUT.columnWidths.output + LAYOUT.nodeWidth + LAYOUT.groupPadding * 2,
    height: maxHeight + LAYOUT.groupPadding,
  };
}

function generateBezierPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = (fromX + toX) / 2;
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

function FlowNodeComponent({
  node,
  position,
  isSelected,
  isHighlighted,
  onClick,
  stats,
}: {
  node: FlowNode;
  position: NodePosition;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  stats?: { callsLast24h: number; avgLatencyMs: number; errorRate: number };
}) {
  const isPrompt = node.type === 'prompt';

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      onClick={onClick}
      className={cn('cursor-pointer transition-opacity', !isHighlighted && 'opacity-40')}
    >
      <rect
        width={LAYOUT.nodeWidth}
        height={LAYOUT.nodeHeight}
        rx={8}
        fill={isSelected ? node.color : 'white'}
        stroke={node.color}
        strokeWidth={isSelected ? 2 : 1.5}
      />
      <circle cx={20} cy={LAYOUT.nodeHeight / 2} r={12} fill={isSelected ? 'white' : `${node.color}20`} />
      <text x={20} y={LAYOUT.nodeHeight / 2} textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {node.icon}
      </text>
      <text x={40} y={LAYOUT.nodeHeight / 2 - 6} fontSize={11} fontWeight={500} fill={isSelected ? 'white' : '#374151'} className="select-none">
        {node.label.length > 14 ? node.label.slice(0, 14) + '...' : node.label}
      </text>
      <text x={40} y={LAYOUT.nodeHeight / 2 + 10} fontSize={9} fill={isSelected ? 'rgba(255,255,255,0.8)' : '#9ca3af'} className="select-none">
        {node.type.charAt(0).toUpperCase() + node.type.slice(1)}
      </text>
      {isPrompt && stats && stats.callsLast24h > 0 && (
        <g transform={`translate(${LAYOUT.nodeWidth - 30}, -8)`}>
          <rect width={28} height={16} rx={8} fill={stats.errorRate > 0.1 ? FLOW_COLORS.error : '#10b981'} />
          <text x={14} y={11} textAnchor="middle" fontSize={8} fill="white" fontWeight={600}>{stats.callsLast24h}</text>
        </g>
      )}
      {isPrompt && <circle cx={LAYOUT.nodeWidth - 8} cy={LAYOUT.nodeHeight / 2} r={4} fill={node.color} className="animate-pulse" />}
    </g>
  );
}

function FlowConnectionComponent({
  connection,
  fromPos,
  toPos,
  isHighlighted,
}: {
  connection: FlowConnection;
  fromPos: NodePosition;
  toPos: NodePosition;
  isHighlighted: boolean;
}) {
  const fromX = fromPos.x + LAYOUT.nodeWidth;
  const fromY = fromPos.y + LAYOUT.nodeHeight / 2;
  const toX = toPos.x;
  const toY = toPos.y + LAYOUT.nodeHeight / 2;
  const path = generateBezierPath(fromX, fromY, toX, toY);
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  return (
    <g className={cn('transition-opacity', !isHighlighted && 'opacity-20')}>
      <path
        d={path}
        fill="none"
        stroke={connection.color || '#94a3b8'}
        strokeWidth={1.5}
        strokeDasharray={connection.style === 'dashed' ? '6 4' : undefined}
        markerEnd="url(#arrowhead)"
      />
      {connection.label && (
        <>
          <rect x={midX - 30} y={midY - 8} width={60} height={16} rx={4} fill="white" />
          <text x={midX} y={midY + 3} textAnchor="middle" fontSize={9} fill="#6b7280">{connection.label}</text>
        </>
      )}
    </g>
  );
}

function FlowGroupComponent({
  group,
  isExpanded,
  onToggle,
  onNodeClick,
  selectedNodeId,
  highlightedNodes,
  promptStats,
}: {
  group: FlowGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onNodeClick: (node: FlowNode) => void;
  selectedNodeId: string | null;
  highlightedNodes: Set<string>;
  promptStats?: Record<string, { callsLast24h: number; avgLatencyMs: number; errorRate: number }>;
}) {
  const layout = useMemo(() => calculateGroupLayout(group), [group]);
  const allHighlighted = highlightedNodes.size === 0;
  const promptCount = group.nodes.filter(n => n.type === 'prompt').length;
  const categoryConfig = CATEGORY_CONFIG[group.category];

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <span className="text-xl">{group.icon}</span>
        <div className="flex-1 text-left">
          <h3 className="font-medium text-gray-900">{group.label}</h3>
          <p className="text-xs text-gray-500">{group.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: `${CATEGORY_COLORS[group.category]}20`, color: CATEGORY_COLORS[group.category] }}>
            {categoryConfig.label}
          </span>
          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
            {promptCount} prompt{promptCount !== 1 ? 's' : ''}
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 bg-gray-50 rounded-xl border border-gray-200 overflow-x-auto">
          <svg width={layout.width} height={layout.height} className="min-w-full">
            <defs>
              <marker id="arrowhead" markerWidth={10} markerHeight={7} refX={9} refY={3.5} orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            {group.connections.map(conn => {
              const fromPos = layout.positions.get(conn.from);
              const toPos = layout.positions.get(conn.to);
              if (!fromPos || !toPos) return null;
              const isHighlighted = allHighlighted || highlightedNodes.has(conn.from) || highlightedNodes.has(conn.to);
              return <FlowConnectionComponent key={conn.id} connection={conn} fromPos={fromPos} toPos={toPos} isHighlighted={isHighlighted} />;
            })}
            {group.nodes.map(node => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;
              const isHighlighted = allHighlighted || highlightedNodes.has(node.id);
              return (
                <FlowNodeComponent
                  key={node.id}
                  node={node}
                  position={pos}
                  isSelected={selectedNodeId === node.id}
                  isHighlighted={isHighlighted}
                  onClick={() => onNodeClick(node)}
                  stats={node.promptKey ? promptStats?.[node.promptKey] : undefined}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export function AIPromptFlowView({ onPromptSelect, selectedPromptKey, promptStats }: AIPromptFlowViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['scheduler']));
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [filterType, setFilterType] = useState<FlowNodeType | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<FlowCategory | 'all'>('all');

  const stats = useMemo(() => getFlowStats(), []);
  const categoryCounts = useMemo(() => getCategoryCounts(), []);

  const highlightedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const highlighted = new Set<string>([selectedNode.id]);
    for (const group of AI_FLOW_GROUPS) {
      for (const conn of group.connections) {
        if (conn.from === selectedNode.id) highlighted.add(conn.to);
        if (conn.to === selectedNode.id) highlighted.add(conn.from);
      }
    }
    return highlighted;
  }, [selectedNode]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((node: FlowNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
    if (node.type === 'prompt' && node.promptKey && onPromptSelect) {
      onPromptSelect(node.promptKey);
    }
  }, [onPromptSelect]);

  const expandAll = useCallback(() => setExpandedGroups(new Set(AI_FLOW_GROUPS.map(g => g.id))), []);
  const collapseAll = useCallback(() => setExpandedGroups(new Set()), []);

  const filteredGroups = useMemo(() => {
    let groups = AI_FLOW_GROUPS;
    if (filterCategory !== 'all') groups = groups.filter(g => g.category === filterCategory);
    if (filterType !== 'all') groups = groups.filter(g => g.nodes.some(n => n.type === filterType));
    return groups;
  }, [filterType, filterCategory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">AI System Architecture</h2>
          <p className="text-sm text-gray-500">Visual map of how AI prompts flow through the system</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Maximize2 className="w-4 h-4 inline mr-1" />Expand All
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Minimize2 className="w-4 h-4 inline mr-1" />Collapse All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
          <div className="text-2xl font-bold text-orange-700">{stats.totalGroups}</div>
          <div className="text-xs text-orange-600">Flow Groups</div>
        </div>
        <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
          <div className="text-2xl font-bold text-purple-700">{stats.totalPrompts}</div>
          <div className="text-xs text-purple-600">AI Prompts</div>
        </div>
        <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
          <div className="text-2xl font-bold text-blue-700">{stats.totalNodes}</div>
          <div className="text-xs text-blue-600">Total Nodes</div>
        </div>
        <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
          <div className="text-2xl font-bold text-green-700">{stats.totalConnections}</div>
          <div className="text-xs text-green-600">Connections</div>
        </div>
        <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <div>
            <div className="text-sm font-medium text-emerald-700">System Active</div>
            <div className="text-xs text-emerald-600">All flows operational</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 mr-2">Category:</span>
        <button onClick={() => setFilterCategory('all')} className={cn('px-3 py-1.5 text-sm rounded-lg transition-colors', filterCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          All ({AI_FLOW_GROUPS.length})
        </button>
        {(Object.keys(CATEGORY_CONFIG) as FlowCategory[]).map(category => {
          const config = CATEGORY_CONFIG[category];
          return (
            <button
              key={category}
              onClick={() => setFilterCategory(filterCategory === category ? 'all' : category)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors', filterCategory === category ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              style={filterCategory === category ? { backgroundColor: CATEGORY_COLORS[category] } : undefined}
            >
              {config.icon} {config.label} ({categoryCounts[category]})
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 mr-2">Show:</span>
        {(['all', 'trigger', 'worker', 'condition', 'prompt', 'output'] as const).map(type => (
          <button key={type} onClick={() => setFilterType(type)} className={cn('px-3 py-1.5 text-sm rounded-lg transition-colors', filterType === type ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100')}>
            {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
          </button>
        ))}
      </div>

      {filterCategory === 'all' ? (
        (Object.keys(CATEGORY_CONFIG) as FlowCategory[]).map(category => {
          const groupsInCategory = filteredGroups.filter(g => g.category === category);
          if (groupsInCategory.length === 0) return null;
          const config = CATEGORY_CONFIG[category];
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 pt-4">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${CATEGORY_COLORS[category]}20` }}>
                  <span style={{ color: CATEGORY_COLORS[category] }}>{config.icon}</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{config.label}</h3>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
              {groupsInCategory.map(group => (
                <FlowGroupComponent
                  key={group.id}
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedNode?.id || null}
                  highlightedNodes={highlightedNodes}
                  promptStats={promptStats}
                />
              ))}
            </div>
          );
        })
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <FlowGroupComponent
              key={group.id}
              group={group}
              isExpanded={expandedGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNode?.id || null}
              highlightedNodes={highlightedNodes}
              promptStats={promptStats}
            />
          ))}
        </div>
      )}

      {filteredGroups.length === 0 && <div className="text-center py-12 text-gray-500">No flows match your filters</div>}

      {selectedNode && (
        <div className="fixed bottom-4 right-4 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{selectedNode.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900">{selectedNode.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedNode.description}</p>
              {selectedNode.promptKey && (
                <div className="mt-3 p-2 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-medium">Prompt Key</p>
                  <code className="text-sm text-purple-800 break-all">{selectedNode.promptKey}</code>
                  {onPromptSelect && (
                    <button onClick={() => onPromptSelect(selectedNode.promptKey!)} className="mt-2 w-full px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
                      Edit Prompt →
                    </button>
                  )}
                </div>
              )}
              {selectedNode.sourceFile && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium">Source File</p>
                  <code className="text-xs text-gray-700 break-all">{selectedNode.sourceFile}</code>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
