/**
 * Account Intelligence Types
 * Type definitions for the intelligence collection and synthesis system
 */

// ============================================
// DATABASE ENUMS
// ============================================

export type CollectionStatus = 'pending' | 'collecting' | 'complete' | 'failed' | 'partial';

export type IntelligenceSourceType =
  | 'website'
  | 'facebook'
  | 'google_reviews'
  | 'linkedin_company'
  | 'linkedin_people'
  | 'industry_mentions'
  | 'marketing_activity'
  | 'employee_media'
  | 'blog_detection'
  | 'youtube_detection'
  | 'website_marketing'
  | 'serper_research';

export type ContactSeniority = 'entry' | 'senior' | 'manager' | 'director' | 'vp' | 'c_level' | 'owner' | 'partner';

export type MentionType = 'news' | 'podcast' | 'award' | 'press_release' | 'blog' | 'event' | 'other';

export type MentionSentiment = 'positive' | 'neutral' | 'negative';

export type ContactSource = 'apollo' | 'linkedin' | 'manual';

// ============================================
// DATABASE TYPES
// ============================================

export interface AccountIntelligence {
  id: string;
  company_id: string;

  // Scores
  overall_score: number | null;
  website_score: number | null;
  social_score: number | null;
  review_score: number | null;
  industry_score: number | null;

  // AI Synthesis
  executive_summary: string | null;
  pain_points: PainPoint[];
  opportunities: Opportunity[];
  talking_points: TalkingPoint[];
  recommended_approach: string | null;

  // Enhanced AI Synthesis
  recommendations: Recommendation[];
  connection_points: ConnectionPoint[];
  objection_prep: ObjectionPrep[];
  signals_timeline: SignalEvent[];
  competitive_intel: CompetitiveIntel | null;

  // Deep Intelligence Fields
  company_profile: CompanyProfile | null;
  review_pain_points: ReviewPainPoint[];
  marketing_profile: MarketingProfile | null;
  visible_employees: VisibleEmployee[];
  products_services: ProductService[];
  service_areas: string[];
  certifications: string[];

  // Metadata
  last_collected_at: string | null;
  collection_status: CollectionStatus;
  context_hash: string | null;
  error_message: string | null;

  created_at: string;
  updated_at: string;
}

export interface IntelligenceSource {
  id: string;
  account_intelligence_id: string;

  source_type: IntelligenceSourceType;
  raw_data: Record<string, unknown> | null;
  processed_data: Record<string, unknown> | null;
  quality_score: number | null;

  collected_at: string;
  collection_duration_ms: number | null;
  error_message: string | null;

  created_at: string;
}

export interface ContactIntelligence {
  id: string;
  company_id: string;
  contact_id: string | null;

  // From Apollo/LinkedIn
  full_name: string | null;
  title: string | null;
  department: string | null;
  seniority: ContactSeniority | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;

  // Apollo metadata
  apollo_id: string | null;
  headline: string | null;
  photo_url: string | null;

  // AI Analysis
  relevance_score: number | null;
  engagement_notes: string | null;
  is_decision_maker: boolean;
  recommended_approach: string | null;

  source: ContactSource;
  collected_at: string;

  created_at: string;
  updated_at: string;
}

export interface IndustryMention {
  id: string;
  company_id: string;

  mention_type: MentionType | null;
  title: string;
  source_name: string | null;
  source_url: string | null;
  published_at: string | null;
  summary: string | null;
  content_snippet: string | null;

  sentiment: MentionSentiment | null;
  relevance_score: number | null;

  search_query: string | null;
  serp_position: number | null;

  collected_at: string;
  created_at: string;
}

// ============================================
// AI SYNTHESIS TYPES
// ============================================

export interface PainPoint {
  pain: string;
  evidence: string;
  severity: 'high' | 'medium' | 'low';
  source: string;
}

export interface Opportunity {
  opportunity: string;
  approach: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

export interface TalkingPoint {
  topic: string;
  angle: string;
  source: string;
  useCase: string;
}

export interface Recommendation {
  title: string;
  description: string;
  action: string;
  priority: 1 | 2 | 3 | 4 | 5;
  confidence: 'high' | 'medium' | 'low';
  category: 'outreach' | 'messaging' | 'timing' | 'stakeholder' | 'product';
  source: string;
}

export interface ConnectionPoint {
  type: 'shared_interest' | 'mutual_connection' | 'common_background' | 'local_community' | 'industry_event';
  point: string;
  context: string;
  useCase: string;
  source: string;
}

export interface ObjectionPrep {
  objection: string;
  likelihood: 'high' | 'medium' | 'low';
  response: string;
  evidence: string;
  source: string;
}

export interface SignalEvent {
  date: string;
  type: 'news' | 'hire' | 'growth' | 'funding' | 'review' | 'social' | 'award';
  title: string;
  description: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  source: string;
  url?: string;
}

export interface CompetitiveIntel {
  currentProviders: string[];
  switchingSignals: string[];
  competitorMentions: Array<{
    competitor: string;
    context: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
}

export interface IntelligenceSynthesis {
  executiveSummary: string;
  painPoints: PainPoint[];
  opportunities: Opportunity[];
  talkingPoints: TalkingPoint[];
  recommendedApproach: string;
  scores: {
    overall: number;
    website: number;
    social: number;
    review: number;
    industry: number;
  };
  confidence: number;

  // Enhanced outputs
  recommendations: Recommendation[];
  connectionPoints: ConnectionPoint[];
  objectionPrep: ObjectionPrep[];
  signalsTimeline: SignalEvent[];
  competitiveIntel: CompetitiveIntel;
}

// ============================================
// WEBSITE COLLECTOR TYPES
// ============================================

export interface WebsiteData {
  url: string;
  title: string | null;
  description: string | null;

  // Company info
  companyName: string | null;
  tagline: string | null;
  aboutText: string | null;

  // Services/Products
  services: string[];
  products: string[];

  // Team info
  teamMembers: WebsiteTeamMember[];

  // Contact info
  email: string | null;
  phone: string | null;
  address: string | null;

  // Social links
  socialLinks: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };

  // Content
  blogPosts: WebsiteBlogPost[];
  newsItems: string[];
  testimonials: string[];
  clientLogos: string[];

  // Technical
  technologies: string[];
  pageCount: number;
  crawledUrls: string[];

  // Metadata
  crawledAt: string;
  crawlDurationMs: number;
}

export interface WebsiteTeamMember {
  name: string;
  title: string | null;
  linkedinUrl?: string;
  imageUrl?: string;
}

export interface WebsiteBlogPost {
  title: string;
  url: string;
  date: string | null;
  excerpt: string | null;
}

// ============================================
// FACEBOOK COLLECTOR TYPES
// ============================================

export interface FacebookData {
  pageUrl: string;
  pageName: string | null;
  category: string | null;
  description: string | null;

  // Engagement metrics
  likes: number | null;
  followers: number | null;

  // Contact
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;

  // Hours
  hours: string | null;

  // Posts
  recentPosts: FacebookPost[];

  // Reviews (from Facebook page if available)
  rating: number | null;
  reviewCount: number | null;

  // Metadata
  crawledAt: string;
}

export interface FacebookPost {
  content: string;
  date: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  type: 'text' | 'image' | 'video' | 'link';
}

// ============================================
// GOOGLE REVIEWS COLLECTOR TYPES
// ============================================

export interface GoogleReviewsData {
  placeId: string | null;
  businessName: string;

  // Rating
  rating: number | null;
  totalReviews: number | null;

  // Business info
  address: string | null;
  phone: string | null;
  website: string | null;
  types: string[];

  // Hours
  openingHours: string[] | null;

  // Reviews
  reviews: GoogleReview[];

  // Photos count
  photoCount: number | null;

  // Metadata
  collectedAt: string;
}

export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  date: string;
  relativeTime: string;
}

// ============================================
// APOLLO.IO COLLECTOR TYPES
// ============================================

export interface ApolloCompanyData {
  apolloId: string | null;
  name: string;
  domain: string | null;

  // Company info
  description: string | null;
  shortDescription: string | null;
  industry: string | null;
  subIndustry: string | null;

  // Size
  employeeCount: number | null;
  employeeRange: string | null;

  // Revenue
  revenue: number | null;
  revenueRange: string | null;

  // Location
  headquarters: {
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;

  // Social
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;

  // Tech
  technologies: string[];

  // Founded
  foundedYear: number | null;

  // Keywords/Tags
  keywords: string[];

  // Metadata
  collectedAt: string;
}

export interface ApolloPerson {
  apolloId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;

  // Work
  title: string | null;
  headline: string | null;
  department: string | null;
  seniority: ContactSeniority | null;

  // Contact
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;

  // Photo
  photoUrl: string | null;

  // Employment
  employmentHistory: ApolloEmployment[];
}

export interface ApolloEmployment {
  company: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
}

export interface ApolloPeopleData {
  companyId: string;
  people: ApolloPerson[];
  totalResults: number;
  collectedAt: string;
}

// ============================================
// INDUSTRY MENTIONS COLLECTOR TYPES
// ============================================

export interface IndustryMentionsData {
  companyName: string;
  searchQueries: string[];

  mentions: IndustryMentionItem[];

  // Summary stats
  totalMentions: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;

  // Metadata
  collectedAt: string;
}

export interface IndustryMentionItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  snippet: string;
  mentionType: MentionType;
  sentiment: MentionSentiment;
  relevanceScore: number;
  serpPosition: number;
  searchQuery: string;
}

// ============================================
// ENHANCED WEBSITE COLLECTOR TYPES
// ============================================

export interface EnhancedWebsiteData extends WebsiteData {
  // Operations indicators
  employeeSizeIndicators: {
    teamPageCount: number;
    careersPageExists: boolean;
    jobPostingsCount: number;
    locationsCount: number;
  };

  // Products & Services Deep
  serviceAreas: string[];              // Geographic coverage
  serviceDetails: ServiceDetail[];     // Name, description, pricing hints
  caseStudies: CaseStudy[];            // Title, industry, results

  // Awards & Certifications
  certifications: string[];            // QualityPro, NPMA, BBB, etc.
  awards: string[];                    // Industry awards mentioned

  // Technology signals
  schedulingSystem: string | null;     // Online booking detected?
  paymentMethods: string[];            // Credit card, financing, etc.

  // Content marketing
  blogPostFrequency: 'daily' | 'weekly' | 'monthly' | 'rarely' | 'none';
  lastBlogPostDate: string | null;
  contentTopics: string[];             // What they write about
}

export interface ServiceDetail {
  name: string;
  description: string | null;
  pricingHint: string | null;          // "Starting at $X", "Free estimates", etc.
  isPrimary: boolean;
}

export interface CaseStudy {
  title: string;
  industry: string | null;
  results: string | null;
  url: string | null;
}

// ============================================
// ENHANCED GOOGLE REVIEWS TYPES
// ============================================

export interface EnhancedGoogleReviewsData extends GoogleReviewsData {
  // Pain Point Extraction
  painPointAnalysis: {
    waitTimes: PainPointCategory;
    communication: PainPointCategory;
    pricing: PainPointCategory;
    quality: PainPointCategory;
    scheduling: PainPointCategory;
    staffIssues: PainPointCategory;
  };

  // Sentiment Trends
  ratingTrend: 'improving' | 'stable' | 'declining';
  recentRating: number | null;         // Last 6 months
  historicalRating: number | null;     // Older reviews

  // Response Analysis
  ownerResponseRate: number;           // % of reviews with response
  avgResponseTime: string | null;      // If detectable

  // Competitive mentions
  competitorMentions: string[];        // Other companies mentioned in reviews

  // Service quality signals
  mostPraisedAspects: string[];
  mostCriticizedAspects: string[];
}

export interface PainPointCategory {
  count: number;
  quotes: string[];
}

// ============================================
// ENHANCED APOLLO PEOPLE TYPES
// ============================================

export interface EnhancedApolloPerson extends ApolloPerson {
  // Additional contact info
  personalEmail: string | null;
  mobilePhone: string | null;
  directDial: string | null;

  // Professional profile
  bio: string | null;
  skills: string[];
  certifications: string[];
  yearsInRole: number | null;
  yearsAtCompany: number | null;

  // Decision-making signals
  budgetAuthority: boolean;
  techBuyer: boolean;
  reportsTo: string | null;
  teamSize: number | null;

  // Engagement signals
  linkedinActivityLevel: 'high' | 'medium' | 'low' | 'none';
  recentPosts: number;                 // Posts in last 90 days
  connectionCount: number | null;
}

// ============================================
// MARKETING ACTIVITY COLLECTOR TYPES
// ============================================

export interface MarketingActivityData {
  companyName: string;

  // Social Media Activity
  facebook: {
    postsLast30Days: number;
    avgEngagementRate: number;
    topPostTypes: ('image' | 'video' | 'link' | 'text')[];
    lastPostDate: string | null;
  };

  // LinkedIn Company Activity
  linkedin: {
    followerCount: number | null;
    postsLast30Days: number;
    employeePostingActivity: 'high' | 'medium' | 'low';
    companyUpdatesRecent: boolean;
  };

  // Content Marketing
  blog: {
    postsLast90Days: number;
    avgPostLength: number;
    topics: string[];
    hasEmailCapture: boolean;
  };

  // Overall Assessment
  marketingMaturity: 'sophisticated' | 'active' | 'basic' | 'minimal';
  primaryChannels: string[];
  contentStrategy: string;             // AI-generated assessment

  // Metadata
  collectedAt: string;
}

// ============================================
// EMPLOYEE MEDIA PRESENCE COLLECTOR TYPES
// ============================================

export interface EmployeeMediaData {
  companyName: string;

  // Individual Profiles
  employeeProfiles: EmployeeMediaProfile[];

  // Aggregate Metrics
  totalMediaMentions: number;
  employeesWithPresence: number;
  thoughtLeaders: string[];            // Names of most visible employees

  // Metadata
  collectedAt: string;
}

export interface EmployeeMediaProfile {
  name: string;
  title: string | null;

  // Media Appearances
  podcastAppearances: MediaMention[];
  newsArticles: MediaMention[];
  speakingEvents: MediaMention[];
  publishedContent: MediaMention[];

  // LinkedIn Activity (if accessible)
  linkedinPosts: number;
  linkedinArticles: number;

  // Influence Score
  visibilityScore: number;             // 0-100
}

export interface MediaMention {
  title: string;
  source: string;
  url: string;
  date: string | null;
  type: 'podcast' | 'news' | 'event' | 'article' | 'interview';
}

// ============================================
// DEEP INTELLIGENCE OUTPUT TYPES
// ============================================

export interface CompanyProfile {
  sizeTier: 'startup' | 'smb' | 'mid_market' | 'enterprise';
  employeeEstimate: number | null;
  operationalMaturity: string;
  serviceModel: string;
  techAdoption: string;
  yearsInBusiness: number | null;
}

export interface ReviewPainPoint {
  category: string;
  severity: 'high' | 'medium' | 'low';
  frequency: number;
  quotes: string[];
  implication: string;
}

export interface MarketingProfile {
  maturityLevel: string;
  primaryChannels: string[];
  contentStrategy: string;
  digitalPresence: number;             // 0-100
  recommendation: string;
}

export interface VisibleEmployee {
  name: string;
  title: string | null;
  visibilityScore: number;
  mediaAppearances: number;
  linkedinActive: boolean;
  connectionOpportunity: string;
}

export interface ProductService {
  name: string;
  description: string | null;
  isPrimary: boolean;
}

// ============================================
// ENRICHMENT TYPES
// ============================================

export interface CompanyEnrichmentResult {
  success: boolean;
  fieldsUpdated: string[];
  newValues: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  error: string | null;
}

export interface ContactEnrichmentResult {
  success: boolean;
  enrichedCount: number;
  createdCount: number;
  matchedContacts: {
    contactId: string;
    apolloId: string;
    fieldsUpdated: string[];
  }[];
  error: string | null;
}

export interface SingleContactEnrichmentResult {
  success: boolean;
  contactId: string;
  fieldsUpdated: string[];
  newValues: Record<string, unknown>;
  error: string | null;
}

export interface EnrichmentLogEntry {
  id: string;
  entityType: 'company' | 'contact';
  entityId: string;
  source: string;
  fieldsUpdated: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  createdAt: string;
}

// ============================================
// ENHANCED INTELLIGENCE SYNTHESIS
// ============================================

export interface EnhancedIntelligenceSynthesis extends IntelligenceSynthesis {
  // Company Profile
  companyProfile: CompanyProfile;

  // Review Analysis
  reviewPainPoints: ReviewPainPoint[];

  // Marketing Profile
  marketingProfile: MarketingProfile;

  // Employee Visibility
  visibleEmployees: VisibleEmployee[];

  // Products & Services
  productsServices: ProductService[];

  // Service Areas
  serviceAreas: string[];

  // Certifications
  certifications: string[];
}

// ============================================
// EXTENDED ACCOUNT INTELLIGENCE
// ============================================

export interface ExtendedAccountIntelligence extends AccountIntelligence {
  // Deep intelligence fields
  company_profile: CompanyProfile | null;
  review_pain_points: ReviewPainPoint[];
  marketing_profile: MarketingProfile | null;
  visible_employees: VisibleEmployee[];
  products_services: ProductService[];
  service_areas: string[];
  certifications: string[];
}

// ============================================
// COLLECTOR OPTIONS
// ============================================

export interface CollectorOptions {
  timeout?: number;
  maxRetries?: number;
  skipCache?: boolean;
  /** Known URL to use directly, skipping discovery */
  knownUrl?: string;
}

export interface WebsiteCollectorOptions extends CollectorOptions {
  maxPages?: number;
  crawlDepth?: number;
  includeSubdomains?: boolean;
}

export interface ApolloCollectorOptions extends CollectorOptions {
  maxPeople?: number;
  seniorityFilter?: ContactSeniority[];
  departmentFilter?: string[];
}

export interface IndustryCollectorOptions extends CollectorOptions {
  maxResults?: number;
  searchQueries?: string[];
  dateRange?: 'day' | 'week' | 'month' | 'year';
}

// ============================================
// COLLECTOR RESULT
// ============================================

export interface CollectorResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  qualityScore: number;
  durationMs: number;
}

// ============================================
// ORCHESTRATOR TYPES
// ============================================

export interface CollectionRequest {
  companyId: string;
  companyName: string;
  domain: string | null;
  facebookUrl?: string | null;
  sources?: IntelligenceSourceType[];
  force?: boolean;
}

export interface CollectionProgress {
  companyId: string;
  status: CollectionStatus;
  sourcesTotal: number;
  sourcesCompleted: number;
  sourcesInProgress: IntelligenceSourceType[];
  sourcesFailed: IntelligenceSourceType[];
  startedAt: string;
  estimatedCompletion?: string;
}

export interface CollectionResult {
  companyId: string;
  success: boolean;
  intelligence: AccountIntelligence | null;
  sources: {
    type: IntelligenceSourceType;
    success: boolean;
    qualityScore: number | null;
    error: string | null;
  }[];
  contacts: ContactIntelligence[];
  mentions: IndustryMention[];
  totalDurationMs: number;
}

// ============================================
// API TYPES
// ============================================

export interface GetIntelligenceResponse {
  intelligence: AccountIntelligence | null;
  sources: IntelligenceSource[];
  contacts: ContactIntelligence[];
  mentions: IndustryMention[];
  isStale: boolean;
  lastCollectedAt: string | null;
  companyDomain: string | null;
  suggestedDomain: string | null;  // Auto-detected from contact emails
}

export interface TriggerCollectionRequest {
  force?: boolean;
  sources?: IntelligenceSourceType[];
}

export interface TriggerCollectionResponse {
  status: 'started' | 'already_running' | 'queued';
  intelligenceId: string | null;
  message: string;
}

// ============================================
// EMAIL ANALYSIS TYPES
// ============================================

export interface ContextConnection {
  connection: string;
  prior_date: string | null;
  relevance: string;
}

export interface CommitmentUpdate {
  commitment: string;
  expected_by: string | null;
}

export interface EmailSignalUpdate {
  signal: string;
  quote: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface ConcernUpdate {
  concern: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SuggestedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface CommandCenterClassification {
  tier: 1 | 2 | 3 | 4 | 5;
  tier_trigger: string;
  sla_minutes: number;
  why_now: string;
}

export interface ResponseDraft {
  subject: string;
  body: string;
}

// Communication types based on sales playbook
export type CommunicationType =
  | 'demo_request'
  | 'free_trial_form'
  | 'pricing_request'
  | 'technical_question'
  | 'follow_up'
  | 'objection'
  | 'ready_to_proceed'
  | 'internal_notification'
  | 'other';

// Sales stages
export type SalesStage =
  | 'initial_interest'
  | 'discovery'
  | 'trial'
  | 'proposal'
  | 'closing'
  | 'closed';

// Action owners
export type ActionOwner = 'sales_rep' | 'operations' | 'technical' | 'management';

// Workflow types
export type WorkflowType = 'single_response' | 'multi_step_internal' | 'waiting_on_customer' | 'no_action_needed';

// Required action from playbook analysis
export interface RequiredAction {
  action: string;
  owner: ActionOwner;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
}

// Key observations structure
export interface KeyObservations {
  buying_signals: EmailSignalUpdate[];
  risk_signals: Array<{ signal: string; quote?: string }>;
  urgency_indicators: Array<{ indicator: string; quote?: string }>;
}

export interface InboundEmailAnalysis {
  summary: string;
  full_analysis: string;

  // Playbook-informed classification
  communication_type: CommunicationType;
  communication_type_reasoning: string;
  sales_stage: SalesStage;
  workflow_type: WorkflowType;

  // Legacy field for backward compatibility
  request_type:
    | 'demo_request'
    | 'pricing_question'
    | 'general_question'
    | 'meeting_request'
    | 'follow_up'
    | 'objection'
    | 'positive_response'
    | 'info_share'
    | 'introduction'
    | 'complaint'
    | 'other';

  key_questions: string[];
  context_connections: ContextConnection[];
  key_facts_learned: string[];

  // Enhanced observations from playbook
  key_observations: KeyObservations;

  commitment_updates: {
    fulfilled_theirs: string[];
    new_theirs: CommitmentUpdate[];
  };
  signal_updates: {
    new_buying_signals: EmailSignalUpdate[];
    new_concerns: ConcernUpdate[];
    resolved_concerns: string[];
  };
  sentiment: 'Very Positive' | 'Positive' | 'Neutral' | 'Concerned' | 'Frustrated' | 'Negative';
  urgency: 'High' | 'Medium' | 'Low';
  relationship_progression: {
    momentum: 'accelerating' | 'steady' | 'stalling' | 'at_risk';
    assessment: string;
  };

  // Playbook-informed actions
  required_actions: RequiredAction[];

  // Legacy field for backward compatibility
  suggested_actions: SuggestedAction[];

  response_draft: ResponseDraft;
  command_center_classification: CommandCenterClassification;

  // Entity extraction for auto-linking
  entity_extraction?: {
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_title?: string;
    company_name?: string;
    company_location?: string;
    team_size?: number;
    is_franchisee?: boolean;
    other_facts?: string[];
  };
}
