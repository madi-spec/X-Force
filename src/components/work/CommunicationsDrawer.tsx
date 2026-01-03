'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  X,
  Mail,
  Send,
  FileText,
  Loader2,
  AlertCircle,
  Maximize2,
  UserPlus,
  Package,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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

// Normalize subject by removing RE:, FW:, etc. prefixes
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

// Clean up AI summary to be thread-appropriate (remove "The email" references)
function cleanSummaryForThread(summary: string): string {
  return summary
    .replace(/^The email\s+/i, 'Discussion about ')
    .replace(/^This email\s+/i, 'Discussion about ')
    .replace(/the email\s+/gi, 'the conversation ')
    .replace(/this email\s+/gi, 'the conversation ');
}

// Truncate summary to fit in bubble (max ~300 chars - CSS line-clamp handles visual display)
function truncateSummary(summary: string, maxLength: number = 300): string {
  if (summary.length <= maxLength) return summary;
  const truncated = summary.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

// Generate a summary for a thread from its communications
function generateThreadSummary(communications: Communication[]): string | null {
  if (communications.length === 0) return null;

  // Collect all AI-generated summaries from the thread
  const aiSummaries = communications
    .filter(c => c.current_analysis?.summary)
    .map(c => cleanSummaryForThread(c.current_analysis!.summary!));

  // If we have AI summaries, combine them into a thread overview
  if (aiSummaries.length > 0) {
    let summary: string;
    if (aiSummaries.length === 1) {
      summary = aiSummaries[0];
    } else {
      // Combine multiple AI summaries - take key points from each
      const combined = aiSummaries
        .map(s => s.split('.')[0]) // Take first sentence from each
        .filter(s => s.length > 10)
        .slice(0, 2) // Max 2 key points
        .join('. ');
      summary = combined ? combined + '.' : aiSummaries[0];
    }
    return truncateSummary(summary);
  }

  // Fall back to building a conversation flow summary
  const inboundComms = communications.filter(c => c.direction === 'inbound');
  const outboundComms = communications.filter(c => c.direction === 'outbound');

  // Build a narrative of the thread
  let prefix: string;
  if (inboundComms.length > 0 && outboundComms.length > 0) {
    prefix = `${communications.length}-message conversation`;
  } else if (inboundComms.length > 0) {
    prefix = `${inboundComms.length} inbound`;
  } else {
    prefix = `${outboundComms.length} outbound`;
  }

  // Get content from first message to show topic
  const firstPreview = communications
    .map(c => c.content_preview)
    .find((p): p is string => !!p && p.length > 20);

  if (firstPreview) {
    const snippet = firstPreview.substring(0, 100);
    return truncateSummary(`${prefix}: "${snippet}${firstPreview.length > 100 ? '...' : ''}"`)
  }

  return prefix;
}

// Group communications into threads (by thread_id or normalized subject, across all dates)
function groupCommunicationsIntoThreads(communications: Communication[]): ThreadGroup[] {
  const threadMap = new Map<string, ThreadGroup>();

  for (const comm of communications) {
    // Group by thread_id if available, otherwise by normalized subject
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

  // Sort communications within each thread by date (oldest first for conversation view)
  // and generate summaries
  for (const group of threadMap.values()) {
    group.communications.sort((a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    group.summary = generateThreadSummary(group.communications);
  }

  // Return sorted by earliest date (oldest first for conversation view)
  return Array.from(threadMap.values()).sort((a, b) =>
    new Date(a.earliestDate).getTime() - new Date(b.earliestDate).getTime()
  );
}

interface CommunicationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  highlightCommunicationId?: string | null;
  highlightMessageId?: string | null;
  workItemId?: string | null;
  workItemSignalType?: string | null;
  onReplySuccess?: () => void;
  onSchedule?: () => void;
  onQuickBook?: () => void;
}

// ============================================================================
// REPLY COMPOSER MODAL
// ============================================================================

interface ReplyComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  communication: Communication;
  companyName: string;
  workItemId?: string | null;
  workItemSignalType?: string | null;
  onSuccess: () => void;
}

function ReplyComposerModal({
  isOpen,
  onClose,
  communication,
  companyName,
  workItemId,
  workItemSignalType,
  onSuccess,
}: ReplyComposerModalProps) {
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftSubject, setDraftSubject] = useState(
    communication.subject ? `Re: ${communication.subject}` : ''
  );
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Generate AI draft
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

  // Send reply
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
          workItemId: workItemId,
          workItemSignalType: workItemSignalType,
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
  }, [communication, draftSubject, draftContent, workItemId, workItemSignalType, onSuccess, onClose]);

  if (!isOpen) return null;

  const recipientName = communication.their_participants?.[0]?.name ||
                        communication.contact?.name ||
                        'Contact';
  const recipientEmail = communication.their_participants?.[0]?.email ||
                         communication.contact?.email || '';

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '24px',
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e6eaf0',
          boxShadow: '0 25px 50px rgba(16, 24, 40, 0.25)',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e6eaf0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0b1220' }}>
              Reply to {companyName}
            </div>
            <div style={{ fontSize: '13px', color: '#667085', marginTop: '2px' }}>
              To: {recipientName} ({recipientEmail})
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid #e6eaf0',
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <X style={{ width: '16px', height: '16px', color: '#667085' }} />
          </button>
        </div>

        {/* Original message context */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f9fafb',
            borderBottom: '1px solid #e6eaf0',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#667085', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Original Message
          </div>
          <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
            {communication.content_preview || 'No content preview available'}
          </div>
        </div>

        {/* Error message */}
        {sendError && (
          <div
            style={{
              margin: '16px 20px 0',
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            {sendError}
          </div>
        )}

        {/* Compose area */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Subject
            </label>
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              placeholder="Enter subject..."
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                borderRadius: '10px',
                border: '1px solid #e6eaf0',
                outline: 'none',
                color: '#0b1220',
              }}
            />
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Message
            </label>
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Type your reply..."
              style={{
                flex: 1,
                minHeight: '200px',
                width: '100%',
                padding: '12px 14px',
                fontSize: '14px',
                lineHeight: 1.6,
                borderRadius: '10px',
                border: '1px solid #e6eaf0',
                resize: 'none',
                outline: 'none',
                color: '#0b1220',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e6eaf0',
            background: '#f9fafb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={handleGenerateDraft}
            disabled={isGeneratingDraft || isSending}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '10px',
              border: '1px solid #e9d5ff',
              background: '#faf5ff',
              color: '#7c3aed',
              cursor: isGeneratingDraft || isSending ? 'not-allowed' : 'pointer',
              opacity: isGeneratingDraft || isSending ? 0.6 : 1,
            }}
          >
            {isGeneratingDraft ? (
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <FileText style={{ width: '16px', height: '16px' }} />
            )}
            {isGeneratingDraft ? 'Generating...' : 'AI Draft'}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isSending}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '10px',
                border: '1px solid #e6eaf0',
                background: '#ffffff',
                color: '#374151',
                cursor: isSending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSendReply}
              disabled={isSending || !draftContent.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '10px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                cursor: isSending || !draftContent.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || !draftContent.trim() ? 0.6 : 1,
              }}
            >
              {isSending ? (
                <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send style={{ width: '16px', height: '16px' }} />
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
// DRAWER COMPONENT
// ============================================================================

export function CommunicationsDrawer({
  isOpen,
  onClose,
  companyId,
  companyName,
  highlightCommunicationId,
  workItemId,
  workItemSignalType,
  onReplySuccess,
  onSchedule,
  onQuickBook,
}: CommunicationsDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToHighlight, setHasScrolledToHighlight] = useState(false);

  // Reply modal state
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [replyToCommunication, setReplyToCommunication] = useState<Communication | null>(null);

  // Schedule dropdown state
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);

  // Contact/Product modal state
  const [showAddContact, setShowAddContact] = useState(false);
  const [showManageProducts, setShowManageProducts] = useState(false);

  // Thread expansion state
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Fetch communications
  const { data, isLoading, mutate } = useSWR<{ communications: Communication[] }>(
    isOpen ? `/api/communications?company_id=${companyId}&limit=50` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const communications = data?.communications || [];

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

  // Scroll to highlighted message when data loads
  useEffect(() => {
    if (
      highlightCommunicationId &&
      sortedComms.length > 0 &&
      !hasScrolledToHighlight &&
      highlightRef.current
    ) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHasScrolledToHighlight(true);
    }
  }, [highlightCommunicationId, sortedComms.length, hasScrolledToHighlight]);

  // Reset scroll state when drawer reopens with new highlight
  useEffect(() => {
    if (isOpen) {
      setHasScrolledToHighlight(false);
    }
  }, [isOpen, highlightCommunicationId]);

  // Handle reply initiation - opens modal
  const handleReply = useCallback((comm: Communication) => {
    setReplyToCommunication(comm);
    setIsReplyModalOpen(true);
  }, []);

  // Handle reply success
  const handleReplySuccess = useCallback(() => {
    mutate();
    onReplySuccess?.();
  }, [mutate, onReplySuccess]);

  if (!isOpen) return null;

  // Get AI summary from the latest communication with analysis
  const latestWithAnalysis = sortedComms.find(c => c.current_analysis?.summary);
  const aiSummary = latestWithAnalysis?.current_analysis?.summary || 'Analyzing conversation context...';

  // Get highlighted message timestamp
  const highlightedComm = sortedComms.find(c => c.id === highlightCommunicationId);
  const highlightTimestamp = highlightedComm
    ? format(new Date(highlightedComm.occurred_at), 'MMM d, h:mm a')
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.35)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 50,
        }}
      >
        {/* Drawer */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#ffffff',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '85vh',
            boxShadow: '0 -10px 40px rgba(16, 24, 40, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #e6eaf0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b1220' }}>
                Conversation — {companyName}
              </div>
              {highlightCommunicationId && highlightTimestamp && (
                <div style={{ fontSize: '12px', color: '#667085', marginTop: '2px' }}>
                  Jumped to triggering message ({highlightTimestamp})
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid #e6eaf0',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                color: '#0b1220',
              }}
            >
              Close
            </button>
          </div>

          {/* Body (message thread with collapsible threads) */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                <Loader2 style={{ width: '32px', height: '32px', color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : threadGroups.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#667085' }}>
                <Mail style={{ width: '48px', height: '48px', marginBottom: '16px', color: '#e6eaf0' }} />
                <p>No communications yet</p>
              </div>
            ) : (
              threadGroups.map((thread) => {
                const isExpanded = expandedThreads.has(thread.id);
                const hasMultiple = thread.communications.length > 1;
                const latestComm = thread.communications[thread.communications.length - 1];
                const containsHighlight = thread.communications.some(c => c.id === highlightCommunicationId);

                // Auto-expand threads containing the highlighted message
                if (containsHighlight && !isExpanded && hasMultiple) {
                  // Defer state update to avoid render loop
                  setTimeout(() => toggleThread(thread.id), 0);
                }

                return (
                  <div key={thread.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Thread Header - show when multiple messages */}
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
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '10px 12px',
                            background: thread.hasInbound && thread.hasOutbound ? '#f5f3ff' : thread.hasInbound ? '#eff6ff' : '#f0fdf4',
                            border: `1px solid ${thread.hasInbound && thread.hasOutbound ? '#e9d5ff' : thread.hasInbound ? '#dbeafe' : '#bbf7d0'}`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ paddingTop: '2px' }}>
                            {isExpanded ? (
                              <ChevronDown style={{
                                width: '16px',
                                height: '16px',
                                color: thread.hasInbound && thread.hasOutbound ? '#7c3aed' : thread.hasInbound ? '#3b82f6' : '#22c55e',
                              }} />
                            ) : (
                              <ChevronRight style={{
                                width: '16px',
                                height: '16px',
                                color: thread.hasInbound && thread.hasOutbound ? '#7c3aed' : thread.hasInbound ? '#3b82f6' : '#22c55e',
                              }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0b1220', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {thread.subject}
                              </div>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '22px',
                                height: '22px',
                                padding: '0 6px',
                                borderRadius: '11px',
                                fontSize: '12px',
                                fontWeight: 600,
                                flexShrink: 0,
                                background: thread.hasInbound && thread.hasOutbound ? '#7c3aed' : thread.hasInbound ? '#3b82f6' : '#22c55e',
                                color: '#ffffff',
                              }}>
                                {thread.communications.length}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#667085', marginTop: '2px' }}>
                              {dateDisplay}{thread.hasInbound && thread.hasOutbound ? ' · Back & forth' : ''}
                            </div>
                            {/* Thread Summary - only when collapsed */}
                            {!isExpanded && thread.summary && (
                              <div style={{
                                fontSize: '11px',
                                color: '#4b5563',
                                marginTop: '6px',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: '1.4',
                              }}>
                                {thread.summary}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })()}

                    {/* Thread Messages */}
                    {(isExpanded || !hasMultiple) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: hasMultiple ? '12px' : '0' }}>
                        {thread.communications.map((comm) => (
                          <MessageBubble
                            key={comm.id}
                            comm={comm}
                            isHighlighted={comm.id === highlightCommunicationId}
                            highlightRef={comm.id === highlightCommunicationId ? highlightRef : undefined}
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

          {/* Context boxes row */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e6eaf0',
              display: 'flex',
              gap: '12px',
            }}
          >
            {/* AI Box */}
            <div
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                fontSize: '12px',
                background: '#f5f3ff',
                border: '1px solid #e9d5ff',
                color: '#3b0764',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>AI Interpretation</div>
              {aiSummary}
            </div>

            {/* CC Box */}
            <div
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '12px',
                fontSize: '12px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#78350f',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Command Center Signal</div>
              {workItemSignalType ? (
                <>{workItemSignalType.replace(/_/g, ' ')} • Requires attention</>
              ) : (
                'Signal context from work item'
              )}
            </div>
          </div>

          {/* Footer (actions) */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e6eaf0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {/* Add Contact button */}
            <button
              onClick={() => setShowAddContact(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '10px',
                border: '1px solid #e6eaf0',
                background: '#ffffff',
                color: '#0b1220',
                cursor: 'pointer',
              }}
              title="Add contact"
            >
              <UserPlus style={{ width: '14px', height: '14px' }} />
              Contact
            </button>

            {/* Manage Products button */}
            <button
              onClick={() => setShowManageProducts(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '10px',
                border: '1px solid #e6eaf0',
                background: '#ffffff',
                color: '#0b1220',
                cursor: 'pointer',
              }}
              title="Manage products"
            >
              <Package style={{ width: '14px', height: '14px' }} />
              Products
            </button>

            {/* Schedule dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '10px',
                  border: '1px solid #e6eaf0',
                  background: '#ffffff',
                  color: '#0b1220',
                  cursor: 'pointer',
                }}
              >
                Schedule
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showScheduleDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: '4px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e6eaf0',
                    boxShadow: '0 10px 25px rgba(16, 24, 40, 0.15)',
                    zIndex: 100,
                    minWidth: '160px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => {
                      setShowScheduleDropdown(false);
                      onSchedule?.();
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '12px',
                      textAlign: 'left',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontWeight: 500, color: '#0b1220' }}>AI Scheduler</span>
                    <span style={{ fontSize: '11px', color: '#667085' }}>Let AI handle scheduling</span>
                  </button>
                  <div style={{ height: '1px', background: '#e6eaf0' }} />
                  <button
                    onClick={() => {
                      setShowScheduleDropdown(false);
                      onQuickBook?.();
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '12px',
                      textAlign: 'left',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontWeight: 500, color: '#0b1220' }}>Quick Book</span>
                    <span style={{ fontSize: '11px', color: '#667085' }}>Manually create meeting</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (sortedComms.length > 0) {
                  handleReply(sortedComms[sortedComms.length - 1]);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '10px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <Maximize2 style={{ width: '14px', height: '14px' }} />
              Quick Reply
            </button>
          </div>
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
          companyName={companyName}
          workItemId={workItemId}
          workItemSignalType={workItemSignalType}
          onSuccess={handleReplySuccess}
        />
      )}

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        onContactAdded={() => setShowAddContact(false)}
        companyId={companyId}
        companyName={companyName}
      />

      {/* Manage Products Modal */}
      <ManageProductsModal
        isOpen={showManageProducts}
        onClose={() => setShowManageProducts(false)}
        companyId={companyId}
        companyName={companyName}
        onUpdated={() => {}}
      />
    </>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

interface MessageBubbleProps {
  comm: Communication;
  isHighlighted: boolean;
  highlightRef?: React.RefObject<HTMLDivElement | null>;
  onReply: () => void;
}

function MessageBubble({ comm, isHighlighted, highlightRef, onReply }: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isOutbound = comm.direction === 'outbound';

  // Use analysis summary if available, otherwise content preview
  const displayContent = comm.current_analysis?.summary || comm.content_preview || 'No content';

  // Sender name
  const senderName = isOutbound
    ? (comm.our_participants?.[0]?.name?.split(' ')[0] || 'You')
    : (comm.their_participants?.[0]?.name?.split(' ')[0] || 'Contact');

  const timestamp = format(new Date(comm.occurred_at), 'MMM d, h:mm a');

  return (
    <div
      ref={highlightRef as React.RefObject<HTMLDivElement>}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        maxWidth: '80%',
        padding: '10px 12px',
        borderRadius: '14px',
        background: isOutbound ? '#eff6ff' : '#f1f5f9',
        border: isOutbound ? '1px solid #dbeafe' : '1px solid #e2e8f0',
        alignSelf: isOutbound ? 'flex-end' : 'flex-start',
        boxShadow: isHighlighted ? '0 0 0 2px #f59e0b' : 'none',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px',
          fontSize: '12px',
          marginBottom: '6px',
        }}
      >
        <b style={{ color: '#0b1220' }}>{senderName}</b>
        <span style={{ color: '#667085' }}>{timestamp}</span>
      </div>

      {/* Subject if exists */}
      {comm.subject && (
        <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 500, color: '#64748b' }}>
          {comm.subject}
        </p>
      )}

      {/* Content */}
      <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#334155' }}>
        {displayContent}
      </p>

      {/* Awaiting response indicator */}
      {comm.awaiting_our_response && !comm.responded_at && !isOutbound && (
        <div style={{
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          color: '#d97706',
        }}>
          <AlertCircle style={{ width: '12px', height: '12px' }} />
          <span>Awaiting response</span>
        </div>
      )}

      {/* Reply button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReply();
        }}
        style={{
          position: 'absolute',
          bottom: '-8px',
          right: isOutbound ? 'auto' : '8px',
          left: isOutbound ? '8px' : 'auto',
          padding: '4px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 500,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        Reply
      </button>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { CommunicationsDrawerProps };
