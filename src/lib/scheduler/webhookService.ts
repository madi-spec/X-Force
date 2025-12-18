/**
 * Webhook Service
 *
 * Handles webhook delivery, retry logic, and event dispatching
 * for the AI Scheduler system.
 */

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export type WebhookEventType =
  | 'meeting.scheduled'
  | 'meeting.cancelled'
  | 'meeting.rescheduled'
  | 'meeting.completed'
  | 'meeting.no_show'
  | 'request.created'
  | 'request.status_changed'
  | 'request.paused'
  | 'request.resumed'
  | 'response.received'
  | 'response.positive'
  | 'response.negative'
  | 'attempt.sent'
  | 'attempt.failed'
  | 'channel.escalated';

export interface WebhookConfig {
  id: string;
  name: string;
  description: string | null;
  url: string;
  secret_key: string | null;
  auth_type: 'none' | 'hmac' | 'bearer' | 'basic';
  auth_value: string | null;
  events: WebhookEventType[];
  filter_meeting_types: string[] | null;
  filter_users: string[] | null;
  custom_headers: Record<string, string>;
  max_retries: number;
  retry_delay_seconds: number;
  timeout_seconds: number;
  is_active: boolean;
  is_verified: boolean;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEventType;
  event_id: string | null;
  payload: Record<string, unknown>;
  request_headers: Record<string, string> | null;
  response_status: number | null;
  response_body: string | null;
  response_headers: Record<string, string> | null;
  response_time_ms: number | null;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempt_number: number;
  next_retry_at: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WebhookEventPayload {
  event_type: WebhookEventType;
  event_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============================================
// WEBHOOK MANAGEMENT
// ============================================

/**
 * Get all webhooks
 */
export async function getWebhooks(filters?: {
  is_active?: boolean;
  event_type?: WebhookEventType;
}): Promise<WebhookConfig[]> {
  const supabase = await createClient();

  let query = supabase
    .from('scheduler_webhooks')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters?.event_type) {
    query = query.contains('events', [filters.event_type]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Webhooks] Error fetching webhooks:', error);
    throw new Error('Failed to fetch webhooks');
  }

  return data || [];
}

/**
 * Get a single webhook
 */
export async function getWebhook(id: string): Promise<WebhookConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_webhooks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error('Failed to fetch webhook');
  }

  return data;
}

/**
 * Create a new webhook
 */
export async function createWebhook(webhook: {
  name: string;
  url: string;
  events: WebhookEventType[];
  description?: string;
  secret_key?: string;
  auth_type?: 'none' | 'hmac' | 'bearer' | 'basic';
  auth_value?: string;
  filter_meeting_types?: string[];
  filter_users?: string[];
  custom_headers?: Record<string, string>;
  max_retries?: number;
  retry_delay_seconds?: number;
  timeout_seconds?: number;
  created_by?: string;
}): Promise<WebhookConfig> {
  const supabase = await createClient();

  // Generate secret key if not provided and auth_type is hmac
  const secretKey = webhook.secret_key || (
    webhook.auth_type === 'hmac' ? generateSecretKey() : null
  );

  const { data, error } = await supabase
    .from('scheduler_webhooks')
    .insert({
      ...webhook,
      secret_key: secretKey,
      auth_type: webhook.auth_type || 'hmac',
    })
    .select()
    .single();

  if (error) {
    console.error('[Webhooks] Error creating webhook:', error);
    throw new Error('Failed to create webhook');
  }

  return data;
}

/**
 * Update a webhook
 */
export async function updateWebhook(
  id: string,
  updates: Partial<Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'>>
): Promise<WebhookConfig> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduler_webhooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Webhooks] Error updating webhook:', error);
    throw new Error('Failed to update webhook');
  }

  return data;
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('scheduler_webhooks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Webhooks] Error deleting webhook:', error);
    throw new Error('Failed to delete webhook');
  }
}

/**
 * Generate a secure secret key
 */
export function generateSecretKey(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

// ============================================
// WEBHOOK DELIVERY
// ============================================

/**
 * Dispatch an event to all subscribed webhooks
 */
export async function dispatchWebhookEvent(
  eventType: WebhookEventType,
  eventId: string,
  data: Record<string, unknown>,
  options?: {
    meetingType?: string;
    userId?: string;
  }
): Promise<{ dispatched: number; failed: number }> {
  const supabase = await createClient();

  // Get webhooks subscribed to this event
  const { data: webhooks, error } = await supabase.rpc('get_webhooks_for_event', {
    p_event_type: eventType,
    p_meeting_type: options?.meetingType || null,
    p_user_id: options?.userId || null,
  });

  if (error) {
    console.error('[Webhooks] Error fetching webhooks for event:', error);
    return { dispatched: 0, failed: 0 };
  }

  if (!webhooks || webhooks.length === 0) {
    return { dispatched: 0, failed: 0 };
  }

  // Build payload
  const payload: WebhookEventPayload = {
    event_type: eventType,
    event_id: eventId,
    timestamp: new Date().toISOString(),
    data,
  };

  // Dispatch to each webhook
  let dispatched = 0;
  let failed = 0;

  for (const webhook of webhooks) {
    try {
      await deliverWebhook(webhook, payload);
      dispatched++;
    } catch (err) {
      console.error(`[Webhooks] Failed to deliver to ${webhook.id}:`, err);
      failed++;
    }
  }

  return { dispatched, failed };
}

/**
 * Deliver a webhook to a single endpoint
 */
async function deliverWebhook(
  webhook: {
    id: string;
    url: string;
    secret_key: string | null;
    auth_type: string;
    auth_value: string | null;
    custom_headers: Record<string, string> | null;
    timeout_seconds: number;
    max_retries: number;
    retry_delay_seconds: number;
  },
  payload: WebhookEventPayload
): Promise<void> {
  const supabase = await createClient();
  const startTime = Date.now();

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'X-Force-Scheduler-Webhook/1.0',
    'X-Webhook-Event': payload.event_type,
    'X-Webhook-Delivery': crypto.randomUUID(),
    'X-Webhook-Timestamp': payload.timestamp,
    ...(webhook.custom_headers || {}),
  };

  // Add authentication
  if (webhook.auth_type === 'hmac' && webhook.secret_key) {
    const signature = generateHmacSignature(JSON.stringify(payload), webhook.secret_key);
    headers['X-Webhook-Signature'] = signature;
  } else if (webhook.auth_type === 'bearer' && webhook.auth_value) {
    headers['Authorization'] = `Bearer ${webhook.auth_value}`;
  } else if (webhook.auth_type === 'basic' && webhook.auth_value) {
    headers['Authorization'] = `Basic ${Buffer.from(webhook.auth_value).toString('base64')}`;
  }

  try {
    // Make the request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    // Record delivery
    if (response.ok) {
      await supabase.rpc('record_webhook_delivery', {
        p_webhook_id: webhook.id,
        p_event_type: payload.event_type,
        p_event_id: payload.event_id,
        p_payload: payload,
        p_status: 'success',
        p_response_status: response.status,
        p_response_body: responseBody.substring(0, 1000),
        p_response_time_ms: responseTime,
      });
    } else {
      // Schedule retry if allowed
      await supabase.rpc('record_webhook_delivery', {
        p_webhook_id: webhook.id,
        p_event_type: payload.event_type,
        p_event_id: payload.event_id,
        p_payload: payload,
        p_status: 'failed',
        p_response_status: response.status,
        p_response_body: responseBody.substring(0, 1000),
        p_response_time_ms: responseTime,
        p_error_message: `HTTP ${response.status}: ${response.statusText}`,
      });
    }
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    await supabase.rpc('record_webhook_delivery', {
      p_webhook_id: webhook.id,
      p_event_type: payload.event_type,
      p_event_id: payload.event_id,
      p_payload: payload,
      p_status: 'failed',
      p_response_time_ms: responseTime,
      p_error_message: errorMessage,
    });

    throw err;
  }
}

/**
 * Generate HMAC signature for payload
 */
function generateHmacSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateHmacSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Test a webhook endpoint
 */
export async function testWebhook(webhookId: string): Promise<{
  success: boolean;
  status?: number;
  responseTime?: number;
  error?: string;
}> {
  const webhook = await getWebhook(webhookId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found' };
  }

  const testPayload: WebhookEventPayload = {
    event_type: 'request.created',
    event_id: 'test_' + crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      message: 'This is a test webhook delivery from X-Force Scheduler',
    },
  };

  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'X-Force-Scheduler-Webhook/1.0',
      'X-Webhook-Event': 'test',
      'X-Webhook-Test': 'true',
      ...(webhook.custom_headers || {}),
    };

    if (webhook.auth_type === 'hmac' && webhook.secret_key) {
      headers['X-Webhook-Signature'] = generateHmacSignature(
        JSON.stringify(testPayload),
        webhook.secret_key
      );
    } else if (webhook.auth_type === 'bearer' && webhook.auth_value) {
      headers['Authorization'] = `Bearer ${webhook.auth_value}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      // Mark as verified
      await updateWebhook(webhookId, { is_verified: true });
      return { success: true, status: response.status, responseTime };
    } else {
      return {
        success: false,
        status: response.status,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (err) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================
// WEBHOOK DELIVERIES
// ============================================

/**
 * Get webhook deliveries
 */
export async function getWebhookDeliveries(
  webhookId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<WebhookDelivery[]> {
  const supabase = await createClient();

  let query = supabase
    .from('scheduler_webhook_deliveries')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Webhooks] Error fetching deliveries:', error);
    throw new Error('Failed to fetch webhook deliveries');
  }

  return data || [];
}

/**
 * Retry failed deliveries
 */
export async function retryFailedDeliveries(): Promise<{ retried: number; succeeded: number }> {
  const supabase = await createClient();

  // Get deliveries ready for retry
  const { data: deliveries, error } = await supabase
    .from('scheduler_webhook_deliveries')
    .select(`
      *,
      webhook:scheduler_webhooks(*)
    `)
    .eq('status', 'retrying')
    .lte('next_retry_at', new Date().toISOString())
    .limit(100);

  if (error || !deliveries) {
    return { retried: 0, succeeded: 0 };
  }

  let retried = 0;
  let succeeded = 0;

  for (const delivery of deliveries) {
    if (!delivery.webhook) continue;

    try {
      await deliverWebhook(delivery.webhook, delivery.payload);
      succeeded++;
    } catch {
      // Already recorded in deliverWebhook
    }
    retried++;
  }

  return { retried, succeeded };
}

// ============================================
// EVENT HELPERS
// ============================================

/**
 * Helper to dispatch meeting scheduled event
 */
export async function dispatchMeetingScheduled(
  requestId: string,
  meetingDetails: {
    scheduled_time: string;
    duration_minutes: number;
    meeting_type: string;
    platform: string;
    company_name: string;
    contact_name: string;
  }
): Promise<void> {
  await dispatchWebhookEvent('meeting.scheduled', requestId, meetingDetails, {
    meetingType: meetingDetails.meeting_type,
  });
}

/**
 * Helper to dispatch request created event
 */
export async function dispatchRequestCreated(
  requestId: string,
  requestDetails: {
    meeting_type: string;
    company_name?: string;
    contact_name?: string;
    created_by?: string;
  }
): Promise<void> {
  await dispatchWebhookEvent('request.created', requestId, requestDetails, {
    meetingType: requestDetails.meeting_type,
    userId: requestDetails.created_by,
  });
}

/**
 * Helper to dispatch status change event
 */
export async function dispatchStatusChanged(
  requestId: string,
  statusChange: {
    previous_status: string;
    new_status: string;
    meeting_type: string;
    reason?: string;
  }
): Promise<void> {
  await dispatchWebhookEvent('request.status_changed', requestId, statusChange, {
    meetingType: statusChange.meeting_type,
  });
}
