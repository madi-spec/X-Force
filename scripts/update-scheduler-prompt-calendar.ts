/**
 * Update the scheduler_response_parsing prompt to include calendar context
 *
 * This fixes the persistent day/date mismatch issue where the AI incorrectly
 * maps day names to dates (e.g., saying "Monday January 6th" when Monday is
 * actually January 5th).
 *
 * The fix adds an explicit calendar reference for the next 3 weeks that the AI
 * MUST use instead of relying on its own knowledge.
 *
 * Run with: npx tsx scripts/update-scheduler-prompt-calendar.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const NEW_PROMPT_TEMPLATE = `Analyze this email response to a meeting scheduling request.

TODAY'S DATE: {{todayFormatted}}
{{yearGuidance}}

## CALENDAR REFERENCE (USE THIS - DO NOT GUESS DAY/DATE MAPPINGS)
{{calendarContext}}

CRITICAL: When the prospect mentions a day name (e.g., "Monday"), you MUST look up the exact date in the calendar reference above. Do NOT rely on your internal knowledge of which date corresponds to which day - use ONLY the calendar reference provided.

## Proposed Times
{{proposedTimes}}

## Email Response
{{emailBody}}

## Task
Determine:
1. Intent: Are they accepting a time, declining, proposing alternatives, asking a question, or unclear?
2. If accepting: Which specific time did they select?
3. If counter-proposing: What times are they suggesting? Return these as ISO timestamps
   - IMPORTANT: Use the CALENDAR REFERENCE above to convert day names to dates
   - Example: If they say "Monday at noon" and the calendar shows "Monday = January 5th, 2026", then the date is January 5th, 2026
4. If questioning: What is their question?
5. Overall sentiment toward the meeting`;

const NEW_VARIABLES = ['todayFormatted', 'yearGuidance', 'calendarContext', 'proposedTimes', 'emailBody'];

async function main() {
  console.log('Updating scheduler_response_parsing prompt...\n');

  // First, get the current prompt to show the diff
  const { data: current, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('id, prompt_template, variables')
    .eq('key', 'scheduler_response_parsing')
    .single();

  if (fetchError) {
    console.error('Failed to fetch current prompt:', fetchError);
    process.exit(1);
  }

  console.log('Current variables:', current.variables);
  console.log('New variables:', NEW_VARIABLES);
  console.log('\nUpdating prompt template and variables...\n');

  // Update the prompt
  const { data: updated, error: updateError } = await supabase
    .from('ai_prompts')
    .update({
      prompt_template: NEW_PROMPT_TEMPLATE,
      variables: NEW_VARIABLES,
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'scheduler_response_parsing')
    .select('id, key, variables')
    .single();

  if (updateError) {
    console.error('Failed to update prompt:', updateError);
    process.exit(1);
  }

  console.log('Successfully updated prompt!');
  console.log('Updated record:', updated);
  console.log('\nThe scheduler will now use explicit calendar context to map day names to dates.');
  console.log('Example calendar context that will be injected:');
  console.log('---');

  // Show example of what the calendar context looks like
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getDaySuffix(day: number): string {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = dayNames[date.getDay()];
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const dayNum = date.getDate();
    const year = date.getFullYear();
    const suffix = getDaySuffix(dayNum);
    console.log(`${dayName} = ${monthName} ${dayNum}${suffix}, ${year}`);
  }
  console.log('... (21 days total)');
}

main().catch(console.error);
