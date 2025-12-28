'use client';

import { useState, useEffect } from 'react';
import { X, Mail, ExternalLink, Loader2, Reply, Forward, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailData {
  id: string;
  subject: string;
  from_name: string;
  from_email: string;
  to_emails: string[];
  cc_emails?: string[];
  body_text?: string;
  body_html?: string;
  body_preview?: string;
  sent_at?: string;
  received_at?: string;
  is_sent_by_user: boolean;
}

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onOpenInInbox?: () => void;
  onReply?: () => void;
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  conversationId,
  onOpenInInbox,
  onReply,
}: EmailPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<EmailData | null>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    const fetchEmail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch the conversation and its messages
        const response = await fetch(`/api/inbox/conversations/${conversationId}`);
        if (!response.ok) throw new Error('Failed to load email');

        const data = await response.json();

        // Get the most recent inbound message (what we're responding to)
        const messages = data.messages || [];

        // Helper to get message timestamp
        const getTimestamp = (m: EmailData) => {
          const dateStr = m.received_at || m.sent_at;
          return dateStr ? new Date(dateStr).getTime() : 0;
        };

        const latestInbound = messages
          .filter((m: EmailData) => !m.is_sent_by_user)
          .sort((a: EmailData, b: EmailData) => getTimestamp(b) - getTimestamp(a))[0];

        if (latestInbound) {
          setEmail(latestInbound);
        } else if (messages.length > 0) {
          // Fallback to latest message
          setEmail(messages[messages.length - 1]);
        } else {
          throw new Error('No messages found');
        }
      } catch (err) {
        console.error('Error fetching email:', err);
        setError(err instanceof Error ? err.message : 'Failed to load email');
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Email Preview</h2>
              <p className="text-sm text-gray-500">Source email for this action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500">{error}</p>
            </div>
          ) : email ? (
            <div className="p-6 space-y-4">
              {/* Subject */}
              <div>
                <h3 className="text-lg font-medium text-gray-900">{email.subject}</h3>
              </div>

              {/* From/To */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-16 text-xs font-medium text-gray-500 uppercase tracking-wider pt-0.5">
                    From
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{email.from_name}</span>
                      <span className="text-sm text-gray-500 ml-1">&lt;{email.from_email}&gt;</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-16 text-xs font-medium text-gray-500 uppercase tracking-wider pt-0.5">
                    To
                  </div>
                  <div className="text-sm text-gray-700">
                    {email.to_emails?.join(', ') || 'Unknown'}
                  </div>
                </div>

                {email.cc_emails && email.cc_emails.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-16 text-xs font-medium text-gray-500 uppercase tracking-wider pt-0.5">
                      CC
                    </div>
                    <div className="text-sm text-gray-700">
                      {email.cc_emails.join(', ')}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-16 text-xs font-medium text-gray-500 uppercase tracking-wider pt-0.5">
                    Date
                  </div>
                  <div className="text-sm text-gray-700">
                    {(email.received_at || email.sent_at) ? formatDate(email.received_at || email.sent_at!) : 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Message
                </label>
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {email.body_text || email.body_html?.replace(/<[^>]+>/g, '') || email.body_preview || 'No content available'}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {onReply && (
              <button
                onClick={() => {
                  onReply();
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Reply className="h-4 w-4" />
                Reply
              </button>
            )}

            {onOpenInInbox && (
              <button
                onClick={() => {
                  onOpenInInbox();
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Inbox
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
