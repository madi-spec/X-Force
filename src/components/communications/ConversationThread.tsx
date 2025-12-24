'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Mail,
  Phone,
  Video,
  MessageSquare,
  Bot,
  Paperclip,
  Play,
  ChevronDown,
  ChevronUp,
  Smile,
  Meh,
  Frown,
  AlertCircle,
  ExternalLink,
  X,
  FileText,
  Calendar
} from 'lucide-react';

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
  our_participants: Array<{ name?: string }>;
  their_participants: Array<{ name?: string }>;
  source_table: string | null;
  source_id: string | null;
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
      return {
        title: subject || null,
        summary: analysisSummary,
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

function CommunicationBubble({
  comm,
  onViewSource
}: {
  comm: Communication;
  onViewSource: (comm: Communication) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isOutbound = comm.direction === 'outbound';
  const Icon = comm.is_ai_generated ? Bot : channelIcons[comm.channel] || Mail;
  const sentiment = sentimentIcons[comm.current_analysis?.sentiment || 'neutral'];
  const SentimentIcon = sentiment?.icon || Meh;
  const hasSource = comm.source_table && comm.source_id;
  const displayContent = getDisplayContent(comm);

  const hasAnalysis = comm.current_analysis && (
    (comm.current_analysis.extracted_signals?.length ?? 0) > 0 ||
    (comm.current_analysis.extracted_commitments_us?.length ?? 0) > 0 ||
    (comm.current_analysis.extracted_commitments_them?.length ?? 0) > 0
  );

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
    <div className={`flex gap-3 mb-4 ${isOutbound ? 'flex-row-reverse' : ''}`}>
      {/* Avatar/Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        comm.is_ai_generated
          ? 'bg-purple-100'
          : isOutbound
            ? 'bg-blue-100'
            : 'bg-gray-100'
      }`}>
        <Icon className={`w-5 h-5 ${
          comm.is_ai_generated
            ? 'text-purple-600'
            : isOutbound
              ? 'text-blue-600'
              : 'text-gray-600'
        }`} />
      </div>

      {/* Message Bubble */}
      <div className={`flex-1 max-w-[75%] ${isOutbound ? 'items-end' : 'items-start'}`}>
        {/* Header */}
        <div className={`flex items-center gap-2 mb-1 text-xs text-gray-500 ${
          isOutbound ? 'flex-row-reverse' : ''
        }`}>
          <span className="font-medium text-gray-700">
            {comm.is_ai_generated
              ? `AI ${comm.ai_action_type || 'Message'}`
              : isOutbound
                ? (comm.our_participants?.[0]?.name || 'You')
                : (comm.their_participants?.[0]?.name || comm.contact?.name || 'Contact')
            }
          </span>
          <span>•</span>
          <span>{format(new Date(comm.occurred_at), 'MMM d, h:mm a')}</span>
          {comm.channel !== 'email' && (
            <>
              <span>•</span>
              <span className="capitalize">{comm.channel}</span>
            </>
          )}
          {comm.duration_seconds && (
            <>
              <span>•</span>
              <span>{Math.round(comm.duration_seconds / 60)} min</span>
            </>
          )}
        </div>

        {/* Content Bubble */}
        <div className={`rounded-2xl p-4 ${
          isOutbound
            ? 'bg-blue-500 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-900 rounded-tl-sm'
        }`}>
          {/* Title (if not a calendar response) */}
          {displayContent.title && (
            <p className={`font-medium mb-2 ${isOutbound ? 'text-blue-100' : 'text-gray-500'}`}>
              {displayContent.title}
            </p>
          )}

          {/* Summary Content */}
          <p className={`text-sm ${expanded ? 'whitespace-pre-wrap' : ''}`}>
            {expanded ? (comm.full_content || comm.content_preview || 'No content') : displayContent.summary}
          </p>

          {/* Expand/Collapse - only show if there's more content */}
          {(comm.full_content?.length || 0) > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                isOutbound ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show full content <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}

          {/* Attachments */}
          {comm.attachments && comm.attachments.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${isOutbound ? 'border-blue-400' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 text-xs">
                <Paperclip className="w-3 h-3" />
                <span>{comm.attachments.length} attachment(s)</span>
              </div>
            </div>
          )}

          {/* Recording */}
          {comm.recording_url && (
            <div className={`mt-3 pt-3 border-t ${isOutbound ? 'border-blue-400' : 'border-gray-200'}`}>
              <a
                href={comm.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 text-xs ${
                  isOutbound ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <Play className="w-3 h-3" />
                Play Recording
              </a>
            </div>
          )}

          {/* View Source */}
          {hasSource && (
            <div className={`mt-3 pt-3 border-t ${isOutbound ? 'border-blue-400' : 'border-gray-200'}`}>
              <button
                onClick={() => onViewSource(comm)}
                className={`flex items-center gap-2 text-xs ${
                  isOutbound ? 'text-blue-200 hover:text-white' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <ExternalLink className="w-3 h-3" />
                View Original {comm.source_table === 'email_messages' ? 'Email' : 'Transcript'}
              </button>
            </div>
          )}
        </div>

        {/* AI Insights (Below bubble, for inbound only) */}
        {!isOutbound && hasAnalysis && (
          <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-4 text-xs flex-wrap">
              {/* Sentiment */}
              {comm.current_analysis?.sentiment && (
                <div className="flex items-center gap-1">
                  <SentimentIcon className={`w-4 h-4 ${sentiment?.color}`} />
                  <span className="capitalize text-gray-600">
                    {comm.current_analysis.sentiment}
                  </span>
                </div>
              )}

              {/* Signals */}
              {comm.current_analysis?.extracted_signals?.slice(0, 2).map((signal, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full"
                >
                  {signal.signal.replace(/_/g, ' ')}
                </span>
              ))}

              {/* Products */}
              {comm.current_analysis?.products_discussed?.slice(0, 2).map((product, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                >
                  {product}
                </span>
              ))}
            </div>

            {/* Commitments */}
            {((comm.current_analysis?.extracted_commitments_us?.length ?? 0) > 0 ||
              (comm.current_analysis?.extracted_commitments_them?.length ?? 0) > 0) && (
              <div className="mt-2 pt-2 border-t border-purple-100 grid grid-cols-2 gap-2 text-xs">
                {(comm.current_analysis?.extracted_commitments_us?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-gray-500">We promised: </span>
                    <span className="text-gray-700">
                      {comm.current_analysis?.extracted_commitments_us[0].commitment}
                    </span>
                  </div>
                )}
                {(comm.current_analysis?.extracted_commitments_them?.length ?? 0) > 0 && (
                  <div>
                    <span className="text-gray-500">They promised: </span>
                    <span className="text-gray-700">
                      {comm.current_analysis?.extracted_commitments_them[0].commitment}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Source Preview Modal Component
function SourcePreviewModal({
  communication,
  onClose
}: {
  communication: Communication;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useSWR(
    communication.source_table && communication.source_id
      ? `/api/communications/source?table=${communication.source_table}&id=${communication.source_id}`
      : null,
    fetcher
  );

  const isEmail = communication.source_table === 'email_messages';
  const isTranscript = communication.source_table === 'meeting_transcriptions';

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
            <div className={`p-2 rounded-lg ${isEmail ? 'bg-blue-100' : 'bg-purple-100'}`}>
              {isEmail ? (
                <Mail className={`w-5 h-5 ${isEmail ? 'text-blue-600' : 'text-purple-600'}`} />
              ) : (
                <FileText className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {isEmail ? 'Original Email' : 'Meeting Transcript'}
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
          {isLoading ? (
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

              {/* Transcript-specific fields */}
              {isTranscript && (
                <div className="grid grid-cols-[80px_1fr] gap-2 text-sm border-b pb-4">
                  {data.source.title && (
                    <>
                      <span className="text-gray-500">Title:</span>
                      <span className="text-gray-900 font-medium">{data.source.title}</span>
                    </>
                  )}

                  {data.source.meeting_date && (
                    <>
                      <span className="text-gray-500">Date:</span>
                      <span className="text-gray-900">
                        {format(new Date(data.source.meeting_date), 'PPpp')}
                      </span>
                    </>
                  )}

                  {data.source.duration_minutes && (
                    <>
                      <span className="text-gray-500">Duration:</span>
                      <span className="text-gray-900">{data.source.duration_minutes} minutes</span>
                    </>
                  )}

                  {data.source.attendees && (
                    <>
                      <span className="text-gray-500">Attendees:</span>
                      <span className="text-gray-900">
                        {Array.isArray(data.source.attendees)
                          ? data.source.attendees.map((a: { name?: string; email?: string }) => a.name || a.email).join(', ')
                          : data.source.attendees}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Body Content */}
              <div className="text-sm text-gray-700 leading-relaxed">
                {isEmail ? (
                  data.source.body_html ? (
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
                  )
                ) : (
                  <div className="space-y-3">
                    {(data.source.transcription_text || data.source.summary || 'No transcript content').split(/\n\n+/).map((paragraph: string, i: number) => (
                      <p key={i} className="whitespace-pre-wrap">
                        {paragraph}
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

interface ConversationThreadProps {
  companyId: string | null;
  contactId?: string | null;
  senderEmail?: string | null;
  channelFilter: string | null;
}

export function ConversationThread({
  companyId,
  contactId,
  senderEmail,
  channelFilter
}: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedSource, setSelectedSource] = useState<Communication | null>(null);

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

  const { data, isLoading } = useSWR<{ communications: Communication[] }>(
    shouldFetch ? `/api/communications?${params.toString()}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const communications: Communication[] = data?.communications || [];

  // Sort oldest first (conversation order)
  const sortedComms = [...communications].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sortedComms.length]);

  if (!shouldFetch) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
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
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (sortedComms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No communications yet</p>
          <p className="text-sm">Start a conversation with this company</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
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

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {sortedComms.map((comm) => (
          <CommunicationBubble
            key={comm.id}
            comm={comm}
            onViewSource={setSelectedSource}
          />
        ))}
      </div>

      {/* Source Preview Modal */}
      {selectedSource && (
        <SourcePreviewModal
          communication={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </div>
  );
}
