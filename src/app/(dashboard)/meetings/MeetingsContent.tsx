'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Calendar,
  Mic,
  ArrowRight,
  Filter,
  Search,
  ChevronDown,
} from 'lucide-react';
import {
  StatsBar,
  MeetingPrepCard,
  PastMeetingCard,
  SimpleCustomerDropdown,
  ExcludedBanner,
  ProcessingQueue,
  FullAnalysisModal,
} from './components';
import { ToastProvider, useToast } from './contexts';
import { useExcludeMeeting } from './hooks';
import { assignCustomerAction } from './actions';
import type {
  ProcessingTranscript,
  MeetingsStats,
  TranscriptAnalysis,
} from '@/types/meetings';
import type { MeetingFromActivity } from './data';

interface Customer {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface MeetingsContentProps {
  initialUpcomingMeetings: MeetingFromActivity[];
  initialPastMeetings: MeetingFromActivity[];
  initialProcessingQueue: ProcessingTranscript[];
  initialStats: MeetingsStats;
  customers: Customer[];
  teamMembers: TeamMember[];
}

function MeetingsContentInner({
  initialUpcomingMeetings,
  initialPastMeetings,
  initialProcessingQueue,
  initialStats,
  customers,
  teamMembers,
}: MeetingsContentProps) {
  // State
  const [upcomingMeetings, setUpcomingMeetings] = useState(initialUpcomingMeetings);
  const [pastMeetings, setPastMeetings] = useState(initialPastMeetings);
  const [processingQueue] = useState(initialProcessingQueue);
  const [stats, setStats] = useState(initialStats);

  // UI State
  const [expandedUpcoming, setExpandedUpcoming] = useState<Set<string>>(
    new Set(initialUpcomingMeetings.slice(0, 1).map((m) => m.id))
  );
  const [expandedPast, setExpandedPast] = useState<Set<string>>(
    new Set(initialPastMeetings.slice(0, 1).map((m) => m.id))
  );
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [pastFilter, setPastFilter] = useState<'all' | 'analyzed' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedAnalysis, setSelectedAnalysis] = useState<{
    analysis: TranscriptAnalysis;
    title: string;
  } | null>(null);

  const { showToast } = useToast();

  // Helper to check if meeting is excluded
  const isExcluded = (m: MeetingFromActivity) => m.excluded_at !== null;

  // Exclude/Restore functionality
  const { exclude: excludeMeeting, restore: restoreMeeting } = useExcludeMeeting({
    onExclude: () => {
      showToast('Meeting excluded', 'success');
    },
    onRestore: () => {
      showToast('Meeting restored', 'success');
    },
    onError: (error) => {
      showToast(error, 'error');
    },
  });

  // Toggle functions
  const toggleUpcoming = useCallback((id: string) => {
    setExpandedUpcoming((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const togglePast = useCallback((id: string) => {
    setExpandedPast((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Helper to check if a meeting is today
  const isTodayMeeting = useCallback((occurredAt: string) => {
    const meetingDate = new Date(occurredAt);
    const today = new Date();
    return (
      meetingDate.getFullYear() === today.getFullYear() &&
      meetingDate.getMonth() === today.getMonth() &&
      meetingDate.getDate() === today.getDate()
    );
  }, []);

  // Exclude handlers
  const handleExcludeUpcoming = useCallback(
    (meetingId: string) => {
      const meeting = upcomingMeetings.find((m) => m.id === meetingId);
      setUpcomingMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, excluded_at: new Date().toISOString() } : m))
      );
      // Update stats
      setStats((prev) => ({
        ...prev,
        excluded_count: prev.excluded_count + 1,
        today_count: meeting && isTodayMeeting(meeting.occurred_at) ? prev.today_count - 1 : prev.today_count,
        this_week_count: prev.this_week_count - 1,
      }));
      excludeMeeting(meetingId);
    },
    [excludeMeeting, upcomingMeetings, isTodayMeeting]
  );

  const handleExcludePast = useCallback(
    (meetingId: string) => {
      const meeting = pastMeetings.find((m) => m.id === meetingId);
      setPastMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, excluded_at: new Date().toISOString() } : m))
      );
      // Update stats
      setStats((prev) => ({
        ...prev,
        excluded_count: prev.excluded_count + 1,
        today_count: meeting && isTodayMeeting(meeting.occurred_at) ? prev.today_count - 1 : prev.today_count,
        analyzed_count: meeting?.hasAnalysis ? prev.analyzed_count - 1 : prev.analyzed_count,
      }));
      excludeMeeting(meetingId);
    },
    [excludeMeeting, pastMeetings, isTodayMeeting]
  );

  // Restore handlers
  const handleRestoreUpcoming = useCallback(
    (meetingId: string) => {
      const meeting = upcomingMeetings.find((m) => m.id === meetingId);
      setUpcomingMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, excluded_at: null } : m))
      );
      // Update stats
      setStats((prev) => ({
        ...prev,
        excluded_count: Math.max(0, prev.excluded_count - 1),
        today_count: meeting && isTodayMeeting(meeting.occurred_at) ? prev.today_count + 1 : prev.today_count,
        this_week_count: prev.this_week_count + 1,
      }));
      restoreMeeting(meetingId);
    },
    [restoreMeeting, upcomingMeetings, isTodayMeeting]
  );

  const handleRestorePast = useCallback(
    (meetingId: string) => {
      const meeting = pastMeetings.find((m) => m.id === meetingId);
      setPastMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, excluded_at: null } : m))
      );
      // Update stats
      setStats((prev) => ({
        ...prev,
        excluded_count: Math.max(0, prev.excluded_count - 1),
        today_count: meeting && isTodayMeeting(meeting.occurred_at) ? prev.today_count + 1 : prev.today_count,
        analyzed_count: meeting?.hasAnalysis ? prev.analyzed_count + 1 : prev.analyzed_count,
      }));
      restoreMeeting(meetingId);
    },
    [restoreMeeting, pastMeetings, isTodayMeeting]
  );

  // Customer assignment handlers
  const handleAssignCustomerUpcoming = useCallback(
    async (meetingId: string, customerId: string | null) => {
      const customer = customers.find((c) => c.id === customerId);
      setUpcomingMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                company_id: customerId,
                company_name: customer?.name || null,
              }
            : m
        )
      );
      await assignCustomerAction(meetingId, customerId);
    },
    [customers]
  );

  const handleAssignCustomerPast = useCallback(
    async (meetingId: string, customerId: string | null) => {
      const customer = customers.find((c) => c.id === customerId);
      setPastMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                company_id: customerId,
                company_name: customer?.name || null,
              }
            : m
        )
      );
      await assignCustomerAction(meetingId, customerId);
    },
    [customers]
  );

  // View full analysis
  const handleViewFullAnalysis = useCallback(
    (meeting: MeetingFromActivity) => {
      if (meeting.transcript?.analysis) {
        const analysis = meeting.transcript.analysis;
        setSelectedAnalysis({
          analysis: {
            summary: meeting.transcript.summary || undefined,
            sentiment: analysis.sentiment as TranscriptAnalysis['sentiment'],
            key_insights: analysis.topics || [],
            topics: analysis.topics || [],
          },
          title: meeting.subject,
        });
      }
    },
    []
  );

  // Computed values
  const visibleUpcoming = useMemo(() => {
    return upcomingMeetings.filter((m) => showExcluded || !isExcluded(m));
  }, [upcomingMeetings, showExcluded]);

  const visiblePast = useMemo(() => {
    let filtered = pastMeetings.filter((m) => showExcluded || !isExcluded(m));

    if (pastFilter === 'analyzed') {
      filtered = filtered.filter((m) => m.hasAnalysis);
    } else if (pastFilter === 'pending') {
      filtered = filtered.filter((m) => m.hasTranscript && !m.hasAnalysis);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.subject.toLowerCase().includes(query) ||
          m.company_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [pastMeetings, showExcluded, pastFilter, searchQuery]);

  // Use stats.excluded_count which persists across page refreshes
  // The local computation only counts meetings in current state, not server-excluded ones
  const excludedCount = stats.excluded_count;

  // Group upcoming by date
  const groupedUpcoming = useMemo(() => {
    const groups: { label: string; meetings: MeetingFromActivity[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayMeetings: MeetingFromActivity[] = [];
    const tomorrowMeetings: MeetingFromActivity[] = [];
    const laterMeetings: MeetingFromActivity[] = [];

    visibleUpcoming.forEach((m) => {
      const meetingDate = new Date(m.occurred_at);
      meetingDate.setHours(0, 0, 0, 0);

      if (meetingDate.getTime() === today.getTime()) {
        todayMeetings.push(m);
      } else if (meetingDate.getTime() === tomorrow.getTime()) {
        tomorrowMeetings.push(m);
      } else {
        laterMeetings.push(m);
      }
    });

    if (todayMeetings.length > 0) {
      groups.push({ label: 'Today', meetings: todayMeetings });
    }
    if (tomorrowMeetings.length > 0) {
      groups.push({ label: 'Tomorrow', meetings: tomorrowMeetings });
    }
    if (laterMeetings.length > 0) {
      groups.push({ label: 'This Week', meetings: laterMeetings });
    }

    return groups;
  }, [visibleUpcoming]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-normal text-gray-900">Meetings</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Prepare, review, and analyze your meetings
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ExcludedBanner
                excludedCount={excludedCount}
                showExcluded={showExcluded}
                onToggle={() => setShowExcluded(!showExcluded)}
              />
              <button className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                <Mic className="w-4 h-4" />
                Upload Recording
              </button>
            </div>
          </div>

          <StatsBar stats={stats} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Upcoming Meetings Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Meetings</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                {visibleUpcoming.length} scheduled
              </span>
            </div>
            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors">
              View Calendar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {groupedUpcoming.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 text-sm text-gray-400 uppercase tracking-wide font-medium mb-3">
                  <Calendar className="w-4 h-4" />
                  {group.label}
                </div>
                <div className="space-y-3">
                  {group.meetings
                    .slice(0, showAllUpcoming ? undefined : 3)
                    .map((meeting) => (
                      <div
                        key={meeting.id}
                        className={isExcluded(meeting) ? 'opacity-50' : ''}
                      >
                        <MeetingPrepCard
                          meeting={meeting}
                          isExpanded={expandedUpcoming.has(meeting.id)}
                          onToggle={() => toggleUpcoming(meeting.id)}
                          onExclude={() => handleExcludeUpcoming(meeting.id)}
                          onRestore={() => handleRestoreUpcoming(meeting.id)}
                          customers={customers}
                          onAssignCustomer={(customerId) =>
                            handleAssignCustomerUpcoming(meeting.id, customerId)
                          }
                          CustomerDropdown={SimpleCustomerDropdown}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {visibleUpcoming.length > 3 && (
              <button
                onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllUpcoming
                  ? 'Show less'
                  : `Show ${visibleUpcoming.length - 3} more this week`}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showAllUpcoming ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}

            {visibleUpcoming.length === 0 && (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No upcoming meetings</p>
              </div>
            )}
          </div>
        </section>

        {/* Past Meetings Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Past Meetings & Analysis
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-sm font-medium rounded">
                {visiblePast.filter((m) => m.hasAnalysis).length}{' '}
                analyzed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
                {(['all', 'analyzed', 'pending'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setPastFilter(f)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors capitalize ${
                      pastFilter === f
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-gray-400" />
              </button>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {visiblePast.slice(0, showAllPast ? undefined : 4).map((meeting) => (
              <div key={meeting.id} className={isExcluded(meeting) ? 'opacity-50' : ''}>
                <PastMeetingCard
                  meeting={meeting}
                  isExpanded={expandedPast.has(meeting.id)}
                  onToggle={() => togglePast(meeting.id)}
                  onExclude={() => handleExcludePast(meeting.id)}
                  onRestore={() => handleRestorePast(meeting.id)}
                  customers={customers}
                  onAssignCustomer={(customerId) =>
                    handleAssignCustomerPast(meeting.id, customerId)
                  }
                  onViewFullAnalysis={() => handleViewFullAnalysis(meeting)}
                  CustomerDropdown={SimpleCustomerDropdown}
                />
              </div>
            ))}

            {visiblePast.length > 4 && (
              <button
                onClick={() => setShowAllPast(!showAllPast)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 transition-colors"
              >
                {showAllPast ? 'Show less' : `Show ${visiblePast.length - 4} more`}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAllPast ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {visiblePast.length === 0 && (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No meetings found</p>
              </div>
            )}
          </div>
        </section>

        {/* Processing Queue Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Processing Queue</h2>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-sm font-medium rounded">
                {processingQueue.length} in queue
              </span>
            </div>
          </div>

          <ProcessingQueue items={processingQueue} />
        </section>
      </div>

      {/* Full Analysis Modal */}
      <FullAnalysisModal
        isOpen={selectedAnalysis !== null}
        onClose={() => setSelectedAnalysis(null)}
        analysis={selectedAnalysis?.analysis || null}
        meetingTitle={selectedAnalysis?.title || ''}
      />
    </div>
  );
}

export function MeetingsContent(props: MeetingsContentProps) {
  return (
    <ToastProvider>
      <MeetingsContentInner {...props} />
    </ToastProvider>
  );
}
