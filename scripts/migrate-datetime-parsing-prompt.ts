/**
 * Migrate the hardcoded parseProposedDateTime prompt to a managed prompt
 *
 * This creates a new AI prompt: scheduler_datetime_parsing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PROMPT_TEMPLATE = `Parse this proposed meeting time into an ISO timestamp.

TODAY'S DATE: {{todayFormatted}}
CURRENT YEAR: {{currentYear}}
{{timezoneInfo}}

TIME DESCRIPTION: "{{timeDescription}}"

FULL EMAIL CONTEXT:
{{emailContext}}

CRITICAL DATE PARSING RULES:

RULE 1 - SPECIFIC DATE NUMBER TAKES PRIORITY:
When someone says "[day] the [number]" (e.g., "Monday the 5th", "Tuesday the 14th"):
- The NUMBER is the most important part - they mean the Xth day of a month
- Find the NEAREST FUTURE date where the Xth falls on that day of week
- Example: Today is Dec 27, 2025. "Monday the 5th" = January 5, {{nextYear}} (because Jan 5, {{nextYear}} is a Monday)
- Do NOT interpret this as just "next Monday" - the person explicitly mentioned "the 5th"

RULE 2 - YEAR DETERMINATION:
- The meeting MUST be in the FUTURE. Never return a date in the past.
- {{yearGuidance}}
- If we're in late December and they mention early January dates, use {{nextYear}}.
- ALWAYS double-check: Is the resulting date AFTER {{todayFormatted}}? If not, add a year.

RULE 3 - DAY/DATE MISMATCH:
- If they say "Monday the 5th" and the 5th isn't actually a Monday in the nearest month, prioritize the DATE NUMBER over the day name
- People often get day names wrong but rarely get date numbers wrong

RULE 4 - TIMEZONE HANDLING (CRITICAL):
{{timestampInstructions}}

Return a JSON object with:
- isoTimestamp: The ISO timestamp string WITH TIMEZONE (e.g., "{{nextYear}}-01-05T14:00:00-05:00" for 2pm EST), or null if unparseable
- confidence: "high", "medium", or "low"
- reasoning: Brief explanation including the timezone interpretation`;

const SYSTEM_PROMPT = `You are an expert at parsing natural language date/time expressions into precise timestamps.

CRITICAL TIMEZONE RULE: The user is in {{timezone}}. When they say "2pm" they mean 2pm in THEIR timezone, not UTC.
- If they say "2pm EST", return "...T14:00:00-05:00" (with -05:00 offset)
- If they say "2pm" without timezone, assume {{timezone}} and include the appropriate offset
- NEVER return a bare timestamp like "...T14:00:00" without timezone info

CRITICAL DATE RULE: When someone says "[day] the [number]" like "Monday the 5th", the DATE NUMBER is the key information - find the nearest future month where the Xth day matches (or is close to) that day of week.`;

const SCHEMA_TEMPLATE = `{
  "isoTimestamp": "ISO 8601 timestamp string WITH timezone offset (e.g., 2026-01-05T14:00:00-05:00) or null if unparseable",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation including timezone interpretation"
}`;

const VARIABLES = [
  'todayFormatted',
  'currentYear',
  'nextYear',
  'timezoneInfo',
  'timeDescription',
  'emailContext',
  'yearGuidance',
  'timestampInstructions',
  'timezone',
];

async function main() {
  console.log('Migrating parseProposedDateTime to managed prompt...\n');

  // Check if prompt already exists
  const { data: existing } = await supabase
    .from('ai_prompts')
    .select('id, key')
    .eq('key', 'scheduler_datetime_parsing')
    .single();

  // Include system prompt in the prompt_template itself since there's no system_prompt column
  const fullPromptTemplate = `${SYSTEM_PROMPT}

---

${PROMPT_TEMPLATE}`;

  if (existing) {
    console.log('Prompt already exists, updating...');

    const { data: updated, error } = await supabase
      .from('ai_prompts')
      .update({
        name: 'DateTime Parsing',
        description: 'Parses natural language date/time expressions (e.g., "Monday the 5th at noon") into ISO timestamps with timezone awareness.',
        prompt_template: fullPromptTemplate,
        schema_template: SCHEMA_TEMPLATE,
        variables: VARIABLES,
        model: 'claude-3-haiku-20240307', // Fast model for simple parsing
        max_tokens: 500,
        category: 'scheduler',
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('key', 'scheduler_datetime_parsing')
      .select('id, key, name')
      .single();

    if (error) {
      console.error('Failed to update:', error);
      process.exit(1);
    }

    console.log('Updated:', updated);
  } else {
    console.log('Creating new prompt...');

    const { data: created, error } = await supabase
      .from('ai_prompts')
      .insert({
        key: 'scheduler_datetime_parsing',
        name: 'DateTime Parsing',
        description: 'Parses natural language date/time expressions (e.g., "Monday the 5th at noon") into ISO timestamps with timezone awareness.',
        prompt_template: fullPromptTemplate,
        default_prompt_template: fullPromptTemplate,
        schema_template: SCHEMA_TEMPLATE,
        default_schema_template: SCHEMA_TEMPLATE,
        variables: VARIABLES,
        model: 'claude-3-haiku-20240307', // Fast model for simple parsing
        max_tokens: 500,
        category: 'scheduler',
        is_active: true,
      })
      .select('id, key, name')
      .single();

    if (error) {
      console.error('Failed to create:', error);
      process.exit(1);
    }

    console.log('Created:', created);
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log('New prompt: scheduler_datetime_parsing');
  console.log('View at: https://x-force-nu.vercel.app/settings/ai-prompts');
  console.log('\nNext: Update responseProcessor.ts to use the managed prompt');
}

main().catch(console.error);
