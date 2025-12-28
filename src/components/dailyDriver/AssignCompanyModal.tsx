'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Building2, Loader2, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

interface AssignCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyId: string | null;
  currentCompanyName: string | null;
  communicationId?: string;
  onAssigned: (companyId: string, companyName: string) => void;
}

export function AssignCompanyModal({
  isOpen,
  onClose,
  currentCompanyId,
  currentCompanyName,
  communicationId,
  onAssigned,
}: AssignCompanyModalProps) {
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Debounced search
  const searchCompanies = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCompanies([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies?search=${encodeURIComponent(query)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error('Error searching companies:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCompanies(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchCompanies]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setCompanies([]);
      setSelectedCompanyId(null);
    }
  }, [isOpen]);

  const handleAssign = async (company: Company) => {
    if (isAssigning) return;

    setIsAssigning(true);
    setSelectedCompanyId(company.id);

    try {
      // If we have a communicationId, update the communication's company assignment
      if (communicationId) {
        const res = await fetch(`/api/communications/${communicationId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: company.id }),
        });

        if (!res.ok) {
          throw new Error('Failed to assign company');
        }
      }

      onAssigned(company.id, company.name);
      onClose();
    } catch (error) {
      console.error('Error assigning company:', error);
      alert('Failed to assign company');
    } finally {
      setIsAssigning(false);
      setSelectedCompanyId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Assign Company
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Current assignment */}
          {currentCompanyName && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-[#2a2a2a]">
              <p className="text-xs text-gray-500">
                Currently assigned to: <span className="font-medium text-gray-700 dark:text-gray-300">{currentCompanyName}</span>
              </p>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b border-gray-200 dark:border-[#2a2a2a]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies..."
                autoFocus
                className={cn(
                  'w-full pl-10 pr-4 py-2 text-sm rounded-lg border',
                  'bg-white dark:bg-gray-800',
                  'border-gray-200 dark:border-gray-700',
                  'text-gray-900 dark:text-gray-100',
                  'placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                )}
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto">
            {search.length < 2 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Type at least 2 characters to search
              </div>
            ) : companies.length === 0 && !isLoading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 mb-3">No companies found</p>
                <a
                  href="/companies/new"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Create new company
                </a>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {companies.map((company) => {
                  const isSelected = selectedCompanyId === company.id;
                  const isCurrent = currentCompanyId === company.id;

                  return (
                    <button
                      key={company.id}
                      onClick={() => handleAssign(company)}
                      disabled={isAssigning || isCurrent}
                      className={cn(
                        'w-full px-4 py-3 text-left flex items-center justify-between',
                        'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isCurrent && 'bg-blue-50 dark:bg-blue-900/20'
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {company.name}
                        </p>
                        {company.domain && (
                          <p className="text-xs text-gray-500">{company.domain}</p>
                        )}
                      </div>
                      {isCurrent ? (
                        <span className="text-xs text-blue-600 font-medium">Current</span>
                      ) : isSelected ? (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-gray-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
