import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeMeetingTranscription } from '@/lib/ai/meetingAnalysisService';

/**
 * POST /api/transcripts/analyze
 *
 * Regenerate analysis for one or more transcripts
 *
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();

  // Check authentication
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      // Get the transcript
      const { data: transcript, error: fetchError } = await supabase
        .from('meeting_transcriptions')
        .select('id, title, meeting_date, transcription_text, attendees, deal_id, company_id')
        .eq('id', id)
        .single();

      if (fetchError || !transcript) {
        results.push({ id, success: false, error: 'Transcript not found' });
        continue;
      }

      if (!transcript.transcription_text || transcript.transcription_text.length < 50) {
        results.push({ id, success: false, error: 'Transcript text too short for analysis' });
        continue;
      }

      // Run AI analysis
      console.log(`[Analyze] Running analysis for transcript: ${transcript.title}`);
      const analysis = await analyzeMeetingTranscription(
        transcript.transcription_text,
        {
          title: transcript.title || 'Untitled Meeting',
          meetingDate: transcript.meeting_date || new Date().toISOString().split('T')[0],
          attendees: transcript.attendees || [],
          dealId: transcript.deal_id || undefined,
          companyId: transcript.company_id || undefined,
        }
      );

      // Update transcript with analysis
      const { error: updateError } = await supabase
        .from('meeting_transcriptions')
        .update({
          analysis,
          analysis_generated_at: new Date().toISOString(),
          summary: analysis.summary || null,
          follow_up_email_draft: analysis.followUpEmail?.body || null,
        })
        .eq('id', id);

      if (updateError) {
        console.error(`[Analyze] Failed to save analysis for ${id}:`, updateError);
        results.push({ id, success: false, error: 'Failed to save analysis' });
        continue;
      }

      console.log(`[Analyze] Successfully analyzed: ${transcript.title}`);
      results.push({ id, success: true });
    } catch (error) {
      console.error(`[Analyze] Error analyzing transcript ${id}:`, error);
      results.push({
        id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: true,
    message: `Analyzed ${successCount} transcript(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
    results,
  });
}
