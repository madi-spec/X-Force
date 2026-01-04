import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncRecentEmailsDirectToCommunications } from '@/lib/communicationHub';
import { processSchedulingResponse, findMatchingSchedulingRequest } from '@/lib/scheduler/responseProcessor';
import { getValidToken } from '@/lib/microsoft/auth';

// Rate limit window: Only one AI response per request per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Check if an email sender is internal (our own team)
 * This prevents reply loops where we respond to our own emails
 */
async function checkIfInternalSender(
  supabase: ReturnType<typeof createAdminClient>,
  senderEmail: string,
  userId: string
): Promise<boolean> {
  if (!senderEmail) return false;

  const senderLower = senderEmail.toLowerCase();

  // Method 1: Check if sender is a user in our system
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', senderLower)
    .maybeSingle();

  if (user) {
    console.log('[MS Webhook] Internal sender check: Sender is a registered user');
    return true;
  }

  // Method 2: Check if sender's domain matches the current user's domain
  const { data: currentUser } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (currentUser?.email) {
    const currentUserDomain = currentUser.email.split('@')[1]?.toLowerCase();
    const senderDomain = senderLower.split('@')[1]?.toLowerCase();

    if (currentUserDomain && senderDomain && currentUserDomain === senderDomain) {
      console.log('[MS Webhook] Internal sender check: Sender domain matches user domain:', senderDomain);
      return true;
    }
  }

  // Method 3: Check if sender is an internal attendee on any scheduling request
  const { data: internalAttendee } = await supabase
    .from('scheduling_attendees')
    .select('id')
    .eq('email', senderLower)
    .eq('side', 'internal')
    .limit(1)
    .maybeSingle();

  if (internalAttendee) {
    console.log('[MS Webhook] Internal sender check: Sender is marked as internal attendee');
    return true;
  }

  return false;
}

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
        // Try to sync emails to communications table (may fail due to constraints, that's OK)
        let emailsSynced = 0;
        try {
          const syncResult = await syncRecentEmailsDirectToCommunications(userId, 5);
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
            // Use ImmutableId format for consistent ID handling with createReply
            const response = await fetch(
              'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,receivedDateTime,conversationId',
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Prefer': 'IdType="ImmutableId"',
                },
              }
            );

            console.log('[MS Webhook] Graph API response status:', response.status);
            if (response.ok) {
              const data = await response.json();
              const messages = data.value || [];
              console.log(`[MS Webhook] Fetched ${messages.length} recent emails from Graph API`);
              if (messages.length > 0) {
                console.log('[MS Webhook] First email from:', messages[0].from?.emailAddress?.address);
              }

              // Process emails with safeguards
              console.log(`[MS Webhook] === Processing ${messages.length} emails with safeguards ===`);

              for (const msg of messages) {
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

                console.log(`[MS Webhook] --- Checking email ---`);
                console.log(`[MS Webhook]   Subject: "${email.subject}"`);
                console.log(`[MS Webhook]   From: ${email.from.address}`);
                console.log(`[MS Webhook]   Email ID: ${email.id}`);
                console.log(`[MS Webhook]   Received: ${email.receivedDateTime}`);
                console.log(`[MS Webhook]   ConversationId: ${email.conversationId}`);

                // ============================================
                // SAFEGUARD 1: Email Deduplication
                // Skip if this exact email was already processed
                // ============================================
                const { data: existingProcessed } = await supabase
                  .from('scheduling_actions')
                  .select('id')
                  .eq('email_id', email.id)
                  .in('action_type', ['email_received', 'webhook_processing'])
                  .maybeSingle();

                if (existingProcessed) {
                  console.log(`[MS Webhook]   ✗ SKIP: Email already processed (dedup), action ID: ${existingProcessed.id}`);
                  continue;
                }
                console.log(`[MS Webhook]   ✓ Dedup check passed - email not yet processed`);

                // ============================================
                // SAFEGUARD 2: Internal Sender Check
                // Skip emails from our own domain/team
                // ============================================
                const isInternal = await checkIfInternalSender(supabase, email.from.address, userId);

                if (isInternal) {
                  console.log(`[MS Webhook]   ✗ SKIP: Email from internal sender: ${email.from.address}`);
                  continue;
                }
                console.log(`[MS Webhook]   ✓ Sender check passed - external sender`);

                // ============================================
                // Find matching scheduling request
                // ============================================
                const matchingRequest = await findMatchingSchedulingRequest(email);
                if (!matchingRequest) {
                  console.log(`[MS Webhook]   Result: No matching scheduling request`);
                  continue;
                }

                console.log(`[MS Webhook]   Result: MATCHED request ${matchingRequest.id}`);
                console.log(`[MS Webhook]   Request status: ${matchingRequest.status}`);
                console.log(`[MS Webhook]   Request title: ${matchingRequest.title}`);

                // ============================================
                // SAFEGUARD 3: Rate Limiting
                // Only one AI response per request per 5-minute window
                // ============================================
                const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

                const { data: recentAIResponse } = await supabase
                  .from('scheduling_actions')
                  .select('id, created_at')
                  .eq('scheduling_request_id', matchingRequest.id)
                  .eq('action_type', 'email_sent')
                  .eq('actor', 'ai')
                  .gte('created_at', rateLimitCutoff)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                // ============================================
                // Record email_received action (always, before rate limit check)
                // ============================================
                const { error: lockError } = await supabase
                  .from('scheduling_actions')
                  .insert({
                    scheduling_request_id: matchingRequest.id,
                    email_id: email.id,
                    action_type: 'email_received',
                    actor: 'prospect',
                    message_subject: email.subject,
                    message_content: email.bodyPreview || email.body?.substring(0, 500),
                  });

                if (lockError) {
                  console.log(`[MS Webhook]   Lock failed (concurrent processing): ${lockError.message}`);
                  continue;
                }
                console.log(`[MS Webhook]   ✓ Email recorded as email_received`);

                // ============================================
                // SAFEGUARD 3: Rate Limiting
                // Only one AI response per request per 5-minute window
                // If rate limited, defer processing instead of skipping entirely
                // ============================================
                if (recentAIResponse) {
                  const waitUntil = new Date(new Date(recentAIResponse.created_at).getTime() + RATE_LIMIT_WINDOW_MS);
                  console.log(`[MS Webhook]   ⏳ Rate limited - deferring processing until: ${waitUntil.toISOString()}`);

                  // Schedule deferred processing
                  await supabase
                    .from('scheduling_requests')
                    .update({
                      next_action_type: 'process_response',
                      next_action_at: waitUntil.toISOString(),
                    })
                    .eq('id', matchingRequest.id);

                  console.log(`[MS Webhook]   ✓ Deferred processing scheduled`);
                  schedulingMatched++;
                  continue;
                }
                console.log(`[MS Webhook]   ✓ Rate limit check passed - processing immediately`);

                console.log(`[MS Webhook]   Calling processSchedulingResponse...`);

                const result = await processSchedulingResponse(email, matchingRequest);
                console.log(`[MS Webhook]   Processing result:`, {
                  processed: result.processed,
                  action: result.action,
                  newStatus: result.newStatus,
                  error: result.error
                });

                if (result.processed) {
                  schedulingMatched++;
                }
              }

              console.log(`[MS Webhook] === Email processing complete. Matched: ${schedulingMatched} ===`);
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
