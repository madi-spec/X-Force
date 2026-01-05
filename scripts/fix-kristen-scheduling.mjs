import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check microsoft_tokens table instead
const { data: tokens } = await supabase
  .from('microsoft_tokens')
  .select('user_id, email, expires_at');

console.log('Microsoft tokens:');
for (const t of tokens || []) {
  console.log('-', t.email, '- User:', t.user_id, '- Expires:', t.expires_at);
}

// Also check the scheduling request to find the creator
const { data: request } = await supabase
  .from('scheduling_requests')
  .select('created_by')
  .eq('id', '9818e288-9c29-4804-9554-b32fb63e0951')
  .single();

console.log('\nScheduling request created_by:', request?.created_by);

// Check user details
if (request?.created_by) {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('id', request.created_by)
    .single();
  console.log('User:', user?.name, user?.email);
}
