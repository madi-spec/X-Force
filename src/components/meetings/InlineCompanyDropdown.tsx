'use client';

import { useState, useRef, useEffect, useTransition, useCallback } from 'react';
import { Building2, Plus, X, Search, Check, Loader2 } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  domain?: string | null;
}

interface InlineCompanyDropdownProps {
  meetingId: string;
  companyId: string | null;
  companyName: string | null;
  onCompanyChange?: (companyId: string | null, companyName: string | null) => void;
  disabled?: boolean;
}

export function InlineCompanyDropdown({
  meetingId,
  companyId: initialCompanyId,
  companyName: initialCompanyName,
  onCompanyChange,
  disabled = false,
}: InlineCompanyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch companies
  const fetchCompanies = useCallback(async (query: string) => {
    setLoading(true);
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
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      fetchCompanies('');
    }
  }, [isOpen, fetchCompanies]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchCompanies(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, isOpen, fetchCompanies]);

  // Update local state when props change
  useEffect(() => {
    setCompanyId(initialCompanyId);
    setCompanyName(initialCompanyName);
  }, [initialCompanyId, initialCompanyName]);

  const handleAssign = (company: Company | null) => {
    const newCompanyId = company?.id || null;
    const newCompanyName = company?.name || null;

    // Optimistic update
    const previousId = companyId;
    const previousName = companyName;
    setCompanyId(newCompanyId);
    setCompanyName(newCompanyName);

    setIsOpen(false);
    setSearch('');

    startTransition(async () => {
      try {
        const response = await fetch(`/api/activities/${meetingId}/assign-company`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: newCompanyId }),
        });

        if (!response.ok) {
          throw new Error('Failed to assign company');
        }

        onCompanyChange?.(newCompanyId, newCompanyName);
      } catch (err) {
        // Revert on error
        console.error('Failed to assign company:', err);
        setCompanyId(previousId);
        setCompanyName(previousName);
      }
    });
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.domain && c.domain.toLowerCase().includes(search.toLowerCase()))
  );

  const isAssigned = companyId !== null;
  const isLoading = isPending || loading;

  if (disabled) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-gray-500">
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[150px] truncate">{companyName || 'Unassigned'}</span>
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isPending}
        className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-colors ${
          isAssigned
            ? 'text-gray-600 hover:bg-gray-100'
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
        } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[150px] truncate">{companyName || 'Assign Company'}</span>
        {!isAssigned && <Plus className="w-3 h-3" />}
        {isPending && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30 min-w-[260px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Company list */}
          <div className="max-h-[240px] overflow-y-auto">
            {/* Remove assignment option */}
            {isAssigned && (
              <button
                onClick={() => handleAssign(null)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100"
              >
                <X className="w-4 h-4" />
                Remove assignment
              </button>
            )}

            {/* Loading state */}
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleAssign(company)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    company.id === companyId
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{company.name}</div>
                    {company.domain && (
                      <div className="truncate text-xs text-gray-500">{company.domain}</div>
                    )}
                  </div>
                  {company.id === companyId && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {search ? 'No companies found' : 'No companies available'}
              </div>
            )}
          </div>

          {/* Create new company hint */}
          {search && filteredCompanies.length === 0 && !isLoading && (
            <div className="px-3 py-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Company not found? Create one in the Companies section.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
