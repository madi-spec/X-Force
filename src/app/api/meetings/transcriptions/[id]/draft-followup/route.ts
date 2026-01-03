/**
 * POST /api/meetings/transcriptions/[id]/draft-followup
 *
 * Generate an AI draft follow-up email based on a meeting transcript analysis.
 * Uses the transcript's action items, key points, and summary to craft the email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { firstOrNull } from '@/lib/supabase/normalize';
import Anthropic from '@anthropic-ai/sdk';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DraftResponse {
  success: boolean;
  draft?: {
    subject: string;
    body: string;
    to: string[];
  };
  context?: {
    company_name: string;
    meeting_title: string;
    meeting_date: string;
  };
  error?: string;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: transcriptId } = await params;

    // Get authenticated user
    const supabaseUser = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseUser.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // 1. Load transcript with analysis and company context
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcriptions')
      .select(`
        id,
        title,
        meeting_date,
        duration_minutes,
        attendees,
        summary,
        analysis,
        company_id,
        company:companies(id, name, domain)
      `)
      .eq('id', transcriptId)
      .single();

    if (transcriptError || !transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript not found' },
        { status: 404 }
      );
    }

    const company = firstOrNull(transcript.company);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Transcript not linked to a company' },
        { status: 400 }
      );
    }

    // 2. Get contacts for the company to find email recipients
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, is_primary')
      .eq('company_id', company.id)
      .order('is_primary', { ascending: false })
      .limit(5);

    // Get primary contact or first contact with email
    const primaryContact = contacts?.find(c => c.is_primary && c.email) || contacts?.find(c => c.email);

    // 3. Parse the analysis
    const analysis = transcript.analysis as {
      summary?: string;
      headline?: string;
      key_points?: string[];
      action_items?: Array<{ task: string; owner?: string; due_date?: string }>;
      next_steps?: string[];
      sentiment?: { overall?: string };
      buying_signals?: Array<{ signal: string; strength?: string }>;
    } | null;

    // 4. Build context for AI
    const meetingDate = new Date(transcript.meeting_date as string);
    const formattedDate = meetingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Extract attendee names (filter out internal emails)
    const attendees = (transcript.attendees as string[] || [])
      .filter(a => !a.includes('@affiliatedtech.com') && !a.includes('@voiceforpest.com'))
      .map(a => a.split('@')[0].replace(/[._]/g, ' '))
      .filter(Boolean);

    const attendeeFirstName = attendees[0]?.split(' ')[0] || 'there';

    // Build action items text
    const actionItemsText = analysis?.action_items?.length
      ? analysis.action_items.map((a, i) => `${i + 1}. ${a.task}${a.owner ? ` (${a.owner})` : ''}`).join('\n')
      : 'No specific action items identified';

    // Build key points text
    const keyPointsText = analysis?.key_points?.length
      ? analysis.key_points.map((p, i) => `- ${p}`).join('\n')
      : '';

    // Build next steps text
    const nextStepsText = analysis?.next_steps?.length
      ? analysis.next_steps.map((s, i) => `- ${s}`).join('\n')
      : '';

    // 5. Generate the follow-up email using Claude
    const anthropic = new Anthropic();

    const prompt = `You are writing a professional follow-up email after a sales/product meeting.

MEETING DETAILS:
- Company: ${company.name}
- Meeting: ${transcript.title}
- Date: ${formattedDate}
- Duration: ${transcript.duration_minutes || 'Unknown'} minutes
- Primary contact name: ${attendeeFirstName}

MEETING SUMMARY:
${analysis?.summary || transcript.summary || 'Meeting discussed product capabilities and next steps.'}

KEY POINTS DISCUSSED:
${keyPointsText || 'Various product features and capabilities were discussed.'}

ACTION ITEMS:
${actionItemsText}

NEXT STEPS:
${nextStepsText || 'Continue discussions and schedule follow-up as needed.'}

INSTRUCTIONS:
Write a professional, friendly follow-up email that:
1. Thanks them for their time in the meeting
2. Briefly recaps the key discussion points (2-3 sentences max)
3. Lists the action items with clear ownership
4. Proposes a concrete next step (follow-up call, trial start, etc.)
5. Ends with a clear call to action

Keep it concise (under 200 words). Use a warm but professional tone.
Do NOT use placeholder text like [Your Name] - the email will be edited before sending.

Return ONLY a JSON object with this exact structure:
{
  "subject": "the email subject line",
  "body": "the email body text"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let draft: { subject: string; body: string };
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = content.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
      draft = JSON.parse(jsonText.trim());
    } catch {
      // Fallback if JSON parsing fails
      draft = {
        subject: `Follow-up: ${transcript.title}`,
        body: `Hi ${attendeeFirstName},\n\nThank you for taking the time to meet with us on ${formattedDate}.\n\n${analysis?.summary || 'We had a great discussion about how we can help your team.'}\n\nHere are the action items we discussed:\n${actionItemsText}\n\nPlease let me know if you have any questions or if there's anything else I can help with.\n\nBest regards`,
      };
    }

    // 6. Return the draft
    const result: DraftResponse = {
      success: true,
      draft: {
        subject: draft.subject,
        body: draft.body,
        to: primaryContact?.email ? [primaryContact.email] : [],
      },
      context: {
        company_name: company.name,
        meeting_title: transcript.title as string,
        meeting_date: formattedDate,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Draft Follow-up] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
