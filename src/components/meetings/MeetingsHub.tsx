'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle, Plus, Sparkles, Eye, EyeOff } from 'lucide-react';
import { UpcomingMeetingsSection } from './UpcomingMeetingsSection';
import { PastMeetingsSection } from './PastMeetingsSection';
import { CompanyAssignmentDropdown } from './CompanyAssignmentDropdown';
import { AddProductDropdown } from './AddProductDropdown';
import { TranscriptPanel } from './TranscriptPanel';
import { MeetingsHubSkeleton } from './skeletons';
import { ScheduleMeetingModal } from '@/components/scheduler/ScheduleMeetingModal';
import { Meeting } from './MeetingCard';
import { ProcessingQueue } from './ProcessingQueue';
import { FullAnalysisModal } from './FullAnalysisModal';
import { ToastProvider, useToast } from './ToastContext';
import type { ProcessingTranscript, TranscriptAnalysis, MeetingsStats } from '@/types/meetings';

interface GroupedUpcoming {
  today: Meeting[];
  tomorrow: Meeting[];
  later: Meeting[];
  totalCount: number;
}

interface GroupedPast {
  byDate: Record<string, Meeting[]>;
  totalCount: number;
}

interface MeetingsData {
  upcoming: GroupedUpcoming;
  past: GroupedPast;
  processing?: ProcessingTranscript[];
  stats?: MeetingsStats;
}

export function MeetingsHub() {
  const router = useRouter();
  const [data, setData] = useState<MeetingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pastDays, setPastDays] = useState(7);
  const [showExcluded, setShowExcluded] = useState(false);
  const [expandUpcoming, setExpandUpcoming] = useState(false);
  const [isExcluding, setIsExcluding] = useState(false);

  // Modal states
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(false);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<TranscriptAnalysis | null>(null);
  const [showProcessingQueue, setShowProcessingQueue] = useState(true);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('pastDays', String(pastDays));
      if (showExcluded) params.set('showExcluded', 'true');
      if (expandUpcoming) params.set('expandUpcoming', 'true');

      const response = await fetch(`/api/meetings?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch meetings');
      }

      setData(result);
    } catch (err) {
      console.error('[MeetingsHub] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [pastDays, showExcluded, expandUpcoming]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Find a meeting by ID from all groups
  const findMeetingById = (id: string): Meeting | null => {
    if (!data) return null;

    // Check upcoming
    for (const meeting of [...data.upcoming.today, ...data.upcoming.tomorrow, ...data.upcoming.later]) {
      if (meeting.id === id) return meeting;
    }

    // Check past
    for (const dateKey of Object.keys(data.past.byDate)) {
      for (const meeting of data.past.byDate[dateKey]) {
        if (meeting.id === id) return meeting;
      }
    }

    return null;
  };

  // Exclude a meeting
  const handleExclude = async (meetingId: string, reason?: string) => {
    setIsExcluding(true);
    try {
      const response = await fetch(`/api/activities/${meetingId}/exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to exclude meeting');
      }

      // Refresh data
      await fetchMeetings();
    } catch (err) {
      console.error('[MeetingsHub] Exclude error:', err);
    } finally {
      setIsExcluding(false);
    }
  };

  // Restore an excluded meeting
  const handleRestore = async (meetingId: string) => {
    setIsExcluding(true);
    try {
      const response = await fetch(`/api/activities/${meetingId}/exclude`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to restore meeting');
      }

      // Refresh data
      await fetchMeetings();
    } catch (err) {
      console.error('[MeetingsHub] Restore error:', err);
    } finally {
      setIsExcluding(false);
    }
  };

  // Open company assignment modal
  const handleOpenCompanyModal = (meetingId: string) => {
    const meeting = findMeetingById(meetingId);
    setSelectedMeetingId(meetingId);
    setSelectedMeeting(meeting);
    setCompanyModalOpen(true);
  };

  // Assign company to meeting
  const handleAssignCompany = async (companyId: string) => {
    if (!selectedMeetingId) return;

    const response = await fetch(`/api/activities/${selectedMeetingId}/assign-company`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId }),
    });

    if (!response.ok) {
      throw new Error('Failed to assign company');
    }

    // Refresh data
    await fetchMeetings();
  };

  // Open add product modal
  const handleOpenProductModal = (meetingId: string) => {
    const meeting = findMeetingById(meetingId);
    if (meeting?.company_id) {
      setSelectedMeetingId(meetingId);
      setSelectedMeeting(meeting);
      setProductModalOpen(true);
    }
  };

  // Navigate to full prep page
  const handleOpenPrepPanel = (meetingId: string) => {
    const meeting = findMeetingById(meetingId);
    // Use external_id for Microsoft calendar events, fall back to activity id
    const prepId = meeting?.external_id || meetingId;
    router.push(`/meetings/${prepId}/prep`);
  };

  // Open transcript panel
  const handleOpenTranscriptPanel = (meetingId: string) => {
    const meeting = findMeetingById(meetingId);
    setSelectedMeetingId(meetingId);
    setSelectedMeeting(meeting);
    setTranscriptPanelOpen(true);
  };

  // Open full analysis modal
  const handleOpenAnalysis = (meetingId: string) => {
    const meeting = findMeetingById(meetingId);
    if (meeting?.transcript?.analysis) {
      // Convert the simplified analysis to full TranscriptAnalysis format
      const analysis: TranscriptAnalysis = {
        headline: meeting.transcript.analysis.headline || undefined,
        sentiment: meeting.transcript.analysis.sentiment as TranscriptAnalysis['sentiment'],
        topics: meeting.transcript.analysis.topics,
        summary: meeting.transcript.summary || undefined,
      };
      setSelectedAnalysis(analysis);
      setSelectedMeeting(meeting);
      setAnalysisModalOpen(true);
    }
  };

  if (loading && !data) {
    return <MeetingsHubSkeleton />;
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-normal text-gray-900">Meetings</h1>
          <p className="text-xs text-gray-500">
            Your calendar and meeting history
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Failed to Load</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={fetchMeetings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-gray-900">Meetings</h1>
            {data?.stats && (
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{data.stats.today_count} today</span>
                <span className="text-gray-300">•</span>
                <span>{data.stats.analyzed_count} analyzed</span>
                {data.stats.processing_count > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-blue-600">{data.stats.processing_count} processing</span>
                  </>
                )}
                {data.stats.excluded_count > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <button
                      onClick={() => setShowExcluded(!showExcluded)}
                      className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      {showExcluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {data.stats.excluded_count} excluded
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(data?.processing?.length ?? 0) > 0 && (
              <button
                onClick={() => setShowProcessingQueue(!showProcessingQueue)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${
                  showProcessingQueue
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Queue ({data?.processing?.length || 0})
              </button>
            )}
            <button
              onClick={fetchMeetings}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setScheduleModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Processing Queue - Collapsible */}
      {showProcessingQueue && (data?.processing?.length ?? 0) > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Processing Queue
            </h2>
            <button
              onClick={() => setShowProcessingQueue(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Hide
            </button>
          </div>
          <ProcessingQueue
            items={data?.processing || []}
            onRefresh={fetchMeetings}
          />
        </div>
      )}

      {/* Content - Two column layout */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* Upcoming Meetings */}
          <div className="min-h-0 overflow-auto">
            <UpcomingMeetingsSection
              meetings={data?.upcoming || { today: [], tomorrow: [], later: [], totalCount: 0 }}
              onExclude={handleExclude}
              onRestore={handleRestore}
              onAssignCompany={handleOpenCompanyModal}
              onOpenPrep={handleOpenPrepPanel}
              onExpandUpcoming={() => setExpandUpcoming(true)}
              isExpanded={expandUpcoming}
              isExcluding={isExcluding}
            />
          </div>

          {/* Past Meetings */}
          <div className="min-h-0 overflow-auto">
            <PastMeetingsSection
              meetings={data?.past || { byDate: {}, totalCount: 0 }}
              pastDays={pastDays}
              onChangePastDays={setPastDays}
              onExclude={handleExclude}
              onRestore={handleRestore}
              onAssignCompany={handleOpenCompanyModal}
              onAddProduct={handleOpenProductModal}
              onOpenPrep={handleOpenPrepPanel}
              onOpenTranscript={handleOpenTranscriptPanel}
              showExcluded={showExcluded}
              onToggleShowExcluded={() => setShowExcluded(!showExcluded)}
              isExcluding={isExcluding}
            />
          </div>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSuccess={() => {
          setScheduleModalOpen(false);
          fetchMeetings();
        }}
      />

      {/* Company Assignment Modal */}
      <CompanyAssignmentDropdown
        isOpen={companyModalOpen}
        onClose={() => {
          setCompanyModalOpen(false);
          setSelectedMeetingId(null);
          setSelectedMeeting(null);
        }}
        onSelect={handleAssignCompany}
        meetingSubject={selectedMeeting?.subject}
      />

      {/* Add Product Modal */}
      {selectedMeeting?.company_id && (
        <AddProductDropdown
          isOpen={productModalOpen}
          onClose={() => {
            setProductModalOpen(false);
            setSelectedMeetingId(null);
            setSelectedMeeting(null);
          }}
          companyId={selectedMeeting.company_id}
          companyName={selectedMeeting.company_name || undefined}
          onSuccess={() => {
            fetchMeetings();
          }}
        />
      )}

      {/* Transcript Panel */}
      <TranscriptPanel
        isOpen={transcriptPanelOpen}
        onClose={() => {
          setTranscriptPanelOpen(false);
          setSelectedMeetingId(null);
          setSelectedMeeting(null);
        }}
        meetingId={selectedMeetingId}
        meetingSubject={selectedMeeting?.subject}
      />

      {/* Full Analysis Modal */}
      <FullAnalysisModal
        isOpen={analysisModalOpen}
        onClose={() => {
          setAnalysisModalOpen(false);
          setSelectedAnalysis(null);
          setSelectedMeeting(null);
        }}
        analysis={selectedAnalysis}
        meetingTitle={selectedMeeting?.subject || 'Meeting'}
      />
    </div>
  );
}

// Wrap with ToastProvider
export function MeetingsHubWithToast() {
  return (
    <ToastProvider>
      <MeetingsHub />
    </ToastProvider>
  );
}
