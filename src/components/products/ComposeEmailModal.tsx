'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Send,
  Loader2,
  User,
  Sparkles,
  RefreshCw,
  PenLine,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  email: string;
  title?: string;
}

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  companyId: string;
  companyName: string;
}

type Mode = 'choose' | 'ai-draft' | 'manual';

export function ComposeEmailModal({
  isOpen,
  onClose,
  onSent,
  companyId,
  companyName,
}: ComposeEmailModalProps) {
  // Mode selection
  const [mode, setMode] = useState<Mode>('choose');

  // Contact selection
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);

  // Email content
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // UI state
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch contacts when modal opens
  useEffect(() => {
    if (!isOpen || !companyId) return;

    async function fetchContacts() {
      setLoadingContacts(true);
      try {
        const res = await fetch(`/api/companies/${companyId}/contacts`);
        if (res.ok) {
          const data = await res.json();
          const contactList: Contact[] = (data.contacts || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            title: c.title,
          }));
          setContacts(contactList);

          // Auto-select first contact if only one
          if (contactList.length === 1) {
            setSelectedContact(contactList[0]);
          }
        }
      } catch (err) {
        console.error('[ComposeEmailModal] Error fetching contacts:', err);
      } finally {
        setLoadingContacts(false);
      }
    }

    fetchContacts();
  }, [isOpen, companyId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMode('choose');
      setSelectedContact(null);
      setSubject('');
      setBody('');
      setError(null);
      setContactDropdownOpen(false);
    }
  }, [isOpen]);

  // Generate AI draft
  const handleGenerateAIDraft = async () => {
    if (!selectedContact) {
      setError('Please select a contact first');
      return;
    }

    setGenerating(true);
    setError(null);
    setMode('ai-draft');

    try {
      const res = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyName,
          contactName: selectedContact.name,
          contactEmail: selectedContact.email,
          context: 'sales_outreach',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate email');
      }

      const data = await res.json();
      setSubject(data.subject || '');
      setBody(data.body || '');
    } catch (err) {
      console.error('[ComposeEmailModal] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
      // Fall back to manual mode
      setMode('manual');
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate draft
  const handleRegenerate = () => {
    handleGenerateAIDraft();
  };

  // Start manual composition
  const handleStartManual = () => {
    if (!selectedContact) {
      setError('Please select a contact first');
      return;
    }
    setError(null);
    setMode('manual');
    setSubject('');
    setBody('');
  };

  // Send email
  const handleSend = async () => {
    if (!selectedContact?.email) {
      setError('Please select a contact');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!body.trim()) {
      setError('Please enter a message');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/microsoft/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [selectedContact.email],
          subject,
          content: body,
          contactId: selectedContact.id,
          isHtml: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send email');
      }

      onSent?.();
      onClose();
    } catch (err) {
      console.error('[ComposeEmailModal] Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[60]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-[60]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Send Email</h2>
            <p className="text-sm text-gray-500">{companyName}</p>
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
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Contact Selection - Always visible */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              To
            </label>
            {loadingContacts ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                <span className="text-sm text-gray-500">Loading contacts...</span>
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <User className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-700">No contacts found for this company</span>
              </div>
            ) : selectedContact ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedContact.name}</span>
                <span className="text-sm text-gray-400">&lt;{selectedContact.email}&gt;</span>
                <button
                  onClick={() => {
                    setSelectedContact(null);
                    setContactDropdownOpen(true);
                  }}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setContactDropdownOpen(!contactDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Select a contact...</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-gray-400 transition-transform",
                    contactDropdownOpen && "rotate-180"
                  )} />
                </button>

                {contactDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-10 max-h-48 overflow-y-auto">
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedContact(c);
                          setContactDropdownOpen(false);
                          setError(null);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                      >
                        <User className="h-4 w-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700 truncate">{c.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {c.title ? `${c.title} · ` : ''}{c.email}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mode Selection */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">How would you like to compose this email?</p>

              <button
                onClick={handleGenerateAIDraft}
                disabled={!selectedContact || generating}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                  selectedContact && !generating
                    ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                    : "border-gray-200 opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">AI Draft</div>
                  <div className="text-xs text-gray-500">Let AI generate a personalized email based on company context</div>
                </div>
                {generating && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
              </button>

              <button
                onClick={handleStartManual}
                disabled={!selectedContact}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                  selectedContact
                    ? "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                    : "border-gray-200 opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <PenLine className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Write Myself</div>
                  <div className="text-xs text-gray-500">Compose your email from scratch</div>
                </div>
              </button>

              {!selectedContact && contacts.length > 0 && (
                <p className="text-xs text-amber-600 text-center mt-2">
                  Please select a contact above to continue
                </p>
              )}
            </div>
          )}

          {/* Email Composition (AI Draft or Manual) */}
          {(mode === 'ai-draft' || mode === 'manual') && (
            <div className="space-y-4">
              {/* Subject */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Enter subject"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-sm"
                  placeholder="Write your message..."
                />
              </div>

              {/* AI Draft Info */}
              {mode === 'ai-draft' && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Sparkles className="h-4 w-4" />
                    <span>AI-Generated Draft</span>
                  </div>
                  <button
                    onClick={handleRegenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div>
            {(mode === 'ai-draft' || mode === 'manual') && (
              <button
                onClick={() => setMode('choose')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to options
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {(mode === 'ai-draft' || mode === 'manual') && (
              <button
                onClick={handleSend}
                disabled={!selectedContact?.email || !subject || !body || sending}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  selectedContact?.email && subject && body && !sending
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
