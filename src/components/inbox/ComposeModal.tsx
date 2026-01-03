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
import { marked } from 'marked';
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
  initialBody?: string;
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
  initialBody,
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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Company search state
  const [companySearch, setCompanySearch] = useState('');
  const [companySearchResults, setCompanySearchResults] = useState<Company[]>([]);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User info for signature
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    title?: string;
    phone?: string;
  } | null>(null);

  // Fetch user info for signature
  useEffect(() => {
    if (!isOpen) return;

    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('name, email, title, phone')
        .eq('auth_id', user.id)
        .single();

      if (profile) {
        setUserInfo({
          name: profile.name || user.email?.split('@')[0] || 'User',
          email: profile.email || user.email || '',
          title: profile.title,
          phone: profile.phone,
        });
      }
    };

    fetchUserInfo();
  }, [isOpen, supabase]);

  // Initialize with pre-filled data
  useEffect(() => {
    if (isOpen) {
      if (toEmail) {
        setRecipients([{ email: toEmail, name: toName }]);
      }
      if (initialSubject) setSubject(initialSubject);
      if (initialBody) setContent(initialBody);
      if (initialContactId) setContactId(initialContactId);
      if (initialCompanyId) setCompanyId(initialCompanyId);
      if (initialDealId) setDealId(initialDealId);
    }
  }, [isOpen, toEmail, toName, initialSubject, initialBody, initialContactId, initialCompanyId, initialDealId]);

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
      setCompanySearch('');
      setCompanySearchResults([]);
      setShowCompanySearch(false);
      setSelectedCompanyName('');
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

  // Load initial company name if companyId is provided
  useEffect(() => {
    if (!isOpen || !initialCompanyId) return;

    const loadInitialCompany = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', initialCompanyId)
        .single();

      if (data) {
        setSelectedCompanyName(data.name);
      }
    };

    loadInitialCompany();
  }, [isOpen, initialCompanyId, supabase]);

  // Search companies
  useEffect(() => {
    if (!companySearch || companySearch.length < 2) {
      setCompanySearchResults([]);
      return;
    }

    const search = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${companySearch}%`)
        .order('name')
        .limit(10);

      if (data) {
        setCompanySearchResults(data);
      }
    };

    const debounce = setTimeout(search, 200);
    return () => clearTimeout(debounce);
  }, [companySearch, supabase]);

  // Load deals
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      const { data: dealsRes } = await supabase
        .from('deals')
        .select('id, name, company_id')
        .not('stage', 'in', '("closed_won","closed_lost")')
        .order('created_at', { ascending: false })
        .limit(50);

      if (dealsRes) setDeals(dealsRes);
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
      // Convert markdown to HTML for email
      // Build signature in markdown
      let signature = '';
      if (userInfo) {
        const sigParts = [
          userInfo.name,
          userInfo.title,
          userInfo.phone,
          userInfo.email,
        ].filter(Boolean);
        signature = '\n\n' + sigParts.join('  \n'); // Two spaces + newline = <br> in markdown
      }

      const fullContent = content + signature;

      // Configure marked for email-friendly output
      marked.setOptions({
        breaks: true, // Convert \n to <br>
        gfm: true,    // GitHub Flavored Markdown
      });

      const htmlBody = await marked.parse(fullContent);

      // Wrap in minimal email-safe HTML
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000;">
${htmlBody}
</body>
</html>`;

      const res = await fetch('/api/microsoft/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients.map(r => r.email),
          cc: ccRecipients.length > 0 ? ccRecipients.map(r => r.email) : undefined,
          subject,
          content: htmlContent,
          isHtml: true,
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
              <div className="flex-1 relative">
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
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setShowContactSearch(true);
                    }}
                    onFocus={() => setShowContactSearch(true)}
                    onBlur={() => {
                      setTimeout(() => setShowContactSearch(false), 200);
                    }}
                    placeholder="Enter email address..."
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && contactSearch.includes('@')) {
                        e.preventDefault();
                        addRecipient(contactSearch.trim());
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (contactSearch.includes('@')) {
                        addRecipient(contactSearch.trim());
                      }
                    }}
                    disabled={!contactSearch.includes('@')}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {showContactSearch && contacts.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
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

              {/* Searchable Company Selector */}
              <div className="relative">
                <div className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={showCompanySearch ? companySearch : selectedCompanyName}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      setShowCompanySearch(true);
                    }}
                    onFocus={() => setShowCompanySearch(true)}
                    placeholder="Search company..."
                    className="w-40 px-2 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {companyId && (
                    <button
                      onClick={() => {
                        setCompanyId(undefined);
                        setSelectedCompanyName('');
                        setCompanySearch('');
                        setDealId(undefined);
                      }}
                      className="p-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Company search dropdown */}
                {showCompanySearch && companySearchResults.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {companySearchResults.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setCompanyId(company.id);
                          setSelectedCompanyName(company.name);
                          setCompanySearch('');
                          setShowCompanySearch(false);
                          setDealId(undefined);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {company.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Click outside to close */}
                {showCompanySearch && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowCompanySearch(false);
                      setCompanySearch('');
                    }}
                  />
                )}
              </div>

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
