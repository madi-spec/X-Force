import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: meetings } = await supabase
    .from('activities')
    .select('id, subject, metadata')
    .eq('type', 'meeting')
    .order('occurred_at', { ascending: false })
    .limit(3);

  for (const m of (meetings || [])) {
    console.log('Meeting:', m.subject);
    console.log('Metadata:', JSON.stringify(m.metadata, null, 2));
    console.log('---');
  }
}
main().catch(console.error);
