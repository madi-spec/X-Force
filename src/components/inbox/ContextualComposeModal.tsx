'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  Loader2,
  User,
  Building2,
  Briefcase,
  Plus,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// Context types that can trigger email composition
export type ComposeContext =
  | 'transcript_followup'
  | 'transcript_summary'
  | 'meeting_prep'
  | 'deal_followup'
  | 'contact_outreach'
  | 'account_trigger'
  | 'scheduling'
  | 'general';

export interface RecipientWithConfidence {
  email: string;
  name?: string;
  role?: string; // 'organizer' | 'attendee' | 'speaker' | 'primary_contact' | 'contact'
  confidence: number; // 0-100
  source?: string; // Where this recipient came from
}

export interface ComposeContextData {
  // Context type
  type: ComposeContext;

  // Source data
  transcriptId?: string;
  meetingId?: string;
  dealId?: string;
  companyId?: string;
  contactId?: string;
  schedulingRequestId?: string;

  // Pre-filled content
  suggestedSubject?: string;
  suggestedBody?: string;

  // Recipients from context
  recipients?: RecipientWithConfidence[];

  // AI-generated warnings/suggestions
  editSuggestions?: string[];

  // Source metadata for tracking
  sourceLabel?: string; // e.g., "Q4 Planning Call transcript"
}

interface ContextualComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  context: ComposeContextData;
}

interface Recipient {
  email: string;
  name?: string;
  confidence?: number;
  role?: string;
}

interface Deal {
  id: string;
  name: string;
  company_id: string;
}

export function ContextualComposeModal({
  isOpen,
  onClose,
  onSent,
  context,
}: ContextualComposeModalProps) {
  const supabase = createClient();

  // Recipients split by confidence
  const [toRecipients, setToRecipients] = useState<Recipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>([]);
  const [suggestedRecipients, setSuggestedRecipients] = useState<Recipient[]>([]);

  // Form state
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Linking
  const [dealId, setDealId] = useState<string | undefined>();
  const [deals, setDeals] = useState<Deal[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingToIndex, setEditingToIndex] = useState<number | null>(null);
  const [editingToValue, setEditingToValue] = useState('');

  // User info for signature
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    title?: string;
    phone?: string;
  } | null>(null);

  // Process recipients when context changes - deduplicate and add all to To for simplicity
  useEffect(() => {
    if (!isOpen) return;
    if (!context.recipients || context.recipients.length === 0) {
      setToRecipients([]);
      setCcRecipients([]);
      setSuggestedRecipients([]);
      return;
    }

    const seenEmails = new Set<string>();
    const uniqueRecipients: Recipient[] = [];

    context.recipients.forEach((r) => {
      const emailLower = r.email.toLowerCase();
      if (seenEmails.has(emailLower)) return;
      seenEmails.add(emailLower);

      uniqueRecipients.push({
        email: r.email,
        name: r.name,
        confidence: r.confidence,
        role: r.role,
      });
    });

    // For meeting follow-ups, put all attendees in To
    // For other contexts, only high-confidence goes to To
    if (context.type === 'transcript_followup' || context.type === 'transcript_summary') {
      setToRecipients(uniqueRecipients);
      setCcRecipients([]);
      setSuggestedRecipients([]);
    } else {
      const to: Recipient[] = [];
      const cc: Recipient[] = [];
      const suggested: Recipient[] = [];

      uniqueRecipients.forEach((r) => {
        const confidence = r.confidence ?? 0;
        if (confidence >= 90 || r.role === 'organizer' || r.role === 'primary_contact') {
          to.push(r);
        } else if (confidence >= 75) {
          cc.push(r);
        } else {
          suggested.push(r);
        }
      });

      setToRecipients(to);
      setCcRecipients(cc);
      setSuggestedRecipients(suggested);
    }
  }, [isOpen, context.recipients, context.type]);

  // Initialize form with context data
  useEffect(() => {
    if (!isOpen) return;

    setSubject(context.suggestedSubject || '');
    setContent(context.suggestedBody || '');
    setDealId(context.dealId);
    setError(null);
  }, [isOpen, context]);

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

  // Load deals for linking
  useEffect(() => {
    if (!isOpen) return;

    const loadDeals = async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, name, company_id')
        .not('stage', 'in', '("closed_won","closed_lost")')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setDeals(data);
    };

    loadDeals();
  }, [isOpen, supabase]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setToRecipients([]);
      setCcRecipients([]);
      setSuggestedRecipients([]);
      setSubject('');
      setContent('');
      setManualEmail('');
      setDealId(undefined);
      setError(null);
    }
  }, [isOpen]);

  const addToRecipient = (recipient: Recipient) => {
    if (toRecipients.some(r => r.email === recipient.email)) return;
    setToRecipients([...toRecipients, recipient]);
    setSuggestedRecipients(suggestedRecipients.filter(r => r.email !== recipient.email));
  };

  const addCcRecipient = (recipient: Recipient) => {
    if (ccRecipients.some(r => r.email === recipient.email)) return;
    setCcRecipients([...ccRecipients, recipient]);
    setSuggestedRecipients(suggestedRecipients.filter(r => r.email !== recipient.email));
  };

  const removeToRecipient = (email: string) => {
    setToRecipients(toRecipients.filter(r => r.email !== email));
  };

  const removeCcRecipient = (email: string) => {
    setCcRecipients(ccRecipients.filter(r => r.email !== email));
  };

  const startEditingTo = (index: number) => {
    setEditingToIndex(index);
    setEditingToValue(toRecipients[index].email);
  };

  const saveEditingTo = () => {
    if (editingToIndex === null) return;
    if (!editingToValue.includes('@')) {
      setEditingToIndex(null);
      return;
    }
    const updated = [...toRecipients];
    updated[editingToIndex] = { ...updated[editingToIndex], email: editingToValue.trim() };
    setToRecipients(updated);
    setEditingToIndex(null);
    setEditingToValue('');
  };

  const cancelEditingTo = () => {
    setEditingToIndex(null);
    setEditingToValue('');
  };

  const addManualRecipient = () => {
    if (!manualEmail.includes('@')) return;
    addToRecipient({ email: manualEmail.trim() });
    setManualEmail('');
  };

  const handleRegenerate = async () => {
    // TODO: Call AI to regenerate content based on context
    setRegenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRegenerating(false);
  };

  const handleSend = async () => {
    if (toRecipients.length === 0) {
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
          to: toRecipients.map(r => r.email),
          cc: ccRecipients.length > 0 ? ccRecipients.map(r => r.email) : undefined,
          subject,
          content: htmlContent,
          isHtml: true,
          dealId,
          // Track context for analytics
          metadata: {
            composeContext: context.type,
            sourceLabel: context.sourceLabel,
          },
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

  const contextTitle = useMemo(() => {
    switch (context.type) {
      case 'transcript_followup':
        return 'Send Meeting Follow-up';
      case 'transcript_summary':
        return 'Send Meeting Summary';
      case 'meeting_prep':
        return 'Send Meeting Agenda';
      case 'deal_followup':
        return 'Send Deal Follow-up';
      case 'contact_outreach':
        return 'Email Contact';
      case 'account_trigger':
        return 'Draft Outreach';
      case 'scheduling':
        return 'Send Scheduling Email';
      default:
        return 'Compose Email';
    }
  }, [context.type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{contextTitle}</h2>
            {context.sourceLabel && (
              <p className="text-xs text-gray-500">{context.sourceLabel}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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

          {/* Edit suggestions/warnings */}
          {context.editSuggestions && context.editSuggestions.length > 0 && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Review before sending:
              </div>
              <ul className="text-sm text-amber-700 space-y-1">
                {context.editSuggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* To field */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-start gap-2">
              <span className="text-sm text-gray-500 py-1.5 w-12">To:</span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {toRecipients.map((r, index) => (
                    editingToIndex === index ? (
                      <div key={r.email} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingToValue}
                          onChange={(e) => setEditingToValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveEditingTo();
                            } else if (e.key === 'Escape') {
                              cancelEditingTo();
                            }
                          }}
                          onBlur={saveEditingTo}
                          autoFocus
                          className="px-2 py-0.5 text-sm border border-blue-400 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none w-48"
                        />
                      </div>
                    ) : (
                      <span
                        key={r.email}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-sm group"
                      >
                        <button
                          onClick={() => startEditingTo(index)}
                          className="hover:underline"
                          title="Click to edit"
                        >
                          {r.name || r.email}
                        </button>
                        {r.role && (
                          <span className="text-[10px] text-blue-500">({r.role})</span>
                        )}
                        <button
                          onClick={() => removeToRecipient(r.email)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="Add email..."
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addManualRecipient();
                      }
                    }}
                  />
                  <button
                    onClick={addManualRecipient}
                    disabled={!manualEmail.includes('@')}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cc field */}
          {ccRecipients.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 py-1.5 w-12">Cc:</span>
                <div className="flex flex-wrap gap-1.5">
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
              </div>
            </div>
          )}

          {/* Suggested recipients */}
          {suggestedRecipients.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 py-1 w-12">Add:</span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedRecipients.map((r) => (
                    <button
                      key={r.email}
                      onClick={() => addToRecipient(r)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 text-gray-700 rounded text-sm hover:border-blue-300 hover:bg-blue-50"
                    >
                      <Plus className="h-3 w-3" />
                      {r.name || r.email}
                      {r.role && (
                        <span className="text-[10px] text-gray-400">({r.role})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-12">Subj:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject..."
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Deal linking */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-12">Deal:</span>
              <select
                value={dealId || ''}
                onChange={(e) => setDealId(e.target.value || undefined)}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Link to deal (optional)</option>
                {deals.map((d) => (
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
              rows={10}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={loading || toRecipients.length === 0}
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
    </div>
  );
}

// Helper function to create context from transcript
export function createTranscriptFollowupContext(
  transcriptId: string,
  meetingSubject: string,
  attendees: Array<{ email: string; name?: string; role?: string }>,
  suggestedBody?: string
): ComposeContextData {
  return {
    type: 'transcript_followup',
    transcriptId,
    suggestedSubject: `Follow-up: ${meetingSubject}`,
    suggestedBody,
    recipients: attendees.map((a) => ({
      email: a.email,
      name: a.name,
      role: a.role,
      confidence: a.role === 'organizer' ? 95 : 80,
    })),
    sourceLabel: meetingSubject,
  };
}

// Helper function to create context from deal
export function createDealFollowupContext(
  dealId: string,
  dealName: string,
  contacts: Array<{ email: string; name?: string; is_primary?: boolean }>,
  suggestedSubject?: string,
  suggestedBody?: string
): ComposeContextData {
  return {
    type: 'deal_followup',
    dealId,
    suggestedSubject: suggestedSubject || `Following up - ${dealName}`,
    suggestedBody,
    recipients: contacts.map((c) => ({
      email: c.email,
      name: c.name,
      role: c.is_primary ? 'primary_contact' : 'contact',
      confidence: c.is_primary ? 95 : 75,
    })),
    sourceLabel: dealName,
  };
}

// Helper function to create context from contact
export function createContactOutreachContext(
  contactId: string,
  contact: { email: string; name?: string },
  companyId?: string,
  dealId?: string
): ComposeContextData {
  return {
    type: 'contact_outreach',
    contactId,
    companyId,
    dealId,
    recipients: [{
      email: contact.email,
      name: contact.name,
      role: 'contact',
      confidence: 100,
    }],
    sourceLabel: contact.name || contact.email,
  };
}
