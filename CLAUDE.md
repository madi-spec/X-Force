# X-FORCE Sales Platform

## Project Overview

AI-first CRM with context-first architecture for X-RAI Labs.

**Tech Stack:** Next.js, TypeScript, Supabase, Microsoft Graph API, Claude API

**Key Directories:**
- `src/lib/intelligence/` - Core AI processing (contextFirstPipeline.ts is main entry)
- `src/lib/scheduler/` - Meeting scheduling system (30 files)
- `src/lib/commandCenter/` - Action item management
- `src/app/api/` - 210 API routes

**Current Stats (from documentation audit):**
- 796 source files
- 210 API routes
- 86 database migrations
- 74 database tables
- 375 scripts

## Active Skills

| Skill | Location | Status |
|-------|----------|--------|
| Documentation Audit | `docs/skills/documentation-audit/` | Primary |
| Consolidation Audit | `docs/skills/consolidation-audit/` | After docs complete |
| Bug Investigation | `docs/skills/bug-investigation/` | For debugging |
| Performance Audit | `docs/skills/performance-audit/` | For optimization |

---

## Data Architecture: Product-Centric Model

X-FORCE uses a product-centric architecture where sales opportunities are tracked per product.

### Primary Entities

- **company_products** - Primary entity for sales/customer relationships
  - Links: company_id, product_id, current_stage_id
  - Status: `in_sales`, `in_onboarding`, `active`, `inactive`
  - Tracks MRR, stage history, ownership

- **products** - Product catalog (X-RAI 1, X-RAI 2, etc.)
  - Types: suite, addon, module
  - Each product has its own sales stages

- **product_process_stages** - Per-product pipeline stages

### Foreign Key Pattern

Tables support both legacy deals and new products during transition:
- `deal_id` - **@deprecated**, maintained for backwards compatibility
- `company_product_id` - **Preferred**, use for all new code

### For New Development

**Always use `company_product_id` instead of `deal_id` when:**
- Creating activities
- Creating tasks
- Creating transcriptions
- Creating scheduling requests
- Creating command center items

### Legacy System (Deprecated)

- **deals** table - Legacy sales opportunities (READ-ONLY for new code)
- Access via `/legacy-deals` for historical reference
- `/deals` route redirects to `/products`
- Use `deal_conversions` table for migration mapping

---

# Documentation Audit Commands

## MANDATORY: Documentation Audit Protocol

### CRITICAL INSTRUCTION

When the user says ANY of these phrases:
- "run documentation audit"
- "document the codebase"
- "generate documentation"
- "audit the code"
- "create docs"

You MUST follow this EXACT sequence. No exceptions. No improvisation.

### Step 1: READ THE SKILL FILES (REQUIRED)

Before doing ANYTHING else, read these files IN THIS ORDER:

```
1. cat docs/skills/documentation-audit/SKILL.md
2. cat docs/skills/documentation-audit/TEMPLATES.md
3. cat docs/skills/documentation-audit/GUARDRAILS.md
4. cat docs/skills/documentation-audit/VERIFICATION.md
```

DO NOT proceed until you have read ALL FOUR files.
DO NOT summarize what you think an audit should be.
DO NOT invent your own audit format.

### Step 2: CONFIRM YOU READ THEM

After reading, state:
"I have read the documentation audit skill files. The audit has 7 phases:
1. Structure Discovery
2. Database Schema
3. API Routes
4. Library Modules
5. Components
6. Workflows
7. Environment & Scripts

I will execute Phase [X] now and stop for your review before proceeding."

### Step 3: EXECUTE EXACTLY AS THE SKILL DEFINES

Follow SKILL.md exactly. Use TEMPLATES.md formats exactly.
Output to /docs/generated/ only.
Stop after each phase for user confirmation.

### PROHIBITED BEHAVIORS

❌ DO NOT create a "summary" or "overview" of documentation gaps
❌ DO NOT offer to "create documentation" without following the skill
❌ DO NOT use your own audit format
❌ DO NOT skip reading the skill files
❌ DO NOT combine phases or skip checkpoints
❌ DO NOT modify any source code files

### IF YOU CATCH YOURSELF IMPROVISING

Stop immediately. Go back to Step 1. Read the skill files.
The skill files contain the ONLY acceptable audit format.

---

## Full Audit (All 7 Phases)

When user says: "Run documentation audit" or "Document the codebase"

**Behavior:**
1. Read `/docs/skills/documentation-audit/SKILL.md` completely
2. Read `/docs/skills/documentation-audit/TEMPLATES.md` for output formats
3. Read `/docs/skills/documentation-audit/GUARDRAILS.md` for constraints
4. Read `/docs/skills/documentation-audit/VERIFICATION.md` for checklists
5. Execute Phase 1, then STOP and show results
6. Ask user: "Phase 1 complete. Ready to proceed to Phase 2?"
7. Continue only after explicit confirmation
8. Repeat for all 7 phases

**Critical Constraints:**
- NEVER modify files outside `/docs/generated/`
- NEVER "fix" code discovered during audit
- NEVER skip files or summarize without reading
- ALWAYS cite file:line for every claim
- ALWAYS complete verification checklist

---

## Single Phase Audit

When user says: "Run Phase X of documentation audit"

**Behavior:**
1. Read the skill files
2. Execute only the specified phase
3. Generate output to `/docs/generated/`
4. Complete phase verification checklist
5. Report results

**Example:**
```
User: Run Phase 4 of documentation audit
Claude: [Reads skill files, executes Phase 4: Library Modules, generates MODULES.md]
```

---

## Incremental Update

When user says: "Update documentation for [specific module/area]"

**Behavior:**
1. Read existing `/docs/generated/MANIFEST.md` to understand current state
2. Read only the specified files/modules
3. Update only the relevant sections of documentation
4. Note what changed in the changelog section

**Example:**
```
User: Update documentation for src/lib/intelligence/
Claude: [Reads current MODULES.md, reads all files in intelligence/, updates only that section]
```

---

## Documentation Diff

When user says: "What changed since last documentation?" or "Doc diff"

**Behavior:**
1. Read `/docs/generated/MANIFEST.md` to get last documented state
2. Compare against current file system
3. Report:
   - New files not documented
   - Deleted files still documented
   - Modified files (if timestamps available)
4. Ask if user wants to update documentation

---

## Checkpoints

The documentation audit has built-in checkpoints. At each checkpoint:

1. **STOP** execution
2. **SHOW** the user what was generated
3. **ASK** for confirmation before proceeding
4. **WAIT** for explicit approval

**Checkpoint Locations:**
- After Phase 1 (Structure Discovery)
- After Phase 2 (Database Schema)
- After Phase 3 (API Routes)
- After each `src/lib/` subdirectory in Phase 4
- After Phase 5 (Components)
- After each workflow in Phase 6
- After Phase 7 (Environment & Scripts)

---

## Error Recovery

If documentation fails mid-phase:

1. Report exactly where it failed and why
2. Show what was completed before failure
3. Save partial output with `[INCOMPLETE]` marker
4. Ask user how to proceed:
   - Retry the failed step
   - Skip and continue
   - Abort audit

---

## Output Locations

All documentation outputs go to `/docs/generated/`:

```
docs/generated/
├── MANIFEST.md          # Phase 1: File structure
├── DATABASE.md          # Phase 2: Schema documentation
├── API.md               # Phase 3: API reference
├── MODULES.md           # Phase 4: Library documentation
├── COMPONENTS.md        # Phase 5: Component documentation
├── WORKFLOWS.md         # Phase 6: Flow diagrams
├── ENVIRONMENT.md       # Phase 7: Env vars
├── SCRIPTS.md           # Phase 7: Script reference
└── AUDIT-LOG.md         # Metadata about the audit
```

---

## Anti-Pattern Detection

If Claude Code attempts any of these, it should immediately stop and report:

- ❌ Opening a file for editing outside /docs/generated/
- ❌ Suggesting code changes during documentation
- ❌ Skipping files without explicit user approval
- ❌ Making claims without file:line citations
- ❌ Using phrases like "probably", "likely", "seems like" without `[UNCERTAIN]` tag
- ❌ Generating documentation for files it hasn't actually read

---

# Consolidation Audit Commands

## Prerequisites Check

Before running consolidation audit, verify documentation exists:

```
Required files:
- /docs/generated/MANIFEST.md
- /docs/generated/DATABASE.md
- /docs/generated/API.md
- /docs/generated/MODULES.md
- /docs/generated/COMPONENTS.md
- /docs/generated/WORKFLOWS.md

If any are missing, run documentation audit first.
```

---

## Full Consolidation Audit

When user says: "Run consolidation audit" or "Find duplicate code"

**Behavior:**
1. Read `/docs/skills/consolidation-audit/SKILL.md` completely
2. Read `/docs/skills/consolidation-audit/TEMPLATES.md` for output formats
3. Verify documentation audit files exist
4. Execute Phase 1 (Domain Identification), then STOP
5. Ask user: "I've identified X domains with potential duplicates. Review and confirm before I analyze each."
6. For each domain, execute Phase 2-5, then STOP
7. Ask user: "Domain analysis complete. Ready for next domain?"
8. After all domains, generate MIGRATION-ORDER.md

**Critical Constraints:**
- NEVER modify source files
- NEVER consolidate code during the audit
- ALWAYS provide evidence for duplicate claims
- ALWAYS trace consumers before recommending deletion
- ALWAYS generate migration plans, not execute them

---

## Single Domain Analysis

When user says: "Analyze [domain] for duplicates" or "Consolidation audit for scheduler"

**Behavior:**
1. Read the skill files
2. Focus only on the specified domain
3. Generate [DOMAIN]-PLAN.md
4. Do NOT analyze other domains

**Example:**
```
User: Analyze scheduler for duplicates
Claude: [Searches for all scheduler-related code]
        [Identifies canonical version]
        [Maps all duplicates with evidence]
        [Generates SCHEDULER-PLAN.md]
```

---

## Quick Duplicate Scan

When user says: "Quick scan for duplicates" or "How much duplicate code do I have?"

**Behavior:**
1. Read MANIFEST.md and MODULES.md
2. Identify obvious duplicates by name patterns
3. Provide summary without full analysis
4. Offer to run full audit for details

**Output:**
```
Quick Scan Results:
- Scheduler: 4 potential duplicate locations
- Entity Matching: 3 potential duplicate locations  
- Email: 2 potential duplicate locations

Run full consolidation audit for detailed analysis and migration plans.
```

---

## Generate Migration Plan Only

When user says: "Create migration plan for [domain]" (after analysis exists)

**Behavior:**
1. Read existing [DOMAIN]-ANALYSIS.md
2. Generate detailed migration steps
3. Include verification checkpoints
4. Output [DOMAIN]-PLAN.md

---

## Consolidation Output Locations

All consolidation outputs go to `/docs/generated/consolidation/`:

```
docs/generated/consolidation/
├── DOMAIN-ANALYSIS.md       # Summary of all domains
├── SCHEDULER-PLAN.md        # Scheduler consolidation plan
├── ENTITY-MATCHING-PLAN.md  # Entity matching plan
├── [DOMAIN]-PLAN.md         # One per domain
├── MIGRATION-ORDER.md       # Recommended order
└── DEPENDENCY-MAP.md        # Full dependency graph
```

---

## Consolidation Checkpoints

The consolidation audit has built-in checkpoints:

1. **After Phase 1:** Confirm domain list is complete
2. **After each domain analysis:** Review duplicates found
3. **After canonical selection:** Confirm the right version is chosen
4. **After consumer mapping:** Verify all consumers identified
5. **After migration plan:** Approve before any execution

**NEVER proceed past a checkpoint without explicit user confirmation.**

---

## Key Differences from Documentation Audit

| Aspect | Documentation Audit | Consolidation Audit |
|--------|--------------------|--------------------|
| Input | Source code | Documentation + Source code |
| Output | What exists | What to change |
| Action | Describe | Plan (not execute) |
| Scope | Everything | Duplicates only |

---

## Integration with Documentation

The consolidation audit READS from documentation:

```
MODULES.md → Module exports and dependencies
API.md → Route handlers and their imports  
COMPONENTS.md → Component dependencies
WORKFLOWS.md → Data flow patterns
```

If documentation is outdated:
1. Note which parts are stale
2. Recommend re-running specific documentation phases
3. Proceed with caution, flagging uncertainty

---

## Executing Migration Plans

**The consolidation audit generates plans. It does NOT execute them.**

To execute a migration plan:

```
User: Execute the scheduler consolidation plan

Claude: I'll execute the SCHEDULER-PLAN.md step by step.

Step 1 of 7: Update canonical exports
[Shows exact changes to make]
Should I make this change? (yes/no)

User: yes

Claude: [Makes change]
Step 1 complete. Verify by running: [test command]
Ready for Step 2? (yes/no)
```

Each step requires explicit approval. No batch execution.

---

## Error Recovery

If consolidation causes issues:

1. **Identify which step failed**
2. **Rollback that specific change:** `git checkout -- [file]`
3. **Re-analyze:** The duplicate might have hidden consumers
4. **Update plan:** Add the missing consumer to migration steps
5. **Retry:** With updated plan

---

# Bug Investigation Commands

## Full Investigation

When user says: "Investigate bug:" or "Debug:" or "Why is [X] happening?"

**Behavior:**
1. Read `/docs/skills/bug-investigation/SKILL.md`
2. Read `/docs/skills/bug-investigation/TEMPLATES.md`
3. Execute all 8 phases:
   - Phase 1: Capture symptom
   - Phase 2: Identify entry point
   - Phase 3: Trace data flow
   - Phase 4: Form hypotheses
   - Phase 5: Inspect code
   - Phase 6: Determine root cause
   - Phase 7: Recommend fix
   - Phase 8: Check related issues
4. Output investigation report to `/docs/investigations/`

**Critical Constraints:**
- NEVER modify code during investigation
- NEVER guess without evidence
- ALWAYS trace the full data flow
- ALWAYS cite file:line for findings
- ALWAYS check for related issues with same pattern

---

## Quick Trace

When user says: "Trace [feature]" or "How does [X] work?" or "What's the flow for [Y]?"

**Behavior:**
1. Read skill files
2. Execute Phases 2-3 only (entry point + data flow)
3. Output flow diagram with step-by-step trace
4. Do NOT investigate bugs or suggest fixes

**Example:**
```
User: Trace the scheduler email flow
Claude: [Reads docs, traces from API entry through email send]
        [Outputs mermaid diagram + detailed steps]
```

---

## Error Analysis

When user says: "What causes this error:" or pastes a stack trace

**Behavior:**
1. Parse the error message and stack trace
2. Identify the file/line where error originated
3. Trace backwards to find root cause
4. Check if error handling is missing
5. Suggest specific fix location

**Example:**
```
User: What causes this error:
      TypeError: Cannot read property 'email' of undefined
      at sendSchedulerEmail (emailSender.ts:45)
      
Claude: [Parses stack trace]
        [Finds emailSender.ts:45]
        [Traces what passes data to this function]
        [Identifies where undefined comes from]
```

---

## Pattern Search

When user says: "Find all [pattern]" or "Where else does [X] happen?"

**Behavior:**
1. Search codebase for the pattern
2. Categorize by risk level (HIGH/MEDIUM/LOW)
3. List all occurrences with file:line
4. Recommend priority order for fixes

**Example:**
```
User: Find all places with missing error handling around Graph API calls
Claude: [Searches for graphClient usage without try/catch]
        [Lists all occurrences]
        [Ranks by risk]
```

---

## Investigation Output

Investigation reports go to `/docs/investigations/`:

```
docs/investigations/
├── BUG-2025-01-15-001-scheduler-duplicate-emails.md
├── BUG-2025-01-16-002-entity-matching-null.md
└── ...
```

---

## Using Documentation for Investigation

The investigation uses your generated docs:

| Need to find... | Check... |
|-----------------|----------|
| File structure | MANIFEST.md |
| Function signatures | MODULES.md |
| API request/response | API.md |
| Component data flow | COMPONENTS.md |
| End-to-end flows | WORKFLOWS.md |
| Table relationships | DATABASE.md |
| Module dependencies | DEPENDENCY-MAP.md |

---

## Investigation Checkpoints

1. **After symptom capture:** Confirm understanding with user
2. **After data flow trace:** Verify trace is complete
3. **After hypotheses:** Validate before deep inspection
4. **After root cause:** Confirm with user before suggesting fix

---

# Performance Audit Commands

## Full Performance Audit

When user says: "Run performance audit" or "Why is the app slow?" or "Optimize performance"

**Behavior:**
1. Read `/docs/skills/performance-audit/SKILL.md`
2. Read `/docs/skills/performance-audit/TEMPLATES.md`
3. Execute all 5 phases:
   - Phase 1: Database Performance
   - Phase 2: API Layer Performance
   - Phase 3: Server Rendering Performance
   - Phase 4: Client Rendering Performance
   - Phase 5: Bundle & Assets Performance
4. Generate executive summary and detailed reports
5. Output to `/docs/generated/performance/`

**Critical Constraints:**
- NEVER modify code during audit
- ALWAYS measure/estimate impact before recommending
- ALWAYS prioritize by effort vs impact
- ALWAYS cite file:line for issues

---

## Single Layer Audit

When user says: "Audit database performance" or "Check API performance" or "Audit React rendering"

**Behavior:**
1. Read skill files
2. Execute only the specified phase
3. Generate layer-specific report

**Examples:**
```
User: Audit database performance
Claude: [Analyzes indexes, N+1 queries, RLS policies]
        [Generates DATABASE-PERFORMANCE.md]

User: Why is React rendering slow?
Claude: [Analyzes re-renders, memoization, virtualization]
        [Generates CLIENT-PERFORMANCE.md]
```

---

## Specific Performance Issue

When user says: "Why is [page/component/endpoint] slow?"

**Behavior:**
1. Identify the layer (database, API, client)
2. Trace the performance bottleneck
3. Provide specific fix with estimated impact

---

## Find Performance Patterns

When user says:
- "Find all N+1 queries"
- "Find missing indexes"
- "Find unnecessary re-renders"
- "What's making the bundle large?"

**Behavior:**
1. Search codebase for the specific pattern
2. List all occurrences with file:line
3. Prioritize by impact
4. Suggest fixes

---

## Performance Output Location

```
docs/generated/performance/
├── PERFORMANCE-AUDIT.md      # Executive summary
├── DATABASE-PERFORMANCE.md   # Database issues
├── API-PERFORMANCE.md        # API layer issues
├── SERVER-PERFORMANCE.md     # Next.js server issues
├── CLIENT-PERFORMANCE.md     # React rendering issues
├── BUNDLE-PERFORMANCE.md     # Bundle size issues
└── OPTIMIZATION-PLAN.md      # Prioritized fix plan
```

---

## Performance Priority Matrix

Always categorize by effort vs impact:

```
🟢 DO NOW:     High impact + Low effort
🟡 SCHEDULE:   High impact + High effort
🟡 LATER:      Low impact + Low effort  
🔴 SKIP:       Low impact + High effort
```

## AI Prompts: Database-First Policy

**CRITICAL: All AI prompts MUST be stored in the database, not hardcoded.**

### The Rule
Every prompt used with Claude (or any AI provider) must:
1. Be stored in the `ai_prompts` table
2. Be fetched via `getPrompt()` or `getPromptWithVariables()` from `@/lib/ai/promptManager`
3. Have a unique `key` that describes its purpose
4. Include model/max_tokens configuration in the database

### Why This Matters
- Prompts can be edited via Settings > AI Prompts without code changes
- Version history tracks all changes
- Product-specific overrides (e.g., `email_followup_stalled__pest-control`)
- Model/token tuning per prompt

### Correct Pattern
```typescript
import { getPrompt, getPromptWithVariables } from '@/lib/ai/promptManager';

// Option 1: Get full prompt config
const promptConfig = await getPrompt('email_analysis');
if (!promptConfig) {
  throw new Error('Prompt not found: email_analysis');
}

const response = await anthropic.messages.create({
  model: promptConfig.model,
  max_tokens: promptConfig.max_tokens,
  messages: [{ role: 'user', content: promptConfig.prompt_template }],
});

// Option 2: With variable substitution
const { prompt, schema, model, maxTokens } = await getPromptWithVariables(
  'meeting_analysis',
  {
    title: meeting.title,
    transcription: meeting.content,
  }
);
```

### NEVER Do This
```typescript
// ❌ WRONG: Hardcoded prompt
const prompt = `You are a sales assistant. Analyze this email...`;

// ❌ WRONG: Inline fallback
const prompt = promptConfig?.prompt_template || `Fallback prompt here...`;

// ❌ WRONG: Constants at top of file
const SYSTEM_PROMPT = `You are an expert...`;
```

### What To Do Instead of Fallbacks

If a prompt is missing from the database, **fail loudly**:
```typescript
const promptConfig = await getPrompt('my_prompt_key');
if (!promptConfig) {
  throw new Error(
    `Missing database prompt: my_prompt_key. ` +
    `Add it via Settings > AI Prompts or run the migration.`
  );
}
```

### Creating New Prompts

When you need a new AI capability:

1. **Create a migration** to add the prompt to `ai_prompts`:
```sql
INSERT INTO ai_prompts (key, name, description, prompt_template, model, max_tokens, category)
VALUES (
  'my_new_prompt',
  'My New Feature',
  'Describes what this prompt does',
  'Your prompt template with {{variables}}',
  'claude-sonnet-4-20250514',
  2000,
  'general'
);
```

2. **Use the prompt manager** in your code:
```typescript
const config = await getPrompt('my_new_prompt');
```

3. **Never create fallbacks** - if the migration hasn't run, the code should fail clearly.

### Prompt Key Naming Convention

- Use snake_case
- Format: `{domain}_{action}_{variant?}`
- Examples:
  - `email_analysis` - Analyze email threads
  - `email_draft` - Generate email drafts
  - `meeting_analysis` - Analyze meeting transcripts
  - `scheduler_email_system` - System prompt for scheduler emails
  - `email_followup_stalled__pest-control` - Product-specific override

### Existing Prompt Keys (Reference)

Check the database for current keys, but common ones include:
- `core_system` - Default system prompt
- `email_analysis` - Thread analysis
- `email_draft` - Reply generation
- `meeting_analysis` - Transcript analysis
- `scheduling_detection` - Detect scheduling intent
- `strategy_generation` - Company strategy
- `research_agent_v61` - Research agent system prompt

---

# Design System

## The Palette: Surgical Grayscale with Semantic Pops

### Gray Foundation (90% of UI)

```
Background:   #FAFAFA (gray-50)  - The canvas
Surface:      #FFFFFF            - Cards, modals
Border:       #E5E7EB (gray-200) - Subtle definition
Border Dark:  #D1D5DB (gray-300) - Active states
Text Primary: #111827 (gray-900) - Headlines
Text Body:    #374151 (gray-700) - Readable content
Text Muted:   #6B7280 (gray-500) - Labels, hints
Text Faint:   #9CA3AF (gray-400) - Placeholders
```

### Semantic Colors (The 10% That Matters)

```
Success:  #10B981 (emerald-500) - Won, complete, positive
Warning:  #F59E0B (amber-500)   - Attention, medium risk
Danger:   #EF4444 (red-500)     - Lost, error, high risk
Info:     #3B82F6 (blue-500)    - Links, interactive (RARE)
```

### The Cardinal Rule

**Gray is the default. Color is the exception.** Every colored element must earn its color through semantic meaning.

---

## Typography: The Swiss Precision

### Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

**Why Inter?** Designed for screens, excellent number legibility, free.

### The Type Scale

```
text-xs   (12px) - Labels, badges, captions
text-sm   (14px) - Body text, table cells
text-base (16px) - Standard paragraphs
text-lg   (18px) - Subheadings
text-xl   (20px) - Section headers
text-2xl  (24px) - Page titles
text-3xl  (30px) - Hero metrics
```

### Weight Restraint

- **400 (Normal)**: Body text - Let content breathe
- **500 (Medium)**: Interactive elements - Buttons, links
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