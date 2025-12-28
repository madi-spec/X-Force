/**
 * Research Coordinator
 *
 * LLM-powered intelligence collection that acts like a skilled researcher.
 * Instead of relying on DOM selectors, this sends content to Claude for
 * intelligent extraction and interpretation.
 */

// ============================================
// CORE TYPES - SourcedField Pattern
// ============================================

/**
 * Every piece of data includes its source for transparency.
 * This allows us to show users where data came from and handle conflicts.
 */
export interface SourcedField<T> {
  value: T | null;
  source: string | null;
  sourceUrl: string | null;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
  conflicts?: Array<{
    value: T;
    source: string;
    sourceUrl: string;
  }>;
}

/**
 * Helper to create a SourcedField with defaults
 */
export function createSourcedField<T>(
  value: T | null,
  source: string | null = null,
  sourceUrl: string | null = null,
  confidence: 'high' | 'medium' | 'low' = 'medium'
): SourcedField<T> {
  return {
    value,
    source,
    sourceUrl,
    confidence,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Helper to create an empty SourcedField
 */
export function emptySourcedField<T>(): SourcedField<T> {
  return {
    value: null,
    source: null,
    sourceUrl: null,
    confidence: 'low',
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// OWNERSHIP & CLASSIFICATION TYPES
// ============================================

export type OwnershipType =
  | 'family'
  | 'pe_backed'
  | 'franchise'
  | 'public'
  | 'independent'
  | 'unknown';

export type CompanySize =
  | 'small'      // <50 employees
  | 'medium'     // 50-200 employees
  | 'large'      // 200-500 employees
  | 'enterprise'; // 500+ employees

export type GrowthStage =
  | 'startup'
  | 'growth'
  | 'mature'
  | 'consolidating';

// ============================================
// PERSON / LEADERSHIP TYPES
// ============================================

export interface ExecutivePerson {
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  isDecisionMaker: boolean;
  department: string | null;
}

export interface LeadershipTeam {
  owner: SourcedField<ExecutivePerson | null>;
  ceo: SourcedField<ExecutivePerson | null>;
  president: SourcedField<ExecutivePerson | null>;
  keyExecutives: SourcedField<ExecutivePerson[]>;
}

// ============================================
// COMPANY INTELLIGENCE - Master Type
// ============================================

export interface CompanyIntelligence {
  // === Identity ===
  companyName: SourcedField<string>;
  legalName: SourcedField<string>;
  domain: SourcedField<string>;

  // === Ownership & Classification ===
  ownershipType: SourcedField<OwnershipType>;
  ownerName: SourcedField<string>;
  ownershipEvidence: SourcedField<string[]>;
  parentCompany: SourcedField<string>;
  peBackerName: SourcedField<string>;
  acquisitionDate: SourcedField<string>;
  franchiseInfo: SourcedField<{
    franchisorName: string;
    franchiseCount: number | null;
    territory: string | null;
  }>;

  // === Size & Scale ===
  employeeCount: SourcedField<number>;
  employeeCountRange: SourcedField<string>;
  revenue: SourcedField<number>;
  revenueRange: SourcedField<string>;
  yearFounded: SourcedField<number>;
  companyAge: SourcedField<number>;

  // === Leadership ===
  leadership: LeadershipTeam;

  // === Services & Operations ===
  services: SourcedField<string[]>;
  serviceAreas: SourcedField<string[]>;
  locationCount: SourcedField<number>;
  headquartersCity: SourcedField<string>;
  headquartersState: SourcedField<string>;

  // === Online Presence ===
  websiteUrl: SourcedField<string>;
  linkedinUrl: SourcedField<string>;
  linkedinFollowers: SourcedField<number>;
  facebookUrl: SourcedField<string>;
  facebookFollowers: SourcedField<number>;
  googleRating: SourcedField<number>;
  googleReviewCount: SourcedField<number>;

  // === Technology ===
  technologies: SourcedField<TechnologyInfo[]>;
  crmSystem: SourcedField<string>;
  phoneSystem: SourcedField<string>;
  routingSoftware: SourcedField<string>;

  // === Recognition & Awards ===
  awards: SourcedField<AwardInfo[]>;
  isPctTop100: SourcedField<boolean>;
  pctTop100Year: SourcedField<number>;
  certifications: SourcedField<string[]>;

  // === Growth Signals ===
  isHiring: SourcedField<boolean>;
  openJobCount: SourcedField<number>;
  recentAcquisitions: SourcedField<string[]>;
  growthStage: SourcedField<GrowthStage>;

  // === Metadata ===
  collectedAt: string;
  collectionDuration: number;
  dataQualityScore: number;
  missingFields: string[];
}

// ============================================
// TECHNOLOGY TYPES
// ============================================

export interface TechnologyInfo {
  name: string;
  category: 'crm' | 'phone' | 'routing' | 'marketing' | 'other';
  confidence: 'high' | 'medium' | 'low';
  source: string;
  sourceUrl: string | null;
  evidence: string;
}

// ============================================
// AWARD TYPES
// ============================================

export interface AwardInfo {
  name: string;
  year: number | null;
  organization: string | null;
  source: string;
  sourceUrl: string | null;
}

// ============================================
// RESEARCH CONTEXT & PROMPTS
// ============================================

/**
 * Context passed to LLM for extraction
 */
export interface ResearchContext {
  companyName: string;
  domain: string;
  existingData: Partial<CompanyIntelligence>;
  currentPhase: ResearchPhase;
  pagesAnalyzed: string[];
  searchesPerformed: string[];
}

export type ResearchPhase =
  | 'website_analysis'
  | 'google_places'
  | 'apollo_enrichment'
  | 'strategic_search'
  | 'gap_filling'
  | 'final_assembly';

/**
 * Result from a single research step
 */
export interface ResearchStepResult {
  phase: ResearchPhase;
  fieldsUpdated: string[];
  newData: Partial<CompanyIntelligence>;
  confidence: 'high' | 'medium' | 'low';
  sourcesUsed: string[];
}

// ============================================
// LLM EXTRACTION PROMPTS
// ============================================

/**
 * System prompt for website content analysis
 */
export const WEBSITE_ANALYSIS_PROMPT = `You are a business researcher analyzing a company website to extract intelligence for a sales team.

Your task is to carefully read the provided website content and extract specific information.
Be precise and only include information you're confident about.
For each piece of information, note where you found it on the page.

LEADERSHIP EXTRACTION RULES (CRITICAL):
- ONLY extract C-level executives, owners, founders, presidents, VPs, and directors
- The OWNER or CEO is the MOST important person to find
- Do NOT include: HR staff, recruiters, administrative assistants, coordinators, specialists
- Look for titles like: CEO, President, Owner, Founder, COO, CFO, VP, Director of Operations
- If you see "Owner", "Founder", or "President" - this is the key decision maker

AWARD VALIDATION RULES:
- Only include REAL business awards or rankings (e.g., "PCT Top 100", "Inc 5000", "Best Places to Work")
- Must have the company RECEIVING the award
- Do NOT include: social media comments, generic phrases like "best of luck", product reviews
- Include the year if mentioned

Return a JSON object with the following structure. Use null for any fields you cannot find:

{
  "companyName": "Official company name",
  "ownershipType": "family|pe_backed|franchise|public|independent|unknown",
  "ownershipEvidence": ["List of phrases/sentences that indicate ownership type"],
  "ownerName": "Name of owner/founder if mentioned",
  "yearFounded": 1990,
  "services": ["List of specific services offered"],
  "serviceAreas": ["List of cities/regions served"],
  "locationCount": 5,
  "headquartersCity": "City name",
  "headquartersState": "State abbreviation",
  "awards": [{"name": "Award name", "year": 2024, "organization": "Who gave it"}],
  "certifications": ["List of certifications"],
  "employeeCount": 150,
  "leadership": {
    "owner": {"name": "...", "title": "..."},
    "ceo": {"name": "...", "title": "..."},
    "executives": [{"name": "...", "title": "...", "department": "..."}]
  },
  "technologies": [{"name": "Technology name", "evidence": "How you found it"}],
  "extractionNotes": ["Any observations about the company"]
}`;

/**
 * System prompt for search result interpretation
 */
export const SEARCH_INTERPRETATION_PROMPT = `You are a business researcher analyzing search results about a company.

Given the search query and results, extract relevant business intelligence.
Focus on factual information from credible sources.
Note the source URL for each piece of information.

OWNERSHIP TYPE DETERMINATION:
- "family-owned", "family business", "founded by", "third generation", generational references → family
- "acquired by", "portfolio company", "backed by", PE firm names → pe_backed
- "franchise", "franchisee", "franchisor" → franchise
- Public company indicators, stock symbols → public
- No indicators → independent or unknown

LEADERSHIP EXTRACTION (CRITICAL):
- ONLY extract: CEO, President, Owner, Founder, COO, CFO, VP-level executives
- Do NOT include: HR staff, recruiters, marketing coordinators, specialists
- The OWNER or CEO is the most important person to identify
- Include their full name and exact title

AWARD VALIDATION:
- Only include REAL business awards: PCT Top 100, Inc 5000, Best Places to Work, Torch Award
- Do NOT include: social media posts, generic phrases, product reviews
- Include year and ranking if mentioned

Return a JSON object with:
{
  "ownership_type": "family|pe_backed|franchise|public|independent",
  "owner_name": "Name of owner/CEO if found",
  "leadership": {"ceo": "Name", "owner": "Name"},
  "recognition": ["Real awards only"],
  "sources": ["URLs where info was found"]
}`;

/**
 * System prompt for gap analysis
 */
export const GAP_ANALYSIS_PROMPT = `You are reviewing collected intelligence about a company and identifying what's missing.

Current data:
{currentData}

Identify the most important missing fields and suggest specific search queries to find them.

Return:
{
  "missingFields": ["field1", "field2"],
  "prioritizedFields": ["Most important to find first"],
  "suggestedSearches": [
    {"field": "ownerName", "query": '"CompanyName" owner founder CEO'},
    {"field": "revenue", "query": '"CompanyName" revenue annual sales millions'}
  ]
}`;

// ============================================
// SEARCH QUERY TEMPLATES
// ============================================

/**
 * Strategic search queries for different data types
 */
export const SEARCH_TEMPLATES = {
  ownership: [
    '"{company}" "family-owned" OR "family business" OR "third generation"',
    '"{company}" acquired OR acquisition OR "portfolio company" OR "private equity"',
    '"{company}" founder owner CEO president',
  ],
  technology: [
    '"{company}" ServiceTitan OR FieldRoutes OR PestRoutes case study',
    '"{company}" CRM software system',
    '"{company}" routing scheduling software',
  ],
  revenue: [
    '"{company}" revenue annual sales',
    '"{company}" PCT Top 100 ranking',
    '"{company}" Inc 5000 fastest growing',
  ],
  awards: [
    // Specific industry award searches - not generic "best of"
    '"{company}" "PCT Top 100" site:pctonline.com',
    '"{company}" "Inc 5000" OR "Inc. 5000" site:inc.com',
    '"{company}" "Best Places to Work" OR "Torch Award" BBB',
  ],
  leadership: [
    '"{company}" CEO president owner founder',
    '"{company}" "founded by" OR "owned by" OR "led by"',
    'site:linkedin.com/in "{company}" CEO OR owner OR president',
  ],
  acquisitions: [
    '"{company}" acquisition acquires purchased',
    '"{company}" expansion new location opens',
    '"{company}" merger consolidation',
  ],
};

// Domains to skip when searching for awards (social media, reviews)
export const SKIP_DOMAINS_FOR_AWARDS = [
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'mapquest.com',
  'yelp.com',
  'reddit.com',
  'pinterest.com',
  'tiktok.com',
];

// Credible sources for awards
export const CREDIBLE_AWARD_SOURCES = [
  'pctonline.com',      // PCT Magazine
  'inc.com',            // Inc 5000
  'bizjournals.com',    // Business journals
  'bbb.org',            // BBB Torch Award
  'glassdoor.com',      // Best places to work
  'pestcontrolmag.com', // Industry publication
  'npmaonline.org',     // NPMA
  'pestworld.org',      // PestWorld
];

// ============================================
// DATA QUALITY HELPERS
// ============================================

/**
 * Calculate overall data quality score
 */
export function calculateDataQualityScore(intel: CompanyIntelligence): number {
  const weights: Record<string, number> = {
    companyName: 5,
    ownershipType: 10,
    ownerName: 8,
    employeeCount: 6,
    revenue: 8,
    services: 7,
    serviceAreas: 5,
    leadership: 10,
    technologies: 6,
    awards: 4,
    googleRating: 5,
    linkedinFollowers: 3,
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const [field, weight] of Object.entries(weights)) {
    totalWeight += weight;
    const value = (intel as unknown as Record<string, unknown>)[field] as SourcedField<unknown> | undefined;
    if (value?.value !== null && value?.value !== undefined) {
      // Adjust score based on confidence
      const confidenceMultiplier =
        value.confidence === 'high' ? 1 :
        value.confidence === 'medium' ? 0.7 : 0.4;
      earnedWeight += weight * confidenceMultiplier;
    }
  }

  return Math.round((earnedWeight / totalWeight) * 100);
}

/**
 * Get list of missing critical fields
 */
export function getMissingFields(intel: CompanyIntelligence): string[] {
  const criticalFields = [
    'ownershipType',
    'ownerName',
    'employeeCount',
    'revenue',
    'services',
    'leadership',
  ];

  return criticalFields.filter(field => {
    const value = (intel as unknown as Record<string, unknown>)[field] as SourcedField<unknown> | undefined;
    return !value?.value;
  });
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create a new empty CompanyIntelligence object
 */
export function createEmptyIntelligence(companyName: string, domain: string): CompanyIntelligence {
  const now = new Date().toISOString();

  return {
    // Identity
    companyName: createSourcedField(companyName, 'user_input', null, 'high'),
    legalName: emptySourcedField(),
    domain: createSourcedField(domain, 'user_input', null, 'high'),

    // Ownership
    ownershipType: emptySourcedField(),
    ownerName: emptySourcedField(),
    ownershipEvidence: emptySourcedField(),
    parentCompany: emptySourcedField(),
    peBackerName: emptySourcedField(),
    acquisitionDate: emptySourcedField(),
    franchiseInfo: emptySourcedField(),

    // Size
    employeeCount: emptySourcedField(),
    employeeCountRange: emptySourcedField(),
    revenue: emptySourcedField(),
    revenueRange: emptySourcedField(),
    yearFounded: emptySourcedField(),
    companyAge: emptySourcedField(),

    // Leadership
    leadership: {
      owner: emptySourcedField(),
      ceo: emptySourcedField(),
      president: emptySourcedField(),
      keyExecutives: createSourcedField([], null, null, 'low'),
    },

    // Services
    services: emptySourcedField(),
    serviceAreas: emptySourcedField(),
    locationCount: emptySourcedField(),
    headquartersCity: emptySourcedField(),
    headquartersState: emptySourcedField(),

    // Online
    websiteUrl: createSourcedField(`https://${domain}`, 'derived', null, 'high'),
    linkedinUrl: emptySourcedField(),
    linkedinFollowers: emptySourcedField(),
    facebookUrl: emptySourcedField(),
    facebookFollowers: emptySourcedField(),
    googleRating: emptySourcedField(),
    googleReviewCount: emptySourcedField(),

    // Technology
    technologies: createSourcedField([], null, null, 'low'),
    crmSystem: emptySourcedField(),
    phoneSystem: emptySourcedField(),
    routingSoftware: emptySourcedField(),

    // Recognition
    awards: createSourcedField([], null, null, 'low'),
    isPctTop100: emptySourcedField(),
    pctTop100Year: emptySourcedField(),
    certifications: emptySourcedField(),

    // Growth
    isHiring: emptySourcedField(),
    openJobCount: emptySourcedField(),
    recentAcquisitions: emptySourcedField(),
    growthStage: emptySourcedField(),

    // Metadata
    collectedAt: now,
    collectionDuration: 0,
    dataQualityScore: 0,
    missingFields: [],
  };
}
