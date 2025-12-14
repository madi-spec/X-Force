'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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

interface DealFormProps {
  deal?: Deal;
  companies: Company[];
  currentUserId: string;
}

export function DealForm({ deal, companies, currentUserId }: DealFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!deal;

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

  const handleProductChange = (product: 'voice' | 'platform') => {
    setFormData((prev) => ({
      ...prev,
      products: {
        ...prev.products,
        [product]: !prev.products[product],
      },
    }));
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

        {/* Products */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Products
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.products.voice}
                onChange={() => handleProductChange('voice')}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Voice</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.products.platform}
                onChange={() => handleProductChange('platform')}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">X-RAI Platform</span>
            </label>
          </div>
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
