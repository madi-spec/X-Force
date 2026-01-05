import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * GET /api/meetings/[meetingId]/transcript
 *
 * Returns the transcript and analysis for a specific meeting (activity)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { meetingId } = await params;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify meeting exists and belongs to user
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('id, user_id, company_id, subject')
      .eq('id', meetingId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (activity.user_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find transcript for this meeting
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcriptions')
      .select(`
        id,
        title,
        summary,
        analysis,
        source,
        word_count,
        meeting_date,
        created_at,
        company_id
      `)
      .eq('activity_id', meetingId)
      .single();

    if (transcriptError || !transcript) {
      return NextResponse.json({ error: 'No transcript found for this meeting' }, { status: 404 });
    }

    // Get company name if available
    let companyData = null;
    const companyId = transcript.company_id || activity.company_id;
    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId)
        .single();
      companyData = company;
    }

    // Format the response
    const response = {
      id: transcript.id,
      title: transcript.title || activity.subject || 'Untitled Meeting',
      summary: transcript.summary,
      analysis: transcript.analysis,
      meetingDate: transcript.meeting_date,
      source: transcript.source,
      wordCount: transcript.word_count,
      company: companyData,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Meeting Transcript API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
