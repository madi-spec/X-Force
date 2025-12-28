'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Mail,
  Send,
  Loader2,
  User,
  Building2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { CommandCenterItem, PrimaryContact } from '@/types/commandCenter';

interface ManualReplyPopoutProps {
  item: CommandCenterItem & {
    context_summary?: string | null;
    context_brief?: string | null;
    primary_contact?: PrimaryContact | null;
  };
  onClose: () => void;
  onSent: () => void;
}

interface EmailContext {
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  body?: string;
  thread?: Array<{
    from: string;
    date: string;
    body: string;
  }>;
}

export function ManualReplyPopout({
  item,
  onClose,
  onSent,
}: ManualReplyPopoutProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);
  const [emailContext, setEmailContext] = useState<EmailContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Get contact and company info
  const contactName = item.target_name || item.primary_contact?.name || item.contact?.name;
  const contactEmail = item.primary_contact?.email || item.contact?.email;
  const companyName = item.company_name || item.company?.name;

  // Load email context if available
  useEffect(() => {
    async function loadContext() {
      if (!item.conversation_id) return;

      setLoadingContext(true);
      try {
        const response = await fetch(`/api/communications/${item.conversation_id}`);
        if (response.ok) {
          const data = await response.json();
          setEmailContext({
            subject: data.subject,
            from: data.from,
            to: data.to,
            date: data.date,
            body: data.body_text || data.body,
            thread: data.thread,
          });
          // Pre-fill subject with Re: if not already set
          if (data.subject && !subject) {
            setSubject(data.subject.startsWith('Re:') ? data.subject : `Re: ${data.subject}`);
          }
        }
      } catch (err) {
        console.error('[ManualReplyPopout] Error loading context:', err);
      } finally {
        setLoadingContext(false);
      }
    }

    loadContext();
  }, [item.conversation_id]);

  const handleSend = async () => {
    if (!body.trim() || !contactEmail) {
      setError('Please enter a message');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/communications/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: item.conversation_id,
          to: contactEmail,
          subject: subject,
          body: body,
          command_center_item_id: item.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send email');
      }

      onSent();
    } catch (err) {
      console.error('[ManualReplyPopout] Error sending:', err);
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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Compose Reply</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Context Panel (collapsible) */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowContext(!showContext)}
              className="w-full flex items-center justify-between px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">Context</span>
              </div>
              {showContext ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {showContext && (
              <div className="px-6 py-4 bg-gray-50 space-y-3">
                {/* Contact & Company */}
                <div className="flex items-center gap-4 text-sm">
                  {contactName && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <User className="h-3.5 w-3.5" />
                      <span>{contactName}</span>
                    </div>
                  )}
                  {companyName && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{companyName}</span>
                    </div>
                  )}
                </div>

                {/* Item context/summary */}
                {(item.context_summary || item.context_brief) && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      {item.context_summary || item.context_brief}
                    </p>
                  </div>
                )}

                {/* Original email context */}
                {loadingContext ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading email thread...
                  </div>
                ) : emailContext?.body ? (
                  <div className="border rounded-lg bg-white">
                    <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
                      Original message from {emailContext.from}
                    </div>
                    <div className="px-3 py-2 text-sm text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {emailContext.body.slice(0, 500)}
                      {emailContext.body.length > 500 && '...'}
                    </div>
                  </div>
                ) : null}

                {/* Link to full conversation */}
                {item.conversation_id && (
                  <a
                    href={`/inbox?id=${item.conversation_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    View full conversation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Compose Form */}
          <div className="p-6 space-y-4">
            {/* To */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">To</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">
                  {contactName && <span className="font-medium">{contactName}</span>}
                  {contactEmail && <span className="text-gray-500 ml-1">&lt;{contactEmail}&gt;</span>}
                </span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="Enter subject..."
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm min-h-[200px] resize-y"
                placeholder="Write your reply..."
                autoFocus
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !body.trim() || !contactEmail}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              !sending && body.trim() && contactEmail
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
                Send Reply
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
