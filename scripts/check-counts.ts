import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { count: emailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });

  const { count: commCount } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true });

  console.log('email_messages count:', emailCount);
  console.log('communications count:', commCount);
}

check().catch(console.error);
