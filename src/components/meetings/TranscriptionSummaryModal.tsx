'use client';

import { X, ExternalLink, Calendar, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import type { MeetingTranscription, MeetingAnalysis } from '@/types';

interface TranscriptionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcription: MeetingTranscription;
}

export function TranscriptionSummaryModal({
  isOpen,
  onClose,
  transcription,
}: TranscriptionSummaryModalProps) {
  if (!isOpen) return null;

  const analysis = transcription.analysis as MeetingAnalysis | null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {transcription.title}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(transcription.meeting_date)}
              </span>
              {transcription.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {transcription.duration_minutes}m
                </span>
              )}
              {transcription.attendees && transcription.attendees.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {transcription.attendees.length}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-140px)]">
          {analysis ? (
            <div className="space-y-4">
              {/* Headline */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800">
                  {analysis.headline}
                </p>
              </div>

              {/* Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Summary
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {analysis.summary}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {analysis.actionItems.filter((a) => a.owner === 'us').length}
                  </p>
                  <p className="text-xs text-gray-500">Action Items</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {analysis.buyingSignals.length}
                  </p>
                  <p className="text-xs text-gray-500">Buying Signals</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {analysis.objections.length}
                  </p>
                  <p className="text-xs text-gray-500">Objections</p>
                </div>
              </div>

              {/* Sentiment */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">Sentiment:</span>
                <span
                  className={cn(
                    'font-medium',
                    analysis.sentiment.overall.includes('positive') &&
                      'text-green-600',
                    analysis.sentiment.overall === 'neutral' && 'text-gray-600',
                    analysis.sentiment.overall.includes('negative') &&
                      'text-red-600'
                  )}
                >
                  {analysis.sentiment.overall.replace('_', ' ')}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">Interest:</span>
                <span className="font-medium text-gray-700">
                  {analysis.sentiment.interestLevel}
                </span>
              </div>

              {/* Key Points Preview */}
              {analysis.keyPoints.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Key Points
                  </h3>
                  <ul className="space-y-1">
                    {analysis.keyPoints.slice(0, 3).map((point, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-600 flex items-start gap-2"
                      >
                        <span
                          className={cn(
                            'shrink-0 w-1.5 h-1.5 rounded-full mt-1.5',
                            point.importance === 'high' && 'bg-red-500',
                            point.importance === 'medium' && 'bg-amber-500',
                            point.importance === 'low' && 'bg-gray-400'
                          )}
                        />
                        <span>{point.topic}</span>
                      </li>
                    ))}
                    {analysis.keyPoints.length > 3 && (
                      <li className="text-xs text-gray-400 ml-4">
                        +{analysis.keyPoints.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No analysis available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
          <Link
            href={`/meetings/${transcription.id}/analysis`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            View Full Analysis
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
