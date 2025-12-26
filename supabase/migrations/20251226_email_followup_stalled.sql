-- Email Follow-up Stalled Prompt
-- Used by Daily Driver to generate follow-up emails for stalled deals
-- IMPORTANT: product_name is MANDATORY and must be referenced in the output

INSERT INTO ai_prompts (
  key,
  name,
  description,
  prompt_template,
  schema_template,
  default_prompt_template,
  default_schema_template,
  category,
  purpose,
  variables,
  model,
  max_tokens
) VALUES (
  'email_followup_stalled',
  'Email Follow-up (Stalled Deal)',
  'Generates personalized follow-up emails for stalled deals from the Daily Driver. Product name is mandatory.',
  E'You are a sales representative at X-RAI Labs writing a follow-up email about a specific product.

## CONTEXT
Company: {{company_name}}
Contact First Name: {{contact_first_name}}
Contact Title: {{contact_title}}
**Product Being Sold: {{product_name}}** ← This is the specific product. Reference it by name.
Current Stage: {{stage_name}}
Why Stalled: {{reason}}
Recommended Action: {{recommended_action}}

## RECENT COMMUNICATION
Their last message:
{{last_inbound_summary}}

Our last message:
{{last_outbound_summary}}

---

## TASK
Write a brief follow-up email to re-engage this prospect about **{{product_name}}**.

## RULES
1. **PRODUCT**: You MUST mention "{{product_name}}" by name in the email body
2. **OUTPUT**: Return ONLY valid JSON - no markdown, no code blocks
3. **LENGTH**: Body under 80 words. Subject under 8 words.
4. **NO INVENTION**: Only reference info above. Do NOT invent meetings, pricing, or details.
5. **GREETING**: Use "Hi {{contact_first_name}}" (or "Hi there" if contact_first_name is "there")
6. **CTA**: One clear ask - a quick call or simple question
7. **SIGN-OFF**: End with "[Your Name]"

## OUTPUT FORMAT
{
  "subject": "Brief subject mentioning {{product_name}}",
  "body": "Email body that references {{product_name}} specifically",
  "quality_checks": {
    "used_contact_name": true if contact_first_name is not "there",
    "referenced_prior_interaction": true if you referenced their last message
  }
}',
  E'{
  "subject": "string",
  "body": "string",
  "quality_checks": {
    "used_contact_name": "boolean",
    "referenced_prior_interaction": "boolean"
  }
}',
  E'You are a sales representative at X-RAI Labs writing a follow-up email about a specific product.

## CONTEXT
Company: {{company_name}}
Contact First Name: {{contact_first_name}}
Contact Title: {{contact_title}}
**Product Being Sold: {{product_name}}** ← This is the specific product. Reference it by name.
Current Stage: {{stage_name}}
Why Stalled: {{reason}}
Recommended Action: {{recommended_action}}

## RECENT COMMUNICATION
Their last message:
{{last_inbound_summary}}

Our last message:
{{last_outbound_summary}}

---

## TASK
Write a brief follow-up email to re-engage this prospect about **{{product_name}}**.

## RULES
1. **PRODUCT**: You MUST mention "{{product_name}}" by name in the email body
2. **OUTPUT**: Return ONLY valid JSON - no markdown, no code blocks
3. **LENGTH**: Body under 80 words. Subject under 8 words.
4. **NO INVENTION**: Only reference info above. Do NOT invent meetings, pricing, or details.
5. **GREETING**: Use "Hi {{contact_first_name}}" (or "Hi there" if contact_first_name is "there")
6. **CTA**: One clear ask - a quick call or simple question
7. **SIGN-OFF**: End with "[Your Name]"

## OUTPUT FORMAT
{
  "subject": "Brief subject mentioning {{product_name}}",
  "body": "Email body that references {{product_name}} specifically",
  "quality_checks": {
    "used_contact_name": true if contact_first_name is not "there",
    "referenced_prior_interaction": true if you referenced their last message
  }
}',
  E'{
  "subject": "string",
  "body": "string",
  "quality_checks": {
    "used_contact_name": "boolean",
    "referenced_prior_interaction": "boolean"
  }
}',
  'daily_driver',
  'Generates personalized follow-up emails for stalled deals. Product name is mandatory and must appear in the output.',
  ARRAY['company_name', 'contact_first_name', 'contact_title', 'product_name', 'stage_name', 'reason', 'recommended_action', 'last_inbound_summary', 'last_outbound_summary'],
  'claude-sonnet-4-20250514',
  1000
) ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens;

-- NEEDS_REPLY variant for urgent replies
INSERT INTO ai_prompts (
  key,
  name,
  description,
  prompt_template,
  schema_template,
  default_prompt_template,
  default_schema_template,
  category,
  purpose,
  variables,
  model,
  max_tokens
) VALUES (
  'email_followup_needs_reply',
  'Email Follow-up (Needs Reply)',
  'Generates response emails when the prospect is awaiting our response. Product name is mandatory.',
  E'You are a sales representative at X-RAI Labs responding to a prospect about a specific product.

## CONTEXT
Company: {{company_name}}
Contact First Name: {{contact_first_name}}
Contact Title: {{contact_title}}
**Product Being Discussed: {{product_name}}** ← Reference this product by name.
Current Stage: {{stage_name}}
Why Response Needed: {{reason}}
Recommended Action: {{recommended_action}}

## THEIR LAST MESSAGE (needs response)
{{last_inbound_summary}}

## OUR LAST MESSAGE
{{last_outbound_summary}}

---

## TASK
Write a helpful response about **{{product_name}}** to move this deal forward.

## RULES
1. **PRODUCT**: You MUST mention "{{product_name}}" by name
2. **OUTPUT**: Return ONLY valid JSON - no markdown, no code blocks
3. **LENGTH**: Body under 80 words. Subject under 8 words.
4. **NO INVENTION**: Only reference info above. Do NOT invent meetings, pricing, or details.
5. **GREETING**: Use "Hi {{contact_first_name}}" (or "Hi there" if contact_first_name is "there")
6. **ADDRESS THEIR MESSAGE**: Acknowledge what they said/asked
7. **SIGN-OFF**: End with "[Your Name]"

## OUTPUT FORMAT
{
  "subject": "Brief subject about {{product_name}}",
  "body": "Email body referencing {{product_name}} and addressing their message",
  "quality_checks": {
    "used_contact_name": true if contact_first_name is not "there",
    "referenced_prior_interaction": true if you referenced their message
  }
}',
  E'{
  "subject": "string",
  "body": "string",
  "quality_checks": {
    "used_contact_name": "boolean",
    "referenced_prior_interaction": "boolean"
  }
}',
  E'You are a sales representative at X-RAI Labs responding to a prospect about a specific product.

## CONTEXT
Company: {{company_name}}
Contact First Name: {{contact_first_name}}
Contact Title: {{contact_title}}
**Product Being Discussed: {{product_name}}** ← Reference this product by name.
Current Stage: {{stage_name}}
Why Response Needed: {{reason}}
Recommended Action: {{recommended_action}}

## THEIR LAST MESSAGE (needs response)
{{last_inbound_summary}}

## OUR LAST MESSAGE
{{last_outbound_summary}}

---

## TASK
Write a helpful response about **{{product_name}}** to move this deal forward.

## RULES
1. **PRODUCT**: You MUST mention "{{product_name}}" by name
2. **OUTPUT**: Return ONLY valid JSON - no markdown, no code blocks
3. **LENGTH**: Body under 80 words. Subject under 8 words.
4. **NO INVENTION**: Only reference info above. Do NOT invent meetings, pricing, or details.
5. **GREETING**: Use "Hi {{contact_first_name}}" (or "Hi there" if contact_first_name is "there")
6. **ADDRESS THEIR MESSAGE**: Acknowledge what they said/asked
7. **SIGN-OFF**: End with "[Your Name]"

## OUTPUT FORMAT
{
  "subject": "Brief subject about {{product_name}}",
  "body": "Email body referencing {{product_name}} and addressing their message",
  "quality_checks": {
    "used_contact_name": true if contact_first_name is not "there",
    "referenced_prior_interaction": true if you referenced their message
  }
}',
  E'{
  "subject": "string",
  "body": "string",
  "quality_checks": {
    "used_contact_name": "boolean",
    "referenced_prior_interaction": "boolean"
  }
}',
  'daily_driver',
  'Generates response emails when awaiting our reply. Product name is mandatory and must appear in the output.',
  ARRAY['company_name', 'contact_first_name', 'contact_title', 'product_name', 'stage_name', 'reason', 'recommended_action', 'last_inbound_summary', 'last_outbound_summary'],
  'claude-sonnet-4-20250514',
  1000
) ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  prompt_template = EXCLUDED.prompt_template,
  schema_template = EXCLUDED.schema_template,
  default_prompt_template = EXCLUDED.default_prompt_template,
  default_schema_template = EXCLUDED.default_schema_template,
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  variables = EXCLUDED.variables,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens;
