'use client';

import { useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { MeetingCard, Meeting } from './MeetingCard';
import { cn } from '@/lib/utils';

interface GroupedUpcoming {
  today: Meeting[];
  tomorrow: Meeting[];
  later: Meeting[];
  totalCount: number;
}

interface UpcomingMeetingsSectionProps {
  meetings: GroupedUpcoming;
  onExclude: (meetingId: string, reason?: string) => Promise<void>;
  onRestore: (meetingId: string) => Promise<void>;
  onAssignCompany: (meetingId: string) => void;
  onOpenPrep: (meetingId: string) => void;
  onExpandUpcoming: () => void;
  isExpanded: boolean;
  isExcluding?: boolean;
}

interface DateGroupProps {
  title: string;
  meetings: Meeting[];
  onExclude: (meetingId: string, reason?: string) => Promise<void>;
  onRestore: (meetingId: string) => Promise<void>;
  onAssignCompany: (meetingId: string) => void;
  onOpenPrep: (meetingId: string) => void;
  isExcluding?: boolean;
  accent?: 'blue' | 'gray';
}

function DateGroup({
  title,
  meetings,
  onExclude,
  onRestore,
  onAssignCompany,
  onOpenPrep,
  isExcluding,
  accent = 'gray',
}: DateGroupProps) {
  if (meetings.length === 0) return null;

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <h3
          className={cn(
            'text-xs font-medium uppercase tracking-wider',
            accent === 'blue' ? 'text-blue-600' : 'text-gray-500'
          )}
        >
          {title}
        </h3>
        <span
          className={cn(
            'text-xs font-medium px-1.5 py-0.5 rounded',
            accent === 'blue'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-gray-100 text-gray-500'
          )}
        >
          {meetings.length}
        </span>
      </div>
      <div className="space-y-1">
        {meetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            variant="upcoming"
            onExclude={onExclude}
            onRestore={onRestore}
            onAssignCompany={onAssignCompany}
            onOpenPrep={onOpenPrep}
            isExcluding={isExcluding}
          />
        ))}
      </div>
    </div>
  );
}

export function UpcomingMeetingsSection({
  meetings,
  onExclude,
  onRestore,
  onAssignCompany,
  onOpenPrep,
  onExpandUpcoming,
  isExpanded,
  isExcluding,
}: UpcomingMeetingsSectionProps) {
  const hasTodayOrTomorrow = meetings.today.length > 0 || meetings.tomorrow.length > 0;
  const hasLater = meetings.later.length > 0;
  const isEmpty = meetings.totalCount === 0;

  if (isEmpty) {
    return (
      <section>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Upcoming Meetings
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
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
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        Upcoming Meetings
      </h2>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {/* Today */}
        <DateGroup
          title="Today"
          meetings={meetings.today}
          onExclude={onExclude}
          onRestore={onRestore}
          onAssignCompany={onAssignCompany}
          onOpenPrep={onOpenPrep}
          isExcluding={isExcluding}
          accent="blue"
        />

        {/* Tomorrow */}
        <DateGroup
          title="Tomorrow"
          meetings={meetings.tomorrow}
          onExclude={onExclude}
          onRestore={onRestore}
          onAssignCompany={onAssignCompany}
          onOpenPrep={onOpenPrep}
          isExcluding={isExcluding}
        />

        {/* Later - only if expanded */}
        {isExpanded && (
          <DateGroup
            title="This Week & Beyond"
            meetings={meetings.later}
            onExclude={onExclude}
            onRestore={onRestore}
            onAssignCompany={onAssignCompany}
            onOpenPrep={onOpenPrep}
            isExcluding={isExcluding}
          />
        )}

        {/* Expand button */}
        {hasLater && !isExpanded && (
          <button
            onClick={onExpandUpcoming}
            className="w-full mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Show {meetings.later.length} more this week
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Empty state for today/tomorrow but has later */}
        {!hasTodayOrTomorrow && hasLater && !isExpanded && (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 mb-2">
              No meetings today or tomorrow
            </p>
            <button
              onClick={onExpandUpcoming}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View {meetings.later.length} upcoming
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
