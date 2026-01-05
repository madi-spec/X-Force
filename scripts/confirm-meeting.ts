/**
 * Manually confirm the meeting for "Follow up Test"
 * Run: npx tsx scripts/confirm-meeting.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUEST_ID = 'af24f23f-7d1f-47f6-8b4f-7f9b193a528c';
// Monday, January 5, 2026 at 11:30 AM EST = 16:30 UTC
const SCHEDULED_TIME = '2026-01-05T16:30:00.000Z';

async function main() {
  console.log('=== Confirming Meeting ===\n');

  // Update the request status
  const { data, error } = await supabase
    .from('scheduling_requests')
    .update({
      status: 'confirmed',
      scheduled_time: SCHEDULED_TIME,
      next_action_type: null,
      next_action_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', REQUEST_ID)
    .select('id, title, status, scheduled_time')
    .single();

  if (error) {
    console.error('Failed to update:', error);
    return;
  }

  console.log('✓ Meeting confirmed!');
  console.log('  Request:', data.title);
  console.log('  Status:', data.status);
  console.log('  Time:', data.scheduled_time);

  // Log the confirmation action
  const { error: actionError } = await supabase
    .from('scheduling_actions')
    .insert({
      scheduling_request_id: REQUEST_ID,
      action_type: 'time_selected',
      time_selected: SCHEDULED_TIME,
      ai_reasoning: 'Prospect accepted "11:30" from counter-proposal (Monday, January 5 at 11:30 AM EST)',
      actor: 'prospect',
      previous_status: 'awaiting_response',
      new_status: 'confirmed',
    });

  if (actionError) {
    console.error('Failed to log action:', actionError);
  } else {
    console.log('✓ Action logged');
  }
}

main().catch(console.error);
