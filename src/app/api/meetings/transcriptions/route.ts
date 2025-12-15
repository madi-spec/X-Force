import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeMeetingTranscription } from '@/lib/ai/meetingAnalysisService';

// POST - Upload transcription and trigger AI analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      meetingDate,
      durationMinutes,
      attendees,
      dealId,
      companyId,
      contactId,
      transcriptionText,
      transcriptionFormat,
    } = body;

    // Validate required fields
    if (!title || !meetingDate || !transcriptionText) {
      return NextResponse.json(
        { error: 'Title, meeting date, and transcription text are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
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

    // Calculate word count
    const wordCount = transcriptionText.split(/\s+/).filter(Boolean).length;

    // Run AI analysis
    const analysis = await analyzeMeetingTranscription(transcriptionText, {
      title,
      meetingDate,
      attendees: attendees || undefined,
      dealId: dealId || undefined,
      companyId: companyId || undefined,
    });

    // Create the transcription record
    const { data: transcription, error: insertError } = await supabase
      .from('meeting_transcriptions')
      .insert({
        user_id: profile.id,
        deal_id: dealId || null,
        company_id: companyId || null,
        contact_id: contactId || null,
        title,
        meeting_date: meetingDate,
        duration_minutes: durationMinutes || null,
        attendees: attendees || null,
        transcription_text: transcriptionText,
        transcription_format: transcriptionFormat || 'plain',
        word_count: wordCount,
        analysis,
        analysis_generated_at: new Date().toISOString(),
        summary: analysis.summary,
        follow_up_email_draft: analysis.followUpEmail.body,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting transcription:', insertError);
      return NextResponse.json(
        { error: 'Failed to save transcription' },
        { status: 500 }
      );
    }

    // Create an activity record for the meeting
    if (dealId || companyId) {
      await supabase.from('activities').insert({
        user_id: profile.id,
        deal_id: dealId || null,
        company_id: companyId,
        type: 'meeting_held',
        subject: title,
        body: analysis.summary,
        summary: analysis.headline,
        occurred_at: meetingDate,
        metadata: {
          transcription_id: transcription.id,
          duration_minutes: durationMinutes,
          attendees,
        },
        visible_to_teams: ['voice', 'xrai'],
      });
    }

    return NextResponse.json({
      transcriptionId: transcription.id,
      analysis,
    });
  } catch (error) {
    console.error('Error processing transcription:', error);
    return NextResponse.json(
      { error: 'Failed to process transcription' },
      { status: 500 }
    );
  }
}

// GET - List transcriptions (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId');
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query
    let query = supabase
      .from('meeting_transcriptions')
      .select(
        `
        id,
        title,
        meeting_date,
        duration_minutes,
        attendees,
        summary,
        analysis_generated_at,
        created_at,
        deal:deals(id, name),
        company:companies(id, name),
        user:users(id, name)
      `
      )
      .order('meeting_date', { ascending: false })
      .limit(limit);

    if (dealId) {
      query = query.eq('deal_id', dealId);
    }

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data: transcriptions, error } = await query;

    if (error) {
      console.error('Error fetching transcriptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transcriptions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ transcriptions });
  } catch (error) {
    console.error('Error fetching transcriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcriptions' },
      { status: 500 }
    );
  }
}
