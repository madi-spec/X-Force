'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Building2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

interface CompanyAssignmentDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (companyId: string) => Promise<void>;
  meetingSubject?: string;
}

export function CompanyAssignmentDropdown({
  isOpen,
  onClose,
  onSelect,
  meetingSubject,
}: CompanyAssignmentDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch companies on search
  const fetchCompanies = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) {
        params.set('search', query);
      }
      params.set('limit', '20');

      const response = await fetch(`/api/companies?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }
      const data = await response.json();
      setCompanies(data.companies || data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Failed to load companies');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchCompanies('');
    }
  }, [isOpen, fetchCompanies]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchCompanies(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, fetchCompanies]);

  const handleSelect = async (companyId: string) => {
    setAssigning(companyId);
    try {
      await onSelect(companyId);
      handleClose();
    } catch (err) {
      console.error('Error assigning company:', err);
      setError('Failed to assign company');
    } finally {
      setAssigning(null);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assign Company</h2>
            {meetingSubject && (
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">
                for &quot;{meetingSubject}&quot;
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Company list */}
          <div className="mt-4 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'No companies found' : 'No companies available'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleSelect(company.id)}
                    disabled={!!assigning}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors',
                      assigning === company.id
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {company.name}
                      </p>
                      {company.domain && (
                        <p className="text-xs text-gray-500 truncate">
                          {company.domain}
                        </p>
                      )}
                    </div>
                    {assigning === company.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
