'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Send,
  Loader2,
  User,
  Building2,
  Briefcase,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  // Pre-fill options
  toEmail?: string;
  toName?: string;
  subject?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  company_id?: string;
  company?: { id: string; name: string };
}

interface Company {
  id: string;
  name: string;
}

interface Deal {
  id: string;
  name: string;
  company_id: string;
}

interface Recipient {
  email: string;
  name?: string;
}

export function ComposeModal({
  isOpen,
  onClose,
  onSent,
  toEmail,
  toName,
  subject: initialSubject,
  contactId: initialContactId,
  companyId: initialCompanyId,
  dealId: initialDealId,
}: ComposeModalProps) {
  const supabase = createClient();

  // Form state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [showCc, setShowCc] = useState(false);

  // Linking
  const [contactId, setContactId] = useState<string | undefined>();
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [dealId, setDealId] = useState<string | undefined>();

  // Search state
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showContactSearch, setShowContactSearch] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with pre-filled data
  useEffect(() => {
    if (isOpen) {
      if (toEmail) {
        setRecipients([{ email: toEmail, name: toName }]);
      }
      if (initialSubject) setSubject(initialSubject);
      if (initialContactId) setContactId(initialContactId);
      if (initialCompanyId) setCompanyId(initialCompanyId);
      if (initialDealId) setDealId(initialDealId);
    }
  }, [isOpen, toEmail, toName, initialSubject, initialContactId, initialCompanyId, initialDealId]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setRecipients([]);
      setCcRecipients([]);
      setSubject('');
      setContent('');
      setShowCc(false);
      setContactId(undefined);
      setCompanyId(undefined);
      setDealId(undefined);
      setContactSearch('');
      setShowContactSearch(false);
      setError(null);
    }
  }, [isOpen]);

  // Search contacts
  useEffect(() => {
    if (!contactSearch || contactSearch.length < 2) {
      setContacts([]);
      return;
    }

    const search = async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, email, company_id, company:companies(id, name)')
        .or(`name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%`)
        .limit(10);

      if (data) {
        setContacts(data.map(c => ({
          ...c,
          company: Array.isArray(c.company) ? c.company[0] : c.company,
        })));
      }
    };

    const debounce = setTimeout(search, 200);
    return () => clearTimeout(debounce);
  }, [contactSearch, supabase]);

  // Load companies and deals
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      const [companiesRes, dealsRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name').limit(50),
        supabase.from('deals').select('id, name, company_id')
          .not('stage', 'in', '("closed_won","closed_lost")')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (dealsRes.data) setDeals(dealsRes.data);
    };

    loadData();
  }, [isOpen, supabase]);

  const addRecipient = (email: string, name?: string) => {
    if (!email || recipients.some(r => r.email === email)) return;
    setRecipients([...recipients, { email, name }]);
    setContactSearch('');
    setShowContactSearch(false);
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r.email !== email));
  };

  const addCcRecipient = (email: string, name?: string) => {
    if (!email || ccRecipients.some(r => r.email === email)) return;
    setCcRecipients([...ccRecipients, { email, name }]);
  };

  const removeCcRecipient = (email: string) => {
    setCcRecipients(ccRecipients.filter(r => r.email !== email));
  };

  const selectContact = (contact: Contact) => {
    addRecipient(contact.email, contact.name);
    setContactId(contact.id);
    if (contact.company_id) {
      setCompanyId(contact.company_id);
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      setError('Please add at least one recipient');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!content.trim()) {
      setError('Please enter a message');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/microsoft/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients.map(r => r.email),
          cc: ccRecipients.length > 0 ? ccRecipients.map(r => r.email) : undefined,
          subject,
          content,
          contactId,
          dealId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      onSent?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Email</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* To field */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-start gap-2">
              <span className="text-sm text-gray-500 py-1.5 w-12">To:</span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {recipients.map((r) => (
                    <span
                      key={r.email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-sm"
                    >
                      {r.name || r.email}
                      <button
                        onClick={() => removeRecipient(r.email)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setShowContactSearch(true);
                    }}
                    onFocus={() => setShowContactSearch(true)}
                    placeholder="Search contacts or enter email..."
                    className="w-full px-2 py-1.5 text-sm border-0 focus:ring-0 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && contactSearch.includes('@')) {
                        e.preventDefault();
                        addRecipient(contactSearch);
                      }
                    }}
                  />
                  {showContactSearch && contacts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => selectContact(contact)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                        >
                          <div className="font-medium text-gray-900">{contact.name}</div>
                          <div className="text-xs text-gray-500">
                            {contact.email}
                            {contact.company && ` - ${contact.company.name}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!showCc && (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 py-1.5"
                >
                  Cc
                </button>
              )}
            </div>
          </div>

          {/* Cc field */}
          {showCc && (
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 py-1.5 w-12">Cc:</span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {ccRecipients.map((r) => (
                      <span
                        key={r.email}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm"
                      >
                        {r.name || r.email}
                        <button
                          onClick={() => removeCcRecipient(r.email)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    className="w-full px-2 py-1.5 text-sm border-0 focus:ring-0 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.includes('@')) {
                          addCcRecipient(input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-12">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject..."
                className="flex-1 px-2 py-1.5 text-sm border-0 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>

          {/* Link to Deal/Company */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Link to:</span>
              <select
                value={companyId || ''}
                onChange={(e) => {
                  setCompanyId(e.target.value || undefined);
                  setDealId(undefined);
                }}
                className="px-2 py-1 text-xs border border-gray-200 rounded bg-white"
              >
                <option value="">Company (optional)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={dealId || ''}
                onChange={(e) => setDealId(e.target.value || undefined)}
                className="px-2 py-1 text-xs border border-gray-200 rounded bg-white"
              >
                <option value="">Deal (optional)</option>
                {deals
                  .filter(d => !companyId || d.company_id === companyId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Body */}
          <div className="p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message..."
              rows={12}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={loading || recipients.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
