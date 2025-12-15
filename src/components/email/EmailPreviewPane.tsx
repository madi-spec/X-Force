'use client';

import { Reply, ReplyAll, Forward, MoreHorizontal, Star, Printer, ExternalLink, Mail, Building2, Briefcase, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailMessage, getInitials, getAvatarColor } from './types';
import Link from 'next/link';

interface EmailPreviewPaneProps {
  email: EmailMessage | null;
  onClose: () => void;
  onReply: () => void;
  onStarToggle: () => void;
}

export function EmailPreviewPane({
  email,
  onClose,
  onReply,
  onStarToggle,
}: EmailPreviewPaneProps) {
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <div className="text-center">
          <Mail className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-500">Select an email</h3>
          <p className="text-sm text-gray-400 mt-1">Choose an email from the list to view</p>
        </div>
      </div>
    );
  }

  const isInbound = email.metadata.direction === 'inbound';
  const senderName = isInbound
    ? (email.metadata.from?.name || email.metadata.from?.address || 'Unknown')
    : 'You';
  const senderEmail = isInbound
    ? email.metadata.from?.address
    : email.metadata.to?.[0]?.address;

  const recipients = isInbound
    ? email.metadata.to?.map(r => r.name || r.address).join(', ') || 'Me'
    : email.metadata.to?.map(r => r.name || r.address).join(', ') || 'Unknown';

  const displayName = email.contact?.name || senderName;

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onReply}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ReplyAll className="h-4 w-4" />
            Reply All
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Forward className="h-4 w-4" />
            Forward
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onStarToggle}
            className={cn(
              'p-2 rounded-lg transition-colors',
              email.isStarred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
            )}
          >
            <Star className={cn('h-5 w-5', email.isStarred && 'fill-current')} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <Printer className="h-5 w-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {/* Subject */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            {email.subject || '(No subject)'}
          </h1>

          {/* Sender Info */}
          <div className="flex items-start gap-4 mb-6">
            <div
              className={cn(
                'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-medium',
                getAvatarColor(displayName)
              )}
            >
              {getInitials(displayName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{displayName}</span>
                {email.contact && (
                  <Link
                    href={`/contacts/${email.contact.id}`}
                    className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                  >
                    View Contact
                  </Link>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                {isInbound ? (
                  <>to {recipients}</>
                ) : (
                  <>to {recipients}</>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {formatFullDate(email.occurred_at)}
              </div>
            </div>
          </div>

          {/* Associated Company/Deal */}
          {(email.contact?.company || email.deal) && (
            <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
              {email.contact?.company && (
                <Link
                  href={`/companies/${email.contact.company.id}`}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {email.contact.company.name}
                  </span>
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </Link>
              )}
              {email.deal && (
                <Link
                  href={`/deals/${email.deal.id}`}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {email.deal.name}
                  </span>
                  <ExternalLink className="h-3 w-3 text-gray-400" />
                </Link>
              )}
            </div>
          )}

          {/* Email Body */}
          <div className="prose prose-sm max-w-none">
            <div
              className="text-gray-700 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: email.body || '<p class="text-gray-400 italic">No content</p>' }}
            />
          </div>
        </div>
      </div>

      {/* Quick Reply (collapsed) */}
      <div className="border-t border-gray-200 px-6 py-4">
        <button
          onClick={onReply}
          className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
        >
          Click here to reply...
        </button>
      </div>
    </div>
  );
}
