import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: prompt } = await supabase
    .from('ai_prompts')
    .select('key, name, prompt_template')
    .eq('key', 'email_followup_needs_reply')
    .single();

  if (prompt) {
    console.log('Prompt Key:', prompt.key);
    console.log('Name:', prompt.name);
    console.log('\n--- Template ---\n');
    console.log(prompt.prompt_template);
  } else {
    console.log('Prompt not found');
  }
}

check().catch(console.error);
