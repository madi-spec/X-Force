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
  // Model configuration
  model: string;
  max_tokens: number;
  category: string | null;
  purpose: string | null;
  variables: string[] | null;
}

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Recommended)', description: 'Best balance of speed and quality' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable, highest quality' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, most economical' },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700',
  meetings: 'bg-purple-100 text-purple-700',
  inbox: 'bg-blue-100 text-blue-700',
  intelligence: 'bg-amber-100 text-amber-700',
  daily_driver: 'bg-green-100 text-green-700',
};

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
  const [editedModel, setEditedModel] = useState('claude-sonnet-4-20250514');
  const [editedMaxTokens, setEditedMaxTokens] = useState(4096);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (selectedPrompt) {
      setEditedPrompt(selectedPrompt.prompt_template);
      setEditedSchema(selectedPrompt.schema_template || '');
      setEditedModel(selectedPrompt.model || 'claude-sonnet-4-20250514');
      setEditedMaxTokens(selectedPrompt.max_tokens || 4096);
      setHasChanges(false);
      fetchHistory(selectedPrompt.id);
    }
  }, [selectedPrompt]);

  useEffect(() => {
    if (selectedPrompt) {
      const promptChanged = editedPrompt !== selectedPrompt.prompt_template;
      const schemaChanged = editedSchema !== (selectedPrompt.schema_template || '');
      const modelChanged = editedModel !== (selectedPrompt.model || 'claude-sonnet-4-20250514');
      const tokensChanged = editedMaxTokens !== (selectedPrompt.max_tokens || 4096);
      setHasChanges(promptChanged || schemaChanged || modelChanged || tokensChanged);
    }
  }, [editedPrompt, editedSchema, editedModel, editedMaxTokens, selectedPrompt]);

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
          model: editedModel,
          max_tokens: editedMaxTokens,
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
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-sm truncate">{prompt.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {prompt.category && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[prompt.category] || 'bg-gray-100 text-gray-600'}`}>
                        {prompt.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      v{prompt.version}
                    </span>
                  </div>
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
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    <History className="h-4 w-4" />
                    History
                  </button>
                  <button
                    onClick={handleRevertToDefault}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
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

              {/* Purpose & Variables Info */}
              {(selectedPrompt.purpose || selectedPrompt.variables) && (
                <div className="px-4 pt-4 space-y-3">
                  {selectedPrompt.purpose && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</span>
                      <p className="text-sm text-gray-700 mt-1">{selectedPrompt.purpose}</p>
                    </div>
                  )}
                  {selectedPrompt.variables && selectedPrompt.variables.length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Variables</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPrompt.variables.map((v) => (
                          <code key={v} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Model & Token Configuration */}
              <div className="px-4 pt-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Model
                    </label>
                    <select
                      value={editedModel}
                      onChange={(e) => setEditedModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {AVAILABLE_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {AVAILABLE_MODELS.find(m => m.id === editedModel)?.description}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={editedMaxTokens}
                      onChange={(e) => setEditedMaxTokens(Math.max(100, Math.min(8192, parseInt(e.target.value) || 4096)))}
                      min={100}
                      max={8192}
                      step={100}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum response length (100-8192)
                    </p>
                  </div>
                </div>
              </div>

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
