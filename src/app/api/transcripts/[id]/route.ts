import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authSupabase = await createClient();

  // Check authentication
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use admin client for data queries to bypass RLS
  const supabase = createAdminClient();

  const { data: transcript, error } = await supabase
    .from('meeting_transcriptions')
    .select(`
      id,
      title,
      meeting_date,
      duration_minutes,
      attendees,
      transcription_text,
      source,
      word_count,
      analysis,
      summary,
      follow_up_email_draft,
      company_id,
      deal_id,
      contact_id,
      created_at,
      updated_at,
      company:companies(id, name),
      deal:deals(id, name, stage),
      contact:contacts(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching transcript:', error);
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch transcript', details: error.message }, { status: 500 });
  }

  // Format response with full analysis
  const company = Array.isArray(transcript.company) ? transcript.company[0] : transcript.company;
  const deal = Array.isArray(transcript.deal) ? transcript.deal[0] : transcript.deal;
  const contact = Array.isArray(transcript.contact) ? transcript.contact[0] : transcript.contact;

  return NextResponse.json({
    transcript: {
      id: transcript.id,
      title: transcript.title,
      meetingDate: transcript.meeting_date,
      durationMinutes: transcript.duration_minutes,
      attendees: transcript.attendees,
      transcriptionText: transcript.transcription_text,
      source: transcript.source,
      wordCount: transcript.word_count,
      summary: transcript.summary,
      followUpEmailDraft: transcript.follow_up_email_draft,
      createdAt: transcript.created_at,
      updatedAt: transcript.updated_at,
      company: company ? { id: company.id, name: company.name } : null,
      deal: deal ? { id: deal.id, name: deal.name, stage: deal.stage } : null,
      contact: contact ? { id: contact.id, name: contact.name, email: contact.email } : null,
      // Full analysis object
      analysis: transcript.analysis,
    },
  });
}
