/**
 * Directly reprocess the brentallen counter-proposal using the response processor
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { callAIJson } from '../src/lib/ai/core/aiClient';
import { getPromptWithVariables } from '../src/lib/ai/promptManager';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REQUEST_ID = 'f784f968-cffa-44d7-ab54-4f4e3b56c0b9';
const EMAIL_BODY = 'how about Monday at noon?';
const TIMEZONE = 'America/New_York';

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

async function main() {
  console.log('Direct reprocessing of brentallen counter-proposal...\n');

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;

  // Format today's date for context
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: TIMEZONE,
  });

  console.log('Today formatted:', todayFormatted);

  // Year guidance
  let yearGuidance = '';
  if (currentMonth === 12) {
    yearGuidance = `CRITICAL: We are in December ${currentYear}. Any mention of January, February, or March means ${nextYear}. All dates must be in the FUTURE.`;
  } else if (currentMonth === 1) {
    yearGuidance = `We are in January ${currentYear}. All dates must be in the FUTURE from today.`;
  } else if (currentMonth >= 10) {
    yearGuidance = `Note: Today is in late ${currentYear}. If they mention January/February/March, use ${nextYear}.`;
  }

  console.log('Year guidance:', yearGuidance);

  // Generate calendar context
  const calendarLines: string[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i < 21; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = dayNames[date.getDay()];
    const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: TIMEZONE });
    const dayNum = date.getDate();
    const year = date.getFullYear();
    const suffix = getDaySuffix(dayNum);
    calendarLines.push(`${dayName} = ${monthName} ${dayNum}${suffix}, ${year}`);
  }
  const calendarContext = calendarLines.join('\n');

  console.log('\nCalendar context (first 7 days):');
  calendarLines.slice(0, 7).forEach(line => console.log('  ', line));

  console.log('\nLoading prompt from database...');

  // Load the managed prompt
  const promptResult = await getPromptWithVariables('scheduler_response_parsing', {
    todayFormatted,
    yearGuidance,
    calendarContext,
    proposedTimes: 'None provided',
    emailBody: EMAIL_BODY,
  });

  if (!promptResult || !promptResult.prompt) {
    console.error('Failed to load prompt');
    process.exit(1);
  }

  console.log('\n=== FULL PROMPT BEING SENT TO AI ===');
  console.log(promptResult.prompt);
  console.log('=== END PROMPT ===\n');

  console.log('Calling AI with new calendar-aware prompt...\n');

  // Call AI with the managed prompt
  const { data: response } = await callAIJson<{
    intent: string;
    selectedTime?: string;
    counterProposedTimes?: Array<{ description: string; isoTimestamp: string; displayText: string }>;
    question?: string;
    sentiment: string;
    confidence: string;
    reasoning: string;
  }>({
    prompt: promptResult.prompt,
    schema: promptResult.schema || undefined,
    model: (promptResult.model as any) || 'claude-sonnet-4-20250514',
    maxTokens: promptResult.maxTokens || 1000,
  });

  console.log('=== AI RESPONSE ===');
  console.log('Intent:', response.intent);
  console.log('Confidence:', response.confidence);
  console.log('Sentiment:', response.sentiment);
  console.log('Reasoning:', response.reasoning);

  if (response.counterProposedTimes && response.counterProposedTimes.length > 0) {
    console.log('\nCounter-proposed times:');
    response.counterProposedTimes.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.description}`);
      console.log(`     ISO: ${t.isoTimestamp}`);
      console.log(`     Display: ${t.displayText}`);
    });
  }

  // Now update the database with the correct interpretation
  if (response.intent === 'counter_propose' && response.counterProposedTimes?.length) {
    console.log('\n\nUpdating database with correct counter-proposal...');

    const counterTimes = response.counterProposedTimes.map(t => t.isoTimestamp);

    const { error: updateError } = await supabase
      .from('scheduling_requests')
      .update({
        status: 'negotiating',
        next_action_type: 'review_counter_proposal',
        counter_proposed_times: counterTimes,
        updated_at: new Date().toISOString()
      })
      .eq('id', REQUEST_ID);

    if (updateError) {
      console.error('Failed to update request:', updateError);
    } else {
      console.log('Request updated successfully!');
    }

    // Log a new action with the corrected reasoning
    const { error: actionError } = await supabase
      .from('scheduling_actions')
      .insert({
        scheduling_request_id: REQUEST_ID,
        action_type: 'response_analyzed',
        ai_reasoning: response.reasoning,
        times_proposed: counterTimes,
        previous_status: 'negotiating',
        new_status: 'negotiating',
        actor: 'system',
        created_at: new Date().toISOString(),
      });

    if (actionError) {
      console.error('Failed to log action:', actionError);
    } else {
      console.log('Action logged successfully!');
    }
  }

  console.log('\n=== REPROCESSING COMPLETE ===');
}

main().catch(console.error);
