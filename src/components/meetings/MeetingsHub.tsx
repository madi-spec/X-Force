'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { UpcomingMeetingsSection } from './UpcomingMeetingsSection';
import { PastMeetingsSection } from './PastMeetingsSection';
import { MeetingsHubSkeleton } from './skeletons';

interface UpcomingMeeting {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  attendee_count: number;
  join_url: string | null;
}

interface PastMeeting {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean;
  transcription_id: string | null;
}

interface MeetingsData {
  upcoming: UpcomingMeeting[];
  past: PastMeeting[];
}

export function MeetingsHub() {
  const [data, setData] = useState<MeetingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pastDays, setPastDays] = useState(30);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings?pastDays=${pastDays}&limit=50`);
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
  }, [pastDays]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleLoadMore = () => {
    setPastDays((prev) => prev + 30);
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
            Your upcoming meetings and historical meeting records
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
      <div className="sticky top-0 z-10 bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-normal text-gray-900">Meetings</h1>
            <p className="text-xs text-gray-500">
              Your upcoming meetings and historical meeting records
            </p>
          </div>
          <button
            onClick={fetchMeetings}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Upcoming Meetings */}
        <UpcomingMeetingsSection meetings={data?.upcoming || []} />

        {/* Past Meetings */}
        <PastMeetingsSection
          meetings={data?.past || []}
          pastDays={pastDays}
          onLoadMore={handleLoadMore}
          loading={loading}
        />
      </div>
    </div>
  );
}
