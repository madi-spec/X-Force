'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  History,
  RotateCcw,
  Save,
  Loader2,
  Calendar,
  MessageSquare,
  Mail,
  Search,
  Cpu,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AIPromptEditor } from '@/components/settings/AIPromptEditor';
import { cn } from '@/lib/utils';

type Provider = 'anthropic' | 'openai' | 'gemini';

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
  display_order?: number;
  provider: Provider;
  fallback_provider: Provider | null;
  fallback_model: string | null;
}

interface CategoryConfig {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  general: {
    label: 'General',
    description: 'Core system prompts that set the baseline behavior for all AI features',
    icon: Cpu,
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  scheduling: {
    label: 'Scheduling',
    description: 'Meeting scheduling, email generation, and calendar management',
    icon: Calendar,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  meetings: {
    label: 'Meetings',
    description: 'Meeting prep, transcript analysis, and call intelligence',
    icon: MessageSquare,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  inbox: {
    label: 'Inbox & Email',
    description: 'Email analysis, communication processing, and response generation',
    icon: Mail,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  intelligence: {
    label: 'Intelligence',
    description: 'Company research, entity matching, and sales strategy generation',
    icon: Search,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  daily_driver: {
    label: 'Daily Driver',
    description: 'Work queue prioritization and daily planning assistance',
    icon: Sparkles,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
};

const CATEGORY_ORDER = ['general', 'scheduling', 'meetings', 'inbox', 'intelligence', 'daily_driver'];

const PROVIDERS: Array<{ id: Provider; name: string; icon: string }> = [
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '🟣' },
  { id: 'openai', name: 'OpenAI (GPT)', icon: '🟢' },
  { id: 'gemini', name: 'Google (Gemini)', icon: '🔵' },
];

const MODELS_BY_PROVIDER: Record<Provider, Array<{ id: string; name: string; description: string }>> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance of speed and quality' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable, highest quality' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, most economical' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT model' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship' },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
  ],
};

// Legacy - kept for backward compatibility with any code referencing it
const AVAILABLE_MODELS = MODELS_BY_PROVIDER.anthropic;

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
  const [editedProvider, setEditedProvider] = useState<Provider>('anthropic');
  const [editedFallbackProvider, setEditedFallbackProvider] = useState<Provider | null>(null);
  const [editedFallbackModel, setEditedFallbackModel] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  // Group prompts by category
  const promptsByCategory = useMemo(() => {
    const grouped: Record<string, AIPrompt[]> = {};

    // Initialize all categories
    CATEGORY_ORDER.forEach(cat => {
      grouped[cat] = [];
    });
    grouped['other'] = [];

    // Sort prompts into categories
    prompts.forEach(prompt => {
      const category = prompt.category || 'other';
      if (grouped[category]) {
        grouped[category].push(prompt);
      } else {
        grouped['other'].push(prompt);
      }
    });

    // Sort within each category by display_order then name
    Object.keys(grouped).forEach(cat => {
      grouped[cat].sort((a, b) => {
        const orderA = a.display_order ?? 100;
        const orderB = b.display_order ?? 100;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
    });

    return grouped;
  }, [prompts]);

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (selectedPrompt) {
      const provider = selectedPrompt.provider || 'anthropic';
      setEditedPrompt(selectedPrompt.prompt_template);
      setEditedSchema(selectedPrompt.schema_template || '');
      setEditedProvider(provider);
      setEditedModel(selectedPrompt.model || MODELS_BY_PROVIDER[provider][0].id);
      setEditedMaxTokens(selectedPrompt.max_tokens || 4096);
      setEditedFallbackProvider(selectedPrompt.fallback_provider || null);
      setEditedFallbackModel(selectedPrompt.fallback_model || null);
      setHasChanges(false);
      fetchHistory(selectedPrompt.id);
    }
  }, [selectedPrompt]);

  useEffect(() => {
    if (selectedPrompt) {
      const promptChanged = editedPrompt !== selectedPrompt.prompt_template;
      const schemaChanged = editedSchema !== (selectedPrompt.schema_template || '');
      const providerChanged = editedProvider !== (selectedPrompt.provider || 'anthropic');
      const modelChanged = editedModel !== (selectedPrompt.model || MODELS_BY_PROVIDER[selectedPrompt.provider || 'anthropic'][0].id);
      const tokensChanged = editedMaxTokens !== (selectedPrompt.max_tokens || 4096);
      const fallbackProviderChanged = editedFallbackProvider !== (selectedPrompt.fallback_provider || null);
      const fallbackModelChanged = editedFallbackModel !== (selectedPrompt.fallback_model || null);
      setHasChanges(
        promptChanged ||
        schemaChanged ||
        providerChanged ||
        modelChanged ||
        tokensChanged ||
        fallbackProviderChanged ||
        fallbackModelChanged
      );
    }
  }, [editedPrompt, editedSchema, editedProvider, editedModel, editedMaxTokens, editedFallbackProvider, editedFallbackModel, selectedPrompt]);

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
          provider: editedProvider,
          fallback_provider: editedFallbackProvider,
          fallback_model: editedFallbackModel,
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

  function handleProviderChange(newProvider: Provider) {
    setEditedProvider(newProvider);
    // Reset model to default for the new provider
    setEditedModel(MODELS_BY_PROVIDER[newProvider][0].id);
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

  function toggleCategory(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
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
              Manage and customize the prompts used by AI features across the platform
            </p>
          </div>
          <div className="text-xs text-gray-400">
            {prompts.length} prompts configured
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Prompt List - Organized by Category */}
        <div className="lg:col-span-1 space-y-3">
          {CATEGORY_ORDER.map(category => {
            const config = CATEGORY_CONFIG[category];
            const categoryPrompts = promptsByCategory[category] || [];
            if (categoryPrompts.length === 0) return null;

            const isExpanded = expandedCategories.has(category);
            const Icon = config.icon;

            return (
              <div
                key={category}
                className={cn(
                  "bg-white rounded-xl shadow-sm border overflow-hidden",
                  config.borderColor
                )}
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    "w-full flex items-center gap-2 p-3 text-left transition-colors",
                    config.bgColor,
                    "hover:opacity-90"
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-medium", config.color)}>
                      {config.label}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {categoryPrompts.length} prompt{categoryPrompts.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {/* Prompts in Category */}
                {isExpanded && (
                  <div className="p-2 space-y-1">
                    {categoryPrompts.map((prompt) => (
                      <button
                        key={prompt.id}
                        onClick={() => setSelectedPrompt(prompt)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg transition-colors",
                          selectedPrompt?.id === prompt.id
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "hover:bg-gray-50 text-gray-700"
                        )}
                      >
                        <div className="text-sm font-medium truncate">{prompt.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            v{prompt.version}
                          </span>
                          {prompt.prompt_template !== prompt.default_prompt_template && (
                            <span className="text-[10px] px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                              Modified
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Other/Uncategorized */}
          {promptsByCategory['other']?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleCategory('other')}
                className="w-full flex items-center gap-2 p-3 text-left bg-gray-50 hover:bg-gray-100"
              >
                <Sparkles className="h-4 w-4 text-gray-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">Other</div>
                  <div className="text-[10px] text-gray-500">
                    {promptsByCategory['other'].length} prompt{promptsByCategory['other'].length !== 1 ? 's' : ''}
                  </div>
                </div>
                {expandedCategories.has('other') ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expandedCategories.has('other') && (
                <div className="p-2 space-y-1">
                  {promptsByCategory['other'].map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => setSelectedPrompt(prompt)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg transition-colors",
                        selectedPrompt?.id === prompt.id
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      <div className="text-sm font-medium truncate">{prompt.name}</div>
                      <div className="text-[10px] text-gray-400">v{prompt.version}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {selectedPrompt ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Editor Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{selectedPrompt.name}</h2>
                    {selectedPrompt.category && CATEGORY_CONFIG[selectedPrompt.category] && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        CATEGORY_CONFIG[selectedPrompt.category].bgColor,
                        CATEGORY_CONFIG[selectedPrompt.category].color
                      )}>
                        {CATEGORY_CONFIG[selectedPrompt.category].label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedPrompt.description}</p>
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
                    Reset
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
                    Save
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
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Template Variables</span>
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

              {/* Provider & Model Configuration */}
              <div className="px-4 pt-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  {/* Provider Selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      AI Provider
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => handleProviderChange(provider.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                            editedProvider === provider.id
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                          )}
                        >
                          <span>{provider.icon}</span>
                          <span className="truncate">{provider.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Model
                      </label>
                      <select
                        value={editedModel}
                        onChange={(e) => setEditedModel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      >
                        {MODELS_BY_PROVIDER[editedProvider]?.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {MODELS_BY_PROVIDER[editedProvider]?.find(m => m.id === editedModel)?.description || 'Select a model'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={editedMaxTokens}
                        onChange={(e) => setEditedMaxTokens(Math.max(100, Math.min(32000, parseInt(e.target.value) || 4096)))}
                        min={100}
                        max={32000}
                        step={100}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum response length
                      </p>
                    </div>
                  </div>

                  {/* Fallback Configuration */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fallback (Optional)
                      </label>
                      {editedFallbackProvider && (
                        <button
                          onClick={() => {
                            setEditedFallbackProvider(null);
                            setEditedFallbackModel(null);
                          }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      If the primary provider fails, the system will automatically try the fallback.
                    </p>

                    {editedFallbackProvider ? (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editedFallbackProvider}
                          onChange={(e) => {
                            const newFallbackProvider = e.target.value as Provider;
                            setEditedFallbackProvider(newFallbackProvider);
                            setEditedFallbackModel(MODELS_BY_PROVIDER[newFallbackProvider][0].id);
                          }}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          {PROVIDERS.filter(p => p.id !== editedProvider).map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.icon} {provider.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editedFallbackModel || ''}
                          onChange={(e) => setEditedFallbackModel(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          {editedFallbackProvider && MODELS_BY_PROVIDER[editedFallbackProvider]?.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const fallbackProvider = PROVIDERS.find(p => p.id !== editedProvider)?.id || 'openai';
                          setEditedFallbackProvider(fallbackProvider);
                          setEditedFallbackModel(MODELS_BY_PROVIDER[fallbackProvider][0].id);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add fallback provider
                      </button>
                    )}
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
