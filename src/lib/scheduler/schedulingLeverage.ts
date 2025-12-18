/**
 * Scheduling Leverage Moments
 *
 * Scheduling-specific triggers for Human Leverage Moments.
 * These detect when human intervention is needed for scheduling issues
 * and generate actionable briefs.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingRequest, SCHEDULING_STATUS, ACTION_TYPES } from './types';
import { computeSchedulingIntelligence, SchedulingIntelligence } from './schedulingIntelligence';

// ============================================
// TYPES
// ============================================

export type SchedulingLeverageTrigger =
  | 'persistent_non_response'
  | 'executive_scheduling_stall'
  | 'multiple_no_shows'
  | 'intent_collapse'
  | 'phone_call_needed'
  | 'complex_conflict'
  | 'champion_intervention';

export interface SchedulingLeverageConfig {
  condition: (req: SchedulingRequest, intel: SchedulingIntelligence | null) => boolean;
  urgency: 'immediate' | 'today' | 'this_week' | 'before_next_milestone';
  requiredRole: 'rep' | 'sales_manager' | 'exec' | 'founder';
  briefTemplate: SchedulingBriefTemplate;
}

export interface SchedulingBriefTemplate {
  situation: string;
  whyItMatters: string;
  whatAiDid: string;
  whatHumanMustDo: string;
  whyHuman: string;
  talkingPoints: string[];
  avoid: string[];
  successCriteria: string;
  ifUnsuccessful: string;
}

export interface SchedulingLeverageMoment {
  scheduling_request_id: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  trigger_type: SchedulingLeverageTrigger;
  urgency: string;
  required_role: string;
  brief: GeneratedBrief;
  created_at: string;
}

export interface GeneratedBrief {
  situation: string;
  whyItMatters: string;
  whatAiDid: string;
  whatHumanMustDo: string;
  whyHuman: string;
  talkingPoints: string[];
  dataPoints: Array<{ label: string; value: string }>;
  avoid: string[];
  successCriteria: string;
  ifUnsuccessful: string;
}

// ============================================
// SCHEDULING LEVERAGE TRIGGERS
// ============================================

export const SCHEDULING_LEVERAGE_TRIGGERS: Record<SchedulingLeverageTrigger, SchedulingLeverageConfig> = {
  persistent_non_response: {
    condition: (req, intel) =>
      req.attempt_count >= 3 &&
      !hasRecentResponse(req, 72) &&
      req.status === SCHEDULING_STATUS.AWAITING_RESPONSE,
    urgency: 'today',
    requiredRole: 'rep',
    briefTemplate: {
      situation: '{{contact_name}} has received {{attempt_count}} scheduling emails but hasn\'t responded in {{days_since_response}} days.',
      whyItMatters: 'They may be interested (opening emails) but something is blocking commitment. Human touch needed to break through.',
      whatAiDid: 'Sent {{attempt_count}} scheduling emails with varied times and approaches. Tried {{channels_used}}.',
      whatHumanMustDo: 'Call {{contact_name}} directly. The AI has warmed them up — now close the loop personally.',
      whyHuman: 'Voice communication breaks through when email fails. Your personal call shows commitment and builds rapport that reopens doors.',
      talkingPoints: [
        '"Hey {{contact_name}}, I saw my assistant was trying to grab time for that {{meeting_type}}."',
        '"I figured it\'s easier if I just gave you a quick ring."',
        '"Is now an OK time, or should I try back later today?"',
        '"What time works best for your schedule this week?"',
      ],
      avoid: [
        'Don\'t apologize for the follow-ups — you\'re being persistent, not annoying',
        'Avoid "did you get my email?" — sounds passive',
        'Don\'t pressure — give them an easy out if timing is wrong',
      ],
      successCriteria: 'Meeting scheduled or clear next step agreed within 48 hours',
      ifUnsuccessful: 'If no response after call attempt, pause scheduling for 2 weeks and try again with a different approach.',
    },
  },

  executive_scheduling_stall: {
    condition: (req, intel) =>
      isExecutiveMeeting(req) &&
      req.attempt_count >= 2 &&
      req.status === SCHEDULING_STATUS.AWAITING_RESPONSE,
    urgency: 'today',
    requiredRole: 'sales_manager',
    briefTemplate: {
      situation: 'Executive meeting with {{contact_name}} ({{contact_title}}) at {{company_name}} is stalled. {{attempt_count}} scheduling attempts without response.',
      whyItMatters: 'Executive time is scarce. Extended delays signal deprioritization or gatekeeper interference. This could indicate deal risk.',
      whatAiDid: 'Sent {{attempt_count}} professional scheduling requests via email. Executive has not engaged with scheduling.',
      whatHumanMustDo: 'Have rep\'s manager reach out peer-to-peer, or find an internal champion to facilitate the introduction.',
      whyHuman: 'Executives respond to peer-level outreach. Your manager\'s involvement signals importance and bypasses gatekeepers appropriately.',
      talkingPoints: [
        '"My team has been trying to connect — wanted to reach out directly given the strategic importance"',
        '"I understand your time is valuable. Even a brief 15-minute call would be helpful"',
        '"Is there someone on your team who handles initial evaluations?"',
      ],
      avoid: [
        'Don\'t keep sending rep-level emails — it looks desperate',
        'Avoid creating artificial urgency with executives',
        'Don\'t CC too many people — keep it focused',
      ],
      successCriteria: 'Executive responds or delegates to appropriate team member within 5 business days',
      ifUnsuccessful: 'If no response, this may not be the right entry point. Consider alternative paths into the organization.',
    },
  },

  multiple_no_shows: {
    condition: (req) => req.no_show_count >= 2,
    urgency: 'immediate',
    requiredRole: 'rep',
    briefTemplate: {
      situation: '{{contact_name}} has no-showed {{no_show_count}} scheduled meetings. The most recent was on {{last_no_show_date}}.',
      whyItMatters: 'Multiple no-shows indicate either disinterest, poor timing, or process issues. Continuing to schedule without addressing this wastes everyone\'s time.',
      whatAiDid: 'Scheduled and sent reminders for {{no_show_count}} meetings. All were missed without prior notice.',
      whatHumanMustDo: 'Call {{contact_name}} immediately to understand what\'s happening and whether to continue pursuing this meeting.',
      whyHuman: 'A direct conversation uncovers whether this is timing, interest, or something else. Your judgment determines if this is worth continuing.',
      talkingPoints: [
        '"{{contact_name}}, I noticed we\'ve had some trouble connecting for our scheduled calls"',
        '"I want to make sure I\'m not catching you at bad times — what works better?"',
        '"Is this still something you\'re interested in, or has something changed?"',
        '"I\'d rather know if now isn\'t the right time than keep booking meetings that don\'t happen"',
      ],
      avoid: [
        'Don\'t be accusatory — things happen',
        'Avoid guilt-tripping — it damages the relationship',
        'Don\'t threaten to stop following up (unless you mean it)',
      ],
      successCriteria: 'Clear understanding of whether to continue and, if yes, a rescheduled meeting that actually happens',
      ifUnsuccessful: 'If they confirm disinterest or continue to no-show, pause outreach and move deal to appropriate status.',
    },
  },

  intent_collapse: {
    condition: (req, intel) =>
      intel !== null &&
      intel.scheduling_health === 'critical' &&
      req.attempt_count >= 4,
    urgency: 'today',
    requiredRole: 'rep',
    briefTemplate: {
      situation: 'Scheduling health for {{company_name}} has collapsed to critical. {{attempt_count}} attempts, {{success_probability}}% success probability.',
      whyItMatters: 'This deal\'s scheduling behavior indicates severe disengagement. Without intervention, this opportunity will be lost.',
      whatAiDid: 'Sent {{attempt_count}} scheduling requests across {{channels_used}}. Detected declining engagement pattern.',
      whatHumanMustDo: 'Make a direct call to salvage the relationship. Be prepared to either re-engage or gracefully exit.',
      whyHuman: 'AI has exhausted automated approaches. Human judgment needed to determine if this opportunity is worth saving.',
      talkingPoints: [
        '"I wanted to reach out personally because I sensed some disconnect"',
        '"Have your priorities shifted since we last spoke?"',
        '"Is there something about our solution that\'s giving you pause?"',
        '"I\'d rather understand what\'s happening than keep reaching out blindly"',
      ],
      avoid: [
        'Don\'t sound desperate — you\'re offering value, not begging',
        'Avoid blaming them for not responding',
        'Don\'t make promises you can\'t keep to save the deal',
      ],
      successCriteria: 'Clear path forward: either re-engaged with scheduled meeting, or graceful exit with door open for future',
      ifUnsuccessful: 'Mark opportunity as lost/paused. Document learnings. Set reminder for 3-6 month re-engagement.',
    },
  },

  phone_call_needed: {
    condition: (req) =>
      req.current_channel === 'phone' ||
      !!(req.channel_progression?.channels_used?.includes('sms') &&
       req.attempt_count >= 4),
    urgency: 'today',
    requiredRole: 'rep',
    briefTemplate: {
      situation: 'Email and SMS have not worked for {{contact_name}}. Direct phone call is needed.',
      whyItMatters: 'Some people simply don\'t respond to written communication. A call is the only way to move forward.',
      whatAiDid: 'Sent {{attempt_count}} messages via email and SMS. No engagement on scheduling.',
      whatHumanMustDo: 'Call {{contact_name}} at {{phone_number}} to schedule directly.',
      whyHuman: 'AI cannot make phone calls. This requires human voice communication.',
      talkingPoints: [
        '"Hi {{contact_name}}, this is [Rep Name]. I\'ve been trying to schedule that {{meeting_type}} we discussed"',
        '"Do you have your calendar handy? I just need 30 seconds to find a time"',
        '"What day this week works for a quick 15-minute call?"',
      ],
      avoid: [
        'Don\'t read a script — be natural',
        'Avoid long voicemails — keep it under 30 seconds',
        'Don\'t call at obviously bad times (early morning, late evening)',
      ],
      successCriteria: 'Meeting scheduled during the call or clear callback time agreed',
      ifUnsuccessful: 'Leave a brief voicemail and try again in 24-48 hours. Consider texting "just left you a voicemail about scheduling".',
    },
  },

  complex_conflict: {
    condition: (req) =>
      req.status === SCHEDULING_STATUS.NEGOTIATING &&
      hasConflictHistory(req, 3),
    urgency: 'this_week',
    requiredRole: 'rep',
    briefTemplate: {
      situation: '{{contact_name}} has had {{conflict_count}} scheduling conflicts. Finding mutually available time is proving difficult.',
      whyItMatters: 'Prolonged scheduling friction can kill deal momentum. Resolution requires flexibility beyond AI capabilities.',
      whatAiDid: 'Proposed {{times_proposed}} different time slots. {{conflict_count}} conflicts encountered.',
      whatHumanMustDo: 'Call to find a time that works, even if non-standard (early morning, lunch, after hours).',
      whyHuman: 'Complex scheduling requires real-time negotiation and creative solutions that AI cannot provide.',
      talkingPoints: [
        '"I know we\'ve had some trouble finding a time that works — let me see if we can solve this together"',
        '"I\'m flexible — would an early morning or lunch time work better?"',
        '"Would it help to do a shorter call first?"',
        '"I can work around your schedule — what\'s your busiest time to avoid?"',
      ],
      avoid: [
        'Don\'t keep proposing the same types of times',
        'Avoid frustration in your voice',
        'Don\'t make them feel like they\'re difficult',
      ],
      successCriteria: 'Meeting scheduled, even if at non-standard time',
      ifUnsuccessful: 'Offer to check back in a week when their schedule might be clearer.',
    },
  },

  champion_intervention: {
    condition: (req, intel) =>
      req.attempt_count >= 3 &&
      hasChampion(req) &&
      !hasRecentResponse(req, 96),
    urgency: 'this_week',
    requiredRole: 'rep',
    briefTemplate: {
      situation: 'Primary contact {{contact_name}} is unresponsive, but we have a champion ({{champion_name}}) who can help.',
      whyItMatters: 'Champions can unblock scheduling by applying internal pressure or providing alternative contacts.',
      whatAiDid: 'Sent {{attempt_count}} scheduling requests to primary contact without response.',
      whatHumanMustDo: 'Reach out to champion {{champion_name}} to ask for help scheduling or an alternative contact.',
      whyHuman: 'Leveraging champion relationships requires human judgment on timing and approach.',
      talkingPoints: [
        '"{{champion_name}}, I\'ve been trying to schedule with {{contact_name}} but haven\'t been able to connect"',
        '"Would you mind giving them a nudge, or is there someone else I should reach out to?"',
        '"I don\'t want to keep bothering them if timing is off"',
      ],
      avoid: [
        'Don\'t make the champion feel responsible for the other person',
        'Avoid complaining about the unresponsive contact',
        'Don\'t overuse this approach — save champion capital',
      ],
      successCriteria: 'Champion provides assistance and scheduling unblocks within 5 business days',
      ifUnsuccessful: 'If champion can\'t help, may indicate organizational priority issues. Reassess deal health.',
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function hasRecentResponse(req: SchedulingRequest, withinHours: number): boolean {
  if (!req.actions || req.actions.length === 0) return false;

  const now = Date.now();
  const cutoff = now - (withinHours * 60 * 60 * 1000);

  return req.actions.some(a =>
    (a.action_type === ACTION_TYPES.EMAIL_RECEIVED ||
     a.action_type === ACTION_TYPES.SMS_RECEIVED) &&
    new Date(a.created_at).getTime() > cutoff
  );
}

function isExecutiveMeeting(req: SchedulingRequest): boolean {
  // Check meeting type
  if (req.meeting_type === 'executive_briefing') return true;

  // Check attendee titles
  const execTitles = ['ceo', 'president', 'owner', 'founder', 'vp', 'vice president', 'director', 'cfo', 'coo'];
  return req.attendees?.some(a =>
    a.title && execTitles.some(t => a.title?.toLowerCase().includes(t))
  ) || false;
}

function hasConflictHistory(req: SchedulingRequest, minConflicts: number): boolean {
  if (!req.actions) return false;

  const conflictCount = req.actions.filter(a =>
    a.ai_reasoning?.includes('conflict') ||
    a.ai_reasoning?.includes('unavailable')
  ).length;

  return conflictCount >= minConflicts;
}

function hasChampion(req: SchedulingRequest): boolean {
  // This would check if the company has an identified champion
  // For now, check if any attendee is marked as champion in the system
  return false; // Placeholder - would need to query contacts
}

// ============================================
// MAIN CHECK FUNCTION
// ============================================

/**
 * Check a scheduling request for leverage moment triggers.
 */
export async function checkSchedulingLeverageMoments(
  requestId: string
): Promise<SchedulingLeverageMoment | null> {
  const supabase = createAdminClient();

  // Get the scheduling request with all related data
  const { data: request, error } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(*),
      actions:scheduling_actions(*)
    `)
    .eq('id', requestId)
    .single();

  if (error || !request) {
    console.error('[SchedulingLeverage] Failed to fetch request:', error);
    return null;
  }

  const typedRequest = request as SchedulingRequest;

  // Get scheduling intelligence
  const intel = await computeSchedulingIntelligence(requestId);

  // Check each trigger
  for (const [triggerType, config] of Object.entries(SCHEDULING_LEVERAGE_TRIGGERS)) {
    if (config.condition(typedRequest, intel)) {
      // Generate the brief
      const brief = await generateSchedulingBrief(
        triggerType as SchedulingLeverageTrigger,
        config,
        typedRequest,
        intel
      );

      // Get primary contact ID
      const primaryAttendee = typedRequest.attendees?.find(a => a.is_primary_contact);

      const moment: SchedulingLeverageMoment = {
        scheduling_request_id: requestId,
        deal_id: typedRequest.deal_id,
        company_id: typedRequest.company_id,
        contact_id: primaryAttendee?.contact_id || null,
        trigger_type: triggerType as SchedulingLeverageTrigger,
        urgency: config.urgency,
        required_role: config.requiredRole,
        brief,
        created_at: new Date().toISOString(),
      };

      return moment;
    }
  }

  return null;
}

/**
 * Generate a scheduling-specific leverage brief.
 */
async function generateSchedulingBrief(
  triggerType: SchedulingLeverageTrigger,
  config: SchedulingLeverageConfig,
  request: SchedulingRequest,
  intel: SchedulingIntelligence | null
): Promise<GeneratedBrief> {
  const supabase = createAdminClient();

  // Get contact and company info
  const primaryAttendee = request.attendees?.find(a => a.is_primary_contact);

  let companyName = 'the company';
  let contactName = primaryAttendee?.name || 'the contact';
  let contactTitle = primaryAttendee?.title || '';
  let phoneNumber = '';

  if (request.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', request.company_id)
      .single();
    companyName = company?.name || companyName;
  }

  if (primaryAttendee?.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone, mobile')
      .eq('id', primaryAttendee.contact_id)
      .single();
    phoneNumber = contact?.mobile || contact?.phone || '';
  }

  // Template variables
  const vars: Record<string, string> = {
    contact_name: contactName,
    contact_title: contactTitle,
    company_name: companyName,
    phone_number: phoneNumber,
    attempt_count: String(request.attempt_count),
    no_show_count: String(request.no_show_count),
    meeting_type: request.meeting_type || 'meeting',
    days_since_response: String(getDaysSinceLastResponse(request)),
    channels_used: request.channel_progression?.channels_used?.join(', ') || 'email',
    success_probability: String(intel?.success_probability || 50),
    times_proposed: String(request.proposed_times?.length || 0),
    conflict_count: String(getConflictCount(request)),
    last_no_show_date: getLastNoShowDate(request),
    champion_name: 'your champion', // Would need to look up
  };

  // Apply template variables
  const template = config.briefTemplate;

  return {
    situation: applyVars(template.situation, vars),
    whyItMatters: applyVars(template.whyItMatters, vars),
    whatAiDid: applyVars(template.whatAiDid, vars),
    whatHumanMustDo: applyVars(template.whatHumanMustDo, vars),
    whyHuman: applyVars(template.whyHuman, vars),
    talkingPoints: template.talkingPoints.map(tp => applyVars(tp, vars)),
    dataPoints: [
      { label: 'Attempts', value: vars.attempt_count },
      { label: 'Days Silent', value: vars.days_since_response },
      { label: 'Success Probability', value: `${vars.success_probability}%` },
      { label: 'Meeting Type', value: vars.meeting_type },
    ],
    avoid: template.avoid,
    successCriteria: applyVars(template.successCriteria, vars),
    ifUnsuccessful: applyVars(template.ifUnsuccessful, vars),
  };
}

function applyVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function getDaysSinceLastResponse(request: SchedulingRequest): number {
  if (!request.actions) return 999;

  const responses = request.actions.filter(a =>
    a.action_type === ACTION_TYPES.EMAIL_RECEIVED ||
    a.action_type === ACTION_TYPES.SMS_RECEIVED
  );

  if (responses.length === 0) {
    // Use created_at as baseline
    const created = new Date(request.created_at);
    return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  const lastResponse = responses.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return Math.floor(
    (Date.now() - new Date(lastResponse.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getConflictCount(request: SchedulingRequest): number {
  if (!request.actions) return 0;

  return request.actions.filter(a =>
    a.ai_reasoning?.includes('conflict')
  ).length;
}

function getLastNoShowDate(request: SchedulingRequest): string {
  if (!request.actions) return 'unknown';

  const noShows = request.actions.filter(a =>
    a.action_type === ACTION_TYPES.NO_SHOW_DETECTED
  );

  if (noShows.length === 0) return 'unknown';

  const lastNoShow = noShows.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return new Date(lastNoShow.created_at).toLocaleDateString();
}

// ============================================
// PERSISTENCE
// ============================================

/**
 * Save a scheduling leverage moment to the database.
 */
export async function saveSchedulingLeverageMoment(
  moment: SchedulingLeverageMoment
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('human_leverage_moments')
    .insert({
      company_id: moment.company_id,
      deal_id: moment.deal_id,
      contact_id: moment.contact_id,
      type: `scheduling_${moment.trigger_type}`,
      urgency: moment.urgency,
      required_role: moment.required_role,
      situation: moment.brief.situation,
      why_it_matters: moment.brief.whyItMatters,
      what_ai_did: moment.brief.whatAiDid,
      what_human_must_do: moment.brief.whatHumanMustDo,
      why_human: moment.brief.whyHuman,
      talking_points: moment.brief.talkingPoints,
      data_points: moment.brief.dataPoints,
      avoid: moment.brief.avoid,
      success_criteria: moment.brief.successCriteria,
      if_unsuccessful: moment.brief.ifUnsuccessful,
      trigger_data: {
        scheduling_request_id: moment.scheduling_request_id,
        trigger_type: moment.trigger_type,
      },
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[SchedulingLeverage] Failed to save moment:', error);
    return null;
  }

  return data.id;
}

/**
 * Check all active scheduling requests for leverage moments.
 */
export async function checkAllSchedulingLeverageMoments(): Promise<{
  checked: number;
  moments_created: number;
}> {
  const supabase = createAdminClient();

  // Get active scheduling requests
  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('id')
    .in('status', [
      SCHEDULING_STATUS.AWAITING_RESPONSE,
      SCHEDULING_STATUS.NEGOTIATING,
      SCHEDULING_STATUS.PROPOSING,
    ])
    .order('updated_at', { ascending: true })
    .limit(50);

  if (!requests || requests.length === 0) {
    return { checked: 0, moments_created: 0 };
  }

  let momentsCreated = 0;

  for (const req of requests) {
    const moment = await checkSchedulingLeverageMoments(req.id);

    if (moment) {
      // Check if we already have a pending moment for this request
      const { data: existing } = await supabase
        .from('human_leverage_moments')
        .select('id')
        .eq('trigger_data->>scheduling_request_id', req.id)
        .eq('status', 'pending')
        .single();

      if (!existing) {
        await saveSchedulingLeverageMoment(moment);
        momentsCreated++;
      }
    }
  }

  return {
    checked: requests.length,
    moments_created: momentsCreated,
  };
}
