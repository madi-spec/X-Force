'use client';

import { useState } from 'react';
import {
  Mail,
  MailOpen,
  FileText,
  Calendar,
  StickyNote,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import type { Interaction } from '@/lib/intelligence/relationshipStore';

interface CommunicationTimelineProps {
  interactions: Interaction[];
  emails?: Array<{
    id: string;
    subject: string | null;
    from_email: string;
    received_at: string | null;
    is_sent_by_user: boolean;
    snippet: string | null;
  }>;
  transcripts?: Array<{
    id: string;
    title: string;
    meeting_date: string | null;
    has_analysis: boolean;
  }>;
  maxVisible?: number;
}

const interactionIcons: Record<string, React.ElementType> = {
  email_inbound: MailOpen,
  email_outbound: Mail,
  transcript: FileText,
  note: StickyNote,
  meeting_scheduled: Calendar,
};

const interactionColors: Record<string, string> = {
  email_inbound: 'border-blue-400 bg-blue-50',
  email_outbound: 'border-green-400 bg-green-50',
  transcript: 'border-purple-400 bg-purple-50',
  note: 'border-yellow-400 bg-yellow-50',
  meeting_scheduled: 'border-indigo-400 bg-indigo-50',
};

const interactionLabels: Record<string, string> = {
  email_inbound: 'Email Received',
  email_outbound: 'Email Sent',
  transcript: 'Meeting',
  note: 'Note',
  meeting_scheduled: 'Meeting Scheduled',
};

type FilterType = 'all' | 'email_inbound' | 'email_outbound' | 'transcript' | 'note';

export function CommunicationTimeline({
  interactions,
  maxVisible = 10,
}: CommunicationTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter interactions
  const filteredInteractions =
    filter === 'all'
      ? interactions
      : interactions.filter((i) => i.type === filter);

  // Sort by date (most recent first)
  const sortedInteractions = [...filteredInteractions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Show limited or all based on expansion
  const visibleInteractions = isExpanded
    ? sortedInteractions
    : sortedInteractions.slice(0, maxVisible);

  const hasMore = sortedInteractions.length > maxVisible;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-500" />
          <h3 className="font-medium text-gray-900">
            Communication Timeline ({interactions.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-gray-50"
          >
            <option value="all">All ({interactions.length})</option>
            <option value="email_inbound">
              Inbound ({interactions.filter((i) => i.type === 'email_inbound').length})
            </option>
            <option value="email_outbound">
              Outbound ({interactions.filter((i) => i.type === 'email_outbound').length})
            </option>
            <option value="transcript">
              Meetings ({interactions.filter((i) => i.type === 'transcript').length})
            </option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      {visibleInteractions.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {visibleInteractions.map((interaction, index) => {
              const Icon = interactionIcons[interaction.type] || Mail;
              const colorClass = interactionColors[interaction.type] || 'border-gray-400 bg-gray-50';
              const isInbound = interaction.type === 'email_inbound';

              return (
                <div key={interaction.id || index} className="relative flex gap-4 pl-2">
                  {/* Timeline node */}
                  <div
                    className={cn(
                      'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2',
                      colorClass
                    )}
                  >
                    <Icon className="w-4 h-4 text-gray-700" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {interactionLabels[interaction.type] || interaction.type}
                      </span>
                      {(interaction.type === 'email_inbound' || interaction.type === 'email_outbound') && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs',
                            isInbound ? 'text-blue-600' : 'text-green-600'
                          )}
                        >
                          {isInbound ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(interaction.date)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-900">
                      {interaction.summary}
                    </p>

                    {/* Key points */}
                    {interaction.key_points && interaction.key_points.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {interaction.key_points.slice(0, 3).map((point, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-gray-400">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Sentiment */}
                    {interaction.sentiment && (
                      <span
                        className={cn(
                          'inline-block mt-2 text-xs px-2 py-0.5 rounded-full',
                          interaction.sentiment === 'positive' || interaction.sentiment === 'Very Positive'
                            ? 'bg-green-100 text-green-700'
                            : interaction.sentiment === 'negative' || interaction.sentiment === 'Frustrated'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {interaction.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic text-center py-4">
          {filter !== 'all'
            ? 'No interactions match this filter.'
            : 'No communication history yet.'}
        </p>
      )}

      {/* Show More/Less Button */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {sortedInteractions.length - maxVisible} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
