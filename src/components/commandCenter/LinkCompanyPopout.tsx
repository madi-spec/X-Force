'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Building2,
  Search,
  Loader2,
  Globe,
} from 'lucide-react';
import { CommandCenterItem } from '@/types/commandCenter';

interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
}

interface LinkCompanyPopoutProps {
  item: CommandCenterItem;
  onClose: () => void;
  onLinked: () => void;
  className?: string;
}

export function LinkCompanyPopout({
  item,
  onClose,
  onLinked,
  className,
}: LinkCompanyPopoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch companies on mount
  useEffect(() => {
    async function fetchCompanies() {
      setLoading(true);
      try {
        const response = await fetch('/api/companies?limit=50');
        if (response.ok) {
          const data = await response.json();
          setCompanies(data.companies || []);
        }
      } catch (err) {
        console.error('[LinkCompanyPopout] Error fetching companies:', err);
        setError('Failed to load companies');
      } finally {
        setLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  // Filter companies by search query
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle linking a company
  const handleLinkCompany = async (companyId: string) => {
    setLinking(true);
    setError(null);

    try {
      const response = await fetch(`/api/command-center/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to link company');
      }

      onLinked();
    } catch (err) {
      console.error('[LinkCompanyPopout] Error linking company:', err);
      setError(err instanceof Error ? err.message : 'Failed to link company');
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
            <Building2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Link to Company</h2>
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
            {item.target_name && (
              <p className="text-xs text-gray-500 mt-1">Contact: {item.target_name}</p>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>

          {/* Companies list */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No companies match your search' : 'No companies found'}
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleLinkCompany(company.id)}
                  disabled={linking}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                >
                  <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {company.name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      {company.industry && <span>{company.industry}</span>}
                      {company.website && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </span>
                      )}
                    </div>
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
