'use client';

import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { format, isYesterday, isToday, parseISO } from 'date-fns';
import { MeetingCard, Meeting } from './MeetingCard';
import { cn } from '@/lib/utils';

interface GroupedPast {
  byDate: Record<string, Meeting[]>;
  totalCount: number;
}

interface PastMeetingsSectionProps {
  meetings: GroupedPast;
  pastDays: number;
  onChangePastDays: (days: number) => void;
  onExclude: (meetingId: string, reason?: string) => Promise<void>;
  onRestore: (meetingId: string) => Promise<void>;
  onAssignCompany: (meetingId: string) => void;
  onAddProduct: (meetingId: string) => void;
  onOpenPrep: (meetingId: string) => void;
  onOpenTranscript: (meetingId: string) => void;
  showExcluded: boolean;
  onToggleShowExcluded: () => void;
  isExcluding?: boolean;
}

const PAST_DAYS_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
];

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);

  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }

  return format(date, 'EEEE, MMM d');
}

interface CollapsibleDateGroupProps {
  dateKey: string;
  meetings: Meeting[];
  defaultExpanded: boolean;
  onExclude: (meetingId: string, reason?: string) => Promise<void>;
  onRestore: (meetingId: string) => Promise<void>;
  onAssignCompany: (meetingId: string) => void;
  onAddProduct: (meetingId: string) => void;
  onOpenPrep: (meetingId: string) => void;
  onOpenTranscript: (meetingId: string) => void;
  isExcluding?: boolean;
}

function CollapsibleDateGroup({
  dateKey,
  meetings,
  defaultExpanded,
  onExclude,
  onRestore,
  onAssignCompany,
  onAddProduct,
  onOpenPrep,
  onOpenTranscript,
  isExcluding,
}: CollapsibleDateGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const label = formatDateLabel(dateKey);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 px-2 hover:bg-gray-50 transition-colors rounded-lg -mx-2"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900">{label}</span>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {meetings.length}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="pl-6 pb-2 space-y-1">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              variant="past"
              onExclude={onExclude}
              onRestore={onRestore}
              onAssignCompany={onAssignCompany}
              onAddProduct={meeting.company_id ? () => onAddProduct(meeting.id) : undefined}
              onOpenPrep={onOpenPrep}
              onOpenTranscript={onOpenTranscript}
              isExcluding={isExcluding}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PastMeetingsSection({
  meetings,
  pastDays,
  onChangePastDays,
  onExclude,
  onRestore,
  onAssignCompany,
  onAddProduct,
  onOpenPrep,
  onOpenTranscript,
  showExcluded,
  onToggleShowExcluded,
  isExcluding,
}: PastMeetingsSectionProps) {
  // Sort date keys in descending order (most recent first)
  const sortedDateKeys = useMemo(() => {
    return Object.keys(meetings.byDate).sort((a, b) => b.localeCompare(a));
  }, [meetings.byDate]);

  const isEmpty = meetings.totalCount === 0;

  if (isEmpty) {
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Past Meetings
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleShowExcluded}
              className={cn(
                'text-xs font-medium transition-colors',
                showExcluded ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {showExcluded ? 'Hide excluded' : 'Show excluded'}
            </button>
            <select
              value={pastDays}
              onChange={(e) => onChangePastDays(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAST_DAYS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No past meetings in the last {pastDays} days</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Past Meetings
          <span className="ml-2 text-gray-400">({meetings.totalCount})</span>
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleShowExcluded}
            className={cn(
              'text-xs font-medium transition-colors',
              showExcluded ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {showExcluded ? 'Hide excluded' : 'Show excluded'}
          </button>
          <select
            value={pastDays}
            onChange={(e) => onChangePastDays(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAST_DAYS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3">
        {sortedDateKeys.map((dateKey, index) => (
          <CollapsibleDateGroup
            key={dateKey}
            dateKey={dateKey}
            meetings={meetings.byDate[dateKey]}
            defaultExpanded={index === 0} // First (most recent) group is expanded by default
            onExclude={onExclude}
            onRestore={onRestore}
            onAssignCompany={onAssignCompany}
            onAddProduct={onAddProduct}
            onOpenPrep={onOpenPrep}
            onOpenTranscript={onOpenTranscript}
            isExcluding={isExcluding}
          />
        ))}
      </div>
    </section>
  );
}
