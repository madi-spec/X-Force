'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWorkflow } from '@/lib/workflow';
import { ArrowLeft, Play, Upload, Check, Loader2, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowHeaderProps {
  productName: string;
  productSlug: string;
  isTestMode: boolean;
  onTestModeToggle: () => void;
}

interface PublishModalState {
  isOpen: boolean;
  type: 'confirm' | 'success' | 'error';
  message?: string;
  stagesWithCompanies?: Array<{ name: string; count: number }>;
  result?: { stageCount?: number; created?: number; updated?: number };
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
    isPublishing,
    publishWorkflow,
    canPublish,
    nodes,
  } = useWorkflow();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(workflowName);
  const [publishModal, setPublishModal] = useState<PublishModalState>({ isOpen: false, type: 'confirm' });

  const stageCount = nodes.filter(n => n.type === 'stage').length;

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;
    try {
      await saveWorkflow();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  }, [hasUnsavedChanges, isSaving, saveWorkflow]);

  const handlePublishClick = useCallback(() => {
    if (stageCount === 0) {
      setPublishModal({
        isOpen: true,
        type: 'error',
        message: 'Add at least one stage before publishing.',
      });
      return;
    }
    setPublishModal({ isOpen: true, type: 'confirm' });
  }, [stageCount]);

  const handlePublishConfirm = useCallback(async () => {
    const result = await publishWorkflow();
    if (result.success) {
      setPublishModal({
        isOpen: true,
        type: 'success',
        result: {
          stageCount: result.stageCount,
          created: result.created,
          updated: result.updated,
        },
      });
    } else {
      setPublishModal({
        isOpen: true,
        type: 'error',
        message: result.error,
        stagesWithCompanies: result.stagesWithCompanies,
      });
    }
  }, [publishWorkflow]);

  const closeModal = useCallback(() => {
    setPublishModal({ isOpen: false, type: 'confirm' });
  }, []);

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
          onClick={handlePublishClick}
          disabled={isPublishing || isSaving}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            isPublishing
              ? 'bg-blue-400 text-white cursor-wait'
              : hasUnsavedChanges
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {isPublishing ? 'Publishing...' : hasUnsavedChanges ? 'Save & Publish' : 'Publish'}
        </button>
      </div>

      {/* Publish Modal */}
      {publishModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            {publishModal.type === 'confirm' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Upload className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Publish Workflow</h3>
                    <p className="text-sm text-gray-500">This will update your pipeline stages</p>
                  </div>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">
                    You&apos;re about to publish <strong>{stageCount} stage{stageCount !== 1 ? 's' : ''}</strong> to the {processConfig.label.toLowerCase()}.
                  </p>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <ul className="text-sm text-gray-600 space-y-1">
                      {nodes.filter(n => n.type === 'stage').map((node, idx) => (
                        <li key={node.id} className="flex items-center gap-2">
                          <span className="text-gray-400">{idx + 1}.</span>
                          <span>{node.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePublishConfirm}
                    disabled={isPublishing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      'Publish Now'
                    )}
                  </button>
                </div>
              </>
            )}

            {publishModal.type === 'success' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Published Successfully</h3>
                    <p className="text-sm text-gray-500">Your workflow is now live</p>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">
                      {publishModal.result?.stageCount} stage{publishModal.result?.stageCount !== 1 ? 's' : ''} published
                      {publishModal.result?.created ? ` (${publishModal.result.created} new)` : ''}
                      {publishModal.result?.updated ? ` (${publishModal.result.updated} updated)` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Done
                </button>
              </>
            )}

            {publishModal.type === 'error' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Cannot Publish</h3>
                    <p className="text-sm text-gray-500">There was an issue with your workflow</p>
                  </div>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-3">{publishModal.message}</p>
                  {publishModal.stagesWithCompanies && publishModal.stagesWithCompanies.length > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-800 font-medium mb-2">Stages with companies:</p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {publishModal.stagesWithCompanies.map((stage) => (
                          <li key={stage.name}>
                            • {stage.name} ({stage.count} {stage.count === 1 ? 'company' : 'companies'})
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-red-600 mt-2">
                        Move companies to another stage before removing these stages.
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
