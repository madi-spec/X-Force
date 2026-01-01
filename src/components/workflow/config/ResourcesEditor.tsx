'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, FileText, Video, Link2, FileCode, ExternalLink } from 'lucide-react';

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'document' | 'video' | 'link' | 'template';
}

const RESOURCE_TYPES = [
  { value: 'document', label: 'Document', icon: FileText, color: 'text-blue-500' },
  { value: 'video', label: 'Video', icon: Video, color: 'text-red-500' },
  { value: 'link', label: 'Link', icon: Link2, color: 'text-green-500' },
  { value: 'template', label: 'Template', icon: FileCode, color: 'text-purple-500' },
] as const;

interface ResourcesEditorProps {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}

export function ResourcesEditor({ resources, onChange }: ResourcesEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const addResource = () => {
    const newResource: Resource = {
      id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      url: '',
      type: 'document',
    };
    onChange([...resources, newResource]);
    setExpandedId(newResource.id);
  };

  const updateResource = (id: string, updates: Partial<Resource>) => {
    onChange(resources.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = resources.findIndex(r => r.id === draggedId);
    const targetIndex = resources.findIndex(r => r.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newResources = [...resources];
    const [removed] = newResources.splice(draggedIndex, 1);
    newResources.splice(targetIndex, 0, removed);
    onChange(newResources);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const getTypeConfig = (type: Resource['type']) => {
    return RESOURCE_TYPES.find(t => t.value === type) || RESOURCE_TYPES[0];
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Resources ({resources.length})
        </span>
        <button
          onClick={addResource}
          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Empty State */}
      {resources.length === 0 && (
        <div className="p-4 text-center border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 mb-2">No resources yet</p>
          <button
            onClick={addResource}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Add your first resource
          </button>
        </div>
      )}

      {/* Resources List */}
      <div className="space-y-1">
        {resources.map((resource) => {
          const typeConfig = getTypeConfig(resource.type);
          const TypeIcon = typeConfig.icon;

          return (
            <div
              key={resource.id}
              draggable
              onDragStart={(e) => handleDragStart(e, resource.id)}
              onDragOver={(e) => handleDragOver(e, resource.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                'border rounded-lg bg-white transition-all',
                expandedId === resource.id ? 'border-green-200 shadow-sm' : 'border-gray-200',
                draggedId === resource.id && 'opacity-50'
              )}
            >
              {/* Collapsed Header */}
              <div
                className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === resource.id ? null : resource.id)}
              >
                <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                {expandedId === resource.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <TypeIcon className={cn('w-4 h-4', typeConfig.color)} />
                <span className={cn(
                  'flex-1 text-sm truncate',
                  resource.title ? 'text-gray-900' : 'text-gray-400 italic'
                )}>
                  {resource.title || 'Untitled resource'}
                </span>
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteResource(resource.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded Content */}
              {expandedId === resource.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
                  <div className="pt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={resource.title}
                      onChange={(e) => updateResource(resource.id, { title: e.target.value })}
                      placeholder="e.g., Product One-Pager"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      value={resource.url}
                      onChange={(e) => updateResource(resource.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Type
                    </label>
                    <div className="flex gap-2">
                      {RESOURCE_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            onClick={() => updateResource(resource.id, { type: type.value })}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                              resource.type === type.value
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
