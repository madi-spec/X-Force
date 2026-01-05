# X-FORCE AI Sales System - Implementation Guide

## Overview

This document guides implementation of the AI Sales System extensions to X-FORCE. Read the companion document `X-FORCE-Complete-System-Reference.md` for full architecture details.

**Key Principle:** We are EXTENDING an existing CRM, not building from scratch.

---

## What Already Exists

The X-FORCE CRM already has:
- Core tables: `companies`, `contacts`, `deals`, `activities`, `users`
- AI infrastructure: `lib/ai/` with aiClient, contextBuilder
- Integrations: Fireflies (transcripts), Microsoft (email/calendar)
- AI Prompts settings page
- Basic health scoring

---

## Implementation Phases

### Phase 1: Database & Deal Intelligence

**Goal:** Add new tables and create the Deal Intelligence Engine.

**New Tables to Add:**
- `ai_roles` - Categories of AI agents
- `ai_jobs` - Editable prompts
- `computed_trigger_jobs` - Map triggers to jobs
- `ai_job_runs` - Execution history
- `deal_intelligence` - Computed deal state
- `company_research` - Research cache
- `account_memory` - What we've learned per account
- `account_memory_updates` - Audit trail
- `human_leverage_moments` - The killer feature
- `rep_trust_profiles` - Hidden rep behavior tracking
- `ai_overrides` - When humans disagree
- `trigger_accuracy` - Calibration data
- `deal_postmortems` - Win/loss analysis
- `pattern_learnings` - What works by segment

**Files to Create:**
```
lib/ai/intelligence/
├── dealIntelligenceEngine.ts   # Main computation
├── momentumCalculator.ts       # Momentum scoring
├── confidenceCalculator.ts     # MEDDIC confidence
├── economicsCalculator.ts      # ACV, expected value
└── uncertaintyChecker.ts       # Knows when it doesn't know
```

**API Routes:**
```
app/api/deals/[dealId]/intelligence/route.ts
```

**UI Components:**
```
components/deals/DealIntelligenceCard.tsx
```

---

### Phase 2: AI Jobs System

**Goal:** Make prompts executable with computed context injection.

**Files to Create:**
```
lib/ai/jobs/
├── contextAssembler.ts     # Assemble context for jobs
├── jobExecutor.ts          # Execute AI jobs
└── variableInjector.ts     # Inject {{variables}}
```

**API Routes:**
```
app/api/ai/jobs/[jobSlug]/execute/route.ts
```

**UI Updates:**
- Add `computed_context_required` field to AI Prompts settings
- Add trigger type selector

**Seed Data:**
- AI Roles (Research Analyst, Sales Assistant, Deal Analyst, Sales Strategist, SDR)
- Core AI Jobs (see reference doc for full list)

---

### Phase 3: Human Leverage System

**Goal:** Detect triggers, apply stop rules, generate briefs.

**Files to Create:**
```
lib/ai/leverage/
├── stopRules.ts           # Prevent nagging
├── triggerDetection.ts    # Find leverage moments
├── briefGenerator.ts      # Generate briefs
└── trustBasis.ts          # Historical accuracy
```

**API Routes:**
```
app/api/leverage-moments/route.ts              # GET pending
app/api/leverage-moments/[id]/complete/route.ts
app/api/leverage-moments/[id]/dismiss/route.ts
```

**UI Components:**
```
components/dashboard/HumanLeverageMoments.tsx
components/leverage/HumanLeverageBrief.tsx
```

**Scheduled Jobs:**
- Hourly: Run deal intelligence + trigger detection

---

### Phase 4: Account Memory

**Goal:** Learn what works per account, make it visible.

**Files to Create:**
```
lib/ai/memory/
├── accountMemory.ts       # Read/write
└── memoryUpdater.ts       # Apply updates from analysis
```

**API Routes:**
```
app/api/companies/[companyId]/memory/route.ts
```

**UI Components:**
```
components/companies/AccountMemoryCard.tsx
```

**Integration:**
- After Meeting Analysis completes, run Update Account Memory job
- Inject memory into all sales-related jobs

---

### Phase 5: Learning System

**Goal:** Track outcomes, calibrate accuracy, learn patterns.

**Files to Create:**
```
lib/ai/learning/
├── repTrust.ts            # Calculate rep trust profiles
├── calibration.ts         # Update trigger accuracy
├── postmortem.ts          # Process win/loss
└── patterns.ts            # Extract pattern learnings
```

**Triggers:**
- On deal close → Run Win/Loss Postmortem
- Weekly → Update rep trust profiles
- Weekly → Generate calibration report

---

## Key Implementation Details

### Deal Intelligence Computation

```typescript
// Constants
const ECONOMICS = {
  base_acv: 12000,
  rep_hourly_value: 150,
};

const STAGE_BASE_PROBABILITY = {
  prospecting: 10,
  discovery: 20,
  evaluation: 40,
  proposal: 60,
  negotiation: 75,
  closing: 90,
};

// Main function
async function computeDealIntelligence(dealId: string) {
  const deal = await getDealWithCompanyAndContacts(dealId);
  const activities = await getActivities(dealId);
  
  const momentum = calculateMomentum(activities);
  const confidence = calculateConfidence(deal, contacts, activities);
  const winProb = calculateWinProbability(confidence, deal.stage, momentum);
  const band = calculateConfidenceBand(winProb, confidence);
  const uncertainty = checkUncertainty(confidence, activities.length, band);
  const economics = calculateEconomics(deal.company, winProb);
  
  // Cache to database
  await upsertDealIntelligence(dealId, { ... });
  
  return intelligence;
}
```

### Stop Rules

```typescript
const STOP_RULES = {
  max_leverage_flags_per_day: 2,
  max_active_moments_per_deal: 3,
  cooldown_after_human_action_hours: 24,
  cooldown_after_dismiss_hours: 48,
  min_confidence_threshold: 60,
  economic_threshold: 2000,
};

function shouldCreateLeverageMoment(
  dealId,
  existingMoments,
  economics,
  momentType,
  confidence
) {
  // Check all rules, return { allowed: boolean, reason?: string }
}
```

### Context Assembly

```typescript
async function assembleJobContext(job, params) {
  const context = {};
  
  // Standard context (existing pattern)
  if (job.context_sources?.includes('company')) {
    context.companyInfo = await getCompany(params.companyId);
  }
  // ... contacts, deals, activities, research, transcript
  
  // NEW: Computed context
  if (job.computed_context_required?.includes('dealIntelligence')) {
    context.dealIntelligence = await computeDealIntelligence(params.dealId);
    context.economicContext = context.dealIntelligence.economics;
  }
  if (job.computed_context_required?.includes('accountMemory')) {
    context.accountMemory = await getAccountMemory(params.companyId);
  }
  if (job.computed_context_required?.includes('triggerData')) {
    context.triggerData = params.triggerData;
  }
  if (job.computed_context_required?.includes('trustBasis')) {
    context.trustBasis = params.trustBasis;
  }
  
  return context;
}
```

### Variable Injection

```typescript
function injectVariables(template, context) {
  return template.replace(/\{\{(\w+)\.?(\w+)?\}\}/g, (match, key, subKey) => {
    const value = context[key];
    if (value === undefined) return 'Not available';
    if (subKey && typeof value === 'object') return value[subKey] ?? 'Not available';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
}
```

---

## AI Jobs to Seed

### Sales Assistant

**Meeting Analysis**
- Trigger: auto (transcript.created)
- Context: company, contacts, deal, activities, transcript
- Computed: accountMemory
- Output: JSON with summary, action items, signals, CRM updates

**Update Account Memory**
- Trigger: auto (meeting_analysis.completed)
- Context: company
- Computed: accountMemory
- Input: meetingSummary
- Output: JSON with memory updates to apply

**Email Analysis**
- Trigger: auto (email.received)
- Context: company, contact, deal, activities
- Computed: accountMemory, dealIntelligence
- Output: JSON with classification, signals, response approach

**Draft Email Reply**
- Trigger: manual
- Context: company, contact, deal, activities
- Computed: accountMemory, dealIntelligence
- Output: JSON with subject, body, personalization

### Deal Analyst

**Deal Opportunity Analysis**
- Trigger: scheduled (daily 8am)
- Context: company, contacts, deal, activities, research, products
- Computed: dealIntelligence, economicContext, accountMemory
- Output: JSON with expansion, upsell, acceleration opportunities

**Deal Threat Analysis**
- Trigger: scheduled (daily 8am)
- Context: company, contacts, deal, activities
- Computed: dealIntelligence, accountMemory
- Output: JSON with threats, should_flag_human_leverage

**Win/Loss Postmortem**
- Trigger: auto (deal.closed)
- Context: company, contacts, deal, activities, research
- Computed: dealIntelligence, accountMemory
- Output: JSON with summary, what worked, patterns, memory updates

### Sales Strategist

**Human Leverage Brief**
- Trigger: computed_trigger
- Context: company, contacts, deal, activities
- Computed: dealIntelligence, economicContext, accountMemory, triggerData, trustBasis
- Output: JSON with situation, why_it_matters, talking_points, avoid, etc.

**Meeting Prep**
- Trigger: auto (day before meeting)
- Context: company, contacts, deal, activities, research
- Computed: dealIntelligence, accountMemory
- Output: JSON with objective, profiles, strategy, questions, objections

**Account Strategy**
- Trigger: manual
- Context: company, contacts, deal, activities, research, products, methodology
- Computed: dealIntelligence, economicContext, accountMemory
- Output: JSON with stakeholder map, value prop, strategy, MEDDIC, action plan

### SDR

**Draft Cold Email**
- Trigger: manual
- Context: company, contact, research, products
- Computed: accountMemory (if exists)
- Output: JSON with subject, body, personalization, follow_up_plan

**Draft Follow-Up**
- Trigger: auto (no response X days)
- Context: company, contact, activities, research
- Computed: accountMemory
- Output: JSON with subject, body, approach

---

## Scheduled Jobs Configuration

```typescript
// lib/schedulers/index.ts

export const SCHEDULED_JOBS = [
  {
    name: 'Deal Intelligence Refresh',
    cron: '0 * * * *', // Every hour
    handler: refreshAllDealIntelligence,
  },
  {
    name: 'Leverage Trigger Check',
    cron: '0 * * * *', // Every hour
    handler: checkLeverageTriggers,
  },
  {
    name: 'Daily Deal Analysis',
    cron: '0 8 * * *', // 8am daily
    handler: runDailyDealAnalysis,
  },
  {
    name: 'Meeting Prep',
    cron: '0 6 * * *', // 6am daily
    handler: prepareForTodaysMeetings,
  },
  {
    name: 'Rep Trust Calculation',
    cron: '0 0 * * 0', // Weekly Sunday midnight
    handler: calculateRepTrustProfiles,
  },
  {
    name: 'Calibration Report',
    cron: '0 0 * * 1', // Weekly Monday midnight
    handler: generateCalibrationReport,
  },
];
```

---

## Event Triggers

### transcript.created
1. Store transcript
2. Run Meeting Analysis job
3. Run Update Account Memory job
4. Check for leverage triggers

### email.received
1. Store in activities
2. Run Email Analysis job
3. If draft needed, run Draft Email Reply

### deal.stage_changed
1. Update deal_intelligence
2. If closed_won or closed_lost, run Win/Loss Postmortem

### deal.closed
1. Run Win/Loss Postmortem
2. Apply account memory updates
3. Store pattern learnings
4. Update trigger accuracy for related moments

---

## Testing Checklist

### Phase 1
- [ ] All tables created with proper indexes
- [ ] Deal Intelligence computes correctly for sample deals
- [ ] Intelligence card displays on deal page
- [ ] Confidence bands show correctly
- [ ] Uncertainty state triggers appropriately

### Phase 2
- [ ] AI Jobs seed correctly
- [ ] Context assembly includes computed context
- [ ] Job execution works via API
- [ ] AI Prompts UI shows computed_context field
- [ ] Variable injection works for all patterns

### Phase 3
- [ ] Stop rules prevent over-flagging
- [ ] Trigger detection finds correct moments
- [ ] Briefs generate with trust basis
- [ ] Dashboard shows pending moments
- [ ] Complete/dismiss updates status and tracks outcome

### Phase 4
- [ ] Memory saves and loads correctly
- [ ] Memory updates from meeting analysis
- [ ] "What We've Learned" displays on company page
- [ ] Memory injected into relevant jobs

### Phase 5
- [ ] Rep trust calculates from behavior
- [ ] Postmortems generate on deal close
- [ ] Pattern learnings store correctly
- [ ] Calibration updates trigger accuracy
- [ ] Learning excluded flag works

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Leverage moment completion rate | >70% |
| Leverage moment dismiss rate | <20% |
| Brief view time | <60 seconds |
| Win rate on flagged deals vs unflagged | +15% |
| Win probability accuracy | ±10% |
| Rep NPS for AI system | >50 |
