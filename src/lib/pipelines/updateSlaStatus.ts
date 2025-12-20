/**
 * Pipeline 5: Update SLA Status
 *
 * Updates sla_status for Tier 1 items based on elapsed time:
 * - on_track: Less than 75% of SLA elapsed
 * - warning: 75-100% of SLA elapsed
 * - breached: Over 100% of SLA elapsed
 *
 * Also updates the urgency_score to reflect SLA breach severity.
 */

import { createClient } from '@/lib/supabase/server';
import type { TierSlaStatus } from '@/types/commandCenter';

interface Tier1Item {
  id: string;
  user_id: string;
  received_at: string;
  sla_minutes: number;
  sla_status: TierSlaStatus;
  urgency_score: number;
  due_at: string | null;
}

interface PipelineResult {
  itemsProcessed: number;
  statusChanges: {
    toWarning: number;
    toBreached: number;
    toOnTrack: number;
  };
  errors: string[];
}

/**
 * Calculate SLA status based on elapsed time
 */
function calculateSlaStatus(
  receivedAt: string,
  slaMinutes: number
): { status: TierSlaStatus; percentElapsed: number } {
  const received = new Date(receivedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - received.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const percentElapsed = (elapsedMinutes / slaMinutes) * 100;

  let status: TierSlaStatus;
  if (percentElapsed >= 100) {
    status = 'breached';
  } else if (percentElapsed >= 75) {
    status = 'warning';
  } else {
    status = 'on_track';
  }

  return { status, percentElapsed };
}

/**
 * Calculate urgency score based on SLA breach severity
 */
function calculateUrgencyScore(percentElapsed: number): number {
  // Base score starts at 50
  // Increases as we approach and pass the SLA
  if (percentElapsed >= 200) {
    return 100; // Severely breached
  }
  if (percentElapsed >= 150) {
    return 95;
  }
  if (percentElapsed >= 100) {
    return 90; // Just breached
  }
  if (percentElapsed >= 90) {
    return 85;
  }
  if (percentElapsed >= 75) {
    return 75; // Warning zone
  }
  if (percentElapsed >= 50) {
    return 60;
  }
  return 50; // Healthy
}

/**
 * Update the why_now text based on SLA status
 */
function updateWhyNow(
  currentWhyNow: string | null,
  slaStatus: TierSlaStatus,
  percentElapsed: number,
  slaMinutes: number
): string {
  const minutesElapsed = (slaMinutes * percentElapsed) / 100;

  // Format elapsed time
  let elapsedText: string;
  if (minutesElapsed < 60) {
    elapsedText = `${Math.round(minutesElapsed)} minute${Math.round(minutesElapsed) !== 1 ? 's' : ''}`;
  } else if (minutesElapsed < 1440) {
    const hours = Math.round(minutesElapsed / 60);
    elapsedText = `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    const days = Math.round(minutesElapsed / 1440);
    elapsedText = `${days} day${days !== 1 ? 's' : ''}`;
  }

  if (slaStatus === 'breached') {
    // Extract the action from current why_now or use default
    const match = currentWhyNow?.match(/asked for a demo|asked about pricing|wants to schedule|sent a question/i);
    const action = match?.[0] || 'reached out';
    return `OVERDUE: They ${action} ${elapsedText} ago. Respond now!`;
  }

  if (slaStatus === 'warning') {
    const match = currentWhyNow?.match(/asked for a demo|asked about pricing|wants to schedule|sent a question/i);
    const action = match?.[0] || 'reached out';
    return `SLA warning: They ${action} ${elapsedText} ago. Response due soon.`;
  }

  // Keep original for on_track
  return currentWhyNow || 'Response needed';
}

/**
 * Main pipeline function: Update SLA statuses
 */
export async function updateSlaStatus(userId?: string): Promise<PipelineResult> {
  const supabase = await createClient();
  const result: PipelineResult = {
    itemsProcessed: 0,
    statusChanges: {
      toWarning: 0,
      toBreached: 0,
      toOnTrack: 0,
    },
    errors: [],
  };

  // Query for pending Tier 1 items with SLA tracking
  let query = supabase
    .from('command_center_items')
    .select('id, user_id, received_at, sla_minutes, sla_status, urgency_score, due_at, why_now')
    .eq('tier', 1)
    .eq('status', 'pending')
    .not('sla_minutes', 'is', null)
    .not('received_at', 'is', null);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: items, error } = await query;

  if (error) {
    result.errors.push(`Query error: ${error.message}`);
    return result;
  }

  if (!items || items.length === 0) {
    return result;
  }

  for (const item of items as (Tier1Item & { why_now: string | null })[]) {
    try {
      result.itemsProcessed++;

      const { status: newStatus, percentElapsed } = calculateSlaStatus(
        item.received_at,
        item.sla_minutes
      );

      // Only update if status changed or urgency score changed significantly
      const newUrgency = calculateUrgencyScore(percentElapsed);
      const urgencyChanged = Math.abs(newUrgency - item.urgency_score) >= 5;
      const statusChanged = newStatus !== item.sla_status;

      if (statusChanged || urgencyChanged) {
        const newWhyNow = statusChanged
          ? updateWhyNow(item.why_now, newStatus, percentElapsed, item.sla_minutes)
          : item.why_now;

        await supabase
          .from('command_center_items')
          .update({
            sla_status: newStatus,
            urgency_score: newUrgency,
            why_now: newWhyNow,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Track status changes
        if (statusChanged) {
          if (newStatus === 'warning') {
            result.statusChanges.toWarning++;
          } else if (newStatus === 'breached') {
            result.statusChanges.toBreached++;
          } else {
            result.statusChanges.toOnTrack++;
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Item ${item.id}: ${errorMsg}`);
    }
  }

  return result;
}

export default updateSlaStatus;
