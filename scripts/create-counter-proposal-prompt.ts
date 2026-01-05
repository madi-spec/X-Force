/**
 * Create the scheduler_counter_proposal_response prompt in the database
 *
 * This prompt generates email responses for counter-proposals:
 * - When the proposed time IS available: confirmation email
 * - When the proposed time is NOT available: alternatives email focused around their request
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PROMPT_KEY = 'scheduler_counter_proposal_response';

const PROMPT_TEMPLATE = `Generate an email response to a prospect's counter-proposal for a meeting.

## Context
- Prospect name: {{prospectName}}
- Company: {{companyName}}
- Meeting title: {{meetingTitle}}
- Their proposed time: {{proposedTime}}
- Is their time available: {{isAvailable}}
- Alternative times (if not available): {{alternativeTimes}}
- Times they previously declined (DO NOT suggest these): {{declinedTimes}}
- Our sender name: {{senderName}}

## Scenario
{{#if isAvailable}}
The prospect's suggested time WORKS for our team. Generate a confirmation email.
{{else}}
The prospect's suggested time does NOT work for our team. Generate an email with alternative times.
The alternatives should be focused around the day and time they requested.
{{/if}}

## Requirements
1. Keep the tone warm, professional, and appreciative
2. Be concise - 3-4 sentences max for the body
3. If suggesting alternatives:
   - Acknowledge their suggested time politely
   - Briefly mention it doesn't work (without over-explaining)
   - Focus on times similar to what they asked for
   - Present alternatives as bullet points
4. If confirming:
   - Express enthusiasm about connecting
   - Confirm the exact time clearly
   - Mention a calendar invite will follow
5. Sign off with just the sender's first name
6. DO NOT use overly formal language
7. DO NOT apologize excessively
8. DO NOT include a subject line (we handle that separately)

## Output Format
Return ONLY the email body text. No JSON, no subject line, just the email content.`;

const SCHEMA_TEMPLATE = null; // Plain text output, no JSON schema

async function main() {
  console.log('Creating scheduler_counter_proposal_response prompt...\n');

  // Check if prompt already exists
  const { data: existing } = await supabase
    .from('ai_prompts')
    .select('id, key')
    .eq('key', PROMPT_KEY)
    .single();

  if (existing) {
    console.log('Prompt already exists, updating...');

    const { data: updated, error: updateError } = await supabase
      .from('ai_prompts')
      .update({
        name: 'Counter-Proposal Response',
        description: 'Generates email responses for counter-proposals - confirmations when time works, alternatives when it doesn\'t',
        prompt_template: PROMPT_TEMPLATE,
        schema_template: SCHEMA_TEMPLATE,
        variables: ['prospectName', 'companyName', 'meetingTitle', 'proposedTime', 'isAvailable', 'alternativeTimes', 'declinedTimes', 'senderName'],
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        category: 'scheduler',
        purpose: 'email_generation',
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('key', PROMPT_KEY)
      .select('id, key, name')
      .single();

    if (updateError) {
      console.error('Failed to update prompt:', updateError);
      process.exit(1);
    }

    console.log('Updated:', updated);
  } else {
    console.log('Creating new prompt...');

    const { data: created, error: createError } = await supabase
      .from('ai_prompts')
      .insert({
        key: PROMPT_KEY,
        name: 'Counter-Proposal Response',
        description: 'Generates email responses for counter-proposals - confirmations when time works, alternatives when it doesn\'t',
        prompt_template: PROMPT_TEMPLATE,
        default_prompt_template: PROMPT_TEMPLATE,
        schema_template: SCHEMA_TEMPLATE,
        default_schema_template: SCHEMA_TEMPLATE,
        variables: ['prospectName', 'companyName', 'meetingTitle', 'proposedTime', 'isAvailable', 'alternativeTimes', 'declinedTimes', 'senderName'],
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        category: 'scheduler',
        purpose: 'email_generation',
        is_active: true,
        display_order: 100,
      })
      .select('id, key, name')
      .single();

    if (createError) {
      console.error('Failed to create prompt:', createError);
      process.exit(1);
    }

    console.log('Created:', created);
  }

  console.log('\nPrompt is now available at: https://x-force-nu.vercel.app/settings/ai-prompts');
  console.log('Key:', PROMPT_KEY);
}

main().catch(console.error);
