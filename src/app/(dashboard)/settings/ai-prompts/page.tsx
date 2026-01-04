'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, History, RotateCcw, Save, Loader2, List, GitBranch, Search } from 'lucide-react';
import { AIPromptEditor } from '@/components/settings/AIPromptEditor';
import { AIPromptFlowView } from '@/components/settings/AIPromptFlowView';
import { cn } from '@/lib/utils';

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
  model: string;
  max_tokens: number;
  category: string | null;
  purpose: string | null;
  variables: string[] | null;
}

interface HistoryEntry {
  id: string;
  version: number;
  changed_at: string;
  changed_by: string | null;
  change_reason: string | null;
}

type ViewMode = 'list' | 'flow';

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
  scheduler: 'bg-orange-100 text-orange-700',
  autopilot: 'bg-pink-100 text-pink-700',
};

export default function AIPromptsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editedSchema, setEditedSchema] = useState('');
  const [editedModel, setEditedModel] = useState('claude-sonnet-4-20250514');
  const [editedMaxTokens, setEditedMaxTokens] = useState(4096);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => { fetchPrompts(); }, []);

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
      const changed = editedPrompt !== selectedPrompt.prompt_template ||
        editedSchema !== (selectedPrompt.schema_template || '') ||
        editedModel !== (selectedPrompt.model || 'claude-sonnet-4-20250514') ||
        editedMaxTokens !== (selectedPrompt.max_tokens || 4096);
      setHasChanges(changed);
    }
  }, [editedPrompt, editedSchema, editedModel, editedMaxTokens, selectedPrompt]);

  async function fetchPrompts() {
    try {
      const res = await fetch('/api/ai-prompts');
      const data = await res.json();
      setPrompts(data.prompts || []);
      if (data.prompts?.length > 0 && !selectedPrompt) setSelectedPrompt(data.prompts[0]);
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
      if (res.ok) { await fetchPrompts(); setHasChanges(false); }
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevertToDefault() {
    if (!selectedPrompt || !confirm('Revert to default? Current version saved to history.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-prompts/${selectedPrompt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert_to_default' }),
      });
      if (res.ok) await fetchPrompts();
    } catch (error) {
      console.error('Failed to revert:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevertToVersion(version: number) {
    if (!selectedPrompt || !confirm(`Revert to version ${version}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai-prompts/${selectedPrompt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert_to_version', version }),
      });
      if (res.ok) { await fetchPrompts(); setShowHistory(false); }
    } catch (error) {
      console.error('Failed to revert:', error);
    } finally {
      setSaving(false);
    }
  }

  const handlePromptSelectFromFlow = useCallback((promptKey: string) => {
    const prompt = prompts.find(p => p.key === promptKey);
    if (prompt) { setSelectedPrompt(prompt); setViewMode('list'); }
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    return prompts.filter(prompt => {
      const matchesSearch = !searchQuery ||
        prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prompt.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !filterCategory || prompt.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [prompts, searchQuery, filterCategory]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    prompts.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats);
  }, [prompts]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-gray-900">AI Prompts</h1>
            <p className="text-xs text-gray-500 mt-1">Manage the prompts used by AI features in the platform</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button onClick={() => setViewMode('list')} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              <List className="w-4 h-4" />List
            </button>
            <button onClick={() => setViewMode('flow')} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', viewMode === 'flow' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              <GitBranch className="w-4 h-4" />Flow
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'flow' && <AIPromptFlowView onPromptSelect={handlePromptSelectFromFlow} selectedPromptKey={selectedPrompt?.key} />}

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Prompts</h2>
                <span className="text-xs text-gray-500">{filteredPrompts.length} total</span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search prompts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  <button onClick={() => setFilterCategory(null)} className={cn('px-2 py-1 text-xs rounded-full transition-colors', !filterCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>All</button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)} className={cn('px-2 py-1 text-xs rounded-full transition-colors', filterCategory === cat ? CATEGORY_COLORS[cat] || 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>{cat}</button>
                  ))}
                </div>
              )}
              <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                {filteredPrompts.map((prompt) => (
                  <button key={prompt.id} onClick={() => setSelectedPrompt(prompt)} className={cn('w-full text-left px-3 py-2 rounded-xl transition-colors', selectedPrompt?.id === prompt.id ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-gray-50 border border-transparent')}>
                    <div className="flex items-center gap-2">
                      <Sparkles className={cn('h-4 w-4', selectedPrompt?.id === prompt.id ? 'text-blue-600' : 'text-gray-400')} />
                      <span className={cn('text-sm font-medium truncate', selectedPrompt?.id === prompt.id ? 'text-blue-900' : 'text-gray-900')}>{prompt.name}</span>
                    </div>
                    {prompt.category && <span className={cn('inline-block mt-1 px-2 py-0.5 text-xs rounded-full', CATEGORY_COLORS[prompt.category] || 'bg-gray-100 text-gray-600')}>{prompt.category}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedPrompt ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedPrompt.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Key: <code className="bg-gray-100 px-1 rounded">{selectedPrompt.key}</code> · Version {selectedPrompt.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowHistory(!showHistory)} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors', showHistory ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100')}>
                      <History className="h-4 w-4" />History
                    </button>
                    <button onClick={handleRevertToDefault} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <RotateCcw className="h-4 w-4" />Reset
                    </button>
                    <button onClick={handleSave} disabled={!hasChanges || saving} className={cn('flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors', hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
                    </button>
                  </div>
                </div>
                {showHistory && (
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Version History</h4>
                    {history.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {history.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                            <div>
                              <span className="text-sm font-medium text-gray-900">Version {entry.version}</span>
                              <span className="text-xs text-gray-500 ml-2">{new Date(entry.changed_at).toLocaleString()}</span>
                            </div>
                            <button onClick={() => handleRevertToVersion(entry.version)} disabled={saving} className="text-xs text-blue-600 hover:text-blue-800">Restore</button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-gray-500">No history yet</p>}
                  </div>
                )}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Model</label>
                      <select value={editedModel} onChange={(e) => setEditedModel(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none">
                        {AVAILABLE_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Max Tokens</label>
                      <input type="number" value={editedMaxTokens} onChange={(e) => setEditedMaxTokens(parseInt(e.target.value) || 4096)} min={100} max={16000} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <AIPromptEditor promptTemplate={editedPrompt} schemaTemplate={editedSchema} onPromptChange={setEditedPrompt} onSchemaChange={setEditedSchema} />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a prompt to edit</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
