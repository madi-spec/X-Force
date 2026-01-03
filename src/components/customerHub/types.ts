/**
 * Customer Hub (Company 360) Types
 */

export type CustomerHubTab = 'overview' | 'sales' | 'onboarding' | 'engagement' | 'support' | 'timeline' | 'conversations' | 'meetings';

export interface CompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
  status: 'inactive' | 'in_sales' | 'in_onboarding' | 'active' | 'churned' | 'declined';
  mrr: number | null;
  health_score: number | null;
  tier_id: string | null;
  current_stage_id: string | null;
  owner_id: string | null;
  seats: number | null;
  started_at: string | null;
  activated_at: string | null;
  renewal_date: string | null;
  notes: string | null;
  created_at: string;
  product: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    product_type: string;
    icon: string | null;
    color: string | null;
  } | null;
  tier: {
    id: string;
    name: string;
    slug: string;
    price_monthly: number | null;
  } | null;
  current_stage: {
    id: string;
    name: string;
    slug: string;
    stage_order: number;
  } | null;
  owner: {
    id: string;
    name: string;
  } | null;
}

export interface SupportCase {
  id: string;
  company_id: string;
  company_product_id: string | null;
  subject: string;
  description: string | null;
  status: string;
  severity: string;
  assigned_to: {
    id: string;
    name: string;
  } | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface Communication {
  id: string;
  company_id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  content_preview: string | null;
  from_email: string | null;
  to_email: string | null;
  received_at: string | null;
  sent_at: string | null;
  occurred_at: string;
  created_at: string;
  thread_id: string | null;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  is_primary: boolean;
  is_decision_maker: boolean;
  created_at: string;
}

export type TimelineEventType =
  | 'email_sent'
  | 'email_received'
  | 'call'
  | 'meeting'
  | 'note_added'
  | 'case_opened'
  | 'case_resolved'
  | 'product_activated'
  | 'product_added'
  | 'stage_changed'
  | 'contact_added'
  | 'renewal';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  timestamp: string;
  actor: {
    id: string;
    name: string;
  } | null;
  metadata?: Record<string, unknown>;
}

export interface UnifiedTask {
  id: string;
  company_id: string;
  type: 'case_followup' | 'overdue_promise' | 'next_step' | 'manual';
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface MeetingTranscript {
  id: string;
  company_id: string | null;
  title: string;
  meeting_date: string;
  duration_minutes: number | null;
  attendees: string[] | null;
  summary: string | null;
  analysis: {
    headline?: string;
    summary?: string;
    sentiment?: {
      overall?: string;
    };
    keyPoints?: Array<{
      topic: string;
      importance: 'high' | 'medium' | 'low';
    }>;
    buyingSignals?: Array<{
      signal: string;
      strength: 'strong' | 'medium' | 'weak';
    }>;
    objections?: Array<{
      objection: string;
      resolved: boolean;
    }>;
    actionItems?: Array<{
      task: string;
      owner: 'us' | 'them';
      deadline?: string;
    }>;
  } | null;
  source: string;
  created_at: string;
}

export interface CustomerHubStats {
  healthScore: number | null;
  totalMrr: number;
  openCases: number;
  daysSinceContact: number | null;
  renewalDays: number | null;
}

export interface CustomerHubData {
  company: {
    id: string;
    name: string;
    domain: string | null;
    logo_url: string | null;
    status: string | null;
    industry: string | null;
    segment: string | null;
    employee_range: string | null;
    created_at: string;
  };
  companyProducts: CompanyProduct[];
  contacts: Contact[];
  supportCases: SupportCase[];
  communications: Communication[];
  timeline: TimelineEvent[];
  tasks: UnifiedTask[];
  meetings: MeetingTranscript[];
  stats: CustomerHubStats;
}

export interface HeaderChipConfig {
  id: string;
  label: string;
  value: string | number | null;
  color?: string;
  bgColor?: string;
  icon?: string;
  tooltip?: string;
}
