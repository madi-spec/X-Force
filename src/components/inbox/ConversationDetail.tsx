'use client';

import { useState } from 'react';
import {
  Archive,
  Clock,
  Link2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Undo2,
  Sparkles,
  Send,
  Briefcase,
  Building2,
  User,
  ExternalLink,
  Paperclip,
  Calendar,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInitials, getAvatarColor } from '@/components/email/types';
import type { Conversation, EmailMessage, EmailDraft, SnoozeOption } from './types';
import { getSnoozeOptions, formatConversationTime, getPriorityColor } from './types';
import { LinkingModal } from './LinkingModal';

interface ConversationDetailProps {
  conversation: Conversation;
  messages: EmailMessage[];
  draft?: EmailDraft;
  onArchive: () => void;
  onUnarchive: () => void;
  onSnooze: (until: Date, reason?: string) => void;
  onUnsnooze: () => void;
  onLink: (dealId?: string, companyId?: string, contactId?: string) => void;
  onUnlink: () => void;
  onPriority: (priority: 'urgent' | 'high' | 'normal' | 'low') => void;
  onUndo?: (actionId: string) => void;
  onAnalyze: () => void;
  onGenerateDraft: () => void;
  onSendDraft: (draftId: string) => void;
  onDiscardDraft: (draftId: string) => void;
  onSchedule?: () => void;
  onReply?: () => void;
  schedulingSuggestion?: {
    hasSuggestion: boolean;
    meetingType?: string;
    confidence?: number;
  };
  lastActionId?: string;
  isGeneratingDraft?: boolean;
  showCompose?: boolean;
  onCloseCompose?: () => void;
}

export function ConversationDetail({
  conversation,
  messages,
  draft,
  onArchive,
  onUnarchive,
  onSnooze,
  onUnsnooze,
  onLink,
  onUnlink,
  onPriority,
  onUndo,
  onAnalyze,
  onGenerateDraft,
  onSendDraft,
  onDiscardDraft,
  onSchedule,
  onReply,
  schedulingSuggestion,
  lastActionId,
  isGeneratingDraft,
  showCompose,
  onCloseCompose,
}: ConversationDetailProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set([messages[messages.length - 1]?.id])
  );
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [composeMessage, setComposeMessage] = useState('');

  const snoozeOptions = getSnoozeOptions();

  // Get recipient info for reply
  const lastExternalMessage = messages.find(m => !m.is_from_us);
  const replyTo = lastExternalMessage?.from_address || (conversation.participants || [])[0]?.address || '';

  const toggleMessage = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedMessages(new Set(messages.map((m) => m.id)));
  };

  const collapseAll = () => {
    setExpandedMessages(new Set([messages[messages.length - 1]?.id]));
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-900">
              {conversation.subject || '(No subject)'}
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
              <span>{conversation.message_count || 1} messages</span>
              <span>Last {formatConversationTime(conversation.last_message_at)}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1">
            {/* Undo button */}
            {lastActionId && onUndo && (
              <button
                onClick={() => onUndo(lastActionId)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
            )}

            {/* Archive/Unarchive */}
            {conversation.status === 'archived' ? (
              <button
                onClick={onUnarchive}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                Unarchive
              </button>
            ) : (
              <button
                onClick={onArchive}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </button>
            )}

            {/* Snooze */}
            <div className="relative">
              {conversation.status === 'snoozed' ? (
                <button
                  onClick={onUnsnooze}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Unsnooze
                </button>
              ) : (
                <button
                  onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Snooze
                </button>
              )}
              {showSnoozeMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded shadow-lg z-10">
                  {snoozeOptions.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => {
                        onSnooze(option.value, option.reason);
                        setShowSnoozeMenu(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Link */}
            <div className="relative">
              {conversation.deal_id ? (
                <button
                  onClick={onUnlink}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Unlink
                </button>
              ) : (
                <button
                  onClick={() => setShowLinkMenu(!showLinkMenu)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Link
                </button>
              )}
            </div>

            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
                  conversation.priority
                    ? getPriorityColor(conversation.priority)
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Priority
              </button>
              {showPriorityMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded shadow-lg z-10">
                  {(['urgent', 'high', 'normal', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        onPriority(p);
                        setShowPriorityMenu(false);
                      }}
                      className={cn(
                        'w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50',
                        conversation.priority === p && 'bg-gray-50 font-medium'
                      )}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Actions */}
            <button
              onClick={onAnalyze}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analyze
            </button>

            {/* Schedule Meeting */}
            {onSchedule && (
              <button
                onClick={onSchedule}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
                  schedulingSuggestion?.hasSuggestion
                    ? 'text-green-600 bg-green-50 hover:bg-green-100'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
                {schedulingSuggestion?.hasSuggestion && (
                  <span className="ml-0.5 px-1 py-0.5 text-[10px] bg-green-600 text-white rounded">
                    !
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Linked entities */}
        {(conversation.deal || conversation.company || conversation.contact) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
            {conversation.deal && (
              <a
                href={`/deals/${conversation.deal.id}`}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-green-700 bg-green-50 rounded hover:bg-green-100 transition-colors"
              >
                <Briefcase className="h-3 w-3" />
                {conversation.deal.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </a>
            )}
            {conversation.company && (
              <a
                href={`/organizations/${conversation.company.id}`}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
              >
                <Building2 className="h-3 w-3" />
                {conversation.company.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </a>
            )}
            {conversation.contact && (
              <a
                href={`/contacts/${conversation.contact.id}`}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                <User className="h-3 w-3" />
                {conversation.contact.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </a>
            )}
          </div>
        )}

        {/* AI Summary and signals */}
        {(conversation.ai_summary || (conversation.ai_signals && conversation.ai_signals.length > 0)) && (
          <div className="mt-2 p-2 bg-violet-50 rounded">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3 w-3 text-violet-600" />
              <span className="text-xs font-medium text-violet-700">AI Insights</span>
            </div>
            {conversation.ai_summary && (
              <p className="text-xs text-gray-700 mb-1">{conversation.ai_summary}</p>
            )}
            {conversation.ai_signals && conversation.ai_signals.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {conversation.ai_signals.map((signal, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 text-[10px] font-medium text-violet-600 bg-white rounded"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message thread controls */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <span className="text-[10px] text-gray-500">
          {expandedMessages.size} of {messages.length} expanded
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={expandAll}
            className="text-[10px] text-gray-500 hover:text-gray-700"
          >
            Expand all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-[10px] text-gray-500 hover:text-gray-700"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((message, index) => {
          const isExpanded = expandedMessages.has(message.id);
          const senderName = message.from_name || message.from_address || 'Unknown';

          return (
            <div
              key={message.id}
              className={cn(
                'rounded-lg border transition-all',
                message.is_from_us
                  ? 'bg-blue-50/50 border-blue-100'
                  : 'bg-white border-gray-200'
              )}
            >
              {/* Message header */}
              <button
                onClick={() => toggleMessage(message.id)}
                className="w-full px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0',
                      message.is_from_us ? 'bg-blue-600' : getAvatarColor(senderName)
                    )}
                  >
                    {getInitials(senderName)}
                  </div>

                  {/* Sender info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{senderName}</span>
                      {message.is_from_us && (
                        <span className="px-1 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-100 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      To: {(message.to_addresses || []).map((t) => t.name || t.address).join(', ') || 'Unknown'}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 shrink-0">
                    {message.has_attachments && (
                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <span className="text-[10px] text-gray-400">
                      {formatConversationTime(message.received_at)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Preview when collapsed */}
                {!isExpanded && (
                  <p className="mt-1 text-xs text-gray-500 truncate pl-9">
                    {message.body_preview}
                  </p>
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 pl-12">
                  {message.body_html ? (
                    <div
                      className="prose prose-sm max-w-none text-gray-700 text-sm"
                      dangerouslySetInnerHTML={{ __html: message.body_html }}
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {message.body_preview}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Draft response */}
        {draft && draft.status === 'pending' && (
          <div className="rounded-lg border-2 border-dashed border-violet-300 bg-violet-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-xs font-medium text-violet-700">AI Draft Response</span>
                {draft.confidence_score && (
                  <span className="text-[10px] text-violet-500">
                    {draft.confidence_score}% confidence
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onDiscardDraft(draft.id)}
                  className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-white rounded transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={() => onSendDraft(draft.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded transition-colors"
                >
                  <Send className="h-3 w-3" />
                  Send
                </button>
              </div>
            </div>
            <div
              className="prose prose-sm max-w-none text-gray-700 bg-white rounded p-2 text-xs"
              dangerouslySetInnerHTML={{ __html: draft.body_html }}
            />
          </div>
        )}
      </div>

      {/* Compose area */}
      {showCompose && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              <span className="font-medium">To:</span> {replyTo}
            </div>
            <button
              onClick={onCloseCompose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-3">
            <textarea
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              placeholder="Type your reply..."
              className="w-full h-32 px-3 py-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={onGenerateDraft}
                disabled={isGeneratingDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-100 rounded transition-colors disabled:opacity-50"
              >
                {isGeneratingDraft ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isGeneratingDraft ? 'Generating...' : 'Generate with AI'}
              </button>
              <button
                disabled={!composeMessage.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      {!showCompose && (
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={onGenerateDraft}
              disabled={isGeneratingDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded transition-colors disabled:opacity-50"
            >
              {isGeneratingDraft ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isGeneratingDraft ? 'Generating...' : 'Generate AI Response'}
            </button>
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>
        </div>
      )}

      {/* Linking Modal */}
      <LinkingModal
        isOpen={showLinkMenu}
        onClose={() => setShowLinkMenu(false)}
        onLink={(dealId, companyId, contactId) => {
          onLink(dealId, companyId, contactId);
          setShowLinkMenu(false);
        }}
        conversation={conversation}
      />
    </div>
  );
}
