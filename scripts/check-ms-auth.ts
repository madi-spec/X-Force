import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check microsoft_tokens table
  const { data: tokens, error: tokensError } = await supabase
    .from('microsoft_tokens')
    .select('*')
    .limit(3);

  console.log('microsoft_tokens:', tokens?.length || 0, 'rows');
  if (tokensError) console.log('  Error:', tokensError.message);
  if (tokens && tokens.length > 0) {
    console.log('  Sample user_id:', tokens[0].user_id);
  }

  // Check user_integrations table
  const { data: integrations, error: intError } = await supabase
    .from('user_integrations')
    .select('*')
    .limit(3);

  console.log('\nuser_integrations:', integrations?.length || 0, 'rows');
  if (intError) console.log('  Error:', intError.message);
  if (integrations && integrations.length > 0) {
    console.log('  Sample:', JSON.stringify(integrations[0]).slice(0, 300));
  }

  // Check auth users for Microsoft providers
  console.log('\nChecking auth.users for Microsoft providers...');
  const { data: authData } = await supabase.auth.admin.listUsers();
  if (authData && authData.users) {
    for (const user of authData.users.slice(0, 5)) {
      const providers = user.app_metadata?.providers || [];
      console.log(`  ${user.email}: providers = ${providers.join(', ') || 'none'}`);
    }
  }
}

check().catch(console.error);
