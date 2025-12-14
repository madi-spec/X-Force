'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Phone, Headphones, Zap, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Deal,
  type DealStage,
  type DealType,
  type SalesTeam,
  type Company,
  PIPELINE_STAGES,
  DEAL_TYPES,
  SALES_TEAMS,
} from '@/types';

const PRODUCT_CATEGORIES = [
  { id: 'voice-phone', label: 'Voice Phone', icon: Phone, color: 'bg-purple-100 text-purple-700 border-purple-300', team: 'voice' },
  { id: 'voice-addons', label: 'Voice Add-ons', icon: Headphones, color: 'bg-purple-50 text-purple-600 border-purple-200', team: 'voice' },
  { id: 'xrai-platform', label: 'X-RAI Platform', icon: Zap, color: 'bg-blue-100 text-blue-700 border-blue-300', team: 'xrai' },
  { id: 'ai-agents', label: 'AI Agents', icon: Bot, color: 'bg-green-100 text-green-700 border-green-300', team: 'xrai' },
];

interface DealFormProps {
  deal?: Deal;
  companies: Company[];
  currentUserId: string;
}

export function DealForm({ deal, companies, currentUserId }: DealFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!deal;

  // Parse existing products to selected categories
  const getInitialCategories = () => {
    if (!deal?.products) return [];
    const cats: string[] = [];
    if (deal.products.voice) cats.push('voice-phone');
    if (deal.products.platform) cats.push('xrai-platform');
    return cats;
  };

  const [formData, setFormData] = useState({
    name: deal?.name || '',
    company_id: deal?.company_id || '',
    stage: deal?.stage || 'new_lead' as DealStage,
    deal_type: deal?.deal_type || 'new_business' as DealType,
    sales_team: deal?.sales_team || null as SalesTeam | null,
    estimated_value: deal?.estimated_value || 0,
    expected_close_date: deal?.expected_close_date || '',
    competitor_mentioned: deal?.competitor_mentioned || '',
    products: deal?.products || { voice: false, platform: false, ai_agents: [] as string[] },
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>(getInitialCategories());

  // Smart defaults: when sales_team changes, suggest relevant products
  useEffect(() => {
    if (isEditing) return; // Don't auto-select on edit

    if (formData.sales_team === 'voice_outside' || formData.sales_team === 'voice_inside') {
      // Voice teams default to voice products
      if (selectedCategories.length === 0) {
        setSelectedCategories(['voice-phone']);
      }
    } else if (formData.sales_team === 'xrai') {
      // X-RAI team defaults to platform
      if (selectedCategories.length === 0) {
        setSelectedCategories(['xrai-platform']);
      }
    }
  }, [formData.sales_team, isEditing]);

  // Update products object when categories change
  useEffect(() => {
    const hasVoice = selectedCategories.some(c => c.startsWith('voice'));
    const hasPlatform = selectedCategories.includes('xrai-platform') || selectedCategories.includes('ai-agents');

    setFormData(prev => ({
      ...prev,
      products: {
        ...prev.products,
        voice: hasVoice,
        platform: hasPlatform,
      },
    }));
  }, [selectedCategories]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      owner_id: currentUserId,
      expected_close_date: formData.expected_close_date || null,
      competitor_mentioned: formData.competitor_mentioned || null,
    };

    let result;
    if (isEditing) {
      result = await supabase
        .from('deals')
        .update(payload)
        .eq('id', deal.id)
        .select()
        .single();
    } else {
      result = await supabase.from('deals').insert(payload).select().single();
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    router.push(`/deals/${result.data.id}`);
    router.refresh();
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deal Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deal Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Acme Corp - Voice + Platform"
          />
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company *
          </label>
          <select
            required
            value={formData.company_id}
            onChange={(e) =>
              setFormData({ ...formData, company_id: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {/* Deal Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deal Type
          </label>
          <select
            value={formData.deal_type}
            onChange={(e) =>
              setFormData({ ...formData, deal_type: e.target.value as DealType })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEAL_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sales Team */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sales Team
          </label>
          <select
            value={formData.sales_team || ''}
            onChange={(e) =>
              setFormData({ ...formData, sales_team: (e.target.value || null) as SalesTeam | null })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select team</option>
            {SALES_TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stage
          </label>
          <select
            value={formData.stage}
            onChange={(e) =>
              setFormData({ ...formData, stage: e.target.value as DealStage })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PIPELINE_STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        {/* Estimated Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Value (ACV)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              type="number"
              min="0"
              step="1000"
              value={formData.estimated_value}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimated_value: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Expected Close Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expected Close Date
          </label>
          <input
            type="date"
            value={formData.expected_close_date}
            onChange={(e) =>
              setFormData({ ...formData, expected_close_date: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Product Categories */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Categories
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PRODUCT_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategoryToggle(category.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    isSelected
                      ? cn(category.color, 'border-current')
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{category.label}</span>
                </button>
              );
            })}
          </div>
          {selectedCategories.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Select one or more product categories for this deal
            </p>
          )}
        </div>

        {/* Competitor */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Competitor Mentioned
          </label>
          <input
            type="text"
            value={formData.competitor_mentioned}
            onChange={(e) =>
              setFormData({ ...formData, competitor_mentioned: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., ServiceTitan, Housecall Pro"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : isEditing ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  );
}
