'use client';

import Link from 'next/link';
import { Calendar, Building2, FileText, StickyNote, Sparkles, ChevronDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface PastMeeting {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean;
  transcription_id: string | null;
}

interface PastMeetingsSectionProps {
  meetings: PastMeeting[];
  pastDays: number;
  onLoadMore: () => void;
  loading: boolean;
}

function formatPastMeetingDate(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'MMM d, yyyy');
}

function formatPastMeetingTime(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'h:mm a');
}

export function PastMeetingsSection({
  meetings,
  pastDays,
  onLoadMore,
  loading,
}: PastMeetingsSectionProps) {
  if (meetings.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Past Meetings
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No past meetings in the last {pastDays} days</p>
          <p className="text-xs text-gray-400 mt-1">
            Historical meetings will appear here once synced
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
        Past Meetings ({meetings.length})
      </h2>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            className="p-4 hover:bg-gray-50 transition-colors duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Meeting Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 text-sm truncate">
                  {meeting.subject}
                </h3>

                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatPastMeetingDate(meeting.occurred_at)}
                  </span>
                  <span>{formatPastMeetingTime(meeting.occurred_at)}</span>
                  {meeting.company_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {meeting.company_name}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(meeting.occurred_at), { addSuffix: true })}
                </p>
              </div>

              {/* Content Indicators */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {meeting.hasTranscript && (
                  <span
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md"
                    title="Has transcript"
                  >
                    <FileText className="h-3 w-3" />
                    Transcript
                  </span>
                )}
                {meeting.hasNotes && (
                  <span
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-md"
                    title="Has notes"
                  >
                    <StickyNote className="h-3 w-3" />
                    Notes
                  </span>
                )}
                {meeting.hasAnalysis && (
                  <span
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md"
                    title="Has AI analysis"
                  >
                    <Sparkles className="h-3 w-3" />
                    Analysis
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {meeting.hasTranscript && meeting.transcription_id && (
                  <Link
                    href={`/meetings/${meeting.id}/analysis`}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    View Analysis
                  </Link>
                )}
                <Link
                  href={`/meetings/${meeting.id}/prep`}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  View Notes
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="mt-4 text-center">
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <ChevronDown className={`h-4 w-4 ${loading ? 'animate-bounce' : ''}`} />
          Load More ({pastDays + 30} days)
        </button>
      </div>
    </section>
  );
}
