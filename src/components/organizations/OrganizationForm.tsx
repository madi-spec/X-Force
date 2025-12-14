'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Company, CompanyStatus, Segment, Industry, CRMPlatform } from '@/types';

interface OrganizationFormProps {
  organization?: Company;
}

export function OrganizationForm({ organization }: OrganizationFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!organization;

  const [formData, setFormData] = useState({
    name: organization?.name || '',
    status: organization?.status || 'cold_lead' as CompanyStatus,
    segment: organization?.segment || 'smb' as Segment,
    industry: organization?.industry || 'pest' as Industry,
    agent_count: organization?.agent_count || 0,
    crm_platform: organization?.crm_platform || null as CRMPlatform,
    voice_customer: organization?.voice_customer || false,
    address: organization?.address || {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      address: formData.address.street ? formData.address : null,
    };

    let result;
    if (isEditing) {
      result = await supabase
        .from('companies')
        .update(payload)
        .eq('id', organization.id)
        .select()
        .single();
    } else {
      result = await supabase.from('companies').insert(payload).select().single();
    }

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    router.push(`/organizations/${result.data.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Acme Pest Control"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as CompanyStatus })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="cold_lead">Cold Lead</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        {/* Segment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Segment
          </label>
          <select
            value={formData.segment}
            onChange={(e) =>
              setFormData({ ...formData, segment: e.target.value as Segment })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="smb">SMB (1-5 agents)</option>
            <option value="mid_market">Mid-Market (6-20 agents)</option>
            <option value="enterprise">Enterprise (21-100 agents)</option>
            <option value="pe_platform">PE Platform (100+ multi-location)</option>
            <option value="franchisor">Franchisor</option>
          </select>
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Industry
          </label>
          <select
            value={formData.industry}
            onChange={(e) =>
              setFormData({ ...formData, industry: e.target.value as Industry })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pest">Pest Control</option>
            <option value="lawn">Lawn Care</option>
            <option value="both">Both</option>
          </select>
        </div>

        {/* Agent Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agent Count
          </label>
          <input
            type="number"
            min="0"
            value={formData.agent_count}
            onChange={(e) =>
              setFormData({ ...formData, agent_count: parseInt(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* CRM Platform */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CRM Platform
          </label>
          <select
            value={formData.crm_platform || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                crm_platform: (e.target.value || null) as CRMPlatform,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unknown</option>
            <option value="fieldroutes">FieldRoutes</option>
            <option value="pestpac">PestPac</option>
            <option value="realgreen">RealGreen</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Voice Customer */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.voice_customer}
              onChange={(e) =>
                setFormData({ ...formData, voice_customer: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Existing Voice Customer
            </span>
          </label>
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Street Address"
                value={formData.address.street}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, street: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="City"
                value={formData.address.city}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, city: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="State"
                value={formData.address.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, state: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="ZIP"
                value={formData.address.zip}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, zip: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
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
          {loading ? 'Saving...' : isEditing ? 'Update' : 'Create Organization'}
        </button>
      </div>
    </form>
  );
}
