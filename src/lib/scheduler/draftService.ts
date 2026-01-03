/**
 * Scheduler Draft Service
 *
 * Manages draft emails for scheduling requests.
 * Key principle: Once a draft is generated, it's stored in the database
 * and NEVER regenerated unless explicitly requested.
 *
 * This prevents the bug where preview shows different times than what gets sent.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  SchedulingDraft,
  DraftProposedTime,
  DraftStatus,
  DRAFT_STATUS,
  SchedulingAttendee,
  SchedulingRequest,
} from './types';
import { getMultiAttendeeAvailability } from './calendarIntegration';
import { generateSchedulingEmail, generateProposedTimes, formatTimeSlotsForEmail } from './emailGeneration';
import type { EmailType } from './emailGeneration';

// ============================================
// GENERATE DRAFT
// ============================================

/**
 * Generate a new draft for a scheduling request.
 * This creates the preview content and saves it to the database.
 *
 * If a pending draft already exists, returns it instead of regenerating.
 */
export async function generateDraft(
  requestId: string,
  userId: string,
  emailType: EmailType = 'initial_outreach'
): Promise<{
  draft: SchedulingDraft;
  warnings: string[];
  isExisting: boolean;
}> {
  const supabase = createAdminClient();

  // Fetch the request with attendees
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
    throw new Error(`Failed to fetch scheduling request: ${fetchError?.message}`);
  }

  // Check if there's already a pending draft
  if (request.draft_status === DRAFT_STATUS.PENDING_REVIEW && request.draft_email_subject) {
    console.log('[Draft] Existing pending draft found, returning it');
    return {
      draft: {
        subject: request.draft_email_subject,
        body: request.draft_email_body || '',
        proposedTimes: request.draft_proposed_times || [],
        generatedAt: request.draft_generated_at || new Date().toISOString(),
        editedAt: request.draft_edited_at,
        status: request.draft_status as DraftStatus,
      },
      warnings: [],
      isExisting: true,
    };
  }

  // Get internal attendee emails (excluding organizer)
  const internalAttendeeEmails = (request.attendees || [])
    .filter((a: SchedulingAttendee) => {
      const isInternal = a.side === 'internal';
      const isOrganizer = a.is_organizer === true;
      const hasEmail = !!a.email;
      return hasEmail && !isOrganizer && isInternal;
    })
    .map((a: SchedulingAttendee) => a.email);

  console.log('[Draft] Generating new draft for request', requestId);
  console.log('[Draft] Checking availability for', internalAttendeeEmails.length + 1, 'attendees');

  const timezone = request.timezone || 'America/New_York';
  let proposedTimeSlots: Array<{ start: Date; end: Date; formatted: string }> = [];
  const warnings: string[] = [];

  // Try to get real availability from calendar
  if (request.created_by) {
    try {
      const availability = await getMultiAttendeeAvailability(
        request.created_by,
        internalAttendeeEmails,
        {
          daysAhead: 10,
          slotDuration: request.duration_minutes || 30,
          businessHoursStart: 9,
          businessHoursEnd: 17,
          maxSlots: 6,
          timezone,
        }
      );

      if (availability.warnings && availability.warnings.length > 0) {
        warnings.push(...availability.warnings);
      }

      if (availability.slots && availability.slots.length > 0) {
        console.log('[Draft] Using real calendar availability:', availability.slots.length, 'slots');
        proposedTimeSlots = availability.slots;
      } else if (availability.error) {
        console.warn('[Draft] Calendar check failed:', availability.error);
        warnings.push(`Calendar check failed: ${availability.error}`);
      }
    } catch (err) {
      console.warn('[Draft] Error checking calendar availability:', err);
      warnings.push('Calendar not available - using generated time slots');
    }
  }

  // Fall back to generated times if calendar check failed
  if (proposedTimeSlots.length === 0) {
    console.log('[Draft] Falling back to generated times');
    warnings.push('Calendar not available - using generated time slots');

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
      6
    );

    proposedTimeSlots = formatTimeSlotsForEmail(proposedTimeDates, timezone);
  }

  if (proposedTimeSlots.length === 0) {
    throw new Error('No available times found. Please expand your date range or check attendee calendars.');
  }

  // Convert slots to DraftProposedTime format for storage
  const draftProposedTimes: DraftProposedTime[] = proposedTimeSlots.slice(0, 6).map((slot) => {
    // Format local datetime string
    const localDateTime = slot.start.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T');

    return {
      localDateTime,
      timezone,
      utc: slot.start.toISOString(),
      display: slot.formatted,
    };
  });

  // Generate email content
  const sender = request.creator || { name: 'Sales Team', email: '' };

  const { email } = await generateSchedulingEmail({
    emailType,
    request: request as SchedulingRequest,
    attendees: request.attendees as SchedulingAttendee[],
    proposedTimes: proposedTimeSlots,
    senderName: sender.name || sender.email,
    senderTitle: undefined,
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

  const now = new Date().toISOString();

  // Save draft to database
  const { error: updateError } = await supabase
    .from('scheduling_requests')
    .update({
      draft_email_subject: email.subject,
      draft_email_body: email.body,
      draft_proposed_times: draftProposedTimes,
      draft_generated_at: now,
      draft_edited_at: null,
      draft_status: DRAFT_STATUS.PENDING_REVIEW,
    })
    .eq('id', requestId);

  if (updateError) {
    throw new Error(`Failed to save draft: ${updateError.message}`);
  }

  console.log('[Draft] Draft saved with', draftProposedTimes.length, 'proposed times');

  return {
    draft: {
      subject: email.subject,
      body: email.body,
      proposedTimes: draftProposedTimes,
      generatedAt: now,
      editedAt: null,
      status: DRAFT_STATUS.PENDING_REVIEW,
    },
    warnings,
    isExisting: false,
  };
}

// ============================================
// GET DRAFT
// ============================================

/**
 * Get existing draft for a scheduling request.
 * Returns null if no draft exists.
 */
export async function getDraft(requestId: string): Promise<SchedulingDraft | null> {
  const supabase = createAdminClient();

  const { data: request, error } = await supabase
    .from('scheduling_requests')
    .select(`
      draft_email_subject,
      draft_email_body,
      draft_proposed_times,
      draft_generated_at,
      draft_edited_at,
      draft_status
    `)
    .eq('id', requestId)
    .single();

  if (error || !request) {
    return null;
  }

  if (request.draft_status === DRAFT_STATUS.NONE || !request.draft_email_subject) {
    return null;
  }

  return {
    subject: request.draft_email_subject,
    body: request.draft_email_body || '',
    proposedTimes: request.draft_proposed_times || [],
    generatedAt: request.draft_generated_at || '',
    editedAt: request.draft_edited_at,
    status: request.draft_status as DraftStatus,
  };
}

// ============================================
// UPDATE DRAFT
// ============================================

/**
 * Update draft content (when user edits in the UI).
 * Only updates subject and/or body - proposed times remain locked.
 */
export async function updateDraft(
  requestId: string,
  updates: { subject?: string; body?: string }
): Promise<SchedulingDraft> {
  const supabase = createAdminClient();

  // First verify draft exists and is in editable state
  const existing = await getDraft(requestId);
  if (!existing) {
    throw new Error('No draft found to update. Please generate a preview first.');
  }

  if (existing.status !== DRAFT_STATUS.PENDING_REVIEW) {
    throw new Error(`Cannot edit draft in "${existing.status}" status`);
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('scheduling_requests')
    .update({
      draft_email_subject: updates.subject ?? existing.subject,
      draft_email_body: updates.body ?? existing.body,
      draft_edited_at: now,
    })
    .eq('id', requestId);

  if (error) {
    throw new Error(`Failed to update draft: ${error.message}`);
  }

  console.log('[Draft] Draft updated at', now);

  return {
    ...existing,
    subject: updates.subject ?? existing.subject,
    body: updates.body ?? existing.body,
    editedAt: now,
  };
}

// ============================================
// GET DRAFT FOR SENDING
// ============================================

/**
 * Get draft content for sending.
 * This is what the send function should use - NEVER regenerate.
 * Returns null if no valid draft exists.
 */
export async function getDraftForSending(requestId: string): Promise<{
  subject: string;
  body: string;
  proposedTimes: DraftProposedTime[];
} | null> {
  const supabase = createAdminClient();

  const { data: request, error } = await supabase
    .from('scheduling_requests')
    .select(`
      draft_email_subject,
      draft_email_body,
      draft_proposed_times,
      draft_status
    `)
    .eq('id', requestId)
    .single();

  if (error || !request) {
    console.error('[Draft] Failed to fetch draft for sending:', error);
    return null;
  }

  // Only allow sending if draft is pending_review
  if (request.draft_status !== DRAFT_STATUS.PENDING_REVIEW) {
    console.error('[Draft] Cannot send draft in status:', request.draft_status);
    return null;
  }

  if (!request.draft_email_subject || !request.draft_email_body) {
    console.error('[Draft] Draft content is missing');
    return null;
  }

  return {
    subject: request.draft_email_subject,
    body: request.draft_email_body,
    proposedTimes: request.draft_proposed_times || [],
  };
}

// ============================================
// MARK DRAFT SENT
// ============================================

/**
 * Mark draft as sent after successful email send.
 */
export async function markDraftSent(requestId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('scheduling_requests')
    .update({ draft_status: DRAFT_STATUS.SENT })
    .eq('id', requestId);

  if (error) {
    console.error('[Draft] Failed to mark draft as sent:', error);
  } else {
    console.log('[Draft] Draft marked as sent for request:', requestId);
  }
}

// ============================================
// EXPIRE DRAFT
// ============================================

/**
 * Expire a draft (e.g., if times are now in the past).
 */
export async function expireDraft(requestId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('scheduling_requests')
    .update({ draft_status: DRAFT_STATUS.EXPIRED })
    .eq('id', requestId);

  if (error) {
    console.error('[Draft] Failed to expire draft:', error);
  }
}

// ============================================
// REGENERATE DRAFT
// ============================================

/**
 * Force regenerate a draft (user explicitly requests new times).
 * This clears the existing draft and generates a fresh one.
 */
export async function regenerateDraft(
  requestId: string,
  userId: string,
  emailType: EmailType = 'initial_outreach'
): Promise<{
  draft: SchedulingDraft;
  warnings: string[];
  isExisting: boolean;
}> {
  const supabase = createAdminClient();

  console.log('[Draft] Regenerating draft for request:', requestId);

  // Clear existing draft first
  const { error: clearError } = await supabase
    .from('scheduling_requests')
    .update({
      draft_status: DRAFT_STATUS.NONE,
      draft_email_subject: null,
      draft_email_body: null,
      draft_proposed_times: null,
      draft_generated_at: null,
      draft_edited_at: null,
    })
    .eq('id', requestId);

  if (clearError) {
    console.warn('[Draft] Failed to clear existing draft:', clearError);
  }

  // Generate fresh draft
  return generateDraft(requestId, userId, emailType);
}

// ============================================
// CLEAR DRAFT
// ============================================

/**
 * Clear a draft without regenerating.
 */
export async function clearDraft(requestId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('scheduling_requests')
    .update({
      draft_status: DRAFT_STATUS.NONE,
      draft_email_subject: null,
      draft_email_body: null,
      draft_proposed_times: null,
      draft_generated_at: null,
      draft_edited_at: null,
    })
    .eq('id', requestId);

  if (error) {
    console.error('[Draft] Failed to clear draft:', error);
  }
}
