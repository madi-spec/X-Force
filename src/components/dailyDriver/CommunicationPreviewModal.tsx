'use client';

import { useState, useEffect } from 'react';
import { X, Mail, ExternalLink, Loader2, User, Calendar, Building2, UserPlus, Package } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { AddContactModal } from '@/components/commandCenter/AddContactModal';
import { ManageProductsModal } from '@/components/dailyDriver/ManageProductsModal';

interface CommunicationData {
  id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  content_preview: string | null;
  full_content: string | null;
  occurred_at: string;
  their_participants: Array<{ name?: string; email?: string }>;
  our_participants: Array<{ name?: string; email?: string }>;
  company?: { id: string; name: string; domain?: string } | null;
  contact?: { id: string; name: string; email?: string } | null;
}

interface CommunicationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  communicationId: string;
  onReply?: (email: string, subject: string) => void;
}

export function CommunicationPreviewModal({
  isOpen,
  onClose,
  communicationId,
  onReply,
}: CommunicationPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [communication, setCommunication] = useState<CommunicationData | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showManageProducts, setShowManageProducts] = useState(false);

  useEffect(() => {
    if (!isOpen || !communicationId) return;

    const fetchCommunication = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/communications?id=${communicationId}`);
        if (!response.ok) throw new Error('Failed to load communication');

        const data = await response.json();

        if (data.communications && data.communications.length > 0) {
          setCommunication(data.communications[0]);
        } else {
          throw new Error('Communication not found');
        }
      } catch (err) {
        console.error('Error fetching communication:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchCommunication();
  }, [isOpen, communicationId]);

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

  // Get the sender info
  const getSender = () => {
    if (!communication) return null;
    if (communication.direction === 'inbound') {
      // Inbound = they sent it to us
      const sender = communication.their_participants?.[0];
      return sender ? { name: sender.name || sender.email, email: sender.email } : null;
    } else {
      // Outbound = we sent it
      const sender = communication.our_participants?.[0];
      return sender ? { name: sender.name || sender.email, email: sender.email } : null;
    }
  };

  // Get recipients
  const getRecipients = () => {
    if (!communication) return [];
    if (communication.direction === 'inbound') {
      return communication.our_participants || [];
    } else {
      return communication.their_participants || [];
    }
  };

  const sender = getSender();
  const recipients = getRecipients();
  const replyToEmail = communication?.direction === 'inbound'
    ? communication.their_participants?.[0]?.email
    : null;

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
              <h2 className="font-semibold text-gray-900">Email Details</h2>
              <p className="text-sm text-gray-500">
                {communication?.direction === 'inbound' ? 'Received email' : 'Sent email'}
              </p>
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
          ) : communication ? (
            <div className="p-6 space-y-4">
              {/* Subject */}
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {communication.subject || '(No subject)'}
                </h3>
              </div>

              {/* Company context */}
              {communication.company && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building2 className="h-4 w-4" />
                  <span>{communication.company.name}</span>
                  {communication.company.domain && (
                    <span className="text-gray-400">({communication.company.domain})</span>
                  )}
                </div>
              )}

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
                      <span className="text-sm font-medium text-gray-900">
                        {sender?.name || 'Unknown'}
                      </span>
                      {sender?.email && (
                        <span className="text-sm text-gray-500 ml-1">
                          &lt;{sender.email}&gt;
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-16 text-xs font-medium text-gray-500 uppercase tracking-wider pt-0.5">
                    To
                  </div>
                  <div className="text-sm text-gray-700">
                    {recipients.map(r => r.name || r.email).join(', ') || 'Unknown'}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-16 text-xs font-medium text-gray-500 uppercase tracking-wider pt-0.5">
                    Date
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {formatDate(communication.occurred_at)}
                    <span className="text-gray-400">
                      ({formatRelativeTime(communication.occurred_at)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Message
                </label>
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {communication.full_content || communication.content_preview || 'No content available'}
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
            {/* Add Contact - only show when we have company context and sender email */}
            {communication?.company && sender?.email && (
              <button
                onClick={() => setShowAddContact(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                title="Add sender as contact"
              >
                <UserPlus className="h-4 w-4" />
                Add Contact
              </button>
            )}

            {/* Manage Products - only show when we have company context */}
            {communication?.company && (
              <button
                onClick={() => setShowManageProducts(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                title="Manage products"
              >
                <Package className="h-4 w-4" />
                Products
              </button>
            )}

            {onReply && replyToEmail && (
              <button
                onClick={() => {
                  onReply(replyToEmail, communication?.subject || '');
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Mail className="h-4 w-4" />
                Reply
              </button>
            )}

            {communication?.company && (
              <a
                href={`/companies/${communication.company.id}`}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View Company
              </a>
            )}
          </div>
        </div>

        {/* Add Contact Modal */}
        {communication?.company && (
          <AddContactModal
            isOpen={showAddContact}
            onClose={() => setShowAddContact(false)}
            onContactAdded={() => setShowAddContact(false)}
            companyId={communication.company.id}
            companyName={communication.company.name}
            initialEmail={sender?.email}
            initialName={sender?.name !== sender?.email ? sender?.name : ''}
          />
        )}

        {/* Manage Products Modal */}
        {communication?.company && (
          <ManageProductsModal
            isOpen={showManageProducts}
            onClose={() => setShowManageProducts(false)}
            companyId={communication.company.id}
            companyName={communication.company.name}
            onUpdated={() => {}}
          />
        )}
      </div>
    </div>
  );
}
