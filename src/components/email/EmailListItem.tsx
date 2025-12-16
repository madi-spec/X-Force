'use client';

import { Star, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailMessage, formatRelativeTime, getInitials, getAvatarColor } from './types';

interface EmailListItemProps {
  email: EmailMessage;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onStarToggle: () => void;
}

export function EmailListItem({
  email,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
  onStarToggle,
}: EmailListItemProps) {
  const isInbound = email.metadata.direction === 'inbound';
  const senderName = isInbound
    ? (email.metadata.from?.name || email.metadata.from?.address || 'Unknown')
    : (email.metadata.to?.[0]?.name || email.metadata.to?.[0]?.address || 'Unknown');
  const senderEmail = isInbound
    ? email.metadata.from?.address
    : email.metadata.to?.[0]?.address;

  const displayName = email.contact?.name || senderName;
  const isUnread = !email.isRead;

  // Truncate body for preview
  const bodyPreview = email.body
    ?.replace(/<[^>]*>/g, '') // Strip HTML
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-2 px-2 py-2 border-b border-gray-100 cursor-pointer transition-colors',
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
        isUnread && 'bg-white'
      )}
    >
      {/* Checkbox */}
      <div
        className="flex-shrink-0 p-1"
        onClick={(e) => {
          e.stopPropagation();
          onCheck(!isChecked);
        }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => {}}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </div>

      {/* Star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStarToggle();
        }}
        className={cn(
          'flex-shrink-0 p-1 rounded transition-colors',
          email.isStarred
            ? 'text-yellow-500'
            : 'text-gray-300 hover:text-yellow-500'
        )}
      >
        <Star className={cn('h-4 w-4', email.isStarred && 'fill-current')} />
      </button>

      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium',
          getAvatarColor(displayName)
        )}
      >
        {getInitials(displayName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        {/* Sender */}
        <div className={cn(
          'w-40 flex-shrink-0 truncate text-sm',
          isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
        )}>
          {!isInbound && <span className="text-gray-400 mr-1">To:</span>}
          {displayName}
        </div>

        {/* Subject and Preview */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={cn(
            'truncate text-sm',
            isUnread ? 'font-semibold text-gray-900' : 'text-gray-900'
          )}>
            {email.subject || '(No subject)'}
          </span>
          {bodyPreview && (
            <>
              <span className="text-gray-400">-</span>
              <span className="truncate text-sm text-gray-500">
                {bodyPreview}
              </span>
            </>
          )}
        </div>

        {/* Tags */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {email.isPst && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
              PST
            </span>
          )}
          {email.contact && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
              Contact
            </span>
          )}
          {email.deal && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
              Deal
            </span>
          )}
        </div>

        {/* Date */}
        <div className={cn(
          'flex-shrink-0 text-xs w-20 text-right',
          isUnread ? 'font-semibold text-gray-900' : 'text-gray-500'
        )}>
          {formatRelativeTime(email.occurred_at)}
        </div>
      </div>
    </div>
  );
}
