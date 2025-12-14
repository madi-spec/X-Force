'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, MapPin, Users, Search, Phone, Zap, Bot, DollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { CompanyStatus, Segment } from '@/types';

interface CompanyWithRelations {
  id: string;
  name: string;
  status: CompanyStatus;
  segment: Segment;
  agent_count: number;
  voice_customer: boolean;
  address?: { city?: string; state?: string } | null;
  contacts: Array<{ id: string; name: string; is_primary: boolean }>;
  deals: Array<{ id: string; name: string; stage: string; estimated_value: number }>;
  products: Array<{ id: string; name: string; category_id: string }>;
}

interface CompanyListProps {
  companies: CompanyWithRelations[];
}

const segmentLabels: Record<string, string> = {
  smb: 'SMB',
  mid_market: 'Mid-Market',
  enterprise: 'Enterprise',
  pe_platform: 'PE Platform',
  franchisor: 'Franchisor',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  cold_lead: { label: 'Cold Lead', color: 'bg-gray-100 text-gray-700' },
  prospect: { label: 'Prospect', color: 'bg-blue-100 text-blue-700' },
  customer: { label: 'Customer', color: 'bg-green-100 text-green-700' },
  churned: { label: 'Churned', color: 'bg-red-100 text-red-700' },
};

// Product category icons by category_id
const productCategoryIcons: Record<string, { icon: any; color: string; label: string }> = {
  'voice-phone': { icon: Phone, color: 'bg-purple-100 text-purple-600', label: 'Voice' },
  'voice-addons': { icon: Phone, color: 'bg-purple-50 text-purple-500', label: 'Voice Add-on' },
  'xrai-platform': { icon: Zap, color: 'bg-blue-100 text-blue-600', label: 'X-RAI' },
  'ai-agents': { icon: Bot, color: 'bg-green-100 text-green-600', label: 'AI Agent' },
};

export function CompanyList({ companies }: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'all'>('all');
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | 'voice' | 'xrai'>('all');

  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = company.name.toLowerCase().includes(query);
        const matchesContact = company.contacts?.some(c => c.name.toLowerCase().includes(query));
        if (!matchesName && !matchesContact) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && company.status !== statusFilter) return false;

      // Segment filter
      if (segmentFilter !== 'all' && company.segment !== segmentFilter) return false;

      // Team filter
      if (teamFilter === 'voice' && !company.voice_customer) return false;
      if (teamFilter === 'xrai') {
        const hasXraiProduct = company.products?.some(p =>
          p.category_id === 'xrai-platform' || p.category_id === 'ai-agents'
        );
        if (!hasXraiProduct) return false;
      }

      return true;
    });
  }, [companies, searchQuery, statusFilter, segmentFilter, teamFilter]);

  const getActiveDeals = (company: CompanyWithRelations) => {
    return company.deals?.filter(d =>
      !['closed_won', 'closed_lost'].includes(d.stage)
    ) || [];
  };

  const getPipelineValue = (company: CompanyWithRelations) => {
    return getActiveDeals(company).reduce((sum, d) => sum + (d.estimated_value || 0), 0);
  };

  const getPrimaryContact = (company: CompanyWithRelations) => {
    return company.contacts?.find(c => c.is_primary) || company.contacts?.[0];
  };

  const getUniqueProductCategories = (company: CompanyWithRelations) => {
    const categories = new Set<string>();
    company.products?.forEach(p => {
      if (p.category_id) categories.add(p.category_id);
    });
    return Array.from(categories);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filteredCompanies.length} of {companies.length} companies
          </p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Company
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies or contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CompanyStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Status</option>
            <option value="cold_lead">Cold Leads</option>
            <option value="prospect">Prospects</option>
            <option value="customer">Customers</option>
            <option value="churned">Churned</option>
          </select>

          {/* Segment Filter */}
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value as Segment | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Segments</option>
            <option value="smb">SMB</option>
            <option value="mid_market">Mid-Market</option>
            <option value="enterprise">Enterprise</option>
            <option value="pe_platform">PE Platform</option>
            <option value="franchisor">Franchisor</option>
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value as 'all' | 'voice' | 'xrai')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Teams</option>
            <option value="voice">Voice Customers</option>
            <option value="xrai">X-RAI Customers</option>
          </select>
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Products
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pipeline
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Primary Contact
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCompanies.map((company) => {
              const status = statusConfig[company.status] || statusConfig.cold_lead;
              const primaryContact = getPrimaryContact(company);
              const activeDeals = getActiveDeals(company);
              const pipelineValue = getPipelineValue(company);
              const productCategories = getUniqueProductCategories(company);

              return (
                <tr key={company.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <Link href={`/companies/${company.id}`} className="block">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 hover:text-blue-600">
                              {company.name}
                            </p>
                            <span className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              status.color
                            )}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            <span>{segmentLabels[company.segment] || company.segment}</span>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {company.agent_count} agents
                            </span>
                            {company.address?.city && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {company.address.city}, {company.address.state}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {productCategories.length > 0 ? (
                        productCategories.map(categoryId => {
                          const config = productCategoryIcons[categoryId];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <span
                              key={categoryId}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                                config.color
                              )}
                              title={config.label}
                            >
                              <Icon className="h-3 w-3" />
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {activeDeals.length > 0 ? (
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {activeDeals.length} deal{activeDeals.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-gray-500 flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatCurrency(pipelineValue)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No active deals</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {primaryContact ? primaryContact.name : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/deals/new?company=${company.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Deal
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredCompanies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {companies.length === 0
                    ? 'No companies yet. Add your first company to get started.'
                    : 'No companies match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
