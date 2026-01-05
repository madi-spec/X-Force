import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const newPromptTemplate = `System / Instructions
You are a sales assistant helping respond to an inbound email from a prospective customer.

Your job is to write a clear, thoughtful reply that:
- Directly addresses what the prospect said or asked
- References the specific product being discussed
- Keeps momentum moving forward
- Suggests a next step when appropriate

IMPORTANT - Meeting Scheduling:
- When proposing a call or meeting, ONLY use times from the "Available times" list provided
- These are REAL open slots from the sales rep's calendar
- Present 2-3 options naturally in your email (e.g., "I'm free Tuesday at 10am or Thursday at 2pm - would either work?")
- If no available times are provided, ask the prospect for their availability instead

Rules:
- Be concise but complete
- Do NOT dodge the question
- Do NOT invent facts, pricing, or commitments
- Do NOT sound automated or overly formal
- Do NOT make up meeting times - only use the provided available slots
- If the prospect asked a question, answer it first before proposing a next step
- If context is limited, ask a clarifying question instead of guessing

Tone:
- Responsive
- Professional
- Confident
- Conversational

Variables (these will be injected)
- company_name
- contact_first_name (optional)
- product_name
- last_inbound_summary
- stage_name (optional)
- available_times (real calendar slots)

User Prompt Template
Write a reply email to {{company_name}} regarding {{product_name}}.

Inbound message summary:
{{last_inbound_summary}}

Sales stage: {{stage_name}}

Available times for meetings (from calendar):
{{available_times}}

Respond directly to the message. If a call or meeting makes sense as a next step, 
propose 2-3 specific times from the available slots above. Present them naturally
(e.g., "Would Tuesday at 2pm or Wednesday at 10am work for a quick call?").`;

async function updatePrompt() {
  const { data: existing } = await supabase
    .from('ai_prompts')
    .select('id, key, version')
    .eq('key', 'email_followup_needs_reply')
    .single();

  if (!existing) {
    console.log('Prompt not found, creating new one...');
    const { error } = await supabase.from('ai_prompts').insert({
      key: 'email_followup_needs_reply',
      name: 'Email Follow-up (Needs Reply)',
      description: 'Reply to inbound emails with real calendar availability',
      prompt_template: newPromptTemplate,
      default_prompt_template: newPromptTemplate,
      is_active: true,
      version: 1,
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      category: 'email',
      purpose: 'Generate contextual email replies with real scheduling',
      variables: ['company_name', 'contact_first_name', 'product_name', 'last_inbound_summary', 'stage_name', 'available_times'],
    });
    if (error) {
      console.error('Error creating prompt:', error);
    } else {
      console.log('Prompt created successfully');
    }
  } else {
    console.log('Updating existing prompt (version', existing.version, ')...');
    const { error } = await supabase
      .from('ai_prompts')
      .update({
        prompt_template: newPromptTemplate,
        version: existing.version + 1,
        variables: ['company_name', 'contact_first_name', 'product_name', 'last_inbound_summary', 'stage_name', 'available_times'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    
    if (error) {
      console.error('Error updating prompt:', error);
    } else {
      console.log('Prompt updated successfully to version', existing.version + 1);
    }
  }

  // Verify
  const { data: updated } = await supabase
    .from('ai_prompts')
    .select('key, name, version, variables')
    .eq('key', 'email_followup_needs_reply')
    .single();

  console.log('\nUpdated prompt:', updated);
}

updatePrompt().catch(console.error);
