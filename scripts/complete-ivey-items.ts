/**
 * Mark all Ivey Exterminating pending command center items as completed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COMPANY_ID = '18b71dd9-2b71-4308-adfe-5d0a94b2e087';

async function run() {
  console.log('Marking Ivey Exterminating command center items as completed...\n');

  // Mark all pending command center items as completed
  const { data, error } = await supabase
    .from('command_center_items')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('company_id', COMPANY_ID)
    .eq('status', 'pending')
    .select('id, title');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Marked', data.length, 'items as completed:');
  for (const item of data) {
    const title = item.title ? item.title.substring(0, 60) : '(no title)';
    console.log('  ✓', title);
  }

  console.log('\nDone!');
}

run().catch(console.error);
