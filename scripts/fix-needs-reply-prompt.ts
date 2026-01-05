import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NEW_PROMPT_TEMPLATE = `You are a sales assistant helping respond to an inbound email.

CRITICAL REQUIREMENTS:

1. GREETING: Start with "Hi {{contact_first_name}},"

2. TIMING CONTEXT:
   Their email: {{email_date}}
   Today: {{current_date}}
   {{temporal_context}}

3. STAGE CONTEXT - THIS IS CRITICAL:
   Current stage: {{stage_name}}

   {{stage_context}}

   Your response MUST reflect this stage. Do NOT describe the product differently than the stage indicates.

4. MEETING TIMES - Copy EXACTLY as written (do not reword):
{{available_times}}

5. SIGN-OFF: "Best regards, [Your Name]"

GUIDELINES:
- Under 100 words
- Match your language to the stage (Trial = they're using it, Demo = they haven't seen it)
- If late response, acknowledge warmly
- Do NOT invent times, pricing, or details

---

CONTEXT:
Company: {{company_name}}
Product: {{product_name}}
Stage: {{stage_name}}

Their message:
{{last_inbound_summary}}

YOUR AVAILABLE TIMES (copy exactly):
{{available_times}}

---

Write the email. Remember:
- Stage is {{stage_name}}: {{stage_context}}
- Copy times exactly as shown above`;

async function fix() {
  const { data: prompt, error } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('key', 'email_followup_needs_reply')
    .single();

  if (error || !prompt) {
    console.log('Error fetching prompt:', error?.message);
    return;
  }

  console.log('Current prompt version:', prompt.version);

  await supabase.from('ai_prompt_history').insert({
    prompt_id: prompt.id,
    prompt_template: prompt.prompt_template,
    schema_template: prompt.schema_template,
    model: prompt.model,
    max_tokens: prompt.max_tokens,
    version: prompt.version,
    changed_by: prompt.updated_by,
    change_reason: 'Before v8 - restoring stage emphasis while keeping copy-exactly',
  });

  const { error: updateError } = await supabase
    .from('ai_prompts')
    .update({
      prompt_template: NEW_PROMPT_TEMPLATE,
      version: prompt.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prompt.id);

  if (updateError) {
    console.log('Error updating prompt:', updateError.message);
    return;
  }

  console.log('\n✓ Prompt updated to version', prompt.version + 1);
  console.log('Changes:');
  console.log('  - Restored stage emphasis with "THIS IS CRITICAL"');
  console.log('  - Added explicit instruction to match language to stage');
  console.log('  - Repeated stage context in final reminder');
  console.log('  - Kept copy-exactly instruction for times');
}

fix().catch(console.error);
