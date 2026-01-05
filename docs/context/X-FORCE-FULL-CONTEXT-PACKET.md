# X-FORCE Full Context Packet

> **AI-First Sales Platform for X-RAI Labs**
> Last Updated: 2025-01-03

---

## 1. Repository Overview

X-FORCE is an AI-first sales pipeline management platform designed for X-RAI Labs. The system orchestrates sales operations with AI-driven insights, attention flags, and automated triage decisions.

### Core Philosophy
- **AI as Orchestrator**: System proactively identifies what needs attention
- **Process First**: Define ideal sales process, build tech to enforce it
- **Human Choice Always**: AI recommends, humans decide
- **From Insight to Action**: AI detects risk/opportunity, creates actionable flags

### Repository Structure

```
x-force/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Authentication pages (login)
│   │   ├── (dashboard)/        # Main application pages
│   │   │   ├── ai/             # AI insights page
│   │   │   ├── analytics/      # Analytics (whitespace)
│   │   │   ├── calendar/       # Calendar integration
│   │   │   ├── command-center/ # AI command center
│   │   │   ├── communications/ # Communication hub
│   │   │   ├── companies/      # Company management
│   │   │   ├── contacts/       # Contact management
│   │   │   ├── daily/          # Daily driver view
│   │   │   ├── deals/          # Deal management
│   │   │   ├── inbox/          # Email inbox
│   │   │   ├── learning/       # AI learning system
│   │   │   ├── leverage/       # Human leverage moments
│   │   │   ├── meetings/       # Meeting analysis
│   │   │   ├── pipeline/       # Kanban pipeline view
│   │   │   ├── products/       # Product catalog
│   │   │   ├── prospecting/    # Prospecting tools
│   │   │   ├── scheduler/      # AI scheduler
│   │   │   ├── settings/       # App settings
│   │   │   └── tasks/          # Task management
│   │   ├── api/                # API routes (50+ endpoints)
│   │   └── room/               # Deal room public access
│   ├── components/
│   │   ├── ui/                 # Base UI components (shadcn/ui style)
│   │   ├── pipeline/           # Kanban components
│   │   ├── deals/              # Deal-specific components
│   │   ├── companies/          # Company components
│   │   ├── communications/     # Communication components
│   │   └── shared/             # Layout, nav, common
│   ├── lib/
│   │   ├── supabase/           # Database clients
│   │   ├── ai/                 # Claude API helpers
│   │   └── utils/              # Utility functions
│   └── types/                  # TypeScript types
├── supabase/
│   └── migrations/             # SQL migrations (60+)
├── public/                     # Static assets
└── docs/                       # Documentation
```

---

## 2. Infrastructure & Runtime

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js | 16.0.10 |
| **Runtime** | Node.js | 20+ |
| **Language** | TypeScript | 5.x |
| **UI Library** | React | 19.2.1 |
| **Styling** | Tailwind CSS | 4.x |
| **Database** | Supabase (PostgreSQL) | Latest |
| **Auth** | Supabase Auth | Integrated |
| **AI** | Anthropic Claude | claude-3-sonnet |
| **Email** | Microsoft Graph API | Phase 2 |
| **Transcriptions** | Fireflies.ai | Integrated |

### Key Dependencies

```json
{
  "@supabase/ssr": "^0.6.1",
  "@supabase/supabase-js": "^2.49.1",
  "@anthropic-ai/sdk": "^0.37.0",
  "@microsoft/microsoft-graph-client": "^3.0.7",
  "lucide-react": "^0.511.0",
  "recharts": "^2.15.0",
  "date-fns": "^4.1.0",
  "zod": "^3.x"
}
```

### Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Microsoft 365 (optional)
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx

# Fireflies (optional)
FIREFLIES_API_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 3. Supabase / Database Patterns

### Client Architecture

Three Supabase client patterns are used:

#### 1. Server Client (SSR with cookies)
**File**: `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

**Use**: Server Components, API routes requiring user context

#### 2. Admin Client (Service Role)
**File**: `src/lib/supabase/admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Use**: Background jobs, bypassing RLS, admin operations

#### 3. Browser Client
**File**: `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Use**: Client components, real-time subscriptions

### Join Normalization Helper

**File**: `src/lib/supabase/normalize.ts`

```typescript
export function firstOrNull<T>(val: T | T[] | null): T | null {
  if (val === null || val === undefined) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}
```

**Why**: Supabase joins can return either an object or array depending on RLS and query structure. Always use `firstOrNull()` when accessing joined data.

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:
- Users can only see their own organization's data
- Service role key bypasses RLS (use `createAdminClient()`)
- Auth-based policies use `auth.uid()` matching to `users.auth_id`

---

## 4. Application Domain Model

### Core Entities

#### Companies (formerly Organizations)
The primary account entity. Tracks status, segment, industry, and relationships.

```typescript
type CompanyStatus = 'cold_lead' | 'prospect' | 'customer' | 'churned';
type Segment = 'smb' | 'mid_market' | 'enterprise' | 'pe_platform' | 'franchisor';
type Industry = 'pest' | 'lawn' | 'both';
```

#### Products & Product Catalog
X-FORCE is **product-centric**. Products have their own stages, tiers, and sales processes.

- **Products**: The catalog items (Voice, X-RAI Platform, AI Agents, etc.)
- **Product Sales Stages**: Each product defines its own pipeline stages
- **Product Tiers**: Pricing/feature tiers per product

#### Company Products
The **central deal entity**. Represents a company pursuing/owning a specific product.

```typescript
interface CompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
  current_stage_id: string;       // Current pipeline stage
  status: 'in_sales' | 'active' | 'churned' | 'paused';
  mrr: number | null;             // Monthly recurring revenue
  close_confidence: number | null; // 0-100
  close_ready: boolean;
  risk_level: 'none' | 'low' | 'med' | 'high';
  next_step_due_at: string | null;
  last_stage_moved_at: string | null;
  stage_entered_at: string | null;
  // ... more fields
}
```

#### Attention Flags (Operating Layer)
AI-generated or manual flags requiring human attention.

```typescript
type AttentionFlagType =
  | 'NEEDS_REPLY'           // Awaiting our response
  | 'BOOK_MEETING_APPROVAL' // AI wants to book, needs OK
  | 'PROPOSAL_APPROVAL'     // Proposal ready for review
  | 'PRICING_EXCEPTION'     // Non-standard pricing
  | 'CLOSE_DECISION'        // Ready to close, human decides
  | 'HIGH_RISK_OBJECTION'   // Serious objection detected
  | 'NO_NEXT_STEP_AFTER_MEETING' // Meeting but no follow-up
  | 'STALE_IN_STAGE'        // Too long in current stage
  | 'GHOSTING_AFTER_PROPOSAL' // No response post-proposal
  | 'DATA_MISSING_BLOCKER'  // Missing critical data
  | 'SYSTEM_ERROR';         // System/integration error

type AttentionFlagSeverity = 'low' | 'medium' | 'high' | 'critical';
type AttentionFlagStatus = 'open' | 'snoozed' | 'resolved';
type AttentionFlagSourceType = 'communication' | 'pipeline' | 'system';
```

#### Triage Decisions
AI decisions on how to handle inbound communications.

```typescript
type TriageDecisionType =
  | 'REJECT'           // Not qualified, archive
  | 'NURTURE'          // Add to nurture sequence
  | 'BOOK'             // Book a meeting
  | 'ROUTE_TO_PIPELINE'; // Create/update pipeline entry
```

#### Communications
Unified communication records (email, call, meeting, chat).

```typescript
interface Communication {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  channel: 'email' | 'call' | 'meeting' | 'chat' | 'sms';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string | null;
  occurred_at: string;
  // AI analysis fields
  communication_type: string | null;  // AI-classified type
  sentiment: 'positive' | 'neutral' | 'negative' | null;
}
```

### Entity Relationships

```
Company (1) ────< CompanyProduct (many) ────< AttentionFlag (many)
    │                    │
    │                    └──── product_sales_stage (current stage)
    │
    └───< Contact (many)
    └───< Communication (many)
    └───< Deal (legacy, many)
```

---

## 5. Key Runtime Flows

### Flow 1: Daily Driver

**Purpose**: Prioritized list of what needs attention today.

**Endpoint**: `GET /api/daily-driver`

**Returns**:
- `needsHuman`: Open attention flags (medium/high/critical severity)
- `stalled`: Deals with stall flags (STALE_IN_STAGE, NO_NEXT_STEP, GHOSTING)
- `readyToClose`: High confidence deals without blocking flags

**Query Params**:
- `includeSnoozed=true`: Include snoozed flags
- `debug=true`: Include flag IDs and source info

### Flow 2: Attention Flag Creation

**Manual Creation**: `POST /api/attention-flags/create`

```typescript
{
  company_id: string;
  company_product_id?: string;
  flag_type: AttentionFlagType;
  severity: AttentionFlagSeverity;
  reason: string;
  recommended_action: string;
}
```

**Automated Generation**: `POST /api/jobs/generate-stall-flags`

Runs periodically to detect:
- Stale deals (no movement exceeding stage threshold)
- Missing next steps after meetings
- Ghosting after proposal

Also auto-resolves flags when conditions no longer apply.

### Flow 3: Communication Triage

1. Email arrives → `POST /api/communications/analyze`
2. AI analyzes content, detects `communicationType`
3. Maps to playbook → generates `TriageDecision`
4. Creates `AttentionFlag` if human decision needed

### Flow 4: Stage Movement

**Endpoint**: `POST /api/company-products/[id]/move-stage`

Updates `company_product.current_stage_id`, sets `last_stage_moved_at`, resets stale timers.

### Flow 5: Flag Actions

- **Resolve**: `POST /api/attention-flags/[id]/resolve`
- **Snooze**: `POST /api/attention-flags/[id]/snooze` (with `snooze_until` timestamp)
- **Unsnooze**: `POST /api/attention-flags/[id]/unsnooze`

---

## 6. API Surface Area

### Core APIs (50+ endpoints)

#### Companies
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/companies` | List companies |
| GET | `/api/companies/[id]` | Get company details |
| POST | `/api/companies` | Create company |
| GET | `/api/companies/[id]/contacts` | Get company contacts |
| GET | `/api/companies/[id]/products` | Get company products |
| GET | `/api/companies/[id]/intelligence` | Get AI intelligence |
| POST | `/api/companies/[id]/memory` | Add to company memory |

#### Company Products & Pipeline
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/company-products/[id]/move-stage` | Move to new stage |

#### Attention Flags
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/attention-flags/create` | Create manual flag |
| POST | `/api/attention-flags/[id]/resolve` | Resolve flag |
| POST | `/api/attention-flags/[id]/snooze` | Snooze flag |
| POST | `/api/attention-flags/[id]/unsnooze` | Unsnooze flag |

#### Daily Driver
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/daily-driver` | Get prioritized daily items |

#### Communications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/communications` | List communications |
| POST | `/api/communications/analyze` | AI analyze communication |
| GET | `/api/communications/conversations` | Get conversation threads |
| GET | `/api/communications/response-queue` | Get items needing response |
| POST | `/api/communications/[id]/assign` | Assign to company |
| POST | `/api/communications/[id]/exclude` | Exclude from system |

#### AI & Intelligence
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/health-score` | Calculate deal health |
| GET | `/api/ai/signals` | Get AI signals |
| GET | `/api/ai/summaries/[type]/[id]` | Get AI summary |
| GET | `/api/ai-prompts` | List AI prompts |
| PUT | `/api/ai-prompts/[id]` | Update prompt |

#### Command Center
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/command-center` | Get command center items |
| POST | `/api/command-center/items/[id]/enrich` | Enrich with AI |
| POST | `/api/command-center/items/[id]/generate-email` | Draft email |

#### Jobs (Background)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs/generate-stall-flags` | Generate stall flags |

#### Contacts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts/[id]/enrich` | Enrich contact data |

#### Calendar & Meetings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/calendar/[meetingId]/prep` | Get meeting prep |

---

## 7. UI Surface Area

### Dashboard Pages (40+)

#### Core Views
| Path | Description |
|------|-------------|
| `/daily` | Daily driver - prioritized work |
| `/pipeline` | Kanban pipeline view |
| `/companies` | Company list |
| `/companies/[id]` | Company detail with products |
| `/contacts` | Contact list |
| `/deals` | Legacy deal list |

#### AI & Intelligence
| Path | Description |
|------|-------------|
| `/command-center` | AI command center |
| `/ai` | AI insights dashboard |
| `/leverage` | Human leverage moments |
| `/learning` | AI learning system |

#### Communications
| Path | Description |
|------|-------------|
| `/communications` | Communication hub |
| `/inbox` | Email inbox |

#### Products & Pipeline
| Path | Description |
|------|-------------|
| `/products` | Product catalog |
| `/products/[slug]` | Product detail |
| `/products/[slug]/process` | Product sales process |

#### Scheduler
| Path | Description |
|------|-------------|
| `/scheduler` | AI scheduler |
| `/scheduler/settings` | Scheduler config |
| `/scheduler/analytics` | Scheduler analytics |

#### Settings
| Path | Description |
|------|-------------|
| `/settings` | General settings |
| `/settings/integrations` | Integration setup |
| `/settings/ai-prompts` | AI prompt management |
| `/settings/transcripts` | Transcript management |

### Key Components

#### Company Page (`/companies/[id]`)
- Company header with status, segment, quick actions
- Products section (current products, pipeline deals)
- Contacts list
- Communication timeline
- Intelligence panel
- **Quick Flag Modal** - manually create attention flags

#### Pipeline Page (`/pipeline`)
- Kanban board by stage
- Drag-and-drop stage movement
- Deal cards with health indicators

#### Daily Driver (`/daily`)
- Three columns: Needs Human, Stalled, Ready to Close
- Sorted by severity and age
- Quick actions on each item

---

## 8. Operational Gotchas

### 1. Join Normalization Required

Supabase joins can return arrays OR objects depending on RLS/query. Always use:

```typescript
import { firstOrNull } from '@/lib/supabase/normalize';

const stage = firstOrNull(companyProduct.current_stage);
```

### 2. Three Supabase Clients

- **Server** (`createClient` from server.ts): Use in Server Components & API routes
- **Admin** (`createAdminClient`): Use for background jobs, bypasses RLS
- **Browser** (`createClient` from client.ts): Use in Client Components

### 3. Attention Flag Source Types

- `communication`: Created from analyzing a communication
- `pipeline`: Created by stall flag generator
- `system`: Created manually or by system events

**Important**: Auto-resolve only touches flags with `source_type='pipeline'` to avoid resolving manually created flags.

### 4. Stale Thresholds by Stage

```typescript
const STALE_THRESHOLDS: Record<string, number> = {
  discovery: 4,    // days
  demo: 5,
  proposal: 3,
  negotiation: 2,
  default: 5,
};
```

### 5. Company Product Status Values

```typescript
type CompanyProductStatus =
  | 'in_sales'  // Active deal, in pipeline
  | 'active'    // Customer, using product
  | 'churned'   // Former customer
  | 'paused';   // Temporarily paused
```

Only `in_sales` products appear in pipeline views.

### 6. Flag Severity Ordering

```typescript
const SEVERITY_ORDER = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};
```

Daily Driver filters to medium+ for `needsHuman`.

### 7. Product-Centric Model

Deals are NOT the primary entity. **CompanyProduct** is the deal:
- Each product has its own stages
- Company can have multiple products in flight
- Product stages are in `product_sales_stages` table

---

## 9. How to Run Locally

### Prerequisites

- Node.js 20+
- npm or pnpm
- Supabase CLI (optional, for local DB)

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd x-force
npm install

# 2. Copy environment file
cp .env.local.example .env.local

# 3. Fill in environment variables
# Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Required: ANTHROPIC_API_KEY

# 4. Run development server
npm run dev
```

### Database Setup

Option A: Use hosted Supabase project (recommended for development)

Option B: Local Supabase
```bash
supabase start
supabase db push
```

### Common Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run type-check   # TypeScript check
```

---

## 10. How to Debug

### API Route Debugging

All API routes log to console with prefix tags:

```typescript
console.log('[DailyDriver] Processing...');
console.error('[AttentionFlags] Error:', error);
```

Search logs by tag: `[DailyDriver]`, `[AttentionFlags]`, `[GenerateStallFlags]`, etc.

### Database Queries

Use Supabase Dashboard → SQL Editor for direct queries.

Useful queries:
```sql
-- Open attention flags by type
SELECT flag_type, COUNT(*)
FROM attention_flags
WHERE status = 'open'
GROUP BY flag_type;

-- Company products in sales
SELECT cp.*, c.name as company_name, p.name as product_name
FROM company_products cp
JOIN companies c ON c.id = cp.company_id
JOIN products p ON p.id = cp.product_id
WHERE cp.status = 'in_sales';

-- Stale deals (no movement > 5 days)
SELECT * FROM company_products
WHERE status = 'in_sales'
AND last_stage_moved_at < NOW() - INTERVAL '5 days';
```

### React DevTools

Install React DevTools browser extension for component inspection.

### Network Tab

API responses include structured error messages:
```json
{
  "error": "Company not found",
  "details": ["company_id is required"]
}
```

### AI Debugging

AI prompts are stored in `ai_prompts` table and editable at `/settings/ai-prompts`.

To see AI decisions, check:
- `triage_decisions` table
- `attention_flags` with `source_type='communication'`
- Console logs with `[AI]` prefix

---

## Appendix: Type Definitions

### Key Files

- `src/types/index.ts` - Core domain types
- `src/types/operatingLayer.ts` - Operating layer types (flags, triage)

### Import Pattern

```typescript
import type { Company, Contact, CompanyProduct } from '@/types';
import type {
  AttentionFlag,
  AttentionFlagType,
  DailyDriverItem,
  DailyDriverResponse
} from '@/types/operatingLayer';
```

---

## Appendix: Design System

The application follows a "McKinsey meets Apple meets Stripe" design philosophy:

- **Colors**: Monochromatic with semantic accents (green=success, red=error, orange=warning)
- **Typography**: System fonts, restrained weights
- **Spacing**: 4px/8px grid system
- **Cards**: `rounded-xl`, `shadow-sm`, subtle borders
- **Tables**: Horizontal borders only, no zebra striping
- **Animations**: 300ms transitions, purposeful motion

See `CLAUDE.md` for the complete design system documentation.

---

*This document is auto-generated and should be updated when significant architectural changes occur.*
