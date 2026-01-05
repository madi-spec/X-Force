import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check the most recent inbound emails for this company
console.log('=== Most Recent Inbound Emails for Enviro Management ===\n');

const { data: comms } = await supabase
  .from('communications')
  .select('id, subject, content_preview, full_content, direction, occurred_at, their_participants')
  .eq('company_id', 'cecae459-d383-4003-974c-fc18b2ebe7c9')
  .eq('direction', 'inbound')
  .order('occurred_at', { ascending: false })
  .limit(3);

for (const c of comms || []) {
  console.log('===');
  console.log('ID:', c.id);
  console.log('Subject:', c.subject);
  console.log('Date:', c.occurred_at);
  console.log('From:', JSON.stringify(c.their_participants));
  console.log('\nContent:');
  console.log(c.full_content || c.content_preview);
  console.log('\n');
}
