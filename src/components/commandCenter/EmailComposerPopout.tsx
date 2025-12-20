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
} from 'lucide-react';
import { CommandCenterItem, EmailDraft, PrimaryContact } from '@/types/commandCenter';

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

  // Initialize from email_draft
  useEffect(() => {
    if (item.email_draft) {
      setSubject(item.email_draft.subject);
      setBody(item.email_draft.body);
      setConfidence(item.email_draft.confidence);
    } else {
      // Default subject based on action type
      setSubject(item.title);
    }
  }, [item]);

  // Handle regenerate
  const handleRegenerate = async () => {
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
      console.error('[EmailComposer] Regenerate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  // Handle send
  const handleSend = async () => {
    if (!item.primary_contact?.email || !subject || !body) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/microsoft/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [item.primary_contact.email],
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

  const contact = item.primary_contact;

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
          {contact && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                To
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{contact.name}</span>
                <span className="text-sm text-gray-400">&lt;{contact.email}&gt;</span>
              </div>
            </div>
          )}

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
          {confidence !== null && (
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
          )}

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
