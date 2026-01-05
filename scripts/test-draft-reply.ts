import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  // Get the updated prompt
  const { data: prompt, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('key', 'email_followup_needs_reply')
    .single();

  if (error || !prompt) {
    console.log('Error:', error?.message);
    return;
  }

  console.log('=== Prompt version:', prompt.version, '===\n');

  // Get user
  const { data: conn } = await supabase
    .from('microsoft_connections')
    .select('user_id')
    .eq('is_active', true)
    .single();

  if (!conn) {
    console.log('No active Microsoft connection');
    return;
  }

  // Get real available slots
  const { getRealAvailableSlots, formatSlotsForPrompt } = await import('../src/lib/scheduler/calendarIntegration');

  console.log('Fetching calendar availability...');
  const { slots, error: calendarError } = await getRealAvailableSlots(conn.user_id, {
    daysAhead: 15,
    slotDuration: 30,
    maxSlots: 4,
    timezone: 'America/New_York',
  });

  const availableTimesText = calendarError
    ? 'Calendar not available'
    : formatSlotsForPrompt(slots);

  console.log('\nAvailable times for prompt:');
  console.log(availableTimesText);

  // Simulate temporal context (email from Dec 24)
  const emailDate = new Date('2024-12-24');
  const now = new Date();
  const daysSinceEmail = Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24));

  let temporalContext = '';
  if (daysSinceEmail <= 7) {
    temporalContext = `This email was sent ${daysSinceEmail} days ago.`;
  } else if (daysSinceEmail <= 14) {
    temporalContext = `This email was sent ${daysSinceEmail} days ago. Acknowledge the delay appropriately.`;
  } else {
    temporalContext = `This email was sent ${daysSinceEmail} days ago (${Math.round(daysSinceEmail / 7)} weeks ago). This is a late response - acknowledge the delay and re-engage warmly.`;
  }

  const stageContext = 'They have ACCESS to the platform and are actively testing it. Do NOT offer to "show" them features - they can already see it. Focus on: How is the trial going? What questions do they have? Any obstacles? What results are they seeing?';

  // Build sample variables (simulating Atlantic Pest)
  const variables: Record<string, string> = {
    company_name: 'Atlantic Pest Control',
    contact_first_name: 'Charlie',
    product_name: 'X-RAI',
    stage_name: 'Trial',
    stage_context: stageContext,
    temporal_context: temporalContext,
    email_date: emailDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    current_date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    last_inbound_summary: 'No worries at all - these things happen! I appreciate you letting me know. Yes, lets reconnect after the new year and figure out where we are at. Happy New Year!',
    available_times: availableTimesText,
  };

  console.log('\n=== Variables being passed ===');
  for (const [key, value] of Object.entries(variables)) {
    console.log(`  ${key}: ${value.slice(0, 100)}${value.length > 100 ? '...' : ''}`);
  }

  // Replace variables in template
  let filledPrompt = prompt.prompt_template;
  for (const [varName, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
    filledPrompt = filledPrompt.replace(regex, value || '');
  }

  console.log('\n=== Filled Prompt Template ===');
  console.log(filledPrompt);
}

test().catch(console.error);
