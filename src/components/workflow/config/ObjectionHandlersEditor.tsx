'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Sparkles } from 'lucide-react';

export interface ObjectionHandler {
  id: string;
  objection: string;
  response: string;
  source?: 'manual' | 'ai_generated';
}

interface ObjectionHandlersEditorProps {
  objectionHandlers: ObjectionHandler[];
  onChange: (objectionHandlers: ObjectionHandler[]) => void;
  onGenerateClick?: () => void;
}

export function ObjectionHandlersEditor({ objectionHandlers, onChange, onGenerateClick }: ObjectionHandlersEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const addHandler = () => {
    const newHandler: ObjectionHandler = {
      id: `oh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      objection: '',
      response: '',
      source: 'manual',
    };
    onChange([...objectionHandlers, newHandler]);
    setExpandedId(newHandler.id);
  };

  const updateHandler = (id: string, updates: Partial<ObjectionHandler>) => {
    onChange(objectionHandlers.map(oh => oh.id === id ? { ...oh, ...updates } : oh));
  };

  const deleteHandler = (id: string) => {
    onChange(objectionHandlers.filter(oh => oh.id !== id));
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

    const draggedIndex = objectionHandlers.findIndex(oh => oh.id === draggedId);
    const targetIndex = objectionHandlers.findIndex(oh => oh.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newHandlers = [...objectionHandlers];
    const [removed] = newHandlers.splice(draggedIndex, 1);
    newHandlers.splice(targetIndex, 0, removed);
    onChange(newHandlers);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Objection Handlers ({objectionHandlers.length})
        </span>
        <div className="flex items-center gap-1">
          {onGenerateClick && (
            <button
              onClick={onGenerateClick}
              className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Generate
            </button>
          )}
          <button
            onClick={addHandler}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {/* Empty State */}
      {objectionHandlers.length === 0 && (
        <div className="p-4 text-center border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 mb-2">No objection handlers yet</p>
          <button
            onClick={addHandler}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Add your first objection handler
          </button>
        </div>
      )}

      {/* Handlers List */}
      <div className="space-y-1">
        {objectionHandlers.map((oh) => (
          <div
            key={oh.id}
            draggable
            onDragStart={(e) => handleDragStart(e, oh.id)}
            onDragOver={(e) => handleDragOver(e, oh.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              'border rounded-lg bg-white transition-all',
              expandedId === oh.id ? 'border-orange-200 shadow-sm' : 'border-gray-200',
              draggedId === oh.id && 'opacity-50'
            )}
          >
            {/* Collapsed Header */}
            <div
              className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === oh.id ? null : oh.id)}
            >
              <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
              {expandedId === oh.id ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span className={cn(
                'flex-1 text-sm truncate',
                oh.objection ? 'text-gray-900' : 'text-gray-400 italic'
              )}>
                {oh.objection || 'Untitled objection'}
              </span>
              {oh.source === 'ai_generated' && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600 rounded">
                  AI
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHandler(oh.id);
                }}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Expanded Content */}
            {expandedId === oh.id && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
                <div className="pt-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Objection
                  </label>
                  <input
                    type="text"
                    value={oh.objection}
                    onChange={(e) => updateHandler(oh.id, { objection: e.target.value })}
                    placeholder='e.g., "We already have a solution"'
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Response
                  </label>
                  <textarea
                    value={oh.response}
                    onChange={(e) => updateHandler(oh.id, { response: e.target.value })}
                    placeholder="How to handle this objection..."
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
