import { Suspense } from 'react';
import { getMeetingsPageData } from './data';
import { MeetingsContent } from './MeetingsContent';
import { MeetingsHubSkeleton } from '@/components/meetings/skeletons';

export const metadata = {
  title: 'Meetings | X-FORCE CRM',
  description: 'Prepare, review, and analyze your meetings',
};

// Force dynamic rendering to bypass Next.js caching
export const dynamic = 'force-dynamic';

async function MeetingsDataLoader() {
  // Always include excluded meetings so users can toggle visibility and restore them
  const data = await getMeetingsPageData(true);

  // Flatten upcoming meetings from grouped structure
  const upcomingMeetings = [
    ...data.upcoming.today,
    ...data.upcoming.tomorrow,
    ...data.upcoming.later,
  ];

  // Flatten past meetings from grouped structure
  const pastMeetings = Object.values(data.past.byDate).flat();

  return (
    <MeetingsContent
      initialUpcomingMeetings={upcomingMeetings}
      initialPastMeetings={pastMeetings}
      initialProcessingQueue={data.processing}
      initialStats={data.stats}
      customers={data.customers}
      teamMembers={data.teamMembers}
    />
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<MeetingsHubSkeleton />}>
      <MeetingsDataLoader />
    </Suspense>
  );
}
