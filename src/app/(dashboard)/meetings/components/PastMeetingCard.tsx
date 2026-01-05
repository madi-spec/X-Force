'use client';

import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  EyeOff,
  Eye,
  FileText,
  Lightbulb,
  Brain,
  Zap,
  Building2,
  Users,
} from 'lucide-react';
import { SentimentBadge } from './SentimentBadge';
import type { MeetingFromActivity } from '../data';
import type { Sentiment } from '@/types/meetings';

interface Customer {
  id: string;
  name: string;
}

interface PastMeetingCardProps {
  meeting: MeetingFromActivity;
  isExpanded: boolean;
  onToggle: () => void;
  onExclude: () => void;
  onRestore?: () => void;
  customers: Customer[];
  onAssignCustomer: (customerId: string | null) => void;
  onViewFullAnalysis: () => void;
  CustomerDropdown: React.ComponentType<{
    customerId: string | null;
    customerName: string | null;
    onAssign: (customerId: string | null) => void;
    customers: Customer[];
  }>;
}

export function PastMeetingCard({
  meeting,
  isExpanded,
  onToggle,
  onExclude,
  onRestore,
  customers,
  onAssignCustomer,
  onViewFullAnalysis,
  CustomerDropdown,
}: PastMeetingCardProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'insights'>('summary');
  const isExcluded = meeting.excluded_at !== null;

  const transcript = meeting.transcript;
  const analysis = transcript?.analysis;
  const isAnalyzed = meeting.hasAnalysis;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDuration = () => {
    if (meeting.duration_minutes) {
      const minutes = meeting.duration_minutes;
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
      return `${minutes}m`;
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div
          className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isAnalyzed ? 'bg-emerald-100' : meeting.hasTranscript ? 'bg-amber-100' : 'bg-gray-100'
            }`}
          >
            {isAnalyzed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : meeting.hasTranscript ? (
              <Clock className="w-5 h-5 text-amber-600" />
            ) : (
              <FileText className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{meeting.subject}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 flex-wrap">
              <CustomerDropdown
                customerId={meeting.company_id}
                customerName={meeting.company_name}
                onAssign={onAssignCustomer}
                customers={customers}
              />
              <span>{formatDate(meeting.occurred_at)}</span>
              {getDuration() && <span>{getDuration()}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAnalyzed && analysis && (
            <div className="hidden sm:flex items-center gap-3">
              <SentimentBadge sentiment={analysis.sentiment as Sentiment | null} />
              <div className="flex items-center gap-1 text-sm">
                <Zap className="w-4 h-4 text-purple-500" />
                <span className="text-purple-600 font-medium">{analysis.buyingSignals || 0}</span>
              </div>
            </div>
          )}
          {meeting.hasTranscript && !isAnalyzed && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
              Pending Analysis
            </span>
          )}
          {isExcluded && onRestore ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="p-2 hover:bg-green-100 rounded-lg transition-colors text-green-600 hover:text-green-700"
              title="Restore meeting"
            >
              <Eye className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExclude();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              title="Exclude meeting"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && isAnalyzed && transcript && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-gray-50">
            {[
              { id: 'summary' as const, label: 'Summary', icon: FileText },
              { id: 'insights' as const, label: 'Insights', icon: Lightbulb },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewFullAnalysis();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Brain className="w-4 h-4" />
              Full AI Analysis
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'summary' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {transcript.summary || 'No summary available.'}
                </p>
                <div className="flex items-center gap-4 pt-2 text-xs text-gray-400">
                  {meeting.attendee_count > 0 && (
                    <span>{meeting.attendee_count} participants</span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-2">
                {analysis?.topics && analysis.topics.length > 0 ? (
                  analysis.topics.map((topic, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{topic}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">No insights available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Analysis State */}
      {isExpanded && meeting.hasTranscript && !isAnalyzed && (
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center justify-center gap-3 py-6">
            <span className="text-sm text-gray-500">Analysis pending...</span>
          </div>
        </div>
      )}

      {/* No Transcript */}
      {isExpanded && !meeting.hasTranscript && (
        <div className="border-t border-gray-100 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No transcript available</p>
          {meeting.company_name && (
            <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span>{meeting.company_name}</span>
            </div>
          )}
          {meeting.attendee_count > 0 && (
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-500">
              <Users className="w-4 h-4 text-gray-400" />
              <span>{meeting.attendee_count} attendees</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
