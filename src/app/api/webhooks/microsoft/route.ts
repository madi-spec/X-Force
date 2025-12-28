import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncRecentEmails } from '@/lib/microsoft/emailSync';
import { processSchedulingResponse, findMatchingSchedulingRequest } from '@/lib/scheduler/responseProcessor';
import { getValidToken } from '@/lib/microsoft/auth';

/**
 * Microsoft Graph Webhook Receiver
 *
 * Handles:
 * 1. Subscription validation (GET with validationToken)
 * 2. Change notifications (POST with notification payload)
 *
 * When an email arrives, Microsoft sends a notification here,
 * and we immediately sync and process scheduling responses.
 */

interface ChangeNotification {
  changeType: 'created' | 'updated' | 'deleted';
  clientState?: string;
  resource: string;
  resourceData?: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  tenantId: string;
}

interface NotificationPayload {
  value: ChangeNotification[];
}

/**
 * POST /api/webhooks/microsoft
 *
 * Receives change notifications from Microsoft Graph.
 * Also handles initial validation (validationToken in query params).
 */
export async function POST(request: NextRequest) {
  // Check for validation token (subscription validation)
  const validationToken = request.nextUrl.searchParams.get('validationToken');

  if (validationToken) {
    // Microsoft is validating the endpoint - return the token as plain text
    console.log('[MS Webhook] Validation request received');
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Process change notifications
  try {
    console.log('[MS Webhook] === PROCESSING START ===');
    const payload: NotificationPayload = await request.json();
    console.log('[MS Webhook] Received notification count:', payload.value?.length || 0);

    if (!payload.value || payload.value.length === 0) {
      return NextResponse.json({ success: true, message: 'No notifications to process' });
    }

    const supabase = createAdminClient();
    const processedUsers = new Set<string>();
    const results: Array<{ userId: string; emailsSynced: number; schedulingMatched: number }> = [];

    for (const notification of payload.value) {
      // Validate client state (security check)
      const expectedClientState = process.env.MS_WEBHOOK_CLIENT_STATE;
      if (expectedClientState && notification.clientState !== expectedClientState) {
        console.warn('[MS Webhook] Invalid client state, skipping notification');
        continue;
      }

      // Get user ID from subscription
      const { data: subscription } = await supabase
        .from('microsoft_subscriptions')
        .select('user_id')
        .eq('subscription_id', notification.subscriptionId)
        .single();

      if (!subscription) {
        console.warn('[MS Webhook] Unknown subscription:', notification.subscriptionId);
        continue;
      }

      const userId = subscription.user_id;

      // Avoid processing same user multiple times in one batch
      if (processedUsers.has(userId)) {
        continue;
      }
      processedUsers.add(userId);

      console.log(`[MS Webhook] Processing notification for user ${userId}`);

      try {
        // Try to sync emails to database (may fail due to constraints, that's OK)
        let emailsSynced = 0;
        try {
          const syncResult = await syncRecentEmails(userId, 5);
          emailsSynced = syncResult.imported;
          console.log(`[MS Webhook] Synced ${emailsSynced} emails for user ${userId}`);
        } catch (syncErr) {
          console.warn(`[MS Webhook] Email sync failed (continuing with direct fetch):`, syncErr);
        }

        // Process scheduling directly from Microsoft Graph (bypasses database sync issues)
        let schedulingMatched = 0;
        try {
          console.log('[MS Webhook] Getting token for user:', userId);
          const token = await getValidToken(userId);
          console.log('[MS Webhook] Token obtained:', token ? 'YES' : 'NO');
          if (token) {
            // Fetch recent inbox messages directly from Microsoft Graph
            const response = await fetch(
              'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,receivedDateTime,conversationId',
              { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('[MS Webhook] Graph API response status:', response.status);
            if (response.ok) {
              const data = await response.json();
              const messages = data.value || [];
              console.log(`[MS Webhook] Fetched ${messages.length} recent emails from Graph API`);
              if (messages.length > 0) {
                console.log('[MS Webhook] First email from:', messages[0].from?.emailAddress?.address);
              }

              // Process each message for scheduling (only process first matching, avoid duplicates)
              let processedOneEmail = false;
              for (const msg of messages) {
                if (processedOneEmail) break; // Only process one email per webhook call

                const email = {
                  id: msg.id,
                  subject: msg.subject || '',
                  body: msg.body?.content || msg.bodyPreview || '',
                  bodyPreview: msg.bodyPreview || '',
                  from: {
                    address: msg.from?.emailAddress?.address || '',
                    name: msg.from?.emailAddress?.name || '',
                  },
                  receivedDateTime: msg.receivedDateTime,
                  conversationId: msg.conversationId,
                };

                console.log(`[MS Webhook] Checking email: "${email.subject}" from ${email.from.address}`);
                const matchingRequest = await findMatchingSchedulingRequest(email);
                if (!matchingRequest) {
                  console.log(`[MS Webhook] No matching scheduling request found for this email`);
                } else {
                  console.log(`[MS Webhook] Found matching scheduling request: ${matchingRequest.id}, status: ${matchingRequest.status}`);

                  // Check if already processed (using email_id OR if request status changed recently)
                  const { data: existingAction } = await supabase
                    .from('scheduling_actions')
                    .select('id')
                    .eq('scheduling_request_id', matchingRequest.id)
                    .eq('email_id', email.id)
                    .single();

                  if (existingAction) {
                    console.log(`[MS Webhook] Email already processed, skipping`);
                  } else {
                    // Use INSERT as atomic lock - first webhook to insert wins
                    // Try to insert a "processing" placeholder action
                    const { error: lockError } = await supabase
                      .from('scheduling_actions')
                      .insert({
                        scheduling_request_id: matchingRequest.id,
                        email_id: email.id,
                        action_type: 'webhook_processing',
                        actor: 'system',
                        message_content: 'Processing started',
                      });

                    if (lockError) {
                      // Insert failed - likely duplicate, another webhook is processing
                      console.log(`[MS Webhook] Could not acquire lock (insert failed), skipping: ${lockError.message}`);
                    } else {
                      console.log(`[MS Webhook] Acquired lock, processing email for request ${matchingRequest.id}`);

                      const result = await processSchedulingResponse(email, matchingRequest);
                      if (result.processed) {
                        schedulingMatched++;
                        processedOneEmail = true;
                        console.log(`[MS Webhook] Processed scheduling response: ${result.action}`);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (schedErr) {
          console.error(`[MS Webhook] Scheduling processing error:`, schedErr);
        }

        results.push({
          userId,
          emailsSynced,
          schedulingMatched,
        });
      } catch (err) {
        console.error(`[MS Webhook] Error processing for user ${userId}:`, err);
      }
    }

    // Update last notification time
    await supabase
      .from('system_metrics')
      .upsert({
        key: 'last_ms_webhook_notification',
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    console.log('[MS Webhook] === PROCESSING COMPLETE ===');
    console.log('[MS Webhook] Results:', JSON.stringify(results));
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error('[MS Webhook] === PROCESSING ERROR ===');
    console.error('[MS Webhook] Error processing notification:', err);
    // Return 200 to prevent Microsoft from retrying (we'll handle errors internally)
    return NextResponse.json({ success: false, error: String(err) });
  }
}

/**
 * GET /api/webhooks/microsoft
 *
 * Status endpoint to check webhook health
 */
export async function GET() {
  const supabase = createAdminClient();

  // Get active subscriptions count
  const { data: subscriptions, error } = await supabase
    .from('microsoft_subscriptions')
    .select('id, user_id, resource, expiration_date')
    .eq('is_active', true);

  // Get last notification time
  const { data: lastNotification } = await supabase
    .from('system_metrics')
    .select('value')
    .eq('key', 'last_ms_webhook_notification')
    .single();

  return NextResponse.json({
    status: 'healthy',
    activeSubscriptions: subscriptions?.length || 0,
    subscriptions: subscriptions?.map(s => ({
      userId: s.user_id,
      resource: s.resource,
      expiresAt: s.expiration_date,
    })) || [],
    lastNotification: lastNotification?.value || null,
  });
}
