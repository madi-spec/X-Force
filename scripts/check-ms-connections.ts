import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('microsoft_connections')
    .select('user_id, is_active, token_expires_at, last_sync_at')
    .limit(5);

  console.log('microsoft_connections:');
  if (error) {
    console.log('  Error:', error.message);
  } else {
    console.log('  Rows:', data?.length || 0);
    if (data) {
      for (const row of data) {
        console.log('  -', row.user_id, row.is_active ? 'ACTIVE' : 'inactive', 'expires:', row.token_expires_at);
      }
    }
  }
}

check().catch(console.error);
