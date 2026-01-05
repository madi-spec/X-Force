import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../src/lib/microsoft/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';
const APP_URL = 'https://x-force-nu.vercel.app';
const USER_ID = '11111111-1111-1111-1111-111111111009'; // Brent Allen

async function setupWebhook() {
  console.log('Setting up Microsoft Graph webhook for real-time email notifications...\n');

  // Get Microsoft token
  const token = await getValidToken(USER_ID);
  if (!token) {
    console.error('ERROR: No valid Microsoft token. Please reconnect your Microsoft account.');
    return;
  }
  console.log('✓ Got Microsoft token');

  // Check for existing subscriptions
  const { data: existing } = await supabase
    .from('microsoft_subscriptions')
    .select('subscription_id, expiration_date')
    .eq('user_id', USER_ID)
    .eq('is_active', true);

  if (existing && existing.length > 0) {
    console.log(`\nFound ${existing.length} existing subscription(s):`);
    for (const sub of existing) {
      console.log(`  - ${sub.subscription_id} (expires: ${sub.expiration_date})`);
    }
    console.log('\nDeleting existing subscriptions first...');

    for (const sub of existing) {
      try {
        await fetch(`${GRAPH_API_URL}/subscriptions/${sub.subscription_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        await supabase
          .from('microsoft_subscriptions')
          .update({ is_active: false })
          .eq('subscription_id', sub.subscription_id);
      } catch (e) {
        // Ignore errors
      }
    }
    console.log('✓ Cleaned up old subscriptions');
  }

  // Create new subscription
  const notificationUrl = `${APP_URL}/api/webhooks/microsoft`;
  const clientState = `xforce-${USER_ID.substring(0, 8)}`;
  const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString(); // ~3 days

  const subscriptionPayload = {
    changeType: 'created',
    notificationUrl,
    resource: '/me/mailFolders/inbox/messages',
    expirationDateTime,
    clientState,
  };

  console.log('\nCreating webhook subscription...');
  console.log('  Notification URL:', notificationUrl);
  console.log('  Resource:', subscriptionPayload.resource);
  console.log('  Expires:', expirationDateTime);

  const response = await fetch(`${GRAPH_API_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscriptionPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('\nERROR: Failed to create subscription');
    console.error('Status:', response.status);
    console.error('Response:', errorText);
    return;
  }

  const subscription = await response.json();
  console.log('\n✓ Subscription created successfully!');
  console.log('  Subscription ID:', subscription.id);

  // Store in database
  await supabase.from('microsoft_subscriptions').insert({
    user_id: USER_ID,
    subscription_id: subscription.id,
    resource: subscription.resource,
    change_type: subscription.changeType,
    expiration_date: subscription.expirationDateTime,
    client_state: clientState,
    is_active: true,
  });
  console.log('✓ Saved to database');

  console.log('\n========================================');
  console.log('WEBHOOK SETUP COMPLETE!');
  console.log('========================================');
  console.log('\nWhen a new email arrives in your inbox,');
  console.log('Microsoft will notify X-FORCE within seconds.');
  console.log('\nThe subscription will auto-renew via the');
  console.log('sync-microsoft cron job every 15 minutes.');
}

setupWebhook().catch(console.error);
