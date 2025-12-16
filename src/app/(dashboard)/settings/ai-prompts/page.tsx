'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, History, RotateCcw, Save, Loader2 } from 'lucide-react';
import { AIPromptEditor } from '@/components/settings/AIPromptEditor';

interface AIPrompt {
  id: string;
  key: string;
  name: string;
  description: string | null;
  prompt_template: string;
  schema_template: string | null;
  default_prompt_template: string;
  default_schema_template: string | null;
  is_active: boolean;
  version: number;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  version: number;
  changed_at: string;
  changed_by: string | null;
  change_reason: string | null;
}

export default function AIPromptsPage() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editedSchema, setEditedSchema] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (selectedPrompt) {
      setEditedPrompt(selectedPrompt.prompt_template);
      setEditedSchema(selectedPrompt.schema_template || '');
      setHasChanges(false);
      fetchHistory(selectedPrompt.id);
    }
  }, [selectedPrompt]);

  useEffect(() => {
    if (selectedPrompt) {
      const promptChanged = editedPrompt !== selectedPrompt.prompt_template;
      const schemaChanged = editedSchema !== (selectedPrompt.schema_template || '');
      setHasChanges(promptChanged || schemaChanged);
    }
  }, [editedPrompt, editedSchema, selectedPrompt]);

  async function fetchPrompts() {
    try {
      const res = await fetch('/api/ai-prompts');
      const data = await res.json();
      setPrompts(data.prompts || []);
      if (data.prompts?.length > 0 && !selectedPrompt) {
        setSelectedPrompt(data.prompts[0]);
      }
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory(promptId: string) {
    try {
      const res = await fetch(`/api/ai-prompts/${promptId}/history`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  }

  async function handleSave() {
    if (!selectedPrompt || !hasChanges) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/ai-prompts/${selectedPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_template: editedPrompt,
          schema_template: editedSchema || null,
        }),
      });

      if (res.ok) {
        await fetchPrompts();
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevertToDefault() {
    if (!selectedPrompt) return;

    if (!confirm('Are you sure you want to revert this prompt to its default? This will save the current version to history.')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/ai-prompts/${selectedPrompt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert_to_default' }),
      });

      if (res.ok) {
        await fetchPrompts();
      }
    } catch (error) {
      console.error('Failed to revert prompt:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevertToVersion(version: number) {
    if (!selectedPrompt) return;

    if (!confirm(`Are you sure you want to revert to version ${version}?`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/ai-prompts/${selectedPrompt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert_to_version', version }),
      });

      if (res.ok) {
        await fetchPrompts();
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Failed to revert prompt:', error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-gray-900">AI Prompts</h1>
            <p className="text-xs text-gray-500 mt-1">
              Manage the prompts used by AI features in the platform
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Prompt List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Prompts</h2>
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => setSelectedPrompt(prompt)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${
                    selectedPrompt?.id === prompt.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-medium text-sm">{prompt.name}</span>
                  </div>
                  <p className="text-xs text-xs text-gray-500 mt-1 truncate">
                    v{prompt.version} • {new Date(prompt.updated_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {selectedPrompt ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Editor Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPrompt.name}</h2>
                  <p className="text-sm text-gray-500">{selectedPrompt.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <History className="h-4 w-4" />
                    History
                  </button>
                  <button
                    onClick={handleRevertToDefault}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset to Default
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>

              {/* History Panel */}
              {showHistory && history.length > 0 && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Version History</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                      >
                        <div>
                          <span className="text-sm font-medium">Version {entry.version}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(entry.changed_at).toLocaleString()}
                          </span>
                          {entry.change_reason && (
                            <span className="text-xs text-gray-400 ml-2">
                              - {entry.change_reason}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRevertToVersion(entry.version)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editor Content */}
              <div className="p-4">
                <AIPromptEditor
                  promptTemplate={editedPrompt}
                  schemaTemplate={editedSchema}
                  onPromptChange={setEditedPrompt}
                  onSchemaChange={setEditedSchema}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a prompt to edit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
