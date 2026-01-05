/**
 * Fix the entity_matching prompt in ai_prompts table
 *
 * The prompt was configured for transcript analysis but the entityMatcher code
 * uses it for email/communication matching with different variables.
 *
 * Run: npx tsx scripts/fix-entity-matching-prompt.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORRECT_PROMPT = `You are matching an incoming communication to existing CRM records.

## THE COMMUNICATION
Type: {{communicationType}}
From: {{fromEmail}} {{fromName}}
Subject: {{subject}}
Content Preview:
{{contentPreview}}

## RAW IDENTIFIERS EXTRACTED
Emails mentioned: {{emailsMentioned}}
Phones mentioned: {{phonesMentioned}}
Names mentioned: {{namesMentioned}}
Company mentions: {{companyMentions}}
Email domain: {{emailDomain}}

## CANDIDATE COMPANIES IN OUR CRM
{{candidateCompanies}}

## CANDIDATE CONTACTS IN OUR CRM
{{candidateContacts}}

## YOUR TASK
Determine which company and contact this communication is from/about.

Return JSON only:
{
  "company_match": { "match_type": "exact|confident|probable|none", "company_id": "uuid or null", "reasoning": "string", "confidence": 0.0-1.0 },
  "contact_match": { "match_type": "exact|confident|probable|none", "contact_id": "uuid or null", "reasoning": "string", "confidence": 0.0-1.0 },
  "create_company": { "should_create": true/false, "suggested_name": "string or null", "suggested_domain": "string or null", "suggested_industry": "string or null", "reasoning": "string" },
  "create_contact": { "should_create": true/false, "suggested_name": "string or null", "suggested_email": "string or null", "suggested_phone": "string or null", "suggested_title": "string or null", "reasoning": "string" },
  "overall_confidence": 0.0-1.0,
  "overall_reasoning": "string"
}`;

const CORRECT_VARIABLES = [
  'communicationType',
  'fromEmail',
  'fromName',
  'subject',
  'contentPreview',
  'emailsMentioned',
  'phonesMentioned',
  'namesMentioned',
  'companyMentions',
  'emailDomain',
  'candidateCompanies',
  'candidateContacts'
];

async function main() {
  console.log('=== Fixing entity_matching prompt ===\n');

  // Get current state
  const { data: current, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('id, key, prompt_template, variables, version')
    .eq('key', 'entity_matching')
    .single();

  if (fetchError || !current) {
    console.error('Failed to fetch current prompt:', fetchError);
    return;
  }

  console.log('Current prompt variables:', current.variables);
  console.log('Current version:', current.version);
  console.log('');

  // Update the prompt
  const { error: updateError } = await supabase
    .from('ai_prompts')
    .update({
      prompt_template: CORRECT_PROMPT,
      default_prompt_template: CORRECT_PROMPT,
      variables: CORRECT_VARIABLES,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'entity_matching');

  if (updateError) {
    console.error('Failed to update prompt:', updateError);
    return;
  }

  console.log('✓ Updated entity_matching prompt');
  console.log('  New variables:', CORRECT_VARIABLES);
  console.log('  New version:', current.version + 1);
}

main().catch(console.error);
