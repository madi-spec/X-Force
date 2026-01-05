import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnose() {
  console.log('=== WEBHOOK DIAGNOSTIC ===\n');

  // 1. Check last webhook notification
  const { data: metric } = await supabase
    .from('system_metrics')
    .select('*')
    .eq('key', 'last_ms_webhook_notification')
    .single();

  console.log('1. Last webhook notification:', metric?.value || 'NEVER RECEIVED');

  // 2. Check active subscriptions
  const { data: subs } = await supabase
    .from('microsoft_subscriptions')
    .select('subscription_id, expiration_date, is_active, created_at')
    .eq('is_active', true);

  console.log('\n2. Active subscriptions:', subs?.length || 0);
  if (subs?.[0]) {
    console.log('   Subscription ID:', subs[0].subscription_id);
    console.log('   Created:', subs[0].created_at);
    console.log('   Expires:', subs[0].expiration_date);
    const isExpired = new Date(subs[0].expiration_date) < new Date();
    console.log('   Expired?:', isExpired ? 'YES - NEEDS RENEWAL' : 'No');
  }

  // 3. Check recent scheduling requests
  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('id, title, status, created_at, last_action_at')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n3. Recent scheduling requests:');
  for (const r of requests || []) {
    console.log(`   - ${r.title}`);
    console.log(`     Status: ${r.status} | Last action: ${r.last_action_at}`);
  }

  // 4. Check recent scheduling actions
  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('action_type, actor, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n4. Recent scheduling actions:');
  for (const a of actions || []) {
    console.log(`   - ${a.action_type} by ${a.actor} at ${a.created_at}`);
  }

  // 5. Test webhook endpoint
  console.log('\n5. Testing webhook endpoint...');
  try {
    const testResponse = await fetch('https://x-force-nu.vercel.app/api/webhooks/microsoft');
    const testData = await testResponse.json();
    console.log('   Endpoint response:', JSON.stringify(testData, null, 2));
  } catch (e) {
    console.log('   Error testing endpoint:', e);
  }

  console.log('\n=== END DIAGNOSTIC ===');
}

diagnose().catch(console.error);
