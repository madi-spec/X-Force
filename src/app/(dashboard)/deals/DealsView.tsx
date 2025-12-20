'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, LayoutGrid, List, Building2 } from 'lucide-react';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { TableHeaderWithInfo, MetricLabel } from '@/components/ui/InfoTooltip';
import { MarkAsWonButton } from '@/components/deals/MarkAsWonButton';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { getHealthScoreColor, PIPELINE_STAGES } from '@/types';
import type { Deal, SalesTeam } from '@/types';

interface DealsViewProps {
  initialDeals: Deal[];
  currentUserId: string;
  users: Array<{ id: string; name: string; email: string; team?: string }>;
  companies: Array<{ id: string; name: string }>;
}

type ProductFilter = 'all' | 'voice-phone' | 'voice-addons' | 'xrai-platform' | 'ai-agents';
type ViewMode = 'pipeline' | 'list';

export function DealsView({ initialDeals, currentUserId, users, companies }: DealsViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
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
          <h1 className="text-xl font-normal text-gray-900">Deals</h1>
          <p className="text-xs text-gray-500 mt-1">
            {filteredDeals.length} of {initialDeals.length} deals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('pipeline')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                viewMode === 'pipeline'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
          <Link
            href="/deals/new"
            className="inline-flex items-center gap-2 h-9 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Deal
          </Link>
        </div>
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

      {/* Content based on view mode */}
      {viewMode === 'pipeline' ? (
        <div className="flex-1 min-h-0">
          <KanbanBoard initialDeals={filteredDeals} />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <TableHeaderWithInfo term="pipeline_value">Value</TableHeaderWithInfo>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <TableHeaderWithInfo term="deal_health_score">Health</TableHeaderWithInfo>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <TableHeaderWithInfo term="deal_owner">Owner</TableHeaderWithInfo>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Close
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeals.map((deal) => {
                const stage = PIPELINE_STAGES.find((s) => s.id === deal.stage);
                return (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link href={`/deals/${deal.id}`} className="block">
                        <p className="font-medium text-gray-900 hover:text-blue-600">
                          {deal.name}
                        </p>
                        {deal.company && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3.5 w-3.5" />
                            {deal.company.name}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white',
                          stage?.color || 'bg-gray-500'
                        )}
                      >
                        {stage?.name || deal.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(deal.estimated_value)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'font-medium',
                          getHealthScoreColor(deal.health_score)
                        )}
                      >
                        {deal.health_score}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {deal.owner?.name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {deal.expected_close_date
                        ? formatDate(deal.expected_close_date)
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
                        <MarkAsWonButton
                          dealId={deal.id}
                          dealName={deal.name}
                          dealValue={deal.estimated_value}
                          currentStage={deal.stage}
                          variant="icon"
                          onSuccess={() => router.refresh()}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {initialDeals.length === 0
                      ? 'No deals yet. Create your first deal to get started.'
                      : 'No deals match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
