'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { KanbanBoard } from './KanbanBoard';
import { HumanLeverageMoments } from '@/components/dashboard';
import type { Deal, SalesTeam } from '@/types';

interface PipelineViewProps {
  initialDeals: Deal[];
  currentUserId: string;
  users: Array<{ id: string; name: string; email: string; team?: string }>;
  companies: Array<{ id: string; name: string }>;
}

type ProductFilter = 'all' | 'voice-phone' | 'voice-addons' | 'xrai-platform' | 'ai-agents';

export function PipelineView({ initialDeals, currentUserId, users, companies }: PipelineViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<SalesTeam | 'all'>('all');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');

  const filteredDeals = useMemo(() => {
    return initialDeals.filter(deal => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDealName = deal.name.toLowerCase().includes(query);
        const matchesCompanyName = deal.company?.name?.toLowerCase().includes(query);
        const matchesOwnerName = deal.owner?.name?.toLowerCase().includes(query);
        if (!matchesDealName && !matchesCompanyName && !matchesOwnerName) return false;
      }

      // Company filter
      if (companyFilter !== 'all' && deal.company_id !== companyFilter) return false;

      // Salesperson filter
      if (salespersonFilter !== 'all' && deal.owner_id !== salespersonFilter) return false;

      // Team filter (sales_team on the deal)
      if (teamFilter !== 'all' && deal.sales_team !== teamFilter) return false;

      // Product filter (based on products JSONB or primary_product_category_id)
      if (productFilter !== 'all') {
        const hasProduct = deal.primary_product_category_id === productFilter ||
          (deal.products?.voice && productFilter.startsWith('voice')) ||
          (deal.products?.platform && productFilter === 'xrai-platform');
        if (!hasProduct) return false;
      }

      return true;
    });
  }, [initialDeals, searchQuery, companyFilter, salespersonFilter, teamFilter, productFilter]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Pipeline</h1>
          <p className="text-xs text-gray-500 mt-1">
            {filteredDeals.length} of {initialDeals.length} deals
          </p>
        </div>
        <Link
          href="/deals/new"
          className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Deal
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals, companies, people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Companies</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>

          {/* Salesperson Filter */}
          <select
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Salespeople</option>
            <option value={currentUserId}>My Deals</option>
            {users.filter(u => u.id !== currentUserId).map(user => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value as SalesTeam | 'all')}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Teams</option>
            <option value="voice_outside">Voice Outside</option>
            <option value="voice_inside">Voice Inside</option>
            <option value="xrai">X-RAI</option>
          </select>

          {/* Product Category Filter */}
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value as ProductFilter)}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Products</option>
            <option value="voice-phone">Voice Phone System</option>
            <option value="voice-addons">Voice Add-ons</option>
            <option value="xrai-platform">X-RAI Platform</option>
            <option value="ai-agents">AI Agents</option>
          </select>
        </div>
      </div>

      {/* Human Leverage Moments */}
      <HumanLeverageMoments className="mb-4" />

      {/* Kanban Board */}
      <div className="flex-1 min-h-0">
        <KanbanBoard initialDeals={filteredDeals} />
      </div>
    </div>
  );
}
