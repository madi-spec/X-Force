/**
 * Intelligence Data Layer Types
 * Two-layer architecture: Data Layer + Analysis Layer
 * All fields have source attribution and are editable by users
 */

// ============================================
// SOURCE ATTRIBUTION
// ============================================

/**
 * Data confidence level
 * high = verified or from authoritative source
 * medium = from reliable source but may need verification
 * low = estimated or from unreliable source
 */
export type DataConfidence = 'high' | 'medium' | 'low';

/**
 * Every data field has source attribution
 * This allows tracking where data came from and verification status
 */
export interface SourcedField<T> {
  value: T | null;
  source: string | null;
  sourceUrl: string | null;
  verified: boolean;
  lastChecked: string | null;
  confidence?: DataConfidence;
  conflictsWith?: string[]; // Other sources with different values
}

/**
 * Create a sourced field with defaults
 */
export function createSourcedField<T>(
  value: T | null = null,
  source: string | null = null,
  sourceUrl: string | null = null,
  confidence?: DataConfidence
): SourcedField<T> {
  return {
    value,
    source,
    sourceUrl,
    verified: false,
    lastChecked: new Date().toISOString(),
    confidence,
  };
}

// ============================================
// COMPANY PROFILE
// ============================================

export interface CompanyProfileData {
  founded_year: SourcedField<number>;
  employee_count: SourcedField<number>;
  employee_range: SourcedField<string>;
  annual_revenue: SourcedField<number>;
  revenue_range: SourcedField<string>;
  headquarters: SourcedField<string>;
  locations_count: SourcedField<number>;
  company_type: SourcedField<string>;
  ownership: SourcedField<string>;
}

// ============================================
// ONLINE PRESENCE
// ============================================

export interface OnlinePresenceData {
  website_url: SourcedField<string>;
  linkedin_url: SourcedField<string>;
  linkedin_followers: SourcedField<number>;
  facebook_url: SourcedField<string>;
  facebook_followers: SourcedField<number>;
  twitter_url: SourcedField<string>;
  instagram_url: SourcedField<string>;
  youtube_url: SourcedField<string>;
  youtube_subscribers: SourcedField<number>;
}

// ============================================
// REVIEWS
// ============================================

export interface ReviewData {
  author: string;
  rating: number;
  text: string;
  date: string;
  source: string;
}

export interface ReviewsData {
  google_rating: SourcedField<number>;
  google_review_count: SourcedField<number>;
  google_place_id: SourcedField<string>;
  facebook_rating: SourcedField<number>;
  facebook_review_count: SourcedField<number>;
  bbb_rating: SourcedField<string>;
  yelp_rating: SourcedField<number>;
  review_velocity_30d: SourcedField<number>;
  recent_reviews: SourcedField<ReviewData[]>;
}

// ============================================
// MARKETING
// ============================================

export interface MarketingData {
  has_blog: SourcedField<boolean>;
  blog_url: SourcedField<string>;
  blog_post_frequency: SourcedField<string>;
  last_blog_post_date: SourcedField<string>;
  email_marketing: SourcedField<boolean>;
  social_posting_frequency: SourcedField<string>;
  has_paid_ads: SourcedField<boolean>;
  marketing_sophistication: SourcedField<string>;
  primary_channels: SourcedField<string[]>;
}

// ============================================
// TECHNOLOGY
// ============================================

export interface TechnologyData {
  crm_system: SourcedField<string>;
  routing_software: SourcedField<string>;
  phone_system: SourcedField<string>;
  payment_processor: SourcedField<string>;
  website_platform: SourcedField<string>;
  scheduling_system: SourcedField<string>;
  detected_technologies: SourcedField<string[]>;
  has_online_booking: SourcedField<boolean>;
  has_live_chat: SourcedField<boolean>;
}

// ============================================
// FINANCIAL
// ============================================

export interface FinancialData {
  estimated_revenue: SourcedField<number>;
  growth_signals: SourcedField<string[]>;
  funding_status: SourcedField<string>;
  recent_acquisitions: SourcedField<string[]>;
  hiring_activity: SourcedField<string>;
  job_postings_count: SourcedField<number>;
}

// ============================================
// SERVICES
// ============================================

export interface ServicesData {
  primary_services: SourcedField<string[]>;
  service_areas: SourcedField<string[]>;
  certifications: SourcedField<string[]>;
  awards: SourcedField<string[]>;
  specializations: SourcedField<string[]>;
}

// ============================================
// KEY PEOPLE
// ============================================

export interface KeyPerson {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  seniority: string | null;
  department: string | null;
  source: string;
  sourceUrl: string | null;
  photoUrl: string | null;
  isDecisionMaker: boolean;
}

// ============================================
// INDUSTRY MENTIONS
// ============================================

export interface IndustryMention {
  title: string;
  source: string;
  sourceUrl: string;
  date: string | null;
  type: 'news' | 'podcast' | 'award' | 'press_release' | 'blog' | 'event' | 'other';
  sentiment: 'positive' | 'neutral' | 'negative';
  snippet: string | null;
}

// ============================================
// MAIN INTELLIGENCE DATA TYPE
// ============================================

export interface CompanyIntelligence {
  id: string;
  company_id: string;

  // Data Categories
  company_profile: CompanyProfileData;
  online_presence: OnlinePresenceData;
  reviews: ReviewsData;
  marketing: MarketingData;
  technology: TechnologyData;
  financial: FinancialData;
  services: ServicesData;

  // Lists
  key_people: KeyPerson[];
  industry_mentions: IndustryMention[];

  // Collection Metadata
  collection_status: 'pending' | 'collecting' | 'complete' | 'failed' | 'partial';
  last_collected_at: string | null;
  collection_errors: CollectionError[];

  // Data Quality
  completeness_score: number;
  data_quality_score: number;

  created_at: string;
  updated_at: string;
}

export interface CollectionError {
  source: string;
  error: string;
  timestamp: string;
}

// ============================================
// AI ANALYSIS (On-Demand Layer)
// ============================================

export interface SWOTItem {
  point: string;
  evidence: string;
  source: string;
}

export interface PainPoint {
  pain: string;
  evidence: string;
  severity: 'high' | 'medium' | 'low';
  source: string;
}

export interface TalkingPoint {
  topic: string;
  angle: string;
  source: string;
  useCase: string;
}

export interface ObjectionHandler {
  objection: string;
  response: string;
  evidence: string;
}

export interface CompetitorMention {
  competitor: string;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface DifferentiationAngle {
  angle: string;
  approach: string;
  evidence: string;
}

export interface ConnectionPoint {
  type: 'shared_interest' | 'mutual_connection' | 'common_background' | 'local_community' | 'industry_event';
  point: string;
  context: string;
  useCase: string;
}

export interface BuyingSignal {
  signal: string;
  interpretation: string;
  source: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface IntelligenceAnalysis {
  id: string;
  company_id: string;
  intelligence_id: string | null;

  analysis_type: 'full' | 'quick' | 'competitive' | 'pain_points';

  // Executive Summary
  executive_summary: string | null;

  // SWOT Analysis
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];

  // Sales Intelligence
  pain_points: PainPoint[];
  talking_points: TalkingPoint[];
  recommended_approach: string | null;
  objection_handlers: ObjectionHandler[];

  // Competitive Analysis
  competitive_position: string | null;
  competitor_mentions: CompetitorMention[];
  differentiation_angles: DifferentiationAngle[];

  // Connection Points
  connection_points: ConnectionPoint[];

  // Timing & Signals
  buying_signals: BuyingSignal[];
  timing_assessment: string | null;
  urgency_level: 'high' | 'medium' | 'low' | null;

  // Scores
  overall_score: number | null;
  engagement_score: number | null;
  fit_score: number | null;

  // Metadata
  data_snapshot_hash: string | null;
  model_version: string | null;
  tokens_used: number | null;
  generation_time_ms: number | null;

  created_at: string;
  expires_at: string;
}

// ============================================
// EDIT HISTORY
// ============================================

export interface IntelligenceEdit {
  id: string;
  intelligence_id: string;
  field_path: string;
  previous_value: unknown;
  new_value: unknown;
  edit_reason: string | null;
  edited_by: string | null;
  edited_by_name: string | null;
  created_at: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface GetIntelligenceDataResponse {
  intelligence: CompanyIntelligence | null;
  latestAnalysis: IntelligenceAnalysis | null;
  editHistory: IntelligenceEdit[];
  companyDomain?: string | null;
}

export interface UpdateIntelligenceFieldRequest {
  fieldPath: string;
  value: unknown;
  source?: string;
  sourceUrl?: string;
  reason?: string;
}

export interface UpdateIntelligenceFieldResponse {
  success: boolean;
  intelligence: CompanyIntelligence;
  edit: IntelligenceEdit;
}

export interface GenerateAnalysisRequest {
  analysisType?: 'full' | 'quick' | 'competitive' | 'pain_points';
  forceRefresh?: boolean;
}

export interface GenerateAnalysisResponse {
  success: boolean;
  analysis: IntelligenceAnalysis;
  cached: boolean;
}

export interface CollectIntelligenceRequest {
  sources?: string[];
  force?: boolean;
}

export interface CollectIntelligenceResponse {
  success: boolean;
  intelligence: CompanyIntelligence;
  errors: CollectionError[];
}

// ============================================
// UI HELPER TYPES
// ============================================

export type FieldCategory =
  | 'company_profile'
  | 'online_presence'
  | 'reviews'
  | 'marketing'
  | 'technology'
  | 'financial'
  | 'services';

export interface FieldDefinition {
  key: string;
  label: string;
  category: FieldCategory;
  type: 'text' | 'number' | 'boolean' | 'date' | 'url' | 'list' | 'currency';
  editable: boolean;
  placeholder?: string;
  helpText?: string;
}

/**
 * Field definitions for the UI
 */
export const FIELD_DEFINITIONS: Record<FieldCategory, FieldDefinition[]> = {
  company_profile: [
    { key: 'founded_year', label: 'Founded Year', category: 'company_profile', type: 'number', editable: true, placeholder: 'e.g., 2005' },
    { key: 'employee_count', label: 'Employee Count', category: 'company_profile', type: 'number', editable: true, placeholder: 'e.g., 150' },
    { key: 'employee_range', label: 'Employee Range', category: 'company_profile', type: 'text', editable: true, placeholder: 'e.g., 100-500' },
    { key: 'annual_revenue', label: 'Annual Revenue', category: 'company_profile', type: 'currency', editable: true, placeholder: 'e.g., 5000000' },
    { key: 'revenue_range', label: 'Revenue Range', category: 'company_profile', type: 'text', editable: true, placeholder: 'e.g., $1M-$10M' },
    { key: 'headquarters', label: 'Headquarters', category: 'company_profile', type: 'text', editable: true, placeholder: 'City, State' },
    { key: 'locations_count', label: 'Locations', category: 'company_profile', type: 'number', editable: true, placeholder: 'e.g., 5' },
    { key: 'company_type', label: 'Company Type', category: 'company_profile', type: 'text', editable: true, placeholder: 'e.g., Private, Public' },
    { key: 'ownership', label: 'Ownership', category: 'company_profile', type: 'text', editable: true, placeholder: 'e.g., PE-backed, Family-owned' },
  ],
  online_presence: [
    { key: 'website_url', label: 'Website', category: 'online_presence', type: 'url', editable: true },
    { key: 'linkedin_url', label: 'LinkedIn', category: 'online_presence', type: 'url', editable: true },
    { key: 'linkedin_followers', label: 'LinkedIn Followers', category: 'online_presence', type: 'number', editable: true },
    { key: 'facebook_url', label: 'Facebook', category: 'online_presence', type: 'url', editable: true },
    { key: 'facebook_followers', label: 'Facebook Followers', category: 'online_presence', type: 'number', editable: true },
    { key: 'twitter_url', label: 'Twitter/X', category: 'online_presence', type: 'url', editable: true },
    { key: 'instagram_url', label: 'Instagram', category: 'online_presence', type: 'url', editable: true },
    { key: 'youtube_url', label: 'YouTube', category: 'online_presence', type: 'url', editable: true },
    { key: 'youtube_subscribers', label: 'YouTube Subscribers', category: 'online_presence', type: 'number', editable: true },
  ],
  reviews: [
    { key: 'google_rating', label: 'Google Rating', category: 'reviews', type: 'number', editable: false },
    { key: 'google_review_count', label: 'Google Reviews', category: 'reviews', type: 'number', editable: false },
    { key: 'facebook_rating', label: 'Facebook Rating', category: 'reviews', type: 'number', editable: false },
    { key: 'facebook_review_count', label: 'Facebook Reviews', category: 'reviews', type: 'number', editable: false },
    { key: 'bbb_rating', label: 'BBB Rating', category: 'reviews', type: 'text', editable: true },
    { key: 'yelp_rating', label: 'Yelp Rating', category: 'reviews', type: 'number', editable: false },
    { key: 'review_velocity_30d', label: 'Reviews (Last 30 Days)', category: 'reviews', type: 'number', editable: false },
  ],
  marketing: [
    { key: 'has_blog', label: 'Has Blog', category: 'marketing', type: 'boolean', editable: false },
    { key: 'blog_url', label: 'Blog URL', category: 'marketing', type: 'url', editable: true },
    { key: 'blog_post_frequency', label: 'Blog Frequency', category: 'marketing', type: 'text', editable: false },
    { key: 'last_blog_post_date', label: 'Last Blog Post', category: 'marketing', type: 'date', editable: false },
    { key: 'email_marketing', label: 'Email Marketing', category: 'marketing', type: 'boolean', editable: true },
    { key: 'social_posting_frequency', label: 'Social Frequency', category: 'marketing', type: 'text', editable: false },
    { key: 'has_paid_ads', label: 'Running Paid Ads', category: 'marketing', type: 'boolean', editable: true },
    { key: 'marketing_sophistication', label: 'Sophistication Level', category: 'marketing', type: 'text', editable: false },
  ],
  technology: [
    { key: 'crm_system', label: 'CRM System', category: 'technology', type: 'text', editable: true, placeholder: 'e.g., FieldRoutes, PestPac' },
    { key: 'routing_software', label: 'Routing Software', category: 'technology', type: 'text', editable: true },
    { key: 'phone_system', label: 'Phone System', category: 'technology', type: 'text', editable: true },
    { key: 'payment_processor', label: 'Payment Processor', category: 'technology', type: 'text', editable: true },
    { key: 'website_platform', label: 'Website Platform', category: 'technology', type: 'text', editable: false },
    { key: 'scheduling_system', label: 'Scheduling System', category: 'technology', type: 'text', editable: true },
    { key: 'has_online_booking', label: 'Online Booking', category: 'technology', type: 'boolean', editable: false },
    { key: 'has_live_chat', label: 'Live Chat', category: 'technology', type: 'boolean', editable: false },
  ],
  financial: [
    { key: 'estimated_revenue', label: 'Estimated Revenue', category: 'financial', type: 'currency', editable: true },
    { key: 'funding_status', label: 'Funding Status', category: 'financial', type: 'text', editable: true, placeholder: 'e.g., Bootstrapped, Series A' },
    { key: 'hiring_activity', label: 'Hiring Activity', category: 'financial', type: 'text', editable: false },
    { key: 'job_postings_count', label: 'Open Positions', category: 'financial', type: 'number', editable: false },
  ],
  services: [
    { key: 'primary_services', label: 'Primary Services', category: 'services', type: 'list', editable: true },
    { key: 'service_areas', label: 'Service Areas', category: 'services', type: 'list', editable: true },
    { key: 'certifications', label: 'Certifications', category: 'services', type: 'list', editable: true },
    { key: 'awards', label: 'Awards', category: 'services', type: 'list', editable: true },
    { key: 'specializations', label: 'Specializations', category: 'services', type: 'list', editable: true },
  ],
};
