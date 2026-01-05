/**
 * Trigger the counter-proposal flow for the brentallen request
 *
 * This script:
 * 1. Updates the request to have the correct counter-proposed time
 * 2. Sets the next_action_type to process_counter_proposal
 * 3. Triggers the scheduler cron to process it
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REQUEST_ID = 'f784f968-cffa-44d7-ab54-4f4e3b56c0b9';

// The prospect's counter-proposal: Monday at noon = January 5th, 2026 at 12:00 PM EST
const COUNTER_PROPOSED_TIME = '2026-01-05T17:00:00.000Z'; // 12:00 PM EST in UTC

async function main() {
  console.log('Triggering counter-proposal flow for brentallen request...\n');

  // 1. Update the request with the correct counter-proposed time
  console.log('1. Setting counter-proposed time to January 5th, 2026 at 12:00 PM EST...');

  const { error: updateError } = await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: 'process_counter_proposal',
      updated_at: new Date().toISOString()
    })
    .eq('id', REQUEST_ID);

  if (updateError) {
    console.error('Failed to update request:', updateError);
    process.exit(1);
  }

  // 2. Store the counter-proposed time in a scheduling action for reference
  console.log('2. Logging the counter-proposed time...');

  const { error: actionError } = await supabase
    .from('scheduling_actions')
    .insert({
      scheduling_request_id: REQUEST_ID,
      action_type: 'counter_proposal_received',
      ai_reasoning: 'Prospect proposed Monday at noon = January 5th, 2026 at 12:00 PM EST',
      times_proposed: [COUNTER_PROPOSED_TIME],
      previous_status: 'negotiating',
      new_status: 'negotiating',
      actor: 'system',
      created_at: new Date().toISOString(),
    });

  if (actionError) {
    console.error('Failed to log action:', actionError);
    // Continue anyway - this is just for logging
  }

  // 3. Trigger the scheduler cron endpoint
  console.log('3. Triggering scheduler cron...\n');

  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = 'https://x-force-nu.vercel.app';

  try {
    const response = await fetch(`${baseUrl}/api/cron/scheduler`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    });

    const result = await response.json();
    console.log('Scheduler response:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Failed to call scheduler:', err);
  }

  // 4. Wait and check the result
  console.log('\nWaiting 5 seconds for processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 5. Check the updated state
  const { data: updatedRequest } = await supabase
    .from('scheduling_requests')
    .select('status, next_action_type, updated_at')
    .eq('id', REQUEST_ID)
    .single();

  console.log('\nUpdated request state:');
  console.log('  Status:', updatedRequest?.status);
  console.log('  Next action:', updatedRequest?.next_action_type);
  console.log('  Updated at:', updatedRequest?.updated_at);

  // 6. Check for new scheduling actions
  const { data: latestActions } = await supabase
    .from('scheduling_actions')
    .select('action_type, ai_reasoning, created_at')
    .eq('scheduling_request_id', REQUEST_ID)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nLatest actions:');
  latestActions?.forEach((action, i) => {
    console.log(`  ${i + 1}. ${action.action_type}: ${action.ai_reasoning?.substring(0, 100)}...`);
  });

  // 7. Check for drafts in email_messages
  const { data: drafts } = await supabase
    .from('email_messages')
    .select('id, subject, is_draft, created_at')
    .eq('is_draft', true)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\nRecent drafts:');
  if (drafts?.length) {
    drafts.forEach((draft, i) => {
      console.log(`  ${i + 1}. ${draft.subject} (draft=${draft.is_draft})`);
    });
  } else {
    console.log('  No drafts found');
  }

  console.log('\n=== FLOW COMPLETE ===');
  console.log('Check Outlook Drafts folder for the generated email');
}

main().catch(console.error);
