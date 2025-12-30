'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWorkflow } from '@/lib/workflow';
import { ArrowLeft, Play, Upload, Check, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowHeaderProps {
  productName: string;
  productSlug: string;
  isTestMode: boolean;
  onTestModeToggle: () => void;
}

export function WorkflowHeader({ productName, productSlug, isTestMode, onTestModeToggle }: WorkflowHeaderProps) {
  const {
    processConfig,
    workflowName,
    setWorkflowName,
    workflowStatus,
    entityCount,
    hasUnsavedChanges,
    isSaving,
    lastSaved,
    saveWorkflow,
  } = useWorkflow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowName);

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;
    try {
      await saveWorkflow();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  }, [hasUnsavedChanges, isSaving, saveWorkflow]);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleNameSubmit = () => {
    if (tempName.trim()) {
      setWorkflowName(tempName.trim());
    } else {
      setTempName(workflowName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setTempName(workflowName);
      setIsEditingName(false);
    }
  };

  return (
    <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
      {/* Left: Navigation and breadcrumb */}
      <div className="flex items-center gap-4">
        <Link
          href={`/process/${productSlug}/${processConfig.type}`}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Process Studio</span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">{productName}</span>
          <span className="text-gray-400">/</span>
          <span className={cn('font-medium', processConfig.bgColor.replace('bg-', 'text-').replace('-50', '-700'))}>
            {processConfig.label}
          </span>
        </div>
      </div>

      {/* Center: Workflow name */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
        {isEditingName ? (
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="text-lg font-medium text-gray-900 bg-transparent border-b-2 border-blue-500 outline-none px-1"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setTempName(workflowName);
              setIsEditingName(true);
            }}
            className="text-lg font-medium text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
          >
            {workflowName}
          </button>
        )}

        {/* Status badge */}
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          workflowStatus === 'active' && 'bg-green-100 text-green-700',
          workflowStatus === 'draft' && 'bg-yellow-100 text-yellow-700',
          workflowStatus === 'archived' && 'bg-gray-100 text-gray-600',
        )}>
          {entityCount} {processConfig.entityNamePlural}
        </span>
      </div>

      {/* Right: Save status and actions */}
      <div className="flex items-center gap-3">
        {/* Save status */}
        <div className="text-sm text-gray-500">
          {isSaving && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
          {!isSaving && hasUnsavedChanges && (
            <span className="text-amber-600">Unsaved changes</span>
          )}
          {!isSaving && !hasUnsavedChanges && lastSaved && (
            <span className="flex items-center gap-1 text-green-600">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            hasUnsavedChanges && !isSaving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>

        {/* Test button */}
        <button
          onClick={onTestModeToggle}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            isTestMode
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          <Play className="w-4 h-4" />
          {isTestMode ? 'Exit Test' : 'Test'}
        </button>

        {/* Publish button */}
        <button
          disabled
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-400 rounded-lg cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          Publish
        </button>
      </div>
    </div>
  );
}
