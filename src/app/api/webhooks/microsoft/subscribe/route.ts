import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getValidToken } from '@/lib/microsoft/auth';

/**
 * Microsoft Graph Webhook Subscription Management
 *
 * Creates and manages webhook subscriptions for real-time email notifications.
 * Subscriptions need to be renewed before they expire (max lifetime ~3 days for mail).
 */

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

// Subscription lifetime in minutes (max for mail is 4230 = ~3 days)
const SUBSCRIPTION_LIFETIME_MINUTES = 4230;

interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState?: string;
}

/**
 * POST /api/webhooks/microsoft/subscribe
 *
 * Creates a new webhook subscription for the current user's mailbox.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userData.id;

    // Get Microsoft token
    const token = await getValidToken(userId);
    if (!token) {
      return NextResponse.json(
        { error: 'No valid Microsoft token. Please reconnect your Microsoft account.' },
        { status: 400 }
      );
    }

    // Build webhook notification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'App URL not configured. Set NEXT_PUBLIC_APP_URL environment variable.' },
        { status: 500 }
      );
    }

    const notificationUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/webhooks/microsoft`;
    const clientState = process.env.MS_WEBHOOK_CLIENT_STATE || `xforce-${userId.substring(0, 8)}`;

    // Calculate expiration (now + lifetime)
    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_LIFETIME_MINUTES * 60 * 1000
    ).toISOString();

    // Create subscription via Microsoft Graph
    const subscriptionPayload = {
      changeType: 'created',
      notificationUrl,
      resource: '/me/mailFolders/inbox/messages',
      expirationDateTime,
      clientState,
    };

    console.log('[MS Subscribe] Creating subscription:', subscriptionPayload);

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
      console.error('[MS Subscribe] Failed to create subscription:', errorText);
      return NextResponse.json(
        { error: 'Failed to create subscription', details: errorText },
        { status: response.status }
      );
    }

    const subscription: GraphSubscription = await response.json();
    console.log('[MS Subscribe] Created subscription:', subscription.id);

    // Store subscription in database
    const adminSupabase = createAdminClient();
    const { error: insertError } = await adminSupabase
      .from('microsoft_subscriptions')
      .upsert({
        user_id: userId,
        subscription_id: subscription.id,
        resource: subscription.resource,
        change_type: subscription.changeType,
        expiration_date: subscription.expirationDateTime,
        client_state: clientState,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'subscription_id' });

    if (insertError) {
      console.error('[MS Subscribe] Failed to store subscription:', insertError);
      // Don't fail the request, subscription is active in Microsoft
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      expiresAt: subscription.expirationDateTime,
      resource: subscription.resource,
    });
  } catch (err) {
    console.error('[MS Subscribe] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/microsoft/subscribe
 *
 * Deletes webhook subscription for the current user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userData.id;
    const adminSupabase = createAdminClient();

    // Get existing subscriptions
    const { data: subscriptions } = await adminSupabase
      .from('microsoft_subscriptions')
      .select('subscription_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No active subscriptions' });
    }

    // Get Microsoft token
    const token = await getValidToken(userId);
    const deleted: string[] = [];
    const errors: string[] = [];

    // Delete each subscription from Microsoft
    for (const sub of subscriptions) {
      try {
        if (token) {
          const response = await fetch(
            `${GRAPH_API_URL}/subscriptions/${sub.subscription_id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.ok || response.status === 404) {
            deleted.push(sub.subscription_id);
          } else {
            errors.push(`Failed to delete ${sub.subscription_id}`);
          }
        }
      } catch (err) {
        errors.push(`Error deleting ${sub.subscription_id}: ${err}`);
      }

      // Mark as inactive in database regardless
      await adminSupabase
        .from('microsoft_subscriptions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('subscription_id', sub.subscription_id);
    }

    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      errors,
    });
  } catch (err) {
    console.error('[MS Subscribe] Delete error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/microsoft/subscribe
 *
 * Gets current user's subscription status.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adminSupabase = createAdminClient();

    // Get user's subscriptions
    const { data: subscriptions } = await adminSupabase
      .from('microsoft_subscriptions')
      .select('subscription_id, resource, expiration_date, is_active, created_at')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    const active = subscriptions?.filter(s => s.is_active) || [];
    const expiringSoon = active.filter(s => {
      const expiresAt = new Date(s.expiration_date);
      const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilExpiry < 24;
    });

    return NextResponse.json({
      hasActiveSubscription: active.length > 0,
      activeSubscriptions: active.length,
      expiringSoon: expiringSoon.length,
      subscriptions: subscriptions || [],
    });
  } catch (err) {
    console.error('[MS Subscribe] Get error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Renew expiring subscriptions (called by cron)
 */
export async function renewExpiringSubscriptions(): Promise<{
  renewed: number;
  failed: number;
  errors: string[];
}> {
  const adminSupabase = createAdminClient();
  const result = { renewed: 0, failed: 0, errors: [] as string[] };

  // Find subscriptions expiring within 24 hours
  const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: expiringSubscriptions } = await adminSupabase
    .from('microsoft_subscriptions')
    .select('id, user_id, subscription_id')
    .eq('is_active', true)
    .lt('expiration_date', expirationThreshold);

  if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
    console.log('[MS Subscribe] No subscriptions need renewal');
    return result;
  }

  console.log(`[MS Subscribe] Found ${expiringSubscriptions.length} subscriptions to renew`);

  for (const sub of expiringSubscriptions) {
    try {
      const token = await getValidToken(sub.user_id);
      if (!token) {
        result.errors.push(`No token for user ${sub.user_id}`);
        result.failed++;
        continue;
      }

      // Calculate new expiration
      const newExpiration = new Date(
        Date.now() + SUBSCRIPTION_LIFETIME_MINUTES * 60 * 1000
      ).toISOString();

      // Renew subscription via PATCH
      const response = await fetch(
        `${GRAPH_API_URL}/subscriptions/${sub.subscription_id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expirationDateTime: newExpiration }),
        }
      );

      if (response.ok) {
        // Update in database
        await adminSupabase
          .from('microsoft_subscriptions')
          .update({
            expiration_date: newExpiration,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        result.renewed++;
        console.log(`[MS Subscribe] Renewed subscription ${sub.subscription_id}`);
      } else {
        const errorText = await response.text();
        result.errors.push(`Failed to renew ${sub.subscription_id}: ${errorText}`);
        result.failed++;

        // If 404, subscription no longer exists - mark as inactive
        if (response.status === 404) {
          await adminSupabase
            .from('microsoft_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', sub.id);
        }
      }
    } catch (err) {
      result.errors.push(`Error renewing ${sub.subscription_id}: ${err}`);
      result.failed++;
    }
  }

  return result;
}
