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

---

# Design System Bible: Technical Truth + Emotional Resonance

## Executive Summary: The Design DNA

**"Accessible Sophistication"** - Enterprise-grade data visualization that transcends typical B2B SaaS.

**The Essence**: "McKinsey meets Apple meets Stripe" - minimalism with purpose, beauty through utility.

**North Star**: Would a Swiss watchmaker approve?

## Core Identity

- **"Boardroom Minimalism"** - Every pixel presentable to the C-suite
- **"Quiet Professional"** - Sophisticated business intelligence meets approachable simplicity
- **"Bloomberg Terminal meets Breathing Room"** - Professional density with modern spacing
- **"The Hermès of SaaS"** - Quietly luxurious, never ostentatious

## Color System (HSL)

### Light Mode
```css
--background: 0 0% 100%;        /* #FFFFFF */
--foreground: 0 0% 3.9%;        /* #0A0A0A (NOT pure black) */
--muted: 0 0% 96.1%;            /* #F5F5F5 */
--muted-foreground: 0 0% 45.1%; /* #737373 */
--border: 0 0% 89.8%;           /* #E5E5E5 */
```

### Dark Mode
```css
--background: 0 0% 3.9%;        /* #0A0A0A */
--foreground: 0 0% 98%;         /* #FAFAFA (NOT pure white) */
--muted: 0 0% 14.9%;            /* #262626 */
--border: 0 0% 14.9%;           /* #262626 */
```

### Semantic Colors
- **Success**: `#10B981` (Emerald-500)
- **Warning**: `#F59E0B` (Amber-500)
- **Error**: `#EF4444` (Red-500)
- **Primary**: `#3B82F6` (Blue-500)
- **Accent**: `#8B5CF6` (Violet-500)

### Chart Palette
```css
--chart-1: 12 76% 61%;   /* #E85D4F - Coral */
--chart-2: 173 58% 39%;  /* #2A9D8F - Teal */
--chart-3: 197 37% 24%;  /* #264653 - Navy */
--chart-4: 43 74% 66%;   /* #E9C46A - Yellow */
--chart-5: 27 87% 67%;   /* #F4A261 - Orange */
```

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Type Scale
| Purpose | Class | Size |
|---------|-------|------|
| Display | text-3xl | 30px |
| Title | text-xl | 20px |
| Heading | text-base | 16px |
| Body | text-sm | 14px |
| Caption | text-xs | 12px |
| Micro | text-[10px] | 10px |

### Font Weights
- **300 (Light)**: Large metric values
- **400 (Normal)**: Body text
- **500 (Medium)**: Labels, secondary headers
- **600 (Semibold)**: Primary headers
- **700 (Bold)**: Critical values only - SPARINGLY

### Key Details
- `tracking-tight` on large numbers
- `tracking-wider` on UPPERCASE labels
- Tabular figures for all numbers
- `text-xl font-normal` for page headers (NOT bold)

## Spacing System (4-8px Grid)

```
p-1 (4px)  - Micro spacing
p-2 (8px)  - Tight (icons to text)
p-3 (12px) - Compact (list items)
p-4 (16px) - Default padding
p-6 (24px) - Comfortable (cards)
p-8 (32px) - Spacious (sections)

gap-4 (16px) - Default grid gaps
gap-6 (24px) - Section spacing
```

**Rule**: Everything is 4px multiples. No 5px, 7px, or 15px. EVER.

## Component Patterns

### Card Anatomy
```jsx
<Card className="
  bg-white dark:bg-[#1a1a1a]
  rounded-xl              // 12px radius
  p-6                     // 24px padding
  border border-gray-200 dark:border-[#2a2a2a]
  shadow-sm
  hover:shadow-md
  hover:-translate-y-1
  hover:scale-[1.02]
  transition-all duration-300
">
```

### Table Design
- NO zebra striping
- Horizontal borders only (`border-b`)
- Hover: `hover:bg-gray-50 dark:hover:bg-gray-800/50`
- Cell padding: `py-3 px-4`
- Headers: `uppercase text-xs tracking-wider text-gray-500`

### Button Hierarchy
```jsx
// Primary
<Button className="h-9 px-4 text-sm">

// Secondary
<Button variant="outline" className="h-9 px-4 text-sm">

// Ghost
<Button variant="ghost" size="icon" className="h-8 w-8">
```

### Universal Header Pattern
```jsx
<div className="sticky top-0 z-50 bg-white/95 backdrop-blur">
  <h1 className="text-xl font-normal">Page Title</h1>
  <p className="text-xs text-gray-500">Description</p>
  <div className="ml-auto flex gap-4">Filters</div>
</div>
```

## Animation

### Timing
```css
transition-colors duration-200  /* Quick feedback */
transition-all duration-300     /* Standard */
transition-all duration-700     /* Data animations */
animate-pulse                   /* Loading */
```

### Easing
`cubic-bezier(0.4, 0, 0.2, 1)` - Natural, iOS-like

### Rules
- Only animate: `opacity`, `transform`, `scale`
- Never animate: `width`, `height`, `padding`

## The 1% Details

1. **Numbers**: `6,350` not `6350` or `6.4K`
2. **Percentages**: `.X%` never `.XX%`
3. **Icons**: 20px with 2px stroke
4. **Border Radius**: 12px (`rounded-xl`) consistently
5. **Shadows**: `shadow-sm` default, `shadow-md` on hover
6. **Transitions**: 300ms standard
7. **Touch Targets**: Minimum 44px

## The 10 Commandments

1. **Data First** - Never let aesthetics obscure information
2. **Monochrome Until Meaningful** - Color only for semantic purpose
3. **Space Is Functional** - White space improves scanning
4. **Consistency Builds Trust** - Same pattern everywhere
5. **Motion Has Meaning** - Animate to improve understanding
6. **Restraint Shows Confidence** - What you don't add matters
7. **Performance Is Design** - Fast is beautiful
8. **Accessibility Is Baseline** - Not an afterthought
9. **Details Make Premium** - The 1% differentiates
10. **Evolution Not Revolution** - Iterate thoughtfully

## Quality Checklist

Before shipping any feature:
- [ ] Would Dieter Rams find anything superfluous?
- [ ] Would a Stripe engineer trust this data?
- [ ] Would McKinsey present this to Fortune 500?
- [ ] Does dark mode feel equally polished?
- [ ] Are loading states as designed as loaded states?

## Anti-Patterns

- **NOT Salesforce**: No visual noise or tab overload
- **NOT "Startup Playful"**: No particle effects or gradients
- **NOT "Enterprise Gray"**: Sophisticated, not depressing
- **NOT "Dashboard Template"**: Custom crafted, not generic

---

**The Ultimate Test**: "Would this fit in a Kinfolk magazine spread about the future of work?"

**Guard this aesthetic with your life.**
