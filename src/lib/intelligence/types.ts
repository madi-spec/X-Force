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
  | 'industry_mentions';

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
// COLLECTOR OPTIONS
// ============================================

export interface CollectorOptions {
  timeout?: number;
  maxRetries?: number;
  skipCache?: boolean;
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
