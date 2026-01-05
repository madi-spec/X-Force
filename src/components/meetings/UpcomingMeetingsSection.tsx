'use client';

import Link from 'next/link';
import { Calendar, Users, Building2, Video, ClipboardList, Clock } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';

interface UpcomingMeeting {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  attendee_count: number;
  join_url: string | null;
}

interface UpcomingMeetingsSectionProps {
  meetings: UpcomingMeeting[];
}

function formatMeetingTime(dateStr: string): string {
  const date = new Date(dateStr);

  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }

  if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, 'h:mm a')}`;
  }

  return format(date, 'EEE, MMM d \'at\' h:mm a');
}

function getTimeUntil(dateStr: string): string {
  const date = new Date(dateStr);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function UpcomingMeetingsSection({ meetings }: UpcomingMeetingsSectionProps) {
  if (meetings.length === 0) {
    return (
      <section>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Upcoming Meetings
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No upcoming meetings</p>
          <p className="text-xs text-gray-400 mt-1">
            Meetings synced from your calendar will appear here
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
        Upcoming Meetings ({meetings.length})
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Meeting Title */}
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
              {meeting.subject}
            </h3>

            {/* Time */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span>{formatMeetingTime(meeting.occurred_at)}</span>
            </div>

            {/* Time Until */}
            <p className="text-xs text-blue-600 mb-3">
              {getTimeUntil(meeting.occurred_at)}
            </p>

            {/* Company / Attendees */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4">
              {meeting.company_name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {meeting.company_name}
                </span>
              )}
              {meeting.attendee_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {meeting.attendee_count} attendee{meeting.attendee_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                href={`/meetings/${meeting.id}/prep`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Prep
              </Link>

              {meeting.join_url && (
                <a
                  href={meeting.join_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Video className="h-3.5 w-3.5" />
                  Join
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
