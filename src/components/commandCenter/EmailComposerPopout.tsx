'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Mail,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  ChevronDown,
  Check,
} from 'lucide-react';
import { CommandCenterItem, EmailDraft, PrimaryContact } from '@/types/commandCenter';

interface ContactOption {
  id: string;
  name: string;
  email: string;
  title?: string;
}

// ============================================
// TYPES
// ============================================

interface EmailComposerPopoutProps {
  item: CommandCenterItem & {
    primary_contact?: PrimaryContact;
    email_draft?: EmailDraft;
  };
  onClose: () => void;
  onSent: () => void;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EmailComposerPopout({
  item,
  onClose,
  onSent,
  className,
}: EmailComposerPopoutProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Contact selection state
  const [availableContacts, setAvailableContacts] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);

  // Get contact from primary_contact or joined contact data
  const existingContact = item.primary_contact || (item as any).contact as PrimaryContact | undefined;

  // Use selected contact or existing contact
  const contact = selectedContact || existingContact;

  // Generate email draft from API
  const generateDraft = async () => {
    setRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/command-center/items/${item.id}/generate-email`, {
        method: 'POST',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to generate draft');
      }

      const result = await response.json();
      setSubject(result.subject);
      setBody(result.body);
      setConfidence(result.confidence);
    } catch (err) {
      console.error('[EmailComposer] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setRegenerating(false);
    }
  };

  // Initialize from email_draft or auto-generate
  useEffect(() => {
    if (item.email_draft) {
      setSubject(item.email_draft.subject);
      setBody(item.email_draft.body);
      setConfidence(item.email_draft.confidence);
    } else {
      // Default subject based on action type
      setSubject(item.title);
      // Auto-generate draft if we don't have one
      generateDraft();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch available contacts from company if no contact is linked
  useEffect(() => {
    async function fetchContacts() {
      // If we already have a contact, no need to fetch
      if (existingContact) return;

      // Get company_id from item or deal
      const companyId = item.company_id || (item as any).deal?.company_id;
      if (!companyId) return;

      setLoadingContacts(true);
      try {
        const response = await fetch(`/api/companies/${companyId}/contacts`);
        if (response.ok) {
          const data = await response.json();
          const contacts: ContactOption[] = (data.contacts || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            title: c.title,
          }));
          setAvailableContacts(contacts);
        }
      } catch (err) {
        console.error('[EmailComposer] Error fetching contacts:', err);
      } finally {
        setLoadingContacts(false);
      }
    }

    fetchContacts();
  }, [item.company_id, existingContact]);

  // Handle regenerate button click
  const handleRegenerate = () => {
    generateDraft();
  };

  // Handle send
  const handleSend = async () => {
    if (!contact?.email || !subject || !body) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/microsoft/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [contact!.email],
          subject,
          content: body,
          contactId: item.contact_id,
          dealId: item.deal_id,
          isHtml: false,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to send email');
      }

      // Mark item as completed
      await fetch(`/api/command-center/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      onSent();
    } catch (err) {
      console.error('[EmailComposer] Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
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
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-50',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Compose Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* To */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              To
            </label>
            {contact ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{contact.name}</span>
                <span className="text-sm text-gray-400">&lt;{contact.email}&gt;</span>
                {selectedContact && (
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : loadingContacts ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                <span className="text-sm text-gray-500">Loading contacts...</span>
              </div>
            ) : availableContacts.length > 0 ? (
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
                    {availableContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedContact(c);
                          setContactDropdownOpen(false);
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
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <User className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-700">No contacts found for this company</span>
              </div>
            )}
          </div>

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
          {regenerating && confidence === null ? (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700">Generating AI draft...</span>
            </div>
          ) : confidence !== null ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Sparkles className="h-4 w-4" />
                <span>AI Draft ({confidence}% confidence)</span>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate
              </button>
            </div>
          ) : null}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
          <button
            onClick={handleSend}
            disabled={!contact?.email || !subject || !body || sending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              contact?.email && subject && body && !sending
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
        </div>
      </div>
    </>
  );
}
