/**
 * Context-Aware Meeting Prep Generation
 *
 * Generates rich meeting preparation using the full Relationship Intelligence system.
 * Unlike basic prep, this leverages:
 * - Full relationship history
 * - Buying signals and concerns from transcripts
 * - Open commitments (ours and theirs)
 * - Salesperson notes
 * - Prior meeting context
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';
// Migrated: Using buildFullRelationshipContext from contextFirstPipeline
import { buildFullRelationshipContext, type RelationshipContext } from './contextFirstPipeline';

// Type alias for backward compatibility during migration
type StructuredContext = RelationshipContext;

// ============================================
// TYPES
// ============================================

export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration_minutes: number;
  attendeeEmails: string[];
  dealId?: string | null;
  companyId?: string | null;
  joinUrl?: string | null;
}

export interface AttendeeContext {
  email: string;
  name: string;
  title?: string;
  role?: string;
  companyName?: string;
  context: StructuredContext | null;
  promptContext: string | null;
}

export interface RelationshipStatus {
  deal_stage: string | null;
  deal_value: number | null;
  deal_name: string | null;
  sentiment: string | null;
  days_since_contact: number | null;
  total_interactions: number;
}

export interface OpenItems {
  our_commitments_due: string[];
  their_commitments_pending: string[];
  unresolved_concerns: string[];
}

export interface PersonalizationNotes {
  key_facts_to_reference: string[];
  communication_style: string | null;
}

export interface ContextAwareMeetingPrep {
  quick_context: string;
  relationship_status: RelationshipStatus;
  open_items: OpenItems;
  talking_points: string[];
  watch_out: string[];
  suggested_goals: string[];
  personalization: PersonalizationNotes;
}

export interface FullMeetingPrep {
  meeting: {
    id: string;
    title: string;
    time: string;
    duration: number;
  };
  attendees: AttendeeContext[];
  prep: ContextAwareMeetingPrep;
  materials: Array<{
    type: string;
    label: string;
    url: string;
  }>;
  generated_at: string;
}

// ============================================
// ATTENDEE CONTEXT BUILDING
// ============================================

/**
 * Build full context for each external attendee
 */
async function buildAttendeeContexts(
  attendeeEmails: string[],
  companyId?: string | null
): Promise<AttendeeContext[]> {
  const supabase = createAdminClient();
  const contexts: AttendeeContext[] = [];

  for (const email of attendeeEmails) {
    // Skip internal emails
    if (email.includes('@x-rai') || email.includes('@xrai')) {
      continue;
    }

    try {
      // Get basic contact info
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name, email, title, company_id, role, companies:company_id(name)')
        .eq('email', email)
        .single();

      if (contact) {
        // Build full relationship context (migrated to buildFullRelationshipContext)
        const relationshipContext = await buildFullRelationshipContext({
          contactId: contact.id,
          companyId: contact.company_id || companyId || null,
        });

        // Supabase join can return array or object - handle both
        const companiesRaw = contact.companies;
        const companyData = Array.isArray(companiesRaw)
          ? (companiesRaw[0] as { name: string } | undefined)
          : (companiesRaw as { name: string } | null);

        contexts.push({
          email,
          name: contact.name,
          title: contact.title || undefined,
          role: contact.role || undefined,
          companyName: companyData?.name,
          context: relationshipContext,
          promptContext: relationshipContext.formattedForAI,
        });
      } else {
        // Unknown contact - try to get company context if we have companyId
        if (companyId) {
          const relationshipContext = await buildFullRelationshipContext({
            companyId,
            contactId: null,
          });

          const { data: company } = await supabase
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single();

          contexts.push({
            email,
            name: email.split('@')[0],
            companyName: company?.name,
            context: relationshipContext,
            promptContext: relationshipContext.formattedForAI,
          });
        } else {
          contexts.push({
            email,
            name: email.split('@')[0],
            context: null,
            promptContext: null,
          });
        }
      }
    } catch (error) {
      console.error(`[MeetingPrep] Error building context for ${email}:`, error);
      contexts.push({
        email,
        name: email.split('@')[0],
        context: null,
        promptContext: null,
      });
    }
  }

  return contexts;
}

// ============================================
// PREP GENERATION
// ============================================

/**
 * Generate context-aware meeting prep using AI
 */
async function generatePrepWithAI(
  meeting: MeetingInfo,
  attendees: AttendeeContext[]
): Promise<ContextAwareMeetingPrep> {
  // Combine all attendee contexts
  const combinedContext = attendees
    .filter(a => a.promptContext)
    .map(a => `### Context for ${a.name} (${a.email})${a.title ? ` - ${a.title}` : ''}\n${a.promptContext}`)
    .join('\n\n---\n\n');

  // Format meeting time
  const startTime = new Date(meeting.startTime);
  const formattedTime = startTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const prompt = `Generate meeting prep notes for an upcoming sales meeting.

## MEETING DETAILS
Title: ${meeting.title}
Date/Time: ${formattedTime}
Duration: ${meeting.duration_minutes} minutes
Attendees: ${attendees.map(a => `${a.name}${a.title ? ` (${a.title})` : ''}`).join(', ')}

## RELATIONSHIP CONTEXT
${combinedContext || 'No prior relationship context available.'}

---

Based on the full relationship history above, generate meeting prep with:

1. **QUICK CONTEXT** (2-3 sentences)
   - Who they are and where we stand
   - Most important thing to know going in

2. **RELATIONSHIP STATUS**
   - Deal stage and value
   - Overall sentiment trend
   - Days since last contact

3. **OPEN ITEMS TO ADDRESS**
   - Commitments WE made that are due/overdue (they'll expect these!)
   - Commitments THEY made that we should follow up on
   - Unresolved concerns/objections to address

4. **KEY TALKING POINTS** (3-5)
   - Build on buying signals detected (lean into what excited them)
   - Address concerns proactively
   - Reference specific things from prior conversations

5. **WATCH OUT FOR** (1-3)
   - Any red flags or risks
   - Topics to avoid or handle carefully
   - Competitive threats mentioned

6. **SUGGESTED GOALS FOR THIS MEETING** (2-3)
   - What should we accomplish?
   - What's the ideal next step?

7. **PERSONALIZATION NOTES**
   - Key facts to reference (makes you look prepared)
   - Their communication style if known

Return as JSON matching this schema exactly.`;

  const schema = `{
  "quick_context": "string - 2-3 sentences summarizing who they are and where we stand",
  "relationship_status": {
    "deal_stage": "string or null",
    "deal_value": "number or null",
    "deal_name": "string or null",
    "sentiment": "string describing overall sentiment or null",
    "days_since_contact": "number or null",
    "total_interactions": "number"
  },
  "open_items": {
    "our_commitments_due": ["array of commitment strings we need to deliver"],
    "their_commitments_pending": ["array of commitment strings they owe us"],
    "unresolved_concerns": ["array of concern strings to address"]
  },
  "talking_points": ["array of 3-5 specific talking points based on their history"],
  "watch_out": ["array of 1-3 warnings or risks"],
  "suggested_goals": ["array of 2-3 goals for this meeting"],
  "personalization": {
    "key_facts_to_reference": ["array of facts to mention that show you know them"],
    "communication_style": "string describing their style or null"
  }
}`;

  try {
    const result = await callAIJson<ContextAwareMeetingPrep>({
      prompt,
      schema,
      maxTokens: 1500,
      temperature: 0.7,
      model: 'claude-3-haiku-20240307',
    });

    return result.data;
  } catch (error) {
    console.error('[MeetingPrep] AI generation failed:', error);

    // Extract what we can from the structured context (migrated to new RelationshipContext)
    const primaryContext = attendees.find(a => a.context)?.context;

    return {
      quick_context: `Meeting with ${attendees.map(a => a.name).join(', ')}. Review relationship history before the call.`,
      relationship_status: {
        deal_stage: primaryContext?.deal?.stage || null,
        deal_value: primaryContext?.deal?.estimated_value || null,
        deal_name: primaryContext?.deal?.name || null,
        sentiment: null,
        days_since_contact: null, // Not tracked in new structure
        total_interactions: primaryContext?.relationshipIntelligence?.interactions?.length || 0,
      },
      open_items: {
        our_commitments_due: primaryContext?.relationshipIntelligence?.open_commitments?.ours?.map(c => c.commitment) || [],
        their_commitments_pending: primaryContext?.relationshipIntelligence?.open_commitments?.theirs?.map(c => c.commitment) || [],
        unresolved_concerns: primaryContext?.relationshipIntelligence?.signals?.concerns?.filter(c => !c.resolved).map(c => c.concern) || [],
      },
      talking_points: [
        'Review current status and priorities',
        'Discuss next steps',
        'Address any open questions',
      ],
      watch_out: [],
      suggested_goals: [
        'Understand current priorities',
        'Confirm next steps',
      ],
      personalization: {
        key_facts_to_reference: primaryContext?.relationshipIntelligence?.key_facts?.map(f => f.fact) || [],
        communication_style: null,
      },
    };
  }
}

// ============================================
// MATERIALS GATHERING
// ============================================

/**
 * Gather relevant prep materials
 */
async function gatherMaterials(
  meetingId: string,
  dealId?: string | null,
  companyId?: string | null
): Promise<Array<{ type: string; label: string; url: string }>> {
  const supabase = createAdminClient();
  const materials: Array<{ type: string; label: string; url: string }> = [];

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
        type: 'intelligence',
        label: `${company.name} Intelligence`,
        url: `/companies/${companyId}/intelligence`,
      });
    }
  }

  // Add recent transcripts
  if (companyId) {
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date')
      .eq('company_id', companyId)
      .order('meeting_date', { ascending: false })
      .limit(3);

    if (transcripts?.length) {
      for (const tx of transcripts) {
        const date = new Date(tx.meeting_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
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
// MAIN EXPORT
// ============================================

/**
 * Generate complete context-aware meeting prep
 *
 * This is the main function to call for rich meeting preparation.
 * It uses the full Relationship Intelligence system.
 */
export async function generateContextAwareMeetingPrep(
  meeting: MeetingInfo
): Promise<FullMeetingPrep> {
  console.log(`[MeetingPrep] Generating context-aware prep for: ${meeting.title}`);

  // Build full context for each attendee
  const attendees = await buildAttendeeContexts(
    meeting.attendeeEmails,
    meeting.companyId
  );

  console.log(`[MeetingPrep] Built context for ${attendees.length} external attendees`);

  // Generate AI prep
  const prep = await generatePrepWithAI(meeting, attendees);

  // Gather materials
  const materials = await gatherMaterials(
    meeting.id,
    meeting.dealId,
    meeting.companyId
  );

  // Format meeting time for response
  const startTime = new Date(meeting.startTime);
  const formattedTime = startTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      time: formattedTime,
      duration: meeting.duration_minutes,
    },
    attendees,
    prep,
    materials,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Quick helper to check if we have rich context for a meeting
 */
export async function hasRichContext(attendeeEmails: string[]): Promise<boolean> {
  const supabase = createAdminClient();

  for (const email of attendeeEmails) {
    // Check if any attendee has relationship intelligence
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .eq('email', email)
      .single();

    if (contact) {
      const { data: ri } = await supabase
        .from('relationship_intelligence')
        .select('id')
        .or(`contact_id.eq.${contact.id},company_id.eq.${contact.company_id}`)
        .limit(1)
        .single();

      if (ri) return true;
    }
  }

  return false;
}
