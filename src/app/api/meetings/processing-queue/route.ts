import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/meetings/processing-queue
 *
 * Returns transcripts that are pending or currently processing
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    // Query transcripts that are pending or processing
    const { data, error } = await supabase
      .from('meeting_transcriptions')
      .select(`
        id,
        activity_id,
        title,
        word_count,
        source,
        status,
        processing_progress,
        error_message,
        created_at
      `)
      .eq('user_id', profile.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[Processing Queue API] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch processing queue' }, { status: 500 });
    }

    // Transform to ProcessingTranscript format
    const queue = (data || []).map(t => ({
      id: t.id,
      activity_id: t.activity_id,
      title: t.title || 'Untitled Transcript',
      status: t.status || 'pending',
      progress: t.processing_progress || 0,
      word_count: t.word_count || 0,
      source: t.source,
      error_message: t.error_message,
    }));

    return NextResponse.json(queue);
  } catch (error) {
    console.error('[Processing Queue API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch processing queue' }, { status: 500 });
  }
}
