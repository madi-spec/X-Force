import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check the most recent email activities
  const { data: activities, count } = await supabase
    .from('activities')
    .select('id, type, subject, direction, activity_date, company_id', { count: 'exact' })
    .eq('type', 'email')
    .order('activity_date', { ascending: false })
    .limit(10);

  console.log('Total email activities:', count);
  console.log('\nMost recent email activities:');
  activities?.forEach(a => {
    console.log('  -', a.activity_date, '|', a.direction, '|', a.subject?.substring(0, 40));
  });

  // Check today's date
  const today = new Date().toISOString().split('T')[0];
  console.log('\nToday:', today);

  // Count emails from today
  const { count: todayCount } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'email')
    .gte('activity_date', today);

  console.log('Email activities from today:', todayCount);

  // Check communications table too
  const { data: comms, count: commCount } = await supabase
    .from('communications')
    .select('id, type, subject, direction, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nTotal communications:', commCount);
  console.log('Most recent communications:');
  comms?.forEach(c => {
    console.log('  -', c.created_at, '|', c.type, '|', c.direction, '|', c.subject?.substring(0, 40));
  });
}
check().catch(console.error);
