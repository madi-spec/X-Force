/**
 * Reprocess the brentallen counter-proposal with the updated calendar context
 *
 * This script:
 * 1. Finds the pending email response
 * 2. Re-runs the response processor with the new calendar-aware prompt
 * 3. Shows the corrected date interpretation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REQUEST_ID = 'f784f968-cffa-44d7-ab54-4f4e3b56c0b9';

async function main() {
  console.log('Reprocessing brentallen counter-proposal...\n');

  // Get the request details
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('*, attendees:scheduling_attendees(*)')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError || !request) {
    console.error('Failed to find request:', reqError);
    process.exit(1);
  }

  console.log('Current request status:', request.status);
  console.log('Thread ID:', request.email_thread_id);
  console.log('Next action:', request.next_action_type);

  // Reset the status to awaiting_response to trigger reprocessing
  console.log('\nResetting status to awaiting_response...');

  const { error: updateError } = await supabase
    .from('scheduling_requests')
    .update({
      status: 'awaiting_response',
      next_action_type: 'process_response',
      updated_at: new Date().toISOString()
    })
    .eq('id', REQUEST_ID);

  if (updateError) {
    console.error('Failed to reset status:', updateError);
    process.exit(1);
  }

  console.log('Status reset. Triggering scheduler cron...\n');

  // Call the scheduler cron endpoint
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

  // Wait a moment for processing
  console.log('\nWaiting for processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check the new state
  const { data: updatedRequest } = await supabase
    .from('scheduling_requests')
    .select('status, next_action_type, counter_proposed_times')
    .eq('id', REQUEST_ID)
    .single();

  console.log('\nUpdated request state:');
  console.log('  Status:', updatedRequest?.status);
  console.log('  Next action:', updatedRequest?.next_action_type);
  console.log('  Counter proposed times:', updatedRequest?.counter_proposed_times);

  // Check the latest action's ai_reasoning
  const { data: latestAction } = await supabase
    .from('scheduling_actions')
    .select('action_type, ai_reasoning, times_proposed, created_at')
    .eq('scheduling_request_id', REQUEST_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('\nLatest action:');
  console.log('  Type:', latestAction?.action_type);
  console.log('  Reasoning:', latestAction?.ai_reasoning);
  console.log('  Times proposed:', latestAction?.times_proposed);
}

main().catch(console.error);
