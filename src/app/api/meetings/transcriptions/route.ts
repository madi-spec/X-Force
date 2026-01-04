import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeMeetingTranscription } from '@/lib/ai/meetingAnalysisService';
import { processDetectedContacts } from '@/lib/ai/contactDetectionService';
import { captureMeetingLearnings } from '@/lib/ai/memory';

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
      companyProductId,
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
        company_product_id: companyProductId || null,
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

    // Update deal health score based on meeting analysis
    if (dealId) {
      const healthScoreAdjustment = calculateHealthScoreAdjustment(analysis);

      // Get current deal health score
      const { data: deal } = await supabase
        .from('deals')
        .select('health_score')
        .eq('id', dealId)
        .single();

      if (deal) {
        const newHealthScore = Math.max(0, Math.min(100, (deal.health_score || 50) + healthScoreAdjustment));

        await supabase
          .from('deals')
          .update({ health_score: newHealthScore })
          .eq('id', dealId);
      }
    }

    // Create an activity record for the meeting
    if (dealId || companyId) {
      const { error: activityError } = await supabase.from('activities').insert({
        user_id: profile.id,
        deal_id: dealId || null,
        company_product_id: companyProductId || null,
        company_id: companyId,
        type: 'meeting',
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

      if (activityError) {
        console.error('Error creating activity:', activityError);
      }
    }

    // Auto-detect and create/update contacts from stakeholders
    if (companyId && analysis.stakeholders && analysis.stakeholders.length > 0) {
      try {
        const contactResult = await processDetectedContacts(
          transcription.id,
          companyId,
          analysis.stakeholders,
          title,
          meetingDate
        );
        console.log(
          `[ContactDetection] Created: ${contactResult.created.length}, Updated: ${contactResult.updated.length}, Skipped: ${contactResult.skipped.length}`
        );
      } catch (contactError) {
        // Non-blocking - don't fail the request if contact detection fails
        console.error('Error detecting contacts:', contactError);
      }
    }

    // Capture learnings to account memory
    let memoryCapture = null;
    if (companyId) {
      try {
        memoryCapture = await captureMeetingLearnings(
          companyId,
          transcription.id,
          analysis
        );
        console.log(
          `[MemoryCapture] Auto-applied: ${memoryCapture.autoApplied.length}, Suggested: ${memoryCapture.suggestions.length}`
        );
      } catch (memoryError) {
        // Non-blocking - don't fail the request if memory capture fails
        console.error('Error capturing memory:', memoryError);
      }
    }

    return NextResponse.json({
      transcriptionId: transcription.id,
      analysis,
      memoryCapture,
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
        analysis,
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

// Calculate health score adjustment based on meeting analysis
function calculateHealthScoreAdjustment(analysis: {
  sentiment?: { overall?: string; interestLevel?: string; urgency?: string };
  buyingSignals?: { strength?: string }[];
  objections?: { resolved?: boolean }[];
}): number {
  let adjustment = 0;

  // Base engagement bonus - having a meeting is a positive signal (+5)
  adjustment += 5;

  // Sentiment impact (-10 to +15)
  const sentimentScores: Record<string, number> = {
    very_positive: 15,
    positive: 8,
    neutral: 0,
    negative: -8,
    very_negative: -15,
  };
  adjustment += sentimentScores[analysis.sentiment?.overall || 'neutral'] || 0;

  // Interest level impact (-8 to +10)
  const interestScores: Record<string, number> = {
    high: 10,
    medium: 2,
    low: -8,
  };
  adjustment += interestScores[analysis.sentiment?.interestLevel || 'medium'] || 0;

  // Urgency impact (-5 to +8)
  const urgencyScores: Record<string, number> = {
    high: 8,
    medium: 0,
    low: -5,
  };
  adjustment += urgencyScores[analysis.sentiment?.urgency || 'medium'] || 0;

  // Buying signals boost (strong: +5 each, moderate: +2 each, max +20)
  const strongSignals = analysis.buyingSignals?.filter((s) => s.strength === 'strong').length || 0;
  const moderateSignals = analysis.buyingSignals?.filter((s) => s.strength === 'moderate').length || 0;
  adjustment += Math.min(strongSignals * 5 + moderateSignals * 2, 20);

  // Unresolved objections penalty (-4 each, max -15)
  const unresolvedObjections = analysis.objections?.filter((o) => !o.resolved).length || 0;
  adjustment -= Math.min(unresolvedObjections * 4, 15);

  return adjustment;
}
