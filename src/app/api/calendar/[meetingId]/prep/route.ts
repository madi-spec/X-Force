/**
 * Meeting Prep API
 *
 * GET /api/calendar/[meetingId]/prep
 * Returns meeting prep data with attendee intelligence and AI-generated content
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { callAIJson } from '@/lib/ai/core/aiClient';
import { MeetingWithPrep, MeetingAttendee, MeetingPrepContent, PrepMaterial } from '@/types/commandCenter';

// ============================================
// HELPERS
// ============================================

async function enrichAttendees(
  supabase: ReturnType<typeof createAdminClient>,
  attendeeEmails: string[],
  companyId?: string | null
): Promise<MeetingAttendee[]> {
  const enriched: MeetingAttendee[] = [];

  for (const email of attendeeEmails) {
    // Try to find contact in database
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, email, title, company_id')
      .eq('email', email)
      .single();

    if (contact) {
      // Get meeting history
      const { count } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('contact_id', contact.id)
        .eq('type', 'meeting');

      // Get last meeting
      const { data: lastMeeting } = await supabase
        .from('activities')
        .select('start_at')
        .eq('contact_id', contact.id)
        .eq('type', 'meeting')
        .order('start_at', { ascending: false })
        .limit(1)
        .single();

      enriched.push({
        email,
        name: contact.name,
        title: contact.title || undefined,
        role: 'unknown', // Would be determined by AI or contact metadata
        meeting_count: count || undefined,
        last_met_at: lastMeeting?.start_at,
      });
    } else {
      enriched.push({
        email,
        name: email.split('@')[0],
        role: 'unknown',
      });
    }
  }

  return enriched;
}

async function generateMeetingPrep(
  title: string,
  attendees: MeetingAttendee[],
  deal?: {
    name: string;
    stage: string;
    value?: number;
  },
  recentContext?: string[]
): Promise<MeetingPrepContent> {
  const prompt = `Generate meeting prep for a sales meeting:

MEETING: ${title}

ATTENDEES:
${attendees.map(a => `- ${a.name}${a.title ? ` (${a.title})` : ''}${a.role !== 'unknown' ? ` - ${a.role}` : ''}`).join('\n')}

${deal ? `
DEAL CONTEXT:
- Deal: ${deal.name}
- Stage: ${deal.stage}
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
` : ''}

${recentContext?.length ? `
RECENT CONTEXT:
${recentContext.join('\n')}
` : ''}

Generate:
1. objective: A clear, specific objective for this meeting (1-2 sentences)
2. talking_points: 3-5 key points to discuss
3. landmines: 1-3 topics to avoid or handle carefully (if any)
4. questions_to_ask: 2-4 good discovery questions

Be specific and actionable based on the context provided.`;

  const schema = `{
  "objective": "string",
  "talking_points": ["string array - 3-5 items"],
  "landmines": ["string array - 1-3 items"],
  "questions_to_ask": ["string array - 2-4 items"]
}`;

  try {
    const result = await callAIJson<MeetingPrepContent>({
      prompt,
      schema,
      maxTokens: 800,
      temperature: 0.7,
      model: 'claude-3-haiku-20240307',
    });

    return result.data;
  } catch (error) {
    console.error('[MeetingPrep] AI generation failed:', error);
    // Return sensible defaults
    return {
      objective: `Conduct productive ${title} meeting`,
      talking_points: [
        'Review current status and progress',
        'Discuss next steps and action items',
        'Address any questions or concerns',
      ],
      landmines: [],
      questions_to_ask: [
        'What are your main priorities right now?',
        'What would success look like for you?',
      ],
    };
  }
}

// ============================================
// ROUTE HANDLER
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if we have cached prep
    const { data: cachedPrep } = await supabase
      .from('meeting_prep')
      .select('*')
      .eq('user_id', dbUser.id)
      .eq('meeting_id', meetingId)
      .single();

    if (cachedPrep) {
      // Return cached prep
      const response: MeetingWithPrep = {
        id: cachedPrep.id,
        meeting_id: cachedPrep.meeting_id,
        meeting_external_id: cachedPrep.meeting_external_id,
        title: cachedPrep.title,
        start_time: cachedPrep.start_time,
        end_time: cachedPrep.end_time,
        join_url: cachedPrep.join_url,
        company_id: cachedPrep.company_id,
        deal_id: cachedPrep.deal_id,
        attendees: cachedPrep.attendees as MeetingAttendee[],
        prep: {
          objective: cachedPrep.objective || '',
          talking_points: cachedPrep.talking_points || [],
          landmines: cachedPrep.landmines || [],
          questions_to_ask: cachedPrep.questions_to_ask || [],
        },
        prep_materials: cachedPrep.prep_materials as PrepMaterial[],
        generated_at: cachedPrep.generated_at,
        last_refreshed_at: cachedPrep.last_refreshed_at,
      };

      return NextResponse.json(response);
    }

    // Look up meeting in activities table
    // meetingId could be either our internal UUID or a Microsoft Graph event ID
    let meeting = null;

    // First try by internal ID
    const { data: meetingById } = await supabase
      .from('activities')
      .select(`
        id,
        subject,
        start_at,
        end_at,
        deal_id,
        company_id,
        contact_id,
        metadata,
        deal:deals(id, name, stage, estimated_value, health_score),
        company:companies(id, name)
      `)
      .eq('id', meetingId)
      .eq('type', 'meeting')
      .single();

    if (meetingById) {
      meeting = meetingById;
    } else {
      // Try by Microsoft Graph event ID in metadata
      const { data: meetingByExternalId } = await supabase
        .from('activities')
        .select(`
          id,
          subject,
          start_at,
          end_at,
          deal_id,
          company_id,
          contact_id,
          metadata,
          deal:deals(id, name, stage, estimated_value, health_score),
          company:companies(id, name)
        `)
        .eq('type', 'meeting')
        .contains('metadata', { external_id: meetingId })
        .single();

      meeting = meetingByExternalId;
    }

    if (!meeting) {
      // If still not found, the meeting might be from calendar sync but not yet in activities
      // Return a minimal response with just the meeting ID
      return NextResponse.json({
        error: 'Meeting not found in activities. It may not be synced yet.',
        meeting_id: meetingId,
      }, { status: 404 });
    }

    // Get attendees from metadata
    const attendeeEmails: string[] = meeting.metadata?.attendees || [];
    const enrichedAttendees = await enrichAttendees(supabase, attendeeEmails, meeting.company_id);

    // Get deal context - Supabase returns the joined data; handle both array and object forms
    const dealData = meeting.deal;
    const deal = Array.isArray(dealData) ? dealData[0] as { id: string; name: string; stage: string; estimated_value?: number; health_score?: number } | undefined : dealData as { id: string; name: string; stage: string; estimated_value?: number; health_score?: number } | null;

    // Get recent context (activities)
    const { data: recentActivities } = await supabase
      .from('activities')
      .select('type, subject, description')
      .or(`deal_id.eq.${meeting.deal_id},company_id.eq.${meeting.company_id}`)
      .neq('id', meetingId)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentContext = recentActivities?.map(a =>
      `[${a.type}] ${a.subject}${a.description ? `: ${a.description.substring(0, 100)}` : ''}`
    ) || [];

    // Generate prep content
    const prepContent = await generateMeetingPrep(
      meeting.subject,
      enrichedAttendees,
      deal ? {
        name: deal.name,
        stage: deal.stage,
        value: deal.estimated_value,
      } : undefined,
      recentContext
    );

    // Build prep materials
    const prepMaterials: PrepMaterial[] = [];
    if (deal) {
      prepMaterials.push({
        type: 'deal',
        label: 'Deal Page',
        url: `/deals/${deal.id}`,
      });
    }
    if (meeting.company_id) {
      prepMaterials.push({
        type: 'document',
        label: 'Company Intelligence',
        url: `/companies/${meeting.company_id}/intelligence`,
      });
    }

    // Save prep to database
    const prepRecord = {
      user_id: dbUser.id,
      meeting_id: meetingId,
      meeting_external_id: meeting.metadata?.external_id,
      title: meeting.subject,
      start_time: meeting.start_at,
      end_time: meeting.end_at,
      join_url: meeting.metadata?.join_url,
      company_id: meeting.company_id,
      deal_id: meeting.deal_id,
      attendees: enrichedAttendees,
      objective: prepContent.objective,
      talking_points: prepContent.talking_points,
      landmines: prepContent.landmines,
      questions_to_ask: prepContent.questions_to_ask,
      prep_materials: prepMaterials,
    };

    const { data: savedPrep, error: saveError } = await supabase
      .from('meeting_prep')
      .insert(prepRecord)
      .select()
      .single();

    if (saveError) {
      console.error('[MeetingPrep] Failed to save prep:', saveError);
    }

    // Build response
    const response: MeetingWithPrep = {
      id: savedPrep?.id || '',
      meeting_id: meetingId,
      meeting_external_id: meeting.metadata?.external_id,
      title: meeting.subject,
      start_time: meeting.start_at,
      end_time: meeting.end_at,
      join_url: meeting.metadata?.join_url,
      company_id: meeting.company_id,
      company_name: (() => {
        const companyData = meeting.company;
        const company = Array.isArray(companyData) ? companyData[0] : companyData;
        return (company as { name: string } | null)?.name;
      })(),
      deal_id: meeting.deal_id,
      deal_name: deal?.name,
      deal_value: deal?.estimated_value,
      deal_stage: deal?.stage,
      deal_health: deal?.health_score,
      attendees: enrichedAttendees,
      prep: prepContent,
      prep_materials: prepMaterials,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[MeetingPrep] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate meeting prep' },
      { status: 500 }
    );
  }
}
