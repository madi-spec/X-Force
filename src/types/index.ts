// Database Types for X-FORCE Sales Platform

// ============================================
// ENUMS
// ============================================

// Company Status (replaces OrganizationType)
export type CompanyStatus = 'cold_lead' | 'prospect' | 'customer' | 'churned';

export type Segment = 'smb' | 'mid_market' | 'enterprise' | 'pe_platform' | 'franchisor';
export type Industry = 'pest' | 'lawn' | 'both';
export type CRMPlatform = 'fieldroutes' | 'pestpac' | 'realgreen' | 'other' | null;

export type ContactRole = 'decision_maker' | 'influencer' | 'champion' | 'end_user' | 'blocker' | null;

export type DealStage =
  | 'new_lead'
  | 'qualifying'
  | 'discovery'
  | 'demo'
  | 'data_review'
  | 'trial'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type DealType = 'new_business' | 'upsell' | 'cross_sell' | 'expansion' | 'renewal';

export type SalesTeam = 'voice_outside' | 'voice_inside' | 'xrai';

export type ProductOwner = 'voice' | 'xrai';

export type ProductEventType = 'pitched' | 'declined' | 'purchased' | 'churned' | 'upgraded' | 'downgraded';

export type CompanyProductStatus = 'active' | 'churned' | 'paused';

export type CollaboratorRole = 'owner' | 'collaborator' | 'informed';

export type SignalType =
  | 'voicemail_spike'
  | 'queue_time_increase'
  | 'engagement_drop'
  | 'did_request'
  | 'expansion_indicator'
  | 'churn_risk'
  | 'upsell_opportunity';

export type SignalStatus = 'new' | 'acted_on' | 'dismissed';

export type ActivityType = 'email_sent' | 'email_received' | 'meeting_held' | 'call_made' | 'proposal_sent' | 'note' | 'stage_change';
export type Sentiment = 'positive' | 'neutral' | 'negative' | null;

// Activity Type Info
export interface ActivityTypeInfo {
  id: ActivityType;
  name: string;
  icon: string;
  color: string;
}

export const ACTIVITY_TYPES: ActivityTypeInfo[] = [
  { id: 'email_sent', name: 'Email Sent', icon: 'mail', color: 'bg-blue-100 text-blue-700' },
  { id: 'email_received', name: 'Email Received', icon: 'inbox', color: 'bg-blue-50 text-blue-600' },
  { id: 'meeting_held', name: 'Meeting', icon: 'users', color: 'bg-purple-100 text-purple-700' },
  { id: 'call_made', name: 'Call', icon: 'phone', color: 'bg-green-100 text-green-700' },
  { id: 'proposal_sent', name: 'Proposal Sent', icon: 'file-text', color: 'bg-amber-100 text-amber-700' },
  { id: 'note', name: 'Note', icon: 'sticky-note', color: 'bg-gray-100 text-gray-700' },
  { id: 'stage_change', name: 'Stage Change', icon: 'arrow-right', color: 'bg-indigo-100 text-indigo-700' },
];

export type UserRole = 'rep' | 'manager' | 'admin';
export type UserLevel = 'l1_foundation' | 'l2_established' | 'l3_senior';
export type Team = 'xrai' | 'voice';

export type TaskType = 'follow_up' | 'call' | 'email' | 'meeting' | 'review' | 'custom';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskSource = 'ai_recommendation' | 'manual' | 'meeting_extraction' | 'sequence';

export type DealRoomAssetType = 'document' | 'video' | 'link' | 'image';

// ============================================
// SHARED TYPES
// ============================================

// Address
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

// External IDs for integrations
export interface ExternalIds {
  voice_billing_id?: string;
  ats_customer_id?: string;
  fieldroutes_id?: string;
  [key: string]: string | undefined;
}

// Legacy Products type (for backwards compatibility on old deals)
export interface Products {
  voice: boolean;
  platform: boolean;
  ai_agents: string[];
}

// Health Factors
export interface HealthFactors {
  engagement_recency: number;
  stage_velocity: number;
  stakeholder_coverage: number;
  activity_quality: number;
  competitor_risk: number;
  trial_engagement: number;
}

// ============================================
// PRODUCT CATALOG
// ============================================

export interface ProductCategory {
  id: string;
  name: string;
  display_name: string;
  owner: ProductOwner;
  sort_order: number;
  created_at: string;
  // Relations
  products?: Product[];
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  typical_mrr_low: number | null;
  typical_mrr_high: number | null;
  sort_order: number;
  created_at: string;
  // Relations
  category?: ProductCategory;
}

// ============================================
// COMPANIES (formerly Organizations)
// ============================================

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  segment: Segment;
  industry: Industry;
  agent_count: number;
  crm_platform: CRMPlatform;
  address: Address | null;
  voice_customer: boolean;
  voice_customer_since: string | null;
  external_ids: ExternalIds | null;
  created_at: string;
  updated_at: string;
  // Relations
  contacts?: Contact[];
  deals?: Deal[];
  company_products?: CompanyProduct[];
  watchers?: CompanyWatcher[];
  signals?: CompanySignal[];
}

// Alias for backwards compatibility
export type Organization = Company;
export type OrganizationType = CompanyStatus;

// Company Product (what they currently have)
export interface CompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
  status: CompanyProductStatus;
  started_at: string;
  ended_at: string | null;
  churn_reason: string | null;
  mrr: number | null;
  configuration_notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  company?: Company;
  product?: Product;
}

// Company Product History (every pitch, every outcome)
export interface CompanyProductHistory {
  id: string;
  company_id: string;
  product_id: string;
  event_type: ProductEventType;
  event_date: string;
  deal_id: string | null;
  user_id: string;
  notes: string | null;
  decline_reason: string | null;
  created_at: string;
  // Relations
  company?: Company;
  product?: Product;
  deal?: Deal;
  user?: User;
}

// Company Watcher (cross-team coordination)
export interface CompanyWatcher {
  id: string;
  company_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
  // Relations
  company?: Company;
  user?: User;
}

// Company Signal (AI-detected opportunities)
export interface CompanySignal {
  id: string;
  company_id: string;
  signal_type: SignalType;
  signal_data: Record<string, unknown>;
  detected_at: string;
  recommended_action: string | null;
  recommended_product_id: string | null;
  status: SignalStatus;
  assigned_to: string | null;
  acted_on_at: string | null;
  acted_on_by: string | null;
  created_at: string;
  // Relations
  company?: Company;
  recommended_product?: Product;
  assigned_user?: User;
}

// ============================================
// CONTACTS
// ============================================

export interface Contact {
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  role: ContactRole;
  is_primary: boolean;
  last_contacted_at: string | null;
  created_at: string;
  // Relations
  company?: Company;
  // Legacy alias
  organization_id?: string;
  organization?: Company;
}

// ============================================
// DEALS
// ============================================

export interface Deal {
  id: string;
  company_id: string;
  owner_id: string;
  name: string;
  stage: DealStage;
  deal_type: DealType;
  sales_team: SalesTeam | null;
  primary_product_category_id: string | null;
  quoted_products: string[]; // array of product IDs
  health_score: number;
  health_factors: HealthFactors | null;
  estimated_value: number;
  products: Products | null; // legacy field
  competitor_mentioned: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  stage_entered_at: string;
  // Relations
  company?: Company;
  owner?: User;
  contacts?: Contact[];
  collaborators?: DealCollaborator[];
  primary_product_category?: ProductCategory;
  // Legacy aliases
  organization_id?: string;
  organization?: Company;
}

// Deal Collaborator
export interface DealCollaborator {
  id: string;
  deal_id: string;
  user_id: string;
  role: CollaboratorRole;
  added_at: string;
  added_by: string | null;
  // Relations
  deal?: Deal;
  user?: User;
}

// ============================================
// ACTIVITIES
// ============================================

export interface Activity {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string;
  user_id: string;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  sentiment: Sentiment;
  action_items: string[] | null;
  visible_to_teams: string[];
  occurred_at: string;
  created_at: string;
  // Relations
  deal?: Deal;
  contact?: Contact;
  company?: Company;
  user?: User;
  // Legacy aliases
  organization_id?: string;
  organization?: Company;
}

// ============================================
// USERS (Sales Reps)
// ============================================

export interface User {
  id: string;
  auth_id?: string;
  email: string;
  name: string;
  role: UserRole;
  level: UserLevel;
  team: Team;
  territory: string | null;
  is_active: boolean;
  hire_date: string;
  created_at: string;
}

// ============================================
// CERTIFICATIONS
// ============================================

export interface Certification {
  id: string;
  name: string;
  description: string;
  required_for_products: string[];
}

export interface RepCertification {
  user_id: string;
  certification_id: string;
  certified_at: string;
  expires_at: string | null;
  // Relations
  user?: User;
  certification?: Certification;
}

// ============================================
// TASKS
// ============================================

export interface Task {
  id: string;
  deal_id: string | null;
  company_id: string | null;
  assigned_to: string;
  created_by: string | null;
  type: TaskType;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_at: string;
  completed_at: string | null;
  source: TaskSource;
  created_at: string;
  // Relations
  deal?: Deal;
  company?: Company;
  assigned_user?: User;
  creator?: User;
  // Legacy aliases
  organization_id?: string;
  organization?: Company;
}

// ============================================
// DEAL ROOMS
// ============================================

export interface DealRoom {
  id: string;
  deal_id: string;
  slug: string;
  created_at: string;
  // Relations
  deal?: Deal;
  assets?: DealRoomAsset[];
}

export interface DealRoomAsset {
  id: string;
  deal_room_id: string;
  name: string;
  type: DealRoomAssetType;
  url: string;
  stage_visible: string[];
  order: number;
  created_at: string;
  // Relations
  deal_room?: DealRoom;
}

export interface DealRoomView {
  id: string;
  deal_room_id: string;
  asset_id: string | null;
  viewer_email: string | null;
  viewer_name: string | null;
  viewed_at: string;
  duration_seconds: number | null;
  // Relations
  deal_room?: DealRoom;
  asset?: DealRoomAsset;
}

// ============================================
// DEAL STAGE HISTORY
// ============================================

export interface DealStageHistory {
  id: string;
  deal_id: string;
  from_stage: DealStage | null;
  to_stage: DealStage;
  changed_by: string | null;
  changed_at: string;
  // Relations
  deal?: Deal;
  user?: User;
}

// ============================================
// PIPELINE STAGE INFO
// ============================================

export interface PipelineStage {
  id: DealStage;
  name: string;
  order: number;
  color: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'new_lead', name: 'New Lead', order: 1, color: 'bg-gray-500' },
  { id: 'qualifying', name: 'Qualifying', order: 2, color: 'bg-blue-500' },
  { id: 'discovery', name: 'Discovery', order: 3, color: 'bg-indigo-500' },
  { id: 'demo', name: 'Demo', order: 4, color: 'bg-purple-500' },
  { id: 'data_review', name: 'Data Review', order: 5, color: 'bg-pink-500' },
  { id: 'trial', name: 'Trial', order: 6, color: 'bg-orange-500' },
  { id: 'negotiation', name: 'Negotiation', order: 7, color: 'bg-yellow-500' },
  { id: 'closed_won', name: 'Closed Won', order: 8, color: 'bg-green-500' },
  { id: 'closed_lost', name: 'Closed Lost', order: 9, color: 'bg-red-500' },
];

// ============================================
// DEAL TYPE INFO
// ============================================

export interface DealTypeInfo {
  id: DealType;
  name: string;
  description: string;
}

export const DEAL_TYPES: DealTypeInfo[] = [
  { id: 'new_business', name: 'New Business', description: 'First sale to a new company' },
  { id: 'upsell', name: 'Upsell', description: 'Selling more of the same product line' },
  { id: 'cross_sell', name: 'Cross-Sell', description: 'Selling a different product line' },
  { id: 'expansion', name: 'Expansion', description: 'Expanding usage (more seats, locations)' },
  { id: 'renewal', name: 'Renewal', description: 'Contract renewal' },
];

// ============================================
// SALES TEAM INFO
// ============================================

export interface SalesTeamInfo {
  id: SalesTeam;
  name: string;
  description: string;
}

export const SALES_TEAMS: SalesTeamInfo[] = [
  { id: 'voice_outside', name: 'Voice Outside Sales', description: 'Cold leads and new business' },
  { id: 'voice_inside', name: 'Voice Inside Sales', description: 'Existing Voice customer upsells' },
  { id: 'xrai', name: 'X-RAI', description: 'Platform and AI Agents' },
];

// ============================================
// COMPANY STATUS INFO
// ============================================

export interface CompanyStatusInfo {
  id: CompanyStatus;
  name: string;
  description: string;
  color: string;
}

export const COMPANY_STATUSES: CompanyStatusInfo[] = [
  { id: 'cold_lead', name: 'Cold Lead', description: 'No prior relationship', color: 'bg-gray-500' },
  { id: 'prospect', name: 'Prospect', description: 'Engaged in sales conversation', color: 'bg-blue-500' },
  { id: 'customer', name: 'Customer', description: 'Has active products', color: 'bg-green-500' },
  { id: 'churned', name: 'Churned', description: 'Former customer', color: 'bg-red-500' },
];

// ============================================
// SIGNAL TYPE INFO
// ============================================

export interface SignalTypeInfo {
  id: SignalType;
  name: string;
  description: string;
  icon: string;
}

export const SIGNAL_TYPES: SignalTypeInfo[] = [
  { id: 'voicemail_spike', name: 'Voicemail Spike', description: 'High voicemail volume detected', icon: 'voicemail' },
  { id: 'queue_time_increase', name: 'Queue Time Increase', description: 'Call queue times rising', icon: 'clock' },
  { id: 'engagement_drop', name: 'Engagement Drop', description: 'Platform usage declining', icon: 'trending-down' },
  { id: 'did_request', name: 'DID Request', description: 'Requested new phone numbers', icon: 'phone' },
  { id: 'expansion_indicator', name: 'Expansion Indicator', description: 'Growth signals detected', icon: 'arrow-up' },
  { id: 'churn_risk', name: 'Churn Risk', description: 'Customer may be at risk', icon: 'alert-triangle' },
  { id: 'upsell_opportunity', name: 'Upsell Opportunity', description: 'Opportunity for additional products', icon: 'plus-circle' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export function getHealthScoreLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Needs Attention';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

export function getCompanyStatusColor(status: CompanyStatus): string {
  const statusInfo = COMPANY_STATUSES.find(s => s.id === status);
  return statusInfo?.color || 'bg-gray-500';
}

export function getDealTypeLabel(dealType: DealType): string {
  const typeInfo = DEAL_TYPES.find(t => t.id === dealType);
  return typeInfo?.name || dealType;
}

export function getSalesTeamLabel(team: SalesTeam): string {
  const teamInfo = SALES_TEAMS.find(t => t.id === team);
  return teamInfo?.name || team;
}

// ============================================
// MICROSOFT 365 INTEGRATION
// ============================================

export interface MicrosoftConnection {
  id: string;
  user_id: string;
  microsoft_user_id: string | null;
  email: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  connected_at: string;
  last_sync_at: string | null;
  is_active: boolean;
  // Relations
  user?: User;
}

export interface MicrosoftEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: {
    contentType: 'Text' | 'HTML';
    content: string;
  };
  from?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  conversationId?: string;
  isRead?: boolean;
  // X-FORCE enrichment
  linkedCompany?: Company;
  linkedContact?: Contact;
  linkedDeal?: Deal;
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    contentType: 'Text' | 'HTML';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: 'required' | 'optional';
    status?: {
      response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined';
    };
  }>;
  isOnlineMeeting?: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  isCancelled?: boolean;
}

export interface EmailSyncResult {
  newEmails: number;
  updatedEmails: number;
  errors: string[];
}

export interface CalendarSyncResult {
  newEvents: number;
  updatedEvents: number;
  errors: string[];
}
