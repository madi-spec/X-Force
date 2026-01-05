import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get sample from communications
  const { data: comms, error: commErr } = await supabase
    .from('communications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (commErr) {
    console.log('Communications error:', commErr.message);
  } else {
    console.log('=== Recent Communications ===');
    comms?.forEach(c => {
      console.log('  Date:', c.created_at);
      console.log('  Subject:', c.subject?.substring(0, 50));
      console.log('  Type:', c.type, '| Direction:', c.direction);
      console.log('  Awaiting response:', c.awaiting_our_response);
      console.log('  ---');
    });
  }

  // Check email_messages
  const { data: emails, error: emailErr } = await supabase
    .from('email_messages')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(3);

  if (emailErr) {
    console.log('email_messages error:', emailErr.message);
  } else {
    console.log('\n=== Recent email_messages ===');
    emails?.forEach(e => {
      console.log('  Date:', e.received_at);
      console.log('  Subject:', e.subject?.substring(0, 50));
      console.log('  From:', e.from_address);
      console.log('  ---');
    });
  }

  // Check activities for emails
  const { data: acts, error: actErr } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (actErr) {
    console.log('activities error:', actErr.message);
  } else {
    console.log('\n=== Recent activities ===');
    acts?.forEach(a => {
      console.log('  Date:', a.activity_date || a.created_at);
      console.log('  Type:', a.type);
      console.log('  Subject:', a.subject?.substring(0, 50));
      console.log('  ---');
    });
  }
}
check().catch(console.error);
