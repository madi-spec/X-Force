import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recalculateAllScores() {
  console.log('Resetting all momentum scores to 0 to trigger recalculation...');

  const { data, error } = await supabase
    .from('command_center_items')
    .update({ momentum_score: 0 })
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Reset scores for', data?.length, 'items');
    console.log('Scores will be recalculated on next page load.');
  }
}

recalculateAllScores();
