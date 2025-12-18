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
  }

  private async getClient() {
    return this.useAdmin ? createAdminClient() : await createClient();
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
      // 1. Create the scheduling request
      const { data: request, error: requestError } = await supabase
        .from('scheduling_requests')
        .insert({
          created_by: createdBy,
          deal_id: input.deal_id || null,
          company_id: input.company_id || null,
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

      // 2. Create internal attendees
      const internalAttendees = input.internal_attendees.map((attendee) => ({
        scheduling_request_id: request.id,
        side: ATTENDEE_SIDE.INTERNAL,
        user_id: attendee.user_id,
        is_organizer: attendee.is_organizer ?? false,
        is_required: true,
        invite_status: INVITE_STATUS.PENDING,
      }));

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
        actions:scheduling_actions(*)
      `
      )
      .eq('id', id)
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
   * Gets dashboard data for the scheduler
   */
  async getDashboardData(): Promise<{
    data: SchedulerDashboardData | null;
    error: string | null;
  }> {
    const supabase = await this.getClient();

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
}

// Export singleton for convenience
export const schedulingService = new SchedulingService();
export const adminSchedulingService = new SchedulingService({ useAdmin: true });
