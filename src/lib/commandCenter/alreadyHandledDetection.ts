/**
 * Already Handled Detection
 *
 * Detects when a command center item has already been handled
 * AND checks if the opportunity is properly linked to company/deal.
 *
 * Key insight: "Handled" doesn't mean "Complete"
 * - Responded to email = HANDLED
 * - But no company/deal linked = ORPHANED OPPORTUNITY (still needs work)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { CommandCenterItem } from '@/types/commandCenter';

export interface AlreadyHandledResult {
  // Whether the primary action has been taken (email sent, meeting scheduled, etc.)
  already_handled: boolean;
  handled_reason: string | null;
  handled_at: string | null;

  // Whether the item can be fully completed (handled AND properly linked)
  can_complete: boolean;

  // Whether the item needs linking work (handled but missing company/deal)
  needs_linking: boolean;
  linking_message: string | null;
}

/**
 * Check if an action has already been taken for a command center item
 * AND whether it's properly linked to track the opportunity
 */
export async function detectAlreadyHandled(
  item: CommandCenterItem
): Promise<AlreadyHandledResult> {
  const supabase = createAdminClient();

  // Default result - not handled
  let baseResult: AlreadyHandledResult = {
    already_handled: false,
    handled_reason: null,
    handled_at: null,
    can_complete: false,
    needs_linking: false,
    linking_message: null,
  };

  // 1. Demo/Meeting Request items - check for scheduled meetings
  if (
    item.tier_trigger === 'demo_request' ||
    item.tier_trigger === 'meeting_request' ||
    item.tier_trigger === 'inbound_request'
  ) {
    const result = await checkMeetingScheduled(supabase, item);
    if (result.already_handled) {
      baseResult = result;
    }
  }

  // 2. Email reply items - check for outbound emails after item creation
  if (
    !baseResult.already_handled && (
      item.tier_trigger === 'email_reply' ||
      item.tier_trigger === 'email_unanswered' ||
      item.source === 'email_sync' ||
      item.source === 'email_ai_analysis'
    )
  ) {
    const result = await checkEmailReplySent(supabase, item);
    if (result.already_handled) {
      baseResult = result;
    }
  }

  // 3. Commitment items - check if commitment is marked resolved
  if (
    !baseResult.already_handled && (
      item.tier_trigger === 'promise_due' ||
      item.tier_trigger === 'our_commitment_overdue' ||
      item.tier_trigger === 'their_commitment_overdue'
    )
  ) {
    const result = await checkCommitmentResolved(supabase, item);
    if (result.already_handled) {
      baseResult = result;
    }
  }

  // 4. Follow-up items - check for recent activity
  if (
    !baseResult.already_handled && (
      item.tier_trigger === 'post_meeting_followup' ||
      item.tier_trigger === 'meeting_follow_up' ||
      item.action_type === 'meeting_follow_up'
    )
  ) {
    const result = await checkFollowUpSent(supabase, item);
    if (result.already_handled) {
      baseResult = result;
    }
  }

  // If handled, check linking status
  if (baseResult.already_handled) {
    const linkingStatus = checkLinkingStatus(item);
    baseResult.needs_linking = linkingStatus.needs_linking;
    baseResult.linking_message = linkingStatus.linking_message;
    baseResult.can_complete = !linkingStatus.needs_linking;
  }

  return baseResult;
}

/**
 * Check if item is properly linked to company and deal
 */
function checkLinkingStatus(item: CommandCenterItem): {
  needs_linking: boolean;
  linking_message: string | null;
} {
  const hasCompany = !!item.company_id;
  const hasDeal = !!item.deal_id;

  if (hasCompany && hasDeal) {
    return { needs_linking: false, linking_message: null };
  }

  if (!hasCompany && !hasDeal) {
    return {
      needs_linking: true,
      linking_message: 'Not linked to company or deal',
    };
  }

  if (!hasCompany) {
    return {
      needs_linking: true,
      linking_message: 'Not linked to company',
    };
  }

  // Has company but no deal
  return {
    needs_linking: true,
    linking_message: 'Not linked to deal',
  };
}

/**
 * Check if a meeting is scheduled with the contact
 */
async function checkMeetingScheduled(
  supabase: ReturnType<typeof createAdminClient>,
  item: CommandCenterItem
): Promise<AlreadyHandledResult> {
  if (!item.contact_id && !item.company_id) {
    return {
      already_handled: false,
      handled_reason: null,
      handled_at: null,
      can_complete: false,
      needs_linking: false,
      linking_message: null,
    };
  }

  // Check activities for scheduled meetings
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let query = supabase
    .from('activities')
    .select('id, occurred_at, subject')
    .eq('type', 'meeting')
    .gte('occurred_at', new Date().toISOString())
    .lte('occurred_at', thirtyDaysFromNow.toISOString())
    .order('occurred_at', { ascending: true })
    .limit(1);

  if (item.contact_id) {
    query = query.eq('contact_id', item.contact_id);
  } else if (item.company_id) {
    // If no contact, check by deal or company
    if (item.deal_id) {
      query = query.eq('deal_id', item.deal_id);
    }
  }

  const { data: meetings } = await query;

  if (meetings && meetings.length > 0) {
    const meeting = meetings[0];
    const meetingDate = new Date(meeting.occurred_at);
    const formattedDate = meetingDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return {
      already_handled: true,
      handled_reason: `Meeting scheduled: ${meeting.subject || 'Call'} on ${formattedDate}`,
      handled_at: meeting.occurred_at,
      can_complete: false, // Will be set by caller based on linking
      needs_linking: false,
      linking_message: null,
    };
  }

  return {
    already_handled: false,
    handled_reason: null,
    handled_at: null,
    can_complete: false,
    needs_linking: false,
    linking_message: null,
  };
}

/**
 * Check if an email reply was sent after the item was created
 */
async function checkEmailReplySent(
  supabase: ReturnType<typeof createAdminClient>,
  item: CommandCenterItem
): Promise<AlreadyHandledResult> {
  const defaultResult: AlreadyHandledResult = {
    already_handled: false,
    handled_reason: null,
    handled_at: null,
    can_complete: false,
    needs_linking: false,
    linking_message: null,
  };

  if (!item.conversation_id && !item.contact_id) {
    return defaultResult;
  }

  // Check for outbound emails after item creation
  const itemCreatedAt = item.created_at || new Date().toISOString();

  // First, try to check by conversation_id
  if (item.conversation_id) {
    const { data: messages } = await supabase
      .from('email_messages')
      .select('id, sent_at, subject')
      .eq('conversation_ref', item.conversation_id)
      .eq('is_sent_by_user', true)
      .gt('sent_at', itemCreatedAt)
      .order('sent_at', { ascending: false })
      .limit(1);

    if (messages && messages.length > 0) {
      const message = messages[0];
      const sentDate = new Date(message.sent_at);
      const formattedDate = formatTimeAgoShort(sentDate);

      return {
        already_handled: true,
        handled_reason: `You replied ${formattedDate}`,
        handled_at: message.sent_at,
        can_complete: false,
        needs_linking: false,
        linking_message: null,
      };
    }
  }

  // Also check email_conversations for last_outbound_at
  if (item.conversation_id) {
    const { data: conv } = await supabase
      .from('email_conversations')
      .select('last_outbound_at, status')
      .eq('id', item.conversation_id)
      .single();

    if (conv?.last_outbound_at) {
      const outboundDate = new Date(conv.last_outbound_at);
      const itemDate = new Date(itemCreatedAt);

      if (outboundDate > itemDate) {
        const formattedDate = formatTimeAgoShort(outboundDate);
        return {
          already_handled: true,
          handled_reason: `You replied ${formattedDate}`,
          handled_at: conv.last_outbound_at,
          can_complete: false,
          needs_linking: false,
          linking_message: null,
        };
      }
    }

    // Check if conversation status indicates it's handled
    if (conv?.status === 'awaiting_response' || conv?.status === 'processed') {
      return {
        already_handled: true,
        handled_reason: conv.status === 'awaiting_response'
          ? 'Waiting for their reply'
          : 'Conversation closed',
        handled_at: conv.last_outbound_at,
        can_complete: false,
        needs_linking: false,
        linking_message: null,
      };
    }
  }

  return defaultResult;
}

/**
 * Check if a commitment has been resolved
 */
async function checkCommitmentResolved(
  supabase: ReturnType<typeof createAdminClient>,
  item: CommandCenterItem
): Promise<AlreadyHandledResult> {
  const defaultResult: AlreadyHandledResult = {
    already_handled: false,
    handled_reason: null,
    handled_at: null,
    can_complete: false,
    needs_linking: false,
    linking_message: null,
  };

  if (!item.company_id) {
    return defaultResult;
  }

  // Check relationship_intelligence for commitment status
  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('open_commitments')
    .eq('company_id', item.company_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!ri?.open_commitments) {
    return defaultResult;
  }

  // Search for the commitment in the list
  const commitments = ri.open_commitments as Array<{
    commitment: string;
    due_date?: string;
    status?: string;
    completed_at?: string;
    owner?: string;
  }>;

  // Look for a commitment that matches this item's description
  for (const commitment of commitments) {
    // Check if commitment is resolved
    if (commitment.status === 'completed' || commitment.status === 'resolved') {
      // Check if this commitment matches the item
      const itemDesc = (item.description || item.title || '').toLowerCase();
      const commitmentText = (commitment.commitment || '').toLowerCase();

      if (
        itemDesc.includes(commitmentText.substring(0, 30)) ||
        commitmentText.includes(itemDesc.substring(0, 30))
      ) {
        return {
          already_handled: true,
          handled_reason: `Commitment completed${commitment.completed_at
            ? ` on ${new Date(commitment.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : ''}`,
          handled_at: commitment.completed_at || null,
          can_complete: false,
          needs_linking: false,
          linking_message: null,
        };
      }
    }
  }

  return defaultResult;
}

/**
 * Check if a follow-up has already been sent
 */
async function checkFollowUpSent(
  supabase: ReturnType<typeof createAdminClient>,
  item: CommandCenterItem
): Promise<AlreadyHandledResult> {
  const defaultResult: AlreadyHandledResult = {
    already_handled: false,
    handled_reason: null,
    handled_at: null,
    can_complete: false,
    needs_linking: false,
    linking_message: null,
  };

  if (!item.contact_id && !item.company_id && !item.meeting_id) {
    return defaultResult;
  }

  const itemCreatedAt = item.created_at || new Date().toISOString();

  // Check for recent activities (emails or calls) after item creation
  let query = supabase
    .from('activities')
    .select('id, type, occurred_at, subject')
    .in('type', ['email', 'call'])
    .gt('occurred_at', itemCreatedAt)
    .order('occurred_at', { ascending: false })
    .limit(1);

  if (item.contact_id) {
    query = query.eq('contact_id', item.contact_id);
  } else if (item.deal_id) {
    query = query.eq('deal_id', item.deal_id);
  }

  const { data: activities } = await query;

  if (activities && activities.length > 0) {
    const activity = activities[0];
    const activityDate = new Date(activity.occurred_at);
    const formattedDate = formatTimeAgoShort(activityDate);

    const activityType = activity.type === 'email' ? 'Email sent' : 'Call made';
    return {
      already_handled: true,
      handled_reason: `${activityType} ${formattedDate}`,
      handled_at: activity.occurred_at,
      can_complete: false,
      needs_linking: false,
      linking_message: null,
    };
  }

  return defaultResult;
}

/**
 * Format a date as a short time ago string
 */
function formatTimeAgoShort(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Batch detect already handled for multiple items
 */
export async function batchDetectAlreadyHandled(
  items: CommandCenterItem[]
): Promise<Map<string, AlreadyHandledResult>> {
  const results = new Map<string, AlreadyHandledResult>();

  // Process in parallel but with concurrency limit
  const BATCH_SIZE = 10;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const result = await detectAlreadyHandled(item);
        return { id: item.id, result };
      })
    );

    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
  }

  return results;
}
