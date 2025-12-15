'use client';

import Link from 'next/link';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Users,
  Clock,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { MeetingTranscription, MeetingAnalysis } from '@/types';

interface MeetingActivityCardProps {
  activity: {
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    summary: string | null;
    occurred_at: string;
    metadata: {
      transcription_id?: string;
      duration_minutes?: number;
      attendees?: string[];
    } | null;
    user?: { name: string } | null;
  };
  transcription?: MeetingTranscription | null;
}

export function MeetingActivityCard({ activity, transcription }: MeetingActivityCardProps) {
  const analysis = transcription?.analysis as MeetingAnalysis | null;
  const transcriptionId = activity.metadata?.transcription_id;

  // Get sentiment info
  const getSentimentInfo = (sentiment: string | undefined) => {
    if (!sentiment) return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Unknown' };

    if (sentiment.includes('positive')) {
      return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', label: 'Positive' };
    } else if (sentiment.includes('negative')) {
      return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', label: 'Negative' };
    }
    return { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Neutral' };
  };

  const sentimentInfo = getSentimentInfo(analysis?.sentiment?.overall);
  const SentimentIcon = sentimentInfo.icon;

  // Get high-priority key points (max 3)
  const keyPoints = analysis?.keyPoints
    ?.filter(kp => kp.importance === 'high' || kp.importance === 'medium')
    ?.slice(0, 3) || [];

  // Get strong buying signals
  const strongSignals = analysis?.buyingSignals?.filter(s => s.strength === 'strong')?.length || 0;

  // Get unresolved objections
  const unresolvedObjections = analysis?.objections?.filter(o => !o.resolved)?.length || 0;

  // Get our action items count
  const ourActionItems = analysis?.actionItems?.filter(a => a.owner === 'us')?.length || 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', sentimentInfo.bg)}>
          <FileText className={cn('h-5 w-5', sentimentInfo.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 truncate">
              {activity.subject || 'Meeting'}
            </p>
            <span className={cn(
              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
              sentimentInfo.bg,
              sentimentInfo.color
            )}>
              <SentimentIcon className="h-3 w-3" />
              {sentimentInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            <span>{activity.user?.name}</span>
            <span>•</span>
            <span>{formatRelativeTime(activity.occurred_at)}</span>
            {activity.metadata?.duration_minutes && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {activity.metadata.duration_minutes}m
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {activity.summary && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-700 font-medium">
            {activity.summary}
          </p>
        </div>
      )}

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
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
      {analysis && (
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
      {transcriptionId && (
        <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
          <Link
            href={`/meetings/${transcriptionId}/analysis`}
            className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <span>View Full Analysis</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
