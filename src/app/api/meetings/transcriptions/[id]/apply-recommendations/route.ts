import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MeetingAnalysis, MeetingRecommendation } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Apply recommendations from analysis
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { recommendationIndexes } = body as { recommendationIndexes: number[] };

    if (!recommendationIndexes || !Array.isArray(recommendationIndexes)) {
      return NextResponse.json(
        { error: 'recommendationIndexes array is required' },
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

    // Fetch the transcription with analysis
    const { data: transcription, error: fetchError } = await supabase
      .from('meeting_transcriptions')
      .select('id, deal_id, company_id, analysis')
      .eq('id', id)
      .single();

    if (fetchError || !transcription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    const analysis = transcription.analysis as MeetingAnalysis | null;
    if (!analysis || !analysis.recommendations) {
      return NextResponse.json(
        { error: 'No recommendations found in analysis' },
        { status: 400 }
      );
    }

    // Get selected recommendations
    const selectedRecommendations = recommendationIndexes
      .filter((index: number) => index >= 0 && index < analysis.recommendations.length)
      .map((index: number) => analysis.recommendations[index]);

    if (selectedRecommendations.length === 0) {
      return NextResponse.json(
        { error: 'No valid recommendations selected' },
        { status: 400 }
      );
    }

    const applied: string[] = [];
    const errors: string[] = [];

    // Process each recommendation
    for (const rec of selectedRecommendations) {
      try {
        await applyRecommendation(supabase, transcription, rec, profile.id);
        applied.push(rec.action);
      } catch (err) {
        console.error(`Error applying recommendation: ${rec.action}`, err);
        errors.push(rec.action);
      }
    }

    return NextResponse.json({
      applied,
      errors,
      appliedCount: applied.length,
      errorCount: errors.length,
    });
  } catch (error) {
    console.error('Error applying recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to apply recommendations' },
      { status: 500 }
    );
  }
}

async function applyRecommendation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  transcription: { id: string; deal_id: string | null; company_id: string | null },
  recommendation: MeetingRecommendation,
  userId: string
) {
  switch (recommendation.type) {
    case 'stage_change': {
      if (!transcription.deal_id) {
        throw new Error('No deal linked to apply stage change');
      }

      const newStage = recommendation.data?.stage as string;
      if (!newStage) {
        throw new Error('No stage specified in recommendation');
      }

      await supabase
        .from('deals')
        .update({
          stage: newStage,
          stage_entered_at: new Date().toISOString(),
        })
        .eq('id', transcription.deal_id);
      break;
    }

    case 'deal_value': {
      if (!transcription.deal_id) {
        throw new Error('No deal linked to update value');
      }

      const newValue = recommendation.data?.value as number;
      if (typeof newValue !== 'number') {
        throw new Error('No value specified in recommendation');
      }

      await supabase
        .from('deals')
        .update({ estimated_value: newValue })
        .eq('id', transcription.deal_id);
      break;
    }

    case 'schedule_meeting': {
      // Create a task to schedule a meeting
      const suggestedDate = recommendation.data?.suggestedDate as string | undefined;

      await supabase.from('tasks').insert({
        deal_id: transcription.deal_id,
        company_id: transcription.company_id,
        assigned_to: userId,
        created_by: userId,
        type: 'meeting',
        title: recommendation.action,
        description: recommendation.reasoning,
        priority: 'high',
        due_at: suggestedDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'ai_recommendation',
      });
      break;
    }

    case 'send_content': {
      // Create a task to send content
      await supabase.from('tasks').insert({
        deal_id: transcription.deal_id,
        company_id: transcription.company_id,
        assigned_to: userId,
        created_by: userId,
        type: 'email',
        title: recommendation.action,
        description: recommendation.reasoning,
        priority: 'medium',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        source: 'ai_recommendation',
      });
      break;
    }

    case 'add_contact': {
      // Just create a task to add the contact (we don't have the contact info)
      await supabase.from('tasks').insert({
        deal_id: transcription.deal_id,
        company_id: transcription.company_id,
        assigned_to: userId,
        created_by: userId,
        type: 'follow_up',
        title: recommendation.action,
        description: recommendation.reasoning,
        priority: 'medium',
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        source: 'ai_recommendation',
      });
      break;
    }

    case 'other':
    default: {
      // Create a generic task
      await supabase.from('tasks').insert({
        deal_id: transcription.deal_id,
        company_id: transcription.company_id,
        assigned_to: userId,
        created_by: userId,
        type: 'follow_up',
        title: recommendation.action,
        description: recommendation.reasoning,
        priority: 'medium',
        due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'ai_recommendation',
      });
      break;
    }
  }
}
