/**
 * Scheduling Service
 *
 * Core service for managing scheduling requests with state machine logic.
 * Handles creation, state transitions, and orchestrates the scheduling workflow.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SchedulingRequest,
  SchedulingAttendee,
  SchedulingAction,
  SchedulingStatus,
  ActionType,
  CreateSchedulingRequestInput,
  UpdateSchedulingRequestInput,
  SCHEDULING_STATUS,
  ACTION_TYPES,
  ATTENDEE_SIDE,
  INVITE_STATUS,
  SchedulingRequestSummary,
  SchedulerDashboardData,
} from './types';
import {
  generateSchedulingEmail,
  generateProposedTimes,
  formatTimeSlotsForEmail,
  EmailType,
} from './emailGeneration';
import { getRealAvailableSlots, getMultiAttendeeAvailability } from './calendarIntegration';
import { sendEmail } from '@/lib/microsoft/emailSync';
import { getValidToken } from '@/lib/microsoft/auth';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';

// ============================================
// ACTIVE STATUSES (non-terminal - used for duplicate detection)
// ============================================

const ACTIVE_STATUSES: SchedulingStatus[] = [
  SCHEDULING_STATUS.INITIATED,
  SCHEDULING_STATUS.PROPOSING,
  SCHEDULING_STATUS.AWAITING_RESPONSE,
  SCHEDULING_STATUS.NEGOTIATING,
  SCHEDULING_STATUS.CONFIRMING,
  SCHEDULING_STATUS.PAUSED,
  SCHEDULING_STATUS.REMINDER_SENT,
];

// ============================================
// STATE MACHINE DEFINITION
// ============================================

/**
 * Valid state transitions for the scheduling state machine.
 * Maps current state -> allowed next states
 */
const STATE_TRANSITIONS: Record<SchedulingStatus, SchedulingStatus[]> = {
  [SCHEDULING_STATUS.INITIATED]: [
    SCHEDULING_STATUS.PROPOSING,
    SCHEDULING_STATUS.CANCELLED,
    SCHEDULING_STATUS.PAUSED,
  ],
  [SCHEDULING_STATUS.PROPOSING]: [
    SCHEDULING_STATUS.AWAITING_RESPONSE,
    SCHEDULING_STATUS.CANCELLED,
    SCHEDULING_STATUS.PAUSED,
  ],
  [SCHEDULING_STATUS.AWAITING_RESPONSE]: [
    SCHEDULING_STATUS.NEGOTIATING,
    SCHEDULING_STATUS.CONFIRMING,
    SCHEDULING_STATUS.PROPOSING, // Re-propose if times rejected
    SCHEDULING_STATUS.CANCELLED,
    SCHEDULING_STATUS.PAUSED,
  ],
  [SCHEDULING_STATUS.NEGOTIATING]: [
    SCHEDULING_STATUS.CONFIRMING,
    SCHEDULING_STATUS.PROPOSING,
    SCHEDULING_STATUS.CANCELLED,
    SCHEDULING_STATUS.PAUSED,
  ],
  [SCHEDULING_STATUS.CONFIRMING]: [
    SCHEDULING_STATUS.CONFIRMED,
    SCHEDULING_STATUS.NEGOTIATING, // If invite declined
    SCHEDULING_STATUS.CANCELLED,
    SCHEDULING_STATUS.PAUSED,
  ],
  [SCHEDULING_STATUS.CONFIRMED]: [
    SCHEDULING_STATUS.REMINDER_SENT,
    SCHEDULING_STATUS.COMPLETED,
    SCHEDULING_STATUS.NO_SHOW,
    SCHEDULING_STATUS.CANCELLED,
  ],
  [SCHEDULING_STATUS.REMINDER_SENT]: [
    SCHEDULING_STATUS.COMPLETED,
    SCHEDULING_STATUS.NO_SHOW,
    SCHEDULING_STATUS.CANCELLED,
  ],
  [SCHEDULING_STATUS.COMPLETED]: [], // Terminal state
  [SCHEDULING_STATUS.NO_SHOW]: [
    SCHEDULING_STATUS.PROPOSING, // Reschedule
    SCHEDULING_STATUS.CANCELLED,
  ],
  [SCHEDULING_STATUS.CANCELLED]: [], // Terminal state
  [SCHEDULING_STATUS.PAUSED]: [
    SCHEDULING_STATUS.INITIATED,
    SCHEDULING_STATUS.PROPOSING,
    SCHEDULING_STATUS.AWAITING_RESPONSE,
    SCHEDULING_STATUS.CANCELLED,
  ],
};

// ============================================
// SERVICE CLASS
// ============================================

export class SchedulingService {
  private useAdmin: boolean;

  constructor(options?: { useAdmin?: boolean }) {
    this.useAdmin = options?.useAdmin ?? false;
    console.log('[SchedulingService] Constructor called with options:', options, '=> useAdmin:', this.useAdmin);
  }

  private async getClient() {
    console.log('[SchedulingService.getClient] useAdmin:', this.useAdmin);
    if (this.useAdmin) {
      const client = createAdminClient();
      console.log('[SchedulingService.getClient] Created admin client');
      return client;
    } else {
      const client = await createClient();
      console.log('[SchedulingService.getClient] Created regular client');
      return client;
    }
  }

  // ============================================
  // DUPLICATE PREVENTION
  // ============================================

  /**
   * Check if an active scheduling request already exists for any of the given emails
   * Returns the existing request if found, null otherwise
   */
  async checkForDuplicateRequest(
    externalEmails: string[]
  ): Promise<{ id: string; title: string | null; status: string } | null> {
    if (externalEmails.length === 0) return null;

    const supabase = await this.getClient();

    // Find scheduling requests where any of these emails are external attendees
    // and the request is in an active (non-terminal) status
    const { data: existingRequests, error } = await supabase
      .from('scheduling_attendees')
      .select(`
        scheduling_request_id,
        email,
        scheduling_requests!inner(id, title, status)
      `)
      .eq('side', 'external')
      .in('email', externalEmails.map(e => e.toLowerCase()))
      .in('scheduling_requests.status', ACTIVE_STATUSES);

    if (error) {
      console.error('[SchedulingService] Error checking for duplicates:', error);
      return null; // Don't block creation on error, just log
    }

    if (existingRequests && existingRequests.length > 0) {
      const request = existingRequests[0].scheduling_requests as unknown as {
        id: string;
        title: string | null;
        status: string;
      };
      console.log('[SchedulingService] Found existing active request:', request.id);
      return request;
    }

    return null;
  }

  // ============================================
  // CREATE OPERATIONS
  // ============================================

  /**
   * Creates a new scheduling request with attendees
   */
  async createSchedulingRequest(
    input: CreateSchedulingRequestInput,
    createdBy: string
  ): Promise<{ data: SchedulingRequest | null; error: string | null }> {
    const supabase = await this.getClient();

    try {
      // Check for duplicate requests before creating
      const externalEmails = input.external_attendees.map(a => a.email);
      const existingRequest = await this.checkForDuplicateRequest(externalEmails);

      if (existingRequest) {
        return {
          data: null,
          error: `An active scheduling request already exists for this contact (ID: ${existingRequest.id}, Title: "${existingRequest.title || 'Untitled'}", Status: ${existingRequest.status}). Please use the existing request or cancel it first.`,
        };
      }

      // 1. Create the scheduling request
      const { data: request, error: requestError } = await supabase
        .from('scheduling_requests')
        .insert({
          created_by: createdBy,
          deal_id: input.deal_id || null,
          company_id: input.company_id || null,
          source_communication_id: input.source_communication_id || null,
          meeting_type: input.meeting_type,
          duration_minutes: input.duration_minutes,
          title: input.title || null,
          context: input.context || null,
          meeting_platform: input.meeting_platform,
          meeting_location: input.meeting_location || null,
          date_range_start: input.date_range_start,
          date_range_end: input.date_range_end,
          preferred_times: input.preferred_times || {
            morning: true,
            afternoon: true,
            evening: false,
          },
          avoid_days: input.avoid_days || [],
          timezone: input.timezone || 'America/New_York',
          status: SCHEDULING_STATUS.INITIATED,
        })
        .select()
        .single();

      if (requestError) {
        console.error('Error creating scheduling request:', requestError);
        return { data: null, error: requestError.message };
      }

      // 2. Create internal attendees - fetch user info
      const userIds = input.internal_attendees.map(a => a.user_id);
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      const userMap = new Map((usersData || []).map(u => [u.id, u]));

      const internalAttendees = input.internal_attendees.map((attendee) => {
        const user = userMap.get(attendee.user_id);
        return {
          scheduling_request_id: request.id,
          side: ATTENDEE_SIDE.INTERNAL,
          user_id: attendee.user_id,
          name: user?.name || null,
          email: user?.email || '',
          is_organizer: attendee.is_organizer ?? false,
          is_required: true,
          invite_status: INVITE_STATUS.PENDING,
        };
      });

      // 3. Create external attendees
      const externalAttendees = input.external_attendees.map((attendee) => ({
        scheduling_request_id: request.id,
        side: ATTENDEE_SIDE.EXTERNAL,
        contact_id: attendee.contact_id || null,
        name: attendee.name,
        email: attendee.email,
        title: attendee.title || null,
        is_primary_contact: attendee.is_primary_contact ?? false,
        is_required: true,
        invite_status: INVITE_STATUS.PENDING,
      }));

      const allAttendees = [...internalAttendees, ...externalAttendees];

      if (allAttendees.length > 0) {
        const { error: attendeesError } = await supabase
          .from('scheduling_attendees')
          .insert(allAttendees);

        if (attendeesError) {
          console.error('Error creating attendees:', attendeesError);
          // Don't fail the whole request, but log it
        }
      }

      // 4. Log the creation action
      await this.logAction(request.id, {
        action_type: ACTION_TYPES.STATUS_CHANGED,
        previous_status: null,
        new_status: SCHEDULING_STATUS.INITIATED,
        actor: 'user',
        actor_id: createdBy,
        ai_reasoning: 'Scheduling request created by user',
      });

      return { data: request as SchedulingRequest, error: null };
    } catch (err) {
      console.error('Unexpected error creating scheduling request:', err);
      return { data: null, error: 'Unexpected error occurred' };
    }
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Gets a scheduling request by ID with all related data
   */
  async getSchedulingRequest(
    id: string
  ): Promise<{ data: SchedulingRequest | null; error: string | null }> {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from('scheduling_requests')
      .select(
        `
        *,
        attendees:scheduling_attendees(*),
        actions:scheduling_actions(*),
        company:companies(id, name),
        deal:deals(id, name),
        source_communication:communications!source_communication_id(
          id,
          subject,
          channel,
          direction,
          occurred_at,
          content_preview
        )
      `
      )
      .eq('id', id)
      .order('created_at', { referencedTable: 'scheduling_actions', ascending: false })
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as SchedulingRequest, error: null };
  }

  /**
   * Gets all scheduling requests for a user
   */
  async getSchedulingRequests(filters?: {
    status?: SchedulingStatus[];
    deal_id?: string;
    company_id?: string;
    limit?: number;
  }): Promise<{ data: SchedulingRequest[]; error: string | null }> {
    const supabase = await this.getClient();

    let query = supabase
      .from('scheduling_requests')
      .select(
        `
        *,
        attendees:scheduling_attendees(*),
        company:companies(id, name),
        deal:deals(id, name)
      `
      )
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.deal_id) {
      query = query.eq('deal_id', filters.deal_id);
    }
    if (filters?.company_id) {
      query = query.eq('company_id', filters.company_id);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data as SchedulingRequest[], error: null };
  }

  /**
   * Reconciles confirmed meetings with calendar - marks cancelled if event no longer exists
   */
  private async reconcileCancelledMeetings(): Promise<void> {
    try {
      const supabase = await this.getClient();

      // Get confirmed requests with calendar_event_id and created_by
      const { data: confirmedWithEvents } = await supabase
        .from('scheduling_requests')
        .select('id, calendar_event_id, created_by')
        .in('status', [SCHEDULING_STATUS.CONFIRMED, SCHEDULING_STATUS.REMINDER_SENT])
        .not('calendar_event_id', 'is', null);

      if (!confirmedWithEvents || confirmedWithEvents.length === 0) {
        return;
      }

      // Group by creator to minimize token lookups
      const byCreator = new Map<string, typeof confirmedWithEvents>();
      for (const req of confirmedWithEvents) {
        if (!req.created_by) continue;
        const list = byCreator.get(req.created_by) || [];
        list.push(req);
        byCreator.set(req.created_by, list);
      }

      // Check each creator's events
      for (const [userId, requests] of byCreator) {
        try {
          const token = await getValidToken(userId);
          if (!token) continue;

          const client = new MicrosoftGraphClient(token);

          for (const req of requests) {
            try {
              await client.getEvent(req.calendar_event_id!);
              // Event exists, nothing to do
            } catch (err) {
              // Event doesn't exist or was cancelled - mark as cancelled
              const errorMessage = err instanceof Error ? err.message : String(err);
              if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('ErrorItemNotFound')) {
                console.log(`[Scheduler] Calendar event ${req.calendar_event_id} no longer exists, marking request ${req.id} as cancelled`);

                await supabase
                  .from('scheduling_requests')
                  .update({
                    status: SCHEDULING_STATUS.CANCELLED,
                    outcome: 'cancelled_from_calendar',
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', req.id);

                // Log the action
                await supabase
                  .from('scheduling_actions')
                  .insert({
                    scheduling_request_id: req.id,
                    action_type: 'calendar_cancelled',
                    actor: 'system',
                    message_content: 'Meeting was cancelled directly from calendar',
                  });
              }
            }
          }
        } catch (err) {
          console.error(`[Scheduler] Error checking calendar for user ${userId}:`, err);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error in reconcileCancelledMeetings:', err);
    }
  }

  /**
   * Gets dashboard data for the scheduler
   */
  async getDashboardData(): Promise<{
    data: SchedulerDashboardData | null;
    error: string | null;
  }> {
    const supabase = await this.getClient();

    // Reconcile cancelled meetings from calendar before fetching data
    await this.reconcileCancelledMeetings();

    // Get pending requests (initiated, proposing, awaiting_response, negotiating)
    const { data: pending, error: pendingError } = await supabase
      .from('scheduling_requests')
      .select(
        `
        id, title, meeting_type, status, scheduled_time,
        last_action_at, next_action_at, next_action_type,
        attempt_count, no_show_count, created_at,
        company:companies(name),
        attendees:scheduling_attendees(name, is_primary_contact)
      `
      )
      .in('status', [
        SCHEDULING_STATUS.INITIATED,
        SCHEDULING_STATUS.PROPOSING,
        SCHEDULING_STATUS.AWAITING_RESPONSE,
        SCHEDULING_STATUS.NEGOTIATING,
        SCHEDULING_STATUS.CONFIRMING,
      ])
      .order('created_at', { ascending: false });

    // Get confirmed requests
    const { data: confirmed, error: confirmedError } = await supabase
      .from('scheduling_requests')
      .select(
        `
        id, title, meeting_type, status, scheduled_time,
        last_action_at, next_action_at, next_action_type,
        attempt_count, no_show_count, created_at,
        company:companies(name),
        attendees:scheduling_attendees(name, is_primary_contact)
      `
      )
      .in('status', [SCHEDULING_STATUS.CONFIRMED, SCHEDULING_STATUS.REMINDER_SENT])
      .order('scheduled_time', { ascending: true });

    // Get requests needing attention (stale, no-shows, high attempt count)
    const { data: needsAttention, error: attentionError } = await supabase
      .from('scheduling_requests')
      .select(
        `
        id, title, meeting_type, status, scheduled_time,
        last_action_at, next_action_at, next_action_type,
        attempt_count, no_show_count, created_at,
        company:companies(name),
        attendees:scheduling_attendees(name, is_primary_contact)
      `
      )
      .or('no_show_count.gt.0,attempt_count.gt.3')
      .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED})`)
      .order('created_at', { ascending: false });

    // Get completed this week stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: completedStats, error: statsError } = await supabase
      .from('scheduling_requests')
      .select('outcome')
      .gte('completed_at', weekAgo.toISOString())
      .in('status', [SCHEDULING_STATUS.COMPLETED, SCHEDULING_STATUS.CANCELLED]);

    if (pendingError || confirmedError || attentionError || statsError) {
      return {
        data: null,
        error:
          pendingError?.message ||
          confirmedError?.message ||
          attentionError?.message ||
          statsError?.message ||
          'Unknown error',
      };
    }

    const mapToSummary = (item: Record<string, unknown>): SchedulingRequestSummary => {
      const company = item.company as { name: string } | null;
      const attendees = (item.attendees as Array<{ name: string; is_primary_contact: boolean }>) || [];
      const primaryContact = attendees.find((a) => a.is_primary_contact)?.name || attendees[0]?.name || 'Unknown';

      return {
        id: item.id as string,
        title: item.title as string | null,
        meeting_type: item.meeting_type as SchedulingRequestSummary['meeting_type'],
        status: item.status as SchedulingRequestSummary['status'],
        company_name: company?.name || 'Unknown',
        primary_contact: primaryContact,
        scheduled_time: item.scheduled_time as string | null,
        last_action_at: item.last_action_at as string | null,
        next_action_at: item.next_action_at as string | null,
        next_action_type: item.next_action_type as string | null,
        attempt_count: item.attempt_count as number,
        no_show_count: item.no_show_count as number,
        created_at: item.created_at as string,
      };
    };

    const heldCount = completedStats?.filter((s) => s.outcome === 'held').length || 0;
    const cancelledCount =
      completedStats?.filter((s) =>
        ['cancelled_by_us', 'cancelled_by_them', 'no_show'].includes(s.outcome || '')
      ).length || 0;

    return {
      data: {
        pending: (pending || []).map(mapToSummary),
        confirmed: (confirmed || []).map(mapToSummary),
        needs_attention: (needsAttention || []).map(mapToSummary),
        completed_this_week: {
          held: heldCount,
          cancelled: cancelledCount,
        },
      },
      error: null,
    };
  }

  // ============================================
  // UPDATE OPERATIONS
  // ============================================

  /**
   * Updates a scheduling request
   */
  async updateSchedulingRequest(
    id: string,
    input: UpdateSchedulingRequestInput,
    actorId?: string
  ): Promise<{ data: SchedulingRequest | null; error: string | null }> {
    const supabase = await this.getClient();

    // Get current state first
    const { data: current, error: fetchError } = await supabase
      .from('scheduling_requests')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    // Validate state transition if status is being changed
    if (input.status && input.status !== current.status) {
      const isValidTransition = this.isValidTransition(
        current.status as SchedulingStatus,
        input.status
      );
      if (!isValidTransition) {
        return {
          data: null,
          error: `Invalid state transition from ${current.status} to ${input.status}`,
        };
      }
    }

    const { data, error } = await supabase
      .from('scheduling_requests')
      .update({
        ...input,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Log status change if applicable
    if (input.status && input.status !== current.status) {
      await this.logAction(id, {
        action_type: ACTION_TYPES.STATUS_CHANGED,
        previous_status: current.status as SchedulingStatus,
        new_status: input.status,
        actor: actorId ? 'user' : 'ai',
        actor_id: actorId || null,
      });
    }

    return { data: data as SchedulingRequest, error: null };
  }

  // ============================================
  // STATE MACHINE OPERATIONS
  // ============================================

  /**
   * Checks if a state transition is valid
   */
  isValidTransition(from: SchedulingStatus, to: SchedulingStatus): boolean {
    const validNextStates = STATE_TRANSITIONS[from];
    return validNextStates?.includes(to) ?? false;
  }

  /**
   * Transitions to a new state with validation and logging
   */
  async transitionState(
    requestId: string,
    newStatus: SchedulingStatus,
    options?: {
      actor?: 'ai' | 'user' | 'prospect';
      actorId?: string;
      reasoning?: string;
    }
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    // Get current state
    const { data: current, error: fetchError } = await supabase
      .from('scheduling_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const currentStatus = current.status as SchedulingStatus;

    // Validate transition
    if (!this.isValidTransition(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid state transition from ${currentStatus} to ${newStatus}`,
      };
    }

    // Update status
    const { error: updateError } = await supabase
      .from('scheduling_requests')
      .update({
        status: newStatus,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the transition
    await this.logAction(requestId, {
      action_type: ACTION_TYPES.STATUS_CHANGED,
      previous_status: currentStatus,
      new_status: newStatus,
      actor: options?.actor || 'ai',
      actor_id: options?.actorId || null,
      ai_reasoning: options?.reasoning || null,
    });

    return { success: true, error: null };
  }

  /**
   * Records proposed times and transitions to PROPOSING state
   */
  async proposeTimeslots(
    requestId: string,
    proposedTimes: string[],
    options?: {
      emailSubject?: string;
      emailContent?: string;
      reasoning?: string;
    }
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    // Update with proposed times
    const { error: updateError } = await supabase
      .from('scheduling_requests')
      .update({
        proposed_times: proposedTimes,
        status: SCHEDULING_STATUS.PROPOSING,
        attempt_count: supabase.rpc('increment_attempt_count', { request_id: requestId }),
        last_action_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      // Fallback: increment manually if RPC doesn't exist
      const { data: current } = await supabase
        .from('scheduling_requests')
        .select('attempt_count')
        .eq('id', requestId)
        .single();

      await supabase
        .from('scheduling_requests')
        .update({
          proposed_times: proposedTimes,
          status: SCHEDULING_STATUS.PROPOSING,
          attempt_count: (current?.attempt_count || 0) + 1,
          last_action_at: new Date().toISOString(),
        })
        .eq('id', requestId);
    }

    // Log the action
    await this.logAction(requestId, {
      action_type: ACTION_TYPES.TIMES_PROPOSED,
      times_proposed: proposedTimes,
      message_subject: options?.emailSubject || null,
      message_content: options?.emailContent || null,
      actor: 'ai',
      ai_reasoning: options?.reasoning || 'AI proposed meeting times based on availability',
    });

    return { success: true, error: null };
  }

  /**
   * Records a selected time and transitions to CONFIRMING state
   */
  async selectTime(
    requestId: string,
    selectedTime: string,
    options?: {
      actor?: 'user' | 'prospect';
      actorId?: string;
    }
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('scheduling_requests')
      .update({
        scheduled_time: selectedTime,
        status: SCHEDULING_STATUS.CONFIRMING,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    await this.logAction(requestId, {
      action_type: ACTION_TYPES.TIME_SELECTED,
      time_selected: selectedTime,
      actor: options?.actor || 'prospect',
      actor_id: options?.actorId || null,
    });

    return { success: true, error: null };
  }

  /**
   * Confirms the meeting (invite accepted)
   */
  async confirmMeeting(
    requestId: string,
    calendarEventId?: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('scheduling_requests')
      .update({
        status: SCHEDULING_STATUS.CONFIRMED,
        invite_accepted: true,
        calendar_event_id: calendarEventId || null,
        last_action_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    await this.logAction(requestId, {
      action_type: ACTION_TYPES.INVITE_ACCEPTED,
      actor: 'prospect',
    });

    return { success: true, error: null };
  }

  /**
   * Marks a meeting as completed
   */
  async completeMeeting(
    requestId: string,
    outcome: 'held' | 'cancelled_by_us' | 'cancelled_by_them' | 'no_show' | 'rescheduled',
    notes?: string
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    const newStatus =
      outcome === 'no_show' ? SCHEDULING_STATUS.NO_SHOW : SCHEDULING_STATUS.COMPLETED;

    const updateData: Record<string, unknown> = {
      status: newStatus,
      outcome,
      outcome_notes: notes || null,
      completed_at: new Date().toISOString(),
      last_action_at: new Date().toISOString(),
    };

    if (outcome === 'no_show') {
      // Increment no-show count
      const { data: current } = await supabase
        .from('scheduling_requests')
        .select('no_show_count')
        .eq('id', requestId)
        .single();

      updateData.no_show_count = (current?.no_show_count || 0) + 1;
    }

    const { error } = await supabase
      .from('scheduling_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    const actionType =
      outcome === 'no_show' ? ACTION_TYPES.NO_SHOW_DETECTED : ACTION_TYPES.COMPLETED;

    await this.logAction(requestId, {
      action_type: actionType,
      actor: 'user',
    });

    return { success: true, error: null };
  }

  // ============================================
  // ACTION LOGGING
  // ============================================

  /**
   * Logs an action to the scheduling_actions table
   */
  async logAction(
    requestId: string,
    action: {
      action_type: ActionType;
      email_id?: string | null;
      times_proposed?: string[] | null;
      time_selected?: string | null;
      message_subject?: string | null;
      message_content?: string | null;
      previous_status?: SchedulingStatus | null;
      new_status?: SchedulingStatus | null;
      ai_reasoning?: string | null;
      actor: 'ai' | 'user' | 'prospect';
      actor_id?: string | null;
    }
  ): Promise<void> {
    const supabase = await this.getClient();

    await supabase.from('scheduling_actions').insert({
      scheduling_request_id: requestId,
      action_type: action.action_type,
      email_id: action.email_id || null,
      times_proposed: action.times_proposed || null,
      time_selected: action.time_selected || null,
      message_subject: action.message_subject || null,
      message_content: action.message_content || null,
      previous_status: action.previous_status || null,
      new_status: action.new_status || null,
      ai_reasoning: action.ai_reasoning || null,
      actor: action.actor,
      actor_id: action.actor_id || null,
    });
  }

  // ============================================
  // ATTENDEE OPERATIONS
  // ============================================

  /**
   * Gets attendees for a scheduling request
   */
  async getAttendees(
    requestId: string
  ): Promise<{ data: SchedulingAttendee[]; error: string | null }> {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from('scheduling_attendees')
      .select('*')
      .eq('scheduling_request_id', requestId);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data as SchedulingAttendee[], error: null };
  }

  /**
   * Updates an attendee's invite status
   */
  async updateAttendeeStatus(
    attendeeId: string,
    status: 'pending' | 'accepted' | 'declined' | 'tentative'
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('scheduling_attendees')
      .update({
        invite_status: status,
        responded_at: status !== 'pending' ? new Date().toISOString() : null,
      })
      .eq('id', attendeeId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Gets requests that need AI action (next_action_at has passed)
   */
  async getRequestsNeedingAction(): Promise<{
    data: SchedulingRequest[];
    error: string | null;
  }> {
    const supabase = await this.getClient();

    const { data, error } = await supabase
      .from('scheduling_requests')
      .select(
        `
        *,
        attendees:scheduling_attendees(*),
        company:companies(id, name),
        deal:deals(id, name)
      `
      )
      .lte('next_action_at', new Date().toISOString())
      .not('status', 'in', `(${SCHEDULING_STATUS.COMPLETED},${SCHEDULING_STATUS.CANCELLED},${SCHEDULING_STATUS.PAUSED})`);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data as SchedulingRequest[], error: null };
  }

  /**
   * Schedules the next AI action for a request
   */
  async scheduleNextAction(
    requestId: string,
    actionType: string,
    delayHours: number
  ): Promise<{ success: boolean; error: string | null }> {
    const supabase = await this.getClient();

    const nextActionAt = new Date();
    nextActionAt.setHours(nextActionAt.getHours() + delayHours);

    const { error } = await supabase
      .from('scheduling_requests')
      .update({
        next_action_at: nextActionAt.toISOString(),
        next_action_type: actionType,
      })
      .eq('id', requestId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  }

  // ============================================
  // EMAIL OPERATIONS
  // ============================================

  /**
   * Sends an initial scheduling email for a request.
   * Generates proposed times, creates the email via AI, and sends via Microsoft Graph.
   */
  async sendSchedulingEmail(
    requestId: string,
    userId: string,
    options?: {
      emailType?: EmailType;
      customSubject?: string;
      customBody?: string;
    }
  ): Promise<{
    success: boolean;
    error: string | null;
    email?: { subject: string; body: string };
    proposedTimes?: string[];
  }> {
    console.log('[sendSchedulingEmail] Starting with:', { requestId, userId, useAdmin: this.useAdmin });
    const supabase = await this.getClient();
    console.log('[sendSchedulingEmail] Got supabase client');

    try {
      // 1. Get the scheduling request with all related data
      const { data: request, error: fetchError } = await supabase
        .from('scheduling_requests')
        .select(`
          *,
          attendees:scheduling_attendees(*),
          company:companies(id, name, industry),
          deal:deals(id, name, stage)
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return { success: false, error: fetchError?.message || 'Request not found' };
      }

      // 2. Get sender info
      console.log('[sendSchedulingEmail] Looking up user:', userId);
      console.log('[sendSchedulingEmail] Using admin client:', this.useAdmin);

      const { data: sender, error: senderError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userId)
        .single();

      console.log('[sendSchedulingEmail] Sender lookup result:', { sender, error: senderError });

      if (!sender) {
        return { success: false, error: `Sender user not found: ${senderError?.message || 'no data returned'}` };
      }

      // 3. Get external attendees (recipients)
      const externalAttendees = (request.attendees || []).filter(
        (a: SchedulingAttendee) => a.side === ATTENDEE_SIDE.EXTERNAL
      );

      if (externalAttendees.length === 0) {
        return { success: false, error: 'No external attendees to send email to' };
      }

      // 4. Generate proposed times
      const dateRangeStart = request.date_range_start
        ? new Date(request.date_range_start)
        : new Date();
      const dateRangeEnd = request.date_range_end
        ? new Date(request.date_range_end)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

      const proposedTimeDates = generateProposedTimes(
        dateRangeStart,
        dateRangeEnd,
        request.preferred_times || { morning: true, afternoon: true, evening: false },
        request.avoid_days || [],
        4
      );

      const proposedTimeSlots = formatTimeSlotsForEmail(
        proposedTimeDates,
        request.timezone || 'America/New_York'
      );

      // 5. Generate email content
      const emailType = options?.emailType || 'initial_outreach';
      let emailContent: { subject: string; body: string };

      if (options?.customSubject && options?.customBody) {
        emailContent = {
          subject: options.customSubject,
          body: options.customBody,
        };
      } else {
        const { email } = await generateSchedulingEmail({
          emailType,
          request: request as SchedulingRequest,
          attendees: request.attendees as SchedulingAttendee[],
          proposedTimes: proposedTimeSlots,
          senderName: sender.name || sender.email,
          senderTitle: undefined, // users table doesn't have title column
          companyContext: request.company
            ? {
                name: request.company.name,
                industry: request.company.industry,
              }
            : undefined,
          dealContext: request.deal
            ? {
                stage: request.deal.stage,
              }
            : undefined,
        });
        emailContent = email;
      }

      // 6. Send email via Microsoft Graph
      const recipientEmails = externalAttendees.map((a: SchedulingAttendee) => a.email);

      console.log('[SchedulingService] Sending email:', {
        userId,
        recipients: recipientEmails,
        subject: emailContent.subject,
        bodyLength: emailContent.body.length,
      });

      const sendResult = await sendEmail(
        userId,
        recipientEmails,
        emailContent.subject,
        emailContent.body,
        undefined, // cc
        false // isHtml
      );

      console.log('[SchedulingService] Send result:', sendResult);

      if (!sendResult.success) {
        console.error('[SchedulingService] Email send failed:', sendResult.error);
        return {
          success: false,
          error: `Failed to send email: ${sendResult.error}`,
          email: emailContent,
        };
      }

      // 7. Update scheduling request state
      const proposedTimeStrings = proposedTimeSlots.map((t) => t.formatted);

      await supabase
        .from('scheduling_requests')
        .update({
          status: SCHEDULING_STATUS.AWAITING_RESPONSE,
          proposed_times: proposedTimeStrings,
          last_action_at: new Date().toISOString(),
          next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          next_action_type: 'follow_up',
          attempt_count: (request.attempt_count || 0) + 1,
        })
        .eq('id', requestId);

      // 8. Log the action
      await this.logAction(requestId, {
        action_type: ACTION_TYPES.EMAIL_SENT,
        message_subject: emailContent.subject,
        message_content: emailContent.body,
        times_proposed: proposedTimeStrings,
        actor: 'ai',
        ai_reasoning: `Sent ${emailType.replace(/_/g, ' ')} email with ${proposedTimeStrings.length} proposed times`,
      });

      console.log(`[Scheduler] Sent ${emailType} email for request ${requestId} to ${recipientEmails.join(', ')}`);

      return {
        success: true,
        error: null,
        email: emailContent,
        proposedTimes: proposedTimeStrings,
      };
    } catch (err) {
      console.error('[Scheduler] Error sending scheduling email:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error sending email',
      };
    }
  }

  /**
   * Sends a follow-up email for a request that hasn't received a response.
   */
  async sendFollowUpEmail(
    requestId: string,
    userId: string
  ): Promise<{
    success: boolean;
    error: string | null;
    email?: { subject: string; body: string };
  }> {
    const supabase = await this.getClient();

    // Get request to check attempt count
    const { data: request } = await supabase
      .from('scheduling_requests')
      .select('attempt_count')
      .eq('id', requestId)
      .single();

    const emailType: EmailType =
      (request?.attempt_count || 0) >= 2 ? 'second_follow_up' : 'follow_up';

    return this.sendSchedulingEmail(requestId, userId, { emailType });
  }

  /**
   * Preview the email that would be sent without actually sending it.
   */
  async previewSchedulingEmail(
    requestId: string,
    emailType: EmailType = 'initial_outreach'
  ): Promise<{
    success: boolean;
    error: string | null;
    email?: { subject: string; body: string };
    proposedTimes?: string[];
    availability?: {
      source: 'calendar' | 'generated' | 'error';
      calendarChecked: boolean;
      warnings: string[];
      error: string | null;
    };
  }> {
    const supabase = await this.getClient();

    try {
      // Get the scheduling request with all related data
      const { data: request, error: fetchError } = await supabase
        .from('scheduling_requests')
        .select(`
          *,
          attendees:scheduling_attendees(*),
          company:companies(id, name, industry),
          deal:deals(id, name, stage),
          creator:users!scheduling_requests_created_by_fkey(id, name, email)
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return { success: false, error: fetchError?.message || 'Request not found' };
      }

      // Generate proposed times - try real calendar availability first
      const timezone = request.timezone || 'America/New_York';
      let proposedTimeSlots: Array<{ start: Date; end: Date; formatted: string }> = [];

      // Track availability info to return to the caller
      let availabilityInfo: {
        source: 'calendar' | 'generated' | 'error';
        calendarChecked: boolean;
        warnings: string[];
        error: string | null;
      } = {
        source: 'generated',
        calendarChecked: false,
        warnings: [],
        error: null,
      };

      // Try to get real availability from calendar
      if (request.created_by) {
        try {
          // Extract internal attendee emails (excluding the organizer - they're checked as primary user)
          const internalAttendeeEmails = (request.attendees || [])
            .filter((attendee: SchedulingAttendee) => {
              // Include if marked as internal side AND not the organizer AND has email
              const isInternal = attendee.side === 'internal';
              const isOrganizer = attendee.is_organizer === true;
              const hasEmail = !!attendee.email;

              return hasEmail && !isOrganizer && isInternal;
            })
            .map((attendee: SchedulingAttendee) => attendee.email);

          console.log('[PreviewEmail] Checking calendars for organizer +', internalAttendeeEmails.length, 'internal attendees:', internalAttendeeEmails);

          // Use getMultiAttendeeAvailability to check ALL attendees' calendars
          const availability = await getMultiAttendeeAvailability(
            request.created_by,
            internalAttendeeEmails,
            {
              daysAhead: 10,
              slotDuration: request.duration_minutes || 30,
              businessHoursStart: 9,
              businessHoursEnd: 17,
              maxSlots: 4,
              timezone,
            }
          );

          // Capture availability metadata
          availabilityInfo = {
            source: availability.source,
            calendarChecked: availability.calendarChecked,
            warnings: availability.warnings || [],
            error: availability.error || null,
          };

          // Log any warnings about attendees whose calendars couldn't be checked
          if (availability.warnings && availability.warnings.length > 0) {
            console.warn('[PreviewEmail] Calendar check warnings:', availability.warnings);
          }

          if (availability.slots && availability.slots.length > 0) {
            console.log('[Scheduler] Using real calendar availability:', availability.slots.length, 'slots (checked', internalAttendeeEmails.length + 1, 'calendars)');
            proposedTimeSlots = availability.slots;
          } else if (availability.error) {
            console.warn('[Scheduler] Calendar check failed:', availability.error);
          }
        } catch (err) {
          console.warn('[Scheduler] Error checking calendar availability:', err);
          availabilityInfo = {
            source: 'error',
            calendarChecked: false,
            warnings: [],
            error: err instanceof Error ? err.message : 'Calendar check failed',
          };
        }
      }

      // Fall back to generated times if calendar check failed
      if (proposedTimeSlots.length === 0) {
        console.log('[Scheduler] Falling back to generated times (no calendar access)');
        availabilityInfo.source = 'generated';
        if (!availabilityInfo.error) {
          availabilityInfo.warnings.push('Calendar not available - using generated time slots');
        }

        const dateRangeStart = request.date_range_start
          ? new Date(request.date_range_start)
          : new Date();
        const dateRangeEnd = request.date_range_end
          ? new Date(request.date_range_end)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const proposedTimeDates = generateProposedTimes(
          dateRangeStart,
          dateRangeEnd,
          request.preferred_times || { morning: true, afternoon: true, evening: false },
          request.avoid_days || [],
          4
        );

        proposedTimeSlots = formatTimeSlotsForEmail(proposedTimeDates, timezone);
      }

      // Generate email content
      const sender = request.creator || { name: 'Sales Team', email: '' };

      const { email } = await generateSchedulingEmail({
        emailType,
        request: request as SchedulingRequest,
        attendees: request.attendees as SchedulingAttendee[],
        proposedTimes: proposedTimeSlots,
        senderName: sender.name || sender.email,
        senderTitle: undefined, // users table doesn't have title column
        companyContext: request.company
          ? {
              name: request.company.name,
              industry: request.company.industry,
            }
          : undefined,
        dealContext: request.deal
          ? {
              stage: request.deal.stage,
            }
          : undefined,
      });

      return {
        success: true,
        error: null,
        email,
        proposedTimes: proposedTimeSlots.map((t) => t.formatted),
        availability: availabilityInfo,
      };
    } catch (err) {
      console.error('[Scheduler] Error previewing email:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

// Export singleton for convenience
export const schedulingService = new SchedulingService();
export const adminSchedulingService = new SchedulingService({ useAdmin: true });
