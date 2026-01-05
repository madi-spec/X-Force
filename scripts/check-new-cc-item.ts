import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('id', '55e1b59b-0094-4afc-86e2-2f3cd4cac4a8')
    .single();

  console.log('=== NEW CC ITEM ===');
  console.log('Title:', data?.title);
  console.log('Tier:', data?.tier, '- Trigger:', data?.tier_trigger);
  console.log('Company:', data?.company_name, '(' + data?.company_id + ')');
  console.log('Why Now:', data?.why_now);
  console.log('Status:', data?.status);
  console.log('Source ID:', data?.source_id);
  console.log('Email ID:', data?.email_id);
}
check().catch(console.error);
