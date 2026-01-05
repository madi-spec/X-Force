import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check user_integrations
  const { data: integrations, error } = await supabase
    .from('user_integrations')
    .select('user_id, provider, token_expires_at, created_at')
    .limit(10);

  console.log('User integrations:');
  if (error) {
    console.log('Error:', error);
  } else if (!integrations || integrations.length === 0) {
    console.log('  No integrations found');
  } else {
    integrations.forEach(i => {
      console.log(`  ${i.provider}: user=${i.user_id}, expires=${i.token_expires_at}`);
    });
  }

  // Check email_conversations count
  const { count: convCount } = await supabase
    .from('email_conversations')
    .select('*', { count: 'exact', head: true });

  console.log('\nEmail conversations:', convCount);

  // Check email_messages count
  const { count: msgCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });

  console.log('Email messages:', msgCount);

  // Check unlinked conversations
  const { count: unlinkedCount } = await supabase
    .from('email_conversations')
    .select('*', { count: 'exact', head: true })
    .is('company_id', null);

  console.log('Unlinked conversations:', unlinkedCount);
}

check().catch(console.error);
