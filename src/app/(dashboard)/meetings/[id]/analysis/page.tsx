import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MeetingAnalysisView } from '@/components/meetings/MeetingAnalysisView';
import type { MeetingAnalysis, MeetingTranscription, Deal } from '@/types';

export const dynamic = 'force-dynamic';

interface MeetingAnalysisPageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingAnalysisPage({
  params,
}: MeetingAnalysisPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch the transcription with analysis
  const { data: transcription, error } = await supabase
    .from('meeting_transcriptions')
    .select(
      `
      *,
      deal:deals(id, name, stage, estimated_value, sales_team, company_id),
      company:companies(id, name, segment, industry),
      user:users(id, name, email)
    `
    )
    .eq('id', id)
    .single();

  if (error || !transcription) {
    notFound();
  }

  // Type assertion for the analysis
  const analysis = transcription.analysis as MeetingAnalysis | null;

  if (!analysis) {
    // If no analysis, show a message or redirect
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Analysis Not Available
          </h1>
          <p className="text-gray-500">
            This transcription hasn&apos;t been analyzed yet. Please try
            regenerating the analysis.
          </p>
        </div>
      </div>
    );
  }

  // Cast to proper types
  const typedTranscription: MeetingTranscription = {
    id: transcription.id,
    deal_id: transcription.deal_id,
    company_id: transcription.company_id,
    contact_id: transcription.contact_id,
    activity_id: transcription.activity_id,
    user_id: transcription.user_id,
    title: transcription.title,
    meeting_date: transcription.meeting_date,
    duration_minutes: transcription.duration_minutes,
    attendees: transcription.attendees,
    transcription_text: transcription.transcription_text,
    transcription_format: transcription.transcription_format,
    word_count: transcription.word_count,
    analysis: analysis,
    analysis_generated_at: transcription.analysis_generated_at,
    summary: transcription.summary,
    follow_up_email_draft: transcription.follow_up_email_draft,
    created_at: transcription.created_at,
    updated_at: transcription.updated_at,
  };

  const deal = transcription.deal as Deal | null;

  return (
    <MeetingAnalysisView
      transcription={typedTranscription}
      analysis={analysis}
      deal={deal}
    />
  );
}
