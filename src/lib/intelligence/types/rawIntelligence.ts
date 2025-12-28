/**
 * Raw Intelligence Types
 *
 * Types for the separated data collection architecture:
 * - Raw data (collected, no analysis)
 * - Analysis (user-triggered AI insights)
 */

// ============================================
// SOURCED FIELD (with verification)
// ============================================

export type DataConfidence = 'high' | 'medium' | 'low';

export interface SourcedField<T> {
  value: T | null;
  source: string | null;
  sourceUrl: string | null;
  confidence: DataConfidence;
  verified: boolean;
  collectedAt?: string;
}

export function createSourcedField<T>(
  value: T | null,
  source: string | null = null,
  sourceUrl: string | null = null,
  confidence: DataConfidence = 'low',
  verified: boolean = false
): SourcedField<T> {
  return {
    value,
    source,
    sourceUrl,
    confidence,
    verified,
    collectedAt: new Date().toISOString(),
  };
}

export function emptySourcedField<T>(): SourcedField<T> {
  return {
    value: null,
    source: null,
    sourceUrl: null,
    confidence: 'low',
    verified: false,
  };
}

// ============================================
// NESTED TYPES
// ============================================

export interface LeadershipPerson {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  bio: string | null;
  isOwner: boolean;
  isFamily: boolean;
  isDecisionMaker: boolean;
}

export interface AwardEntry {
  name: string;
  year: number | null;
  rank: number | null;
  issuer: string | null;
  personHonored: string | null;
  sourceUrl: string | null;
}

export interface TechStackEntry {
  name: string;
  category: 'crm' | 'phone' | 'routing' | 'marketing' | 'scheduling' | 'other';
  confidence: DataConfidence;
  evidence: string | null;
  sourceUrl: string | null;
}

export interface AcquisitionEntry {
  companyName: string;
  year: number | null;
  type: 'full' | 'partial' | 'merger' | 'unknown';
  sourceUrl: string | null;
}

export interface ExpansionEntry {
  description: string;
  date: string | null;
  type: 'new_location' | 'new_service' | 'new_market' | 'other';
  sourceUrl: string | null;
}

export interface QuoteEntry {
  quote: string;
  speaker: string | null;
  speakerTitle: string | null;
  context: string | null;
  sourceUrl: string | null;
}

export interface AssociationMembership {
  name: string;
  role: string | null;
  isBoardMember: boolean;
}

export interface JobPosting {
  title: string;
  location: string | null;
  postedDate: string | null;
  sourceUrl: string | null;
}

// ============================================
// RAW INTELLIGENCE DATA
// ============================================

export type CollectionStatus =
  | 'pending'
  | 'collecting'
  | 'collected'
  | 'reviewed'
  | 'verified'
  | 'failed';

export interface RawIntelligenceData {
  id: string;
  company_id: string;

  // Identity
  company_name: SourcedField<string>;
  dba_names: SourcedField<string[]>;
  former_names: SourcedField<string[]>;
  website: SourcedField<string>;

  // Founding & History
  year_founded: SourcedField<number>;
  founded_by: SourcedField<string>;
  founding_story: SourcedField<string>;
  founding_city: SourcedField<string>;
  founding_state: SourcedField<string>;

  // Ownership
  ownership_type: SourcedField<'family' | 'pe_backed' | 'franchise' | 'independent' | 'public'>;
  owner_name: SourcedField<string>;
  owner_title: SourcedField<string>;
  family_generation: SourcedField<number>;
  pe_firm_name: SourcedField<string>;
  franchise_brand: SourcedField<string>;

  // Size & Scale
  employee_count: SourcedField<number>;
  location_count: SourcedField<number>;
  states_served: SourcedField<string[]>;
  estimated_revenue: SourcedField<number>;
  revenue_range: SourcedField<string>;

  // Headquarters
  hq_address: SourcedField<string>;
  hq_city: SourcedField<string>;
  hq_state: SourcedField<string>;
  hq_zip: SourcedField<string>;

  // Leadership
  leadership_team: SourcedField<LeadershipPerson[]>;

  // Services
  services_offered: SourcedField<string[]>;
  specializations: SourcedField<string[]>;
  industries_served: SourcedField<string[]>;

  // Online Presence
  google_rating: SourcedField<number>;
  google_review_count: SourcedField<number>;
  google_place_id: SourcedField<string>;
  linkedin_url: SourcedField<string>;
  linkedin_followers: SourcedField<number>;
  facebook_url: SourcedField<string>;
  facebook_followers: SourcedField<number>;
  facebook_rating: SourcedField<number>;
  twitter_url: SourcedField<string>;
  instagram_url: SourcedField<string>;
  youtube_url: SourcedField<string>;

  // Reputation
  bbb_rating: SourcedField<string>;
  bbb_accredited: SourcedField<boolean>;
  yelp_rating: SourcedField<number>;
  yelp_review_count: SourcedField<number>;

  // Awards & Recognition
  awards: SourcedField<AwardEntry[]>;
  certifications: SourcedField<string[]>;

  // Technology
  tech_stack: SourcedField<TechStackEntry[]>;
  has_customer_portal: SourcedField<boolean>;
  has_online_scheduling: SourcedField<boolean>;
  has_mobile_app: SourcedField<boolean>;

  // M&A Activity
  acquisitions_made: SourcedField<AcquisitionEntry[]>;
  was_acquired: SourcedField<boolean>;
  acquired_by: SourcedField<string>;
  acquisition_year: SourcedField<number>;

  // Growth Signals
  is_hiring: SourcedField<boolean>;
  open_positions: SourcedField<JobPosting[]>;
  recent_expansions: SourcedField<ExpansionEntry[]>;

  // Content & Culture
  tagline: SourcedField<string>;
  company_values: SourcedField<string[]>;
  mission_statement: SourcedField<string>;
  key_quotes: SourcedField<QuoteEntry[]>;
  differentiators: SourcedField<string[]>;

  // Contact
  main_phone: SourcedField<string>;
  main_email: SourcedField<string>;

  // Associations
  association_memberships: SourcedField<AssociationMembership[]>;

  // Metadata
  collection_status: CollectionStatus;
  data_completeness: number;
  collected_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sources_used: string[];
  collection_notes: string[];
  user_notes: string[];
  collection_errors: string[];

  created_at: string;
  updated_at: string;
}

// ============================================
// FIELD EDIT
// ============================================

export interface FieldEdit {
  id: string;
  raw_id: string;
  company_id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  edited_by: string | null;
  edited_at: string;
  edit_reason: string | null;
}

// ============================================
// AI ANALYSIS
// ============================================

export interface CompanySignals {
  // Growth
  isActiveAcquirer: boolean;
  acquisitionCount: number;
  isFastGrowing: boolean;
  growthAwards: string[];
  isExpanding: boolean;
  isHiring: boolean;
  hiringIntensity: 'none' | 'low' | 'moderate' | 'high';

  // Leadership
  hasYoungLeadership: boolean;
  youngLeaderEvidence: string[];
  hasProgressiveLeadership: boolean;
  progressiveEvidence: string[];
  isFounderLed: boolean;
  isNextGenLed: boolean;
  generationNumber: number | null;

  // Technology
  isTechForward: boolean;
  techForwardEvidence: string[];
  confirmedTechnologies: string[];
  hasTechGaps: boolean;

  // Market Position
  isIndustryLeader: boolean;
  pctRank: number | null;
  isRegionalPlayer: boolean;
  regionsCovered: string[];

  // Financial
  isPEBacked: boolean;
  peFirmName: string | null;
  isBootstrapped: boolean;

  // Recognition
  majorAwards: string[];
  personalAwards: string[];

  // Culture
  valuesInnovation: boolean;
  valuesStability: boolean;
  valuesCommunity: boolean;
  statedValues: string[];
}

export interface TalkingPoint {
  point: string;
  dataReference: string;
}

export interface ObjectionEntry {
  objection: string;
  response: string | null;
}

export interface IntelligenceAnalysis {
  id: string;
  company_id: string;
  raw_id: string | null;

  // Signals
  signals: CompanySignals;

  // Positioning
  primary_positioning: string;
  positioning_emoji: string;
  secondary_positioning: string[];
  classification_tags: string[];
  signal_summary: string;

  // Sales Approach
  why_they_buy: string;
  key_messages: string[];
  entry_point: string;
  best_timing: string;
  target_roles: string[];

  // Details
  talking_points: TalkingPoint[];
  likely_objections: ObjectionEntry[];
  questions_to_ask: string[];
  things_to_avoid: string[];
  call_prep_checklist: string[];

  // Full Report
  full_report_markdown: string | null;

  // Metadata
  generated_at: string;
  generated_by: string | null;
  data_snapshot: RawIntelligenceData | null;
  generation_model: string;

  created_at: string;
  updated_at: string;
}

// ============================================
// API TYPES
// ============================================

export interface CollectIntelligenceRequest {
  force?: boolean;
  sources?: string[];
}

export interface CollectIntelligenceResponse {
  success: boolean;
  status: CollectionStatus;
  dataCompleteness: number;
  data: RawIntelligenceData;
  collectionNotes: string[];
  errors: string[];
}

export interface UpdateFieldRequest {
  fieldName: string;
  newValue: unknown;
  reason?: string;
}

export interface UpdateFieldResponse {
  success: boolean;
  field: SourcedField<unknown>;
  edit: FieldEdit;
}

export interface VerifyFieldsRequest {
  fields: string[] | 'all';
}

export interface VerifyFieldsResponse {
  success: boolean;
  verifiedCount: number;
  updatedFields: string[];
}

export interface GenerateAnalysisRequest {
  regenerate?: boolean;
}

export interface GenerateAnalysisResponse {
  success: boolean;
  analysis: IntelligenceAnalysis;
  cached: boolean;
}

// ============================================
// FIELD DEFINITIONS (for UI)
// ============================================

export type FieldCategory =
  | 'identity'
  | 'founding'
  | 'ownership'
  | 'size'
  | 'headquarters'
  | 'leadership'
  | 'services'
  | 'online_presence'
  | 'reputation'
  | 'awards'
  | 'technology'
  | 'mna'
  | 'growth'
  | 'culture'
  | 'contact'
  | 'associations';

export interface FieldDefinition {
  key: keyof RawIntelligenceData;
  label: string;
  category: FieldCategory;
  type: 'text' | 'number' | 'boolean' | 'array' | 'object_array' | 'select';
  editable: boolean;
  important: boolean; // Show in summary view
  placeholder?: string;
  options?: string[]; // For select type
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // Identity
  { key: 'company_name', label: 'Company Name', category: 'identity', type: 'text', editable: true, important: true },
  { key: 'dba_names', label: 'DBA Names', category: 'identity', type: 'array', editable: true, important: false },
  { key: 'former_names', label: 'Former Names', category: 'identity', type: 'array', editable: true, important: false },
  { key: 'website', label: 'Website', category: 'identity', type: 'text', editable: true, important: true },

  // Founding
  { key: 'year_founded', label: 'Year Founded', category: 'founding', type: 'number', editable: true, important: true },
  { key: 'founded_by', label: 'Founded By', category: 'founding', type: 'text', editable: true, important: false },
  { key: 'founding_story', label: 'Founding Story', category: 'founding', type: 'text', editable: true, important: false },
  { key: 'founding_city', label: 'Founding City', category: 'founding', type: 'text', editable: true, important: false },
  { key: 'founding_state', label: 'Founding State', category: 'founding', type: 'text', editable: true, important: false },

  // Ownership
  { key: 'ownership_type', label: 'Ownership Type', category: 'ownership', type: 'select', editable: true, important: true, options: ['family', 'pe_backed', 'franchise', 'independent', 'public'] },
  { key: 'owner_name', label: 'Owner Name', category: 'ownership', type: 'text', editable: true, important: true },
  { key: 'owner_title', label: 'Owner Title', category: 'ownership', type: 'text', editable: true, important: false },
  { key: 'family_generation', label: 'Family Generation', category: 'ownership', type: 'number', editable: true, important: false },
  { key: 'pe_firm_name', label: 'PE Firm', category: 'ownership', type: 'text', editable: true, important: false },
  { key: 'franchise_brand', label: 'Franchise Brand', category: 'ownership', type: 'text', editable: true, important: false },

  // Size
  { key: 'employee_count', label: 'Employee Count', category: 'size', type: 'number', editable: true, important: true },
  { key: 'location_count', label: 'Location Count', category: 'size', type: 'number', editable: true, important: true },
  { key: 'states_served', label: 'States Served', category: 'size', type: 'array', editable: true, important: false },
  { key: 'estimated_revenue', label: 'Est. Revenue ($)', category: 'size', type: 'number', editable: true, important: true },
  { key: 'revenue_range', label: 'Revenue Range', category: 'size', type: 'text', editable: true, important: false },

  // Headquarters
  { key: 'hq_address', label: 'HQ Address', category: 'headquarters', type: 'text', editable: true, important: false },
  { key: 'hq_city', label: 'HQ City', category: 'headquarters', type: 'text', editable: true, important: true },
  { key: 'hq_state', label: 'HQ State', category: 'headquarters', type: 'text', editable: true, important: true },
  { key: 'hq_zip', label: 'HQ ZIP', category: 'headquarters', type: 'text', editable: true, important: false },

  // Leadership
  { key: 'leadership_team', label: 'Leadership Team', category: 'leadership', type: 'object_array', editable: true, important: true },

  // Services
  { key: 'services_offered', label: 'Services', category: 'services', type: 'array', editable: true, important: true },
  { key: 'specializations', label: 'Specializations', category: 'services', type: 'array', editable: true, important: false },
  { key: 'industries_served', label: 'Industries Served', category: 'services', type: 'array', editable: true, important: false },

  // Online Presence
  { key: 'google_rating', label: 'Google Rating', category: 'online_presence', type: 'number', editable: true, important: true },
  { key: 'google_review_count', label: 'Google Reviews', category: 'online_presence', type: 'number', editable: true, important: true },
  { key: 'linkedin_url', label: 'LinkedIn URL', category: 'online_presence', type: 'text', editable: true, important: false },
  { key: 'linkedin_followers', label: 'LinkedIn Followers', category: 'online_presence', type: 'number', editable: true, important: false },
  { key: 'facebook_url', label: 'Facebook URL', category: 'online_presence', type: 'text', editable: true, important: false },
  { key: 'facebook_followers', label: 'Facebook Followers', category: 'online_presence', type: 'number', editable: true, important: false },

  // Awards
  { key: 'awards', label: 'Awards', category: 'awards', type: 'object_array', editable: true, important: true },
  { key: 'certifications', label: 'Certifications', category: 'awards', type: 'array', editable: true, important: false },

  // Technology
  { key: 'tech_stack', label: 'Technology Stack', category: 'technology', type: 'object_array', editable: true, important: true },
  { key: 'has_customer_portal', label: 'Has Customer Portal', category: 'technology', type: 'boolean', editable: true, important: false },
  { key: 'has_online_scheduling', label: 'Has Online Scheduling', category: 'technology', type: 'boolean', editable: true, important: false },

  // M&A
  { key: 'acquisitions_made', label: 'Acquisitions Made', category: 'mna', type: 'object_array', editable: true, important: true },
  { key: 'was_acquired', label: 'Was Acquired', category: 'mna', type: 'boolean', editable: true, important: false },
  { key: 'acquired_by', label: 'Acquired By', category: 'mna', type: 'text', editable: true, important: false },

  // Growth
  { key: 'is_hiring', label: 'Is Hiring', category: 'growth', type: 'boolean', editable: true, important: true },
  { key: 'open_positions', label: 'Open Positions', category: 'growth', type: 'object_array', editable: true, important: false },
  { key: 'recent_expansions', label: 'Recent Expansions', category: 'growth', type: 'object_array', editable: true, important: false },

  // Culture
  { key: 'tagline', label: 'Tagline', category: 'culture', type: 'text', editable: true, important: false },
  { key: 'company_values', label: 'Company Values', category: 'culture', type: 'array', editable: true, important: false },
  { key: 'mission_statement', label: 'Mission Statement', category: 'culture', type: 'text', editable: true, important: false },
  { key: 'differentiators', label: 'Differentiators', category: 'culture', type: 'array', editable: true, important: false },

  // Contact
  { key: 'main_phone', label: 'Main Phone', category: 'contact', type: 'text', editable: true, important: true },
  { key: 'main_email', label: 'Main Email', category: 'contact', type: 'text', editable: true, important: true },

  // Associations
  { key: 'association_memberships', label: 'Association Memberships', category: 'associations', type: 'object_array', editable: true, important: false },
];

export const CATEGORY_LABELS: Record<FieldCategory, string> = {
  identity: 'Identity',
  founding: 'Founding & History',
  ownership: 'Ownership',
  size: 'Size & Scale',
  headquarters: 'Headquarters',
  leadership: 'Leadership Team',
  services: 'Services',
  online_presence: 'Online Presence',
  reputation: 'Reputation',
  awards: 'Awards & Recognition',
  technology: 'Technology',
  mna: 'M&A Activity',
  growth: 'Growth Signals',
  culture: 'Content & Culture',
  contact: 'Contact',
  associations: 'Associations',
};

export const CATEGORY_ORDER: FieldCategory[] = [
  'identity',
  'ownership',
  'size',
  'founding',
  'headquarters',
  'leadership',
  'services',
  'online_presence',
  'reputation',
  'awards',
  'technology',
  'mna',
  'growth',
  'culture',
  'contact',
  'associations',
];
