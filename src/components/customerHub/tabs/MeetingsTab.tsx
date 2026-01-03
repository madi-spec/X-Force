'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Video,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { CustomerHubData, MeetingTranscript } from '../types';

interface MeetingsTabProps {
  data: CustomerHubData;
}

function formatMeetingDate(dateStr: string): { date: string; time: string; relative: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  let relative = '';
  if (diffDays === 0) relative = 'Today';
  else if (diffDays === 1) relative = 'Yesterday';
  else if (diffDays < 7) relative = `${diffDays} days ago`;
  else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)} weeks ago`;
  else relative = `${Math.floor(diffDays / 30)} months ago`;

  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    relative,
  };
}

function getSentimentInfo(sentiment: string | undefined) {
  if (!sentiment) return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Unknown' };

  if (sentiment.includes('positive')) {
    return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', label: 'Positive' };
  } else if (sentiment.includes('negative')) {
    return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', label: 'Negative' };
  }
  return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Neutral' };
}

function MeetingCard({ meeting }: { meeting: MeetingTranscript }) {
  const { date, time, relative } = formatMeetingDate(meeting.meeting_date);
  const analysis = meeting.analysis;
  const sentimentInfo = getSentimentInfo(analysis?.sentiment?.overall);
  const SentimentIcon = sentimentInfo.icon;

  // Get high-priority key points (max 3)
  const keyPoints = analysis?.keyPoints
    ?.filter(kp => kp.importance === 'high' || kp.importance === 'medium')
    ?.slice(0, 3) || [];

  // Get strong buying signals count
  const strongSignals = analysis?.buyingSignals?.filter(s => s.strength === 'strong')?.length || 0;

  // Get unresolved objections count
  const unresolvedObjections = analysis?.objections?.filter(o => !o.resolved)?.length || 0;

  // Get our action items count
  const ourActionItems = analysis?.actionItems?.filter(a => a.owner === 'us')?.length || 0;

  const hasAnalysis = !!analysis;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-4 p-4">
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', sentimentInfo.bg)}>
          <Video className={cn('h-6 w-6', sentimentInfo.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium text-gray-900 truncate">{meeting.title}</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {date} at {time}
                </span>
                {meeting.duration_minutes && (
                  <span>{meeting.duration_minutes}m</span>
                )}
              </div>
            </div>
            {hasAnalysis && (
              <span className={cn(
                'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0',
                sentimentInfo.bg,
                sentimentInfo.color
              )}>
                <SentimentIcon className="h-3 w-3" />
                {sentimentInfo.label}
              </span>
            )}
          </div>

          {/* Attendees */}
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Users className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500 truncate">
                {meeting.attendees.slice(0, 3).join(', ')}
                {meeting.attendees.length > 3 && ` +${meeting.attendees.length - 3} more`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Summary/Headline */}
      {(analysis?.headline || meeting.summary) && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-700 font-medium bg-blue-50 px-3 py-2 rounded-lg">
            {analysis?.headline || meeting.summary}
          </p>
        </div>
      )}

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Key Points
          </p>
          <ul className="space-y-1">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className={cn(
                  'shrink-0 w-1.5 h-1.5 rounded-full mt-1.5',
                  point.importance === 'high' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <span>{point.topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats Row */}
      {hasAnalysis && (strongSignals > 0 || unresolvedObjections > 0 || ourActionItems > 0) && (
        <div className="flex items-center gap-4 px-4 pb-3 text-xs">
          {strongSignals > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-3.5 w-3.5" />
              {strongSignals} strong signal{strongSignals !== 1 ? 's' : ''}
            </span>
          )}
          {unresolvedObjections > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {unresolvedObjections} objection{unresolvedObjections !== 1 ? 's' : ''} to address
            </span>
          )}
          {ourActionItems > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {ourActionItems} action item{ourActionItems !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Footer with Link */}
      <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
        <Link
          href={`/meetings/${meeting.id}/analysis`}
          className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <span>View Full Analysis</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function MeetingsTab({ data }: MeetingsTabProps) {
  const { meetings } = data;

  // Sort by meeting date descending
  const sortedMeetings = [...meetings].sort((a, b) =>
    new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
  );

  if (sortedMeetings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Video className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-gray-900 font-medium mb-1">No Meetings Yet</h3>
        <p className="text-sm text-gray-500">
          Meeting transcripts will appear here once they are synced from Fireflies or uploaded manually.
        </p>
      </div>
    );
  }

  // Group by month
  const groupedMeetings: { month: string; meetings: MeetingTranscript[] }[] = [];
  let currentMonth = '';

  sortedMeetings.forEach((meeting) => {
    const monthKey = new Date(meeting.meeting_date).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      groupedMeetings.push({ month: monthKey, meetings: [meeting] });
    } else {
      groupedMeetings[groupedMeetings.length - 1].meetings.push(meeting);
    }
  });

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Meetings</p>
          <p className="text-2xl font-light text-gray-900 mt-1">{meetings.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">With Analysis</p>
          <p className="text-2xl font-light text-gray-900 mt-1">
            {meetings.filter(m => m.analysis).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-light text-gray-900 mt-1">
            {meetings.filter(m => {
              const meetingDate = new Date(m.meeting_date);
              const now = new Date();
              return meetingDate.getMonth() === now.getMonth() &&
                     meetingDate.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-light text-gray-900 mt-1">
            {Math.round(meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0) / 60)}h
          </p>
        </div>
      </div>

      {/* Meetings list by month */}
      {groupedMeetings.map((group) => (
        <div key={group.month}>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
            {group.month}
          </h3>
          <div className="space-y-4">
            {group.meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
