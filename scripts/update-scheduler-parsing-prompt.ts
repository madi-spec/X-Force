/**
 * Update the scheduler_response_parsing prompt to handle:
 * 1. Out-of-office responses → flag for human review
 * 2. Additional attendees (CC'd or mentioned in body)
 * 3. Validate times are minimum 4 hours in the future
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const UPDATED_PROMPT_TEMPLATE = `Analyze this email response to a meeting scheduling request.

TODAY'S DATE AND TIME: {{todayFormatted}}
CURRENT TIMESTAMP (UTC): {{currentTimestamp}}
{{yearGuidance}}

## CALENDAR REFERENCE (USE THIS - DO NOT GUESS DAY/DATE MAPPINGS)
{{calendarContext}}

CRITICAL: When the prospect mentions a day name (e.g., "Monday"), you MUST look up the exact date in the calendar reference above. Do NOT rely on your internal knowledge of which date corresponds to which day - use ONLY the calendar reference provided.

## TIME VALIDATION RULES
- ALL suggested or accepted times MUST be at least 4 hours in the future from the current timestamp
- If a prospect suggests a time that has already passed OR is less than 4 hours away, flag it as "time_in_past" intent
- NEVER accept or confirm a meeting time that violates this rule

## Proposed Times We Offered
{{proposedTimes}}

## Email Response to Analyze
{{emailBody}}

## CC Recipients on This Email (if any)
{{ccRecipients}}

## Task
Analyze the response and determine:

1. **Intent Detection** - What is the prospect's primary intent?
   - "accept" - They're accepting one of our proposed times
   - "decline" - They're declining to meet entirely
   - "counter_propose" - They're suggesting different times
   - "question" - They're asking a question before committing
   - "out_of_office" - This is an auto-reply/OOO message (vacation, leave, etc.)
   - "add_attendees" - They want to add people to the meeting
   - "time_in_past" - They suggested a time that has passed or is <4 hours away
   - "unclear" - Cannot determine intent

2. **Out-of-Office Detection**
   Look for indicators like:
   - "I am out of the office"
   - "I will be away"
   - "automatic reply"
   - "auto-reply"
   - "vacation"
   - "returning on [date]"
   - "limited access to email"
   If detected, set intent to "out_of_office" and extract return date if mentioned.

3. **Additional Attendees Detection**
   Check for:
   - People CC'd on the reply (provided in ccRecipients)
   - Email addresses mentioned in the body (e.g., "please add john@company.com")
   - Names mentioned to add (e.g., "can you include Sarah from our team?")
   - Phrases like "I'd like to bring...", "please include...", "adding my colleague..."
   Extract ALL additional attendees with their email addresses if available.

4. **Time Selection/Counter-Proposal**
   - If accepting: Which specific time did they select? Verify it's 4+ hours from now.
   - If counter-proposing: What times are they suggesting?
     - Convert day names to dates using the CALENDAR REFERENCE
     - Return as ISO timestamps
     - Flag if any suggested time is in the past or <4 hours away

5. **Sentiment** - Overall feeling toward the meeting (positive/neutral/negative)

## Output Schema
Return a JSON object with these fields:
- intent: One of the intent values above
- selectedTime: ISO timestamp if they accepted a specific time (null otherwise)
- counterProposedTimes: Array of {description, isoTimestamp, displayText} if counter-proposing
- question: Their question text if asking one (null otherwise)
- additionalAttendees: Array of {name, email} for anyone they want added to the meeting
- outOfOfficeReturnDate: ISO date string if OOO with return date mentioned (null otherwise)
- requiresHumanReview: true if intent is out_of_office, add_attendees, time_in_past, or unclear
- humanReviewReason: Explanation of why human review is needed (null if not needed)
- sentiment: "positive" | "neutral" | "negative"
- confidence: "high" | "medium" | "low"
- reasoning: Brief explanation of your analysis`;

const UPDATED_SCHEMA_TEMPLATE = `{
  "intent": "accept|decline|counter_propose|question|out_of_office|add_attendees|time_in_past|unclear",
  "selectedTime": "ISO timestamp if they selected a specific time, null otherwise",
  "counterProposedTimes": [
    {
      "description": "What they said (e.g., 'Monday at noon')",
      "isoTimestamp": "2026-01-05T17:00:00.000Z",
      "displayText": "Monday, January 5th at 12:00 PM EST"
    }
  ],
  "question": "Their question if asking one, null otherwise",
  "additionalAttendees": [
    {
      "name": "Person's name if known",
      "email": "email@example.com if provided"
    }
  ],
  "outOfOfficeReturnDate": "ISO date if OOO with return date, null otherwise",
  "requiresHumanReview": true,
  "humanReviewReason": "Explanation for why human review is needed",
  "sentiment": "positive|neutral|negative",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of your analysis"
}`;

const UPDATED_VARIABLES = [
  'todayFormatted',
  'currentTimestamp',
  'yearGuidance',
  'calendarContext',
  'proposedTimes',
  'emailBody',
  'ccRecipients',
];

async function main() {
  console.log('Updating scheduler_response_parsing prompt...\n');

  // First, get the current prompt to show what's changing
  const { data: current, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('prompt_template, schema_template, variables')
    .eq('key', 'scheduler_response_parsing')
    .single();

  if (fetchError) {
    console.error('Failed to fetch current prompt:', fetchError);
    process.exit(1);
  }

  console.log('=== CURRENT PROMPT ===');
  console.log('Variables:', current.variables);
  console.log('Schema:', current.schema_template?.substring(0, 200) + '...');
  console.log();

  console.log('=== PROPOSED CHANGES ===');
  console.log('New variables:', UPDATED_VARIABLES);
  console.log('New intents: out_of_office, add_attendees, time_in_past');
  console.log('New fields: additionalAttendees, outOfOfficeReturnDate, requiresHumanReview, humanReviewReason');
  console.log();

  // Update the prompt
  const { data: updated, error: updateError } = await supabase
    .from('ai_prompts')
    .update({
      prompt_template: UPDATED_PROMPT_TEMPLATE,
      schema_template: UPDATED_SCHEMA_TEMPLATE,
      variables: UPDATED_VARIABLES,
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'scheduler_response_parsing')
    .select('id, key, name, updated_at')
    .single();

  if (updateError) {
    console.error('Failed to update prompt:', updateError);
    process.exit(1);
  }

  console.log('=== UPDATE SUCCESSFUL ===');
  console.log('Updated prompt:', updated);
  console.log();

  console.log('The scheduler_response_parsing prompt now handles:');
  console.log('  1. ✅ Out-of-office responses → sets requiresHumanReview: true');
  console.log('  2. ✅ Additional attendees → extracts from CC and email body');
  console.log('  3. ✅ Time validation → flags times <4 hours in future');
  console.log();
  console.log('View at: https://x-force-nu.vercel.app/settings/ai-prompts');
}

main().catch(console.error);
