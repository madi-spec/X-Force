# Complete AI Sales System Implementation

## Overview

This document contains everything needed to implement a production-grade AI-driven sales system:

1. **Research Agent v6.1** - CIA-grade company research
2. **Deal Intelligence Engine** - Computed logic for deal health
3. **Human Leverage System** - AI frames human action
4. **Account Memory** - Learn what works per account
5. **Complete AI Jobs** - All prompts for transcript, email, deal analysis
6. **Three-Layer Architecture** - Research → Extraction → Strategy

---

# PART 1: DATABASE SCHEMA

## All Tables

```sql
-- ============================================
-- AI ROLES & JOBS (Editable Prompts)
-- ============================================

CREATE TABLE ai_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  persona TEXT,                          -- Personality/approach
  icon TEXT,
  category TEXT,                         -- 'research' | 'sales' | 'admin' | 'analysis'
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES ai_roles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- The prompt
  prompt_template TEXT NOT NULL,
  system_prompt TEXT,
  
  -- Output
  response_schema JSONB,
  response_format TEXT DEFAULT 'json',   -- 'json' | 'markdown' | 'text'
  
  -- Execution
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER DEFAULT 4000,
  temperature NUMERIC DEFAULT 0,
  
  -- Variables
  available_variables TEXT[],
  required_variables TEXT[],
  computed_context_required TEXT[],      -- NEW: ['dealIntelligence', 'economicContext', 'accountMemory', 'triggerData']
  
  -- Triggers
  trigger_type TEXT DEFAULT 'manual',    -- 'manual' | 'auto' | 'scheduled' | 'computed_trigger'
  trigger_config JSONB,
  
  -- Context sources
  context_sources TEXT[],
  
  -- UI
  button_label TEXT,
  icon TEXT,
  show_in_company_card BOOLEAN DEFAULT false,
  show_in_contact_card BOOLEAN DEFAULT false,
  show_in_deal_card BOOLEAN DEFAULT false,
  show_in_inbox BOOLEAN DEFAULT false,
  
  -- Category
  job_category TEXT DEFAULT 'general',   -- 'general' | 'leverage_brief' | 'memory_update' | 'deal_analysis' | 'transcript' | 'email'
  
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(role_id, slug)
);

-- Map computed triggers to jobs
CREATE TABLE computed_trigger_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,            -- 'relationship_repair', 'exec_intro', 'competitive_threat'
  job_id UUID REFERENCES ai_jobs(id) ON DELETE CASCADE,
  min_confidence INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job execution history
CREATE TABLE ai_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ai_jobs(id),
  
  -- Context
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),
  
  -- Input/Output
  input_context JSONB,
  output JSONB,
  output_raw TEXT,
  
  -- Execution
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  tokens_used INTEGER,
  
  -- Trigger info
  triggered_by UUID REFERENCES users(id),
  trigger_type TEXT,
  trigger_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- COMPANY RESEARCH (Layer 1)
-- ============================================

CREATE TABLE company_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  
  researched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  agent_version TEXT DEFAULT '6.1',
  confidence_score INTEGER,
  duration_seconds INTEGER,
  tool_calls INTEGER,
  findings_count INTEGER,
  
  status TEXT DEFAULT 'complete',
  error_message TEXT,
  research_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DEAL INTELLIGENCE (Computed, Cached)
-- ============================================

CREATE TABLE deal_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  
  -- Stage & Time
  stage TEXT NOT NULL,
  days_in_stage INTEGER,
  total_days INTEGER,
  
  -- Momentum
  momentum TEXT CHECK (momentum IN ('accelerating', 'stable', 'stalling', 'dead')),
  momentum_score INTEGER,
  momentum_signals JSONB DEFAULT '[]',
  
  -- Confidence Factors (0-100)
  confidence_engagement INTEGER DEFAULT 0,
  confidence_champion INTEGER DEFAULT 0,
  confidence_authority INTEGER DEFAULT 0,
  confidence_need INTEGER DEFAULT 0,
  confidence_timeline INTEGER DEFAULT 0,
  
  -- Win Probability
  win_probability INTEGER DEFAULT 25,
  win_probability_trend TEXT,
  
  -- Economics
  estimated_acv NUMERIC,
  expected_value NUMERIC,
  investment_level TEXT,
  max_human_hours NUMERIC,
  human_hours_spent NUMERIC DEFAULT 0,
  cost_of_delay_per_week NUMERIC,
  
  -- Risk
  risk_factors JSONB DEFAULT '[]',
  stall_reasons JSONB DEFAULT '[]',
  
  -- Next Actions (computed)
  next_actions JSONB DEFAULT '[]',
  
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- HUMAN LEVERAGE MOMENTS
-- ============================================

CREATE TABLE human_leverage_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Classification
  type TEXT NOT NULL,
  urgency TEXT CHECK (urgency IN ('immediate', 'today', 'this_week', 'before_next_milestone')),
  required_role TEXT CHECK (required_role IN ('rep', 'sales_manager', 'exec', 'founder')),
  
  -- Confidence
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  confidence_label TEXT,
  
  -- Trust Basis
  trust_basis JSONB NOT NULL,
  
  -- Brief
  situation TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  what_ai_did TEXT NOT NULL,
  what_human_must_do TEXT NOT NULL,
  why_human TEXT NOT NULL,
  talking_points JSONB DEFAULT '[]',
  data_points JSONB DEFAULT '[]',
  avoid JSONB DEFAULT '[]',
  success_criteria TEXT,
  if_unsuccessful TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending',
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_reason TEXT,
  
  -- Outcome
  outcome TEXT CHECK (outcome IN ('successful', 'unsuccessful', 'unknown')),
  outcome_notes TEXT,
  
  -- Generated by
  generated_by_job_id UUID REFERENCES ai_jobs(id),
  trigger_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- ACCOUNT MEMORY
-- ============================================

CREATE TABLE account_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  -- What works
  resonates JSONB DEFAULT '[]',
  effective_angles JSONB DEFAULT '[]',
  
  -- What doesn't work
  avoided JSONB DEFAULT '[]',
  failed_approaches JSONB DEFAULT '[]',
  
  -- Communication
  preferred_channel TEXT,
  response_pattern TEXT,
  formality_level TEXT,
  best_time_to_reach TEXT,
  
  -- Decision style
  decision_style TEXT,
  typical_timeline TEXT,
  key_concerns TEXT[],
  
  -- Objections
  objections_encountered JSONB DEFAULT '[]',
  
  -- Rapport
  rapport_builders TEXT[],
  personal_notes JSONB DEFAULT '[]',
  
  -- Outcomes
  last_win_theme TEXT,
  last_loss_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memory update audit trail
CREATE TABLE account_memory_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_memory_id UUID REFERENCES account_memory(id) ON DELETE CASCADE,
  
  field_updated TEXT,
  old_value JSONB,
  new_value JSONB,
  source TEXT,
  source_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AI OVERRIDES (Learning from disagreement)
-- ============================================

CREATE TABLE ai_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  override_type TEXT NOT NULL,
  source_type TEXT,
  source_id UUID,
  
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),
  user_id UUID REFERENCES users(id),
  
  ai_recommendation JSONB,
  human_action JSONB,
  override_reason TEXT,
  
  outcome TEXT,
  outcome_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TRUST BASIS (Historical accuracy tracking)
-- ============================================

CREATE TABLE trigger_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  trigger_type TEXT NOT NULL,
  
  -- Stats
  total_fired INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_successful INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0,
  
  -- Computed
  accuracy_rate NUMERIC,
  completion_rate NUMERIC,
  
  -- Period
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_ai_jobs_role ON ai_jobs(role_id);
CREATE INDEX idx_ai_jobs_trigger ON ai_jobs(trigger_type);
CREATE INDEX idx_ai_jobs_category ON ai_jobs(job_category);
CREATE INDEX idx_ai_job_runs_job ON ai_job_runs(job_id);
CREATE INDEX idx_ai_job_runs_company ON ai_job_runs(company_id);
CREATE INDEX idx_ai_job_runs_status ON ai_job_runs(status);
CREATE INDEX idx_deal_intelligence_deal ON deal_intelligence(deal_id);
CREATE INDEX idx_deal_intelligence_momentum ON deal_intelligence(momentum);
CREATE INDEX idx_hlm_company ON human_leverage_moments(company_id);
CREATE INDEX idx_hlm_status ON human_leverage_moments(status);
CREATE INDEX idx_hlm_urgency ON human_leverage_moments(urgency);
CREATE INDEX idx_account_memory_company ON account_memory(company_id);
CREATE INDEX idx_company_research_company ON company_research(company_id);
```

---

# PART 2: DEAL INTELLIGENCE ENGINE (Computed Logic)

## Core Computation

```typescript
// lib/deal-intelligence/engine.ts

import { db } from '@/lib/db';

// ============================================
// TYPES
// ============================================

export interface DealIntelligence {
  stage: string;
  days_in_stage: number;
  total_days: number;
  
  momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  momentum_score: number;
  momentum_signals: MomentumSignal[];
  
  confidence: {
    engagement: number;
    champion: number;
    authority: number;
    need: number;
    timeline: number;
  };
  
  win_probability: number;
  win_probability_trend: 'up' | 'down' | 'stable';
  
  economics: EconomicContext;
  
  risk_factors: RiskFactor[];
  stall_reasons: string[];
  
  next_actions: NextAction[];
}

export interface EconomicContext {
  estimated_acv: number;
  expected_value: number;
  investment_level: 'high' | 'medium' | 'low' | 'minimal';
  max_human_hours: number;
  human_hours_spent: number;
  remaining_budget: number;
  cost_of_delay_per_week: number;
}

export interface MomentumSignal {
  signal: string;
  direction: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface RiskFactor {
  factor: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface NextAction {
  action: string;
  agent_job?: string;
  priority: 'now' | 'soon' | 'eventually';
  reason: string;
  auto_executable: boolean;
  confidence: number;
}

// ============================================
// CONSTANTS (Configurable per org)
// ============================================

const ECONOMICS = {
  base_acv: 12000,
  avg_lifetime_years: 5,
  rep_hourly_value: 150,
  target_cac_ratio: 0.3,
};

const STAGE_BASE_PROBABILITY: Record<string, number> = {
  prospecting: 10,
  discovery: 20,
  evaluation: 40,
  proposal: 60,
  negotiation: 75,
  closing: 90,
};

// ============================================
// MAIN COMPUTATION
// ============================================

export async function computeDealIntelligence(dealId: string): Promise<DealIntelligence> {
  // Fetch all required data
  const deal = await db.deals.findUnique({
    where: { id: dealId },
    include: {
      company: true,
      contacts: true,
    },
  });
  
  if (!deal) throw new Error('Deal not found');
  
  const activities = await db.activities.findMany({
    where: { deal_id: dealId },
    orderBy: { date: 'desc' },
    take: 50,
  });
  
  const research = await db.companyResearch.findUnique({
    where: { company_id: deal.company_id },
  });
  
  // Compute all components
  const momentum = calculateMomentum(activities);
  const confidence = calculateConfidence(deal, deal.contacts, activities, research);
  const win_probability = calculateWinProbability(confidence, deal.stage, momentum);
  const economics = calculateEconomics(deal.company, win_probability);
  const risk_factors = identifyRisks(deal, momentum, confidence, activities);
  const next_actions = determineNextActions(deal, momentum, confidence, activities, economics);
  
  const intelligence: DealIntelligence = {
    stage: deal.stage,
    days_in_stage: daysSince(deal.stage_changed_at),
    total_days: daysSince(deal.created_at),
    momentum: momentum.level,
    momentum_score: momentum.score,
    momentum_signals: momentum.signals,
    confidence,
    win_probability,
    win_probability_trend: calculateTrend(deal),
    economics,
    risk_factors,
    stall_reasons: momentum.level === 'stalling' ? getStallReasons(activities) : [],
    next_actions,
  };
  
  // Cache the result
  await db.dealIntelligence.upsert({
    where: { deal_id: dealId },
    create: {
      deal_id: dealId,
      ...flattenForDb(intelligence),
    },
    update: {
      ...flattenForDb(intelligence),
      computed_at: new Date(),
    },
  });
  
  return intelligence;
}

// ============================================
// MOMENTUM CALCULATION
// ============================================

function calculateMomentum(activities: Activity[]): {
  level: 'accelerating' | 'stable' | 'stalling' | 'dead';
  score: number;
  signals: MomentumSignal[];
} {
  const signals: MomentumSignal[] = [];
  let score = 0;
  
  const now = new Date();
  const last7days = activities.filter(a => daysBetween(a.date, now) <= 7);
  const last14days = activities.filter(a => daysBetween(a.date, now) <= 14);
  
  // Inbound activity
  const inbound7 = last7days.filter(a => a.direction === 'inbound').length;
  const inbound14 = last14days.filter(a => a.direction === 'inbound').length;
  
  if (inbound7 > 2) {
    signals.push({ signal: `${inbound7} inbound activities this week`, direction: 'positive', weight: 25 });
    score += 25;
  } else if (inbound7 > 0) {
    signals.push({ signal: `${inbound7} inbound this week`, direction: 'positive', weight: 15 });
    score += 15;
  } else if (inbound14 > 0) {
    signals.push({ signal: 'No inbound this week, some last week', direction: 'neutral', weight: 0 });
  } else {
    signals.push({ signal: 'No inbound activity in 14 days', direction: 'negative', weight: -30 });
    score -= 30;
  }
  
  // Meeting scheduled
  const upcomingMeeting = activities.find(a => 
    a.type === 'meeting' && new Date(a.date) > now
  );
  if (upcomingMeeting) {
    signals.push({ signal: 'Meeting scheduled', direction: 'positive', weight: 25 });
    score += 25;
  }
  
  // Multiple stakeholders
  const uniqueContacts = new Set(activities.map(a => a.contact_id).filter(Boolean));
  if (uniqueContacts.size >= 3) {
    signals.push({ signal: '3+ stakeholders engaged', direction: 'positive', weight: 20 });
    score += 20;
  }
  
  // Recent meeting completed
  const recentMeeting = activities.find(a => 
    a.type === 'meeting' && daysBetween(a.date, now) <= 7
  );
  if (recentMeeting) {
    signals.push({ signal: 'Meeting held this week', direction: 'positive', weight: 15 });
    score += 15;
  }
  
  // Determine level
  let level: 'accelerating' | 'stable' | 'stalling' | 'dead';
  if (score >= 30) level = 'accelerating';
  else if (score >= 0) level = 'stable';
  else if (score >= -30) level = 'stalling';
  else level = 'dead';
  
  return { level, score, signals };
}

// ============================================
// CONFIDENCE CALCULATION (MEDDIC-aligned)
// ============================================

function calculateConfidence(
  deal: Deal,
  contacts: Contact[],
  activities: Activity[],
  research: CompanyResearch | null
): DealIntelligence['confidence'] {
  
  // Engagement: Are they responding?
  const recentInbound = activities.filter(a => 
    a.direction === 'inbound' && daysSince(a.date) <= 14
  ).length;
  const engagement = Math.min(recentInbound * 25, 100);
  
  // Champion: Do we have internal advocate?
  const hasChampion = contacts.some(c => c.is_champion);
  const championMentions = activities.filter(a => 
    a.notes?.toLowerCase().includes('champion') ||
    a.notes?.toLowerCase().includes('advocate') ||
    a.notes?.toLowerCase().includes('supportive')
  ).length;
  const champion = hasChampion ? 85 : Math.min(championMentions * 20, 60);
  
  // Authority: Talking to decision maker?
  const hasOwner = contacts.some(c => 
    c.is_owner || 
    /owner|ceo|president|founder/i.test(c.title || '')
  );
  const hasDecisionMaker = contacts.some(c => c.is_decision_maker);
  const authority = hasOwner ? 100 : hasDecisionMaker ? 70 : 30;
  
  // Need: Is pain confirmed?
  const painMentions = activities.filter(a =>
    /pain|problem|challenge|frustrated|struggling|issue/i.test(a.notes || '')
  ).length;
  const need = Math.min(painMentions * 25, 100);
  
  // Timeline: Is there urgency?
  const timelineMentions = activities.filter(a =>
    /deadline|by q[1-4]|urgent|asap|soon|this month|this quarter/i.test(a.notes || '')
  ).length;
  const timeline = Math.min(timelineMentions * 30, 100);
  
  return { engagement, champion, authority, need, timeline };
}

// ============================================
// WIN PROBABILITY CALCULATION
// ============================================

function calculateWinProbability(
  confidence: DealIntelligence['confidence'],
  stage: string,
  momentum: { level: string; score: number }
): number {
  const base = STAGE_BASE_PROBABILITY[stage] || 25;
  
  // Confidence adjustment (-20 to +20)
  const avgConfidence = (
    confidence.engagement * 0.2 +
    confidence.champion * 0.25 +
    confidence.authority * 0.2 +
    confidence.need * 0.2 +
    confidence.timeline * 0.15
  );
  const confidenceAdjustment = (avgConfidence - 50) * 0.4;
  
  // Momentum adjustment (-15 to +15)
  const momentumAdjustment = momentum.score * 0.15;
  
  return Math.round(
    Math.max(5, Math.min(95, base + confidenceAdjustment + momentumAdjustment))
  );
}

// ============================================
// ECONOMIC CONTEXT CALCULATION
// ============================================

function calculateEconomics(company: Company, win_probability: number): EconomicContext {
  // ACV multiplier based on company profile
  let acvMultiplier = 1.0;
  
  if (company.employee_count && company.employee_count > 50) acvMultiplier += 0.3;
  if (company.employee_count && company.employee_count > 100) acvMultiplier += 0.3;
  if (company.location_count && company.location_count > 5) acvMultiplier += 0.2;
  if (company.location_count && company.location_count > 10) acvMultiplier += 0.3;
  if (company.ownership_type === 'pe_backed') acvMultiplier += 0.5;
  if (company.ownership_type === 'franchise') acvMultiplier -= 0.2;
  if (company.pct_top_100) acvMultiplier += 0.3;
  
  const estimated_acv = Math.round(ECONOMICS.base_acv * Math.min(acvMultiplier, 3.0));
  const expected_value = Math.round(estimated_acv * (win_probability / 100));
  
  const investment_level = 
    expected_value > 9000 ? 'high' :
    expected_value > 6000 ? 'medium' :
    expected_value > 3000 ? 'low' : 'minimal';
  
  const max_human_hours = Math.round(expected_value / ECONOMICS.rep_hourly_value);
  
  return {
    estimated_acv,
    expected_value,
    investment_level,
    max_human_hours,
    human_hours_spent: 0,
    remaining_budget: max_human_hours,
    cost_of_delay_per_week: Math.round(expected_value / 52),
  };
}

// ============================================
// NEXT ACTIONS DETERMINATION
// ============================================

function determineNextActions(
  deal: Deal,
  momentum: { level: string; score: number },
  confidence: DealIntelligence['confidence'],
  activities: Activity[],
  economics: EconomicContext
): NextAction[] {
  const actions: NextAction[] = [];
  
  // Stalling → Follow-up
  if (momentum.level === 'stalling') {
    actions.push({
      action: 'Send pattern-interrupt follow-up',
      agent_job: 'sdr/draft-follow-up',
      priority: 'now',
      reason: 'No engagement in 7+ days',
      auto_executable: false,
      confidence: 85,
    });
  }
  
  // Low champion → Develop champion
  if (confidence.champion < 50) {
    actions.push({
      action: 'Identify and develop champion',
      agent_job: 'sales-strategist/account-strategy',
      priority: 'soon',
      reason: 'No clear internal advocate',
      auto_executable: true,
      confidence: 75,
    });
  }
  
  // Low authority → Exec intro
  if (confidence.authority < 50 && deal.stage !== 'prospecting') {
    actions.push({
      action: 'Get introduced to decision maker',
      agent_job: null, // Human leverage moment
      priority: 'soon',
      reason: 'Not connected to economic buyer',
      auto_executable: false,
      confidence: 80,
    });
  }
  
  // Meeting tomorrow → Prep
  const upcomingMeeting = activities.find(a => 
    a.type === 'meeting' && 
    new Date(a.date) > new Date() &&
    daysBetween(new Date(), a.date) <= 1
  );
  if (upcomingMeeting) {
    actions.push({
      action: 'Prepare for meeting',
      agent_job: 'sales-strategist/meeting-prep',
      priority: 'now',
      reason: 'Meeting within 24 hours',
      auto_executable: true,
      confidence: 95,
    });
  }
  
  return actions.slice(0, 5);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function daysSince(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}
```

---

# PART 3: HUMAN LEVERAGE SYSTEM

## Stop Rules

```typescript
// lib/human-leverage/stop-rules.ts

export interface StopRules {
  max_leverage_flags_per_day: number;
  max_active_moments_per_deal: number;
  cooldown_after_human_action_hours: number;
  cooldown_after_dismiss_hours: number;
  min_confidence_threshold: number;
  economic_threshold: number;
}

export const DEFAULT_STOP_RULES: StopRules = {
  max_leverage_flags_per_day: 2,
  max_active_moments_per_deal: 3,
  cooldown_after_human_action_hours: 24,
  cooldown_after_dismiss_hours: 48,
  min_confidence_threshold: 60,
  economic_threshold: 2000,
};

export function shouldCreateLeverageMoment(
  dealId: string,
  existingMoments: HumanLeverageMoment[],
  economics: EconomicContext,
  momentType: string,
  confidence: number,
  rules: StopRules = DEFAULT_STOP_RULES
): { allowed: boolean; reason?: string } {
  
  // Check confidence threshold
  if (confidence < rules.min_confidence_threshold) {
    return { 
      allowed: false, 
      reason: `Confidence ${confidence}% below threshold ${rules.min_confidence_threshold}%` 
    };
  }
  
  // Check economic threshold
  if (economics.expected_value < rules.economic_threshold) {
    return { 
      allowed: false, 
      reason: `Expected value $${economics.expected_value} below threshold. Use AI automation only.` 
    };
  }
  
  // Check max active moments
  const activeMoments = existingMoments.filter(m => m.status === 'pending');
  if (activeMoments.length >= rules.max_active_moments_per_deal) {
    return { 
      allowed: false, 
      reason: `Already ${activeMoments.length} active moments.` 
    };
  }
  
  // Check daily limit
  const todayMoments = existingMoments.filter(m => 
    daysSince(m.created_at) === 0
  );
  if (todayMoments.length >= rules.max_leverage_flags_per_day) {
    return { 
      allowed: false, 
      reason: `Daily limit reached.` 
    };
  }
  
  // Check cooldown after action
  const lastCompleted = existingMoments
    .filter(m => m.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
  
  if (lastCompleted) {
    const hoursSinceAction = hoursSince(lastCompleted.completed_at!);
    if (hoursSinceAction < rules.cooldown_after_human_action_hours) {
      return { 
        allowed: false, 
        reason: `Cooldown: ${rules.cooldown_after_human_action_hours - hoursSinceAction}h remaining.` 
      };
    }
  }
  
  // Check cooldown after dismiss
  const lastDismissed = existingMoments
    .filter(m => m.dismissed_at && m.type === momentType)
    .sort((a, b) => new Date(b.dismissed_at!).getTime() - new Date(a.dismissed_at!).getTime())[0];
  
  if (lastDismissed) {
    const hoursSinceDismiss = hoursSince(lastDismissed.dismissed_at!);
    if (hoursSinceDismiss < rules.cooldown_after_dismiss_hours) {
      return { 
        allowed: false, 
        reason: `Similar moment dismissed ${hoursSinceDismiss}h ago.` 
      };
    }
  }
  
  return { allowed: true };
}
```

## Trigger Detection

```typescript
// lib/human-leverage/detect.ts

export interface TriggerCandidate {
  type: string;
  confidence: number;
  signals: string[];
  raw_data: Record<string, any>;
}

export function detectLeverageTriggers(
  deal: Deal,
  company: Company,
  contacts: Contact[],
  activities: Activity[],
  dealIntelligence: DealIntelligence
): TriggerCandidate[] {
  const triggers: TriggerCandidate[] = [];
  
  // 1. RELATIONSHIP REPAIR (Ghosting)
  const lastInbound = activities
    .filter(a => a.direction === 'inbound')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
  const recentOutbound = activities
    .filter(a => a.direction === 'outbound' && daysSince(a.date) <= 14)
    .length;
  
  const daysSinceInbound = lastInbound ? daysSince(lastInbound.date) : 999;
  
  if (daysSinceInbound >= 10 && recentOutbound >= 2) {
    let confidence = 60;
    if (daysSinceInbound >= 14) confidence += 15;
    if (recentOutbound >= 3) confidence += 10;
    if (dealIntelligence.momentum === 'stalling') confidence += 10;
    
    triggers.push({
      type: 'relationship_repair',
      confidence: Math.min(confidence, 95),
      signals: [
        `No response in ${daysSinceInbound} days`,
        `${recentOutbound} outreach attempts`,
        `Momentum: ${dealIntelligence.momentum}`,
      ],
      raw_data: {
        days_since_inbound: daysSinceInbound,
        outbound_attempts: recentOutbound,
        last_inbound_date: lastInbound?.date,
      },
    });
  }
  
  // 2. EXEC INTRO (Authority Gap)
  if (dealIntelligence.confidence.authority < 50 && deal.stage !== 'prospecting') {
    let confidence = 65;
    if (deal.stage === 'evaluation') confidence += 15;
    if (deal.stage === 'proposal') confidence += 20;
    if (dealIntelligence.economics.expected_value > 10000) confidence += 10;
    
    triggers.push({
      type: 'exec_intro',
      confidence: Math.min(confidence, 95),
      signals: [
        `Authority confidence: ${dealIntelligence.confidence.authority}%`,
        `Deal stage: ${deal.stage}`,
        `No owner contact`,
      ],
      raw_data: {
        authority_confidence: dealIntelligence.confidence.authority,
        current_contacts: contacts.map(c => ({ name: c.name, title: c.title })),
        owner_name: company.owner_name,
      },
    });
  }
  
  // 3. COMPETITIVE THREAT
  const competitorMentions = activities.filter(a =>
    /competitor|also looking|other option|comparing|alternative/i.test(a.notes || '')
  );
  
  if (competitorMentions.length > 0 && ['evaluation', 'proposal'].includes(deal.stage)) {
    triggers.push({
      type: 'competitive_threat',
      confidence: 75,
      signals: [
        `Competitor mentioned ${competitorMentions.length}x`,
        `Deal stage: ${deal.stage}`,
      ],
      raw_data: {
        mentions: competitorMentions.map(m => m.notes?.substring(0, 100)),
        count: competitorMentions.length,
      },
    });
  }
  
  return triggers;
}
```

## Brief Generation (Calls AI Job)

```typescript
// lib/human-leverage/generate-brief.ts

export async function generateLeverageBrief(
  trigger: TriggerCandidate,
  companyId: string,
  dealId: string
): Promise<HumanLeverageMoment> {
  
  // Check stop rules first
  const existingMoments = await db.humanLeverageMoments.findMany({
    where: { deal_id: dealId },
    orderBy: { created_at: 'desc' },
    take: 20,
  });
  
  const dealIntelligence = await computeDealIntelligence(dealId);
  
  const stopCheck = shouldCreateLeverageMoment(
    dealId,
    existingMoments,
    dealIntelligence.economics,
    trigger.type,
    trigger.confidence
  );
  
  if (!stopCheck.allowed) {
    throw new Error(`Stop rule: ${stopCheck.reason}`);
  }
  
  // Get trust basis
  const trustBasis = await getTrustBasis(trigger.type);
  
  // Find the AI job for this trigger type
  const triggerJob = await db.computedTriggerJobs.findFirst({
    where: { trigger_type: trigger.type, is_active: true },
    include: { job: true },
  });
  
  if (!triggerJob) {
    throw new Error(`No AI job configured for trigger: ${trigger.type}`);
  }
  
  // Assemble context
  const context = await assembleJobContext(triggerJob.job, {
    companyId,
    dealId,
    triggerData: trigger,
    trustBasis,
  });
  
  // Execute the AI job
  const result = await executeAIJob(triggerJob.job, context);
  
  // Create the leverage moment
  const moment = await db.humanLeverageMoments.create({
    data: {
      company_id: companyId,
      deal_id: dealId,
      type: trigger.type,
      urgency: determineUrgency(trigger),
      required_role: determineRequiredRole(trigger, dealIntelligence),
      confidence: trigger.confidence,
      confidence_label: `${trigger.confidence}% confidence`,
      trust_basis: trustBasis,
      ...result.output,
      generated_by_job_id: triggerJob.job_id,
      trigger_data: trigger.raw_data,
    },
  });
  
  return moment;
}

async function getTrustBasis(triggerType: string): Promise<TrustBasis> {
  // Get historical accuracy for this trigger type
  const accuracy = await db.triggerAccuracy.findFirst({
    where: { trigger_type: triggerType },
    orderBy: { period_end: 'desc' },
  });
  
  const defaultAccuracy: Record<string, number> = {
    relationship_repair: 78,
    exec_intro: 83,
    competitive_threat: 71,
    pricing_exception: 65,
  };
  
  const historicalAccuracy = accuracy?.accuracy_rate || defaultAccuracy[triggerType] || 70;
  
  const outcomeDescriptions: Record<string, string> = {
    relationship_repair: `In ${historicalAccuracy}% of deals that went dark for 10+ days, a personal phone call re-engaged the conversation.`,
    exec_intro: `In ${historicalAccuracy}% of deals at evaluation stage without owner access, deals were lost or stalled indefinitely.`,
    competitive_threat: `Deals where competitive positioning was addressed directly won ${historicalAccuracy}% of the time vs 45% when ignored.`,
    pricing_exception: `Pricing exceptions granted with trade-offs had ${historicalAccuracy}% close rate.`,
  };
  
  return {
    historical_accuracy: historicalAccuracy,
    similar_outcomes: outcomeDescriptions[triggerType] || '',
    signal_sources: [],
    data_points: [],
  };
}
```

---

# PART 4: AI JOB EXECUTION

## Context Assembler

```typescript
// lib/ai-jobs/context-assembler.ts

export interface JobContext {
  // Standard
  companyInfo?: Company;
  contactsInfo?: Contact[];
  contactInfo?: Contact;
  dealsInfo?: Deal[];
  dealInfo?: Deal;
  activitiesInfo?: Activity[];
  productsInfo?: Product[];
  researchContent?: string;
  transcriptContent?: string;
  threadHistory?: Email[];
  incomingEmail?: Email;
  meetingInfo?: Meeting;
  meetingSummary?: MeetingSummary;
  
  // Computed
  dealIntelligence?: DealIntelligence;
  economicContext?: EconomicContext;
  accountMemory?: AccountMemory;
  triggerData?: TriggerCandidate;
  trustBasis?: TrustBasis;
  
  // User
  userWritingStyle?: string;
  methodologyInfo?: SalesMethodology;
}

export async function assembleJobContext(
  job: AIJob,
  params: {
    companyId?: string;
    contactId?: string;
    dealId?: string;
    transcriptId?: string;
    emailId?: string;
    meetingId?: string;
    triggerData?: TriggerCandidate;
    trustBasis?: TrustBasis;
  }
): Promise<JobContext> {
  const context: JobContext = {};
  
  // Standard context sources
  if (job.context_sources?.includes('company') && params.companyId) {
    context.companyInfo = await db.companies.findUnique({
      where: { id: params.companyId },
    });
  }
  
  if (job.context_sources?.includes('contacts') && params.companyId) {
    context.contactsInfo = await db.contacts.findMany({
      where: { company_id: params.companyId },
    });
  }
  
  if (job.context_sources?.includes('contact') && params.contactId) {
    context.contactInfo = await db.contacts.findUnique({
      where: { id: params.contactId },
    });
  }
  
  if (job.context_sources?.includes('deal') && params.dealId) {
    context.dealInfo = await db.deals.findUnique({
      where: { id: params.dealId },
    });
  }
  
  if (job.context_sources?.includes('activities') && (params.companyId || params.dealId)) {
    context.activitiesInfo = await db.activities.findMany({
      where: params.dealId 
        ? { deal_id: params.dealId }
        : { company_id: params.companyId },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }
  
  if (job.context_sources?.includes('research') && params.companyId) {
    const research = await db.companyResearch.findUnique({
      where: { company_id: params.companyId },
    });
    context.researchContent = research?.content;
  }
  
  if (job.context_sources?.includes('transcript') && params.transcriptId) {
    const transcript = await db.transcripts.findUnique({
      where: { id: params.transcriptId },
    });
    context.transcriptContent = transcript?.content;
  }
  
  if (job.context_sources?.includes('products')) {
    context.productsInfo = await db.products.findMany({
      where: { active: true },
    });
  }
  
  if (job.context_sources?.includes('methodology')) {
    context.methodologyInfo = await getSalesMethodology();
  }
  
  // Computed context
  if (job.computed_context_required?.includes('dealIntelligence') && params.dealId) {
    context.dealIntelligence = await computeDealIntelligence(params.dealId);
    context.economicContext = context.dealIntelligence.economics;
  }
  
  if (job.computed_context_required?.includes('accountMemory') && params.companyId) {
    context.accountMemory = await db.accountMemory.findUnique({
      where: { company_id: params.companyId },
    });
  }
  
  if (job.computed_context_required?.includes('triggerData') && params.triggerData) {
    context.triggerData = params.triggerData;
  }
  
  if (job.computed_context_required?.includes('trustBasis') && params.trustBasis) {
    context.trustBasis = params.trustBasis;
  }
  
  return context;
}
```

## Job Executor

```typescript
// lib/ai-jobs/executor.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function executeAIJob(
  job: AIJob,
  context: JobContext
): Promise<{ output: any; raw: string; tokens: number }> {
  
  // Build the prompt with variable injection
  const prompt = injectVariables(job.prompt_template, context);
  
  const startTime = Date.now();
  
  const response = await anthropic.messages.create({
    model: job.model || 'claude-sonnet-4-20250514',
    max_tokens: job.max_tokens || 4000,
    system: job.system_prompt || undefined,
    messages: [{ role: 'user', content: prompt }],
  });
  
  const raw = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
  
  // Parse output based on format
  let output: any;
  if (job.response_format === 'json') {
    try {
      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      output = jsonMatch ? JSON.parse(jsonMatch[0]) : raw;
    } catch {
      output = raw;
    }
  } else {
    output = raw;
  }
  
  // Log the run
  await db.aiJobRuns.create({
    data: {
      job_id: job.id,
      company_id: context.companyInfo?.id,
      deal_id: context.dealInfo?.id,
      contact_id: context.contactInfo?.id,
      input_context: context as any,
      output,
      output_raw: raw,
      status: 'completed',
      started_at: new Date(startTime),
      completed_at: new Date(),
      duration_ms: Date.now() - startTime,
      tokens_used: response.usage?.output_tokens,
      trigger_type: context.triggerData?.type || 'manual',
    },
  });
  
  return { output, raw, tokens: response.usage?.output_tokens || 0 };
}

function injectVariables(template: string, context: JobContext): string {
  let result = template;
  
  // Replace all {{variable}} patterns
  const variablePattern = /\{\{(\w+)\.?(\w+)?\}\}/g;
  
  result = result.replace(variablePattern, (match, key, subKey) => {
    const value = (context as any)[key];
    
    if (value === undefined || value === null) {
      return 'Not available';
    }
    
    if (subKey && typeof value === 'object') {
      return value[subKey] ?? 'Not available';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  });
  
  return result;
}
```

---

# PART 5: ALL AI JOB PROMPTS

## Seed Data for AI Jobs

```typescript
// prisma/seed-ai-jobs.ts

const AI_ROLES = [
  {
    name: 'Sales Assistant',
    slug: 'sales-assistant',
    description: 'Handles operational sales tasks: summaries, emails, CRM updates',
    persona: 'Efficient, detail-oriented, thorough. Handles the work so reps can sell.',
    category: 'admin',
  },
  {
    name: 'Deal Analyst',
    slug: 'deal-analyst',
    description: 'Analyzes deals for opportunities, threats, and health',
    persona: 'Analytical, pattern-recognition, risk-aware. Sees what others miss.',
    category: 'analysis',
  },
  {
    name: 'Sales Strategist',
    slug: 'sales-strategist',
    description: 'Strategic planning, meeting prep, account strategy',
    persona: 'Strategic, consultative, big-picture thinker. Turns data into action.',
    category: 'sales',
  },
  {
    name: 'SDR',
    slug: 'sdr',
    description: 'Outbound outreach, follow-ups, prospecting',
    persona: 'Persistent, personable, creative. Opens doors and qualifies.',
    category: 'sales',
  },
  {
    name: 'Research Analyst',
    slug: 'research-analyst',
    description: 'Deep research on companies and contacts',
    persona: 'Meticulous, thorough, data-driven. Never guesses, always verifies.',
    category: 'research',
  },
];

const AI_JOBS = [
  // ============================================
  // SALES ASSISTANT JOBS
  // ============================================
  {
    role_slug: 'sales-assistant',
    name: 'Meeting Analysis',
    slug: 'meeting-analysis',
    description: 'Analyze meeting transcript into summary, action items, and signals',
    job_category: 'transcript',
    trigger_type: 'auto',
    trigger_config: { event: 'transcript.created' },
    context_sources: ['company', 'contacts', 'deal', 'activities', 'transcript'],
    computed_context_required: ['accountMemory'],
    show_in_company_card: false,
    available_variables: ['transcriptContent', 'meetingInfo', 'companyInfo', 'contactsInfo', 'dealInfo', 'accountMemory'],
    response_format: 'json',
    prompt_template: `Analyze this meeting transcript and produce a comprehensive summary.

## Meeting Context
Company: {{companyInfo.name}}
Attendees: {{contactsInfo}}

## Account Memory (What we've learned)
{{accountMemory}}

## Transcript
{{transcriptContent}}

---

Analyze and extract:

### 1. Executive Summary
3-5 sentences. What happened? What was decided? What's next?

### 2. Key Discussion Points
Main topics with brief context.

### 3. Decisions Made
Commitments or agreements reached.

### 4. Action Items
ALL action items with:
- Task description
- Owner (us or them, specific person if known)
- Due date (if mentioned)
- Priority (high/medium/low)

### 5. Buying Signals
- Interest in features
- Timeline mentions
- Budget discussions
- Stakeholder expansion

### 6. Risk Signals
- Objections raised
- Hesitation
- Competitor mentions
- Timeline delays

### 7. Objections & Responses
Any objections and how they were handled.

### 8. Rapport Notes
Personal details for relationship building.

### 9. Next Steps
Agreed next steps and timing.

### 10. CRM Updates
- Stage change needed?
- New contacts?
- Amount update?

---

Output as JSON:
{
  "executive_summary": "string",
  "key_points": [{"topic": "string", "summary": "string"}],
  "decisions": ["string"],
  "action_items": [{"task": "string", "owner": "string", "due_date": "string", "priority": "string"}],
  "buying_signals": ["string"],
  "risk_signals": ["string"],
  "objections": [{"objection": "string", "response": "string", "resolved": boolean}],
  "rapport_notes": ["string"],
  "next_steps": ["string"],
  "crm_updates": {
    "stage_change": "string | null",
    "new_contacts": [{"name": "string", "title": "string"}],
    "other_updates": [{"field": "string", "value": "string"}]
  }
}`,
  },
  
  {
    role_slug: 'sales-assistant',
    name: 'Update Account Memory',
    slug: 'update-account-memory',
    description: 'Extract learnings from interactions to improve future conversations',
    job_category: 'memory_update',
    trigger_type: 'auto',
    trigger_config: { event: 'meeting_analysis.completed' },
    context_sources: ['company'],
    computed_context_required: ['accountMemory'],
    show_in_company_card: false,
    available_variables: ['meetingSummary', 'transcriptContent', 'accountMemory'],
    response_format: 'json',
    prompt_template: `Analyze this interaction and extract NEW learnings about this account.

## Current Account Memory
What resonates: {{accountMemory.resonates}}
What to avoid: {{accountMemory.avoided}}
Preferred channel: {{accountMemory.preferred_channel}}
Decision style: {{accountMemory.decision_style}}
Past objections: {{accountMemory.objections_encountered}}

## Meeting Summary
{{meetingSummary}}

---

Extract ONLY NEW learnings not already in memory:

1. **What Resonated** - Topics where they engaged, asked questions, showed interest
2. **What Fell Flat** - Topics that got pushback or disengagement
3. **Objections & Responses** - New objections and what worked
4. **Communication Preferences** - Detail vs high-level, formal vs casual
5. **Decision Style Signals** - Who else involved, how they decide
6. **Rapport Builders** - Personal topics mentioned

---

Output as JSON (only fields with NEW information):
{
  "add_to_resonates": ["string"] | null,
  "add_to_avoided": ["string"] | null,
  "new_objection": {"objection": "string", "response_that_worked": "string"} | null,
  "update_preferred_channel": "phone|email|linkedin|video" | null,
  "update_decision_style": "owner_led|consensus|committee" | null,
  "add_rapport_builder": "string" | null,
  "key_insight": "string" | null
}`,
  },
  
  {
    role_slug: 'sales-assistant',
    name: 'Email Analysis',
    slug: 'email-analysis',
    description: 'Analyze incoming email for intent, signals, and response approach',
    job_category: 'email',
    trigger_type: 'auto',
    trigger_config: { event: 'email.received' },
    context_sources: ['company', 'contact', 'deal', 'activities'],
    computed_context_required: ['accountMemory', 'dealIntelligence'],
    show_in_inbox: true,
    available_variables: ['incomingEmail', 'threadHistory', 'contactInfo', 'companyInfo', 'dealInfo', 'accountMemory'],
    response_format: 'json',
    prompt_template: `Analyze this incoming email.

## Email
From: {{incomingEmail.from}}
Subject: {{incomingEmail.subject}}
Date: {{incomingEmail.date}}

{{incomingEmail.body}}

## Thread History
{{threadHistory}}

## Sender
{{contactInfo}}

## Company
{{companyInfo}}

## Deal
{{dealInfo}}

## Account Memory
{{accountMemory}}

---

Analyze:

### 1. Classification
- Intent: inquiry|objection|request|update|positive_signal|negative_signal
- Urgency: immediate|same_day|this_week|no_rush
- Sentiment: positive|neutral|negative|mixed
- Action Required: yes|no|maybe

### 2. Key Information
- Questions asked
- Requests made
- Timeline mentions
- Stakeholder mentions
- Competitor mentions

### 3. Signals
- Buying signals
- Risk signals

### 4. Response Approach
- Tone to use
- Key points to address
- What NOT to say

---

Output as JSON:
{
  "classification": {
    "intent": "string",
    "urgency": "string",
    "sentiment": "string",
    "action_required": boolean
  },
  "extracted_info": {
    "questions": ["string"],
    "requests": ["string"],
    "timeline_mentions": ["string"],
    "stakeholders_mentioned": ["string"],
    "competitors_mentioned": ["string"]
  },
  "signals": {
    "buying_signals": ["string"],
    "risk_signals": ["string"]
  },
  "suggested_response": {
    "tone": "string",
    "key_points": ["string"],
    "avoid": ["string"]
  }
}`,
  },
  
  {
    role_slug: 'sales-assistant',
    name: 'Draft Email Reply',
    slug: 'draft-email-reply',
    description: 'Draft personalized response to incoming email',
    job_category: 'email',
    trigger_type: 'manual',
    context_sources: ['company', 'contact', 'deal', 'activities'],
    computed_context_required: ['accountMemory', 'dealIntelligence'],
    show_in_inbox: true,
    button_label: 'Draft Reply',
    available_variables: ['incomingEmail', 'emailAnalysis', 'threadHistory', 'contactInfo', 'companyInfo', 'dealInfo', 'accountMemory', 'userWritingStyle'],
    response_format: 'json',
    prompt_template: `Draft a reply to this email.

## Incoming Email
{{incomingEmail}}

## Analysis
{{emailAnalysis}}

## Thread History
{{threadHistory}}

## Recipient
{{contactInfo}}

## Company
{{companyInfo}}

## Deal
{{dealInfo}}

## Account Memory
What resonates: {{accountMemory.resonates}}
What to avoid: {{accountMemory.avoided}}
Preferred style: {{accountMemory.formality_level}}

## My Writing Style
{{userWritingStyle}}

---

Draft a reply that:
1. Matches my writing style
2. Addresses their needs first
3. Uses account memory for personalization
4. Moves forward with clear next step
5. Appropriate length (match their email)
6. No generic fluff

---

Output as JSON:
{
  "subject": "string",
  "body": "string",
  "tone_used": "string",
  "personalization_applied": ["string"],
  "call_to_action": "string",
  "follow_up_task": {"task": "string", "due_date": "string"} | null
}`,
  },
  
  // ============================================
  // DEAL ANALYST JOBS
  // ============================================
  {
    role_slug: 'deal-analyst',
    name: 'Deal Opportunity Analysis',
    slug: 'deal-opportunity-analysis',
    description: 'Identify expansion, upsell, and acceleration opportunities',
    job_category: 'deal_analysis',
    trigger_type: 'scheduled',
    trigger_config: { cron: '0 8 * * *' },
    context_sources: ['company', 'contacts', 'deal', 'activities', 'research', 'products'],
    computed_context_required: ['dealIntelligence', 'economicContext', 'accountMemory'],
    show_in_deal_card: true,
    button_label: 'Find Opportunities',
    available_variables: ['dealInfo', 'companyInfo', 'contactsInfo', 'dealIntelligence', 'economicContext', 'researchContent', 'accountMemory', 'productsInfo', 'activitiesInfo'],
    response_format: 'json',
    prompt_template: `Analyze this deal for opportunities.

## Deal
{{dealInfo}}

## Deal Intelligence
Stage: {{dealIntelligence.stage}}
Momentum: {{dealIntelligence.momentum}}
Win Probability: {{dealIntelligence.win_probability}}%

## Company
{{companyInfo}}

## Research
{{researchContent}}

## Contacts
{{contactsInfo}}

## Our Products
{{productsInfo}}

## Account Memory
{{accountMemory}}

## Economic Context
Expected ACV: ${{economicContext.estimated_acv}}
Expected Value: ${{economicContext.expected_value}}

---

Identify opportunities:

### 1. Expansion
- Additional locations?
- Other departments?
- Related services?

### 2. Upsell
- Higher tier fit?
- Add-on products?
- Professional services?

### 3. Acceleration
- Urgency triggers?
- Champions to leverage?
- Competitive pressure?

### 4. Deal Size
- Sized appropriately?
- Multi-year opportunity?

### 5. Contacts to Engage
- Decision makers missing?
- Influencers to add?

---

Output as JSON:
{
  "expansion_opportunities": [{"opportunity": "string", "rationale": "string", "potential_value": number, "action": "string"}],
  "upsell_opportunities": [{"product": "string", "fit_reason": "string", "action": "string"}],
  "acceleration_opportunities": [{"opportunity": "string", "urgency_trigger": "string", "action": "string"}],
  "deal_size_assessment": {"current": "undersized|right_sized|oversized", "recommendation": "string"},
  "contacts_to_engage": [{"title": "string", "reason": "string", "approach": "string"}],
  "priority_action": {"action": "string", "impact": "string", "urgency": "immediate|this_week|this_month"}
}`,
  },
  
  {
    role_slug: 'deal-analyst',
    name: 'Deal Threat Analysis',
    slug: 'deal-threat-analysis',
    description: 'Identify risks, stalls, and competitive threats',
    job_category: 'deal_analysis',
    trigger_type: 'scheduled',
    trigger_config: { cron: '0 8 * * *' },
    context_sources: ['company', 'contacts', 'deal', 'activities'],
    computed_context_required: ['dealIntelligence', 'accountMemory'],
    show_in_deal_card: true,
    button_label: 'Analyze Threats',
    available_variables: ['dealInfo', 'companyInfo', 'contactsInfo', 'dealIntelligence', 'activitiesInfo', 'accountMemory'],
    response_format: 'json',
    prompt_template: `Analyze this deal for threats and risks.

## Deal
{{dealInfo}}

## Deal Intelligence
Stage: {{dealIntelligence.stage}}
Momentum: {{dealIntelligence.momentum}}
Days in Stage: {{dealIntelligence.days_in_stage}}
Risk Factors: {{dealIntelligence.risk_factors}}

## Company
{{companyInfo}}

## Contacts
{{contactsInfo}}

## Activities
{{activitiesInfo}}

## Account Memory
Past objections: {{accountMemory.objections_encountered}}

---

Identify threats:

### 1. Engagement Risks
- Going dark?
- Response time increasing?
- Fewer stakeholders?

### 2. Competitive Threats
- Competitors mentioned?
- Incumbent resistance?

### 3. Internal Threats
- Missing decision maker?
- No champion?
- Budget unconfirmed?

### 4. Objection Risks
- Unresolved objections?
- Price sensitivity?

### 5. Process Risks
- Unclear decision process?
- Unknown stakeholders?

---

For each threat:
- What is it
- Evidence
- Severity (critical/high/medium/low)
- Mitigation
- Owner

Output as JSON:
{
  "threats": [{"category": "string", "threat": "string", "evidence": ["string"], "severity": "string", "mitigation": "string", "owner": "string"}],
  "overall_risk_level": "critical|high|medium|low",
  "immediate_action": {"action": "string", "reason": "string"},
  "should_flag_human_leverage": boolean,
  "human_leverage_type": "string | null"
}`,
  },
  
  // ============================================
  // SALES STRATEGIST JOBS
  // ============================================
  {
    role_slug: 'sales-strategist',
    name: 'Human Leverage Brief',
    slug: 'human-leverage-brief',
    description: 'Generate actionable brief when computed trigger fires',
    job_category: 'leverage_brief',
    trigger_type: 'computed_trigger',
    context_sources: ['company', 'contacts', 'deal', 'activities'],
    computed_context_required: ['dealIntelligence', 'economicContext', 'accountMemory', 'triggerData', 'trustBasis'],
    available_variables: ['triggerData', 'trustBasis', 'companyInfo', 'contactsInfo', 'dealInfo', 'dealIntelligence', 'economicContext', 'accountMemory', 'activitiesInfo'],
    response_format: 'json',
    prompt_template: `Generate a Human Leverage Brief for this trigger.

## Trigger
Type: {{triggerData.type}}
Confidence: {{triggerData.confidence}}%
Signals: {{triggerData.signals}}

## Trust Basis
Historical accuracy: {{trustBasis.historical_accuracy}}%
{{trustBasis.similar_outcomes}}

## Company
{{companyInfo}}

## Contacts
{{contactsInfo}}

## Deal
Stage: {{dealInfo.stage}}
Expected Value: ${{economicContext.expected_value}}

## Deal Intelligence
Momentum: {{dealIntelligence.momentum}}
Win Probability: {{dealIntelligence.win_probability}}%

## Account Memory
What resonates: {{accountMemory.resonates}}
What to avoid: {{accountMemory.avoided}}
Preferred channel: {{accountMemory.preferred_channel}}

## Recent Activities
{{activitiesInfo}}

---

Generate a brief the rep can act on in 60 seconds:

### Situation
What happened? 2-3 sentences with specific numbers/dates.

### Why It Matters
Business impact. Reference expected value and trust basis.

### What AI Already Did
What automation tried.

### What You Should Do
ONE clear action. WHO and HOW.

### Why This Needs You
Why AI can't do this.

### Talking Points (4-5)
Use account memory. Tailor to ownership type.

### What to Avoid (3-4)
Include anything from accountMemory.avoided.

### Success Looks Like
How they'll know it worked.

### If Unsuccessful
Fallback plan.

---

Output as JSON:
{
  "situation": "string",
  "why_it_matters": "string",
  "what_ai_did": "string",
  "what_human_must_do": "string",
  "why_human": "string",
  "talking_points": ["string"],
  "avoid": ["string"],
  "success_criteria": "string",
  "if_unsuccessful": "string"
}`,
  },
  
  {
    role_slug: 'sales-strategist',
    name: 'Meeting Prep',
    slug: 'meeting-prep',
    description: 'Prepare comprehensive brief for upcoming meeting',
    job_category: 'general',
    trigger_type: 'auto',
    trigger_config: { hours_before_meeting: 24 },
    context_sources: ['company', 'contacts', 'deal', 'activities', 'research'],
    computed_context_required: ['dealIntelligence', 'accountMemory'],
    show_in_deal_card: true,
    button_label: 'Prep for Meeting',
    available_variables: ['meetingInfo', 'contactsInfo', 'companyInfo', 'dealInfo', 'dealIntelligence', 'researchContent', 'accountMemory', 'activitiesInfo'],
    response_format: 'json',
    prompt_template: `Prepare a meeting brief.

## Meeting
{{meetingInfo}}

## Attendees
{{contactsInfo}}

## Company
{{companyInfo}}

## Research
{{researchContent}}

## Deal
{{dealInfo}}

## Deal Intelligence
{{dealIntelligence}}

## Account Memory
{{accountMemory}}

## Recent Activities
{{activitiesInfo}}

---

### 1. Meeting Objective
What should we accomplish?

### 2. Attendee Profiles
For each:
- Quick background
- Likely priorities
- How to engage them

### 3. Conversation Strategy
- Framing to use (from account memory)
- Topics to avoid
- Style to match

### 4. Key Talking Points
With data references.

### 5. Questions to Ask
Based on confidence gaps.

### 6. Objections to Prepare
Based on profile and history.

### 7. Desired Outcomes
Specific commitments to seek.

### 8. Red Flags
Warning signs to watch.

---

Output as JSON:
{
  "objective": "string",
  "attendee_profiles": [{"name": "string", "background": "string", "priorities": ["string"], "approach": "string"}],
  "conversation_strategy": {"framing": "string", "avoid": ["string"], "style": "string"},
  "talking_points": [{"point": "string", "data_reference": "string"}],
  "questions": ["string"],
  "objections_to_prepare": [{"objection": "string", "response": "string"}],
  "desired_outcomes": ["string"],
  "red_flags": ["string"],
  "checklist": ["string"]
}`,
  },
  
  {
    role_slug: 'sales-strategist',
    name: 'Account Strategy',
    slug: 'account-strategy',
    description: 'Generate comprehensive strategic plan for account',
    job_category: 'general',
    trigger_type: 'manual',
    context_sources: ['company', 'contacts', 'deal', 'activities', 'research', 'products', 'methodology'],
    computed_context_required: ['dealIntelligence', 'economicContext', 'accountMemory'],
    show_in_company_card: true,
    show_in_deal_card: true,
    button_label: 'Generate Strategy',
    available_variables: ['companyInfo', 'researchContent', 'contactsInfo', 'dealInfo', 'dealIntelligence', 'economicContext', 'accountMemory', 'activitiesInfo', 'productsInfo', 'methodologyInfo'],
    response_format: 'json',
    prompt_template: `Generate account strategy.

## Methodology
{{methodologyInfo}}

## Company
{{companyInfo}}

## Research
{{researchContent}}

## Contacts
{{contactsInfo}}

## Deal
{{dealInfo}}

## Deal Intelligence
{{dealIntelligence}}

## Economic Context
Expected ACV: ${{economicContext.estimated_acv}}
Investment Level: {{economicContext.investment_level}}

## Account Memory
{{accountMemory}}

## Products
{{productsInfo}}

---

Generate full strategy:

### 1. Account Overview
Classification, importance, complexity.

### 2. Stakeholder Map
Role, influence, priorities, approach for each.

### 3. Value Proposition
Tailored to ownership type. Specific proof points.

### 4. Entry/Expansion Strategy
Path forward, sequence of moves.

### 5. Competitive Positioning
Alternatives, differentiation.

### 6. Objection Strategy
Likely objections and responses.

### 7. Timeline
Milestones, accelerators, blockers.

### 8. MEDDIC Assessment
Current status on each element.

### 9. Risks
Major risks and mitigations.

### 10. Action Plan
Prioritized next steps.

---

Output as JSON with all sections.`,
  },
  
  // ============================================
  // SDR JOBS
  // ============================================
  {
    role_slug: 'sdr',
    name: 'Draft Cold Email',
    slug: 'draft-cold-email',
    description: 'Create personalized first-touch email',
    job_category: 'email',
    trigger_type: 'manual',
    context_sources: ['company', 'contact', 'research', 'products'],
    computed_context_required: ['accountMemory'],
    show_in_company_card: true,
    show_in_contact_card: true,
    button_label: 'Draft Outreach',
    available_variables: ['contactInfo', 'companyInfo', 'researchContent', 'productsInfo', 'accountMemory'],
    response_format: 'json',
    prompt_template: `Create a personalized cold email.

## Recipient
{{contactInfo}}

## Company
{{companyInfo}}

## Research
{{researchContent}}

## Products
{{productsInfo}}

---

Write an email that:
1. Personalized hook from research
2. Relevant insight
3. Clear value
4. Simple CTA
5. Under 150 words
6. No fluff

Tailor to ownership type: {{companyInfo.ownership_type}}
- Family: Legacy, relationships, long-term
- PE: ROI, efficiency, scalability
- Independent: Growth, competitive advantage

---

Output as JSON:
{
  "subject": "string",
  "body": "string",
  "personalization_hooks": ["string"],
  "cta": "string",
  "follow_up_plan": {"days": number, "angle": "string"}
}`,
  },
  
  {
    role_slug: 'sdr',
    name: 'Draft Follow-Up',
    slug: 'draft-follow-up',
    description: 'Create pattern-interrupt follow-up email',
    job_category: 'email',
    trigger_type: 'auto',
    trigger_config: { no_response_days: 5 },
    context_sources: ['company', 'contact', 'activities', 'research'],
    computed_context_required: ['accountMemory'],
    show_in_contact_card: true,
    button_label: 'Draft Follow-Up',
    available_variables: ['contactInfo', 'companyInfo', 'previousOutreach', 'activitiesInfo', 'accountMemory', 'researchContent'],
    response_format: 'json',
    prompt_template: `Create a follow-up email.

## Recipient
{{contactInfo}}

## Company
{{companyInfo}}

## Previous Outreach
{{previousOutreach}}

## Account Memory
{{accountMemory}}

## Research
{{researchContent}}

---

This is attempt #{{attemptNumber}}.

Approach by attempt:
- Attempt 2: Add value (article, insight)
- Attempt 3: Different angle
- Attempt 4: Direct & honest
- Attempt 5: Breakup email

Principles:
1. Different from previous
2. Acknowledge silence if appropriate
3. Add value, don't just ask
4. Easy out
5. One CTA

---

Output as JSON:
{
  "subject": "string",
  "body": "string",
  "approach_used": "add_value|different_angle|direct|breakup",
  "different_from_previous": "string",
  "if_no_response": "string"
}`,
  },
  
  // ============================================
  // RESEARCH ANALYST JOBS
  // ============================================
  {
    role_slug: 'research-analyst',
    name: 'Company Deep Research',
    slug: 'company-deep-research',
    description: 'Full v6.1 research protocol',
    job_category: 'research',
    trigger_type: 'manual',
    context_sources: ['company'],
    show_in_company_card: true,
    button_label: 'Run Research',
    max_tokens: 8000,
    available_variables: ['companyInfo'],
    response_format: 'markdown',
    prompt_template: `[FULL V6.1 RESEARCH AGENT PROMPT - See separate document]`,
  },
];

// Computed trigger mappings
const TRIGGER_JOBS = [
  { trigger_type: 'relationship_repair', job_slug: 'human-leverage-brief', min_confidence: 60 },
  { trigger_type: 'exec_intro', job_slug: 'human-leverage-brief', min_confidence: 65 },
  { trigger_type: 'competitive_threat', job_slug: 'human-leverage-brief', min_confidence: 70 },
];
```

---

# PART 6: API ROUTES

## Execute AI Job

```typescript
// app/api/ai/jobs/[jobSlug]/execute/route.ts

export async function POST(
  req: Request,
  { params }: { params: { jobSlug: string } }
) {
  const { jobSlug } = params;
  const body = await req.json();
  const { companyId, contactId, dealId, transcriptId, emailId } = body;
  
  // Find the job
  const job = await db.aiJobs.findFirst({
    where: { slug: jobSlug, is_active: true },
    include: { role: true },
  });
  
  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }
  
  // Assemble context
  const context = await assembleJobContext(job, {
    companyId,
    contactId,
    dealId,
    transcriptId,
    emailId,
  });
  
  // Execute
  const result = await executeAIJob(job, context);
  
  return Response.json({
    success: true,
    output: result.output,
    job_run_id: result.runId,
  });
}
```

## Human Leverage Endpoints

```typescript
// app/api/leverage-moments/route.ts

// GET - List pending moments
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';
  
  const moments = await db.humanLeverageMoments.findMany({
    where: { status },
    include: {
      company: { select: { name: true } },
      deal: { select: { name: true, stage: true } },
    },
    orderBy: [
      { urgency: 'asc' },
      { created_at: 'desc' },
    ],
  });
  
  return Response.json({ moments });
}

// app/api/leverage-moments/[id]/complete/route.ts
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { outcome, notes } = await req.json();
  
  const moment = await db.humanLeverageMoments.update({
    where: { id: params.id },
    data: {
      status: 'completed',
      completed_at: new Date(),
      outcome,
      outcome_notes: notes,
    },
  });
  
  // Update trigger accuracy stats
  await updateTriggerAccuracy(moment.type, outcome === 'successful');
  
  return Response.json({ success: true, moment });
}

// app/api/leverage-moments/[id]/dismiss/route.ts
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json();
  
  const moment = await db.humanLeverageMoments.update({
    where: { id: params.id },
    data: {
      status: 'dismissed',
      dismissed_at: new Date(),
      dismissed_reason: reason,
    },
  });
  
  // Track override for learning
  await db.aiOverrides.create({
    data: {
      override_type: 'leverage_moment_dismissed',
      source_type: 'human_leverage_moment',
      source_id: params.id,
      company_id: moment.company_id,
      deal_id: moment.deal_id,
      ai_recommendation: { type: moment.type, action: moment.what_human_must_do },
      override_reason: reason,
    },
  });
  
  return Response.json({ success: true });
}
```

## Deal Intelligence Endpoint

```typescript
// app/api/deals/[dealId]/intelligence/route.ts

export async function GET(
  req: Request,
  { params }: { params: { dealId: string } }
) {
  const { dealId } = params;
  
  // Get cached or compute fresh
  let intelligence = await db.dealIntelligence.findUnique({
    where: { deal_id: dealId },
  });
  
  // Recompute if stale (>1 hour)
  if (!intelligence || hoursSince(intelligence.computed_at) > 1) {
    intelligence = await computeDealIntelligence(dealId);
  }
  
  return Response.json({ intelligence });
}

// Force recompute
export async function POST(
  req: Request,
  { params }: { params: { dealId: string } }
) {
  const intelligence = await computeDealIntelligence(params.dealId);
  return Response.json({ intelligence });
}
```

---

# PART 7: SCHEDULED JOBS

## Deal Intelligence Scheduler

```typescript
// lib/schedulers/deal-intelligence.ts

export async function runDealIntelligenceJob() {
  // Get all active deals
  const deals = await db.deals.findMany({
    where: {
      stage: { notIn: ['closed_won', 'closed_lost'] },
    },
  });
  
  for (const deal of deals) {
    try {
      // Compute intelligence
      const intelligence = await computeDealIntelligence(deal.id);
      
      // Check for leverage triggers
      const triggers = await detectLeverageTriggers(
        deal,
        deal.company,
        deal.contacts,
        await getActivities(deal.id),
        intelligence
      );
      
      // Create leverage moments for valid triggers
      for (const trigger of triggers) {
        try {
          await generateLeverageBrief(trigger, deal.company_id, deal.id);
        } catch (e) {
          // Stop rule prevented creation - that's fine
          console.log(`Trigger ${trigger.type} not created: ${e.message}`);
        }
      }
    } catch (e) {
      console.error(`Failed to process deal ${deal.id}:`, e);
    }
  }
}

// Run hourly
// cron: '0 * * * *'
```

## Transcript Processing Scheduler

```typescript
// lib/schedulers/transcript-processing.ts

export async function processNewTranscripts() {
  // Get unprocessed transcripts
  const transcripts = await db.transcripts.findMany({
    where: { processed: false },
  });
  
  for (const transcript of transcripts) {
    try {
      // Run Meeting Analysis job
      const analysisJob = await db.aiJobs.findFirst({
        where: { slug: 'meeting-analysis' },
      });
      
      const context = await assembleJobContext(analysisJob!, {
        companyId: transcript.company_id,
        dealId: transcript.deal_id,
        transcriptId: transcript.id,
      });
      
      const analysisResult = await executeAIJob(analysisJob!, context);
      
      // Store summary
      await db.meetingSummaries.create({
        data: {
          transcript_id: transcript.id,
          company_id: transcript.company_id,
          deal_id: transcript.deal_id,
          summary: analysisResult.output,
        },
      });
      
      // Run Update Account Memory job
      const memoryJob = await db.aiJobs.findFirst({
        where: { slug: 'update-account-memory' },
      });
      
      const memoryContext = await assembleJobContext(memoryJob!, {
        companyId: transcript.company_id,
      });
      memoryContext.meetingSummary = analysisResult.output;
      
      const memoryResult = await executeAIJob(memoryJob!, memoryContext);
      
      // Apply memory updates
      await applyAccountMemoryUpdates(transcript.company_id, memoryResult.output);
      
      // Mark processed
      await db.transcripts.update({
        where: { id: transcript.id },
        data: { processed: true },
      });
      
    } catch (e) {
      console.error(`Failed to process transcript ${transcript.id}:`, e);
    }
  }
}
```

---

# PART 8: IMPLEMENTATION CHECKLIST

## Phase 1: Foundation (Week 1-2)
- [ ] Run database migrations (all tables)
- [ ] Implement Deal Intelligence Engine
- [ ] Implement Economic Context Calculator
- [ ] Create basic API routes for deal intelligence
- [ ] Add deal intelligence to deal card UI

## Phase 2: AI Jobs System (Week 2-3)
- [ ] Seed AI Roles and Jobs
- [ ] Build context assembler
- [ ] Build job executor
- [ ] Add computed_context_required field to AI Prompts UI
- [ ] Wire up job execution API

## Phase 3: Human Leverage MVP (Week 3-4)
- [ ] Implement stop rules
- [ ] Implement trigger detection
- [ ] Create Human Leverage Brief job
- [ ] Build leverage moments API
- [ ] Build leverage moments dashboard UI
- [ ] Add complete/dismiss/defer actions

## Phase 4: Transcript & Email Processing (Week 4-5)
- [ ] Create Meeting Analysis job
- [ ] Create Update Account Memory job
- [ ] Create Email Analysis job
- [ ] Create Draft Email Reply job
- [ ] Build transcript processing scheduler
- [ ] Wire up email triggers

## Phase 5: Deal Analysis (Week 5-6)
- [ ] Create Deal Opportunity Analysis job
- [ ] Create Deal Threat Analysis job
- [ ] Build daily deal analysis scheduler
- [ ] Wire threat analysis to leverage triggers

## Phase 6: Account Memory & Learning (Week 6-7)
- [ ] Build "What We've Learned" UI component
- [ ] Track overrides
- [ ] Build trigger accuracy tracking
- [ ] Create weekly calibration report

## Phase 7: Polish (Week 7-8)
- [ ] Loading states throughout
- [ ] Error handling
- [ ] Toast notifications
- [ ] Mobile responsive
- [ ] Performance optimization

---

# SUMMARY

This implementation gives you:

1. **Deal Intelligence Engine** - Computed logic for momentum, confidence, economics
2. **Human Leverage System** - AI frames human action with trust basis and stop rules
3. **Account Memory** - Learn what works per account, visible to reps
4. **Complete AI Jobs** - All prompts for transcripts, emails, deals, strategy
5. **Learning Loops** - Track outcomes, calibrate accuracy, learn from overrides

The prompts are **editable in your AI Prompts UI**. The computed logic runs deterministically. Together they create a system that:
- Gets smarter over time
- Protects human time
- Earns trust by showing reasoning
- Frames human action instead of just notifying

This is not a CRM. This is a **Sales Decision System**.
