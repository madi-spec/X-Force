'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  Users,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { MeetingTranscription, MeetingAnalysis, Deal } from '@/types';
import { AnalysisSummaryCard } from './AnalysisSummaryCard';
import { KeyPointsList } from './KeyPointsList';
import { BuyingSignalsCard } from './BuyingSignalsCard';
import { ObjectionsCard } from './ObjectionsCard';
import { SentimentCard } from './SentimentCard';
import { ActionItemsList } from './ActionItemsList';
import { FollowUpEmailPreview } from './FollowUpEmailPreview';
import { RecommendationsPanel } from './RecommendationsPanel';

interface MeetingAnalysisViewProps {
  transcription: MeetingTranscription;
  analysis: MeetingAnalysis;
  deal?: Deal | null;
}

export function MeetingAnalysisView({
  transcription,
  analysis,
  deal,
}: MeetingAnalysisViewProps) {
  const router = useRouter();
  const [showTranscript, setShowTranscript] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(analysis);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const response = await fetch(
        `/api/meetings/transcriptions/${transcription.id}/analyze`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate analysis');
      }

      const data = await response.json();
      setCurrentAnalysis(data.analysis);
    } catch (error) {
      console.error('Error regenerating analysis:', error);
    } finally {
      setRegenerating(false);
    }
  }, [transcription.id]);

  const backUrl = deal ? `/deals/${deal.id}` : '/pipeline';

  return (
    <div className="max-w-6xl mx-auto pb-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={backUrl}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {deal ? 'Back to Deal' : 'Back to Pipeline'}
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-normal text-gray-900">
                Meeting Analysis: {transcription.title}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(transcription.meeting_date)}
                </span>
                {transcription.duration_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {transcription.duration_minutes} minutes
                  </span>
                )}
                {transcription.attendees && transcription.attendees.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {transcription.attendees.join(', ')}
                  </span>
                )}
              </div>
              {deal && (
                <Link
                  href={`/deals/${deal.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block"
                >
                  {deal.name}
                </Link>
              )}
            </div>

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerate Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          {(currentAnalysis.summary || currentAnalysis.headline) && (
            <AnalysisSummaryCard
              summary={currentAnalysis.summary || 'No summary available'}
              headline={currentAnalysis.headline || 'Meeting Analysis'}
            />
          )}

          {/* Key Points and Buying Signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KeyPointsList keyPoints={currentAnalysis.keyPoints || []} />
            <BuyingSignalsCard signals={currentAnalysis.buyingSignals || []} />
          </div>

          {/* Objections and Sentiment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ObjectionsCard objections={currentAnalysis.objections || []} />
            {currentAnalysis.sentiment && (
              <SentimentCard sentiment={currentAnalysis.sentiment} />
            )}
          </div>

          {/* Action Items */}
          <ActionItemsList
            actionItems={currentAnalysis.actionItems || []}
            theirCommitments={currentAnalysis.theirCommitments || []}
            ourCommitments={currentAnalysis.ourCommitments || []}
            transcriptionId={transcription.id}
          />

          {/* Follow-up Email */}
          {currentAnalysis.followUpEmail && (
            <FollowUpEmailPreview
              email={currentAnalysis.followUpEmail}
              transcriptionId={transcription.id}
              meetingTitle={transcription.title}
              attendees={transcription.attendees?.map((attendee, i) => ({
                email: attendee.includes('@') ? attendee : `${attendee.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                name: attendee.includes('@') ? undefined : attendee,
                role: i === 0 ? 'organizer' : undefined,
              }))}
            />
          )}

          {/* Transcript */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <span className="font-semibold text-gray-900">
                Full Transcript
              </span>
              {showTranscript ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {showTranscript && (
              <div className="p-4 pt-0 border-t border-gray-100">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                  {transcription.transcription_text}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Recommendations & Extracted Info */}
        <div className="space-y-6">
          {/* Recommendations */}
          <RecommendationsPanel
            recommendations={currentAnalysis.recommendations || []}
            transcriptionId={transcription.id}
            dealId={transcription.deal_id || undefined}
          />

          {/* Extracted Information */}
          {currentAnalysis.extractedInfo && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Extracted Information
              </h3>
              <div className="space-y-3 text-sm">
                {currentAnalysis.extractedInfo.companySize && (
                  <div>
                    <span className="text-gray-500">Company Size:</span>
                    <span className="ml-2 text-gray-900">
                      {currentAnalysis.extractedInfo.companySize}
                    </span>
                  </div>
                )}
                {currentAnalysis.extractedInfo.currentSolution && (
                  <div>
                    <span className="text-gray-500">Current Solution:</span>
                    <span className="ml-2 text-gray-900">
                      {currentAnalysis.extractedInfo.currentSolution}
                    </span>
                  </div>
                )}
                {currentAnalysis.extractedInfo.budget && (
                  <div>
                    <span className="text-gray-500">Budget:</span>
                    <span className="ml-2 text-gray-900">
                      {currentAnalysis.extractedInfo.budget}
                    </span>
                  </div>
                )}
                {currentAnalysis.extractedInfo.timeline && (
                  <div>
                    <span className="text-gray-500">Timeline:</span>
                    <span className="ml-2 text-gray-900">
                      {currentAnalysis.extractedInfo.timeline}
                    </span>
                  </div>
                )}
                {currentAnalysis.extractedInfo.decisionProcess && (
                  <div>
                    <span className="text-gray-500">Decision Process:</span>
                    <span className="ml-2 text-gray-900">
                      {currentAnalysis.extractedInfo.decisionProcess}
                    </span>
                  </div>
                )}
                {currentAnalysis.extractedInfo.painPoints?.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-1">Pain Points:</span>
                    <ul className="list-disc list-inside text-gray-900 ml-2">
                      {currentAnalysis.extractedInfo.painPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentAnalysis.extractedInfo.competitors?.length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-1">Competitors:</span>
                    <ul className="list-disc list-inside text-gray-900 ml-2">
                      {currentAnalysis.extractedInfo.competitors.map((comp, i) => (
                        <li key={i}>{comp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stakeholders */}
          {currentAnalysis.stakeholders?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Stakeholders</h3>
              <div className="space-y-4">
                {currentAnalysis.stakeholders.map((stakeholder, i) => (
                  <div key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {stakeholder.name}
                      </span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          stakeholder.sentiment === 'positive' &&
                            'bg-green-100 text-green-700',
                          stakeholder.sentiment === 'neutral' &&
                            'bg-gray-100 text-gray-700',
                          stakeholder.sentiment === 'negative' &&
                            'bg-red-100 text-red-700'
                        )}
                      >
                        {stakeholder.sentiment}
                      </span>
                    </div>
                    {stakeholder.role && (
                      <p className="text-sm text-gray-500">{stakeholder.role}</p>
                    )}
                    {stakeholder.keyQuotes.length > 0 && (
                      <div className="mt-2">
                        {stakeholder.keyQuotes.map((quote, qi) => (
                          <p
                            key={qi}
                            className="text-sm text-gray-600 italic mt-1"
                          >
                            &quot;{quote}&quot;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Score */}
          {currentAnalysis.confidence !== undefined && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Analysis Confidence</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round(currentAnalysis.confidence * 100)}%
                </span>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${currentAnalysis.confidence * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
