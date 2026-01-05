'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X,
  Brain,
  TrendingUp,
  Users,
  MessageSquare,
  Lightbulb,
  Download,
  Share2,
} from 'lucide-react';
import { SentimentBadge } from './SentimentBadge';
import type { TranscriptAnalysis, Topic } from '@/types/meetings';

interface FullAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: TranscriptAnalysis | null;
  meetingTitle: string;
}

export function FullAnalysisModal({
  isOpen,
  onClose,
  analysis,
  meetingTitle,
}: FullAnalysisModalProps) {
  const [activeSection, setActiveSection] = useState('summary');

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleEscape]);

  if (!isOpen || !analysis) return null;

  const sections = [
    { id: 'summary', label: 'Summary', icon: Brain },
    { id: 'insights', label: 'Key Insights', icon: Lightbulb },
    { id: 'signals', label: 'Signals', icon: TrendingUp },
    { id: 'topics', label: 'Topics', icon: MessageSquare },
    { id: 'speakers', label: 'Speakers', icon: Users },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Full AI Analysis</h2>
              <p className="text-sm text-gray-500 truncate max-w-md">
                {meetingTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
              <Download className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-100">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'summary' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <SentimentBadge sentiment={analysis.sentiment || null} />
                {analysis.sentiment_score && (
                  <span className="text-sm text-gray-500">
                    Confidence: {Math.round(analysis.sentiment_score * 100)}%
                  </span>
                )}
              </div>
              <p className="text-gray-600 leading-relaxed">
                {analysis.summary || 'No summary available.'}
              </p>
            </div>
          )}

          {activeSection === 'insights' && (
            <div className="space-y-3">
              {analysis.key_insights && analysis.key_insights.length > 0 ? (
                analysis.key_insights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-100"
                  >
                    <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">{insight}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No insights available.</p>
              )}
            </div>
          )}

          {activeSection === 'signals' && (
            <div className="space-y-3">
              {analysis.signals && analysis.signals.length > 0 ? (
                analysis.signals.map((signal, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-lg bg-purple-50 border border-purple-100"
                  >
                    <TrendingUp className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-purple-600 uppercase">
                        {signal.type}
                      </span>
                      <p className="text-gray-700 mt-1">{signal.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No signals detected.</p>
              )}
            </div>
          )}

          {activeSection === 'topics' && (
            <div className="space-y-3">
              {analysis.topics && analysis.topics.length > 0 ? (
                analysis.topics.map((topic, i) => {
                  // Handle both string and Topic object formats
                  const isTopicObject = typeof topic === 'object' && topic !== null;
                  const topicName = isTopicObject ? (topic as Topic).name : topic;
                  const topicMentions = isTopicObject ? (topic as Topic).mentions : null;
                  const topicRelevance = isTopicObject ? (topic as Topic).relevance : 0.5;

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <span className="font-medium text-gray-700">{topicName}</span>
                      {isTopicObject && (
                        <div className="flex items-center gap-3">
                          {topicMentions !== null && (
                            <span className="text-sm text-gray-500">
                              {topicMentions} mentions
                            </span>
                          )}
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${topicRelevance * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 italic">No topics identified.</p>
              )}
            </div>
          )}

          {activeSection === 'speakers' && (
            <div className="space-y-3">
              {analysis.speaker_breakdown && analysis.speaker_breakdown.length > 0 ? (
                analysis.speaker_breakdown.map((speaker, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">{speaker.name}</p>
                        {speaker.email && (
                          <p className="text-sm text-gray-400">{speaker.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-700">
                        {Math.round(speaker.talk_time_percentage)}%
                      </p>
                      <p className="text-sm text-gray-400">
                        {Math.round(speaker.talk_time_seconds / 60)} min
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No speaker data available.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Analysis generated by {analysis.analyzed_by || 'AI'} on{' '}
            {analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
