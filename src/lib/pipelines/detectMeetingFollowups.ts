/**
 * Pipeline 4: Meeting Follow-ups (Tier 3)
 *
 * Scans for meetings that need follow-up:
 * - External meetings ended 4+ hours ago without follow-up email
 * - Creates Tier 3 items for keeping your word
 *
 * Note: This pipeline uses the meeting_prep table which tracks
 * external attendees and follow-up status.
 */

import { createClient } from '@/lib/supabase/server';
import type { PriorityTier, TierTrigger } from '@/types/commandCenter';

interface MeetingPrep {
  id: string;
  user_id: string;
  meeting_id: string;
  title: string;
  start_time: string;
  end_time: string;
  company_id: string | null;
  deal_id: string | null;
  attendees: MeetingAttendee[] | null;
  follow_up_sent: boolean;
  has_external_attendees: boolean;
}

interface MeetingAttendee {
  email: string;
  name?: string;
  title?: string;
  role?: string;
}

interface PipelineResult {
  meetingsProcessed: number;
  itemsCreated: number;
  errors: string[];
}

/**
 * Check if meeting has external (non-company) attendees
 */
function hasExternalAttendees(attendees: MeetingAttendee[] | null, userEmail: string): boolean {
  if (!attendees || attendees.length === 0) return false;

  const userDomain = userEmail.split('@')[1]?.toLowerCase();
  if (!userDomain) return false;

  return attendees.some((a) => {
    const attendeeDomain = a.email?.split('@')[1]?.toLowerCase();
    return attendeeDomain && attendeeDomain !== userDomain;
  });
}

/**
 * Get primary external attendee for display
 */
function getPrimaryExternalAttendee(
  attendees: MeetingAttendee[] | null,
  userEmail: string
): MeetingAttendee | null {
  if (!attendees || attendees.length === 0) return null;

  const userDomain = userEmail.split('@')[1]?.toLowerCase();

  // Find first external attendee
  return (
    attendees.find((a) => {
      const attendeeDomain = a.email?.split('@')[1]?.toLowerCase();
      return attendeeDomain && attendeeDomain !== userDomain;
    }) || null
  );
}

/**
 * Calculate hours since meeting ended
 */
function hoursSinceMeetingEnded(endTime: string): number {
  const end = new Date(endTime);
  const now = new Date();
  return (now.getTime() - end.getTime()) / (1000 * 60 * 60);
}

/**
 * Generate "why now" text for follow-up
 */
function generateFollowupWhyNow(meeting: MeetingPrep, hoursSince: number): string {
  const hours = Math.floor(hoursSince);
  const attendee = getPrimaryExternalAttendee(meeting.attendees, '');

  const attendeeName = attendee?.name || 'them';

  if (hours < 24) {
    return `Meeting with ${attendeeName} ended ${hours} hour${hours !== 1 ? 's' : ''} ago. Send follow-up.`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return `You met with ${attendeeName} yesterday. Follow-up is overdue.`;
  }

  return `You met with ${attendeeName} ${days} days ago without follow-up.`;
}

/**
 * Check if a CC item already exists for this meeting
 */
async function itemExists(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  meetingId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('command_center_items')
    .select('id')
    .eq('meeting_id', meetingId)
    .eq('action_type', 'meeting_follow_up')
    .eq('status', 'pending')
    .single();

  return !!data;
}

/**
 * Get user email for determining external attendees
 */
async function getUserEmail(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from('users').select('email').eq('id', userId).single();
  return data?.email || null;
}

/**
 * Main pipeline function: Detect meetings needing follow-up
 */
export async function detectMeetingFollowups(userId?: string): Promise<PipelineResult> {
  const supabase = await createClient();
  const result: PipelineResult = {
    meetingsProcessed: 0,
    itemsCreated: 0,
    errors: [],
  };

  // Calculate 4 hours ago
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  // Query for meetings that ended 4+ hours ago without follow-up
  let query = supabase
    .from('meeting_prep')
    .select('*')
    .eq('follow_up_sent', false)
    .lt('end_time', fourHoursAgo.toISOString())
    .order('end_time', { ascending: false })
    .limit(50);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: meetings, error } = await query;

  if (error) {
    result.errors.push(`Query error: ${error.message}`);
    return result;
  }

  if (!meetings || meetings.length === 0) {
    return result;
  }

  // Cache user emails to reduce queries
  const userEmailCache = new Map<string, string | null>();

  for (const meeting of meetings as MeetingPrep[]) {
    try {
      result.meetingsProcessed++;

      // Get user email for checking external attendees
      let userEmail = userEmailCache.get(meeting.user_id);
      if (userEmail === undefined) {
        userEmail = await getUserEmail(supabase, meeting.user_id);
        userEmailCache.set(meeting.user_id, userEmail);
      }

      if (!userEmail) {
        result.errors.push(`Meeting ${meeting.id}: Could not find user email`);
        continue;
      }

      // Check if meeting has external attendees
      const isExternal =
        meeting.has_external_attendees || hasExternalAttendees(meeting.attendees, userEmail);

      // Update has_external_attendees if needed
      if (isExternal && !meeting.has_external_attendees) {
        await supabase
          .from('meeting_prep')
          .update({ has_external_attendees: true })
          .eq('id', meeting.id);
      }

      // Only create follow-up items for external meetings
      if (!isExternal) {
        continue;
      }

      // Check if item already exists
      const exists = await itemExists(supabase, meeting.meeting_id);
      if (exists) {
        continue;
      }

      const hoursSince = hoursSinceMeetingEnded(meeting.end_time);
      const primaryAttendee = getPrimaryExternalAttendee(meeting.attendees, userEmail);
      const now = new Date().toISOString();

      await supabase.from('command_center_items').insert({
        user_id: meeting.user_id,
        meeting_id: meeting.meeting_id,
        deal_id: meeting.deal_id,
        company_id: meeting.company_id,
        action_type: 'meeting_follow_up',
        title: `Follow up: ${meeting.title}`,
        description: `Send follow-up email after meeting with ${primaryAttendee?.name || 'attendees'}`,
        why_now: generateFollowupWhyNow(meeting, hoursSince),
        tier: 3 as PriorityTier,
        tier_trigger: 'meeting_follow_up' as TierTrigger,
        commitment_text: 'Send meeting follow-up email',
        promise_date: meeting.end_time,
        target_name: primaryAttendee?.name || null,
        status: 'pending',
        source: 'calendar_sync',
        source_id: meeting.meeting_id || meeting.id,
        created_at: now,
        updated_at: now,
      });

      result.itemsCreated++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Meeting ${meeting.id}: ${errorMsg}`);
    }
  }

  return result;
}

export default detectMeetingFollowups;
