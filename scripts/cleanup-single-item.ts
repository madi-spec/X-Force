import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Clean up remaining ai_recommendation items with null target
  const { error, count } = await supabase
    .from('command_center_items')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('source', 'ai_recommendation')
    .eq('status', 'pending')
    .is('target_name', null);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Cleaned up remaining ai_recommendation items');

  const { data: remaining } = await supabase
    .from('command_center_items')
    .select('id, title, source, tier')
    .eq('status', 'pending');

  console.log('Remaining items:', remaining?.length || 0);
  for (const item of (remaining || [])) {
    console.log('-', item.source, '| Tier', item.tier, '|', item.title?.substring(0, 50));
  }
}

main().catch(console.error);
