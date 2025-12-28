/**
 * Engagement Events & Webhooks Types
 * Phase 3: Real-time engagement tracking
 */

// ============================================
// ENGAGEMENT EVENTS
// ============================================

export type EngagementEventType =
  | 'email_opened'
  | 'email_clicked'
  | 'proposal_viewed'
  | 'link_clicked'
  | 'document_downloaded'
  | 'page_visited'
  | 'form_submitted';

export type EngagementSourceType =
  | 'email'
  | 'proposal'
  | 'website'
  | 'document';

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface GeoLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export interface EngagementEventMetadata {
  // For email opens
  email_subject?: string;
  open_count?: number;
  is_first_open?: boolean;

  // For clicks
  url?: string;
  link_text?: string;
  link_position?: number;

  // For proposal views
  proposal_name?: string;
  page_viewed?: string;
  time_spent_seconds?: number;

  // Original URL (from token)
  original_url?: string;
}

export interface EngagementEvent {
  id: string;
  user_id: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;

  event_type: EngagementEventType;
  source_type: EngagementSourceType;
  source_id?: string;

  metadata: EngagementEventMetadata;

  ip_address?: string;
  user_agent?: string;
  device_type: DeviceType;
  geo_location?: GeoLocation;

  occurred_at: string;
  created_at: string;

  processed: boolean;
  processed_at?: string;
  signal_id?: string;
}

export interface CreateEngagementEventInput {
  user_id: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  event_type: EngagementEventType;
  source_type: EngagementSourceType;
  source_id?: string;
  metadata?: EngagementEventMetadata;
  ip_address?: string;
  user_agent?: string;
}

// ============================================
// OUTBOUND WEBHOOKS
// ============================================

export type WebhookAuthType = 'none' | 'bearer' | 'hmac' | 'basic';

export type WebhookEventType =
  | '*'
  | 'engagement.email_opened'
  | 'engagement.email_clicked'
  | 'engagement.proposal_viewed'
  | 'engagement.link_clicked'
  | 'signal.created'
  | 'signal.escalated'
  | 'deal.health_dropped'
  | 'deal.stage_changed';

export type WebhookSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface OutboundWebhook {
  id: string;
  user_id: string;

  name: string;
  description?: string;
  url: string;

  auth_type: WebhookAuthType;
  auth_value?: string;

  event_types: WebhookEventType[];
  min_severity?: WebhookSeverity;
  deal_stages?: string[];

  custom_headers: Record<string, string>;

  is_active: boolean;
  max_retries: number;
  retry_delay_seconds: number;
  timeout_seconds: number;

  auto_disable_after_failures: number;
  consecutive_failures: number;

  last_triggered_at?: string;
  last_success_at?: string;
  last_failure_at?: string;
  last_error?: string;
  success_count: number;
  failure_count: number;

  is_verified: boolean;
  verified_at?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateWebhookInput {
  name: string;
  description?: string;
  url: string;
  auth_type?: WebhookAuthType;
  auth_value?: string;
  event_types?: WebhookEventType[];
  min_severity?: WebhookSeverity;
  deal_stages?: string[];
  custom_headers?: Record<string, string>;
}

export interface UpdateWebhookInput {
  name?: string;
  description?: string;
  url?: string;
  auth_type?: WebhookAuthType;
  auth_value?: string;
  event_types?: WebhookEventType[];
  min_severity?: WebhookSeverity;
  deal_stages?: string[];
  custom_headers?: Record<string, string>;
  is_active?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}

// ============================================
// WEBHOOK DELIVERIES
// ============================================

export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WebhookDelivery {
  id: string;
  webhook_id: string;

  event_type: string;
  payload: Record<string, unknown>;

  status: DeliveryStatus;

  response_status?: number;
  response_body?: string;
  response_time_ms?: number;

  attempt_count: number;
  max_attempts: number;
  next_retry_at?: string;
  last_error?: string;

  created_at: string;
  delivered_at?: string;
  completed_at?: string;
}

// ============================================
// TRACKING TOKENS
// ============================================

export interface TrackingToken {
  id: string;
  token: string;

  user_id: string;
  contact_id?: string;
  deal_id?: string;

  source_type: EngagementSourceType;
  source_id?: string;

  original_url?: string;
  link_text?: string;
  link_position?: number;

  open_count: number;
  click_count: number;
  first_opened_at?: string;
  last_opened_at?: string;

  expires_at: string;
  created_at: string;
}

export interface TrackingContext {
  user_id: string;
  contact_id?: string;
  deal_id?: string;
  email_id?: string;
  source_type: EngagementSourceType;
  source_id?: string;
  track_opens?: boolean;
  track_clicks?: boolean;
}

// ============================================
// WEBHOOK PAYLOAD TYPES
// ============================================

export interface WebhookPayload {
  event_type: string;
  timestamp: string;
  data: {
    event?: EngagementEvent;
    signal?: {
      id: string;
      type: string;
      severity: string;
      title: string;
      description: string;
    };
    deal?: {
      id: string;
      name: string;
      stage: string;
      value: number;
    };
    contact?: {
      id: string;
      name: string;
      email: string;
      company?: string;
    };
  };
  metadata: {
    webhook_id: string;
    delivery_id: string;
    user_id: string;
  };
}

// ============================================
// SIGNAL PROCESSOR TYPES
// ============================================

export interface EngagementSignalRule {
  type: string;
  severity: WebhookSeverity;
  title: (event: EngagementEvent & { contact_name?: string }) => string;
  description?: (event: EngagementEvent & { contact_name?: string }) => string;
  score_boost: number;
}

export type EngagementSignalRules = Record<EngagementEventType | 'email_opened_multiple', EngagementSignalRule>;
