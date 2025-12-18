/**
 * Dynamic Attendee Optimization
 *
 * Analyzes scheduling requests and suggests attendee changes to
 * improve meeting success rates:
 * - Add decision makers when needed
 * - Remove unnecessary attendees to reduce friction
 * - Suggest technical resources when appropriate
 * - Identify stakeholder gaps
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingRequest, MeetingType, MEETING_TYPES } from './types';

// ============================================
// TYPES
// ============================================

export type SuggestionType =
  | 'add_decision_maker'
  | 'add_technical_resource'
  | 'add_champion'
  | 'remove_unnecessary'
  | 'upgrade_contact'
  | 'add_backup_contact'
  | 'reduce_attendee_count';

export interface AttendeeSuggestion {
  type: SuggestionType;
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-1

  // Current attendee (for remove/upgrade)
  current_contact_id?: string;
  current_contact_name?: string;

  // Suggested attendee (for add/upgrade)
  suggested_contact_id?: string;
  suggested_contact_name?: string;
  suggested_contact_title?: string;

  // Reasoning
  reason: string;
  expected_impact: string;
}

export interface AttendeeAnalysis {
  scheduling_request_id: string;
  company_id: string | null;
  meeting_type: MeetingType;

  // Current state
  current_attendees: Array<{
    id: string;
    name: string;
    title: string | null;
    is_decision_maker: boolean;
    is_champion: boolean;
    is_primary_contact: boolean;
  }>;

  // Gaps identified
  has_decision_maker: boolean;
  has_champion: boolean;
  has_technical_contact: boolean;

  // Assessment
  attendee_count: number;
  optimal_count_range: [number, number];
  is_over_attendeed: boolean;
  is_under_attendeed: boolean;

  // Suggestions
  suggestions: AttendeeSuggestion[];

  analyzed_at: string;
}

// ============================================
// MEETING TYPE CONFIGURATIONS
// ============================================

interface MeetingAttendeeConfig {
  optimal_min: number;
  optimal_max: number;
  requires_decision_maker: boolean;
  requires_technical: boolean;
  champion_helpful: boolean;
}

export const MEETING_ATTENDEE_CONFIG: Record<MeetingType, MeetingAttendeeConfig> = {
  discovery: {
    optimal_min: 1,
    optimal_max: 2,
    requires_decision_maker: false,
    requires_technical: false,
    champion_helpful: true,
  },
  demo: {
    optimal_min: 2,
    optimal_max: 4,
    requires_decision_maker: true,
    requires_technical: true,
    champion_helpful: true,
  },
  technical_deep_dive: {
    optimal_min: 1,
    optimal_max: 3,
    requires_decision_maker: false,
    requires_technical: true,
    champion_helpful: false,
  },
  pricing_negotiation: {
    optimal_min: 1,
    optimal_max: 2,
    requires_decision_maker: true,
    requires_technical: false,
    champion_helpful: true,
  },
  executive_briefing: {
    optimal_min: 1,
    optimal_max: 2,
    requires_decision_maker: true,
    requires_technical: false,
    champion_helpful: false,
  },
  implementation_planning: {
    optimal_min: 2,
    optimal_max: 4,
    requires_decision_maker: false,
    requires_technical: true,
    champion_helpful: true,
  },
  check_in: {
    optimal_min: 1,
    optimal_max: 2,
    requires_decision_maker: false,
    requires_technical: false,
    champion_helpful: true,
  },
  trial_kickoff: {
    optimal_min: 2,
    optimal_max: 3,
    requires_decision_maker: false,
    requires_technical: true,
    champion_helpful: true,
  },
  follow_up: {
    optimal_min: 1,
    optimal_max: 2,
    requires_decision_maker: false,
    requires_technical: false,
    champion_helpful: true,
  },
  technical: {
    optimal_min: 1,
    optimal_max: 3,
    requires_decision_maker: false,
    requires_technical: true,
    champion_helpful: false,
  },
  executive: {
    optimal_min: 1,
    optimal_max: 2,
    requires_decision_maker: true,
    requires_technical: false,
    champion_helpful: false,
  },
  custom: {
    optimal_min: 1,
    optimal_max: 4,
    requires_decision_maker: false,
    requires_technical: false,
    champion_helpful: false,
  },
};

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Analyze a scheduling request and suggest attendee optimizations.
 */
export async function analyzeAttendees(
  schedulingRequestId: string
): Promise<AttendeeAnalysis | null> {
  const supabase = createAdminClient();

  // Get scheduling request with attendees
  const { data: request, error } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(
        id,
        contact_id,
        name,
        email,
        title,
        is_decision_maker,
        is_primary_contact,
        contact:contacts(
          id,
          name,
          title,
          is_champion,
          is_decision_maker
        )
      )
    `)
    .eq('id', schedulingRequestId)
    .single();

  if (error || !request) {
    console.error('[AttendeeOptimization] Failed to fetch request:', error);
    return null;
  }

  const meetingType = (request.meeting_type || 'discovery') as MeetingType;
  const config = MEETING_ATTENDEE_CONFIG[meetingType] || MEETING_ATTENDEE_CONFIG.discovery;

  // Transform attendees
  const currentAttendees = (request.attendees || []).map((a: {
    id: string;
    name: string;
    title?: string;
    is_decision_maker?: boolean;
    is_primary_contact?: boolean;
    contact?: {
      is_champion?: boolean;
      is_decision_maker?: boolean;
    };
  }) => ({
    id: a.id,
    name: a.name,
    title: a.title || null,
    is_decision_maker: a.is_decision_maker || a.contact?.is_decision_maker || false,
    is_champion: a.contact?.is_champion || false,
    is_primary_contact: a.is_primary_contact || false,
  }));

  // Analyze current state
  type Attendee = AttendeeAnalysis['current_attendees'][number];
  const hasDecisionMaker = currentAttendees.some((a: Attendee) => a.is_decision_maker);
  const hasChampion = currentAttendees.some((a: Attendee) => a.is_champion);
  const hasTechnical = currentAttendees.some((a: Attendee) =>
    a.title?.toLowerCase().includes('it') ||
    a.title?.toLowerCase().includes('tech') ||
    a.title?.toLowerCase().includes('engineer') ||
    a.title?.toLowerCase().includes('developer')
  );

  const attendeeCount = currentAttendees.length;
  const isOverAttended = attendeeCount > config.optimal_max;
  const isUnderAttended = attendeeCount < config.optimal_min;

  // Generate suggestions
  const suggestions = await generateSuggestions(
    request.company_id,
    meetingType,
    config,
    currentAttendees,
    {
      hasDecisionMaker,
      hasChampion,
      hasTechnical,
      isOverAttended,
      isUnderAttended,
    }
  );

  return {
    scheduling_request_id: schedulingRequestId,
    company_id: request.company_id,
    meeting_type: meetingType,
    current_attendees: currentAttendees,
    has_decision_maker: hasDecisionMaker,
    has_champion: hasChampion,
    has_technical_contact: hasTechnical,
    attendee_count: attendeeCount,
    optimal_count_range: [config.optimal_min, config.optimal_max],
    is_over_attendeed: isOverAttended,
    is_under_attendeed: isUnderAttended,
    suggestions,
    analyzed_at: new Date().toISOString(),
  };
}

// ============================================
// SUGGESTION GENERATION
// ============================================

async function generateSuggestions(
  companyId: string | null,
  meetingType: MeetingType,
  config: MeetingAttendeeConfig,
  currentAttendees: AttendeeAnalysis['current_attendees'],
  state: {
    hasDecisionMaker: boolean;
    hasChampion: boolean;
    hasTechnical: boolean;
    isOverAttended: boolean;
    isUnderAttended: boolean;
  }
): Promise<AttendeeSuggestion[]> {
  const suggestions: AttendeeSuggestion[] = [];

  // 1. Decision maker needed
  if (config.requires_decision_maker && !state.hasDecisionMaker) {
    const dm = companyId ? await findDecisionMaker(companyId, currentAttendees) : null;

    suggestions.push({
      type: 'add_decision_maker',
      priority: 'high',
      confidence: 0.9,
      suggested_contact_id: dm?.id,
      suggested_contact_name: dm?.name,
      suggested_contact_title: dm?.title ?? undefined,
      reason: `${meetingType} meetings typically require a decision maker`,
      expected_impact: 'Faster deal progression and reduced back-and-forth',
    });
  }

  // 2. Technical resource needed
  if (config.requires_technical && !state.hasTechnical) {
    const tech = companyId ? await findTechnicalContact(companyId, currentAttendees) : null;

    suggestions.push({
      type: 'add_technical_resource',
      priority: 'medium',
      confidence: 0.75,
      suggested_contact_id: tech?.id,
      suggested_contact_name: tech?.name,
      suggested_contact_title: tech?.title ?? undefined,
      reason: 'Technical expertise needed for implementation discussion',
      expected_impact: 'Better technical evaluation and fewer follow-up questions',
    });
  }

  // 3. Champion helpful but missing
  if (config.champion_helpful && !state.hasChampion && currentAttendees.length > 0) {
    const champion = companyId ? await findChampion(companyId, currentAttendees) : null;

    if (champion) {
      suggestions.push({
        type: 'add_champion',
        priority: 'medium',
        confidence: 0.7,
        suggested_contact_id: champion.id,
        suggested_contact_name: champion.name,
        suggested_contact_title: champion.title ?? undefined,
        reason: 'Internal advocate can help drive meeting outcomes',
        expected_impact: 'Higher meeting engagement and follow-through',
      });
    }
  }

  // 4. Too many attendees
  if (state.isOverAttended) {
    const nonEssential = findNonEssentialAttendees(currentAttendees, meetingType);

    if (nonEssential.length > 0) {
      for (const attendee of nonEssential.slice(0, 2)) {
        suggestions.push({
          type: 'remove_unnecessary',
          priority: 'low',
          confidence: 0.6,
          current_contact_id: attendee.id,
          current_contact_name: attendee.name,
          reason: `Meeting may be more focused with fewer attendees (currently ${currentAttendees.length}, optimal: ${config.optimal_max})`,
          expected_impact: 'More efficient meeting with better engagement',
        });
      }
    }

    suggestions.push({
      type: 'reduce_attendee_count',
      priority: 'medium',
      confidence: 0.7,
      reason: `${currentAttendees.length} attendees exceeds recommended maximum of ${config.optimal_max}`,
      expected_impact: 'Easier to schedule and more productive meeting',
    });
  }

  // 5. Single attendee needs backup
  if (currentAttendees.length === 1 && config.optimal_min >= 2) {
    const backup = companyId ? await findBackupContact(companyId, currentAttendees, meetingType) : null;

    if (backup) {
      suggestions.push({
        type: 'add_backup_contact',
        priority: 'medium',
        confidence: 0.65,
        suggested_contact_id: backup.id,
        suggested_contact_name: backup.name,
        suggested_contact_title: backup.title ?? undefined,
        reason: 'Having multiple stakeholders improves meeting outcomes',
        expected_impact: 'Reduced risk of single-point-of-failure and better internal alignment',
      });
    }
  }

  // Sort by priority and confidence
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.confidence - a.confidence;
  });
}

// ============================================
// CONTACT FINDING HELPERS
// ============================================

async function findDecisionMaker(
  companyId: string,
  exclude: Array<{ id: string }>
): Promise<{ id: string; name: string; title: string | null } | null> {
  const supabase = createAdminClient();

  const excludeIds = exclude.map(a => a.id);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title')
    .eq('company_id', companyId)
    .eq('is_decision_maker', true)
    .not('id', 'in', `(${excludeIds.join(',') || 'null'})`)
    .limit(1);

  if (contacts && contacts.length > 0) {
    return contacts[0];
  }

  // Fallback: look for executive titles
  const { data: execs } = await supabase
    .from('contacts')
    .select('id, name, title')
    .eq('company_id', companyId)
    .not('id', 'in', `(${excludeIds.join(',') || 'null'})`)
    .or('title.ilike.%owner%,title.ilike.%ceo%,title.ilike.%president%,title.ilike.%vp%,title.ilike.%director%')
    .limit(1);

  return execs?.[0] || null;
}

async function findTechnicalContact(
  companyId: string,
  exclude: Array<{ id: string }>
): Promise<{ id: string; name: string; title: string | null } | null> {
  const supabase = createAdminClient();

  const excludeIds = exclude.map(a => a.id);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title')
    .eq('company_id', companyId)
    .not('id', 'in', `(${excludeIds.join(',') || 'null'})`)
    .or('title.ilike.%it%,title.ilike.%tech%,title.ilike.%engineer%,title.ilike.%developer%,title.ilike.%systems%')
    .limit(1);

  return contacts?.[0] || null;
}

async function findChampion(
  companyId: string,
  exclude: Array<{ id: string }>
): Promise<{ id: string; name: string; title: string | null } | null> {
  const supabase = createAdminClient();

  const excludeIds = exclude.map(a => a.id);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title')
    .eq('company_id', companyId)
    .eq('is_champion', true)
    .not('id', 'in', `(${excludeIds.join(',') || 'null'})`)
    .limit(1);

  return contacts?.[0] || null;
}

async function findBackupContact(
  companyId: string,
  exclude: Array<{ id: string }>,
  meetingType: MeetingType
): Promise<{ id: string; name: string; title: string | null } | null> {
  const supabase = createAdminClient();

  const excludeIds = exclude.map(a => a.id);

  // Look for someone related to the meeting type
  let titleFilter = '';
  switch (meetingType) {
    case 'technical_deep_dive':
    case 'implementation_planning':
      titleFilter = 'title.ilike.%it%,title.ilike.%tech%,title.ilike.%operations%';
      break;
    case 'pricing_negotiation':
    case 'executive_briefing':
      titleFilter = 'title.ilike.%owner%,title.ilike.%manager%,title.ilike.%director%';
      break;
    default:
      titleFilter = 'title.ilike.%manager%,title.ilike.%coordinator%';
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title')
    .eq('company_id', companyId)
    .not('id', 'in', `(${excludeIds.join(',') || 'null'})`)
    .or(titleFilter)
    .limit(1);

  if (contacts && contacts.length > 0) {
    return contacts[0];
  }

  // Fallback: any contact
  const { data: anyContact } = await supabase
    .from('contacts')
    .select('id, name, title')
    .eq('company_id', companyId)
    .not('id', 'in', `(${excludeIds.join(',') || 'null'})`)
    .limit(1);

  return anyContact?.[0] || null;
}

function findNonEssentialAttendees(
  attendees: AttendeeAnalysis['current_attendees'],
  meetingType: MeetingType
): AttendeeAnalysis['current_attendees'] {
  // Don't suggest removing primary contact, decision makers, or champions
  return attendees.filter(a =>
    !a.is_primary_contact &&
    !a.is_decision_maker &&
    !a.is_champion
  );
}

// ============================================
// SUGGESTION PERSISTENCE
// ============================================

/**
 * Save suggestions to the database.
 */
export async function saveSuggestions(
  schedulingRequestId: string,
  suggestions: AttendeeSuggestion[]
): Promise<void> {
  const supabase = createAdminClient();

  for (const suggestion of suggestions) {
    await supabase.from('attendee_optimization_suggestions').insert({
      scheduling_request_id: schedulingRequestId,
      suggestion_type: suggestion.type,
      contact_id: suggestion.current_contact_id,
      suggested_contact_id: suggestion.suggested_contact_id,
      reason: suggestion.reason,
      confidence: suggestion.confidence,
      impact: suggestion.priority,
      status: 'pending',
    });
  }
}

/**
 * Apply a suggestion (add/remove attendee).
 */
export async function applySuggestion(
  suggestionId: string,
  appliedBy: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Get the suggestion
  const { data: suggestion, error: fetchError } = await supabase
    .from('attendee_optimization_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) {
    return { success: false, error: 'Suggestion not found' };
  }

  if (suggestion.status !== 'pending') {
    return { success: false, error: 'Suggestion already processed' };
  }

  try {
    // Apply based on type
    switch (suggestion.suggestion_type) {
      case 'add_decision_maker':
      case 'add_technical_resource':
      case 'add_champion':
      case 'add_backup_contact':
        if (suggestion.suggested_contact_id) {
          // Get contact details
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, email, title')
            .eq('id', suggestion.suggested_contact_id)
            .single();

          if (contact) {
            await supabase.from('scheduling_attendees').insert({
              scheduling_request_id: suggestion.scheduling_request_id,
              contact_id: suggestion.suggested_contact_id,
              name: contact.name,
              email: contact.email,
              title: contact.title,
              is_primary_contact: false,
            });
          }
        }
        break;

      case 'remove_unnecessary':
        if (suggestion.contact_id) {
          await supabase
            .from('scheduling_attendees')
            .delete()
            .eq('scheduling_request_id', suggestion.scheduling_request_id)
            .eq('contact_id', suggestion.contact_id);
        }
        break;

      case 'reduce_attendee_count':
        // This is an advisory suggestion, not directly applicable
        break;
    }

    // Mark suggestion as applied
    await supabase
      .from('attendee_optimization_suggestions')
      .update({
        status: 'accepted',
        processed_at: new Date().toISOString(),
        processed_by: appliedBy,
      })
      .eq('id', suggestionId);

    return { success: true };
  } catch (err) {
    console.error('[AttendeeOptimization] Error applying suggestion:', err);
    return { success: false, error: 'Failed to apply suggestion' };
  }
}

/**
 * Reject a suggestion.
 */
export async function rejectSuggestion(
  suggestionId: string,
  rejectedBy: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('attendee_optimization_suggestions')
    .update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: rejectedBy,
    })
    .eq('id', suggestionId);
}

// ============================================
// BATCH ANALYSIS
// ============================================

/**
 * Analyze all pending scheduling requests and generate suggestions.
 */
export async function analyzeAllPendingRequests(): Promise<{
  analyzed: number;
  suggestions_generated: number;
}> {
  const supabase = createAdminClient();

  // Get active scheduling requests
  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('id')
    .in('status', ['initiated', 'proposing', 'awaiting_response', 'negotiating'])
    .limit(50);

  if (!requests || requests.length === 0) {
    return { analyzed: 0, suggestions_generated: 0 };
  }

  let totalSuggestions = 0;

  for (const request of requests) {
    const analysis = await analyzeAttendees(request.id);
    if (analysis && analysis.suggestions.length > 0) {
      await saveSuggestions(request.id, analysis.suggestions);
      totalSuggestions += analysis.suggestions.length;
    }
  }

  return {
    analyzed: requests.length,
    suggestions_generated: totalSuggestions,
  };
}
