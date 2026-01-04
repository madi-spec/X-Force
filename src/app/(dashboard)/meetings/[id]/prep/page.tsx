import { MeetingPrepPage } from '@/components/meetingPrep';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingPrepRoute({ params }: PageProps) {
  const { id } = await params;

  return <MeetingPrepPage meetingId={id} />;
}

export const metadata = {
  title: 'Meeting Prep | X-FORCE',
  description: 'AI-powered meeting preparation',
};
