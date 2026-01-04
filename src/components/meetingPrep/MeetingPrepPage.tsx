'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { EnhancedMeetingPrep } from '@/lib/meetingPrep/buildEnhancedPrep';
import { MeetingHeader } from './MeetingHeader';
import { AttendeesPanel } from './AttendeesPanel';
import { AIPrepPanel } from './AIPrepPanel';
import { CollateralPanel } from './CollateralPanel';
import { SoftwareLinksPanel } from './SoftwareLinksPanel';
import { PastContextPanel } from './PastContextPanel';
import { NotesPanel } from './NotesPanel';
import { MeetingPrepSkeleton } from './skeletons';

interface MeetingPrepPageProps {
  meetingId: string;
}

export function MeetingPrepPage({ meetingId }: MeetingPrepPageProps) {
  const [prep, setPrep] = useState<EnhancedMeetingPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrep = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/prep`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load meeting prep');
      }

      setPrep(data.prep);
    } catch (err) {
      console.error('[MeetingPrepPage] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load meeting prep');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // Track collateral usage
  const handleTrackUsage = async (collateralId: string, action: 'viewed' | 'copied_link') => {
    try {
      await fetch(`/api/collateral/${collateralId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch (err) {
      console.error('[MeetingPrepPage] Track usage error:', err);
    }
  };

  // Loading state - use skeleton
  if (loading) {
    return <MeetingPrepSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">Failed to Load</h2>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <button
              onClick={fetchPrep}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!prep) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back Navigation */}
        <Link
          href="/calendar"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Calendar
        </Link>

        {/* Meeting Header */}
        <MeetingHeader
          title={prep.meeting.title}
          startTime={prep.meeting.startTime}
          endTime={prep.meeting.endTime}
          durationMinutes={prep.meeting.durationMinutes}
          meetingType={prep.meeting.meetingType}
          joinUrl={prep.meeting.joinUrl}
          companyName={prep.company?.name}
          attendeeCount={prep.attendees.length}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column - Main Prep */}
          <div className="lg:col-span-2 space-y-6">
            <AIPrepPanel aiPrep={prep.aiPrep} />
            <CollateralPanel
              collateral={prep.collateral}
              onTrackUsage={handleTrackUsage}
            />
          </div>

          {/* Right Column - Context & Notes */}
          <div className="space-y-6">
            <AttendeesPanel attendees={prep.attendees} />
            <SoftwareLinksPanel links={prep.softwareLinks} />
            <PastContextPanel links={prep.pastContext} />
            <NotesPanel
              meetingId={prep.meeting.id}
              initialNotes={prep.notes}
            />
          </div>
        </div>

        {/* Footer Timestamp */}
        <p className="text-xs text-gray-400 text-center mt-8">
          Prep generated at {new Date(prep.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
