import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { regenerateAnalysis } from '@/lib/ai/meetingAnalysisService';
import { captureMeetingLearnings } from '@/lib/ai/memory';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Regenerate AI analysis for a transcription
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the transcription exists and user has access
    const { data: transcription, error: fetchError } = await supabase
      .from('meeting_transcriptions')
      .select('id, user_id, company_id')
      .eq('id', id)
      .single();

    if (fetchError || !transcription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    // Regenerate the analysis
    const analysis = await regenerateAnalysis(id);

    // Capture learnings to account memory if company is linked
    let memoryCapture = null;
    if (transcription.company_id) {
      try {
        memoryCapture = await captureMeetingLearnings(
          transcription.company_id,
          id,
          analysis
        );
        console.log('[Analyze] Memory captured:', memoryCapture);
      } catch (memoryError) {
        console.error('[Analyze] Memory capture failed:', memoryError);
        // Don't fail the request if memory capture fails
      }
    }

    return NextResponse.json({
      analysis,
      memoryCapture,
    });
  } catch (error) {
    console.error('Error regenerating analysis:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate analysis' },
      { status: 500 }
    );
  }
}
