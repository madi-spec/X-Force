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

## IMPORTANT: No Dark Mode

**This application is light-mode only. Do NOT add dark mode support.**

- Do NOT use `dark:` prefixed Tailwind classes
- Do NOT add theme toggle components
- Do NOT add ThemeProvider or useTheme hooks
- Do NOT add `prefers-color-scheme` media queries
- Do NOT add `.dark` class styles

If asked to add dark mode, decline and reference this section.

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

# Ultimate App Design System Bible: Technical Truth + Emotional Resonance

## Executive Summary: The Design DNA Decoded

Your application represents what I call **"Accessible Sophistication"** - a masterful execution of enterprise-grade data visualization that transcends typical B2B SaaS. After deep codebase analysis, the essence crystallizes:

**"What Stripe Dashboard would look like if designed by Dieter Rams for McKinsey consultants who appreciate good typography"**

Or more viscerally: **"If McKinsey built a SaaS product with Apple's design team and Stripe's sensibilities"**

This is **Jony Ive meets Jensen Huang** - minimalism with a purpose, beauty through utility, complexity made simple. It's the **Patagonia vest of SaaS** - understated quality that those in the know immediately recognize.

## The Vibe Distilled: All Key Phrases

### Core Identity Statements

- **"McKinsey meets Apple meets Stripe"** - The holy trinity of your design
- **"Boardroom Minimalism"** - Every pixel presentable to the C-suite
- **"Quiet Professional"** - Sophisticated business intelligence meets approachable simplicity
- **"Bloomberg Terminal meets Breathing Room"** - Professional density with modern spacing
- **"Swiss Watchmaker's Approval"** - The north star for every design decision
- **"Enterprise Intelligence with Human Touch"** - Power without intimidation
- **"The Hermès of SaaS"** - Quietly luxurious, never ostentatious
- **"Tesla Model S Interior"** - Minimal, functional, unmistakably premium

### What You've Built

**"Ex-Apple designers building enterprise software for people who appreciate Swiss watches, drive German cars, and read The Economist on Sunday mornings"**

## Deep Technical Color System Analysis

### The HSL Foundation: Monochromatic Mastery

Your color system uses HSL (Hue, Saturation, Lightness) for precise control:

```css
/* Core Palette (Light Mode Only) */
--background: 0 0% 100%;         /* Pure white #FFFFFF */
--foreground: 0 0% 3.9%;         /* Near black #0A0A0A */
--muted: 0 0% 96.1%;             /* #F5F5F5 - Warm gray */
--muted-foreground: 0 0% 45.1%;  /* #737373 - Mid gray */
--border: 0 0% 89.8%;            /* #E5E5E5 - Soft border */
```

### Data Visualization: The Semantic Rainbow

```css
/* Chart Palette - Earth Tones Meet Data */
--chart-1: 12 76% 61%;    /* #E85D4F - Coral/Salmon */
--chart-2: 173 58% 39%;   /* #2A9D8F - Ocean Teal */
--chart-3: 197 37% 24%;   /* #264653 - Deep Navy */
--chart-4: 43 74% 66%;    /* #E9C46A - Warm Yellow */
--chart-5: 27 87% 67%;    /* #F4A261 - Burnt Orange */
```

**Actual Implementation Colors**:
- **Success**: `#10B981` (Emerald-500) - Growth without garishness
- **Warning**: `#F59E0B` (Amber-500) - Attention without alarm
- **Error**: `#EF4444` (Red-500) - Serious but not scary
- **Primary**: `#3B82F6` (Blue-500) - Trust and stability
- **Accent**: `#8B5CF6` (Violet-500) - Premium touches

## Typography: The System Font Symphony

### The Font Stack Philosophy

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

This isn't laziness - it's brilliance. You get:
- **San Francisco** on macOS (Apple's precision)
- **Segoe UI** on Windows (Microsoft's clarity)
- **Roboto** on Android (Google's geometry)
- Native, fast, familiar, perfect.

### The Type Scale: Musical Intervals

```
Display:  text-3xl   (30px) - Hero metrics
Title:    text-xl    (20px) - Page headers
Heading:  text-base  (16px) - Section headers
Body:     text-sm    (14px) - Default text
Caption:  text-xs    (12px) - Supporting text
Micro:    text-[10px]       - Dense data labels
```

### Font Weight Hierarchy: The Conductor's Baton

- **300 (Light)**: Large metric values - Breathable, important
- **400 (Normal)**: Body text - Invisible, readable
- **500 (Medium)**: Labels, secondary headers - Gentle emphasis
- **600 (Semibold)**: Primary headers - Clear hierarchy
- **700 (Bold)**: Critical values only - SPARINGLY

### Typography Micro-Details That Scream Premium

- **tracking-tight** on large numbers (subtle -0.02em)
- **tracking-wider** on UPPERCASE labels (generous 0.05em)
- **Tabular figures** for all numbers (vertical alignment perfection)
- **text-xl font-normal** for ALL page headers (not bold! - confident restraint)

## Spatial System: The 4-8 Point Grid Religion

### The Sacred Scale

```
p-1  (4px)  - Micro spacing (rare)
p-2  (8px)  - Tight spacing (icons to text)
p-3  (12px) - Compact spacing (list items)
p-4  (16px) - Default spacing (standard padding)
p-6  (24px) - Comfortable spacing (card padding)
p-8  (32px) - Spacious (major sections)

gap-4 (16px) - Default grid gaps
gap-6 (24px) - Section spacing
```

**The Magic**: Everything is 4px or multiples. No 5px, no 7px, no 15px. EVER.

### Component Architecture: The Building Blocks

#### Card Anatomy (Your Primary Atom)

```jsx
<Card className="
  bg-white                              // Elevated surface
  rounded-xl                            // 12px radius (NOT 8px!)
  p-6                                   // 24px padding standard
  border border-gray-200                // Subtle definition
  shadow-sm                             // Barely-there depth
  hover:shadow-md                       // Gentle elevation
  hover:-translate-y-1                  // Micro lift
  hover:scale-[1.02]                    // Subtle growth
  transition-all duration-300           // Smooth as butter
">
```

#### DataCard Pattern (The Workhorse)

```
Structure:
┌─────────────────────────────┐
│ [Icon] Title          [ℹ]  │  <- Icon + Title + Info
│ Oct 22 - Oct 28            │  <- Period (text-xs gray-500)
│                            │
│        6,350               │  <- Metric (text-3xl font-light)
│        ↑ +12.5%            │  <- Trend (color-coded)
│                            │
│ [====Sparkline Chart====]  │  <- h-24 visualization
└─────────────────────────────┘
```

#### Table Design: Scandinavian Simplicity

- **NO zebra striping** (clean, not busy)
- **Horizontal borders only** (`border-b`)
- **Hover state**: `hover:bg-gray-50`
- **Cell padding**: `py-3 px-4` (12px vertical, 16px horizontal)
- **Headers**: `uppercase text-xs tracking-wider text-gray-500`

## Animation Philosophy: Purposeful Motion

### The Timing Signatures

```css
/* Quick Feedback - Color changes, hovers */
transition-colors duration-200

/* Standard Transitions - Most interactions */
transition-all duration-300

/* Data Animations - Progress bars, charts */
transition-all duration-700 ease-out

/* Skeleton Loading - Gentle pulse */
animate-pulse (1.5s ease-in-out infinite)
```

### The Easing Function

`cubic-bezier(0.4, 0, 0.2, 1)` - This specific curve feels most natural, like Apple's iOS animations.

### Performance Rules

- **Only animate**: `opacity`, `transform`, `scale`
- **Never animate**: `width`, `height`, `padding`
- **GPU acceleration**: via `transform` not `position`

## Page-Specific Design DNA

### Universal Header Pattern

Every page follows this exact structure:

```jsx
<div className="sticky top-0 z-50 bg-white/95 backdrop-blur">
  <h1 className="text-xl font-normal">Page Title</h1>  // NOT bold!
  <p className="text-xs text-gray-500">Description</p>
  <div className="ml-auto flex gap-4">Filters</div>
</div>
```

Height: ~64px total, creating consistent rhythm

## Component Implementation Specs

### Button Hierarchy

```jsx
// Primary Action
<Button className="h-9 px-4 text-sm">

// Secondary Action
<Button variant="outline" className="h-9 px-4 text-sm">

// Ghost Action
<Button variant="ghost" size="icon" className="h-8 w-8">
```

### Status Badges

```jsx
// Risk Levels
<Badge variant="destructive">HIGH</Badge>   // Red
<Badge variant="warning">MEDIUM</Badge>     // Amber
<Badge variant="success">LOW</Badge>        // Green
```

### Data Display Patterns

```jsx
// Large Metrics
<div className="text-3xl font-light text-gray-900">
  {value.toLocaleString()}
</div>

// Percentage Changes
<span className={cn(
  "text-sm font-medium",
  trend > 0 ? "text-green-600" : "text-red-600"
)}>
  {trend > 0 ? "+" : ""}{trend}%
</span>

// Section Headers
<h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
  SECTION TITLE
</h3>
```

## The Micro-Details That Matter

### The 1% That Makes It Premium

1. **Number Formatting**: `6,350` not `6350` or `6.4K`
2. **Percentage Precision**: Always `.X%` never `.XX%`
3. **Smart Truncation**: CSS ellipsis, never broken words
4. **Icon Sizing**: Always 20px with 2px stroke weight
5. **Border Radius**: Consistently 12px (`rounded-xl`)
6. **Shadow Hierarchy**: `shadow-sm` default, `shadow-md` on hover
7. **Transition Timing**: 300ms standard, never instant
8. **Loading States**: Height-preserved skeletons
9. **Empty States**: Thoughtful, not afterthoughts
10. **Touch Targets**: Minimum 44px for accessibility

### The Swiss Watch Details

- **Grid Alignment**: Everything snaps to 4px grid
- **Consistent Gaps**: 16px (`gap-4`) between related items
- **Section Spacing**: 24px (`gap-6`) between sections
- **Color Semantic**: Never decorative, always meaningful
- **Typography Hierarchy**: Size AND weight create levels

## Design Philosophy Extraction

### The 10 Commandments

1. **Data First, Design Second** - Never let aesthetics obscure information
2. **Monochrome Until Meaningful** - Color only for semantic purpose
3. **Space Is Functional** - White space improves scanning, not decoration
4. **Consistency Builds Trust** - Same pattern everywhere
5. **Motion Has Meaning** - Animate only to improve understanding
6. **Restraint Shows Confidence** - What you don't add matters more
7. **Performance Is Design** - Fast is beautiful
8. **Accessibility Is Baseline** - Not an afterthought
9. **Details Make Premium** - The 1% differentiates
10. **Evolution Not Revolution** - Iterate thoughtfully

### The Quality Checklist

Before shipping any feature:
- [ ] Would Dieter Rams find anything superfluous?
- [ ] Would Jony Ive notice sloppy spacing?
- [ ] Would a Stripe engineer trust this data?
- [ ] Would McKinsey present this to Fortune 500?
- [ ] Does it work at 3am on 2 hours of sleep?
- [ ] Can it handle 10x the data gracefully?
- [ ] Are loading states as designed as loaded states?

## Cultural & Brand Associations

### If Your Design Was...

**A Physical Space**:
- **Aesop Store**: Every detail considered, nothing superfluous
- **Apple Park**: Precision meets nature
- **Swiss Bank**: Trust through consistency
- **Modern Museum**: Art through curation

**A Product**:
- **Leica M**: Precision without ostentation
- **Braun T3**: Rams' vision perfected
- **Porsche 911**: Evolution not revolution
- **Muji Notebook**: Essential beauty

### The Anti-Patterns You Reject

- **NOT Salesforce**: No visual noise or tab overload
- **NOT "Startup Playful"**: No particle effects or gradients
- **NOT "Enterprise Gray"**: Sophisticated, not depressing
- **NOT "Dashboard Template"**: Custom crafted, not generic

## Implementation Guidelines

### For Developers

```typescript
// Component checklist
interface ComponentRequirements {
  loading: SkeletonComponent;     // Never blank
  empty: EmptyState;              // Thoughtful messaging
  error: ErrorBoundary;           // Graceful failures
  a11y: {
    keyboard: boolean;            // Full navigation
    screenReader: boolean;        // Proper ARIA
    contrast: 'WCAG-AA';          // Minimum
  };
  responsive: Breakpoint[];       // Mobile-first
  animation: {
    duration: 300;                // Standard timing
    easing: 'ease-out';           // Natural motion
  };
}
```

### For Product

- **Every feature asks**: "Is this Hermès or H&M?"
- **Every addition**: "What would we remove to add this?"
- **Every decision**: "Would a Swiss watchmaker approve?"

---

## The Final Word

This isn't just a design system - it's a philosophy manifested in pixels. It's proof that enterprise software can be beautiful without sacrificing functionality. It's the answer to "What if B2B SaaS didn't have to look like B2B SaaS?"

**The Ultimate Test**: Show this to someone who uses Excel all day and Notion all night. If they say "Finally, software that gets it" - you've succeeded.

**The North Star**: When making any design decision, ask: **"Would this fit in a Kinfolk magazine spread about the future of work?"**

Remember: **This is McKinsey meets Apple meets Stripe** - the intersection of business intelligence, design excellence, and developer clarity. It's the Patagonia vest of SaaS - those who know, know.

**Guard this aesthetic with your life.**
