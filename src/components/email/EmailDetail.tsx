'use client';

import { X, Reply, User, Building2, Calendar, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface EmailActivity {
  id: string;
  subject: string;
  description: string;
  completed_at: string;
  contact: {
    id: string;
    name: string;
    email: string;
    company?: {
      id: string;
      name: string;
    };
  } | null;
  deal?: {
    id: string;
    name: string;
  } | null;
  metadata: {
    direction?: 'inbound' | 'outbound';
    from?: { address: string; name?: string };
    to?: Array<{ address: string; name?: string }>;
  };
}

interface EmailDetailProps {
  email: EmailActivity;
  onClose: () => void;
  onReply?: () => void;
}

export function EmailDetail({ email, onClose, onReply }: EmailDetailProps) {
  const isInbound = email.metadata?.direction === 'inbound';

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onReply && (
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Reply className="h-4 w-4" />
              Reply
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Subject */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {email.subject || '(No subject)'}
        </h2>

        {/* Metadata */}
        <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg">
          {/* From/To */}
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-gray-500 w-16">
              {isInbound ? 'From:' : 'To:'}
            </span>
            <div className="text-sm text-gray-900">
              {isInbound ? (
                email.metadata?.from?.name || email.metadata?.from?.address || 'Unknown'
              ) : (
                email.metadata?.to?.map(t => t.name || t.address).join(', ') || 'Unknown'
              )}
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {formatDate(email.completed_at)}
            </span>
          </div>

          {/* Contact */}
          {email.contact && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <Link
                href={`/contacts/${email.contact.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {email.contact.name}
              </Link>
              {email.contact.company && (
                <>
                  <span className="text-gray-400">at</span>
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <Link
                    href={`/organizations/${email.contact.company.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {email.contact.company.name}
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Deal */}
          {email.deal && (
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Deal:</span>
              <Link
                href={`/deals/${email.deal.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                {email.deal.name}
              </Link>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-gray-700">
            {email.description}
          </div>
        </div>
      </div>
    </div>
  );
}
