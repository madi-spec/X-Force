import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Use anon key like the app does (simulating unauthenticated)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Use service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== Testing with ANON key (RLS applied) ===');
  const { data: anonData, error: anonError } = await supabaseAnon
    .from('deals')
    .select(`
      *,
      company:companies(id, name, segment),
      owner:users!deals_owner_id_fkey(id, name, email)
    `)
    .limit(5);

  console.log('Anon Error:', JSON.stringify(anonError, null, 2));
  console.log('Anon Data count:', anonData?.length);

  console.log('\n=== Testing with SERVICE ROLE key (bypasses RLS) ===');
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('deals')
    .select(`
      *,
      company:companies(id, name, segment),
      owner:users!deals_owner_id_fkey(id, name, email)
    `)
    .limit(5);

  console.log('Admin Error:', JSON.stringify(adminError, null, 2));
  console.log('Admin Data count:', adminData?.length);

  if (adminData && adminData.length > 0) {
    console.log('\nFirst deal:', adminData[0].name);
  }
}

main().catch(console.error);
