/**
 * Action Duration Estimates
 *
 * Used for time-aware daily planning. Each action type has:
 * - min: Fastest realistic completion time
 * - typical: Normal completion time (used for planning)
 * - max: Maximum time if complex
 */

import { ActionType } from '@/types/commandCenter';

export interface ActionDuration {
  min: number;      // Minutes
  typical: number;  // Minutes (used for planning)
  max: number;      // Minutes
}

export const ACTION_DURATIONS: Record<ActionType, ActionDuration> = {
  // Calls
  call: { min: 5, typical: 15, max: 30 },
  call_with_prep: { min: 15, typical: 25, max: 45 },

  // Emails
  email_send_draft: { min: 2, typical: 3, max: 5 },      // AI draft ready
  email_compose: { min: 5, typical: 10, max: 20 },       // Writing from scratch
  email_respond: { min: 3, typical: 8, max: 15 },        // Reply
  respond_email: { min: 5, typical: 10, max: 20 },       // Unified: needs reply
  send_followup: { min: 5, typical: 10, max: 20 },       // Unified: stalled followup

  // Meetings
  meeting_prep: { min: 10, typical: 15, max: 30 },
  meeting_follow_up: { min: 5, typical: 10, max: 20 },
  schedule_meeting: { min: 2, typical: 5, max: 10 },     // Unified: schedule approval

  // Documents
  proposal_review: { min: 15, typical: 30, max: 60 },

  // Social
  linkedin_touch: { min: 2, typical: 3, max: 5 },

  // Research
  research_account: { min: 10, typical: 20, max: 45 },

  // Internal
  internal_sync: { min: 5, typical: 15, max: 30 },

  // Tasks
  task_simple: { min: 2, typical: 5, max: 10 },
  task_complex: { min: 15, typical: 30, max: 60 },

  // Unified (from Daily Driver)
  close_deal: { min: 15, typical: 30, max: 60 },         // Ready to close
  review_flag: { min: 5, typical: 15, max: 30 },         // General flag review
};

/**
 * Get the typical duration for an action type
 */
export function getTypicalDuration(actionType: ActionType): number {
  return ACTION_DURATIONS[actionType]?.typical || 15;
}

/**
 * Get duration with rep-specific overrides
 */
export function getDuration(
  actionType: ActionType,
  repOverrides?: Record<string, number>
): number {
  // Check for rep-specific learned duration
  if (repOverrides && repOverrides[actionType]) {
    return repOverrides[actionType];
  }

  return getTypicalDuration(actionType);
}

/**
 * Estimate total duration for a list of items
 */
export function estimateTotalDuration(
  items: Array<{ action_type: ActionType; estimated_minutes?: number }>,
  repOverrides?: Record<string, number>
): number {
  return items.reduce((total, item) => {
    // Use item's explicit duration if set, otherwise calculate
    const duration = item.estimated_minutes || getDuration(item.action_type, repOverrides);
    return total + duration;
  }, 0);
}

/**
 * Check if items can fit in available time
 */
export function canFitInTime(
  items: Array<{ action_type: ActionType; estimated_minutes?: number }>,
  availableMinutes: number,
  repOverrides?: Record<string, number>
): boolean {
  const totalDuration = estimateTotalDuration(items, repOverrides);
  return totalDuration <= availableMinutes;
}

/**
 * Calculate how many items can fit in available time (greedy)
 */
export function itemsThatFit(
  items: Array<{ action_type: ActionType; estimated_minutes?: number }>,
  availableMinutes: number,
  repOverrides?: Record<string, number>
): number {
  let remaining = availableMinutes;
  let count = 0;

  for (const item of items) {
    const duration = item.estimated_minutes || getDuration(item.action_type, repOverrides);
    if (duration <= remaining) {
      remaining -= duration;
      count++;
    }
  }

  return count;
}
