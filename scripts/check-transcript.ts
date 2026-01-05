import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Fields in meeting_transcriptions:');
  Object.entries(data || {}).forEach(([key, value]) => {
    const display = typeof value === 'string'
      ? value.substring(0, 80) + (value.length > 80 ? '...' : '')
      : value;
    console.log(`  ${key}: ${display}`);
  });
}

main().catch(console.error);
