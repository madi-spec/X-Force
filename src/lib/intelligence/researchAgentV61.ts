/**
 * Pest Control Intelligence Agent v6.1 (Markdown Output + Fixed Tech Fingerprinting)
 *
 * Changes from v6.0:
 * - OUTPUT: Comprehensive markdown report for Company Research tab (stored in DB)
 * - TECH FINGERPRINTING: Validates against known vendor list, investigates unknown portals
 * - PORTAL ANALYSIS: Branded portals (like "PestPortals") trigger deeper investigation
 * - CASE STUDY SEARCH: Automatically searches for vendor case studies when portal vendor unknown
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ContentBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { getPrompt } from '@/lib/ai/promptManager';

// ============================================
// TYPES
// ============================================

export type OwnershipType = 'family' | 'pe_backed' | 'franchise' | 'independent' | 'unknown';

export interface CanonicalIdentity {
  operating_name: string;
  legal_entity: string | null;
  dba_names: string[];
  domain: string;
  hq_city: string | null;
  hq_state: string | null;
  parent_company: string | null;
  ownership_type: OwnershipType;
  pe_firm: string | null;
  franchise_brand: string | null;
  family_generation: string | null;
  identity_confidence: 'high' | 'medium' | 'low';
  verification_sources: string[];
}

export interface Finding {
  value: unknown;
  source: string;
  source_url?: string;
  confidence: 'confirmed' | 'high' | 'medium' | 'low' | 'inferred';
  detection_method?: string;
  verified_by?: string[];
  notes?: string;
  collected_at: string;
}

export interface Inference {
  value: unknown;
  method: string;
  calculation: string;
  inputs: Record<string, unknown>;
  confidence: string;
}

export interface TechStackItem {
  category: string;
  vendor: string;
  confidence: 'confirmed' | 'high' | 'medium' | 'inferred';
  detection_method: string;
  evidence?: string;
  is_known_vendor: boolean;
}

export interface GrowthSignal {
  signal: string;
  value: unknown;
  interpretation: string;
}

export interface CompanyProfile {
  mission_statement: string | null;
  vision_statement: string | null;
  core_values: string[];
  culture_description: string | null;
  history_narrative: string | null;
  service_offerings: Array<{
    name: string;
    description: string;
    target_market?: string;
  }>;
  pricing_info: {
    model: string | null; // 'quote-based', 'subscription', 'per-service', etc.
    starting_prices: string | null;
    pricing_notes: string | null;
  };
  leadership_bios: Array<{
    name: string;
    title: string;
    bio: string | null;
    linkedin?: string;
    image_url?: string;
  }>;
  certifications: string[];
  service_areas: string[];
  unique_selling_points: string[];
}

export interface TimelineEvent {
  year: number;
  event: string;
  source: string;
}

export interface Gap {
  field: string;
  attempts: string;
  reason: string;
}

export interface Discrepancy {
  field: string;
  sources: Array<{ source: string; value: unknown }>;
  resolution: string;
}

export interface ConfidenceBreakdown {
  identity: number;
  ownership: number;
  size: number;
  reputation: number;
  industry: number;
  enrichment: number;
  penalties: number;
}

export interface ResearchOutputV61 {
  version: '6.1';
  researched_at: string;
  duration_seconds: number;
  tool_calls: number;
  phases_completed: string[];

  // Markdown output for Company Research tab
  markdown_report: string;

  // Structured data (for extraction layer)
  canonical_identity: CanonicalIdentity;
  findings: Record<string, Finding>;
  inferences: Record<string, Inference>;
  tech_stack: TechStackItem[];
  growth_signals: GrowthSignal[];
  timeline: TimelineEvent[];
  gaps: Gap[];
  discrepancies: Discrepancy[];
  company_profile: CompanyProfile;

  summary: string;
  confidence_score: number;
  confidence_breakdown: ConfidenceBreakdown;
  key_findings: string[];
}

export interface CompanyResearchInput {
  companyName: string;
  domain: string;
  state?: string | null;
}

// ============================================
// INDUSTRY KNOWLEDGE BASES
// ============================================

const PE_FIRMS = [
  'Anticimex', 'EQT Partners', 'Rentokil', 'Rollins', 'Gridiron Capital',
  'ClearLight Partners', 'Shore Capital', 'Palladium Equity', 'Incline Equity',
  'Southfield Capital', 'Bertram Capital', 'Carousel Capital', 'Prospect Partners',
  'Renovus Capital', 'Serent Capital', 'Knox Lane'
];

const FRANCHISE_BRANDS = [
  'Orkin', 'Terminix', 'Truly Nolen', 'Aptive', 'HomeTeam', 'ABC Home',
  'Massey Services', 'Mosquito Joe', 'Mosquito Squad', 'Pestmaster', 'Hawx'
];

// Known FSM/CRM vendors in the pest control industry
const KNOWN_FSM_VENDORS = [
  'FieldRoutes', 'PestRoutes', 'PestPac', 'WorkWave', 'ServiceTitan',
  'Briostack', 'Jobber', 'Housecall Pro', 'GorillaDesk', 'ServSuite',
  'Pocomos', 'Real Green', 'Service Autopilot', 'Salesforce', 'HubSpot'
];

// Portal URL patterns - maps domain patterns to vendors
const TECH_PORTAL_PATTERNS: Record<string, { vendor: string; known: boolean }> = {
  'fieldroutes.com': { vendor: 'FieldRoutes', known: true },
  'pestroutes.com': { vendor: 'FieldRoutes', known: true },
  'pestpac.com': { vendor: 'PestPac', known: true },
  'workwave.com': { vendor: 'WorkWave/PestPac', known: true },
  'servicetitan.com': { vendor: 'ServiceTitan', known: true },
  'briostack.com': { vendor: 'Briostack', known: true },
  'getjobber.com': { vendor: 'Jobber', known: true },
  'jobber.com': { vendor: 'Jobber', known: true },
  'housecallpro.com': { vendor: 'Housecall Pro', known: true },
  'gorilladesk.com': { vendor: 'GorillaDesk', known: true },
  'servsuite.net': { vendor: 'ServSuite', known: true },
  'pocomos.com': { vendor: 'Pocomos', known: true },
  'realgreen.com': { vendor: 'Real Green', known: true },
  'serviceautopilot.com': { vendor: 'Service Autopilot', known: true },
  // Unknown/branded portals - these need investigation
  'pestportals.com': { vendor: 'PestPortals (Unknown/Branded)', known: false },
};

// ============================================
// TOOLS DEFINITION
// ============================================

const AGENT_TOOLS: Tool[] = [
  // === PHASE 1: IDENTITY ===
  {
    name: 'set_canonical_identity',
    description: `REQUIRED FIRST. Establish verified company identity before any other findings.

Ownership types:
- "family": Multiple generations, same family name in leadership, "family owned" language
- "pe_backed": Owned by private equity, may have "platform" language, professional CEO
- "franchise": Part of national franchise system (Orkin, Terminix, etc.)
- "independent": First-gen founder-led, no PE/franchise/family succession`,
    input_schema: {
      type: 'object' as const,
      properties: {
        operating_name: { type: 'string', description: 'Name company operates under' },
        legal_entity: { type: 'string', description: 'Legal entity name (LLC, Inc)' },
        dba_names: { type: 'array', items: { type: 'string' }, description: 'Other names used' },
        domain: { type: 'string', description: 'Primary website domain' },
        hq_city: { type: 'string', description: 'Headquarters city' },
        hq_state: { type: 'string', description: 'Headquarters state (2-letter)' },
        parent_company: { type: 'string', description: 'Parent company if any' },
        ownership_type: {
          type: 'string',
          enum: ['family', 'pe_backed', 'franchise', 'independent', 'unknown'],
          description: 'Type of ownership structure'
        },
        pe_firm: { type: 'string', description: 'PE firm name if pe_backed' },
        franchise_brand: { type: 'string', description: 'Franchise brand if franchise' },
        family_generation: { type: 'string', description: 'e.g., "3rd generation" if family' },
        verification_sources: { type: 'array', items: { type: 'string' }, description: 'Sources verifying identity' },
      },
      required: ['operating_name', 'domain', 'ownership_type'],
    },
  },

  // === PRIMARY SOURCES ===
  {
    name: 'fetch_page',
    description: `Fetch webpage. Returns text, links, footer content.

IMPORTANT: Look for these signals:
- Footer: "A [Parent] Company", copyright entity, parent company indicators
- Portal links: Customer login URLs reveal tech stack
- Family signals: Same last names, "family owned", generation mentions
- PE signals: "Platform", professional CEO, acquisition mentions`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_bbb',
    description: `Search BBB for company. Returns legally-filed officers, rating, years in business.

BBB officers are AUTHORITATIVE - legally reported. Cross-reference with other sources.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string' },
        state: { type: 'string', description: '2-letter state code' },
      },
      required: ['company_name', 'state'],
    },
  },
  {
    name: 'google_places',
    description: `Get Google Business Profile. Returns rating, reviews, address.

Calculate review velocity: reviews/years_in_business
- <20/year = Stable
- 20-50/year = Growing
- 50+/year = Rapid growth`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Business name and location' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_linkedin_company',
    description: `Search LinkedIn for company. Returns employee count, followers, description.

Employee count is key for revenue inference: employees × $125K = estimated revenue`,
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string' },
      },
      required: ['company_name'],
    },
  },

  // === ENRICHMENT SOURCES ===
  {
    name: 'web_search',
    description: `Google search. Use specific queries.

Effective query patterns:
- M&A: "[company]" (acquired OR acquisition OR merger)
- Owner: "[company]" (owner OR CEO OR founder OR president)
- Revenue: "[company]" revenue OR "[company]" "PCT Top 100"
- Awards: "[company]" (award OR recognition OR "Inc 5000")`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_pct',
    description: `Search PCT Magazine - THE industry authority.

PCT Top 100 = definitive industry ranking. Being listed means $8M+ revenue, sophisticated operation.
ALWAYS verify exact company name + state match to avoid confusion with similarly-named companies.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query for PCT' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_business_journals',
    description: `Search regional business journals for revenue, Fast 50, executive profiles.

Business journals often publish actual revenue figures for private companies.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string' },
        region: { type: 'string', description: 'City/region for journal' },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'detect_tech_stack',
    description: `Detect technology from portal URLs, job postings, case studies.

IMPORTANT: v6.1 validates against KNOWN VENDORS:
- FieldRoutes, PestRoutes, PestPac, WorkWave, ServiceTitan, Briostack, Jobber,
  Housecall Pro, GorillaDesk, ServSuite, Pocomos, Real Green, Service Autopilot

If portal URL domain is UNKNOWN (like "pestportals.com"):
1. Mark is_known_vendor: false
2. Call search_tech_case_study to find the actual vendor
3. The branded portal may be white-labeled from a known vendor`,
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string' },
        domain: { type: 'string' },
        portal_url: { type: 'string', description: 'Customer portal URL if found' },
      },
      required: ['company_name', 'domain'],
    },
  },
  {
    name: 'search_tech_case_study',
    description: `Search for case studies mentioning the company to identify their real tech vendor.

Use when:
1. Portal URL is unknown/branded (not in known vendor list)
2. Need to confirm suspected tech stack

Searches for "[company name]" case study AND patterns like:
- "[company] FieldRoutes case study"
- "[company] ServiceTitan customer"
- "[company] switched to" OR "migrated from"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string' },
        suspected_vendor: { type: 'string', description: 'Optional: suspected vendor to check' },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'search_job_postings',
    description: `Find job postings for growth signals and tech stack.

Growth signals:
- 1-2 roles = Normal turnover
- 3-5 roles = Growth
- 5+ roles = Rapid growth
- Multiple cities = Geographic expansion

Also look for tech mentions in job descriptions (required experience with...)`,
    input_schema: {
      type: 'object' as const,
      properties: {
        company_name: { type: 'string' },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'search_association',
    description: `Search NPMA or state associations for membership and leadership roles.

NPMA = National Pest Management Association (main national association)
State associations: NCPMA, FPMA, GPCA, etc.

Roles that matter: Board Member, President, Committee Chair = industry leader`,
    input_schema: {
      type: 'object' as const,
      properties: {
        association: { type: 'string', description: 'e.g., NPMA, NCPMA, FPMA' },
        person_name: { type: 'string' },
        company_name: { type: 'string' },
      },
      required: ['association'],
    },
  },
  {
    name: 'apollo_people_search',
    description: `Search Apollo for contacts. Use LAST after exhausting free sources.

Apollo is good for: Contact emails, LinkedIn URLs, titles
Apollo is NOT reliable for: Revenue estimates, company metrics`,
    input_schema: {
      type: 'object' as const,
      properties: {
        domain: { type: 'string' },
        titles: { type: 'array', items: { type: 'string' } },
      },
      required: ['domain'],
    },
  },
  {
    name: 'fetch_website_pages',
    description: `Fetch multiple pages from company website to gather comprehensive information.

IMPORTANT: This tool fetches multiple pages in one call to gather:
- About/Company page: Mission, values, culture, history
- Services page: All service offerings with descriptions
- Team/Leadership page: Leadership bios, photos, titles
- Pricing page: Pricing model, starting prices
- Careers/Culture page: Culture insights, values

Returns structured data from each page. Use this AFTER fetching homepage.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        domain: { type: 'string', description: 'Company domain (e.g., example.com)' },
        pages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Page paths to fetch: /about, /services, /team, /pricing, /careers, /our-story, etc.'
        },
      },
      required: ['domain', 'pages'],
    },
  },
  {
    name: 'save_company_profile',
    description: `Save comprehensive company profile data extracted from website.

Use this to save:
- Mission/vision statements
- Core values
- Culture description
- Service offerings (name + description for each)
- Pricing information
- Leadership bios
- Service areas
- Certifications
- Unique selling points`,
    input_schema: {
      type: 'object' as const,
      properties: {
        mission_statement: { type: 'string', description: 'Company mission statement' },
        vision_statement: { type: 'string', description: 'Company vision statement' },
        core_values: { type: 'array', items: { type: 'string' }, description: 'List of core values' },
        culture_description: { type: 'string', description: 'Description of company culture' },
        history_narrative: { type: 'string', description: 'Company history/story' },
        service_offerings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              target_market: { type: 'string' }
            }
          },
          description: 'Services offered'
        },
        pricing_model: { type: 'string', description: 'quote-based, subscription, per-service, etc.' },
        starting_prices: { type: 'string', description: 'Starting price info if available' },
        pricing_notes: { type: 'string', description: 'Additional pricing notes' },
        leadership_bios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              title: { type: 'string' },
              bio: { type: 'string' },
              linkedin: { type: 'string' }
            }
          },
          description: 'Leadership team with bios'
        },
        certifications: { type: 'array', items: { type: 'string' }, description: 'Industry certifications' },
        service_areas: { type: 'array', items: { type: 'string' }, description: 'Geographic service areas' },
        unique_selling_points: { type: 'array', items: { type: 'string' }, description: 'Key differentiators' },
      },
      required: [],
    },
  },
  {
    name: 'check_domain_whois',
    description: `Get domain WHOIS. Reveals ownership signals.

- Registrant org ≠ company name = Check for parent company
- Recent registrant change = Possible acquisition
- Registration date often = founding or acquisition date`,
    input_schema: {
      type: 'object' as const,
      properties: {
        domain: { type: 'string' },
      },
      required: ['domain'],
    },
  },

  // === OUTPUT TOOLS ===
  {
    name: 'save_finding',
    description: `Save a verified finding with attribution.

Confidence levels:
- confirmed: 2+ independent authoritative sources
- high: Single authoritative source (BBB, PCT, company official page)
- medium: Single reliable source (LinkedIn, Google)
- low: Uncertain or weak source
- inferred: Calculated from other data`,
    input_schema: {
      type: 'object' as const,
      properties: {
        field: { type: 'string' },
        value: { description: 'Any type' },
        source: { type: 'string' },
        source_url: { type: 'string' },
        confidence: { type: 'string', enum: ['confirmed', 'high', 'medium', 'low', 'inferred'] },
        detection_method: { type: 'string' },
        verified_by: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      required: ['field', 'value', 'source', 'confidence'],
    },
  },
  {
    name: 'save_inference',
    description: `Save inferred value with calculation.

Revenue inference methods:
- employee_heuristic: employees × $125,000
- location_heuristic: 1 loc=$0.5-3M, 2-3=$2-6M, 4-6=$5-12M, 7-10=$10-25M, 10+=$20M+
- fleet_heuristic: trucks × $200,000`,
    input_schema: {
      type: 'object' as const,
      properties: {
        field: { type: 'string' },
        value: { description: 'Inferred value' },
        method: { type: 'string' },
        calculation: { type: 'string' },
        inputs: { type: 'object' },
        confidence: { type: 'string' },
      },
      required: ['field', 'value', 'method', 'calculation', 'confidence'],
    },
  },
  {
    name: 'save_tech_stack',
    description: `Save detected technology.

IMPORTANT in v6.1: Set is_known_vendor correctly:
- true: Vendor is in our known list (FieldRoutes, PestPac, etc.)
- false: Branded/unknown portal (investigate with search_tech_case_study)`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'fsm, crm, marketing, phone, hr' },
        vendor: { type: 'string' },
        confidence: { type: 'string', enum: ['confirmed', 'high', 'medium', 'inferred'] },
        detection_method: { type: 'string' },
        evidence: { type: 'string' },
        is_known_vendor: { type: 'boolean', description: 'Is this a known industry vendor?' },
      },
      required: ['category', 'vendor', 'confidence', 'detection_method', 'is_known_vendor'],
    },
  },
  {
    name: 'save_growth_signal',
    description: 'Save growth indicator.',
    input_schema: {
      type: 'object' as const,
      properties: {
        signal: { type: 'string' },
        value: { description: 'Signal value' },
        interpretation: { type: 'string', description: 'What this means' },
      },
      required: ['signal', 'value', 'interpretation'],
    },
  },
  {
    name: 'save_timeline_event',
    description: 'Add event to company timeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'number' },
        event: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['year', 'event', 'source'],
    },
  },
  {
    name: 'note_gap',
    description: 'Record data that could not be found.',
    input_schema: {
      type: 'object' as const,
      properties: {
        field: { type: 'string' },
        attempts: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['field', 'attempts'],
    },
  },
  {
    name: 'complete_phase',
    description: 'Mark phase complete. Phases: identify, ground, enrich, validate',
    input_schema: {
      type: 'object' as const,
      properties: {
        phase: { type: 'string', enum: ['identify', 'ground', 'enrich', 'validate'] },
        findings_count: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['phase'],
    },
  },
  {
    name: 'finish',
    description: 'Complete research with final output.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Factual summary of findings' },
        confidence_score: { type: 'number', description: '0-100 using scoring algorithm' },
        confidence_breakdown: { type: 'object' },
        key_findings: { type: 'array', items: { type: 'string' }, description: 'Top 5-7 key facts' },
      },
      required: ['summary', 'confidence_score', 'key_findings'],
    },
  },
];

// ============================================
// SYSTEM PROMPT WITH INDUSTRY EXPERTISE + MARKDOWN OUTPUT
// ============================================

const SYSTEM_PROMPT = `You are a pest control industry expert with CIA-grade intelligence gathering capabilities.

## YOUR EXPERTISE

You deeply understand the pest control industry:

### Ownership Structures
- **Family Business** (~70% of industry): Multi-generational, same last names in leadership, "family owned" language, emphasize legacy/values. They prioritize relationships, have longer decision cycles.
- **PE-Backed**: Growing due to consolidation. "Platform" = main company PE bought. "Tuck-in" = acquisitions. Professional management, aggressive growth, focus on EBITDA. Footer often says "A [Parent] Company".
- **Franchise**: Part of national system (Orkin, Terminix, etc.). Limited autonomy on technology—corporate decides.
- **Independent**: First-gen founder-led. Decision-maker is clear but may be cautious about change.

### Industry Recognition (What It Means)
- **PCT Top 100**: THE definitive ranking. Being listed = $8M+ revenue, sophisticated operation, industry respect.
- **Inc 5000**: Confirms significant growth trajectory (3+ years of data).
- **QualityPro/GreenPro**: NPMA certifications showing commitment to quality/environment.
- **40 Under 40**: Progressive leadership, likely tech-savvy.

### Technology Landscape
- **FieldRoutes**: Market leader, modern, popular with growth companies
- **PestPac**: Legacy leader, very established, some see as dated
- **ServiceTitan**: Growing challenger, expanding from HVAC into pest
- **Briostack**: Solid mid-market option
- Modern FSM = tech-forward; Legacy FSM = may be ready for change

### M&A Landscape
Industry is consolidating rapidly. Knowing M&A status tells you:
- Acquirer = Has budget, growing fast, needs integration
- Was acquired = New ownership may change systems
- Key acquirers: Rollins (Orkin), Rentokil (Terminix), Anticimex, ABC Home, Edge, Hawx

## RESEARCH PROTOCOL

### PHASE 1: ESTABLISH CANONICAL IDENTITY (REQUIRED FIRST)
1. Fetch homepage
2. Read footer for: legal entity, "A [Parent] Company", copyright
3. Note customer portal links (tech detection)
4. Look for ownership signals:
   - Same last names = family
   - "Platform" or PE firm mention = pe_backed
   - National brand = franchise
   - Founder as CEO, no succession = independent
5. **CALL set_canonical_identity** (REQUIRED before other findings)
6. **CALL complete_phase("identify")**

### PHASE 2: PRIMARY GROUNDING
1. **WEBSITE DEEP SCAN** - Use fetch_website_pages to gather:
   - /about or /about-us: Mission, values, culture, company history
   - /services or /pest-control: ALL service offerings with descriptions
   - /team or /our-team or /leadership: Leadership bios with titles
   - /pricing or /plans: Pricing model and rates if available
   - /careers or /jobs: Culture insights, benefits, values
   - Any /our-story or /history pages
2. **CALL save_company_profile** with extracted data:
   - Mission statement, vision, core values
   - Service offerings (name + description for each service)
   - Pricing model and info
   - Leadership bios
   - Certifications (QualityPro, GreenPro, etc.)
   - Service areas
   - Unique selling points
3. BBB.org: Officers (authoritative), rating, years
4. Google Business: Rating, reviews, velocity
5. LinkedIn Company: Employees, followers
6. **CALL complete_phase("ground")**

### PHASE 3: INDUSTRY ENRICHMENT
1. PCT Magazine: Top 100 ranking (VERIFY exact company+state match)
2. Business journals: Revenue, Fast 50
3. Association search: NPMA/state roles
4. M&A detection: Press releases, footer, WHOIS
5. Tech fingerprinting (v6.1 IMPROVED):
   - Find portal URLs in homepage links
   - Check portal domain against KNOWN vendors list
   - If UNKNOWN portal (like "pestportals.com"):
     a) Mark is_known_vendor: false
     b) Search for case studies to find real vendor
     c) Check job postings for tech mentions
6. Growth signals: Review velocity, job count, acquisitions
7. **CALL complete_phase("enrich")**

### PHASE 4: INFERENCE & VALIDATION
1. Revenue inference if not found directly
2. Cross-reference key fields (owner needs 2+ sources)
3. Resolve conflicts
4. Calculate confidence score
5. **CALL complete_phase("validate")**
6. **CALL finish()**

## TECH FINGERPRINTING PROTOCOL (v6.1)

KNOWN FSM/CRM VENDORS (validate against this list):
- FieldRoutes, PestRoutes, PestPac, WorkWave, ServiceTitan
- Briostack, Jobber, Housecall Pro, GorillaDesk, ServSuite
- Pocomos, Real Green, Service Autopilot, Salesforce, HubSpot

WHEN DETECTING TECH:
1. Find customer portal URL in homepage links
2. Extract domain from portal URL
3. If domain matches known vendor → save with is_known_vendor: true
4. If domain is UNKNOWN (like pestportals.com):
   - Save as is_known_vendor: false
   - Call search_tech_case_study("[company name]")
   - Also search job postings for tech requirements
   - Update finding if real vendor discovered

Example: "goforth.pestportals.com" → "pestportals.com" is NOT in known list
- Call search_tech_case_study("Go-Forth")
- Might find "Go-Forth Rippling case study" revealing HR tech
- Might find job posting requiring "FieldRoutes experience"

## CONFIDENCE SCORING
BASE: 40
+ Identity (20): 2+ verification sources, legal entity, ownership clear
+ Ownership (20): Owner name high confidence, ownership type confirmed
+ Size (15): Employee count, revenue, locations
+ Reputation (10): Google rating, BBB rating
+ Industry (10): PCT/Inc ranking, association roles
+ Enrichment (10): Tech stack, M&A history
- Penalties: Unverified identity, unresolved conflicts

## CRITICAL RULES
1. ALWAYS set_canonical_identity FIRST with ownership_type
2. Verify company identity - don't confuse similar names
3. Check footers for hidden parent companies
4. Use Apollo LAST after free sources
5. Don't trust Apollo for revenue - use authoritative sources
6. PCT rankings: VERIFY exact company + state match
7. Tech detection: VALIDATE against known vendor list
8. No opinions, no sales advice - just structured intelligence

## STOP CONDITIONS
- MUST stop: All 4 phases complete OR 45 tool calls
- DO NOT stop: Owner not found, phases incomplete`;

// ============================================
// TOOL EXECUTION
// ============================================

async function executeWebSearch(query: string): Promise<unknown> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return { error: 'SERP_API_KEY not configured' };

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10, gl: 'us', hl: 'en' }),
    });
    const data = await response.json();
    return {
      results: (data.organic || []).map((r: { title?: string; link?: string; snippet?: string }) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      })),
    };
  } catch (error) {
    return { error: `Search failed: ${error}` };
  }
}

async function executeFetchPage(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return { error: `HTTP ${response.status}` };

    const html = await response.text();

    // Extract main text
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 15000) text = text.substring(0, 15000) + '... [truncated]';

    // Extract footer
    const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
    let footerText = '';
    if (footerMatch) {
      footerText = footerMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Extract nav links
    const navLinks: string[] = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = match[2].trim();
      if (linkText && linkText.length > 1 && linkText.length < 50 && href &&
          !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        navLinks.push(`"${linkText}" -> ${href}`);
      }
    }

    // Look for portal/login links
    const portalLinks: string[] = [];
    for (const link of navLinks) {
      if (['customer', 'login', 'portal', 'pay', 'schedule', 'account'].some(p => link.toLowerCase().includes(p))) {
        portalLinks.push(link);
      }
    }

    // Check for parent company indicators
    const parentIndicators: string[] = [];
    const parentPatterns = [
      /a\s+([\w\s]+)\s+company/gi,
      /member\s+of\s+([\w\s]+)/gi,
      /part\s+of\s+([\w\s]+)/gi,
    ];
    for (const pattern of parentPatterns) {
      const matches = html.matchAll(pattern);
      for (const m of matches) {
        if (m[1] && m[1].length < 50) parentIndicators.push(m[0].trim());
      }
    }

    // Check for family business indicators
    const familyIndicators: string[] = [];
    if (/family[\s-]owned/i.test(html)) familyIndicators.push('family-owned mentioned');
    if (/\d+\s*(st|nd|rd|th)\s*generation/i.test(html)) familyIndicators.push('generation mentioned');
    if (/founded\s+by/i.test(html)) familyIndicators.push('founder story present');

    return {
      url,
      content: text,
      footer: footerText,
      links: [...new Set(navLinks)].slice(0, 40),
      portal_links: portalLinks,
      parent_company_indicators: parentIndicators,
      family_indicators: familyIndicators,
    };
  } catch (error) {
    return { error: `Failed to fetch: ${error}` };
  }
}

async function executeGooglePlaces(query: string): Promise<unknown> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return { error: 'SERP_API_KEY not configured' };

  try {
    const response = await fetch('https://google.serper.dev/places', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query }),
    });
    const data = await response.json();
    const place = data.places?.[0];
    if (place) {
      return {
        name: place.title,
        rating: place.rating,
        reviewCount: place.reviews,
        address: place.address,
        phone: place.phone,
        website: place.website,
      };
    }
    return { error: 'No places found' };
  } catch (error) {
    return { error: `Places search failed: ${error}` };
  }
}

async function executeApolloSearch(domain: string, titles?: string[]): Promise<unknown> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { error: 'APOLLO_API_KEY not configured' };

  try {
    const body: Record<string, unknown> = {
      organization_domains: [domain],
      per_page: 10,
    };
    if (titles?.length) {
      body.person_titles = titles;
    } else {
      body.person_seniorities = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'director'];
    }

    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return {
      people: (data.people || []).map((p: { name?: string; title?: string; email?: string; linkedin_url?: string }) => ({
        name: p.name,
        title: p.title,
        email: p.email,
        linkedin: p.linkedin_url,
      })),
    };
  } catch (error) {
    return { error: `Apollo search failed: ${error}` };
  }
}

async function executeSearchBBB(companyName: string, state: string): Promise<unknown> {
  const query = `site:bbb.org "${companyName}" ${state} pest control`;
  return executeWebSearch(query);
}

async function executeSearchPCT(query: string): Promise<unknown> {
  return executeWebSearch(`site:pctonline.com ${query}`);
}

async function executeSearchBusinessJournals(companyName: string, region?: string): Promise<unknown> {
  let query = `site:bizjournals.com "${companyName}"`;
  if (region) query += ` ${region}`;
  return executeWebSearch(query);
}

async function executeSearchJobPostings(companyName: string): Promise<unknown> {
  return executeWebSearch(`"${companyName}" (jobs OR careers OR hiring) pest control`);
}

async function executeSearchLinkedInCompany(companyName: string): Promise<unknown> {
  return executeWebSearch(`site:linkedin.com/company "${companyName}" pest control`);
}

async function executeSearchAssociation(association: string, personName?: string, companyName?: string): Promise<unknown> {
  let query = `"${association}"`;
  if (personName) query += ` "${personName}"`;
  if (companyName) query += ` "${companyName}"`;
  query += ' (board OR member OR president OR committee)';
  return executeWebSearch(query);
}

async function executeCheckDomainWhois(domain: string): Promise<unknown> {
  return executeWebSearch(`whois ${domain} registrant`);
}

async function executeDetectTechStack(companyName: string, domain: string, portalUrl?: string): Promise<unknown> {
  const results: Array<{ vendor: string; method: string; evidence: string; is_known_vendor: boolean }> = [];

  if (portalUrl) {
    // Check against known patterns
    for (const [pattern, vendorInfo] of Object.entries(TECH_PORTAL_PATTERNS)) {
      if (portalUrl.includes(pattern)) {
        results.push({
          vendor: vendorInfo.vendor,
          method: 'portal_url',
          evidence: portalUrl,
          is_known_vendor: vendorInfo.known,
        });
      }
    }

    // If no match found, flag as unknown
    if (results.length === 0) {
      const portalDomain = portalUrl.match(/https?:\/\/[^/]+/)?.[0] || portalUrl;
      results.push({
        vendor: `Unknown Portal (${portalDomain})`,
        method: 'portal_url',
        evidence: portalUrl,
        is_known_vendor: false,
      });
    }
  }

  // Search for tech mentions in job postings
  const jobQuery = `"${companyName}" jobs (FieldRoutes OR PestPac OR ServiceTitan OR Briostack)`;
  const jobResults = await executeWebSearch(jobQuery);

  return {
    portal_detections: results,
    job_search: jobResults,
    known_vendors: KNOWN_FSM_VENDORS,
    note: 'If is_known_vendor is false, call search_tech_case_study to find the real vendor',
  };
}

async function executeFetchWebsitePages(domain: string, pages: string[]): Promise<unknown> {
  const results: Record<string, unknown> = {};

  for (const page of pages.slice(0, 6)) { // Limit to 6 pages
    const url = `https://${domain}${page.startsWith('/') ? page : '/' + page}`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        results[page] = { error: `HTTP ${response.status}` };
        continue;
      }

      const html = await response.text();

      // Extract structured content
      let content = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (content.length > 8000) content = content.substring(0, 8000) + '... [truncated]';

      // Try to extract specific elements
      const pageData: Record<string, unknown> = { content };

      // Extract headings for structure
      const headings: string[] = [];
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/gi);
      const h2Match = html.match(/<h2[^>]*>(.*?)<\/h2>/gi);
      if (h1Match) headings.push(...h1Match.map(h => h.replace(/<[^>]+>/g, '').trim()).filter(h => h.length > 2));
      if (h2Match) headings.push(...h2Match.map(h => h.replace(/<[^>]+>/g, '').trim()).filter(h => h.length > 2));
      if (headings.length > 0) pageData.headings = headings.slice(0, 20);

      // Look for team/leadership cards
      if (page.includes('team') || page.includes('about') || page.includes('leadership')) {
        const teamMembers: Array<{ name?: string; title?: string }> = [];
        // Look for common patterns like person cards
        const personPatterns = [
          /<div[^>]*class="[^"]*(?:team|person|member|staff|employee)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<article[^>]*>([\s\S]*?)<\/article>/gi,
        ];
        for (const pattern of personPatterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            const block = match[1];
            const nameMatch = block.match(/<(?:h[2-4]|strong|b)[^>]*>([^<]+)<\/(?:h[2-4]|strong|b)>/i);
            const titleMatch = block.match(/<(?:p|span)[^>]*class="[^"]*(?:title|role|position)[^"]*"[^>]*>([^<]+)<\/(?:p|span)>/i);
            if (nameMatch) {
              teamMembers.push({
                name: nameMatch[1].trim(),
                title: titleMatch?.[1]?.trim() || undefined,
              });
            }
          }
        }
        if (teamMembers.length > 0) pageData.team_members = teamMembers.slice(0, 20);
      }

      // Look for services
      if (page.includes('service') || page.includes('pest')) {
        const services: string[] = [];
        const servicePatterns = [
          /<(?:h[2-4]|strong)[^>]*>([^<]*(?:control|removal|treatment|inspection|prevention)[^<]*)<\/(?:h[2-4]|strong)>/gi,
          /<li[^>]*>([^<]*(?:ant|termite|rodent|mosquito|bed bug|roach|spider|wasp|bee|wildlife)[^<]*)<\/li>/gi,
        ];
        for (const pattern of servicePatterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            services.push(match[1].trim());
          }
        }
        if (services.length > 0) pageData.services = [...new Set(services)].slice(0, 30);
      }

      // Look for pricing
      if (page.includes('pric')) {
        const pricePatterns = [
          /\$\d+(?:\.\d{2})?(?:\s*[-–]\s*\$\d+(?:\.\d{2})?)?(?:\s*\/\s*\w+)?/g,
          /starting\s+(?:at|from)\s+\$\d+/gi,
          /free\s+(?:quote|estimate|inspection)/gi,
        ];
        const priceInfo: string[] = [];
        for (const pattern of pricePatterns) {
          const matches = content.match(pattern);
          if (matches) priceInfo.push(...matches);
        }
        if (priceInfo.length > 0) pageData.pricing = [...new Set(priceInfo)].slice(0, 10);
      }

      // Look for values/culture keywords
      if (page.includes('about') || page.includes('culture') || page.includes('career') || page.includes('value')) {
        const valuePatterns = [
          /(?:our\s+)?(?:core\s+)?values?[:\s]+([^.]+\.)/gi,
          /(?:we\s+believe|our\s+mission|our\s+vision)[:\s]+([^.]+\.)/gi,
        ];
        const values: string[] = [];
        for (const pattern of valuePatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            values.push(match[1].trim());
          }
        }
        if (values.length > 0) pageData.values = values.slice(0, 10);
      }

      results[page] = pageData;
    } catch (error) {
      results[page] = { error: `Failed: ${error}` };
    }
  }

  return {
    pages_fetched: Object.keys(results).length,
    results,
    tip: 'Extract mission, values, services, leadership bios, and pricing from the page content',
  };
}

async function executeSearchTechCaseStudy(companyName: string, suspectedVendor?: string): Promise<unknown> {
  const queries: string[] = [];

  // General case study search
  queries.push(`"${companyName}" case study`);
  queries.push(`"${companyName}" customer success`);

  // Vendor-specific searches
  if (suspectedVendor) {
    queries.push(`"${companyName}" "${suspectedVendor}"`);
  } else {
    // Search for all major vendors
    queries.push(`"${companyName}" (FieldRoutes OR PestPac OR ServiceTitan OR Briostack OR WorkWave)`);
    queries.push(`"${companyName}" (Rippling OR Gusto OR ADP OR Paylocity)`); // HR systems
    queries.push(`"${companyName}" switched software OR migrated system`);
  }

  const results: Array<{ query: string; results: unknown }> = [];
  for (const query of queries.slice(0, 3)) {
    const searchResults = await executeWebSearch(query);
    results.push({ query, results: searchResults });
  }

  return {
    case_study_searches: results,
    tip: 'Look for case study pages, press releases, or testimonials mentioning the company',
  };
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'web_search':
      return await executeWebSearch(input.query as string);
    case 'fetch_page':
      return await executeFetchPage(input.url as string);
    case 'google_places':
      return await executeGooglePlaces(input.query as string);
    case 'apollo_people_search':
      return await executeApolloSearch(input.domain as string, input.titles as string[] | undefined);
    case 'search_bbb':
      return await executeSearchBBB(input.company_name as string, input.state as string);
    case 'search_pct':
      return await executeSearchPCT(input.query as string);
    case 'search_business_journals':
      return await executeSearchBusinessJournals(input.company_name as string, input.region as string | undefined);
    case 'search_job_postings':
      return await executeSearchJobPostings(input.company_name as string);
    case 'search_linkedin_company':
      return await executeSearchLinkedInCompany(input.company_name as string);
    case 'search_association':
      return await executeSearchAssociation(
        input.association as string,
        input.person_name as string | undefined,
        input.company_name as string | undefined
      );
    case 'check_domain_whois':
      return await executeCheckDomainWhois(input.domain as string);
    case 'detect_tech_stack':
      return await executeDetectTechStack(
        input.company_name as string,
        input.domain as string,
        input.portal_url as string | undefined
      );
    case 'search_tech_case_study':
      return await executeSearchTechCaseStudy(
        input.company_name as string,
        input.suspected_vendor as string | undefined
      );
    case 'fetch_website_pages':
      return await executeFetchWebsitePages(
        input.domain as string,
        input.pages as string[]
      );
    case 'set_canonical_identity':
    case 'save_company_profile':
    case 'save_finding':
    case 'save_inference':
    case 'save_tech_stack':
    case 'save_growth_signal':
    case 'save_timeline_event':
    case 'note_gap':
    case 'complete_phase':
    case 'finish':
      return { status: 'saved' };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================
// MAIN RESEARCH FUNCTION
// ============================================

export async function researchCompanyV61(input: CompanyResearchInput): Promise<ResearchOutputV61> {
  const { companyName, domain } = input;
  const startTime = Date.now();

  const anthropic = new Anthropic();

  // Initialize
  let canonicalIdentity: CanonicalIdentity = {
    operating_name: companyName,
    legal_entity: null,
    dba_names: [],
    domain,
    hq_city: null,
    hq_state: null,
    parent_company: null,
    ownership_type: 'unknown',
    pe_firm: null,
    franchise_brand: null,
    family_generation: null,
    identity_confidence: 'low',
    verification_sources: [],
  };

  const findings: Record<string, Finding> = {};
  const inferences: Record<string, Inference> = {};
  const techStack: TechStackItem[] = [];
  const growthSignals: GrowthSignal[] = [];
  const timeline: TimelineEvent[] = [];
  const gaps: Gap[] = [];
  const discrepancies: Discrepancy[] = [];
  const phasesCompleted: string[] = [];
  let companyProfile: CompanyProfile = {
    mission_statement: null,
    vision_statement: null,
    core_values: [],
    culture_description: null,
    history_narrative: null,
    service_offerings: [],
    pricing_info: { model: null, starting_prices: null, pricing_notes: null },
    leadership_bios: [],
    certifications: [],
    service_areas: [],
    unique_selling_points: [],
  };

  const userMessage = `Research this pest control company:

**Company:** ${companyName}
**Domain:** ${domain}
${input.state ? `**State:** ${input.state}` : ''}

Follow the 4-phase protocol:
1. IDENTIFY: Establish canonical identity with ownership_type (family/pe_backed/franchise/independent)
2. GROUND: Website, BBB, Google, LinkedIn
3. ENRICH: PCT, business journals, associations, M&A, tech detection (v6.1 - validate tech against known vendor list)
4. VALIDATE: Infer gaps, cross-reference, calculate confidence

Start by fetching the homepage.`;

  const messages: MessageParam[] = [{ role: 'user', content: userMessage }];
  let continueLoop = true;
  let toolCalls = 0;
  const maxToolCalls = 45;
  let finalSummary = '';
  let finalConfidenceScore = 0;
  let finalConfidenceBreakdown: ConfidenceBreakdown = {
    identity: 0, ownership: 0, size: 0, reputation: 0, industry: 0, enrichment: 0, penalties: 0
  };
  let finalKeyFindings: string[] = [];

  // Get prompt configuration from database
  const promptConfig = await getPrompt('research_agent_v61');
  const model = promptConfig?.model || 'claude-sonnet-4-20250514';
  const maxTokensConfig = promptConfig?.max_tokens || 4096;
  const systemPrompt = promptConfig?.prompt_template || SYSTEM_PROMPT;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🔍 PEST CONTROL INTELLIGENCE v6.1: ${companyName}`);
  console.log(`   Domain: ${domain}`);
  console.log(`   Model: ${model}`);
  console.log(`${'═'.repeat(70)}\n`);

  while (continueLoop && toolCalls < maxToolCalls) {
    try {
      const response = await anthropic.messages.create({
        model: model as 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307' | 'claude-opus-4-20250514',
        max_tokens: maxTokensConfig,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages,
      });

      const assistantContent: ContentBlock[] = [];
      const toolResults: { id: string; result: unknown }[] = [];

      for (const block of response.content) {
        assistantContent.push(block);

        if (block.type === 'text') {
          console.log(`[Agent] ${block.text}`);
        } else if (block.type === 'tool_use') {
          toolCalls++;
          const toolInput = block.input as Record<string, unknown>;
          console.log(`[${toolCalls}] ${block.name}(${JSON.stringify(toolInput).substring(0, 80)}...)`);

          const toolResult = await executeTool(block.name, toolInput);

          // Process output tools
          if (block.name === 'set_canonical_identity') {
            canonicalIdentity = {
              ...canonicalIdentity,
              operating_name: (toolInput.operating_name as string) || canonicalIdentity.operating_name,
              legal_entity: toolInput.legal_entity as string || null,
              dba_names: (toolInput.dba_names as string[]) || [],
              domain: (toolInput.domain as string) || domain,
              hq_city: toolInput.hq_city as string || null,
              hq_state: toolInput.hq_state as string || null,
              parent_company: toolInput.parent_company as string || null,
              ownership_type: (toolInput.ownership_type as OwnershipType) || 'unknown',
              pe_firm: toolInput.pe_firm as string || null,
              franchise_brand: toolInput.franchise_brand as string || null,
              family_generation: toolInput.family_generation as string || null,
              verification_sources: (toolInput.verification_sources as string[]) || [],
              identity_confidence: (toolInput.verification_sources as string[])?.length >= 2 ? 'high' : 'medium',
            };
            console.log(`  ✓ Identity: ${canonicalIdentity.operating_name} [${canonicalIdentity.ownership_type}]`);
          }

          if (block.name === 'save_finding') {
            findings[toolInput.field as string] = {
              value: toolInput.value,
              source: toolInput.source as string,
              source_url: toolInput.source_url as string,
              confidence: toolInput.confidence as Finding['confidence'],
              detection_method: toolInput.detection_method as string,
              verified_by: toolInput.verified_by as string[],
              notes: toolInput.notes as string,
              collected_at: new Date().toISOString(),
            };
            console.log(`  ✓ ${toolInput.field}: ${JSON.stringify(toolInput.value).substring(0, 50)} [${toolInput.confidence}]`);
          }

          if (block.name === 'save_inference') {
            inferences[toolInput.field as string] = {
              value: toolInput.value,
              method: toolInput.method as string,
              calculation: toolInput.calculation as string,
              inputs: toolInput.inputs as Record<string, unknown>,
              confidence: toolInput.confidence as string,
            };
            console.log(`  ⊕ Inferred ${toolInput.field}: ${toolInput.value}`);
          }

          if (block.name === 'save_tech_stack') {
            const isKnown = toolInput.is_known_vendor as boolean ?? KNOWN_FSM_VENDORS.includes(toolInput.vendor as string);
            techStack.push({
              category: toolInput.category as string,
              vendor: toolInput.vendor as string,
              confidence: toolInput.confidence as TechStackItem['confidence'],
              detection_method: toolInput.detection_method as string,
              evidence: toolInput.evidence as string,
              is_known_vendor: isKnown,
            });
            const marker = isKnown ? '✓' : '⚠';
            console.log(`  ${marker} Tech: ${toolInput.vendor} [${toolInput.confidence}] known=${isKnown}`);
          }

          if (block.name === 'save_company_profile') {
            companyProfile = {
              mission_statement: toolInput.mission_statement as string || companyProfile.mission_statement,
              vision_statement: toolInput.vision_statement as string || companyProfile.vision_statement,
              core_values: (toolInput.core_values as string[]) || companyProfile.core_values,
              culture_description: toolInput.culture_description as string || companyProfile.culture_description,
              history_narrative: toolInput.history_narrative as string || companyProfile.history_narrative,
              service_offerings: (toolInput.service_offerings as CompanyProfile['service_offerings']) || companyProfile.service_offerings,
              pricing_info: {
                model: toolInput.pricing_model as string || companyProfile.pricing_info.model,
                starting_prices: toolInput.starting_prices as string || companyProfile.pricing_info.starting_prices,
                pricing_notes: toolInput.pricing_notes as string || companyProfile.pricing_info.pricing_notes,
              },
              leadership_bios: (toolInput.leadership_bios as CompanyProfile['leadership_bios']) || companyProfile.leadership_bios,
              certifications: (toolInput.certifications as string[]) || companyProfile.certifications,
              service_areas: (toolInput.service_areas as string[]) || companyProfile.service_areas,
              unique_selling_points: (toolInput.unique_selling_points as string[]) || companyProfile.unique_selling_points,
            };
            console.log(`  📋 Profile: ${companyProfile.service_offerings.length} services, ${companyProfile.leadership_bios.length} leaders`);
          }

          if (block.name === 'save_growth_signal') {
            growthSignals.push({
              signal: toolInput.signal as string,
              value: toolInput.value,
              interpretation: toolInput.interpretation as string,
            });
            console.log(`  📈 Growth: ${toolInput.signal}`);
          }

          if (block.name === 'save_timeline_event') {
            timeline.push({
              year: toolInput.year as number,
              event: toolInput.event as string,
              source: toolInput.source as string,
            });
            console.log(`  📅 ${toolInput.year}: ${toolInput.event}`);
          }

          if (block.name === 'note_gap') {
            gaps.push({
              field: toolInput.field as string,
              attempts: toolInput.attempts as string,
              reason: toolInput.reason as string,
            });
          }

          if (block.name === 'complete_phase') {
            phasesCompleted.push(toolInput.phase as string);
            console.log(`\n  ═══ PHASE ${(toolInput.phase as string).toUpperCase()} COMPLETE ═══\n`);
          }

          if (block.name === 'finish') {
            continueLoop = false;
            finalSummary = toolInput.summary as string || '';
            finalConfidenceScore = toolInput.confidence_score as number || 0;
            finalConfidenceBreakdown = (toolInput.confidence_breakdown as ConfidenceBreakdown) || finalConfidenceBreakdown;
            finalKeyFindings = (toolInput.key_findings as string[]) || [];
          }

          toolResults.push({ id: block.id, result: toolResult });
        }
      }

      messages.push({ role: 'assistant', content: assistantContent });

      if (toolResults.length > 0) {
        const toolResultBlocks: ToolResultBlockParam[] = toolResults.map((tr) => ({
          type: 'tool_result' as const,
          tool_use_id: tr.id,
          content: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        }));
        messages.push({ role: 'user', content: toolResultBlocks });
      }

      if (response.stop_reason === 'end_turn' && toolResults.length === 0) {
        continueLoop = false;
      }
    } catch (error) {
      console.error(`[Error] ${error}`);
      if (toolCalls >= 3) continueLoop = false;
    }
  }

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  // Auto-calculate if agent didn't finish
  if (finalConfidenceScore === 0) {
    const breakdown = calculateConfidenceBreakdown(canonicalIdentity, findings, techStack, growthSignals, gaps, discrepancies);
    finalConfidenceBreakdown = breakdown;
    finalConfidenceScore = Math.max(0,
      40 + breakdown.identity + breakdown.ownership + breakdown.size +
      breakdown.reputation + breakdown.industry + breakdown.enrichment + breakdown.penalties
    );

    finalKeyFindings = Object.entries(findings)
      .filter(([_, f]) => f.confidence === 'confirmed' || f.confidence === 'high')
      .slice(0, 7)
      .map(([field, f]) => `${field}: ${JSON.stringify(f.value).substring(0, 50)}`);

    finalSummary = `${canonicalIdentity.operating_name} is a ${canonicalIdentity.ownership_type} pest control company` +
      (canonicalIdentity.hq_state ? ` based in ${canonicalIdentity.hq_state}` : '') + `. ` +
      `Found ${Object.keys(findings).length} verified findings.`;
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 RESEARCH COMPLETE`);
  console.log(`   Tool calls: ${toolCalls}/${maxToolCalls}`);
  console.log(`   Duration: ${durationSeconds}s`);
  console.log(`   Findings: ${Object.keys(findings).length}`);
  console.log(`   Ownership: ${canonicalIdentity.ownership_type}`);
  console.log(`   Confidence: ${finalConfidenceScore}%`);
  console.log(`${'═'.repeat(70)}\n`);

  timeline.sort((a, b) => a.year - b.year);

  // Generate markdown report
  const markdownReport = generateMarkdownReport({
    canonicalIdentity,
    findings,
    inferences,
    techStack,
    growthSignals,
    timeline,
    gaps,
    discrepancies,
    companyProfile,
    summary: finalSummary,
    confidenceScore: finalConfidenceScore,
    confidenceBreakdown: finalConfidenceBreakdown,
    keyFindings: finalKeyFindings,
    durationSeconds,
    toolCalls,
    phasesCompleted,
  });

  return {
    version: '6.1',
    researched_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    tool_calls: toolCalls,
    phases_completed: phasesCompleted,
    markdown_report: markdownReport,
    canonical_identity: canonicalIdentity,
    findings,
    inferences,
    tech_stack: techStack,
    growth_signals: growthSignals,
    timeline,
    gaps,
    discrepancies,
    company_profile: companyProfile,
    summary: finalSummary,
    confidence_score: finalConfidenceScore,
    confidence_breakdown: finalConfidenceBreakdown,
    key_findings: finalKeyFindings,
  };
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

function calculateConfidenceBreakdown(
  identity: CanonicalIdentity,
  findings: Record<string, Finding>,
  techStack: TechStackItem[],
  growthSignals: GrowthSignal[],
  gaps: Gap[],
  discrepancies: Discrepancy[]
): ConfidenceBreakdown {
  let identityScore = 0;
  let ownershipScore = 0;
  let sizeScore = 0;
  let reputationScore = 0;
  let industryScore = 0;
  let enrichmentScore = 0;
  let penalties = 0;

  // Identity (+20)
  if (identity.verification_sources.length >= 2) identityScore += 10;
  else if (identity.verification_sources.length >= 1) identityScore += 5;
  if (identity.legal_entity) identityScore += 5;
  if (identity.ownership_type !== 'unknown') identityScore += 5;

  // Ownership (+20)
  const ownerField = findings['owner_name'] || findings['owner'] || findings['owner_ceo'] || findings['co_owners'];
  if (ownerField) {
    if (ownerField.confidence === 'confirmed') ownershipScore += 10;
    else if (ownerField.confidence === 'high') ownershipScore += 7;
    else ownershipScore += 5;
  }
  if (identity.ownership_type !== 'unknown') ownershipScore += 5;
  if (identity.family_generation || identity.pe_firm) ownershipScore += 5;

  // Size (+15)
  if (findings['employee_count'] || findings['employees']) sizeScore += 5;
  if (findings['revenue'] || findings['revenue_2024'] || findings['estimated_revenue']) sizeScore += 5;
  if (findings['location_count'] || findings['locations'] || findings['locations_count']) sizeScore += 5;

  // Reputation (+10)
  if (findings['google_rating']) reputationScore += 5;
  if (findings['bbb_rating']) reputationScore += 5;

  // Industry (+10)
  if (findings['pct_ranking'] || findings['pct_ranking_2024'] || findings['pct_top_100_ranking'] || findings['revenue']) industryScore += 5;
  if (findings['industry_recognition'] || findings['association_roles']) industryScore += 5;

  // Enrichment (+10)
  if (techStack.length > 0) enrichmentScore += 5;
  if (growthSignals.length > 0) enrichmentScore += 5;

  // Penalties
  if (identity.identity_confidence === 'low') penalties -= 10;
  penalties -= discrepancies.filter(d => d.resolution === 'unresolved').length * 5;

  return {
    identity: Math.min(20, identityScore),
    ownership: Math.min(20, ownershipScore),
    size: Math.min(15, sizeScore),
    reputation: Math.min(10, reputationScore),
    industry: Math.min(10, industryScore),
    enrichment: Math.min(10, enrichmentScore),
    penalties: Math.max(-25, penalties),
  };
}

// ============================================
// MARKDOWN REPORT GENERATION
// ============================================

interface MarkdownReportData {
  canonicalIdentity: CanonicalIdentity;
  findings: Record<string, Finding>;
  inferences: Record<string, Inference>;
  techStack: TechStackItem[];
  growthSignals: GrowthSignal[];
  timeline: TimelineEvent[];
  gaps: Gap[];
  discrepancies: Discrepancy[];
  companyProfile?: CompanyProfile;
  summary: string;
  confidenceScore: number;
  confidenceBreakdown: ConfidenceBreakdown;
  keyFindings: string[];
  durationSeconds: number;
  toolCalls: number;
  phasesCompleted: string[];
}

function generateMarkdownReport(data: MarkdownReportData): string {
  const {
    canonicalIdentity,
    findings,
    inferences,
    techStack,
    growthSignals,
    timeline,
    gaps,
    companyProfile,
    summary,
    confidenceScore,
    confidenceBreakdown,
    keyFindings,
    durationSeconds,
    toolCalls,
    phasesCompleted,
  } = data;

  const lines: string[] = [];

  // Header
  lines.push(`# ${canonicalIdentity.operating_name}`);
  lines.push('');
  lines.push(`**Intelligence Report v6.1** | Confidence: ${confidenceScore}%`);
  lines.push('');

  // Quick Facts
  lines.push('## Quick Facts');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Domain** | ${canonicalIdentity.domain} |`);
  if (canonicalIdentity.legal_entity) {
    lines.push(`| **Legal Entity** | ${canonicalIdentity.legal_entity} |`);
  }
  if (canonicalIdentity.hq_city && canonicalIdentity.hq_state) {
    lines.push(`| **Headquarters** | ${canonicalIdentity.hq_city}, ${canonicalIdentity.hq_state} |`);
  }
  lines.push(`| **Ownership** | ${formatOwnershipType(canonicalIdentity)} |`);
  if (findings['founded_year']) {
    lines.push(`| **Founded** | ${findings['founded_year'].value} |`);
  }
  if (findings['years_in_business']) {
    lines.push(`| **Years in Business** | ${findings['years_in_business'].value} |`);
  }
  if (findings['employees'] || findings['employee_count']) {
    const empFinding = findings['employees'] || findings['employee_count'];
    lines.push(`| **Employees** | ${empFinding.value} |`);
  }
  if (findings['revenue'] || findings['revenue_2024']) {
    const revFinding = findings['revenue'] || findings['revenue_2024'];
    const revValue = typeof revFinding.value === 'number'
      ? `$${(revFinding.value / 1000000).toFixed(1)}M`
      : revFinding.value;
    lines.push(`| **Revenue** | ${revValue} |`);
  }
  if (findings['locations_count'] || findings['location_count']) {
    const locFinding = findings['locations_count'] || findings['location_count'];
    lines.push(`| **Locations** | ${locFinding.value} |`);
  }
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(summary);
  lines.push('');

  // Key Findings
  if (keyFindings.length > 0) {
    lines.push('## Key Findings');
    lines.push('');
    for (const finding of keyFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push('');
  }

  // Company Culture & Values (from companyProfile)
  if (companyProfile) {
    const hasCultureInfo = companyProfile.mission_statement || companyProfile.vision_statement ||
      companyProfile.core_values.length > 0 || companyProfile.culture_description;

    if (hasCultureInfo) {
      lines.push('## Company Culture & Values');
      lines.push('');

      if (companyProfile.mission_statement) {
        lines.push(`**Mission:** ${companyProfile.mission_statement}`);
        lines.push('');
      }

      if (companyProfile.vision_statement) {
        lines.push(`**Vision:** ${companyProfile.vision_statement}`);
        lines.push('');
      }

      if (companyProfile.core_values.length > 0) {
        lines.push('**Core Values:**');
        for (const value of companyProfile.core_values) {
          lines.push(`- ${value}`);
        }
        lines.push('');
      }

      if (companyProfile.culture_description) {
        lines.push(`**Culture:** ${companyProfile.culture_description}`);
        lines.push('');
      }

      if (companyProfile.history_narrative) {
        lines.push(`**Company History:** ${companyProfile.history_narrative}`);
        lines.push('');
      }
    }

    // Service Offerings
    if (companyProfile.service_offerings.length > 0) {
      lines.push('## Service Offerings');
      lines.push('');
      for (const service of companyProfile.service_offerings) {
        lines.push(`### ${service.name}`);
        lines.push(`${service.description}`);
        if (service.target_market) {
          lines.push(`*Target Market: ${service.target_market}*`);
        }
        lines.push('');
      }
    }

    // Pricing Information
    if (companyProfile.pricing_info.model || companyProfile.pricing_info.starting_prices) {
      lines.push('## Pricing Information');
      lines.push('');
      if (companyProfile.pricing_info.model) {
        lines.push(`**Pricing Model:** ${companyProfile.pricing_info.model}`);
      }
      if (companyProfile.pricing_info.starting_prices) {
        lines.push(`**Starting Prices:** ${companyProfile.pricing_info.starting_prices}`);
      }
      if (companyProfile.pricing_info.pricing_notes) {
        lines.push(`**Notes:** ${companyProfile.pricing_info.pricing_notes}`);
      }
      lines.push('');
    }

    // Leadership Team with Bios
    if (companyProfile.leadership_bios.length > 0) {
      lines.push('## Leadership Team');
      lines.push('');
      for (const leader of companyProfile.leadership_bios) {
        lines.push(`### ${leader.name}`);
        lines.push(`**${leader.title}**`);
        if (leader.bio) {
          lines.push('');
          lines.push(leader.bio);
        }
        if (leader.linkedin) {
          lines.push(`[LinkedIn](${leader.linkedin})`);
        }
        lines.push('');
      }
    }

    // Service Areas
    if (companyProfile.service_areas.length > 0) {
      lines.push('## Service Areas');
      lines.push('');
      lines.push(companyProfile.service_areas.join(', '));
      lines.push('');
    }

    // Certifications
    if (companyProfile.certifications.length > 0) {
      lines.push('## Certifications & Credentials');
      lines.push('');
      for (const cert of companyProfile.certifications) {
        lines.push(`- ${cert}`);
      }
      lines.push('');
    }

    // Unique Selling Points
    if (companyProfile.unique_selling_points.length > 0) {
      lines.push('## Unique Selling Points');
      lines.push('');
      for (const usp of companyProfile.unique_selling_points) {
        lines.push(`- ${usp}`);
      }
      lines.push('');
    }
  }

  // Leadership (from findings - only if no profile leadership)
  const ownerFindings = ['owner_ceo', 'owner_name', 'owner', 'co_owners', 'management', 'key_people']
    .filter(k => findings[k])
    .map(k => ({ field: k, ...findings[k] }));

  const hasProfileLeadership = companyProfile && companyProfile.leadership_bios.length > 0;
  if (ownerFindings.length > 0 && !hasProfileLeadership) {
    lines.push('## Leadership');
    lines.push('');
    for (const finding of ownerFindings) {
      const value = typeof finding.value === 'object'
        ? Object.entries(finding.value as Record<string, string>)
            .map(([k, v]) => `${formatFieldName(k)}: ${v}`)
            .join(', ')
        : finding.value;
      lines.push(`- **${formatFieldName(finding.field)}**: ${value}`);
      lines.push(`  - Source: ${finding.source} (${finding.confidence})`);
    }
    lines.push('');
  }

  // Industry Position
  const industryFindings = ['pct_top_100_ranking', 'pct_ranking_2024', 'pct_historical_rankings', 'fast_50_rankings', 'bbb_rating', 'google_rating']
    .filter(k => findings[k]);

  if (industryFindings.length > 0) {
    lines.push('## Industry Position');
    lines.push('');
    for (const key of industryFindings) {
      const f = findings[key];
      if (key.includes('pct') && typeof f.value === 'number') {
        lines.push(`- **PCT Top 100 Rank**: #${f.value}`);
      } else if (key === 'bbb_rating') {
        lines.push(`- **BBB Rating**: ${f.value}`);
      } else if (key === 'google_rating') {
        lines.push(`- **Google Rating**: ${f.value}/5`);
      } else if (key === 'fast_50_rankings' && typeof f.value === 'object') {
        const rankings = f.value as Record<string, number>;
        lines.push(`- **Business Journal Rankings**: ${Object.entries(rankings).map(([y, r]) => `#${r} (${y})`).join(', ')}`);
      } else if (key === 'pct_historical_rankings' && typeof f.value === 'object') {
        lines.push(`- **Historical Growth**:`);
        for (const [year, data] of Object.entries(f.value as Record<string, { rank: number; revenue: number }>)) {
          lines.push(`  - ${year}: #${data.rank} ($${(data.revenue / 1000000).toFixed(1)}M)`);
        }
      }
    }
    lines.push('');
  }

  // Technology Stack
  if (techStack.length > 0) {
    lines.push('## Technology Stack');
    lines.push('');
    lines.push('| Category | Vendor | Confidence | Known Vendor |');
    lines.push('|----------|--------|------------|--------------|');
    for (const tech of techStack) {
      const knownIcon = tech.is_known_vendor ? '✓' : '⚠';
      lines.push(`| ${tech.category.toUpperCase()} | ${tech.vendor} | ${tech.confidence} | ${knownIcon} |`);
    }
    lines.push('');
    if (techStack.some(t => !t.is_known_vendor)) {
      lines.push('> ⚠ Some technology vendors are branded/unknown portals. Further investigation may be needed.');
      lines.push('');
    }
  }

  // Growth Signals
  if (growthSignals.length > 0) {
    lines.push('## Growth Signals');
    lines.push('');
    for (const signal of growthSignals) {
      lines.push(`### ${formatFieldName(signal.signal)}`);
      lines.push(`- **Value**: ${signal.value}`);
      lines.push(`- **Interpretation**: ${signal.interpretation}`);
      lines.push('');
    }
  }

  // Timeline
  if (timeline.length > 0) {
    lines.push('## Company Timeline');
    lines.push('');
    for (const event of timeline) {
      lines.push(`- **${event.year}**: ${event.event}`);
    }
    lines.push('');
  }

  // All Findings (detailed)
  lines.push('## Detailed Findings');
  lines.push('');
  const detailedFields = Object.entries(findings)
    .filter(([k]) => !['owner_ceo', 'owner_name', 'owner', 'co_owners', 'management', 'key_people',
      'pct_top_100_ranking', 'pct_ranking_2024', 'pct_historical_rankings', 'fast_50_rankings',
      'bbb_rating', 'google_rating', 'founded_year', 'years_in_business', 'employees',
      'employee_count', 'revenue', 'revenue_2024', 'locations_count', 'location_count'].includes(k));

  if (detailedFields.length > 0) {
    lines.push('| Field | Value | Source | Confidence |');
    lines.push('|-------|-------|--------|------------|');
    for (const [field, finding] of detailedFields) {
      const value = typeof finding.value === 'object'
        ? JSON.stringify(finding.value).substring(0, 50)
        : String(finding.value).substring(0, 50);
      lines.push(`| ${formatFieldName(field)} | ${value} | ${finding.source} | ${finding.confidence} |`);
    }
    lines.push('');
  }

  // Inferences
  if (Object.keys(inferences).length > 0) {
    lines.push('## Inferred Data');
    lines.push('');
    for (const [field, inf] of Object.entries(inferences)) {
      lines.push(`### ${formatFieldName(field)}`);
      lines.push(`- **Value**: ${inf.value}`);
      lines.push(`- **Method**: ${inf.method}`);
      lines.push(`- **Calculation**: ${inf.calculation}`);
      lines.push(`- **Confidence**: ${inf.confidence}`);
      lines.push('');
    }
  }

  // Gaps
  if (gaps.length > 0) {
    lines.push('## Data Gaps');
    lines.push('');
    for (const gap of gaps) {
      lines.push(`- **${formatFieldName(gap.field)}**: ${gap.reason || 'Not found'}`);
      if (gap.attempts) {
        lines.push(`  - Attempts: ${gap.attempts}`);
      }
    }
    lines.push('');
  }

  // Confidence Breakdown
  lines.push('## Confidence Score Breakdown');
  lines.push('');
  lines.push(`**Overall Score: ${confidenceScore}/100**`);
  lines.push('');
  lines.push('| Category | Score | Max |');
  lines.push('|----------|-------|-----|');
  lines.push(`| Identity | ${confidenceBreakdown.identity} | 20 |`);
  lines.push(`| Ownership | ${confidenceBreakdown.ownership} | 20 |`);
  lines.push(`| Size | ${confidenceBreakdown.size} | 15 |`);
  lines.push(`| Reputation | ${confidenceBreakdown.reputation} | 10 |`);
  lines.push(`| Industry | ${confidenceBreakdown.industry} | 10 |`);
  lines.push(`| Enrichment | ${confidenceBreakdown.enrichment} | 10 |`);
  if (confidenceBreakdown.penalties < 0) {
    lines.push(`| Penalties | ${confidenceBreakdown.penalties} | -25 |`);
  }
  lines.push('');

  // Metadata
  lines.push('---');
  lines.push('');
  lines.push(`*Research completed in ${durationSeconds}s with ${toolCalls} tool calls*`);
  lines.push(`*Phases: ${phasesCompleted.join(' → ')}*`);
  lines.push(`*Generated: ${new Date().toISOString()}*`);

  return lines.join('\n');
}

function formatOwnershipType(identity: CanonicalIdentity): string {
  switch (identity.ownership_type) {
    case 'family':
      return identity.family_generation
        ? `Family-Owned (${identity.family_generation})`
        : 'Family-Owned';
    case 'pe_backed':
      return identity.pe_firm
        ? `PE-Backed (${identity.pe_firm})`
        : 'PE-Backed';
    case 'franchise':
      return identity.franchise_brand
        ? `Franchise (${identity.franchise_brand})`
        : 'Franchise';
    case 'independent':
      return 'Independent';
    default:
      return 'Unknown';
  }
}

function formatFieldName(field: string): string {
  return field
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// OUTPUT FORMATTING (Legacy Support)
// ============================================

export function formatResearchOutputV61(result: ResearchOutputV61): string {
  // Return the markdown report for console display
  return result.markdown_report;
}
