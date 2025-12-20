'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Briefcase,
  Search,
  Loader2,
  DollarSign,
  Check,
} from 'lucide-react';
import { CommandCenterItem } from '@/types/commandCenter';

interface Deal {
  id: string;
  name: string;
  stage: string;
  estimated_value: number;
  probability: number;
  company?: { name: string };
}

interface LinkDealPopoutProps {
  item: CommandCenterItem;
  onClose: () => void;
  onLinked: () => void;
  className?: string;
}

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function LinkDealPopout({
  item,
  onClose,
  onLinked,
  className,
}: LinkDealPopoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch deals on mount
  useEffect(() => {
    async function fetchDeals() {
      setLoading(true);
      try {
        const response = await fetch('/api/deals?limit=50&status=active');
        if (response.ok) {
          const data = await response.json();
          setDeals(data.deals || []);
        }
      } catch (err) {
        console.error('[LinkDealPopout] Error fetching deals:', err);
        setError('Failed to load deals');
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  // Filter deals by search query
  const filteredDeals = deals.filter(deal =>
    deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.company?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle linking a deal
  const handleLinkDeal = async (dealId: string) => {
    setLinking(true);
    setError(null);

    try {
      const response = await fetch(`/api/command-center/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to link deal');
      }

      onLinked();
    } catch (err) {
      console.error('[LinkDealPopout] Error linking deal:', err);
      setError(err instanceof Error ? err.message : 'Failed to link deal');
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-xl shadow-2xl z-50',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Link to Deal</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Action context */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Linking: <span className="font-medium text-gray-900">{item.title}</span>
            </p>
            {item.company_name && (
              <p className="text-xs text-gray-500 mt-1">Company: {item.company_name}</p>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deals..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>

          {/* Deals list */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No deals match your search' : 'No active deals found'}
              </div>
            ) : (
              filteredDeals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => handleLinkDeal(deal.id)}
                  disabled={linking}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                >
                  <Briefcase className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {deal.name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      {deal.company?.name && <span>{deal.company.name}</span>}
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium capitalize">
                        {deal.stage.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <DollarSign className="h-4 w-4" />
                    {formatValue(deal.estimated_value)}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
