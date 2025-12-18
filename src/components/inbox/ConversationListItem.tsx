'use client';

import { Clock, AlertCircle, Building2, Briefcase, Mail, Reply, PenSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/components/email/types';
import type { Conversation } from './types';
import { formatConversationTime, getSlaStatusColor, getPriorityColor } from './types';

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
}

export function ConversationListItem({ conversation, isSelected, onSelect }: ConversationListItemProps) {
  const participants = conversation.participants || [];
  const primaryParticipant = participants[0];
  const participantName = primaryParticipant?.name || primaryParticipant?.address || 'Unknown';
  const messageCount = conversation.message_count || 1;
  const isAwaitingResponse = conversation.status === 'awaiting_response';
  const hasDraft = conversation.has_pending_draft;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full px-3 py-2.5 text-left transition-colors border-b border-gray-100',
        isSelected
          ? 'bg-blue-50 border-l-2 border-l-blue-600'
          : 'hover:bg-gray-50 border-l-2 border-l-transparent'
      )}
    >
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0',
            getAvatarColor(participantName)
          )}
        >
          {getInitials(participantName)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate">
                {participantName}
              </span>
              {participants.length > 1 && (
                <span className="text-[10px] text-gray-400">
                  +{participants.length - 1}
                </span>
              )}
              {isAwaitingResponse && (
                <Reply className="h-3 w-3 text-amber-500" />
              )}
              {hasDraft && (
                <PenSquare className="h-3 w-3 text-violet-500" />
              )}
            </div>
            <span className={cn(
              'text-[10px] shrink-0',
              conversation.sla_status ? getSlaStatusColor(conversation.sla_status) : 'text-gray-400'
            )}>
              {formatConversationTime(conversation.last_message_at)}
            </span>
          </div>

          {/* Subject */}
          <div className="text-xs text-gray-800 truncate mt-0.5">
            {conversation.subject || '(No subject)'}
          </div>

          {/* Preview */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {messageCount > 1 && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <Mail className="h-2.5 w-2.5" />
                {messageCount}
              </span>
            )}
            {conversation.ai_summary && (
              <p className="text-[11px] text-gray-500 truncate flex-1">
                {conversation.ai_summary}
              </p>
            )}
          </div>

          {/* Status indicators - only show if relevant */}
          {(conversation.priority === 'urgent' || conversation.priority === 'high' ||
            conversation.sla_status === 'warning' || conversation.sla_status === 'overdue' ||
            conversation.deal || conversation.company) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {/* Priority badge */}
              {(conversation.priority === 'urgent' || conversation.priority === 'high') && (
                <span className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
                  getPriorityColor(conversation.priority)
                )}>
                  <AlertCircle className="h-2.5 w-2.5" />
                  {conversation.priority === 'urgent' ? 'Urgent' : 'High'}
                </span>
              )}

              {/* SLA warning */}
              {conversation.sla_status === 'warning' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-600 bg-amber-50">
                  <Clock className="h-2.5 w-2.5" />
                  SLA
                </span>
              )}
              {conversation.sla_status === 'overdue' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-red-600 bg-red-50">
                  <Clock className="h-2.5 w-2.5" />
                  Overdue
                </span>
              )}

              {/* Linked deal/company */}
              {conversation.deal && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-green-600 bg-green-50">
                  <Briefcase className="h-2.5 w-2.5" />
                  {conversation.deal.name}
                </span>
              )}
              {!conversation.deal && conversation.company && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-600 bg-blue-50">
                  <Building2 className="h-2.5 w-2.5" />
                  {conversation.company.name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
