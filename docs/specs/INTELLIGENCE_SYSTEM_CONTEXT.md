# Intelligence System Context Document

This document provides full context for redesigning the Intelligence system in X-Force CRM.

## Current Architecture Overview

### File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── intelligence-v2/[companyId]/
│   │   │   ├── route.ts           # GET - Fetch intelligence data
│   │   │   ├── collect/route.ts   # POST - Trigger collection
│   │   │   ├── field/route.ts     # PATCH - Update individual field
│   │   │   └── analysis/route.ts  # POST - Generate AI analysis
│   │   └── companies/[id]/route.ts # PATCH - Update company (incl. domain)
│   └── (dashboard)/
│       └── companies/[id]/intelligence/analysis/page.tsx
│
├── components/
│   └── intelligence/
│       ├── IntelligenceDataTab.tsx  # Main UI component (current)
│       ├── IntelligenceTab.tsx      # Old UI component
│       ├── DataField.tsx            # Field display component
│       └── index.ts
│
├── lib/
│   └── intelligence/
│       ├── collectorV2.ts           # Main collection orchestrator
│       ├── dataLayerTypes.ts        # TypeScript types
│       ├── types.ts                 # Source data types
│       ├── collectors/
│       │   ├── base.ts              # BaseCollector class
│       │   ├── websiteCollector.ts  # Scrapes company website
│       │   ├── facebookCollector.ts # Scrapes Facebook page
│       │   ├── googleReviewsCollector.ts  # Google Places API
│       │   ├── apolloCompanyCollector.ts  # Apollo API
│       │   ├── apolloPeopleCollector.ts   # Apollo API for contacts
│       │   ├── linkedinCompanyCollector.ts # LinkedIn scraper
│       │   ├── blogDetector.ts      # Detects blogs
│       │   ├── youtubeDetector.ts   # Detects YouTube
│       │   └── websiteMarketingCollector.ts # Marketing signals
│       └── enrichment/              # Legacy enrichment
│
└── types/
    └── index.ts                     # Main app types
```

### Database Schema

**Main Tables:**
- `company_intelligence` - Stores all collected data (Data Layer)
- `company_intelligence_analyses` - AI-generated analyses (Analysis Layer)
- `company_intelligence_edits` - Edit history/audit trail
- `intelligence_collection_log` - Collection audit log

## Current Data Model

### SourcedField Pattern

Every data field uses this pattern for source attribution:

```typescript
interface SourcedField<T> {
  value: T | null;
  source: string | null;        // e.g., 'website', 'apollo', 'google_places'
  sourceUrl: string | null;     // URL where data was found
  verified: boolean;            // User verified?
  lastChecked: string | null;   // ISO timestamp
  confidence?: 'high' | 'medium' | 'low';
}
```

### Data Categories

```typescript
interface CompanyIntelligence {
  id: string;
  company_id: string;

  // Categories (all fields are SourcedField<T>)
  company_profile: {
    founded_year, employee_count, employee_range,
    annual_revenue, revenue_range, headquarters,
    locations_count, company_type, ownership
  };

  online_presence: {
    website_url, linkedin_url, linkedin_followers,
    facebook_url, facebook_followers, twitter_url,
    instagram_url, youtube_url, youtube_subscribers
  };

  reviews: {
    google_rating, google_review_count, google_place_id,
    facebook_rating, facebook_review_count, bbb_rating,
    yelp_rating, review_velocity_30d, recent_reviews[]
  };

  marketing: {
    has_blog, blog_url, blog_post_frequency,
    last_blog_post_date, email_marketing,
    social_posting_frequency, has_paid_ads,
    marketing_sophistication, primary_channels[]
  };

  technology: {
    crm_system, routing_software, phone_system,
    payment_processor, website_platform, scheduling_system,
    detected_technologies[], has_online_booking, has_live_chat
  };

  financial: {
    estimated_revenue, growth_signals[], funding_status,
    recent_acquisitions[], hiring_activity, job_postings_count
  };

  services: {
    primary_services[], service_areas[], certifications[],
    awards[], specializations[]
  };

  // Lists (not SourcedField)
  key_people: KeyPerson[];
  industry_mentions: IndustryMention[];

  // Metadata
  collection_status: 'pending' | 'collecting' | 'complete' | 'failed' | 'partial';
  last_collected_at: string | null;
  collection_errors: CollectionError[];
  completeness_score: number;
  data_quality_score: number;
}
```

## Collection Flow

### Entry Point
```
POST /api/intelligence-v2/[companyId]/collect
  → collectIntelligenceV2() in collectorV2.ts
```

### Collection Order (in collectorV2.ts)

1. **Website Collection** (if domain provided)
   - Scrapes company website using Playwright
   - Extracts: social links, services, team members, certifications, awards, service areas
   - Source: `websiteCollector.ts`

2. **Facebook Collection**
   - Uses discovered URL or searches for page
   - Extracts: followers, rating, about info
   - Source: `facebookCollector.ts`

3. **Google Reviews**
   - Uses Google Places API
   - Extracts: rating, review count, recent reviews, address
   - Source: `googleReviewsCollector.ts`

4. **Apollo Company**
   - Uses Apollo.io API
   - Extracts: employee count, revenue, technologies, social URLs
   - Source: `apolloCompanyCollector.ts`

5. **Apollo People**
   - Uses Apollo.io API
   - Extracts: key contacts with titles, emails, LinkedIn URLs
   - Source: `apolloPeopleCollector.ts`

6. **Blog Detection** (if domain)
   - Checks for blog presence, post frequency
   - Source: `blogDetector.ts`

7. **YouTube Detection** (if domain)
   - Checks for YouTube channel, subscriber count
   - Source: `youtubeDetector.ts`

8. **LinkedIn Company** (NEW)
   - Scrapes public company page
   - Extracts: followers, about, headquarters
   - Source: `linkedinCompanyCollector.ts`

9. **Website Marketing Signals** (if domain)
   - Analyzes marketing sophistication
   - Extracts: chat widgets, tracking pixels, email capture, scheduling
   - Source: `websiteMarketingCollector.ts`

## API Endpoints

### GET /api/intelligence-v2/[companyId]
Returns:
```json
{
  "intelligence": CompanyIntelligence,
  "latestAnalysis": IntelligenceAnalysis | null,
  "editHistory": IntelligenceEdit[],
  "companyDomain": string | null
}
```

### POST /api/intelligence-v2/[companyId]/collect
Body: `{ sources?: string[], force?: boolean }`
Returns:
```json
{
  "success": boolean,
  "intelligence": CompanyIntelligence,
  "errors": CollectionError[]
}
```

### PATCH /api/intelligence-v2/[companyId]/field
Body:
```json
{
  "fieldPath": "company_profile.employee_count",
  "value": 150,
  "source": "manual",
  "sourceUrl": null,
  "reason": "Confirmed by customer"
}
```

### POST /api/intelligence-v2/[companyId]/analysis
Body: `{ analysisType?: 'full' | 'quick' | 'competitive', forceRefresh?: boolean }`
Returns: `{ analysis: IntelligenceAnalysis, cached: boolean }`

## Current UI Component

`IntelligenceDataTab.tsx` - Main component that:
- Displays domain input (required for collection)
- Shows data completeness score
- Renders collapsible sections for each category
- Uses `DataField` component for each field
- Allows inline editing of editable fields
- Shows source attribution badges
- Has "Add to Contacts" for key people

## Known Issues

1. **Domain Required**: Website collection won't run without domain set
2. **Data Quality**: Revenue estimates often inaccurate for small companies
3. **Awards Extraction**: Pattern-based, misses many awards
4. **LinkedIn/Facebook Scrapers**: Can be blocked, rate limited
5. **Technology Detection**: Limited patterns, misses many CRMs

## Database Migration (Latest)

```sql
-- Main table storing all intelligence data
CREATE TABLE company_intelligence (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),

  company_profile JSONB,
  online_presence JSONB,
  reviews JSONB,
  marketing JSONB,
  technology JSONB,
  financial JSONB,
  services JSONB,

  key_people JSONB DEFAULT '[]',
  industry_mentions JSONB DEFAULT '[]',

  collection_status TEXT,
  last_collected_at TIMESTAMPTZ,
  collection_errors JSONB,
  completeness_score INTEGER,
  data_quality_score INTEGER,

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  UNIQUE(company_id)
);

-- AI analyses (generated on-demand)
CREATE TABLE company_intelligence_analyses (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  intelligence_id UUID REFERENCES company_intelligence(id),

  analysis_type TEXT, -- 'full', 'quick', 'competitive', 'pain_points'
  executive_summary TEXT,

  strengths JSONB,
  weaknesses JSONB,
  opportunities JSONB,
  threats JSONB,

  pain_points JSONB,
  talking_points JSONB,
  recommended_approach TEXT,
  objection_handlers JSONB,

  competitive_position TEXT,
  competitor_mentions JSONB,
  differentiation_angles JSONB,

  connection_points JSONB,
  buying_signals JSONB,
  timing_assessment TEXT,
  urgency_level TEXT,

  overall_score INTEGER,
  engagement_score INTEGER,
  fit_score INTEGER,

  data_snapshot_hash TEXT,
  model_version TEXT,
  tokens_used INTEGER,
  generation_time_ms INTEGER,

  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
```

## Companies Table (Relevant Fields)

```sql
-- companies table has these relevant fields:
domain TEXT,           -- Used for collection (e.g., 'go-forthpest.com')
employee_count INTEGER,
revenue_estimate TEXT,
founded_year INTEGER,
technologies JSONB,
enriched_at TIMESTAMPTZ,
enrichment_source TEXT
```

## Design System Notes

- Uses Tailwind CSS with dark mode support
- Cards: `bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a]`
- Headers: `text-xl font-normal` (NOT bold)
- Labels: `text-xs font-medium text-gray-500 uppercase tracking-wider`
- Primary button: `bg-blue-600 hover:bg-blue-700 text-white rounded-lg`
- Follows "McKinsey meets Apple meets Stripe" aesthetic

## What Needs Improvement

1. **Better domain handling** - Auto-detect from contacts, show prominently
2. **More accurate data** - Revenue, awards, locations are often wrong
3. **Better UI organization** - Current layout is confusing
4. **Real-time collection feedback** - Show progress during collection
5. **Data confidence indicators** - Show when data might be unreliable
6. **Bulk collection** - Collect for multiple companies at once
7. **Better technology detection** - More CRM/phone system patterns
8. **LinkedIn/Facebook reliability** - Handle blocks gracefully
