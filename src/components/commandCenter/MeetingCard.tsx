'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Video,
  Clock,
  Users,
  FileText,
} from 'lucide-react';
import { TimeBlock } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface MeetingCardProps {
  meeting: TimeBlock;
  prepItemId?: string;
  className?: string;
  compact?: boolean;
  /** @deprecated Use direct links to /meetings/[meetingId]/prep instead */
  onViewPrep?: (meetingId: string) => void;
}

// ============================================
// HELPERS
// ============================================

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

function extractJoinUrl(meeting: TimeBlock): string | null {
  // Common patterns for video meeting URLs
  const urlPatterns = [
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i,
    /https:\/\/[\w-]+\.zoom\.us\/j\/\d+[^\s"<>]*/i,
    /https:\/\/meet\.google\.com\/[a-z-]+/i,
    /https:\/\/[\w-]+\.webex\.com\/[^\s"<>]+/i,
  ];

  // Check meeting location or body for video URL
  // For now, we'll check if meeting_title contains indicators
  // In production, this would parse the meeting body from Graph API

  // If the meeting has Teams in the title, assume it's a Teams meeting
  if (meeting.meeting_title?.toLowerCase().includes('teams')) {
    // Return a placeholder - in production this would be the actual URL
    return null;
  }

  return null;
}

function getAttendeeCount(meeting: TimeBlock): number {
  // This would come from the meeting data
  // For now, return 0 as we don't have attendee info in TimeBlock
  return 0;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MeetingCard({
  meeting,
  prepItemId,
  className,
  compact = false,
  onViewPrep,
}: MeetingCardProps) {
  const joinUrl = extractJoinUrl(meeting);
  const attendeeCount = getAttendeeCount(meeting);

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-purple-200 bg-purple-50',
        className
      )}>
        <div className="p-2 rounded-lg bg-purple-100">
          <Video className="h-4 w-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {meeting.meeting_title || 'Meeting'}
          </p>
          <p className="text-xs text-gray-500">
            {formatTimeRange(meeting.start, meeting.end)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {meeting.duration_minutes}m
          </span>
          {meeting.meeting_id && (
            <Link
              href={`/meetings/${meeting.meeting_id}/prep`}
              className="px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 rounded transition-colors"
              title="View Meeting Prep"
            >
              <FileText className="h-3 w-3" />
            </Link>
          )}
          {joinUrl && (
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
            >
              Join
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden',
      className
    )}>
      {/* Header Bar */}
      <div className="bg-purple-50 px-4 py-2 border-b border-purple-100">
        <div className="flex items-center gap-2 text-xs text-purple-700">
          <Video className="h-3.5 w-3.5" />
          <span className="font-medium uppercase tracking-wider">Meeting</span>
          <span className="text-purple-500">
            {formatTimeRange(meeting.start, meeting.end)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900">
          {meeting.meeting_title || 'Untitled Meeting'}
        </h3>

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {meeting.duration_minutes} min
          </span>
          {attendeeCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}
            </span>
          )}
          {meeting.is_external && (
            <span className="text-amber-600 text-xs font-medium">
              External
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
        {meeting.meeting_id && (
          <Link
            href={`/meetings/${meeting.meeting_id}/prep`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            <FileText className="h-4 w-4" />
            View Prep
          </Link>
        )}
        {joinUrl ? (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
          >
            <Video className="h-4 w-4" />
            Join Meeting
          </a>
        ) : (
          <span className="text-xs text-gray-400">No video link</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// MEETING LIST COMPONENT
// ============================================

interface MeetingListProps {
  meetings: TimeBlock[];
  className?: string;
}

export function MeetingList({ meetings, className }: MeetingListProps) {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Video className="h-4 w-4 text-purple-500" />
        <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">
          Today&apos;s Meetings ({meetings.length})
        </h3>
      </div>
      {meetings.map((meeting, index) => (
        <MeetingCard key={meeting.meeting_id || index} meeting={meeting} compact />
      ))}
    </div>
  );
}
