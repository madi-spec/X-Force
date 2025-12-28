'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Mail,
  Phone,
  Video,
  MessageSquare,
  Bot,
  Paperclip,
  Play,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  ExternalLink,
  X,
  Calendar,
  EyeOff,
  Building2,
  UserPlus,
  Loader2,
  Send,
  FileText,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { ComposeModal } from '@/components/inbox/ComposeModal';
import { ScheduleMeetingModal } from '@/components/dailyDriver/ScheduleMeetingModal';
import { AssignToCompanyModal } from './AssignToCompanyModal';
import { CreateLeadFromEmail } from './CreateLeadFromEmail';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
  ai_action_type: string | null;
  recording_url: string | null;
  attachments: unknown[];
  our_participants: Array<{ name?: string; email?: string }>;
  their_participants: Array<{ name?: string; email?: string }>;
  source_table: string | null;
  source_id: string | null;
  company_id: string | null;
  awaiting_our_response: boolean | null;
  responded_at: string | null;
  current_analysis: {
    summary: string | null;
    sentiment: string | null;
    sentiment_score: number | null;
    extracted_signals: Array<{ signal: string }>;
    extracted_commitments_us: Array<{ commitment: string }>;
    extracted_commitments_them: Array<{ commitment: string }>;
    products_discussed: string[];
  } | null;
  contact: { id: string; name: string; email: string } | null;
}

const channelIcons: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Video,
  sms: MessageSquare,
};

const sentimentIcons: Record<string, { icon: React.ElementType; color: string }> = {
  positive: { icon: Smile, color: 'text-green-500' },
  neutral: { icon: Meh, color: 'text-gray-400' },
  negative: { icon: Frown, color: 'text-red-500' },
  concerned: { icon: AlertCircle, color: 'text-yellow-500' },
  excited: { icon: Smile, color: 'text-green-600' },
};

// Helper to detect scheduling confirmation emails
function isSchedulingConfirmation(comm: Communication): { isScheduling: boolean; customerMessage?: string } {
  const content = comm.full_content || comm.content_preview || '';
  const subject = comm.subject || '';

  // Check for scheduling tool senders (from our participants for outbound confirmations)
  const ourEmails = (comm.our_participants as Array<{ email?: string }> || [])
    .map(p => p.email?.toLowerCase() || '');
  const isFromSchedulingTool = ourEmails.some(email =>
    email.includes('calendly') ||
    email.includes('hubspot.com') ||
    email.includes('scheduling') ||
    email.includes('booking') ||
    email.includes('acuity')
  );

  // Specific patterns that ONLY appear in scheduling confirmations
  // Must be very specific to avoid false positives
  const schedulingConfirmationPatterns = [
    /^looking forward to speaking with you!?\s*$/im, // Exact scheduling footer
    /new event:.+has been scheduled/i,
    /your meeting is booked/i,
    /your meeting has been scheduled/i,
    /appointment confirmed/i,
    /booking confirmed/i,
  ];

  // Content structure patterns unique to scheduling confirmations
  // These emails typically have: separator (===), short message, separator, "Looking forward..."
  const hasSchedulingStructure =
    content.includes('==========') &&
    /looking forward to speaking with you/i.test(content) &&
    content.length < 1000; // Scheduling confirmations are typically short

  const hasSchedulingPattern = schedulingConfirmationPatterns.some(p => p.test(content));

  // Require either: scheduling tool sender + structure, OR very specific pattern
  if ((isFromSchedulingTool && hasSchedulingStructure) || hasSchedulingPattern) {
    // Try to extract customer's message (between separators)
    let customerMessage: string | undefined;

    // Look for content between separator lines
    const betweenSeparators = content.match(/={5,}\s*([\s\S]*?)\s*={5,}/);
    if (betweenSeparators && betweenSeparators[1]) {
      const msg = betweenSeparators[1].trim();
      if (msg.length > 10 && msg.length < 500) {
        customerMessage = msg;
      }
    }

    // Fallback: look for lines before "Looking forward"
    if (!customerMessage) {
      const beforeLookingForward = content.split(/looking forward to speaking/i)[0];
      const lines = beforeLookingForward.split('\n').filter(l =>
        l.trim().length > 15 &&
        !l.includes('=====') &&
        !l.includes('Subject:') &&
        !l.includes('From:') &&
        !l.includes('To:')
      );
      if (lines.length > 0) {
        customerMessage = lines[lines.length - 1].trim();
      }
    }

    return { isScheduling: true, customerMessage };
  }

  return { isScheduling: false };
}

// Helper to generate smart display content
function getDisplayContent(comm: Communication): {
  title: string | null;
  summary: string;
  isMinimized?: boolean;
  type?: 'calendar_response' | 'scheduling_confirmation' | 'normal';
} {
  const subject = comm.subject || '';

  // Check for calendar responses (Accepted/Declined/Tentative)
  const calendarPatterns = [
    { pattern: /^Accepted:\s*/i, status: 'confirmed' },
    { pattern: /^Declined:\s*/i, status: 'declined' },
    { pattern: /^Tentative:\s*/i, status: 'tentatively accepted' },
  ];

  for (const { pattern, status } of calendarPatterns) {
    if (pattern.test(subject)) {
      const meetingTitle = subject.replace(pattern, '');
      const dateStr = format(new Date(comm.occurred_at), 'MMM d');
      return {
        title: null,
        summary: `Meeting "${meetingTitle}" ${status} for ${dateStr}`,
        isMinimized: true,
        type: 'calendar_response'
      };
    }
  }

  // Check for scheduling confirmations
  const scheduling = isSchedulingConfirmation(comm);
  if (scheduling.isScheduling) {
    const dateStr = format(new Date(comm.occurred_at), 'MMM d');
    const direction = comm.direction === 'outbound' ? 'Sent' : 'Received';
    let summary = `📅 Meeting scheduled: "${subject}" (${dateStr})`;

    if (scheduling.customerMessage) {
      summary += `\n💬 "${scheduling.customerMessage}"`;
    }

    return {
      title: null,
      summary,
      isMinimized: true,
      type: 'scheduling_confirmation'
    };
  }

  // Helper to extract summary from content
  const extractFromContent = (): string => {
    const content = comm.content_preview || comm.full_content || '';
    if (!content) return 'No content';

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const twoSentences = sentences.slice(0, 2).join('. ').trim();
    return twoSentences.length > 150
      ? twoSentences.substring(0, 150) + '...'
      : twoSentences + (sentences.length > 0 ? '.' : '');
  };

  // Use analysis summary if available AND it's not a "no content" placeholder
  const analysisSummary = comm.current_analysis?.summary;
  if (analysisSummary) {
    // Skip analysis if it indicates empty/no content (bad AI analysis)
    const isEmptyPlaceholder = /empty|no content|no actual content|couldn't extract/i.test(analysisSummary);
    if (!isEmptyPlaceholder) {
      // For display, truncate long summaries (full version shown when expanded)
      let displaySummary = analysisSummary;
      if (analysisSummary.length > 200) {
        // Find a good break point (end of sentence or word)
        const truncated = analysisSummary.substring(0, 200);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastSpace = truncated.lastIndexOf(' ');
        const breakPoint = lastPeriod > 150 ? lastPeriod + 1 : lastSpace;
        displaySummary = truncated.substring(0, breakPoint).trim() + '...';
      }
      return {
        title: subject || null,
        summary: displaySummary,
        isMinimized: false,
        type: 'normal'
      };
    }
  }

  // Fall back to content preview (first 2 sentences or 150 chars)
  return {
    title: subject || null,
    summary: extractFromContent(),
    isMinimized: false,
    type: 'normal'
  };
}

interface CommunicationBubbleProps {
  comm: Communication;
  onViewSource: (comm: Communication) => void;
  onExclude?: (comm: Communication) => void;
  onAssign?: (comm: Communication) => void;
  onCreateLead?: (comm: Communication) => void;
  onTaskClick?: (comm: Communication) => void;
}

// Internal domains that should be treated as "us" (outgoing)
const INTERNAL_DOMAINS = ['voiceforpest.com', 'affiliatedtech.net', 'affiliatedtech.com', 'xrailabsteam.com', 'xrailabs.com'];

function isInternalEmail(email: string | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return INTERNAL_DOMAINS.some(d => domain === d || domain?.endsWith('.' + d));
}

// Check if communication is purely internal (all participants from internal domains)
function isInternalOnly(comm: { our_participants: Array<{ email?: string }>; their_participants: Array<{ email?: string }> }): boolean {
  const allParticipants = [
    ...(comm.our_participants || []),
    ...(comm.their_participants || [])
  ];

  // If no participants, not internal
  if (allParticipants.length === 0) return false;

  // Check if ALL participants are from internal domains
  return allParticipants.every(p => isInternalEmail(p.email));
}

function CommunicationBubble({
  comm,
  onViewSource,
  onExclude,
  onAssign,
  onCreateLead,
  onTaskClick,
  hasTask
}: CommunicationBubbleProps & { hasTask?: boolean }) {
  const [showActions, setShowActions] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Check if sender is from internal domain (treat as outbound even if direction says inbound)
  const senderEmail = comm.direction === 'inbound'
    ? comm.their_participants?.[0]?.email
    : comm.our_participants?.[0]?.email;
  const isFromInternalDomain = isInternalEmail(senderEmail);
  const isOutbound = comm.direction === 'outbound' || isFromInternalDomain;
  const isUnlinked = !comm.company_id;
  const isInternal = isInternalOnly(comm);
  const Icon = comm.is_ai_generated ? Bot : channelIcons[comm.channel] || Mail;
  const hasSource = comm.source_table && comm.source_id;
  const displayContent = getDisplayContent(comm);

  // Close menu when clicking outside (must be before any early returns)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    }
    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActions]);

  // Render internal-only communications in a centered, muted style
  if (isInternal) {
    return (
      <div className="flex justify-center mb-2">
        <div className="max-w-[85%] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {/* Header */}
          <div className="flex items-center justify-center gap-2 text-xs text-amber-600 mb-1">
            <Mail className="w-3 h-3" />
            <span className="font-medium">Internal</span>
            <span>•</span>
            <span>{format(new Date(comm.occurred_at), 'MMM d, h:mm a')}</span>
            <span>•</span>
            <span>{comm.our_participants?.[0]?.name?.split(' ')[0] || 'Team'}</span>
            {comm.their_participants?.[0]?.name && (
              <>
                <span>→</span>
                <span>{comm.their_participants[0].name.split(' ')[0]}</span>
              </>
            )}
          </div>
          {/* Content */}
          <div className="flex gap-2">
            <p className="text-sm text-amber-900 flex-1">{displayContent.summary}</p>
            {hasSource && (
              <button
                onClick={() => onViewSource(comm)}
                className="flex-shrink-0 p-1 rounded transition-colors hover:bg-amber-100 text-amber-400 hover:text-amber-600 self-start"
                title="View Original"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleExclude = async () => {
    setActionLoading('exclude');
    try {
      const res = await fetch(`/api/communications/${comm.id}/exclude`, { method: 'POST' });
      if (res.ok) {
        // Refresh all communications-related SWR caches
        globalMutate(key => typeof key === 'string' && key.startsWith('/api/communications'));
        onExclude?.(comm);
      }
    } finally {
      setActionLoading(null);
      setShowActions(false);
    }
  };

  // Render minimized version for calendar responses and scheduling confirmations
  if (displayContent.isMinimized) {
    return (
      <div className="flex justify-center mb-3">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs ${
          displayContent.type === 'scheduling_confirmation'
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-gray-100 text-gray-600 border border-gray-200'
        }`}>
          <Calendar className="w-3.5 h-3.5" />
          <span className="whitespace-pre-line">{displayContent.summary}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-400">{format(new Date(comm.occurred_at), 'MMM d')}</span>
          {hasSource && (
            <button
              onClick={() => onViewSource(comm)}
              className="ml-1 p-1 hover:bg-white/50 rounded"
              title="View original"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 mb-2 ${isOutbound ? 'flex-row-reverse' : ''}`}>
      {/* Avatar/Icon - Compact */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        comm.is_ai_generated
          ? 'bg-purple-100'
          : isOutbound
            ? 'bg-blue-100'
            : 'bg-gray-100'
      }`}>
        <Icon className={`w-3.5 h-3.5 ${
          comm.is_ai_generated
            ? 'text-purple-600'
            : isOutbound
              ? 'text-blue-600'
              : 'text-gray-600'
        }`} />
      </div>

      {/* Message Bubble */}
      <div className={`flex-1 max-w-[80%] ${isOutbound ? 'items-end' : 'items-start'}`}>
        {/* Header - Compact single line */}
        <div className={`flex items-center gap-1.5 mb-0.5 text-xs text-gray-500 ${
          isOutbound ? 'flex-row-reverse' : ''
        }`}>
          <span className="font-medium text-gray-700">
            {comm.is_ai_generated
              ? 'AI'
              : isOutbound
                ? (comm.our_participants?.[0]?.name?.split(' ')[0] || 'You')
                : (comm.their_participants?.[0]?.name?.split(' ')[0] || comm.contact?.name?.split(' ')[0] || 'Contact')
            }
          </span>
          <span className="text-gray-400">•</span>
          <span>{format(new Date(comm.occurred_at), 'MMM d, h:mm a')}</span>
          {comm.channel !== 'email' && (
            <span className="capitalize text-gray-400">• {comm.channel}</span>
          )}
          {comm.duration_seconds && (
            <span className="text-gray-400">• {Math.round(comm.duration_seconds / 60)}m</span>
          )}
        </div>

        {/* Content Bubble - Compact */}
        <div className={`rounded-xl px-3 py-2 ${
          isOutbound
            ? 'bg-blue-500 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-900 rounded-tl-sm'
        }`}>
          {/* Content with inline popout */}
          <div className="flex gap-2">
            {/* Task badge inline - always red, clickable */}
            {hasTask && (
              <button
                onClick={() => onTaskClick?.(comm)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full self-start mt-0.5 bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                title="Click to resolve task"
              >
                <AlertCircle className="w-2.5 h-2.5" />
              </button>
            )}

            {/* Summary Content */}
            <p className="text-sm flex-1">{displayContent.summary}</p>

            {/* Popout button - compact, right side */}
            {(hasSource || (comm.channel === 'meeting' && comm.current_analysis)) && (
              <button
                onClick={() => onViewSource(comm)}
                className={`flex-shrink-0 p-1 rounded transition-colors self-start ${
                  isOutbound
                    ? 'hover:bg-blue-400 text-blue-200 hover:text-white'
                    : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                }`}
                title={comm.channel === 'meeting' ? 'View Full Analysis' : 'View Original'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Inline extras: attachments + recording */}
          {((comm.attachments && comm.attachments.length > 0) || comm.recording_url) && (
            <div className={`flex items-center gap-3 mt-1.5 text-xs ${
              isOutbound ? 'text-blue-200' : 'text-gray-500'
            }`}>
              {comm.attachments && comm.attachments.length > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {comm.attachments.length}
                </span>
              )}
              {comm.recording_url && (
                <a
                  href={comm.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1 ${
                    isOutbound ? 'hover:text-white' : 'hover:text-blue-600'
                  }`}
                >
                  <Play className="w-3 h-3" />
                  Recording
                </a>
              )}
            </div>
          )}

          {/* Action Buttons for Unlinked Communications */}
          {isUnlinked && (
            <div className={`mt-3 pt-3 border-t ${isOutbound ? 'border-blue-400' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExclude}
                  disabled={actionLoading === 'exclude'}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isOutbound
                      ? 'text-blue-200 hover:bg-blue-400 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-50`}
                  title="Hide this email"
                >
                  {actionLoading === 'exclude' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                  Exclude
                </button>
                <button
                  onClick={() => onAssign?.(comm)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isOutbound
                      ? 'text-blue-200 hover:bg-blue-400 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title="Assign to existing company"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Assign
                </button>
                <button
                  onClick={() => onCreateLead?.(comm)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isOutbound
                      ? 'bg-blue-400 text-white hover:bg-blue-300'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  title="Create new lead"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create Lead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Source Preview Modal Component - Shows email source or meeting analysis
function SourcePreviewModal({
  communication,
  onClose
}: {
  communication: Communication;
  onClose: () => void;
}) {
  const isMeeting = communication.channel === 'meeting';
  const isEmail = communication.source_table === 'email_messages';

  // Only fetch source data for emails, not for meetings (we use analysis instead)
  const { data, isLoading, error } = useSWR(
    !isMeeting && communication.source_table && communication.source_id
      ? `/api/communications/source?table=${communication.source_table}&id=${communication.source_id}`
      : null,
    fetcher
  );

  const analysis = communication.current_analysis;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isMeeting ? 'bg-purple-100' : 'bg-blue-100'}`}>
              {isMeeting ? (
                <Video className="w-5 h-5 text-purple-600" />
              ) : (
                <Mail className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {isMeeting ? 'Meeting Analysis' : 'Original Email'}
              </h2>
              <p className="text-sm text-gray-500">
                {communication.subject || 'No subject'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Meeting Analysis View */}
          {isMeeting ? (
            analysis ? (
              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Summary</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{analysis.summary}</p>
                </div>

                {/* Sentiment */}
                {analysis.sentiment && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Sentiment</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                      analysis.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                      analysis.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {analysis.sentiment}
                      {analysis.sentiment_score && ` (${Math.round(analysis.sentiment_score * 100)}%)`}
                    </span>
                  </div>
                )}

                {/* Signals */}
                {analysis.extracted_signals && analysis.extracted_signals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Buying Signals</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.extracted_signals.map((signal, i) => (
                        <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {signal.signal.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products Discussed */}
                {analysis.products_discussed && analysis.products_discussed.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Products Discussed</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.products_discussed.map((product, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {product}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Our Commitments */}
                {analysis.extracted_commitments_us && analysis.extracted_commitments_us.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Our Commitments</h3>
                    <ul className="space-y-2">
                      {analysis.extracted_commitments_us.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className="text-blue-500 mt-1">→</span>
                          {c.commitment}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Their Commitments */}
                {analysis.extracted_commitments_them && analysis.extracted_commitments_them.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Their Commitments</h3>
                    <ul className="space-y-2">
                      {analysis.extracted_commitments_them.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className="text-green-500 mt-1">←</span>
                          {c.commitment}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No analysis available for this meeting
              </div>
            )
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              Failed to load source data
            </div>
          ) : data?.source ? (
            <div className="space-y-4">
              {/* Email-specific fields */}
              {isEmail && data.source.from_email && (
                <div className="grid grid-cols-[80px_1fr] gap-2 text-sm border-b pb-4">
                  <span className="text-gray-500">From:</span>
                  <span className="text-gray-900">
                    {data.source.from_name ? `${data.source.from_name} <${data.source.from_email}>` : data.source.from_email}
                  </span>

                  {data.source.to_emails && (
                    <>
                      <span className="text-gray-500">To:</span>
                      <span className="text-gray-900">
                        {Array.isArray(data.source.to_emails)
                          ? data.source.to_emails.join(', ')
                          : data.source.to_emails}
                      </span>
                    </>
                  )}

                  <span className="text-gray-500">Date:</span>
                  <span className="text-gray-900">
                    {format(new Date(data.source.received_at || data.source.sent_at || communication.occurred_at), 'PPpp')}
                  </span>

                  {data.source.subject && (
                    <>
                      <span className="text-gray-500">Subject:</span>
                      <span className="text-gray-900 font-medium">{data.source.subject}</span>
                    </>
                  )}
                </div>
              )}

              {/* Body Content (emails only - meetings use analysis view above) */}
              <div className="text-sm text-gray-700 leading-relaxed">
                {data.source.body_html ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: data.source.body_html }}
                    className="email-html-content [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_td]:p-1 [&_a]:text-blue-600 [&_a]:underline [&_p]:mb-3 [&_br]:block [&_br]:mb-2"
                    style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                  />
                ) : (
                  <div className="space-y-3">
                    {(data.source.body_text || 'No content').split(/\n\n+/).map((paragraph: string, i: number) => (
                      <p key={i} className="whitespace-pre-wrap">
                        {paragraph.split('\n').map((line: string, j: number) => (
                          <span key={j}>
                            {line}
                            {j < paragraph.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No source data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Task Resolution Modal - allows resolving tasks directly from communications with full Daily Driver capabilities
function TaskResolutionModal({
  communication,
  flagId,
  companyId,
  companyName,
  onClose,
  onResolved
}: {
  communication: Communication;
  flagId: string | null;
  companyId: string | null;
  companyName: string | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'actions' | 'draft'>('actions');

  // Draft state
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftData, setDraftData] = useState<{
    subject: string;
    body: string;
    to: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal states
  const [showCompose, setShowCompose] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const isAwaitingResponse = communication.awaiting_our_response && !communication.responded_at;

  // Get contact info from communication
  const contactEmail = communication.their_participants?.[0]?.email || communication.contact?.email || '';
  const contactName = communication.their_participants?.[0]?.name || communication.contact?.name || '';

  const handleResolveFlag = async () => {
    if (!flagId) return;
    setLoading('resolve');
    setError(null);
    try {
      const res = await fetch(`/api/attention-flags/${flagId}/resolve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to resolve');
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setLoading(null);
    }
  };

  const handleMarkResponded = async () => {
    setLoading('respond');
    setError(null);
    try {
      const res = await fetch(`/api/communications/${communication.id}/respond`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark as responded');
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as responded');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateDraft = async () => {
    setDraftLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communications/${communication.id}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to generate draft');
      }
      setDraftData({
        subject: json.draft.subject,
        body: json.draft.body,
        to: json.context.contact_email || contactEmail,
      });
      setMode('draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendDraft = async () => {
    if (!draftData) return;
    setLoading('send');
    setError(null);
    try {
      const res = await fetch('/api/communications/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communicationId: communication.id,
          to: draftData.to,
          subject: draftData.subject,
          body: draftData.body,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to send email');
      }
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = async (field: 'subject' | 'body' | 'all') => {
    if (!draftData) return;
    let text = '';
    if (field === 'subject') text = draftData.subject;
    else if (field === 'body') text = draftData.body;
    else text = `Subject: ${draftData.subject}\n\n${draftData.body}`;

    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Handle compose modal sent
  const handleComposeSent = () => {
    setShowCompose(false);
    onResolved();
  };

  // Handle schedule modal completed
  const handleScheduleCompleted = () => {
    setShowSchedule(false);
    onResolved();
  };

  if (showCompose) {
    return (
      <ComposeModal
        isOpen={true}
        onClose={() => setShowCompose(false)}
        onSent={handleComposeSent}
        toEmail={contactEmail}
        toName={contactName}
        subject={communication.subject ? `Re: ${communication.subject}` : undefined}
        companyId={companyId || undefined}
      />
    );
  }

  if (showSchedule && companyId && companyName) {
    return (
      <ScheduleMeetingModal
        isOpen={true}
        onClose={() => setShowSchedule(false)}
        companyId={companyId}
        companyName={companyName}
        contactName={contactName}
        contactEmail={contactEmail}
        sourceCommunicationId={communication.id}
        onScheduled={handleScheduleCompleted}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {mode === 'draft' ? 'AI Draft Reply' : 'Take Action'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAwaitingResponse ? 'Response needed' : 'Task on this communication'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {mode === 'actions' ? (
            <div className="space-y-4">
              {/* Communication preview */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(communication.occurred_at), 'MMM d, h:mm a')}
                  </p>
                  {contactName && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      from {contactName}
                    </span>
                  )}
                </div>
                {communication.subject && (
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {communication.subject}
                  </p>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {communication.content_preview || 'No content'}
                </p>
              </div>

              {/* Action buttons grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Reply manually */}
                <button
                  onClick={() => setShowCompose(true)}
                  disabled={!!loading}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
                    'hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Send className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Reply</span>
                </button>

                {/* AI Draft Reply */}
                <button
                  onClick={handleGenerateDraft}
                  disabled={!!loading || draftLoading}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20',
                    'hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {draftLoading ? (
                    <Loader2 className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-spin" />
                  ) : (
                    <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  )}
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    {draftLoading ? 'Drafting...' : 'AI Draft'}
                  </span>
                </button>

                {/* Schedule */}
                <button
                  onClick={() => setShowSchedule(true)}
                  disabled={!!loading || !companyId}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
                    'hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Schedule</span>
                </button>

                {/* Mark as Done */}
                <button
                  onClick={isAwaitingResponse ? handleMarkResponded : handleResolveFlag}
                  disabled={!!loading || (!isAwaitingResponse && !flagId)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                    'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
                    'hover:border-green-400 dark:hover:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/40',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loading === 'respond' || loading === 'resolve' ? (
                    <Loader2 className="w-6 h-6 text-green-600 dark:text-green-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  )}
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Mark Done</span>
                </button>
              </div>
            </div>
          ) : (
            /* Draft mode */
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => setMode('actions')}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ← Back to actions
              </button>

              {draftData && (
                <>
                  {/* To field */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      To
                    </label>
                    <input
                      type="email"
                      value={draftData.to}
                      onChange={(e) => setDraftData({ ...draftData, to: e.target.value })}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg border',
                        'bg-white dark:bg-gray-800',
                        'border-gray-200 dark:border-gray-700',
                        'text-gray-900 dark:text-gray-100',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500'
                      )}
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subject
                      </label>
                      <button
                        onClick={() => handleCopy('subject')}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded',
                          copiedField === 'subject'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        )}
                      >
                        {copiedField === 'subject' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'subject' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={draftData.subject}
                      onChange={(e) => setDraftData({ ...draftData, subject: e.target.value })}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg border',
                        'bg-white dark:bg-gray-800',
                        'border-gray-200 dark:border-gray-700',
                        'text-gray-900 dark:text-gray-100',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500'
                      )}
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Body
                      </label>
                      <button
                        onClick={() => handleCopy('body')}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded',
                          copiedField === 'body'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        )}
                      >
                        {copiedField === 'body' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'body' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      value={draftData.body}
                      onChange={(e) => setDraftData({ ...draftData, body: e.target.value })}
                      rows={8}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg border resize-none',
                        'bg-white dark:bg-gray-800',
                        'border-gray-200 dark:border-gray-700',
                        'text-gray-900 dark:text-gray-100',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500'
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            {mode === 'draft' && draftData && (
              <button
                onClick={() => handleCopy('all')}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg',
                  copiedField === 'all'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                )}
              >
                {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'all' ? 'Copied' : 'Copy All'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={!!loading}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>

            {mode === 'draft' && draftData && (
              <button
                onClick={handleSendDraft}
                disabled={!!loading || !draftData.to}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                  'bg-blue-600 text-white hover:bg-blue-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                {loading === 'send' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Email
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConversationCluster {
  id: string;
  communications: Communication[];
  startDate: Date;
  endDate: Date;
}

// Group communications into conversation clusters (back-and-forth within 3 days on related topics)
function groupIntoConversations(comms: Communication[]): ConversationCluster[] {
  if (comms.length === 0) return [];

  const clusters: ConversationCluster[] = [];
  let currentCluster: Communication[] = [];
  let clusterStartDate: Date | null = null;

  for (const comm of comms) {
    const commDate = new Date(comm.occurred_at);

    if (currentCluster.length === 0) {
      // Start new cluster
      currentCluster = [comm];
      clusterStartDate = commDate;
    } else {
      // Check if this message belongs to the current cluster
      const lastComm = currentCluster[currentCluster.length - 1];
      const lastDate = new Date(lastComm.occurred_at);
      const daysDiff = (commDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      // Same cluster if: within 3 days AND (alternating direction OR same channel)
      const isAlternating = comm.direction !== lastComm.direction;
      const isSameChannel = comm.channel === lastComm.channel;

      if (daysDiff <= 3 && (isAlternating || isSameChannel)) {
        currentCluster.push(comm);
      } else {
        // Save current cluster and start new one
        clusters.push({
          id: currentCluster[0].id,
          communications: currentCluster,
          startDate: clusterStartDate!,
          endDate: lastDate
        });
        currentCluster = [comm];
        clusterStartDate = commDate;
      }
    }
  }

  // Add the last cluster
  if (currentCluster.length > 0) {
    clusters.push({
      id: currentCluster[0].id,
      communications: currentCluster,
      startDate: clusterStartDate!,
      endDate: new Date(currentCluster[currentCluster.length - 1].occurred_at)
    });
  }

  return clusters;
}

interface ConversationThreadProps {
  companyId: string | null;
  companyName?: string | null;
  contactId?: string | null;
  senderEmail?: string | null;
  channelFilter: string | null;
}

export function ConversationThread({
  companyId,
  companyName,
  contactId,
  senderEmail,
  channelFilter
}: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedSource, setSelectedSource] = useState<Communication | null>(null);
  const [assigningComm, setAssigningComm] = useState<Communication | null>(null);
  const [creatingLeadComm, setCreatingLeadComm] = useState<Communication | null>(null);
  const [taskComm, setTaskComm] = useState<Communication | null>(null);

  // Build query params
  const params = new URLSearchParams();
  if (companyId) params.set('company_id', companyId);
  if (contactId) params.set('contact_id', contactId);
  if (senderEmail) params.set('sender_email', senderEmail);
  if (channelFilter === 'ai') {
    params.set('ai_only', 'true');
  } else if (channelFilter) {
    params.set('channel', channelFilter);
  }
  params.set('limit', '50');

  // Fetch when we have companyId OR senderEmail
  const shouldFetch = companyId || senderEmail;

  const { data, isLoading, mutate } = useSWR<{ communications: Communication[] }>(
    shouldFetch ? `/api/communications?${params.toString()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch attention flags for communications with open tasks
  const { data: tasksData, mutate: mutateTasks } = useSWR<{ flags: Array<{ id: string; source_id: string }> }>(
    companyId ? `/api/attention-flags?company_id=${companyId}&status=open&source_type=communication` : null,
    fetcher
  );

  // Create a map of communication IDs to flag IDs
  const commToFlagId = new Map<string, string>();
  for (const flag of (tasksData?.flags || [])) {
    if (flag.source_id) {
      commToFlagId.set(flag.source_id, flag.id);
    }
  }

  // Also check awaiting_our_response on communications themselves
  const commsWithTasks = new Set<string>();
  for (const comm of (data?.communications || [])) {
    // Check if this comm has an attention flag
    if (commToFlagId.has(comm.id)) {
      commsWithTasks.add(comm.id);
    }
    // Check if comm is awaiting our response (common task trigger)
    if (comm.awaiting_our_response && !comm.responded_at) {
      commsWithTasks.add(comm.id);
    }
  }

  const communications: Communication[] = data?.communications || [];

  // Sort oldest first (conversation order) and group by conversation clusters
  const sortedComms = [...communications].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // Group communications into conversation clusters (same topic within 3 days)
  const groupedComms = groupIntoConversations(sortedComms);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sortedComms.length]);

  if (!shouldFetch) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 h-full min-w-0">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Select a conversation</p>
          <p className="text-sm">Choose a company from the list to view communications</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full min-w-0">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (sortedComms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 h-full min-w-0">
        <div className="text-center text-gray-500">
          <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No communications yet</p>
          <p className="text-sm">Start a conversation with this company</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full min-w-0 overflow-hidden">
      {/* Thread Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {sortedComms[0]?.contact?.name || 'Company Conversation'}
            </h2>
            <p className="text-sm text-gray-500">
              {communications.length} communications
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Latest: {communications[0]?.occurred_at ? formatDistanceToNow(new Date(communications[0].occurred_at), { addSuffix: true }) : ''}</span>
          </div>
        </div>
      </div>

      {/* Messages grouped by conversation clusters */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {groupedComms.map((cluster, clusterIdx) => (
          <div key={cluster.id} className="mb-2">
            {/* Cluster separator - only show between clusters with multiple messages */}
            {clusterIdx > 0 && groupedComms[clusterIdx - 1].communications.length > 1 && (
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 px-2">
                  {format(cluster.startDate, 'MMM d')}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {/* Cluster container - visual grouping for multi-message clusters */}
            <div className={cluster.communications.length > 1 ? 'pl-2 border-l-2 border-blue-100' : ''}>
              {cluster.communications.map((comm) => (
                <CommunicationBubble
                  key={comm.id}
                  comm={comm}
                  onViewSource={setSelectedSource}
                  onExclude={() => mutate()}
                  onAssign={setAssigningComm}
                  onCreateLead={setCreatingLeadComm}
                  onTaskClick={setTaskComm}
                  hasTask={commsWithTasks.has(comm.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Source Preview Modal */}
      {selectedSource && (
        <SourcePreviewModal
          communication={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}

      {/* Assign to Company Modal */}
      {assigningComm && (
        <AssignToCompanyModal
          communication={assigningComm}
          onClose={() => setAssigningComm(null)}
          onAssigned={() => {
            setAssigningComm(null);
            mutate();
          }}
        />
      )}

      {/* Create Lead Modal */}
      {creatingLeadComm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setCreatingLeadComm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <button
              onClick={() => setCreatingLeadComm(null)}
              className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Lead from Email</h2>
            <CreateLeadFromEmail
              communicationId={creatingLeadComm.id}
              onLeadCreated={() => {
                setCreatingLeadComm(null);
                mutate();
              }}
            />
          </div>
        </div>
      )}

      {/* Task Resolution Modal */}
      {taskComm && (
        <TaskResolutionModal
          communication={taskComm}
          flagId={commToFlagId.get(taskComm.id) || null}
          companyId={companyId}
          companyName={companyName || null}
          onClose={() => setTaskComm(null)}
          onResolved={() => {
            setTaskComm(null);
            mutate();
            mutateTasks();
          }}
        />
      )}
    </div>
  );
}
