'use client';

import { useState, useEffect } from 'react';
import { X, Video, ExternalLink, Loader2, Users, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptData {
  id: string;
  title: string;
  meeting_date: string;
  duration_minutes?: number;
  attendees?: string[];
  analysis?: {
    summary?: string;
    key_points?: string[];
    action_items?: Array<{
      task: string;
      owner?: string;
      due_date?: string;
    }>;
    sentiment?: string;
    next_steps?: string[];
  };
}

interface TranscriptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  onOpenFullTranscript?: () => void;
}

export function TranscriptPreviewModal({
  isOpen,
  onClose,
  meetingId,
  onOpenFullTranscript,
}: TranscriptPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);

  useEffect(() => {
    if (!isOpen || !meetingId) return;

    const fetchTranscript = async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to fetch from transcriptions API
        const response = await fetch(`/api/meetings/transcriptions/${meetingId}`);
        if (!response.ok) throw new Error('Failed to load meeting details');

        const data = await response.json();
        setTranscript(data);
      } catch (err) {
        console.error('Error fetching transcript:', err);
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    };

    fetchTranscript();
  }, [isOpen, meetingId]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Video className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Meeting Summary</h2>
              <p className="text-sm text-gray-500">AI-analyzed meeting insights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500">{error}</p>
            </div>
          ) : transcript ? (
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <h3 className="text-lg font-medium text-gray-900">{transcript.title}</h3>
              </div>

              {/* Meeting Meta */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  {formatDate(transcript.meeting_date)}
                </div>
                {transcript.duration_minutes && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Clock className="h-4 w-4" />
                    {formatDuration(transcript.duration_minutes)}
                  </div>
                )}
                {transcript.attendees && transcript.attendees.length > 0 && (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Users className="h-4 w-4" />
                    {transcript.attendees.length} attendees
                  </div>
                )}
              </div>

              {/* Attendees */}
              {transcript.attendees && transcript.attendees.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Attendees
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {transcript.attendees.map((attendee, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                      >
                        {attendee}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {transcript.analysis?.summary && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Summary
                  </label>
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 text-sm text-gray-800 leading-relaxed">
                    {transcript.analysis.summary}
                  </div>
                </div>
              )}

              {/* Key Points */}
              {transcript.analysis?.key_points && transcript.analysis.key_points.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Key Points
                  </label>
                  <ul className="space-y-2">
                    {transcript.analysis.key_points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {transcript.analysis?.action_items && transcript.analysis.action_items.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Action Items
                  </label>
                  <ul className="space-y-2">
                    {transcript.analysis.action_items.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm p-2 bg-amber-50 border border-amber-100 rounded-lg"
                      >
                        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-gray-700">{item.task}</span>
                          {(item.owner || item.due_date) && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {item.owner && <span>Owner: {item.owner}</span>}
                              {item.owner && item.due_date && <span> · </span>}
                              {item.due_date && <span>Due: {item.due_date}</span>}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {transcript.analysis?.next_steps && transcript.analysis.next_steps.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Next Steps
                  </label>
                  <ul className="space-y-1">
                    {transcript.analysis.next_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-blue-500">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>

          {onOpenFullTranscript && (
            <button
              onClick={() => {
                onOpenFullTranscript();
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Transcript
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
