'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  Mail,
  Send,
  FileText,
  Loader2,
  AlertCircle,
  UserPlus,
  Package,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerHubData } from '../types';
import { AddContactModal } from '@/components/commandCenter/AddContactModal';
import { ManageProductsModal } from '@/components/dailyDriver/ManageProductsModal';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// ============================================================================
// TYPES
// ============================================================================

interface Communication {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  content_preview: string | null;
  full_content: string | null;
  occurred_at: string;
  duration_seconds: number | null;
  is_ai_generated: boolean;
  recording_url: string | null;
  attachments: unknown[];
  our_participants: Array<{ name?: string; email?: string }>;
  their_participants: Array<{ name?: string; email?: string }>;
  company_id: string | null;
  awaiting_our_response: boolean | null;
  responded_at: string | null;
  current_analysis: {
    summary: string | null;
    sentiment: string | null;
    sentiment_score: number | null;
  } | null;
  contact: { id: string; name: string; email: string } | null;
  thread_id: string | null;
}

// ============================================================================
// THREAD GROUPING HELPERS
// ============================================================================

function normalizeSubject(subject: string | null): string {
  if (!subject) return '';
  return subject.replace(/^(re:|fw:|fwd:|aw:|wg:)\s*/gi, '').trim();
}

interface ThreadGroup {
  id: string;
  subject: string;
  communications: Communication[];
  latestDate: string;
  earliestDate: string;
  hasInbound: boolean;
  hasOutbound: boolean;
  summary: string | null;
}

function cleanSummaryForThread(summary: string): string {
  return summary
    .replace(/^The email\s+/i, 'Discussion about ')
    .replace(/^This email\s+/i, 'Discussion about ')
    .replace(/the email\s+/gi, 'the conversation ')
    .replace(/this email\s+/gi, 'the conversation ');
}

function truncateSummary(summary: string, maxLength: number = 300): string {
  if (summary.length <= maxLength) return summary;
  const truncated = summary.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

function generateThreadSummary(communications: Communication[]): string | null {
  if (communications.length === 0) return null;

  const aiSummaries = communications
    .filter(c => c.current_analysis?.summary)
    .map(c => cleanSummaryForThread(c.current_analysis!.summary!));

  if (aiSummaries.length > 0) {
    let summary: string;
    if (aiSummaries.length === 1) {
      summary = aiSummaries[0];
    } else {
      const combined = aiSummaries
        .map(s => s.split('.')[0])
        .filter(s => s.length > 10)
        .slice(0, 2)
        .join('. ');
      summary = combined ? combined + '.' : aiSummaries[0];
    }
    return truncateSummary(summary);
  }

  const inboundComms = communications.filter(c => c.direction === 'inbound');
  const outboundComms = communications.filter(c => c.direction === 'outbound');

  let prefix: string;
  if (inboundComms.length > 0 && outboundComms.length > 0) {
    prefix = `${communications.length}-message conversation`;
  } else if (inboundComms.length > 0) {
    prefix = `${inboundComms.length} inbound`;
  } else {
    prefix = `${outboundComms.length} outbound`;
  }

  const firstPreview = communications
    .map(c => c.content_preview)
    .find((p): p is string => !!p && p.length > 20);

  if (firstPreview) {
    const snippet = firstPreview.substring(0, 100);
    return truncateSummary(`${prefix}: "${snippet}${firstPreview.length > 100 ? '...' : ''}"`)
  }

  return prefix;
}

function groupCommunicationsIntoThreads(communications: Communication[]): ThreadGroup[] {
  const threadMap = new Map<string, ThreadGroup>();

  for (const comm of communications) {
    const threadKey = comm.thread_id
      ? `thread-${comm.thread_id}`
      : `subject-${normalizeSubject(comm.subject)}`;

    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, {
        id: comm.thread_id || comm.id,
        subject: normalizeSubject(comm.subject) || 'No subject',
        communications: [],
        latestDate: comm.occurred_at,
        earliestDate: comm.occurred_at,
        hasInbound: false,
        hasOutbound: false,
        summary: null,
      });
    }

    const group = threadMap.get(threadKey)!;
    group.communications.push(comm);
    if (comm.direction === 'inbound') group.hasInbound = true;
    if (comm.direction === 'outbound') group.hasOutbound = true;
    if (new Date(comm.occurred_at) > new Date(group.latestDate)) {
      group.latestDate = comm.occurred_at;
    }
    if (new Date(comm.occurred_at) < new Date(group.earliestDate)) {
      group.earliestDate = comm.occurred_at;
    }
  }

  for (const group of threadMap.values()) {
    group.communications.sort((a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    group.summary = generateThreadSummary(group.communications);
  }

  return Array.from(threadMap.values()).sort((a, b) =>
    new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
  );
}

// ============================================================================
// REPLY COMPOSER MODAL
// ============================================================================

interface ReplyComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  communication: Communication;
  companyName: string;
  onSuccess: () => void;
}

function ReplyComposerModal({
  isOpen,
  onClose,
  communication,
  companyName,
  onSuccess,
}: ReplyComposerModalProps) {
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftSubject, setDraftSubject] = useState(
    communication.subject ? `Re: ${communication.subject}` : ''
  );
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleGenerateDraft = useCallback(async () => {
    setIsGeneratingDraft(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/communications/${communication.id}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to generate draft');
      }

      setDraftSubject(json.draft.subject);
      setDraftContent(json.draft.body);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setIsGeneratingDraft(false);
    }
  }, [communication.id]);

  const handleSendReply = useCallback(async () => {
    if (!draftContent.trim()) return;

    const toEmail = communication.their_participants?.[0]?.email ||
                    communication.contact?.email;

    if (!toEmail) {
      setSendError('No recipient email found');
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch('/api/communications/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communicationId: communication.id,
          to: toEmail,
          subject: draftSubject,
          body: draftContent,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to send reply');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  }, [communication, draftSubject, draftContent, onSuccess, onClose]);

  if (!isOpen) return null;

  const recipientName = communication.their_participants?.[0]?.name ||
                        communication.contact?.name ||
                        'Contact';
  const recipientEmail = communication.their_participants?.[0]?.email ||
                         communication.contact?.email || '';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <div className="text-base font-semibold text-gray-900">
              Reply to {companyName}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              To: {recipientName} ({recipientEmail})
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Original message context */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
            Original Message
          </div>
          <div className="text-sm text-gray-600 leading-relaxed">
            {communication.content_preview || 'No content preview available'}
          </div>
        </div>

        {/* Error message */}
        {sendError && (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {sendError}
          </div>
        )}

        {/* Compose area */}
        <div className="flex-1 p-5 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              placeholder="Enter subject..."
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Type your reply..."
              className="flex-1 min-h-[200px] w-full px-3 py-3 text-sm leading-relaxed rounded-xl border border-gray-200 resize-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button
            onClick={handleGenerateDraft}
            disabled={isGeneratingDraft || isSending}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl',
              'border border-purple-200 bg-purple-50 text-purple-700',
              'hover:bg-purple-100 disabled:opacity-60 disabled:cursor-not-allowed'
            )}
          >
            {isGeneratingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {isGeneratingDraft ? 'Generating...' : 'AI Draft'}
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendReply}
              disabled={isSending || !draftContent.trim()}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSending ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

interface MessageBubbleProps {
  comm: Communication;
  onReply: () => void;
}

function MessageBubble({ comm, onReply }: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isOutbound = comm.direction === 'outbound';

  const displayContent = comm.current_analysis?.summary || comm.content_preview || 'No content';

  const senderName = isOutbound
    ? (comm.our_participants?.[0]?.name?.split(' ')[0] || 'You')
    : (comm.their_participants?.[0]?.name?.split(' ')[0] || 'Contact');

  const timestamp = format(new Date(comm.occurred_at), 'MMM d, h:mm a');

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'max-w-[80%] p-3 rounded-2xl relative',
        isOutbound
          ? 'bg-blue-50 border border-blue-100 self-end'
          : 'bg-gray-100 border border-gray-200 self-start'
      )}
    >
      {/* Header */}
      <div className="flex justify-between gap-2.5 text-xs mb-1.5">
        <b className="text-gray-900">{senderName}</b>
        <span className="text-gray-500">{timestamp}</span>
      </div>

      {/* Subject if exists */}
      {comm.subject && (
        <p className="text-xs font-medium text-gray-500 mb-1">
          {comm.subject}
        </p>
      )}

      {/* Content */}
      <p className="text-xs leading-relaxed text-gray-700">
        {displayContent}
      </p>

      {/* Awaiting response indicator */}
      {comm.awaiting_our_response && !comm.responded_at && !isOutbound && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600">
          <AlertCircle className="h-3 w-3" />
          <span>Awaiting response</span>
        </div>
      )}

      {/* Reply button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReply();
        }}
        className={cn(
          'absolute -bottom-2 px-2 py-1 rounded-full text-[11px] font-medium',
          'bg-white border border-gray-200 shadow-sm cursor-pointer',
          'transition-opacity duration-200',
          isOutbound ? 'left-2' : 'right-2',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      >
        Reply
      </button>
    </div>
  );
}

// ============================================================================
// CONVERSATIONS TAB COMPONENT
// ============================================================================

interface ConversationsTabProps {
  data: CustomerHubData;
}

export function ConversationsTab({ data }: ConversationsTabProps) {
  const { company } = data;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reply modal state
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [replyToCommunication, setReplyToCommunication] = useState<Communication | null>(null);

  // Contact/Product modal state
  const [showAddContact, setShowAddContact] = useState(false);
  const [showManageProducts, setShowManageProducts] = useState(false);

  // Thread expansion state
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Fetch communications with SWR for real-time updates
  const { data: commData, isLoading, mutate } = useSWR<{ communications: Communication[] }>(
    `/api/communications?company_id=${company.id}&limit=100`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const communications = commData?.communications || [];

  // Sort oldest first for conversation view
  const sortedComms = [...communications].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // Group communications into threads
  const threadGroups = useMemo(() => {
    return groupCommunicationsIntoThreads(communications);
  }, [communications]);

  // Toggle thread expansion
  const toggleThread = useCallback((threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  // Handle reply initiation
  const handleReply = useCallback((comm: Communication) => {
    setReplyToCommunication(comm);
    setIsReplyModalOpen(true);
  }, []);

  // Handle reply success
  const handleReplySuccess = useCallback(() => {
    mutate();
  }, [mutate]);

  // Get AI summary from the latest communication with analysis
  const latestWithAnalysis = sortedComms.find(c => c.current_analysis?.summary);
  const aiSummary = latestWithAnalysis?.current_analysis?.summary || 'Analyzing conversation context...';

  // Communication stats
  const inboundCount = communications.filter(c => c.direction === 'inbound').length;
  const outboundCount = communications.filter(c => c.direction === 'outbound').length;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header with actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-gray-900">
                {communications.length} conversations
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  {inboundCount} inbound
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  {outboundCount} outbound
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddContact(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Contact
              </button>
              <button
                onClick={() => setShowManageProducts(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Package className="h-3.5 w-3.5" />
                Products
              </button>
              <button
                onClick={() => {
                  if (sortedComms.length > 0) {
                    handleReply(sortedComms[sortedComms.length - 1]);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <Send className="h-3.5 w-3.5" />
                New Reply
              </button>
            </div>
          </div>

          {/* Conversation threads */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div
              ref={scrollRef}
              className="max-h-[600px] overflow-y-auto p-4 flex flex-col gap-3"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                </div>
              ) : threadGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Mail className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                threadGroups.map((thread) => {
                  const isExpanded = expandedThreads.has(thread.id);
                  const hasMultiple = thread.communications.length > 1;

                  return (
                    <div key={thread.id} className="flex flex-col gap-2">
                      {/* Thread Header */}
                      {hasMultiple && (() => {
                        const startDate = new Date(thread.earliestDate);
                        const endDate = new Date(thread.latestDate);
                        const sameDay = startDate.toDateString() === endDate.toDateString();
                        const dateDisplay = sameDay
                          ? format(startDate, 'MMM d')
                          : `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`;

                        return (
                          <button
                            onClick={() => toggleThread(thread.id)}
                            className={cn(
                              'flex items-start gap-2 p-3 rounded-xl w-full text-left cursor-pointer',
                              thread.hasInbound && thread.hasOutbound
                                ? 'bg-purple-50 border border-purple-200'
                                : thread.hasInbound
                                  ? 'bg-blue-50 border border-blue-100'
                                  : 'bg-green-50 border border-green-100'
                            )}
                          >
                            <div className="pt-0.5">
                              {isExpanded ? (
                                <ChevronDown className={cn(
                                  'h-4 w-4',
                                  thread.hasInbound && thread.hasOutbound
                                    ? 'text-purple-600'
                                    : thread.hasInbound
                                      ? 'text-blue-600'
                                      : 'text-green-600'
                                )} />
                              ) : (
                                <ChevronRight className={cn(
                                  'h-4 w-4',
                                  thread.hasInbound && thread.hasOutbound
                                    ? 'text-purple-600'
                                    : thread.hasInbound
                                      ? 'text-blue-600'
                                      : 'text-green-600'
                                )} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-gray-900 truncate flex-1">
                                  {thread.subject}
                                </div>
                                <span className={cn(
                                  'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-semibold text-white shrink-0',
                                  thread.hasInbound && thread.hasOutbound
                                    ? 'bg-purple-600'
                                    : thread.hasInbound
                                      ? 'bg-blue-600'
                                      : 'bg-green-600'
                                )}>
                                  {thread.communications.length}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {dateDisplay}{thread.hasInbound && thread.hasOutbound ? ' · Back & forth' : ''}
                              </div>
                              {!isExpanded && thread.summary && (
                                <div className="text-[11px] text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
                                  {thread.summary}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })()}

                      {/* Thread Messages */}
                      {(isExpanded || !hasMultiple) && (
                        <div className={cn(
                          'flex flex-col gap-2',
                          hasMultiple && 'pl-3'
                        )}>
                          {thread.communications.map((comm) => (
                            <MessageBubble
                              key={comm.id}
                              comm={comm}
                              onReply={() => handleReply(comm)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - 1 col */}
        <div className="space-y-6">
          {/* AI Context */}
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
            <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2">
              AI Interpretation
            </h3>
            <p className="text-sm text-purple-900 leading-relaxed">
              {aiSummary}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Activity Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Messages</span>
                <span className="text-sm font-medium text-gray-900">{communications.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Threads</span>
                <span className="text-sm font-medium text-gray-900">{threadGroups.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Contact</span>
                <span className="text-sm font-medium text-gray-900">
                  {communications.length > 0
                    ? format(new Date(communications[0].occurred_at), 'MMM d')
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Key Contacts Quick View */}
          {data.contacts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Key Contacts
              </h3>
              <div className="space-y-2">
                {data.contacts.slice(0, 4).map((contact) => (
                  <div key={contact.id} className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-gray-600">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                      <p className="text-xs text-gray-500 truncate">{contact.title || contact.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply Composer Modal */}
      {replyToCommunication && (
        <ReplyComposerModal
          isOpen={isReplyModalOpen}
          onClose={() => {
            setIsReplyModalOpen(false);
            setReplyToCommunication(null);
          }}
          communication={replyToCommunication}
          companyName={company.name}
          onSuccess={handleReplySuccess}
        />
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        onContactAdded={() => setShowAddContact(false)}
        companyId={company.id}
        companyName={company.name}
      />

      {/* Manage Products Modal */}
      <ManageProductsModal
        isOpen={showManageProducts}
        onClose={() => setShowManageProducts(false)}
        companyId={company.id}
        companyName={company.name}
        onUpdated={() => {}}
      />
    </>
  );
}
