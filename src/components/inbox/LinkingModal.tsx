'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Link2,
  Building2,
  Briefcase,
  User,
  Search,
  Plus,
  Loader2,
  Sparkles,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { Conversation } from './types';

interface LinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (dealId?: string, companyId?: string, contactId?: string) => void;
  conversation: Conversation;
  suggestedDomain?: string;
}

interface Company {
  id: string;
  name: string;
  domain?: string;
}

interface Deal {
  id: string;
  name: string;
  stage: string;
  company_id: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  company_id?: string;
}

type CreateMode = 'none' | 'company' | 'deal';

export function LinkingModal({
  isOpen,
  onClose,
  onLink,
  conversation,
  suggestedDomain,
}: LinkingModalProps) {
  const supabase = createClient();

  // Search state
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Create mode
  const [createMode, setCreateMode] = useState<CreateMode>('none');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [newDealName, setNewDealName] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract domain from conversation
  const extractedDomain = useMemo(() => {
    if (suggestedDomain) return suggestedDomain;

    // Try to extract from participants
    const participants = conversation.participants || [];
    for (const p of participants) {
      if (p.address && !p.address.includes('xraisales')) {
        const domain = p.address.split('@')[1];
        if (domain && !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)) {
          return domain;
        }
      }
    }
    return null;
  }, [conversation.participants, suggestedDomain]);

  // Pre-fill domain name
  useEffect(() => {
    if (extractedDomain && createMode === 'company') {
      setNewCompanyDomain(extractedDomain);
      // Generate company name from domain (e.g., "acme.com" -> "Acme")
      const baseName = extractedDomain.split('.')[0];
      setNewCompanyName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  }, [extractedDomain, createMode]);

  // Pre-fill deal name
  useEffect(() => {
    if (createMode === 'deal' && conversation.subject) {
      setNewDealName(conversation.subject.replace(/^(re:|fwd:|fw:)\s*/gi, '').slice(0, 100));
    }
  }, [createMode, conversation.subject]);

  // Search companies
  useEffect(() => {
    if (!isOpen) return;

    const searchCompanies = async () => {
      setLoadingCompanies(true);
      try {
        let query = supabase
          .from('companies')
          .select('id, name, domain')
          .order('name')
          .limit(20);

        if (companySearch) {
          query = query.or(`name.ilike.%${companySearch}%,domain.ilike.%${companySearch}%`);
        }

        const { data } = await query;
        if (data) setCompanies(data);
      } catch (err) {
        console.error('Error searching companies:', err);
      } finally {
        setLoadingCompanies(false);
      }
    };

    const debounce = setTimeout(searchCompanies, 200);
    return () => clearTimeout(debounce);
  }, [isOpen, companySearch]);

  // Load deals when company selected
  useEffect(() => {
    if (!selectedCompany) {
      setDeals([]);
      return;
    }

    const loadDeals = async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, name, stage, company_id')
        .eq('company_id', selectedCompany.id)
        .not('stage', 'in', '("closed_won","closed_lost")')
        .order('created_at', { ascending: false });

      if (data) setDeals(data);
    };

    loadDeals();
  }, [selectedCompany]);

  // Load contacts when company selected
  useEffect(() => {
    if (!selectedCompany) {
      setContacts([]);
      return;
    }

    const loadContacts = async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, email, company_id')
        .eq('company_id', selectedCompany.id)
        .order('name');

      if (data) setContacts(data);
    };

    loadContacts();
  }, [selectedCompany]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCompanySearch('');
      setSelectedCompany(null);
      setSelectedDeal(null);
      setSelectedContact(null);
      setCreateMode('none');
      setNewCompanyName('');
      setNewCompanyDomain('');
      setNewDealName('');
      setError(null);
    }
  }, [isOpen]);

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: createError } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName.trim(),
          domain: newCompanyDomain.trim() || null,
        })
        .select('id, name, domain')
        .single();

      if (createError) throw createError;

      setSelectedCompany(data);
      setCreateMode('none');
      setCompanies([data, ...companies]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!selectedCompany) {
      setError('Select a company first');
      return;
    }
    if (!newDealName.trim()) {
      setError('Deal name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: createError } = await supabase
        .from('deals')
        .insert({
          name: newDealName.trim(),
          company_id: selectedCompany.id,
          stage: 'new_lead',
        })
        .select('id, name, stage, company_id')
        .single();

      if (createError) throw createError;

      setSelectedDeal(data);
      setCreateMode('none');
      setDeals([data, ...deals]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedCompany && !selectedDeal && !selectedContact) {
      setError('Select at least a company, deal, or contact to link');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLink(
        selectedDeal?.id,
        selectedCompany?.id,
        selectedContact?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link conversation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Link Conversation</h2>
              <p className="text-sm text-gray-500">
                Connect this email to a company or deal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Domain hint */}
          {extractedDomain && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Sparkles className="h-4 w-4" />
                <span>Detected domain: <strong>{extractedDomain}</strong></span>
              </div>
            </div>
          )}

          {/* Company Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Building2 className="h-4 w-4" />
              Company
            </label>

            {selectedCompany ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">{selectedCompany.name}</span>
                  {selectedCompany.domain && (
                    <span className="text-xs text-green-600">({selectedCompany.domain})</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedCompany(null);
                    setSelectedDeal(null);
                    setSelectedContact(null);
                  }}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  Change
                </button>
              </div>
            ) : createMode === 'company' ? (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  autoFocus
                />
                <input
                  type="text"
                  value={newCompanyDomain}
                  onChange={(e) => setNewCompanyDomain(e.target.value)}
                  placeholder="Domain (e.g., acme.com)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreateMode('none')}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCompany}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Create Company
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Search companies..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {loadingCompanies ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : companies.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      No companies found
                    </div>
                  ) : (
                    companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => setSelectedCompany(company)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium text-gray-900">{company.name}</span>
                        {company.domain && (
                          <span className="ml-2 text-gray-500 text-xs">{company.domain}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setCreateMode('company')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg w-full justify-center"
                >
                  <Plus className="h-4 w-4" />
                  Create New Company
                  {extractedDomain && <span className="text-xs text-blue-400">from &quot;{extractedDomain}&quot;</span>}
                </button>
              </div>
            )}
          </div>

          {/* Deal Selection - only show when company selected */}
          {selectedCompany && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Briefcase className="h-4 w-4" />
                Deal (optional)
              </label>

              {selectedDeal ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">{selectedDeal.name}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-green-200 text-green-700 rounded">
                      {selectedDeal.stage.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDeal(null)}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ) : createMode === 'deal' ? (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={newDealName}
                    onChange={(e) => setNewDealName(e.target.value)}
                    placeholder="Deal name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreateMode('none')}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateDeal}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                    >
                      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Create Deal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {deals.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                      {deals.map((deal) => (
                        <button
                          key={deal.id}
                          onClick={() => setSelectedDeal(deal)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                        >
                          <span className="font-medium text-gray-900">{deal.name}</span>
                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {deal.stage.replace('_', ' ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg text-center">
                      No active deals for this company
                    </div>
                  )}

                  <button
                    onClick={() => setCreateMode('deal')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg w-full justify-center"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Deal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Contact Selection - only show when company selected */}
          {selectedCompany && contacts.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User className="h-4 w-4" />
                Contact (optional)
              </label>

              {selectedContact ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">{selectedContact.name}</span>
                    <span className="text-xs text-green-600">{selectedContact.email}</span>
                  </div>
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{contact.name}</span>
                      <span className="ml-2 text-gray-500 text-xs">{contact.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={loading || (!selectedCompany && !selectedDeal && !selectedContact)}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Link2 className="h-4 w-4" />
            Link Conversation
          </button>
        </div>
      </div>
    </div>
  );
}
