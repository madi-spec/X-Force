/**
 * Create command center item for the stuck AI Agents scheduling request
 * Run: npx tsx scripts/create-cc-item-for-stuck-request.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUEST_ID = '67c2d834-2fa4-48e5-954e-2e527d64d4bf';

async function main() {
  console.log('Creating command center item for stuck AI Agents request...\n');

  // Get request details
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError || !request) {
    console.error('Failed to get request:', reqError);
    return;
  }

  console.log('Request:', request.title);
  console.log('Status:', request.status);
  console.log('Next action:', request.next_action_type);

  // Check if a CC item already exists
  const { data: existingItem } = await supabase
    .from('command_center_items')
    .select('id')
    .eq('source', 'scheduler')
    .eq('source_id', REQUEST_ID)
    .maybeSingle();

  if (existingItem) {
    console.log('\nCommand center item already exists:', existingItem.id);
    return;
  }

  // Create the command center item
  const { data: newItem, error: insertError } = await supabase
    .from('command_center_items')
    .insert({
      user_id: request.created_by,
      action_type: 'scheduling_review',
      title: `📅 Review scheduling: ${request.title}`,
      description: 'Automation fallback: Proposed time is in the past. Please review and respond manually.',
      base_priority: 80,
      tier: 1,
      status: 'pending',
      score_factors: {
        scheduling_request_id: REQUEST_ID,
        reason: 'Proposed time is in the past',
      },
      source: 'scheduler',
      source_id: REQUEST_ID,
      due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      why_now: 'Prospect counter-proposed a time that has passed. Manual response needed.',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('\nFailed to create CC item:', insertError);
    return;
  }

  console.log('\n✓ Created command center item:', newItem.id);
  console.log('  The item should now appear in the work queue.');
}

main().catch(console.error);
