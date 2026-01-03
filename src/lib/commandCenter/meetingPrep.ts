/**
 * Meeting Prep Generation Service
 *
 * Generates AI-powered meeting preparation including:
 * - Meeting objectives
 * - Talking points
 * - Landmines/topics to avoid
 * - Discovery questions
 * - Attendee intelligence
 * - Prep materials
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
import { getPromptWithVariables } from '@/lib/ai/promptManager';
import {
  MeetingAttendee,
  MeetingPrepContent,
  PrepMaterial,
} from '@/types/commandCenter';

// ============================================
// ATTENDEE ENRICHMENT
// ============================================

/**
 * Enrich attendee list with relationship intelligence
 */
export async function enrichAttendees(
  attendeeEmails: string[],
  companyId?: string | null
): Promise<MeetingAttendee[]> {
  const supabase = createAdminClient();
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

      // Get relationship notes if available
      const { data: relationshipData } = await supabase
        .from('contact_relationship_intelligence')
        .select('relationship_notes, communication_preferences, last_interaction_summary')
        .eq('contact_id', contact.id)
        .single();

      enriched.push({
        email,
        name: contact.name,
        title: contact.title || undefined,
        role: 'unknown', // Would be determined by AI or contact metadata
        meeting_count: count || undefined,
        last_met_at: lastMeeting?.start_at,
        relationship_notes: relationshipData?.relationship_notes,
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

// ============================================
// PREP CONTENT GENERATION
// ============================================

/**
 * Generate AI-powered meeting prep content
 */
export async function generateMeetingPrep(
  title: string,
  attendees: MeetingAttendee[],
  deal?: {
    name: string;
    stage: string;
    value?: number;
    health_score?: number;
  },
  recentContext?: string[]
): Promise<MeetingPrepContent> {
  // Format attendees for the prompt
  const attendeesList = attendees.map(a =>
    `- ${a.name}${a.title ? ` (${a.title})` : ''}${a.role !== 'unknown' ? ` - ${a.role}` : ''}${a.meeting_count ? ` [${a.meeting_count} past meetings]` : ''}`
  ).join('\n');

  // Format deal context
  const dealContextText = deal
    ? `Deal: ${deal.name}, Stage: ${deal.stage}, Value: $${deal.value?.toLocaleString() || 'Unknown'}${deal.health_score ? `, Health Score: ${deal.health_score}/100` : ''}`
    : 'No deal context';

  // Format recent context
  const recentCommsText = recentContext?.length
    ? recentContext.join('\n')
    : 'No recent context';

  try {
    // Load the managed prompt from database
    const promptResult = await getPromptWithVariables('meeting_prep_brief', {
      meetingTitle: title || 'Meeting',
      attendees: attendeesList,
      dealContext: dealContextText,
      recentCommunications: recentCommsText,
    });

    if (!promptResult || !promptResult.prompt) {
      console.warn('[generateMeetingPrep] Failed to load meeting_prep_brief prompt, using fallback');
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

    const result = await callAIJson<MeetingPrepContent>({
      prompt: promptResult.prompt,
      schema: promptResult.schema || undefined,
      model: (promptResult.model as 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514') || 'claude-sonnet-4-20250514',
      maxTokens: promptResult.maxTokens || 800,
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
// PREP MATERIALS
// ============================================

/**
 * Gather relevant prep materials for the meeting
 */
export async function gatherPrepMaterials(
  meetingId: string,
  dealId?: string | null,
  companyId?: string | null
): Promise<PrepMaterial[]> {
  const supabase = createAdminClient();
  const materials: PrepMaterial[] = [];

  // Add deal link
  if (dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('name')
      .eq('id', dealId)
      .single();

    if (deal) {
      materials.push({
        type: 'deal',
        label: `Deal: ${deal.name}`,
        url: `/deals/${dealId}`,
      });
    }
  }

  // Add company intelligence link
  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    if (company) {
      materials.push({
        type: 'document',
        label: `${company.name} Intelligence`,
        url: `/companies/${companyId}/intelligence`,
      });
    }
  }

  // Add recent meeting notes
  if (dealId || companyId) {
    const filter = dealId
      ? `deal_id.eq.${dealId}`
      : `company_id.eq.${companyId}`;

    const { data: recentMeetings } = await supabase
      .from('activities')
      .select('id, subject, start_at')
      .or(filter)
      .eq('type', 'meeting')
      .neq('id', meetingId)
      .order('start_at', { ascending: false })
      .limit(3);

    if (recentMeetings?.length) {
      for (const meeting of recentMeetings) {
        const date = new Date(meeting.start_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        materials.push({
          type: 'meeting',
          label: `${date}: ${meeting.subject}`,
          url: `/activities/${meeting.id}`,
        });
      }
    }
  }

  // Add recent transcriptions
  if (companyId) {
    const { data: transcriptions } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date')
      .eq('company_id', companyId)
      .order('meeting_date', { ascending: false })
      .limit(2);

    if (transcriptions?.length) {
      for (const tx of transcriptions) {
        const date = new Date(tx.meeting_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        materials.push({
          type: 'transcript',
          label: `${date}: ${tx.title}`,
          url: `/meetings/transcriptions/${tx.id}`,
        });
      }
    }
  }

  return materials;
}

// ============================================
// FULL MEETING PREP
// ============================================

interface MeetingContext {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  dealId?: string | null;
  companyId?: string | null;
  joinUrl?: string;
  externalId?: string;
}

/**
 * Generate complete meeting prep including all components
 */
export async function generateCompleteMeetingPrep(
  userId: string,
  meeting: MeetingContext
): Promise<{
  attendees: MeetingAttendee[];
  prep: MeetingPrepContent;
  materials: PrepMaterial[];
}> {
  const supabase = createAdminClient();

  // Enrich attendees
  const attendees = await enrichAttendees(meeting.attendeeEmails, meeting.companyId);

  // Get deal context
  let dealContext: { name: string; stage: string; value?: number; health_score?: number } | undefined;
  if (meeting.dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('name, stage, estimated_value, health_score')
      .eq('id', meeting.dealId)
      .single();

    if (deal) {
      dealContext = {
        name: deal.name,
        stage: deal.stage,
        value: deal.estimated_value,
        health_score: deal.health_score,
      };
    }
  }

  // Get recent context
  const { data: recentActivities } = await supabase
    .from('activities')
    .select('type, subject, description')
    .or(`deal_id.eq.${meeting.dealId},company_id.eq.${meeting.companyId}`)
    .neq('id', meeting.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentContext = recentActivities?.map(a =>
    `[${a.type}] ${a.subject}${a.description ? `: ${a.description.substring(0, 100)}` : ''}`
  ) || [];

  // Generate prep content
  const prep = await generateMeetingPrep(
    meeting.title,
    attendees,
    dealContext,
    recentContext
  );

  // Gather materials
  const materials = await gatherPrepMaterials(
    meeting.id,
    meeting.dealId,
    meeting.companyId
  );

  return {
    attendees,
    prep,
    materials,
  };
}
