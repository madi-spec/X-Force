'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, TrendingUp, CheckSquare, MessageSquare, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptAnalysis {
  sentiment: string | null;
  buyingSignals: number;
  actionItems: string[] | number;
  headline: string | null;
  topics?: string[];
  nextSteps?: string[];
  buying_signals?: Array<{ signal: string; context: string }>;
  action_items?: Array<{ task: string; owner?: string }>;
}

interface TranscriptDetails {
  id: string;
  title: string;
  summary: string | null;
  analysis: TranscriptAnalysis | null;
  meetingDate: string | null;
  source: string | null;
  wordCount: number | null;
  company: { id: string; name: string } | null;
}

interface TranscriptPanelProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string | null;
  meetingSubject?: string;
}

function getSentimentColor(sentiment: string | null): string {
  switch (sentiment?.toLowerCase()) {
    case 'positive':
    case 'very positive':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'negative':
    case 'very negative':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'neutral':
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

export function TranscriptPanel({ isOpen, onClose, meetingId, meetingSubject }: TranscriptPanelProps) {
  const [transcript, setTranscript] = useState<TranscriptDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && meetingId) {
      fetchTranscript();
    } else {
      setTranscript(null);
      setError(null);
    }
  }, [isOpen, meetingId]);

  const fetchTranscript = async () => {
    if (!meetingId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/transcript`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transcript');
      }

      setTranscript(data);
    } catch (err) {
      console.error('[TranscriptPanel] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transcript');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const actionItemsCount = transcript?.analysis?.actionItems
    ? Array.isArray(transcript.analysis.actionItems)
      ? transcript.analysis.actionItems.length
      : transcript.analysis.actionItems
    : 0;

  const actionItemsList = transcript?.analysis?.action_items ||
    (Array.isArray(transcript?.analysis?.actionItems) ? transcript.analysis.actionItems : []);

  const buyingSignalsList = transcript?.analysis?.buying_signals || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">AI Analysis</h2>
              <p className="text-sm text-gray-500 truncate max-w-[300px]">
                {meetingSubject || 'Meeting Transcript'}
              </p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin mb-4" />
              <p className="text-sm text-gray-500">Loading transcript analysis...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-2">{error}</p>
              <button
                onClick={fetchTranscript}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && transcript && (
            <div className="space-y-6">
              {/* Headline */}
              {transcript.analysis?.headline && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <h3 className="text-base font-medium text-gray-900">
                    {transcript.analysis.headline}
                  </h3>
                </div>
              )}

              {/* Analysis Badges */}
              <div className="flex flex-wrap gap-2">
                {/* Sentiment */}
                {transcript.analysis?.sentiment && (
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border",
                    getSentimentColor(transcript.analysis.sentiment)
                  )}>
                    <MessageSquare className="h-4 w-4" />
                    {transcript.analysis.sentiment}
                  </span>
                )}

                {/* Buying Signals */}
                {transcript.analysis?.buyingSignals && transcript.analysis.buyingSignals > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full">
                    <TrendingUp className="h-4 w-4" />
                    {transcript.analysis.buyingSignals} Buying Signal{transcript.analysis.buyingSignals !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Action Items */}
                {actionItemsCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                    <CheckSquare className="h-4 w-4" />
                    {actionItemsCount} Action Item{actionItemsCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Summary */}
              {transcript.summary && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Summary
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {transcript.summary}
                  </p>
                </div>
              )}

              {/* Buying Signals Detail */}
              {buyingSignalsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Buying Signals
                  </h4>
                  <div className="space-y-2">
                    {buyingSignalsList.map((signal, idx) => (
                      <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-sm font-medium text-green-800">{signal.signal}</p>
                        {signal.context && (
                          <p className="text-xs text-green-600 mt-1">{signal.context}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items Detail */}
              {actionItemsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Action Items
                  </h4>
                  <ul className="space-y-2">
                    {actionItemsList.map((item, idx) => {
                      const task = typeof item === 'string' ? item : item.task;
                      const owner = typeof item === 'object' ? item.owner : null;
                      return (
                        <li key={idx} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                          <CheckSquare className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800">{task}</p>
                            {owner && (
                              <p className="text-xs text-amber-600 mt-0.5">Owner: {owner}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Topics */}
              {transcript.analysis?.topics && transcript.analysis.topics.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Topics Discussed
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {transcript.analysis.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-full"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {transcript.analysis?.nextSteps && transcript.analysis.nextSteps.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Next Steps
                  </h4>
                  <ul className="space-y-2">
                    {transcript.analysis.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-gray-400 mt-0.5">•</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {transcript.source && (
                    <div>
                      <span className="text-gray-500">Source:</span>
                      <span className="ml-2 text-gray-900 capitalize">{transcript.source}</span>
                    </div>
                  )}
                  {transcript.wordCount && (
                    <div>
                      <span className="text-gray-500">Words:</span>
                      <span className="ml-2 text-gray-900">{transcript.wordCount.toLocaleString()}</span>
                    </div>
                  )}
                  {transcript.company && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Company:</span>
                      <span className="ml-2 text-gray-900">{transcript.company.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && !transcript && (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No transcript analysis available</p>
              <p className="text-sm text-gray-400 mt-1">
                This meeting may not have a recorded transcript yet.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {transcript && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <a
              href={`/transcripts?id=${transcript.id}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Transcript
            </a>
          </div>
        )}
      </div>
    </>
  );
}
