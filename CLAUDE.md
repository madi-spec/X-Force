# X-FORCE Sales Platform

AI-First Sales Platform for X-RAI Labs

## Project Overview

X-FORCE is a sales pipeline management platform built with:
- **Frontend**: Next.js 14+ with TypeScript and Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **AI**: Claude API for insights and automation
- **Email/Calendar**: Microsoft Graph API (Phase 2)

## Key Concepts

### Core Philosophy
- **AI as Orchestrator**: System proactively identifies what needs attention
- **Process First**: Define ideal sales process, build tech to enforce it
- **Human Choice Always**: AI recommends, humans decide
- **From Insight to Action**: AI detects risk/opportunity, creates actionable tasks

### Pipeline Stages
1. New Lead - First contact
2. Qualifying - Gathering info
3. Discovery - Understanding pain points
4. Demo - Product demonstration
5. Data Review - Reviewing prospect data
6. Trial - Product trial period
7. Negotiation - Contract discussions
8. Closed Won/Lost

### Health Score
Deals are scored 0-100 based on:
- Engagement Recency (25%)
- Stage Velocity (20%)
- Stakeholder Coverage (15%)
- Activity Quality (15%)
- Competitor Risk (10%)
- Trial Engagement (15%)

## Directory Structure

```
src/
├── app/
│   ├── (auth)/           # Login pages
│   ├── (dashboard)/      # Main app pages
│   │   ├── pipeline/     # Kanban view
│   │   ├── deals/        # Deal management
│   │   ├── organizations/
│   │   ├── contacts/
│   │   ├── inbox/        # Email (Phase 2)
│   │   ├── tasks/
│   │   └── settings/
│   └── api/              # API routes
├── components/
│   ├── ui/               # Base components
│   ├── pipeline/         # Kanban components
│   ├── deals/            # Deal components
│   └── shared/           # Layout, nav
├── lib/
│   ├── supabase/         # DB client
│   ├── ai/               # Claude helpers
│   └── utils/            # Utilities
└── types/                # TypeScript types
```

## Development

### Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

### Database
Migrations are in `supabase/migrations/`. Run with Supabase CLI:
```bash
supabase db push
```

### Running Locally
```bash
npm run dev
```

## Key Files

- `src/types/index.ts` - All TypeScript types
- `src/lib/ai/health-score.ts` - Health score calculation
- `src/lib/supabase/` - Database clients
- `supabase/migrations/` - Database schema

## Market Segments

| Segment | Agent Count | Deal Value |
|---------|-------------|------------|
| SMB | 1-5 | $5-15K ACV |
| Mid-Market | 6-20 | $15-50K ACV |
| Enterprise | 21-100 | $50-150K ACV |
| PE Platform | 100+ | $150K+ ACV |
| Franchisor | Corp + franchisees | $250K+ ACV |

## Rep Skill System

### Levels
- **L1 Foundation**: <3 months OR <5 deals (SMB/Voice-only)
- **L2 Established**: 5+ deals, 3+ months (SMB + Mid-Market)
- **L3 Senior**: 20+ deals, 12+ months (All segments)

### Certifications
- Voice Core, Voice Advanced
- X-RAI Performance Center, Action Hub, Accountability Hub
- AI Agents Basic, AI Agents Integrated
- CRM: FieldRoutes, PestPac, RealGreen
