'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Building2, Loader2, Check, Plus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

interface Communication {
  id: string;
  company_id: string | null;
  company?: { id: string; name: string } | null;
}

interface AssignToCompanyModalProps {
  communication: Communication;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignToCompanyModal({
  communication,
  onClose,
  onAssigned,
}: AssignToCompanyModalProps) {
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [mode, setMode] = useState<'search' | 'create'>('search');

  // New company form
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const currentCompanyId = communication.company_id;
  const currentCompanyName = communication.company?.name || null;

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

  const handleAssign = async (company: Company) => {
    if (isAssigning) return;

    setIsAssigning(true);
    setSelectedCompanyId(company.id);

    try {
      const res = await fetch(`/api/communications/${communication.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id }),
      });

      if (!res.ok) {
        throw new Error('Failed to assign company');
      }

      onAssigned();
      onClose();
    } catch (error) {
      console.error('Error assigning company:', error);
      alert('Failed to assign company');
    } finally {
      setIsAssigning(false);
      setSelectedCompanyId(null);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!newCompanyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    setIsCreating(true);
    try {
      // Create the company
      const createRes = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompanyName.trim(),
          domain: newCompanyDomain.trim() || null,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create company');
      }

      const { company } = await createRes.json();

      // Assign the communication to the new company
      const assignRes = await fetch(`/api/communications/${communication.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id }),
      });

      if (!assignRes.ok) {
        throw new Error('Failed to assign company');
      }

      onAssigned();
      onClose();
    } catch (error) {
      console.error('Error creating/assigning company:', error);
      alert(error instanceof Error ? error.message : 'Failed to create company');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {mode === 'create' && (
                <button
                  onClick={() => setMode('search')}
                  className="p-1 rounded hover:bg-gray-100 transition-colors mr-1"
                >
                  <ArrowLeft className="h-4 w-4 text-gray-500" />
                </button>
              )}
              <Building2 className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900">
                {mode === 'search' ? 'Assign to Company' : 'Create New Company'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {mode === 'search' ? (
            <>
              {/* Current assignment */}
              {currentCompanyName && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs text-gray-500">
                    Currently assigned to: <span className="font-medium text-gray-700">{currentCompanyName}</span>
                  </p>
                </div>
              )}

              {/* Search */}
              <div className="p-4 border-b border-gray-200">
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
                      'bg-white border-gray-200',
                      'text-gray-900 placeholder:text-gray-400',
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
                    <p className="text-sm text-gray-500 mb-3">No companies found for "{search}"</p>
                    <button
                      onClick={() => {
                        setNewCompanyName(search);
                        setMode('create');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Create "{search}"
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
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
                            'hover:bg-gray-50 transition-colors',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            isCurrent && 'bg-blue-50'
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
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

              {/* Create New Button */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setMode('create')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create New Company
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Create Company Form */}
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    autoFocus
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white border-gray-200',
                      'text-gray-900 placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain (optional)
                  </label>
                  <input
                    type="text"
                    value={newCompanyDomain}
                    onChange={(e) => setNewCompanyDomain(e.target.value)}
                    placeholder="example.com"
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white border-gray-200',
                      'text-gray-900 placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>
              </div>

              {/* Create Button */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleCreateAndAssign}
                  disabled={isCreating || !newCompanyName.trim()}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                    'bg-blue-600 hover:bg-blue-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Create & Assign
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
