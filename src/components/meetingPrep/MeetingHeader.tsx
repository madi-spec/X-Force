'use client';

import { Calendar, Clock, ExternalLink, Users, Building2 } from 'lucide-react';
import type { MeetingType } from '@/types/collateral';

const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  discovery: 'bg-blue-50 text-blue-700',
  demo: 'bg-purple-50 text-purple-700',
  technical_deep_dive: 'bg-indigo-50 text-indigo-700',
  proposal: 'bg-amber-50 text-amber-700',
  trial_kickoff: 'bg-green-50 text-green-700',
  implementation: 'bg-teal-50 text-teal-700',
  check_in: 'bg-gray-100 text-gray-700',
  executive: 'bg-orange-50 text-orange-700',
};

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  technical_deep_dive: 'Technical Deep Dive',
  proposal: 'Proposal Review',
  trial_kickoff: 'Trial Kickoff',
  implementation: 'Implementation',
  check_in: 'Check-in',
  executive: 'Executive',
};

interface MeetingHeaderProps {
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  meetingType: MeetingType;
  joinUrl?: string | null;
  companyName?: string | null;
  attendeeCount: number;
}

export function MeetingHeader({
  title,
  startTime,
  endTime,
  durationMinutes,
  meetingType,
  joinUrl,
  companyName,
  attendeeCount,
}: MeetingHeaderProps) {
  const startDate = new Date(startTime);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const endDate = new Date(endTime);
  const formattedEndTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          {/* Meeting Type Badge */}
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${MEETING_TYPE_COLORS[meetingType]}`}
          >
            {MEETING_TYPE_LABELS[meetingType]}
          </span>

          {/* Title */}
          <h1 className="text-xl font-normal text-gray-900 mt-2">{title}</h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {formattedTime} - {formattedEndTime} ({durationMinutes} min)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}</span>
            </div>
            {companyName && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                <span>{companyName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Join Button */}
        {joinUrl && (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Join Meeting
          </a>
        )}
      </div>
    </div>
  );
}
