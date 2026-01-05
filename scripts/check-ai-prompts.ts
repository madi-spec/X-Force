import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Check if ai_prompts table has prompts
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('key, name, category')
    .order('category');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Current prompts in database:');
  const grouped: Record<string, string[]> = {};

  data.forEach(p => {
    const cat = p.category || 'uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(`${p.key}: ${p.name}`);
  });

  Object.entries(grouped).forEach(([cat, prompts]) => {
    console.log(`\n[${cat.toUpperCase()}]`);
    prompts.forEach(p => console.log(`  - ${p}`));
  });

  console.log(`\nTotal: ${data.length} prompts`);
}

run().catch(console.error);
